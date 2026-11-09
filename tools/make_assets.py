"""Regenerates every brand asset of the toolkit from assets/icon-1024.png (see docs/BRAND-ASSETS.md).
Usage: python make_assets.py <toolkit folder>"""
import pathlib, sys
from PIL import Image, ImageDraw, ImageFont
root = pathlib.Path(sys.argv[1])
m = Image.open(root / 'assets/icon-1024.png').convert('RGBA')
(root / 'docs/assets').mkdir(parents=True, exist_ok=True)
m.save(root / '.claude-plugin/icon.png', optimize=True)
for s in (512, 256, 128, 64, 32):
    m.resize((s, s), Image.LANCZOS).save(root / f'assets/icon-{s}.png', optimize=True)
m.resize((128, 128), Image.LANCZOS).save(root / 'docs/assets/icon-128.png', optimize=True)
m.resize((400, 400), Image.LANCZOS).save(root / 'assets/avatar-400.png', optimize=True)
W, H = 1280, 640
b = Image.new('RGBA', (W, H), (14, 12, 20, 255))
# a soft warm glow behind the icon, like the user's concept
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
for r, a in ((420, 18), (340, 26), (260, 34)):
    gd.ellipse((300 - r, 320 - r, 300 + r, 320 + r), fill=(255, 120, 40, a))
from PIL import ImageFilter
b.alpha_composite(glow.filter(ImageFilter.GaussianBlur(90)))
ic = m.resize((460, 460), Image.LANCZOS)
# the source square has opaque black corners outside the rounded tile: mask them with a rounded rectangle
mask = Image.new('L', ic.size, 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, ic.size[0] - 1, ic.size[1] - 1), radius=int(ic.size[0] * 0.22), fill=255)
ic.putalpha(Image.fromarray(__import__('numpy').minimum(__import__('numpy').array(ic.getchannel('A')), __import__('numpy').array(mask))) if False else mask)
b.alpha_composite(ic, (70, 90))
d = ImageDraw.Draw(b)
def font(sz, bold=True):
    for p in ((r'C:\Windows\Fonts\segoeuib.ttf' if bold else r'C:\Windows\Fonts\segoeui.ttf'), r'C:\Windows\Fontsrialbd.ttf'):
        try: return ImageFont.truetype(p, sz)
        except Exception: pass
    return ImageFont.load_default()
x = 580
d.text((x, 150), 'TOOL', font=font(112), fill=(255, 244, 230, 255))
w = d.textlength('TOOL', font=font(112))
d.text((x + w, 150), 'KITTY', font=font(112), fill=(255, 140, 60, 255))
d.text((x + 4, 285), 'Your coding companion for Claude Code', font=font(36, False), fill=(255, 170, 90, 255))
# capability pill
pill_text = 'Monitor  •  Optimize  •  Protect  •  Verify'
pf = font(32, False)
tw = d.textlength(pill_text, font=pf)
pad = 36
pill = (x, 360, x + tw + 2 * pad, 428)
d.rounded_rectangle(pill, radius=34, outline=(255, 140, 60, 255), width=3, fill=(30, 26, 38, 255))
# centred both ways: anchor 'mm' puts the text's middle at the pill's centre
d.text(((pill[0] + pill[2]) / 2, (pill[1] + pill[3]) / 2), pill_text, font=pf, fill=(255, 244, 230, 255), anchor='mm')
# the feature count comes from the catalogue itself, so the banner cannot go stale
import re as _re
_idx = (root / 'hooks/features/index.ts').read_text(encoding='utf-8')
_count = len(set(_re.findall(r"^import \{ feature as (\w+) \} from '\./", _idx, _re.M)))
d.text((x + 4, 458), f'{_count} features. One tiny companion.', font=font(34), fill=(255, 244, 230, 255))
# FREE as a small orange tag; the two promises beside it in plain text
tf = font(22)
tag = 'FREE'
tw2 = d.textlength(tag, font=tf)
tag_box = (x + 4, 508, x + 4 + tw2 + 28, 542)
d.rounded_rectangle(tag_box, radius=17, fill=(255, 140, 60, 255))
d.text(((tag_box[0] + tag_box[2]) / 2, (tag_box[1] + tag_box[3]) / 2), tag, font=tf, fill=(20, 16, 24, 255), anchor='mm')
d.text((x + 4 + tw2 + 44, 512), 'Local-first  ·  Privacy by design', font=font(24, False), fill=(200, 196, 210, 255))
# call to action: the one-line install only works once the directory lists the plugin, so the banner points at GitHub
cta = 'Get Toolkitty  →  github.com/avraham-tech/toolkitty'
cf = font(26)
cw = d.textlength(cta, font=cf)
box = (x + 4, 562, x + 4 + cw + 44, 606)
d.rounded_rectangle(box, radius=22, fill=(255, 140, 60, 255))
d.text(((box[0] + box[2]) / 2, (box[1] + box[3]) / 2), cta, font=cf, fill=(20, 16, 24, 255), anchor='mm')
b.convert('RGB').save(root / 'docs/assets/banner.png', optimize=True)
print('assets regenerated')
