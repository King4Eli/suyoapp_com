#!/usr/bin/env python3
"""Regenerate every web + mobile app-icon asset from one square master image.

    python3 _scripts/branding/gen_app_icons.py [path/to/master.png]

Master should be a square PNG, >=1024px, of the full app-icon art (the rounded
corners may sit on black -- they get inpainted for full-bleed targets). Writes:
web/public/* favicons + manifest icons, mobile/android mipmap-* launcher icons,
mobile/ios AppIcon.appiconset/*. Requires Pillow.
"""
import os
import sys
from PIL import Image, ImageFilter, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    ROOT, "_docs/brand/preview/Pasted image (2).png")

im = Image.open(SRC).convert("RGB")
W, H = im.size
assert W == H, (W, H)

# ---------------------------------------------------------------------------
# 1. Detect the near-black rounded-corner region and build:
#    - square_opaque : full-bleed gradient square (corners inpainted)
#    - rounded_rgba  : art with the corner region transparent
# ---------------------------------------------------------------------------
px = im.load()
def near_black(p):
    return (p[0] + p[1] + p[2]) <= 54

# 255 where art, 0 where the black rounded-corner wedge is
mask = Image.new("L", (W, H), 0)
mpx = mask.load()
for y in range(H):
    for x in range(W):
        if not near_black(px[x, y]):
            mpx[x, y] = 255
# pull the mask ~8px inward so we never sample the dark anti-aliased rim
core = mask.filter(ImageFilter.MinFilter(17))

# Iterative blur-inpaint: repeatedly blur, then paste the real art back on
# top. Each pass bleeds the gradient a little further into the empty corners.
work = im.copy()
for _ in range(34):
    work = Image.composite(work, work.filter(ImageFilter.GaussianBlur(22)), core)
square_opaque = Image.composite(im, work, core.filter(ImageFilter.GaussianBlur(2)))

rounded_rgba = im.convert("RGBA")
rounded_rgba.putalpha(mask.filter(ImageFilter.GaussianBlur(1)))

# ---------------------------------------------------------------------------
# 2. Brand pink (median of the gradient) for adaptive / maskable backgrounds
# ---------------------------------------------------------------------------
small = im.resize((80, 80))
cols = [small.getpixel((x, y)) for x in range(80) for y in range(80)
        if not near_black(small.getpixel((x, y)))]
cols.sort(key=lambda c: c[0] * 3 + c[1] + c[2])
PINK = cols[len(cols) // 2]
PINK_HEX = "#%02X%02X%02X" % PINK
print("brand pink:", PINK, PINK_HEX)

def save(img, path, **kw):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, **kw)
    print("  ", os.path.relpath(path, ROOT), img.size)

def fit(img, size):
    return img.resize((size, size), Image.LANCZOS)

def circle_mask(img):
    size = img.size[0]
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).ellipse((0, 0, size - 1, size - 1), fill=255)
    out = img.convert("RGBA")
    out.putalpha(m)
    return out

def maskable(size, inset=0.72):
    bg = Image.new("RGBA", (size, size), PINK + (255,))
    art = rounded_rgba.resize((int(size * inset),) * 2, Image.LANCZOS)
    off = (size - art.size[0]) // 2
    bg.alpha_composite(art, (off, off))
    return bg.convert("RGB")

def adaptive_fg(size, fill=0.74):
    """108dp canvas: solid-pink field + inset art tile, per the chosen design.
    Art stays inside the ~72dp safe band; corners that the launcher mask trims
    are only gradient."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pad = Image.new("RGBA", (size, size), PINK + (255,))
    art = rounded_rgba.resize((int(size * fill),) * 2, Image.LANCZOS)
    off = (size - art.size[0]) // 2
    pad.alpha_composite(art, (off, off))
    # keep the pink field within the 66dp guaranteed-visible zone
    keep = int(size * 0.90)
    m = Image.new("L", (size, size), 0)
    o = (size - keep) // 2
    ImageDraw.Draw(m).rounded_rectangle((o, o, o + keep, o + keep),
                                        radius=int(keep * 0.22), fill=255)
    canvas.paste(pad, (0, 0), m)
    return canvas

# ===========================================================================
# WEB  ->  web/public
# ===========================================================================
print("web/public:")
WEB = os.path.join(ROOT, "web/public")
for s in (16, 32, 96, 192, 512):
    save(fit(rounded_rgba, s), os.path.join(WEB, f"favicon-{s}x{s}.png"))
save(fit(square_opaque, 180), os.path.join(WEB, "apple-touch-icon.png"))
save(maskable(192), os.path.join(WEB, "maskable-192.png"))
save(maskable(512), os.path.join(WEB, "maskable-512.png"))
fit(rounded_rgba, 64).save(os.path.join(WEB, "favicon.ico"),
                           sizes=[(16, 16), (32, 32), (48, 48)])
print("   web/public/favicon.ico")
save(fit(square_opaque, 1024), os.path.join(ROOT, "_docs/brand/app-icon-1024.png"))

# ===========================================================================
# ANDROID  ->  mobile/android/app/src/main/res
# ===========================================================================
print("android res:")
RES = os.path.join(ROOT, "mobile/android/app/src/main/res")
DENS = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for name, mult in DENS.items():
    launch = int(48 * mult)
    fg = int(108 * mult)
    d = os.path.join(RES, f"mipmap-{name}")
    save(fit(square_opaque, launch).convert("RGBA"),
         os.path.join(d, "ic_launcher.png"))
    save(circle_mask(fit(square_opaque, launch)),
         os.path.join(d, "ic_launcher_round.png"))
    save(adaptive_fg(fg), os.path.join(d, "ic_launcher_foreground.png"))

bg_xml = f'''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="{PINK_HEX}"
        android:pathData="M0,0h108v108h-108z" />
</vector>
'''
with open(os.path.join(RES, "drawable/ic_launcher_background.xml"), "w") as f:
    f.write(bg_xml)
print("   drawable/ic_launcher_background.xml ->", PINK_HEX)

# ===========================================================================
# iOS  ->  mobile/ios/suyoapp/Images.xcassets/AppIcon.appiconset
# ===========================================================================
print("ios AppIcon.appiconset:")
ASSET = os.path.join(ROOT,
    "mobile/ios/suyoapp/Images.xcassets/AppIcon.appiconset")
specs = [
    ("20x20", "2x", 40), ("20x20", "3x", 60),
    ("29x29", "2x", 58), ("29x29", "3x", 87),
    ("40x40", "2x", 80), ("40x40", "3x", 120),
    ("60x60", "2x", 120), ("60x60", "3x", 180),
    ("1024x1024", "1x", 1024),
]
images = []
for size_s, scale, px_ in specs:
    base = size_s.split("x")[0]
    fname = f"AppIcon-{base}@{scale}.png" if size_s != "1024x1024" else "AppIcon-1024.png"
    save(fit(square_opaque, px_), os.path.join(ASSET, fname))
    images.append({
        "idiom": "iphone" if size_s != "1024x1024" else "ios-marketing",
        "size": size_s, "scale": scale, "filename": fname,
    })

import json
contents = {"images": images, "info": {"author": "xcode", "version": 1}}
with open(os.path.join(ASSET, "Contents.json"), "w") as f:
    json.dump(contents, f, indent=2)
    f.write("\n")
print("   Contents.json updated")
print("DONE")
