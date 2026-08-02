#!/usr/bin/env python3
"""Generates the extension icons into img/.

Draws a stopwatch on a rounded blue tile at 8x and downsamples, which keeps the
16px variant legible. Colours match the popup accent.

Usage: python3 tools/make-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

SIZES = (16, 32, 48, 128)
SUPERSAMPLE = 8
TOP = (47, 111, 237)     # --accent
BOTTOM = (107, 164, 255)  # --accent-soft
OUT_DIR = Path(__file__).resolve().parent.parent / "img"


def gradient(size: int) -> Image.Image:
    img = Image.new("RGB", (1, size))
    for y in range(size):
        t = y / max(1, size - 1)
        img.putpixel(
            (0, y),
            tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)),
        )
    return img.resize((size, size), Image.NEAREST)


def rounded_mask(size: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size - 1, size - 1), radius=round(size * 0.22), fill=255
    )
    return mask


def stopwatch(size: int) -> Image.Image:
    """White stopwatch glyph on a transparent layer."""
    layer = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(layer)
    white = (255, 255, 255, 255)

    cx, cy = size / 2, size * 0.545
    radius = size * 0.30
    stroke = max(1, round(size * 0.085))

    # Crown and stem.
    stem_w, stem_h = size * 0.20, size * 0.075
    draw.rounded_rectangle(
        (cx - stem_w / 2, cy - radius - stem_h * 1.9, cx + stem_w / 2, cy - radius - stem_h * 0.3),
        radius=stem_h * 0.4,
        fill=white,
    )

    # Dial.
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=white, width=stroke)

    # Hands: one to 12, one to 3.
    draw.line((cx, cy, cx, cy - radius * 0.58), fill=white, width=stroke)
    draw.line((cx, cy, cx + radius * 0.45, cy), fill=white, width=stroke)

    return layer


def build(size: int) -> Image.Image:
    big = size * SUPERSAMPLE
    tile = gradient(big).convert("RGBA")
    tile.putalpha(rounded_mask(big))
    tile.alpha_composite(stopwatch(big))
    return tile.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        path = OUT_DIR / f"icon{size}.png"
        build(size).save(path)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
