#!/usr/bin/env python3
"""Build sitemap.xml from every index.html that declares a canonical URL.

lastmod comes from the file's last git commit, so it changes only when a page really changes.
Usage (repo root): python3 scripts/build_sitemap.py
"""
import pathlib, re, subprocess, sys
from xml.sax.saxutils import escape

REPO = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://quantcore-labs.com"

def lastmod(path):
    out = subprocess.run(["git", "log", "-1", "--format=%cI", "--", str(path)], cwd=REPO,
                         capture_output=True, text=True).stdout.strip()
    return out or None

urls = []
for f in sorted(REPO.rglob("index.html")):
    if any(p.startswith(".") for p in f.relative_to(REPO).parts):
        continue
    m = re.search(r'<link rel="canonical" href="([^"]+)"', f.read_text(encoding="utf-8"))
    if not m:
        print("skip (no canonical):", f.relative_to(REPO)); continue
    loc = m.group(1)
    if not loc.startswith(BASE):
        sys.exit(f"canonical outside site in {f}: {loc}")
    urls.append((loc, lastmod(f)))

urls.sort(key=lambda u: (u[0].count("/"), u[0]))
body = "\n".join(f"  <url><loc>{escape(u)}</loc>" + (f"<lastmod>{m}</lastmod>" if m else "") + "</url>" for u, m in urls)
(REPO / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + "\n</urlset>\n",
    encoding="utf-8")
print(f"sitemap.xml: {len(urls)} URLs")
