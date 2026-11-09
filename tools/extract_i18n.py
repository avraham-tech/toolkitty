"""Extracts every Localized literal of the hooks folder into per-language review tables.

Usage: python -X utf8 extract_i18n.py <hooks-folder> <out-folder> [rows-per-chunk]

Writes, per language L in he es fr ru zh ja pt de ko:
  <out>/<L>/chunk-NN.md   a Markdown table: id | key | en | L   (ids are stable: file:line:key)
  <out>/index.json        id -> { file, line, key, lang -> raw source string }
The reviewer reads the Markdown, writes fixes as JSON lines { "id": ..., "lang": ..., "text": ... } and
apply_i18n.py puts them back into the source (re-escaping quotes).
"""
import json
import pathlib
import re
import sys

LANGS = ['en', 'he', 'es', 'fr', 'ru', 'zh', 'ja', 'pt', 'de', 'ko']
KV = re.compile(r"""\b(en|he|es|fr|ru|zh|ja|pt|de|ko):\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")""")
KEY = re.compile(r"([A-Za-z_][A-Za-z0-9_]*)\s*:\s*$")


def literals(text):
    i = 0
    while True:
        j = text.find("en: ", i)
        if j < 0:
            return
        k = text.rfind('{', 0, j)
        if k < 0 or text[k + 1:j].strip() != '':
            i = j + 4
            continue
        depth = 0
        quote = None
        escaped = False
        m = k
        while m < len(text):
            c = text[m]
            if quote is not None:
                if escaped:
                    escaped = False
                elif c == '\\':
                    escaped = True
                elif c == quote:
                    quote = None
            elif c in ('"', "'", '`'):
                quote = c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    break
            m += 1
        yield k, text[k:m + 1]
        i = m + 1


def unescape(s):
    return s.replace("\\'", "'").replace('\\"', '"').replace('\\\\', '\\')


def cell(s):
    return s.replace('|', '\\|').replace('\n', ' ')


def main():
    hooks = pathlib.Path(sys.argv[1])
    out = pathlib.Path(sys.argv[2])
    per = int(sys.argv[3]) if len(sys.argv) > 3 else 120
    out.mkdir(parents=True, exist_ok=True)
    index = {}
    rows = []
    files = sorted(list(hooks.rglob('*.ts')) + list(hooks.rglob('*.tsx')))
    for f in files:
        if 'node_modules' in f.parts or 'tests' in f.parts:
            continue
        text = f.read_text(encoding='utf-8')
        ignore_from = text.find('// i18n-ignore')
        ignore_to = text.find('\n}\n', ignore_from) if ignore_from >= 0 else -1
        for off, lit in literals(text):
            if ignore_from >= 0 and ignore_from <= off <= ignore_to:
                continue
            head = lit[lit.find('en:') + 3:].lstrip()
            if head[:1] not in ('"', "'"):
                continue
            n = text.count('\n', 0, off) + 1
            before = text[max(0, off - 80):off]
            km = KEY.search(before)
            key = km.group(1) if km else '?'
            found = {k: (a if a != '' else b) for k, a, b in KV.findall(lit)}
            rel = f.relative_to(hooks).as_posix()
            id_ = f"{rel}:{n}:{key}"
            # a second literal on the same line (rare): make the id unique
            base = id_
            c = 2
            while id_ in index:
                id_ = f"{base}#{c}"
                c += 1
            index[id_] = {'file': rel, 'line': n, 'key': key, 'raw': found}
            rows.append((id_, key, found))
    (out / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=0), encoding='utf-8')
    for lang in LANGS[1:]:
        d = out / lang
        d.mkdir(exist_ok=True)
        for old in d.glob('chunk-*.md'):
            old.unlink()
        chunks = [rows[i:i + per] for i in range(0, len(rows), per)]
        for ci, chunk in enumerate(chunks):
            lines = [f"# {lang} · chunk {ci + 1}/{len(chunks)} · {len(chunk)} strings", '',
                     f"| id | key | en | {lang} |", '|---|---|---|---|']
            for id_, key, found in chunk:
                en = unescape(found.get('en', ''))
                tr = unescape(found.get(lang, ''))
                lines.append(f"| {id_} | {key} | {cell(en)} | {cell(tr)} |")
            (d / f"chunk-{ci + 1:02d}.md").write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f"{len(rows)} strings · {len(files)} files · chunks per language: {len(chunks)} of up to {per}")


main()
