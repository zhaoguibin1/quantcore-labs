#!/usr/bin/env python3
"""QuantCore-Labs glossary pipeline.

Reads scripts/glossary_db.json and writes:
  glossary/index.html, glossary/<term_id>/index.html, and the "## Glossary" section of llms.txt.

Usage (from the repo root):
  python3 scripts/generate_glossary.py            # validate, execute every snippet, build
  python3 scripts/generate_glossary.py --no-test  # skip snippet execution

All text fields are HTML-escaped and JSON-LD is produced with json.dumps, so quotes, '<' and '&'
in definitions, formulas or code are safe. Only sections[].html is inserted as raw HTML.
"""
import html, json, sys, pathlib, re

REPO = pathlib.Path(__file__).resolve().parent.parent
DB = REPO / "scripts" / "glossary_db.json"
MODIFIED = "2026-11-07T21:45:00-05:00"
LICENSE = "MIT"
LICENSE_URL = "https://opensource.org/license/mit"
STDLIB = {"math", "re", "os", "sys", "json", "warnings", "tempfile", "pathlib", "time", "datetime", "itertools", "functools", "collections", "typing", "dataclasses", "statistics"}

def deps(code):
    mods = re.findall(r"^\s*(?:from|import)\s+([A-Za-z_][\w]*)", code, re.M)
    out = []
    for m in mods:
        if m not in STDLIB and m not in out:
            out.append(m)
    return out

def dep_label(code):
    found = deps(code)
    return ", ".join(found) if found else "standard library"

def snippets_first(terms):
    return [t for t in terms if t.get("kind") == "snippet"] + [t for t in terms if t.get("kind") != "snippet"]

def is_snippet(t):
    return t.get("kind") == "snippet"

def path_of(t):
    return f"/code/{t['term_id']}/" if is_snippet(t) else f"/glossary/{t['term_id']}/"

TOOLS_JSON = pathlib.Path(__file__).resolve().parent / "tools.json"
TOOLS = json.loads(TOOLS_JSON.read_text(encoding="utf-8")) if TOOLS_JSON.exists() else []

def tools_for(t):
    return [x for x in TOOLS if t["term_id"] in x["terms"] + x["code"]]

def md_url_of(t):
    return BASE + path_of(t).rstrip("/") + ".md"

def html_to_md(h):
    """Small converter for the controlled HTML used in sections (ul/li, strong, em, code, a, p)."""
    h = re.sub(r'<a href="([^"]+)"[^>]*>(.*?)</a>', lambda m: f"[{m.group(2)}]({m.group(1) if m.group(1).startswith('http') else BASE + m.group(1)})", h, flags=re.S)
    h = re.sub(r"</?strong>", "**", h); h = re.sub(r"</?em>", "*", h); h = re.sub(r"</?code>", "`", h)
    h = re.sub(r"<li>\s*", "- ", h); h = re.sub(r"</li>", "", h)
    h = re.sub(r"</?(ul|ol|p)>", "", h)
    h = re.sub(r"<[^>]+>", "", h)
    lines = [l.strip() for l in html.unescape(h).splitlines()]
    return "\n".join(l for l in lines if l)

def term_md(t):
    url = BASE + path_of(t)
    snip = is_snippet(t)
    out = [f"# {t['name']}", "", f"> {t['summary']}", f"> URL: {url}", "",
           f"Category: {t['category']}. {'Snippet' if snip else 'Term'} ID: `{t['term_id']}`.", "",
           f"## {'What it does' if snip else 'Definition'}", "", t["definition"], "",
           f"## {'Approach' if snip else 'Formula'}", "", "```", t["formula"], "```", ""]
    for sec in t["sections"]:
        out += [f"## {sec['heading']}", "", html_to_md(sec["html"]), ""]
    out += ["## Python reference implementation", "",
            f"Requires {dep_label(t['code_snippet'])}. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: {url}{t['term_id']}.py", "",
            "```python", t["code_snippet"].rstrip(), "```", "", "## FAQ", ""]
    for f in t["faq"]:
        out += [f"**{f['question']}**", "", f["answer"], ""]
    if tools_for(t):
        out += ["## Use it in a calculator", ""] + [f"- [{x['name']}]({BASE}{x['url']})" for x in tools_for(t)] + [""]
    if t["related"]:
        out += ["## Related", ""] + [f"- [{BY[r]['name']}]({BASE + path_of(BY[r])})" for r in t["related"]] + [""]
    return "\n".join(out)

def raw_py(t):
    url = BASE + path_of(t)
    head = (f'"""{t["name"]}: reference implementation.\n\n'
            f'Source: {url}\nLicense: MIT (c) 2026 QuantCore Labs\n'
            f'Requires: Python 3.9+, {", ".join(deps(t["code_snippet"])) or "standard library only"}\n"""\n')
    return head + t["code_snippet"]

def code_ld(t):
    url = BASE + path_of(t)
    d = deps(t["code_snippet"])
    ld = {"@type": "SoftwareSourceCode", "@id": f"{url}#code",
            "name": f"{t['short']} in Python", "description": f"Tested Python reference implementation: {t['summary']}",
            "programmingLanguage": {"@type": "ComputerLanguage", "name": "Python"},
            "runtimePlatform": "Python 3.9+" + (", " + ", ".join(d) if d else ""),
            "codeSampleType": "full solution", "license": LICENSE_URL,
            "url": url, "contentUrl": f"{url}{t['term_id']}.py", "text": t["code_snippet"],
            "isPartOf": {"@id": f"{BASE}/code/#hub"},
            "author": {"@id": f"{BASE}/#org"}, "dateModified": t.get("date_modified", MODIFIED)}
    if not is_snippet(t):
        ld["about"] = {"@id": f"{url}#term"}
    return ld

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

def page(title, desc, path, crumbs, tag, body, ld, md_url=None):
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
{('<link rel="alternate" type="text/markdown" href="' + md_url + '" title="Markdown version for LLMs">' + chr(10)) if md_url else ""}<meta name="robots" content="index,follow,max-snippet:-1">
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
<footer><p>For educational and quantitative research use only. Not investment advice. © QuantCore Labs.</p>
<p><a href="/">Home</a> · <a href="/glossary/">Glossary</a> · <a href="/code/">Code</a> · <a href="/about/">About</a> · <a href="/privacy/">Privacy</a> · <a href="/llms.txt">llms.txt</a></p></footer>
</body>
</html>
"""

def breadcrumb_ld(items):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": f"{BASE}{p}"} for i, (n, p) in enumerate(items)]}



def term_page(t):
    path = path_of(t)
    snip = is_snippet(t)
    url = BASE + path
    code = t["code_snippet"]
    sections = "\n".join(f'<section><h2>{h}</h2>\n{b}\n</section>' for h, b in [(s["heading"],s["html"]) for s in t["sections"]])
    faq_html = "".join(f"<h3>{html.escape(q)}</h3><p>{html.escape(a)}</p>" for q, a in [(f["question"],f["answer"]) for f in t["faq"]])
    related = " ".join(f'<a href="{path_of(BY[s])}">{html.escape(BY[s]["name"])}</a>' for s in t["related"])
    tl = tools_for(t)
    tool_html = ("<section><h2>Use it in a calculator</h2><p>" + " · ".join(
        f'<a href="{x["url"]}">{html.escape(x["name"])}</a>' for x in tl) + "</p></section>\n") if tl else ""
    body = f"""<article>
<h1>{html.escape(t['name'])}</h1>
<p class="lede">{html.escape(t['category'])} · {'Snippet' if snip else 'Term'} ID: <code>{t['term_id']}</code></p>
<p class="def"><strong>{'What it does' if snip else 'Definition'}.</strong> {html.escape(t['definition'])}</p>

<section><h2>{'Approach' if snip else 'Formula'}</h2>
<pre class="formula">{html.escape(t['formula'])}</pre></section>

{sections}

<section id="code"><h2>Python reference implementation</h2>
<p>Requires {html.escape(", ".join(deps(code)) or "standard library only")}. Tested before publication; the generator re-executes it on every rebuild. MIT licensed. <a href="{path}{t['term_id']}.py">Download {t['term_id']}.py</a> · <a href="/code/">All snippets</a></p>
<pre><code>{html.escape(code)}</code></pre></section>

<section><h2>FAQ</h2>{faq_html}</section>

<section class="md"><h2 style="margin-top:0">Summary for AI agents (Markdown mirror)</h2>
<p># {html.escape(t['name'])}</p>
<p>&gt; {html.escape(t['summary'])}</p>
<p>- Category: {html.escape(t['category'])}</p>
<p>- Canonical URL: {url}</p>
<p>- Part of: {BASE}{'/code/' if snip else '/glossary/'}</p>
<p>- Python source: {url}{t['term_id']}.py</p>
</section>

{tool_html}<section class="related"><h2>Related</h2>{related} <a href="{'/code/' if snip else '/glossary/'}">← All {'snippets' if snip else 'terms'}</a></section>
</article>"""
    graph = [ORG]
    if not snip:
        graph.append({"@type": "DefinedTerm", "@id": f"{url}#term", "name": t["name"], "termCode": t["term_id"],
                      "description": t["definition"], "url": url, "inDefinedTermSet": {"@id": SET_ID}})
    ld = {"@context": "https://schema.org", "@graph": graph + [
        {"@type": "TechArticle", "@id": f"{url}#article", "headline": t["name"] + (": Tested Python Implementation" if snip else ": Definition, Formula and Python"),
         "description": t["summary"], **({} if snip else {"about": {"@id": f"{url}#term"}}), "inLanguage": "en",
         "proficiencyLevel": "Expert", "datePublished": t.get("date_published", DATE), "dateModified": t.get("date_modified", MODIFIED),
         "author": {"@id": f"{BASE}/#org"}, "publisher": {"@id": f"{BASE}/#org"},
         "mainEntityOfPage": url, "hasPart": {"@id": f"{url}#code"}},
        code_ld(t),
        {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q,
            "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in [(f["question"],f["answer"]) for f in t["faq"]]]},
        breadcrumb_ld([("QuantCore Labs", "/"), ("Code" if snip else "Glossary", "/code/" if snip else "/glossary/"), (t["short"], path)]),
    ]}
    sect = "code" if snip else "glossary"
    return page(f"{t['name']}: {'Tested Python Code' if snip else 'Definition, Formula & Python'} | QuantCore Labs", t["summary"], path,
                [("quantcore-labs", "/"), (sect, f"/{sect}/"), (t["term_id"], None)],
                ("CODE · " if snip else "GLOSSARY · ") + t["short"].upper(), body, ld, md_url=md_url_of(t))

def index_page():
    cards = "\n".join(f"""<article class="card">
<div class="meta"><span class="cat">{html.escape(t['category'])}</span><span class="id">Term ID: {t['term_id']}</span></div>
<h2><a href="/glossary/{t['term_id']}/">{html.escape(t['name'])}</a></h2>
<p>{html.escape(t['summary'])}</p>
</article>""" for t in GLOSS)
    md = "\n".join(f"<li>- [{html.escape(t['short'])}]({BASE}/glossary/{t['term_id']}/): {html.escape(t['summary'])}</li>" for t in GLOSS)
    body = f"""<h1>Quantitative Finance Glossary</h1>
<p class="lede">Definitions, formulas and tested Python reference implementations for execution, microstructure, risk, volatility, options and statistical arbitrage. Written for quantitative researchers and AI agents.</p>
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
         "url": f"{BASE}/glossary/", "description": "Definitions, formulas and Python implementations for quantitative finance: execution, microstructure, risk, volatility, options and statistical arbitrage.",
         "publisher": {"@id": f"{BASE}/#org"},
         "hasDefinedTerm": [{"@type": "DefinedTerm", "@id": f"{BASE}/glossary/{t['term_id']}/#term", "name": t["name"],
                             "termCode": t["term_id"], "description": t["definition"], "url": f"{BASE}/glossary/{t['term_id']}/",
                             "inDefinedTermSet": {"@id": SET_ID}} for t in GLOSS]},
        breadcrumb_ld([("QuantCore Labs", "/"), ("Glossary", "/glossary/")]),
    ]}
    return page("Quantitative Finance Glossary & Terminology | QuantCore Labs",
                "Definitions, formulas and tested Python implementations for quantitative finance: execution, microstructure, risk, volatility, options and statistical arbitrage.",
                "/glossary/", [("quantcore-labs", "/"), ("glossary", None)], "KNOWLEDGE BASE · GLOSSARY", body, ld)

def code_page():
    rows = "\n".join(f"""<article class="card">
<div class="meta"><span class="cat">{html.escape(t['category'])}</span><span class="id">{html.escape(dep_label(t['code_snippet']))}</span></div>
<h2><a href="{path_of(t)}#code">{html.escape(t['short'])}{'' if is_snippet(t) else ' in Python'}</a></h2>
<p>{html.escape(t['summary'])}</p>
<p><a href="{path_of(t)}{t['term_id']}.py">{t['term_id']}.py</a> · <a href="{path_of(t)}">{'explanation and tests' if is_snippet(t) else 'definition and formula'}</a></p>
</article>""" for t in HUB)
    md = "\n".join(f"<li>- [{html.escape(t['short'])}]({BASE}{path_of(t)}{t['term_id']}.py): {html.escape(dep_label(t['code_snippet']))}</li>" for t in HUB)
    body = f"""<h1>Quant Code Snippets</h1>
<p class="lede">Vectorised, tested Python reference implementations of quantitative finance measures. Each snippet is tested before publication and re-executed by the generator on every rebuild, is MIT licensed, and links to the definition and formula it implements.</p>
<section aria-label="Snippets">
{rows}
</section>
<section class="md"><h2 style="margin-top:0">Summary for AI agents (Markdown mirror)</h2>
<p># QuantCore Labs Quant Code Snippets</p>
<p>&gt; Tested Python implementations, MIT licensed. URL: {BASE}/code/</p>
<ul style="list-style:none;padding:0">{md}</ul>
</section>"""
    ld = {"@context": "https://schema.org", "@graph": [
        ORG,
        {"@type": "CollectionPage", "@id": f"{BASE}/code/#hub", "name": "QuantCore Labs Quant Code Snippets",
         "url": f"{BASE}/code/", "description": "Tested Python reference implementations of quantitative finance measures.",
         "publisher": {"@id": f"{BASE}/#org"}, "license": LICENSE_URL,
         "mainEntity": {"@type": "ItemList", "itemListElement": [
             {"@type": "ListItem", "position": i + 1, "item": {"@id": f"{BASE}{path_of(t)}#code"}}
             for i, t in enumerate(HUB)]}},
        *[{k: v for k, v in code_ld(t).items() if k != "text"} for t in HUB],
        breadcrumb_ld([("QuantCore Labs", "/"), ("Code", "/code/")]),
    ]}
    return page("Quant Python Code Snippets: Tested Reference Implementations | QuantCore Labs",
                "Tested Python implementations for quant research: Numba and NumPy rolling operators, DuckDB and Polars data tools, vectorised backtests, and the glossary measures. MIT licensed.",
                "/code/", [("quantcore-labs", "/"), ("code", None)], "KNOWLEDGE BASE · CODE", body, ld)


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
    """Run each published .py file plus its assertions in a fresh interpreter."""
    import subprocess, tempfile
    with tempfile.TemporaryDirectory() as tmp:
        for t in terms:
            f = pathlib.Path(tmp) / (t["term_id"].replace("-", "_") + ".py")
            f.write_text(raw_py(t) + "\n\n# ---- tests ----\n" + t.get("test", ""), encoding="utf-8")
            r = subprocess.run([sys.executable, str(f)], cwd=tmp, capture_output=True, text=True, timeout=600)
            if r.returncode != 0:
                err = r.stderr.strip().splitlines()[-1] if r.stderr.strip() else "unknown error"
                hint = ""
                m = re.search(r"No module named '([\w.]+)'", r.stderr)
                if m:
                    hint = f"  (pip install -r scripts/requirements.txt; missing {m.group(1)})"
                sys.exit(f"snippet '{t['term_id']}' failed: {err}{hint}")
            print(f"  snippet ok: {t['term_id']}" + (" (+tests)" if t.get("test") else ""))

def _set_section(s, title, lines):
    block = "\n".join([f"## {title}", ""] + lines) + "\n\n"
    if f"## {title}\n" in s:
        return re.sub(rf"## {title}\n.*?(?=^## |\Z)", lambda m: block, s, flags=re.S | re.M)
    return s.replace("## Optional", block + "## Optional") if "## Optional" in s else s.rstrip() + "\n\n" + block

def update_llms(terms):
    p = REPO / "llms.txt"
    s = p.read_text(encoding="utf-8")
    s = _set_section(s, "Glossary", [f"- [Glossary index]({BASE}/glossary/): all terms"] +
                     [f"- [{t['name']}]({BASE}/glossary/{t['term_id']}/): {t['summary']} Markdown: {md_url_of(t)}" for t in terms if not is_snippet(t)])
    s = _set_section(s, "Code", [f"- [Code snippets index]({BASE}/code/): tested Python implementations, MIT licensed"] +
                     [f"- [{t['short']}{'' if is_snippet(t) else ' in Python'}]({BASE}{path_of(t)}): {dep_label(t['code_snippet'])}. Raw: {BASE}{path_of(t)}{t['term_id']}.py Markdown: {md_url_of(t)}" for t in snippets_first(terms)])
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
    GLOSS = [t for t in TERMS if not is_snippet(t)]
    HUB = snippets_first(TERMS)
    if "--no-test" not in sys.argv:
        test_snippets(TERMS)
    out = REPO / "glossary"
    out.mkdir(exist_ok=True)
    pages = {out / "index.html": index_page()}
    pages[REPO / "code" / "index.html"] = code_page()
    for t in TERMS:
        pages[REPO / path_of(t).strip("/") / "index.html"] = term_page(t)
    for path, text in pages.items():
        check_jsonld(text, path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        print("Generated:", path.relative_to(REPO))
    for t in TERMS:
        m = REPO / (path_of(t).strip("/") + ".md")
        m.write_text(term_md(t) + "\n", encoding="utf-8")
        print("Generated:", m.relative_to(REPO))
    for t in TERMS:
        f = REPO / path_of(t).strip("/") / f"{t['term_id']}.py"
        f.write_text(raw_py(t), encoding="utf-8")
        print("Generated:", f.relative_to(REPO))
    update_llms(TERMS)
    print("Updated: llms.txt")
    import subprocess
    subprocess.run([sys.executable, str(REPO / "scripts" / "build_site_pages.py")], check=True)
    subprocess.run([sys.executable, str(REPO / "scripts" / "build_sitemap.py")], check=True)
    subprocess.run([sys.executable, str(REPO / "scripts" / "build_llms_full.py")], check=True)
