#!/usr/bin/env python3
"""Fetch the latest U.S. Treasury par yield curve and write data/rates.json.

Source: U.S. Department of the Treasury, Daily Treasury Par Yield Curve Rates
(U.S. government data, public domain). Standard library only.

Usage (repo root):  python3 scripts/update_rates.py [--csv local_file.csv]
Writes the file only when the latest curve date changes, so unchanged days
produce no commit.
"""
import csv, io, json, math, pathlib, re, sys, urllib.request
from datetime import date, datetime, timezone

REPO = pathlib.Path(__file__).resolve().parent.parent
OUT = REPO / "data" / "rates.json"
URL = ("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/"
       "daily-treasury-rates.csv/{y}/all?type=daily_treasury_yield_curve&field_tdr_date_value={y}&page&_format=csv")
PAGE = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve"

def tenor_years(label):
    """'1 Mo' / '1.5 Month' / '1 Yr' / '10 Year' -> years; None for non-tenor columns."""
    m = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*(mo|mos|month|months|yr|yrs|year|years)\s*", label, re.I)
    if not m:
        return None
    n = float(m.group(1))
    return n / 12 if m.group(2).lower().startswith("mo") else n

def parse(text):
    rows = list(csv.reader(io.StringIO(text.lstrip("﻿"))))
    if len(rows) < 2:
        return None
    head = rows[0]
    cols = [(i, h.strip(), tenor_years(h)) for i, h in enumerate(head) if tenor_years(h) is not None]
    di = next(i for i, h in enumerate(head) if h.strip().lower() == "date")
    best = None
    for r in rows[1:]:
        if len(r) <= di or not r[di].strip():
            continue
        d = datetime.strptime(r[di].strip(), "%m/%d/%Y").date()
        pts = []
        for i, lab, yrs in cols:
            v = r[i].strip() if i < len(r) else ""
            if v and v.upper() != "N/A":
                pts.append((lab, yrs, float(v)))
        if pts and (best is None or d > best[0]):
            best = (d, pts)
    return best

def fetch(year):
    req = urllib.request.Request(URL.format(y=year), headers={"User-Agent": "quantcore-labs-rates-updater"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")

def build(best):
    d, pts = best
    if len(pts) < 5:
        sys.exit(f"only {len(pts)} tenors on {d}; refusing to publish")
    tenors = []
    for lab, yrs, y in sorted(pts, key=lambda p: p[1]):
        if not (-1 < y < 25):
            sys.exit(f"implausible yield {y} for {lab} on {d}")
        h = y / 200.0  # semiannual bond-equivalent basis
        tenors.append({"label": lab, "years": round(yrs, 6), "par_bey": y,
                       "continuous": round(200 * math.log1p(h), 6),
                       "effective_annual": round(((1 + h) ** 2 - 1) * 100, 6)})
    return {"as_of": d.isoformat(),
            "source": "U.S. Department of the Treasury, Daily Treasury Par Yield Curve Rates",
            "source_url": PAGE,
            "basis": "par_bey = published CMT par yield (% , semiannual bond-equivalent); continuous = 2*ln(1+y/2); "
                     "effective_annual = (1+y/2)^2-1. Par yields are used as zero-rate approximations.",
            "tenors": tenors}

def main():
    if "--csv" in sys.argv:
        best = parse(pathlib.Path(sys.argv[sys.argv.index("--csv") + 1]).read_text())
    else:
        y = date.today().year
        best = parse(fetch(y)) or parse(fetch(y - 1))   # early January: no rows yet this year
    if not best:
        sys.exit("no yield curve rows found")
    data = build(best)
    if OUT.exists() and json.loads(OUT.read_text()).get("as_of") == data["as_of"]:
        print("unchanged:", data["as_of"]); return
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(data, indent=1) + "\n")
    print("updated:", data["as_of"], [(t["label"], t["par_bey"]) for t in data["tenors"]][:4], "...")

if __name__ == "__main__":
    main()
