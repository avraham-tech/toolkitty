"""Regenerates the README feature table from hooks/features/index.ts.

Run from the plugin root:  python -I docs/drafts/gen_readme_table.py [README path]
It replaces the block between <!-- FEATURE_TABLE_START --> and <!-- FEATURE_TABLE_END -->,
or a bare <!-- FEATURE_TABLE --> marker, in the README (default docs/drafts/README.md).
"""
import io
import re
import sys

BS = chr(92)  # backslash

idx = io.open('hooks/features/index.ts', encoding='utf-8').read()
imports = dict(re.findall(r"import \{ feature as (\w+) \} from '\./([\w-]+)'", idx))
groups = re.findall(r"title: \{ en: '([^']+)'.*?\n\s*features: \[([^\]]+)\]", idx, re.S)


def english(file, key):
    src = io.open('hooks/features/%s.tsx' % file, encoding='utf-8').read()
    single = re.escape(key) + r":\s*\{\s*en:\s*'((?:[^'" + BS + BS + r"]|" + BS + BS + r".)*)'"
    double = re.escape(key) + r':\s*\{\s*en:\s*"([^"]*)"'
    m = re.search(single, src) or re.search(double, src)
    return m.group(1).replace(BS + "'", "'") if m else '??'


def default_on(file):
    src = io.open('hooks/features/%s.tsx' % file, encoding='utf-8').read()
    m = re.search(r'defaultOn:\s*(true|false)', src)
    return m.group(1) == 'true' if m else False


rows = ['<!-- FEATURE_TABLE_START -->']
count = 0
for title, names in groups:
    rows.append('\n#### %s\n\n| Feature | Default | What it does |\n|---|---|---|' % title)
    for v in [x.strip() for x in names.split(',') if x.strip()]:
        f = imports[v]
        count += 1
        desc = english(f, 'description').replace('|', BS + '|')
        rows.append('| %s | %s | %s |' % (english(f, 'title'), 'on' if default_on(f) else 'off', desc))
rows.append('<!-- FEATURE_TABLE_END -->')
table = '\n'.join(rows)

path = sys.argv[1] if len(sys.argv) > 1 else 'docs/drafts/README.md'
s = io.open(path, encoding='utf-8').read()
if '<!-- FEATURE_TABLE_START -->' in s:
    s = re.sub(r'<!-- FEATURE_TABLE_START -->.*?<!-- FEATURE_TABLE_END -->', lambda _: table, s, flags=re.S)
elif '<!-- FEATURE_TABLE -->' in s:
    s = s.replace('<!-- FEATURE_TABLE -->', table)
else:
    sys.exit('no FEATURE_TABLE marker in ' + path)
io.open(path, 'w', encoding='utf-8').write(s)
print('%d features written to %s' % (count, path))
