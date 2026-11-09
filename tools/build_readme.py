import io,re
s=io.open('docs/drafts/README.md',encoding='utf-8').read()
# strip draft header comment
s=re.sub(r'\A<!--.*?-->\n\n','',s,count=1,flags=re.S)
head=('Toolkitty is a Claude Code plugin with 91 switchable features that monitor your session, optimize context and cost, block dangerous commands, verify claims against real test runs, and keep you company with a tiny cat.\n\n'
'<!-- Install commands: the two-step form and the one-liner are to be verified on a clean profile before launch (docs/LAUNCH-PLAN.md section 5). -->\n'
'<!-- Banner image docs/assets/banner.png also serves as the GitHub social preview. -->\n\n')
s=head+s
s=s.replace('<repo>','toolkitty')
s=s.replace('<!-- SUPPORT_URL -->','[Ko-fi](https://ko-fi.com/toolkitty)')
s=s.replace('· GitHub Sponsors. See','· [GitHub Sponsors](https://github.com/sponsors/avraham-tech) (pending approval). See')
s=s.replace('<!-- GIF 1: companion reveal, 6-8 s -->\n![The welcome wizard reveals your companion](docs/assets/gif-companion.gif)',
 '<!-- GIF: gif-companion.gif (6-8 s, welcome step 3 reveal) not recorded yet; add docs/assets/gif-companion.gif and uncomment:\n![The welcome wizard reveals your companion](docs/assets/gif-companion.gif) -->')
s=s.replace('<!-- GIF 2: guardrail, 8-12 s, recorded in /demo scene rescue -->\n![A broad rm -rf is blocked and a safety receipt explains why](docs/assets/gif-guardrail.gif)',
 '<!-- GIF: gif-guardrail.gif (8-12 s, /demo scene rescue) not recorded yet; add docs/assets/gif-guardrail.gif and uncomment:\n![A broad rm -rf is blocked and a safety receipt explains why](docs/assets/gif-guardrail.gif) -->')
s=s.replace('<!-- GIF 3: smart bar and savings, 8-12 s, recorded in /demo scene busy -->\n![The status band, the advisor and the savings card](docs/assets/gif-smart-bar.gif)',
 '<!-- GIF: gif-smart-bar.gif (8-12 s, /demo scene busy) not recorded yet; add docs/assets/gif-smart-bar.gif and uncomment:\n![The status band, the advisor and the savings card](docs/assets/gif-smart-bar.gif) -->')
s=s.replace('The clips above were recorded','The clips (once added) are recorded')
# privacy section verbatim from plan section 7
plan=io.open('docs/LAUNCH-PLAN.md',encoding='utf-8').read()
i=plan.index('**Privacy (README section "What leaves your machine").**')
j=plan.index('Allowed short claims',i)
block=plan[i:j]
quote=[l for l in block.split('\n') if l.startswith('>')]
txt='\n'.join(l[2:] if l.startswith('> ') else '' for l in quote).strip()
a=s.index('## What leaves your machine')
b=s.index('## Guardrails: what they are')
s=s[:a]+'## What leaves your machine\n\n'+txt+'\n\n'+s[b:]
io.open('README.md','w',encoding='utf-8',newline='\n').write(s)
