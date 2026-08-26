#!/usr/bin/env python3
"""Generate the Android TV launcher banners from the real logo.

Android TV shows a 16:9 banner, not the app icon, on the home row. The
required size is 320x180 (xhdpi); 480x270 and 640x360 cover denser panels.

These were previously produced by hand and passed around in an
android-package.zip, which meant the repo couldn't rebuild them. This
regenerates them from logo-cream.png and the same gradient recipe the
dashboard's own backdrop uses (see .backdrop in template.html), so the
banner and the screen it launches actually match.

    python3 android-tv/make-banners.py
"""

import pathlib
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "android-tv"

W, H = 640, 360                       # master; the rest are downscales
BRAND_900, BRAND_800, BRAND_700 = (0x3C, 0x0B, 0x2A), (0x4B, 0x11, 0x36), (0x5E, 0x18, 0x44)
BRAND_600 = (0x77, 0x21, 0x57)        # the glow colour the backdrop actually uses
GOLD = (0xC6, 0xA2, 0x4C)

# The 8-point star from the dashboard backdrop, as a fraction of a 100x100 tile.
STAR = [(50,2),(57.3,32.4),(83.9,16.1),(67.6,42.7),(98,50),(67.6,57.3),(83.9,83.9),
        (57.3,67.6),(50,98),(42.7,67.6),(16.1,83.9),(32.4,57.3),(2,50),(32.4,42.7),
        (16.1,16.1),(42.7,32.4)]


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def base_gradient():
    """linear-gradient(175deg, brand-900, brand-800 55%, brand-700)."""
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        for x in range(W):
            # 175deg is near-vertical with a slight lean; approximate it.
            t = min(1.0, max(0.0, (y + (x - W / 2) * 0.09) / H))
            px[x, y] = lerp(BRAND_900, BRAND_800, t / 0.55) if t <= 0.55 \
                else lerp(BRAND_800, BRAND_700, (t - 0.55) / 0.45)
    return img


def radial(size, centre, radii, colour, alpha):
    """One soft radial glow, as an RGBA layer to composite."""
    w, h = size
    layer = Image.new("RGBA", size, colour + (0,))
    px = layer.load()
    cx, cy = centre
    rx, ry = radii
    for y in range(h):
        for x in range(w):
            d = (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) ** 0.5
            if d < 1.0:
                px[x, y] = colour + (round(alpha * (1 - d) ** 1.6),)
    return layer


def motif(size, tile=90, alpha=9):
    """The tiled geometric star, at the same near-invisible weight as the app."""
    w, h = size
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for ty in range(-1, h // tile + 2):
        for tx in range(-1, w // tile + 2):
            ox, oy = tx * tile, ty * tile
            pts = [(ox + p[0] / 100 * tile, oy + p[1] / 100 * tile) for p in STAR]
            d.polygon(pts, fill=GOLD + (alpha,))
    return layer


def build():
    img = base_gradient().convert("RGBA")
    img.alpha_composite(motif((W, H)))
    img.alpha_composite(radial((W, H), (W / 2, -H * 0.08), (W * 0.65, H * 0.55), GOLD, 26))
    img.alpha_composite(radial((W, H), (W / 2, H * 1.12), (W * 0.42, H * 0.5), BRAND_600, 95))

    logo = Image.open(ROOT / "logo-cream.png").convert("RGBA")
    # Leave generous margin: TV launchers scale and crop banners, and some
    # panels still overscan, so nothing important goes near the edge.
    target_w = int(W * 0.50)
    logo = logo.resize((target_w, round(logo.height * target_w / logo.width)), Image.LANCZOS)
    img.alpha_composite(logo, ((W - logo.width) // 2, (H - logo.height) // 2))

    OUT.mkdir(exist_ok=True)
    for w, h, label in ((320, 180, "xhdpi"), (480, 270, "xxhdpi"), (640, 360, "xxxhdpi")):
        path = OUT / f"banner-{label}-{w}x{h}.png"
        img.convert("RGB").resize((w, h), Image.LANCZOS).save(path, optimize=True)
        print(f"  {path.relative_to(ROOT)}  ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    build()
