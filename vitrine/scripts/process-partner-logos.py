"""Nettoie et prépare les logos partenaires pour public/partners/."""
import os
import numpy as np
from PIL import Image, ImageFilter

DOWNLOADS = os.path.join(os.path.expanduser("~"), "Downloads")
CACHE = r"C:\Users\seckm\.claude\image-cache\88e747eb-c6a4-467c-a52c-e61566a53d4f"
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "partners")
os.makedirs(OUT_DIR, exist_ok=True)


def autocrop_alpha(img: Image.Image, pad: int = 24) -> Image.Image:
    arr = np.array(img)
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha > 10)
    if len(xs) == 0:
        return img
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad, img.width)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad, img.height)
    return img.crop((x0, y0, x1, y1))


def autocrop_white(img: Image.Image, pad: int = 20, thresh: int = 248) -> Image.Image:
    arr = np.array(img.convert("RGB"))
    mask = np.any(arr < thresh, axis=2)
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return img
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad, img.width)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad, img.height)
    return img.crop((x0, y0, x1, y1))


def remove_textured_gray_bg(path: str) -> Image.Image:
    """Fond un logo posé sur un fond gris/brun texturé (dégradé, non uniforme)
    en fondu blanc : les pixels du pictogramme/texte (saturés, très sombres ou
    très clairs) restent intacts, le reste s'éclaircit progressivement vers le
    blanc. Un fondu doux évite les artefacts d'un simple cutout alpha sur un
    fond qui n'a pas de bord net (glow flou autour de la flamme)."""
    im = Image.open(path).convert("RGB")
    hsv = np.array(im.convert("HSV")).astype(np.float32)
    s = hsv[:, :, 1] / 255.0
    v = hsv[:, :, 2] / 255.0

    keep = np.clip((s - 0.3) / 0.25, 0, 1)  # saturé -> logo
    keep = np.maximum(keep, np.clip((0.16 - v) / 0.12, 0, 1))  # très sombre -> logo
    keep = np.maximum(keep, np.clip((v - 0.88) / 0.07, 0, 1))  # très clair -> logo

    keep_img = Image.fromarray((keep * 255).astype(np.uint8), mode="L")
    keep_img = keep_img.filter(ImageFilter.GaussianBlur(3))
    strength = np.array(keep_img).astype(np.float32) / 255.0

    rgb = np.array(im).astype(np.float32)
    white = np.full_like(rgb, 255.0)
    blended = rgb * strength[:, :, None] + white * (1 - strength[:, :, None])
    out = Image.fromarray(blended.astype(np.uint8), mode="RGB")
    return autocrop_white(out, pad=24, thresh=250)


# 1) Extincteurs Nationex — fond blanc propre, simple recadrage.
nationex = Image.open(os.path.join(DOWNLOADS, "logo-nationex.jpg")).convert("RGB")
nationex = autocrop_white(nationex)
nationex.save(os.path.join(OUT_DIR, "nationex.png"), "PNG")
print("nationex", nationex.size)

# 2) Inspection Incendie — fond texturé gris/brun à retirer.
inspection = remove_textured_gray_bg(os.path.join(DOWNLOADS, "logo.png"))
inspection.save(os.path.join(OUT_DIR, "inspection-incendie.png"), "PNG")
print("inspection-incendie", inspection.size)

def crop_and_feather_to_white(path: str, cx: int, cy: int, half: int, feather_start_ratio: float = 0.55) -> Image.Image:
    """Pour un pictogramme net (bordures dures) posé sur un halo/glow radial de
    même teinte (impossible à isoler par couleur) : recadrage carré centré sur
    l'icône, avec un fondu radial vers le blanc sur les bords du cadrage."""
    im = Image.open(path).convert("RGB")
    box = im.crop((cx - half, cy - half, cx + half, cy + half))
    size = half * 2
    yy, xx = np.mgrid[0:size, 0:size]
    dist = np.sqrt((xx - half) ** 2 + (yy - half) ** 2) / half
    strength = 1 - np.clip((dist - feather_start_ratio) / (1 - feather_start_ratio), 0, 1)
    rgb = np.array(box).astype(np.float32)
    white = np.full_like(rgb, 255.0)
    blended = rgb * strength[:, :, None] + white * (1 - strength[:, :, None])
    return Image.fromarray(blended.astype(np.uint8), mode="RGB")


# 3) MS Solution Informatique — pictogramme nette sur un halo rouge radial
# (même teinte que l'icône : on recadre serré + fondu radial plutôt qu'un cutout couleur).
ms = crop_and_feather_to_white(os.path.join(DOWNLOADS, "logo (2).png"), cx=784, cy=484, half=300)
ms.save(os.path.join(OUT_DIR, "ms-solution-informatique.png"), "PNG")
print("ms-solution-informatique", ms.size)

# 4) PubMS — fond clair propre, simple recadrage.
pubms = Image.open(os.path.join(CACHE, "4.png")).convert("RGB")
pubms = autocrop_white(pubms, thresh=250)
pubms.save(os.path.join(OUT_DIR, "pubms.png"), "PNG")
print("pubms", pubms.size)
