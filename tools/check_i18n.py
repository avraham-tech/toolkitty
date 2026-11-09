"""Checks every Localized literal in the toolkit sources for the ten languages.

Usage: python check_i18n.py <file-or-folder> [...]
For each `{ en: '...', he: '...', ... }` object (single- or multi-line, placeholders allowed) it reports:
  - a missing language among en he es fr ru zh ja pt de ko
  - a `{placeholder}` present in English but missing in another language (or extra)
  - counts translations identical to English for non-trivial strings (warning only)
Exit code 1 when anything is missing or a placeholder differs.
"""
import pathlib
import re
import sys

LANGS = ['en', 'he', 'es', 'fr', 'ru', 'zh', 'ja', 'pt', 'de', 'ko']
KV = re.compile(r"""\b(en|he|es|fr|ru|zh|ja|pt|de|ko):\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")""")
PH = re.compile(r"\{[a-zA-Z_][a-zA-Z0-9_]*\}")


def literals(text):
    """Yields (offset, literal) for every object that starts with `{ en: '`, honouring quotes."""
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


bad = 0
warn = 0
total = 0
for arg in sys.argv[1:]:
    root = pathlib.Path(arg)
    files = [root] if root.is_file() else sorted(list(root.rglob('*.ts')) + list(root.rglob('*.tsx')) + list(root.rglob('*.py')))
    for f in files:
        if 'node_modules' in f.parts or '.claude-plugin' in f.parts or 'tests' in f.parts or 'testmods' in f.parts:
            continue
        text = f.read_text(encoding='utf-8', errors='replace')
        ignore_from = text.find('// i18n-ignore')
        ignore_to = text.find('\n}\n', ignore_from) if ignore_from >= 0 else -1
        for off, lit in literals(text):
            n = text.count('\n', 0, off) + 1
            if ignore_from >= 0 and ignore_from <= off <= ignore_to:
                continue
            head = lit[lit.find('en:') + 3:].lstrip()
            if head[:1] not in ('"', "'"):
                continue  # an identifier or an array, not a string: typed elsewhere
            total += 1
            found = {k: (a if a != '' else b) for k, a, b in KV.findall(lit)}
            en = found.get('en', '')
            en_ph = sorted(set(PH.findall(en)))
            for lang in LANGS:
                if lang not in found:
                    print(f"{f}:{n}: missing {lang}: {en[:60]}")
                    bad += 1
                    continue
                ph = sorted(set(PH.findall(found[lang])))
                if ph != en_ph:
                    print(f"{f}:{n}: placeholders differ in {lang}: en={en_ph} {lang}={ph}")
                    bad += 1
                if lang != 'en' and len(en) > 12 and found[lang] == en and not en.startswith('/'):
                    warn += 1
print(f"checked {total} literals · {bad} problems · {warn} identical-to-English warnings")
sys.exit(1 if bad else 0)
