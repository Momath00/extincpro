"""Génère public/og-image.png (1200x630) pour les partages sociaux (OpenGraph/Twitter)."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "public", "og-image.png")
LOGO = os.path.join(BASE, "public", "logo-mark.png")

W, H = 1200, 630
INK = (10, 11, 13)
RED = (225, 19, 36)
RED_BRIGHT = (255, 36, 56)
WHITE = (244, 245, 246)
MUTED = (162, 167, 176)

FONT_BOLD = "C:/Windows/Fonts/arialbd.ttf"
FONT_REG = "C:/Windows/Fonts/arial.ttf"

img = Image.new("RGB", (W, H), INK)

# Subtle radial red glow behind the logo, similar to .glow-red in globals.css
glow = Image.new("RGB", (W, H), INK)
gdraw = ImageDraw.Draw(glow)
cx, cy = 300, 60
for r in range(700, 0, -8):
    alpha = max(0, 1 - r / 700)
    color = tuple(int(INK[i] + (RED[i] - INK[i]) * alpha * 0.35) for i in range(3))
    gdraw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
glow = glow.filter(ImageFilter.GaussianBlur(40))
img = Image.blend(img, glow, 0.9)

draw = ImageDraw.Draw(img)

# Faint grid, matching .bg-grid
grid_color = (255, 255, 255)
step = 44
grid_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
grid_draw = ImageDraw.Draw(grid_layer)
for x in range(0, W, step):
    grid_draw.line([(x, 0), (x, H)], fill=(255, 255, 255, 10), width=1)
for y in range(0, H, step):
    grid_draw.line([(0, y), (W, y)], fill=(255, 255, 255, 10), width=1)
img = Image.alpha_composite(img.convert("RGBA"), grid_layer).convert("RGB")
draw = ImageDraw.Draw(img)

# Logo mark (black background blends with the ink canvas)
logo = Image.open(LOGO).convert("RGB")
logo_h = 300
logo_w = int(logo.width * (logo_h / logo.height))
logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
logo_x, logo_y = 90, (H - logo_h) // 2
img.paste(logo, (logo_x, logo_y))

# Text block
text_x = logo_x + logo_w + 70
font_brand = ImageFont.truetype(FONT_BOLD, 76)
font_tagline = ImageFont.truetype(FONT_REG, 34)
font_kicker = ImageFont.truetype(FONT_BOLD, 24)

kicker_y = 190
draw.text((text_x, kicker_y), "LOGICIEL DE SÉCURITÉ INCENDIE", font=font_kicker, fill=RED_BRIGHT)

brand_y = kicker_y + 50
draw.text((text_x, brand_y), "Extinc", font=font_brand, fill=WHITE)
extinc_w = draw.textlength("Extinc", font=font_brand)
draw.text((text_x + extinc_w, brand_y), "Pro", font=font_brand, fill=RED_BRIGHT)

tagline_y = brand_y + 100
tagline_lines = [
    "Plateforme d'inspection et de conformité incendie",
    "Extincteurs · Éclairage d'urgence · Gicleurs",
]
for i, line in enumerate(tagline_lines):
    draw.text((text_x, tagline_y + i * 46), line, font=font_tagline, fill=MUTED)

img.save(OUT, "PNG", optimize=True)
print("Saved", OUT, img.size)
