"""Applies reviewer fixes to the sources.

Usage: python -X utf8 apply_i18n.py <hooks-folder> <index.json> <fixes.jsonl> [...]
Each fix line: { "id": "<file:line:key>", "lang": "ja", "text": "<new plain text>" }  (optional "why").
The literal is located again by file and line (lines are stable until the first apply, so run extract again
after applying), the `lang: '...'` span inside that literal is replaced, and placeholders are checked
against English. Prints what it changed and what it refused.
"""
import json
import pathlib
import re
import sys

KV = re.compile(r"""\b(en|he|es|fr|ru|zh|ja|pt|de|ko):\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")""")
PH = re.compile(r"\{[a-zA-Z_][a-zA-Z0-9_]*\}")


# A backslash that does not start an escape sequence the source already had (the review tables show those as written).
LONE_BACKSLASH = re.compile(r"\\(?![ntr0]|u[0-9a-fA-F]{4}|u\{|x[0-9a-fA-F]{2})")
LINE_BREAK = re.compile(r"\\n")


def esc(s, quote):
    """The inverse of extract_i18n's unescape: a reviewer's plain text back into a string literal.

    A real line break or tab becomes its escape (a raw one inside a quoted literal does not parse), an escape
    sequence copied from the table (\\n, \\u200e) stays one, any other backslash is doubled, and the literal's
    own quote is escaped.
    """
    s = s.replace('\r\n', '\n').replace('\n', '\\n').replace('\t', '\\t')
    s = LONE_BACKSLASH.sub(lambda _m: '\\\\', s)
    return s.replace(quote, '\\' + quote)


def main():
    hooks = pathlib.Path(sys.argv[1])
    index = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding='utf-8'))
    fixes = []
    for p in sys.argv[3:]:
        for line in pathlib.Path(p).read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or line.startswith('//'):
                continue
            try:
                fixes.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"skip (bad json): {line[:80]} ({e})")
    by_file = {}
    for fx in fixes:
        ent = index.get(fx.get('id', ''))
        if ent is None:
            print(f"refused (unknown id): {fx.get('id')}")
            continue
        by_file.setdefault(ent['file'], []).append((ent, fx))
    changed = 0
    refused = 0
    for rel, items in by_file.items():
        path = hooks / rel
        # keep the file's own line endings: a text-mode write would turn every line of it into CRLF on Windows
        source = path.read_bytes().decode('utf-8')
        eol = '\r\n' if '\r\n' in source else '\n'
        lines = source.replace('\r\n', '\n').split('\n')
        # apply bottom-up so earlier line numbers stay valid even if a literal spans lines
        for ent, fx in sorted(items, key=lambda x: -x[0]['line']):
            lang = fx.get('lang')
            text = fx.get('text')
            if lang not in ('he', 'es', 'fr', 'ru', 'zh', 'ja', 'pt', 'de', 'ko') or not isinstance(text, str) or text == '':
                print(f"refused (bad lang/text): {fx.get('id')} {lang}")
                refused += 1
                continue
            en_ph = sorted(set(PH.findall(ent['raw'].get('en', ''))))
            if sorted(set(PH.findall(text))) != en_ph:
                print(f"refused (placeholders): {fx['id']} {lang}: {text[:60]}")
                refused += 1
                continue
            # a fix may reword a text but not add or drop line breaks: the layout around the text counts on them
            if len(LINE_BREAK.findall(esc(text, '"'))) != len(LINE_BREAK.findall(ent['raw'].get('en', ''))):
                print(f"refused (line breaks): {fx['id']} {lang}: {text[:60]!r}")
                refused += 1
                continue
            # the literal starts on ent.line; it may span several lines: scan forward for `lang:` within 40 lines
            start = ent['line'] - 1
            done = False
            for li in range(start, min(start + 40, len(lines))):
                src = lines[li]
                for m in KV.finditer(src):
                    if m.group(1) != lang:
                        continue
                    quote = "'" if m.group(2) is not None and src[m.start(2) - 1] == "'" else '"'
                    new = f"{lang}: {quote}{esc(text, quote)}{quote}"
                    lines[li] = src[:m.start()] + new + src[m.end():]
                    done = True
                    break
                if done:
                    break
                if li > start and lines[li].lstrip().startswith(('en:', 'he:', 'es:', 'fr:', 'ru:', 'zh:', 'ja:', 'pt:', 'de:', 'ko:')) is False and '}' in lines[li] and li > start + 1:
                    pass
            if done:
                changed += 1
            else:
                print(f"refused (not found): {fx['id']} {lang}")
                refused += 1
        path.write_bytes(eol.join(lines).encode('utf-8'))
    print(f"applied {changed} · refused {refused}")


main()
