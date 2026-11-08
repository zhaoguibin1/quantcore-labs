#!/usr/bin/env python3
"""QuantCore-Labs glossary pipeline.

Reads scripts/glossary_db.json and writes:
  glossary/index.html, glossary/<term_id>/index.html, and the "## Glossary" section of llms.txt.

Usage (from the repo root):
  python3 scripts/generate_glossary.py          # validate + build
  python3 scripts/generate_glossary.py --test   # also execute every code_snippet to catch errors

All text fields are HTML-escaped and JSON-LD is produced with json.dumps, so quotes, '<' and '&'
in definitions, formulas or code are safe. Only sections[].html is inserted as raw HTML.
"""
import html, json, sys, pathlib, re

REPO = pathlib.Path(__file__).resolve().parent.parent
DB = REPO / "scripts" / "glossary_db.json"
REQUIRED = ["term_id", "name", "short", "category", "summary", "definition", "formula", "code_snippet", "faq"]
BASE = "https://quantcore-labs.com"
DATE = "2026-11-07T20:00:00-05:00"
SET_ID = f"{BASE}/glossary/#set"
ORG = {"@type": "Organization", "@id": f"{BASE}/#org", "name": "QuantCore Labs", "url": f"{BASE}/"}

CSS = """
:root{--bg:#020617;--panel:#0f172a;--line:#1e293b;--text:#e2e8f0;--dim:#94a3b8;--faint:#64748b;--acc:#22d3ee}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 ui-monospace,"JetBrains Mono","SFMono-Regular",Menlo,Consolas,monospace}
::selection{background:var(--acc);color:var(--bg)}
a{color:var(--acc);text-decoration:none}a:hover{text-decoration:underline}
header{border-bottom:1px solid var(--line);background:rgba(15,23,42,.6);position:sticky;top:0;backdrop-filter:blur(6px);z-index:5}
.bar{max-width:880px;margin:0 auto;padding:10px 16px;display:flex;justify-content:space-between;gap:12px;font-size:12px;color:var(--dim)}
.bar .tag{color:var(--acc);font-weight:600;letter-spacing:.08em;white-space:nowrap}
main{max-width:880px;margin:0 auto;padding:28px 16px 56px}
h1{font-size:28px;line-height:1.25;margin:0 0 8px;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.lede{color:var(--dim);font-size:14px;margin:0 0 24px;max-width:720px}
h2{font-size:17px;margin:34px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line);color:#fff}
h3{font-size:14px;color:var(--acc);margin:18px 0 6px}
p,li{font-size:14px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:18px;margin-bottom:14px;transition:border-color .15s}
.card:hover{border-color:rgba(34,211,238,.5)}
.card .meta{display:flex;justify-content:space-between;gap:8px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
.card .meta .cat{color:var(--acc);font-weight:600}.card .meta .id{color:var(--faint);text-transform:none}
.card h2{border:0;margin:0;padding:0;font-size:17px}
.card p{color:var(--dim);font-size:13px;margin:8px 0 0}
.def{background:var(--panel);border-left:3px solid var(--acc);padding:14px 16px;border-radius:0 6px 6px 0;font-size:15px}
pre{background:#0b1222;border:1px solid var(--line);border-radius:6px;padding:14px;overflow-x:auto;font-size:13px;line-height:1.55;margin:10px 0}
pre.formula{color:#f1f5f9}
code{font-family:inherit}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{border-bottom:1px solid var(--line);padding:7px 8px;text-align:left;vertical-align:top}
th{color:var(--dim);font-weight:500}
.md{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px;font-size:13px}
.md p,.md li{font-size:13px}
.related a{margin-right:16px}
footer{border-top:1px solid var(--line);padding:22px 16px;text-align:center;font-size:12px;color:var(--faint)}
"""

def page(title, desc, path, crumbs, tag, body, ld):
    url = f"{BASE}{path}"
    crumb_html = " / ".join(
        f'<a href="{u}">{html.escape(n)}</a>' if u else f'<span style="color:var(--text)">{html.escape(n)}</span>'
        for n, u in crumbs)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index,follow,max-snippet:-1">
<meta name="theme-color" content="#020617">
<meta property="og:type" content="article">
<meta property="og:site_name" content="QuantCore Labs">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{url}">
<script type="application/ld+json">
{json.dumps(ld, indent=2, ensure_ascii=False).replace("</", "<\\/")}
</script>
<style>{CSS}</style>
</head>
<body>
<header><div class="bar"><nav aria-label="Breadcrumb">{crumb_html}</nav><div class="tag">{html.escape(tag)}</div></div></header>
<main>
{body}
</main>
<footer><p>For educational and quantitative research use only. Not investment advice. © QuantCore Labs.</p></footer>
</body>
</html>
"""

def breadcrumb_ld(items):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": f"{BASE}{p}"} for i, (n, p) in enumerate(items)]}



def term_page(t):
    path = f"/glossary/{t['term_id']}/"
    url = BASE + path
    code = t["code_snippet"]
    sections = "\n".join(f'<section><h2>{h}</h2>\n{b}\n</section>' for h, b in [(s["heading"],s["html"]) for s in t["sections"]])
    faq_html = "".join(f"<h3>{html.escape(q)}</h3><p>{html.escape(a)}</p>" for q, a in [(f["question"],f["answer"]) for f in t["faq"]])
    related = " ".join(f'<a href="/glossary/{s}/">{html.escape(BY[s]["name"])}</a>' for s in t["related"])
    body = f"""<article>
<h1>{html.escape(t['name'])}</h1>
<p class="lede">{html.escape(t['category'])} · Term ID: <code>{t['term_id']}</code></p>
<p class="def"><strong>Definition.</strong> {html.escape(t['definition'])}</p>

<section><h2>Formula</h2>
<pre class="formula">{html.escape(t['formula'])}</pre></section>

{sections}

<section><h2>Python reference implementation</h2>
<p>Tested with NumPy and pandas. Copy and use freely.</p>
<pre><code>{html.escape(code)}</code></pre></section>

<section><h2>FAQ</h2>{faq_html}</section>

<section class="md"><h2 style="margin-top:0">Summary for AI agents (Markdown mirror)</h2>
<p># {html.escape(t['name'])}</p>
<p>&gt; {html.escape(t['summary'])}</p>
<p>- Category: {html.escape(t['category'])}</p>
<p>- Canonical URL: {url}</p>
<p>- Part of: {BASE}/glossary/</p>
</section>

<section class="related"><h2>Related terms</h2>{related} <a href="/glossary/">← All terms</a></section>
</article>"""
    ld = {"@context": "https://schema.org", "@graph": [
        ORG,
        {"@type": "DefinedTerm", "@id": f"{url}#term", "name": t["name"], "termCode": t["term_id"],
         "description": t["definition"], "url": url, "inDefinedTermSet": {"@id": SET_ID}},
        {"@type": "TechArticle", "@id": f"{url}#article", "headline": t["name"] + ": Definition, Formula and Python",
         "description": t["summary"], "about": {"@id": f"{url}#term"}, "inLanguage": "en",
         "proficiencyLevel": "Expert", "datePublished": DATE, "dateModified": DATE,
         "author": {"@id": f"{BASE}/#org"}, "publisher": {"@id": f"{BASE}/#org"},
         "mainEntityOfPage": url},
        {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q,
            "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in [(f["question"],f["answer"]) for f in t["faq"]]]},
        breadcrumb_ld([("QuantCore Labs", "/"), ("Glossary", "/glossary/"), (t["short"], path)]),
    ]}
    return page(f"{t['name']}: Definition, Formula & Python | QuantCore Labs", t["summary"], path,
                [("quantcore-labs", "/"), ("glossary", "/glossary/"), (t["term_id"], None)],
                "GLOSSARY · " + t["short"].upper(), body, ld)

def index_page():
    cards = "\n".join(f"""<article class="card">
<div class="meta"><span class="cat">{html.escape(t['category'])}</span><span class="id">Term ID: {t['term_id']}</span></div>
<h2><a href="/glossary/{t['term_id']}/">{html.escape(t['name'])}</a></h2>
<p>{html.escape(t['summary'])}</p>
</article>""" for t in TERMS)
    md = "\n".join(f"<li>- [{html.escape(t['short'])}]({BASE}/glossary/{t['term_id']}/): {html.escape(t['summary'])}</li>" for t in TERMS)
    body = f"""<h1>Quantitative Finance Glossary</h1>
<p class="lede">Definitions, formulas and tested Python reference implementations for market microstructure, execution and statistical-arbitrage concepts. Written for quantitative researchers and AI agents.</p>
<section aria-label="Terms">
{cards}
</section>
<section class="md"><h2 style="margin-top:0">Summary for AI agents (Markdown mirror)</h2>
<p># QuantCore Labs Glossary</p>
<p>&gt; Quantitative finance definitions with formulas and Python code. URL: {BASE}/glossary/</p>
<ul style="list-style:none;padding:0">{md}</ul>
</section>"""
    ld = {"@context": "https://schema.org", "@graph": [
        ORG,
        {"@type": "DefinedTermSet", "@id": SET_ID, "name": "QuantCore Labs Quantitative Finance Glossary",
         "url": f"{BASE}/glossary/", "description": "Definitions, formulas and Python implementations for quantitative finance, market microstructure and algorithmic trading terms.",
         "publisher": {"@id": f"{BASE}/#org"},
         "hasDefinedTerm": [{"@type": "DefinedTerm", "@id": f"{BASE}/glossary/{t['term_id']}/#term", "name": t["name"],
                             "termCode": t["term_id"], "description": t["definition"], "url": f"{BASE}/glossary/{t['term_id']}/",
                             "inDefinedTermSet": {"@id": SET_ID}} for t in TERMS]},
        breadcrumb_ld([("QuantCore Labs", "/"), ("Glossary", "/glossary/")]),
    ]}
    return page("Quantitative Finance Glossary & Terminology | QuantCore Labs",
                "Definitions, formulas and tested Python implementations for quantitative finance, market microstructure and algorithmic trading terms.",
                "/glossary/", [("quantcore-labs", "/"), ("glossary", None)], "KNOWLEDGE BASE · GLOSSARY", body, ld)


def load_and_validate():
    terms = json.loads(DB.read_text(encoding="utf-8"))
    ids, errors = set(), []
    for i, t in enumerate(terms):
        for k in REQUIRED:
            if not t.get(k):
                errors.append(f"entry {i} ({t.get('term_id', '?')}): missing '{k}'")
        tid = t.get("term_id", "")
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", tid):
            errors.append(f"entry {i}: term_id '{tid}' must be lowercase-hyphenated")
        if tid in ids:
            errors.append(f"duplicate term_id '{tid}'")
        ids.add(tid)
        t.setdefault("sections", []); t.setdefault("related", [])
    for t in terms:
        for r in t["related"]:
            if r not in ids:
                errors.append(f"{t['term_id']}: related term '{r}' does not exist")
    if errors:
        sys.exit("Validation failed:\n  " + "\n  ".join(errors))
    return terms

def test_snippets(terms):
    for t in terms:
        try:
            exec(compile(t["code_snippet"], f"<{t['term_id']}>", "exec"), {"__name__": "snippet"})
        except Exception as e:
            sys.exit(f"code_snippet for '{t['term_id']}' failed: {e!r}")
        print(f"  snippet ok: {t['term_id']}")

def update_llms(terms):
    p = REPO / "llms.txt"
    lines = ["## Glossary", "", f"- [Glossary index]({BASE}/glossary/): all terms"]
    lines += [f"- [{t['name']}]({BASE}/glossary/{t['term_id']}/): {t['summary']}" for t in terms]
    block = "\n".join(lines) + "\n\n"
    s = p.read_text(encoding="utf-8")
    if "## Glossary" in s:
        s = re.sub(r"## Glossary\n.*?(?=^## |\Z)", lambda m: block, s, flags=re.S | re.M)
    else:
        s = s.replace("## Optional", block + "## Optional") if "## Optional" in s else s.rstrip() + "\n\n" + block
    p.write_text(s, encoding="utf-8")

def check_jsonld(text, where):
    for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', text, re.S):
        try:
            json.loads(b)
        except json.JSONDecodeError as e:
            sys.exit(f"Malformed JSON-LD in {where}: {e}")

if __name__ == "__main__":
    TERMS = load_and_validate()
    BY = {t["term_id"]: t for t in TERMS}
    if "--test" in sys.argv:
        test_snippets(TERMS)
    out = REPO / "glossary"
    out.mkdir(exist_ok=True)
    pages = {out / "index.html": index_page()}
    for t in TERMS:
        pages[out / t["term_id"] / "index.html"] = term_page(t)
    for path, text in pages.items():
        check_jsonld(text, path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        print("Generated:", path.relative_to(REPO))
    update_llms(TERMS)
    print("Updated: llms.txt")
