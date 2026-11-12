#!/usr/bin/env python3
"""Generate Prime Auto Care launcher, PWA, splash and Windows icons from the supplied brand mark."""
from __future__ import annotations

import argparse
import re
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
LOGO_PATH = ROOT / "prime-auto-care-logo.jpg"
BLACK = (7, 7, 7, 255)
GOLD = (197, 153, 69, 255)


def logo_canvas(size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BLACK)
    logo = Image.open(LOGO_PATH).convert("RGBA")
    # Preserve the full wordmark, with deliberate breathing room around it.
    logo.thumbnail((round(size * 0.92), round(size * 0.66)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(logo, ((size - logo.width) // 2, (size - logo.height) // 2))
    draw = ImageDraw.Draw(canvas)
    line = max(1, round(size * 0.012))
    inset = max(2, round(size * 0.045))
    draw.rounded_rectangle(
        (inset, inset, size - inset - 1, size - inset - 1),
        radius=round(size * 0.14),
        outline=GOLD,
        width=line,
    )
    return canvas


def transparent_foreground(size: int = 432) -> Image.Image:
    source = Image.open(LOGO_PATH).convert("RGB")
    pixels = source.load()
    # Remove only the near-black JPEG background, retaining the gold wordmark.
    rgba = Image.new("RGBA", source.size, (0, 0, 0, 0))
    out = rgba.load()
    for y in range(source.height):
        for x in range(source.width):
            r, g, b = pixels[x, y]
            peak = max(r, g, b)
            alpha = max(0, min(255, (peak - 9) * 5))
            if alpha:
                out[x, y] = (r, g, b, alpha)
    rgba.thumbnail((round(size * 0.82), round(size * 0.55)), Image.Resampling.LANCZOS)
    foreground = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    foreground.alpha_composite(rgba, ((size - rgba.width) // 2, (size - rgba.height) // 2))
    return foreground


def make_android_resources() -> None:
    res = ROOT / "android" / "app" / "src" / "main" / "res"
    if not res.is_dir():
        raise SystemExit("Android resources folder not found. Run 'npx cap add android' first.")

    density_sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    for folder, size in density_sizes.items():
        target = res / folder
        target.mkdir(parents=True, exist_ok=True)
        # Avoid duplicate Android resource names if the Capacitor template shipped WebP files.
        for old in list(target.glob("ic_launcher.*")) + list(target.glob("ic_launcher_round.*")):
            old.unlink()
        square = logo_canvas(size)
        square.save(target / "ic_launcher.png", format="PNG", optimize=True)
        round_icon = square.copy()
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        round_icon.putalpha(mask)
        round_icon.save(target / "ic_launcher_round.png", format="PNG", optimize=True)

    (res / "drawable").mkdir(parents=True, exist_ok=True)
    transparent_foreground().save(res / "drawable" / "ic_launcher_foreground.png", format="PNG", optimize=True)
    logo_canvas(512).save(res / "drawable" / "splash.png", format="PNG", optimize=True)

    adaptive = res / "mipmap-anydpi-v26"
    adaptive.mkdir(parents=True, exist_ok=True)
    icon_xml = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
"""
    (adaptive / "ic_launcher.xml").write_text(icon_xml, encoding="utf-8")
    (adaptive / "ic_launcher_round.xml").write_text(icon_xml, encoding="utf-8")

    values = res / "values"
    values.mkdir(parents=True, exist_ok=True)
    (values / "ic_launcher_background.xml").write_text(
        """<?xml version="1.0" encoding="utf-8"?>
<resources><color name="ic_launcher_background">#070707</color></resources>
""",
        encoding="utf-8",
    )

    manifest = ROOT / "android" / "app" / "src" / "main" / "AndroidManifest.xml"
    if manifest.exists():
        xml = manifest.read_text(encoding="utf-8")
        xml = re.sub(r'android:icon="[^"]+"', 'android:icon="@mipmap/ic_launcher"', xml)
        xml = re.sub(r'android:roundIcon="[^"]+"', 'android:roundIcon="@mipmap/ic_launcher_round"', xml)
        # Explicitly add both attributes if the Capacitor manifest template omits them.
        app_tag = re.search(r'<application\\b[^>]*>', xml)
        if not app_tag:
            raise SystemExit("AndroidManifest.xml has no application element.")
        opening = app_tag.group(0)
        if "android:icon=" not in opening:
            opening = opening[:-1] + ' android:icon="@mipmap/ic_launcher">'
        if "android:roundIcon=" not in opening:
            opening = opening[:-1] + ' android:roundIcon="@mipmap/ic_launcher_round">'
        xml = xml[:app_tag.start()] + opening + xml[app_tag.end():]
        if '@mipmap/ic_launcher' not in xml or '@mipmap/ic_launcher_round' not in xml:
            raise SystemExit("Prime Auto Care launcher icon references were not applied.")
        manifest.write_text(xml, encoding="utf-8")

    foreground = res / "drawable" / "ic_launcher_foreground.png"
    with Image.open(foreground) as icon:
        if icon.getchannel("A").getbbox() is None:
            raise SystemExit("Prime Auto Care launcher foreground is fully transparent.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--android", action="store_true", help="also write Android launcher and splash resources")
    args = parser.parse_args()

    if not LOGO_PATH.exists():
        raise SystemExit(f"Brand logo is missing: {LOGO_PATH}")

    for size in (192, 512):
        logo_canvas(size).save(ROOT / f"prime-auto-care-icon-{size}.png", format="PNG", optimize=True)

    # Windows installer and taskbar/window icon.
    logo_canvas(256).save(
        ROOT / "prime-auto-care-icon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    if args.android:
        make_android_resources()

    print("Generated Prime Auto Care brand icons" + (" and Android resources." if args.android else "."))


if __name__ == "__main__":
    main()
