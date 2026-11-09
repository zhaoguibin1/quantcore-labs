#!/usr/bin/env python3
"""Build /llms-full.txt: every Markdown mirror listed in /llms.txt, concatenated in order,
so an AI agent can read the whole site in one request.
Usage (repo root): python3 scripts/build_llms_full.py
"""
import pathlib, re, sys

REPO = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://quantcore-labs.com"

llms = (REPO / "llms.txt").read_text(encoding="utf-8")
head = llms.split("\n## ", 1)[0].strip()
urls = []
for u in re.findall(r"Markdown: (https://quantcore-labs\.com/\S+?\.md)", llms):
    if u not in urls:
        urls.append(u)
parts, missing = [], []
for u in urls:
    f = REPO / u[len(BASE) + 1:]
    if not f.exists():
        missing.append(u); continue
    parts.append(f.read_text(encoding="utf-8").strip())
if missing:
    sys.exit("llms.txt points to missing Markdown files: " + ", ".join(missing))
intro = (head + "\n\nThis file concatenates every Markdown page listed in https://quantcore-labs.com/llms.txt "
         "(tools, glossary terms and code snippets), separated by horizontal rules.\n")
(REPO / "llms-full.txt").write_text(intro + "\n---\n\n" + "\n\n---\n\n".join(parts) + "\n", encoding="utf-8")
print(f"llms-full.txt: {len(parts)} documents, {(REPO / 'llms-full.txt').stat().st_size // 1024} KB")
