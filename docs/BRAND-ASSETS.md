# Brand assets

The mark: a small cat in an orange visor sitting on a terminal window, on a dark rounded square, with neutral four-point sparkles. It does not use Anthropic's asterisk mark (removed on purpose: the plugin is published under the author's name, not Anthropic's).

Source of truth: `assets/icon-1024.png` (1024×1024, RGBA). Everything below is derived from it; regenerate with `scratchpad/make_assets.py` when the source changes.

| Use | File | Spec |
|---|---|---|
| Claude plugin directory listing | `.claude-plugin/icon.png` (set as `icon` in plugin.json) | square PNG 1024×1024, under 2 MB; PNG/JPEG only. Fixed at the first submission: later changes do not update the listing |
| README header | `docs/assets/banner.png` | 1280×640, icon left, name + one line right |
| README inline | `docs/assets/icon-128.png` | 128×128 |
| GitHub social preview | upload `docs/assets/banner.png` in Settings → Social preview | 1280×640 |
| Ko-fi / GitHub Sponsors avatar | `assets/avatar-400.png` | 400×400 |
| Other sizes | `assets/icon-{512,256,128,64,32}.png` | for stores, docs, OS shortcuts |
| Share cards / Wrapped corner | text "Claude Code · Toolkitty" today; a monochrome 64×64 mark can be inlined later | SVG, single colour |

Colours: background #0E0C14, cream #FFF4E6, orange #FF8C3C → #FFB347 gradient, text grey #C8C4D2.
