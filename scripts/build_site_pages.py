#!/usr/bin/env python3
"""Build the site-level pages from scripts/tools.json and scripts/glossary_db.json:

  index.html           homepage (tools, knowledge base, methodology, AI access)
  404.html             real not-found page (stops Cloudflare Pages' SPA fallback soft-404s)
  about/index.html     about and methodology
  privacy/index.html   privacy
  tool pages           'Related concepts' block between RELATED markers, and site footer links
  llms.txt             '## Tools' and '## Optional' sections

Run from the repo root (generate_glossary.py calls it automatically).
"""
import html, importlib.util, json, pathlib, re

REPO = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("gg", REPO / "scripts" / "generate_glossary.py")
gg = importlib.util.module_from_spec(spec); spec.loader.exec_module(gg)
BASE, ORG, page, breadcrumb_ld = gg.BASE, gg.ORG, gg.page, gg.breadcrumb_ld
esc = html.escape

TOOLS = json.loads((REPO / "scripts" / "tools.json").read_text(encoding="utf-8"))
DB = json.loads((REPO / "scripts" / "glossary_db.json").read_text(encoding="utf-8"))
BY = {t["term_id"]: t for t in DB}
TERMS = [t for t in DB if t.get("kind") != "snippet"]
SNIPS = [t for t in DB if t.get("kind") == "snippet"]
gg.BY = BY
path_of = gg.path_of

GROUPS = [  # homepage grouping of glossary categories
    ("Execution & transaction costs", ["Execution & Market Microstructure", "Execution & Transaction Cost Analysis", "Execution & Market Impact"]),
    ("Market microstructure", ["HFT & Order Book Dynamics", "Market Microstructure & Order Flow"]),
    ("Risk & performance", ["Risk Management", "Performance & Risk Metrics", "Position Sizing"]),
    ("Volatility & options", ["Volatility Modeling", "Options & Derivatives"]),
    ("Time series & stat-arb", ["Time Series & Stat-Arb"]),
    ("Factors & portfolios", ["Factor Research & Alpha Evaluation", "Portfolio & Factor Models"]),
]

EXTRA_CSS = """
.hero{padding:6px 0 4px}
.hero h1{font-size:32px}
.strip{font-size:12px;color:var(--dim);border:1px solid var(--line);border-radius:6px;padding:8px 12px;margin:0 0 26px;background:var(--panel)}
.strip b{color:var(--text)}
.grid2{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.chips span{font-size:11px;color:var(--acc);border:1px solid rgba(34,211,238,.35);border-radius:999px;padding:2px 8px}
.grp h3{margin-top:14px}
.grp p{margin:4px 0;color:var(--dim);font-size:13px}
.grp a{white-space:nowrap}
ul.plain{padding-left:18px}
ul.plain li{margin:6px 0}
"""

def site_page(title, desc, path, crumbs, tag, body, ld):
    return page(title, desc, path, crumbs, tag, body, ld).replace("</style>", EXTRA_CSS + "</style>", 1)

def tool_card(t):
    chips = "".join(f"<span>{esc(c)}</span>" for c in t["chips"])
    return f"""<article class="card">
<h2><a href="{t['url']}">{esc(t['name'])}</a></h2>
<p>{esc(t['desc'])}</p>
<div class="chips">{chips}</div>
</article>"""

def home():
    groups = []
    for label, cats in GROUPS:
        items = [t for t in TERMS if t["category"] in cats]
        if items:
            links = " · ".join(f'<a href="{path_of(t)}">{esc(t["short"])}</a>' for t in items)
            groups.append(f"<h3>{esc(label)}</h3><p>{links}</p>")
    placed = {c for _, cats in GROUPS for c in cats}
    rest = [t for t in TERMS if t["category"] not in placed]
    if rest:
        groups.append("<h3>More</h3><p>" + " · ".join(f'<a href="{path_of(t)}">{esc(t["short"])}</a>' for t in rest) + "</p>")
    snips = " · ".join(f'<a href="{path_of(t)}">{esc(t["short"])}</a>' for t in SNIPS)
    body = f"""<section class="hero">
<h1>QuantCore Labs</h1>
<p class="lede">Quantitative research tools for people who trade on evidence, not noise. Free calculators, a quant glossary and tested Python code. The calculators run entirely in your browser, and every formula is checked against reference implementations before it is published.</p>
</section>
<p class="strip" id="ust">U.S. Treasury par yields: loading…</p>

<section aria-labelledby="tools-h">
<h2 id="tools-h">Calculators</h2>
<div class="grid2">
{chr(10).join(tool_card(t) for t in TOOLS)}
</div>
</section>

<section aria-labelledby="kb-h">
<h2 id="kb-h">Knowledge base</h2>
<div class="grid2">
<article class="card grp">
<div class="meta"><span class="cat">Glossary</span><span class="id">{len(TERMS)} terms</span></div>
<h2><a href="/glossary/">Quant glossary</a></h2>
<p>Definition, formula, institutional usage, pitfalls and a tested Python implementation for each term.</p>
{chr(10).join(groups)}
</article>
<article class="card grp">
<div class="meta"><span class="cat">Code</span><span class="id">{len(SNIPS)} snippets + {len(TERMS)} term implementations</span></div>
<h2><a href="/code/">Quant code snippets</a></h2>
<p>MIT-licensed Python for data handling, fast rolling operators and backtesting. Every file is executed with assertions on each rebuild.</p>
<p>{snips}</p>
</article>
</div>
</section>

<section aria-labelledby="how-h">
<h2 id="how-h">How the numbers are checked</h2>
<ul class="plain">
<li><strong>Against reference libraries.</strong> Calculators and snippets are cross-checked against SciPy, statsmodels, NumPy and pandas, or against closed-form results. For example, the implied-volatility solver is round-tripped over 466 grid cases, and the efficient-frontier optimum matches SciPy SLSQP to 1e-10.</li>
<li><strong>On every rebuild.</strong> Each published Python file is executed in a fresh interpreter together with its assertions, so a dependency change that breaks a result stops the build.</li>
<li><strong>Stated conventions.</strong> Units and day counts (Theta per day, Vega per vol point, 252 or 242 trading days) are written on each page, because most disagreements between tools come from conventions, not maths.</li>
<li><strong>Public data only.</strong> The only external data is the U.S. Treasury par yield curve, which is public and refreshed each business day. Licensed market data is not redistributed.</li>
</ul>
<p>More in <a href="/about/">About &amp; methodology</a>.</p>
</section>

<section aria-labelledby="ai-h" class="md">
<h2 id="ai-h" style="margin-top:0">For AI agents and developers</h2>
<p>- Index: <a href="/llms.txt">/llms.txt</a> · full content in one file: <a href="/llms-full.txt">/llms-full.txt</a></p>
<p>- Every page has a Markdown version (link rel="alternate" type="text/markdown"), e.g. <a href="/glossary/sharpe-ratio.md">/glossary/sharpe-ratio.md</a></p>
<p>- Raw Python for every implementation, e.g. <a href="/glossary/information-coefficient/information-coefficient.py">information-coefficient.py</a> · <a href="/sitemap.xml">sitemap.xml</a></p>
</section>
<script>
(function(){{
  var el = document.getElementById('ust');
  fetch('/data/rates.json', {{ cache: 'no-cache' }}).then(function(r){{ if (!r.ok) throw 0; return r.json(); }}).then(function(c){{
    var pick = function(lab){{ var t = c.tenors.filter(function(x){{ return x.label === lab; }})[0]; return t ? t.par_bey.toFixed(2) + '%' : '–'; }};
    el.innerHTML = 'U.S. Treasury par yields, ' + c.as_of + ': 3M <b>' + pick('3 Mo') + '</b> · 2Y <b>' + pick('2 Yr') + '</b> · 10Y <b>' + pick('10 Yr') +
      '</b> · 30Y <b>' + pick('30 Yr') + '</b>. Used by the one-click risk-free rate in the calculators. <a href="' + c.source_url + '" rel="noopener">Source</a>';
  }}).catch(function(){{ el.style.display = 'none'; }});
}})();
</script>"""
    ld = {"@context": "https://schema.org", "@graph": [
        ORG,
        {"@type": "WebSite", "@id": f"{BASE}/#website", "url": f"{BASE}/", "name": "QuantCore Labs",
         "description": "Free client-side quantitative finance calculators, a quant glossary and tested Python code.",
         "publisher": {"@id": f"{BASE}/#org"}, "inLanguage": "en"},
        {"@type": "ItemList", "@id": f"{BASE}/#tools", "name": "QuantCore Labs calculators",
         "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": t["name"], "url": BASE + t["url"]} for i, t in enumerate(TOOLS)]},
        {"@type": "CollectionPage", "@id": f"{BASE}/#home", "url": f"{BASE}/", "name": "QuantCore Labs",
         "isPartOf": {"@id": f"{BASE}/#website"}, "about": [{"@id": f"{BASE}/glossary/#set"}, {"@id": f"{BASE}/code/#hub"}]},
    ]}
    out = site_page("QuantCore Labs: Free Quant Calculators, Glossary and Tested Python Code",
                    "Free client-side quant tools: option Greeks, implied volatility surface, Sharpe/Sortino/drawdown analytics, efficient frontier, Monte Carlo. Plus a quant glossary and tested Python code.",
                    "/", [("quantcore-labs", None)], "FREE · CLIENT-SIDE · TESTED", body, ld)
    return out.replace('<meta property="og:type" content="article">', '<meta property="og:type" content="website">')

def about():
    body = f"""<article>
<h1>About QuantCore Labs</h1>
<p class="lede">An independent, free collection of quantitative finance calculators, definitions and code. No accounts, no ads and no paywall.</p>

<section><h2>What is here</h2>
<ul class="plain">
<li><strong>{len(TOOLS)} calculators</strong> for options, volatility, portfolio construction, simulation and performance analysis. They run entirely in your browser.</li>
<li><strong>A glossary of {len(TERMS)} terms.</strong> Each has a definition, formula, institutional usage, common pitfalls and a Python implementation.</li>
<li><strong>{len(SNIPS)} code snippets</strong> for data handling, fast rolling operators and backtesting.</li>
</ul></section>

<section><h2>Methodology</h2>
<ul class="plain">
<li><strong>Reference checks.</strong> Every calculator is verified against an independent implementation (SciPy, statsmodels, NumPy or pandas) or a closed-form result before release. Examples: Black-Scholes prices match textbook values; implied volatility is round-tripped across 466 strike, expiry and volatility cases; Sharpe, Sortino, drawdown and VaR match a NumPy/SciPy implementation to about 1e-14; the efficient-frontier optimum matches SciPy SLSQP to 1e-10.</li>
<li><strong>Continuous testing.</strong> Each published Python file is executed together with its assertions on every rebuild of the site. A monthly scheduled check also reruns them after dependency upgrades.</li>
<li><strong>Explicit conventions.</strong> Units, compounding and day counts are stated on each page: Theta per calendar day, Vega per volatility point, continuous versus effective annual rates, and 252 versus 242 trading days.</li>
<li><strong>Honest limits.</strong> Pages state what a model does not do, for example European exercise only, or no extrapolation outside quoted strikes.</li>
</ul></section>

<section><h2>Data</h2>
<p>The only external data is the U.S. Department of the Treasury daily par yield curve. It is U.S. government data in the public domain, refreshed automatically each business day and used for the one-click risk-free rate. Real-time market quotes are not offered, because exchange and vendor data licences generally do not allow redistribution on a public website. To analyse your own data, paste it into a calculator: it stays in your browser.</p></section>

<section><h2>What this is not</h2>
<p>Nothing on this site is investment advice, a recommendation or an offer to buy or sell any security. Model outputs depend on the inputs and assumptions you choose. Past performance does not indicate future results.</p></section>

<section><h2>Corrections</h2>
<p>When an error is found, the page, its Markdown version and its tests are corrected together, and the page's modified date in its structured data is updated. Each page states the conventions it uses, so results can be compared with other tools on a like-for-like basis.</p></section>
</article>"""
    ld = {"@context": "https://schema.org", "@graph": [ORG,
          {"@type": "AboutPage", "@id": f"{BASE}/about/#page", "url": f"{BASE}/about/", "name": "About QuantCore Labs",
           "about": {"@id": f"{BASE}/#org"}, "isPartOf": {"@id": f"{BASE}/#website"}},
          breadcrumb_ld([("QuantCore Labs", "/"), ("About", "/about/")])]}
    return site_page("About & Methodology | QuantCore Labs",
                     "How QuantCore Labs builds and verifies its calculators, glossary and code: reference checks, continuous testing, stated conventions and public data only.",
                     "/about/", [("quantcore-labs", "/"), ("about", None)], "ABOUT · METHODOLOGY", body, ld)

def privacy():
    body = """<article>
<h1>Privacy</h1>
<p class="lede">Short version: no accounts, no cookies set by this site, and nothing you type into a calculator is sent anywhere.</p>
<section><h2>Your inputs</h2>
<p>All calculations run in your browser with JavaScript. Prices, equity curves, option chains and other inputs you enter or paste are not uploaded or stored by this site.</p></section>
<section><h2>Requests the pages make</h2>
<ul class="plain">
<li><strong>quantcore-labs.com</strong> serves the pages and <code>/data/rates.json</code> (the Treasury curve). No personal data is included in these requests.</li>
<li><strong>cdn.jsdelivr.net</strong> is contacted only when you click "3D view" on the implied-volatility page, to load the Plotly charting library.</li>
<li><strong>cdn.tailwindcss.com</strong> is contacted by the efficient-frontier and Monte Carlo pages to load their styling.</li>
</ul>
<p>Like any website, these servers receive your IP address and browser details in order to deliver files.</p></section>
<section><h2>Hosting and statistics</h2>
<p>The site is hosted on Cloudflare, which processes request data such as IP addresses to deliver and protect the site. Aggregate visit statistics come from Cloudflare Web Analytics, which does not use cookies and does not track individuals across sites.</p></section>
<section><h2>Changes</h2>
<p>If the site ever adds features that store data, such as accounts, this page will be updated before they go live.</p></section>
</article>"""
    ld = {"@context": "https://schema.org", "@graph": [ORG,
          {"@type": "WebPage", "@id": f"{BASE}/privacy/#page", "url": f"{BASE}/privacy/", "name": "Privacy", "isPartOf": {"@id": f"{BASE}/#website"}},
          breadcrumb_ld([("QuantCore Labs", "/"), ("Privacy", "/privacy/")])]}
    return site_page("Privacy | QuantCore Labs", "QuantCore Labs privacy: no accounts, no cookies, calculator inputs never leave your browser.",
                     "/privacy/", [("quantcore-labs", "/"), ("privacy", None)], "PRIVACY", body, ld)

def not_found():
    pages = [{"u": t["url"], "n": t["name"]} for t in TOOLS] + [{"u": path_of(t), "n": t["name"]} for t in DB] + \
            [{"u": "/glossary/", "n": "Glossary"}, {"u": "/code/", "n": "Code snippets"}, {"u": "/about/", "n": "About"}]
    body = f"""<h1>Page not found</h1>
<p class="lede">The address <code id="p"></code> does not exist on this site.</p>
<div id="sug"></div>
<p><a href="/">Home</a> · <a href="/glossary/">Glossary</a> · <a href="/code/">Code</a> · <a href="/about/">About</a></p>
<script>
(function(){{
  var P = {json.dumps(pages)};
  var path = location.pathname.toLowerCase(); document.getElementById('p').textContent = path;
  var stop = ['glossary', 'code', 'tools', 'html', 'index', 'www', 'md', 'py'];
  var toks = path.split(/[^a-z0-9]+/).filter(function(t){{ return t.length > 1 && stop.indexOf(t) < 0; }});
  var scored = P.map(function(x){{ var s = 0, u = (x.u + ' ' + x.n).toLowerCase();
    toks.forEach(function(t){{ if (u.indexOf(t) >= 0) s += t.length; }}); return {{ x: x, s: s }}; }})
    .filter(function(o){{ return o.s > 2; }}).sort(function(a, b){{ return b.s - a.s; }}).slice(0, 5);
  if (scored.length) document.getElementById('sug').innerHTML = '<h2>Did you mean</h2><ul class="plain">' +
    scored.map(function(o){{ return '<li><a href="' + o.x.u + '">' + o.x.n.replace(/</g, '&lt;') + '</a></li>'; }}).join('') + '</ul>';
}})();
</script>"""
    out = site_page("Page not found | QuantCore Labs", "Page not found.", "/404", [("quantcore-labs", "/"), ("404", None)], "NOT FOUND", body,
                    {"@context": "https://schema.org", "@type": "WebPage", "name": "Page not found"})
    out = re.sub(r'<link rel="canonical"[^>]*>\n', "", out)
    out = re.sub(r'<meta property="og:url"[^>]*>\n', "", out)
    return out.replace('<meta name="robots" content="index,follow,max-snippet:-1">', '<meta name="robots" content="noindex">')

RELATED_STYLE = ("margin:28px 0 0;padding:14px 16px;border:1px solid rgba(148,163,184,.25);border-radius:8px;"
                 "font:13px/1.7 ui-monospace,Menlo,Consolas,monospace")
FOOTER_LINKS = ('<p style="margin-top:6px"><a href="/">Home</a> · <a href="/glossary/">Glossary</a> · <a href="/code/">Code</a> · '
                '<a href="/about/">About</a> · <a href="/privacy/">Privacy</a> · <a href="/llms.txt">llms.txt</a></p>')

def related_block(t):
    links = [f'<a href="{path_of(BY[x])}" style="color:#22d3ee">{esc(BY[x]["name"])}</a>' for x in t["terms"]]
    code = [f'<a href="{path_of(BY[x])}" style="color:#22d3ee">{esc(BY[x]["short"])}</a>' for x in t["code"]]
    others = [f'<a href="{o["url"]}" style="color:#22d3ee">{esc(o["name"])}</a>' for o in TOOLS if o["id"] != t["id"]]
    parts = [f'<h2 style="margin:0 0 6px;font-size:15px">Related concepts</h2><p style="margin:0 0 8px">{" · ".join(links)}</p>']
    if code:
        parts.append(f'<p style="margin:0 0 8px">Code: {" · ".join(code)}</p>')
    parts.append(f'<p style="margin:0">Other calculators: {" · ".join(others)}</p>')
    return f'<!-- RELATED:BEGIN (generated by scripts/build_site_pages.py) -->\n<section aria-label="Related concepts" style="{RELATED_STYLE}">\n' + \
           "\n".join(parts) + "\n</section>\n<!-- RELATED:END -->\n"

def patch_tool(t):
    f = REPO / t["url"].strip("/") / "index.html"
    s = f.read_text(encoding="utf-8")
    block = related_block(t)
    if "<!-- RELATED:BEGIN" in s:
        s = re.sub(r"<!-- RELATED:BEGIN.*?<!-- RELATED:END -->\n", lambda m: block, s, flags=re.S)
    else:
        assert s.count("</main>") == 1, f
        s = s.replace("</main>", block + "</main>")
    if "<!-- FOOTER-LINKS -->" not in s:
        i = s.rfind("</footer>"); assert i > 0, f
        s = s[:i] + "<!-- FOOTER-LINKS -->" + FOOTER_LINKS + s[i:]
    f.write_text(s, encoding="utf-8")

def update_llms():
    p = REPO / "llms.txt"
    s = p.read_text(encoding="utf-8")
    tools = [f"- [{t['name']}]({BASE}{t['url']}): {t['desc']} Markdown: {BASE}/{t['id']}.md" for t in TOOLS]
    s = gg._set_section(s, "Tools", tools)
    s = gg._set_section(s, "Optional", [f"- [About & methodology]({BASE}/about/): how calculators and code are verified; data sources",
                                        f"- [Privacy]({BASE}/privacy/): no accounts, no cookies, inputs stay in the browser",
                                        f"- [Home]({BASE}/): site overview"])
    p.write_text(s, encoding="utf-8")

if __name__ == "__main__":
    for t in TOOLS:
        assert (REPO / f"{t['id']}.md").exists(), f"missing Markdown mirror {t['id']}.md"
    (REPO / "index.html").write_text(home(), encoding="utf-8")
    (REPO / "404.html").write_text(not_found(), encoding="utf-8")
    for d, fn in (("about", about), ("privacy", privacy)):
        (REPO / d).mkdir(exist_ok=True)
        (REPO / d / "index.html").write_text(fn(), encoding="utf-8")
    for t in TOOLS:
        patch_tool(t)
    update_llms()
    print("site pages: index.html, 404.html, about/, privacy/; related blocks on", len(TOOLS), "tools")
