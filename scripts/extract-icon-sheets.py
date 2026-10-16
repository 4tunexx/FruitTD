"""Extract the three user-supplied icon grids into transparent UI assets.

Usage:
  python scripts/extract-icon-sheets.py --runes iconpack.jpg --creative icons.jpg --blood icon2.jpg

The source screenshots are deliberately not copied into public/. Every visible
icon receives a stable sheet-row-column name in manifest.json.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def linspace(first: float, last: float, count: int) -> list[float]:
    return [first + (last - first) * i / (count - 1) for i in range(count)]


def cut_icon(image: Image.Image, cx: float, cy: float, width: int, height: int,
             threshold: int = 70, colored: bool = False) -> Image.Image:
    crop = image.crop((round(cx - width / 2), round(cy - height / 2),
                       round(cx + width / 2), round(cy + height / 2))).convert("RGB")
    pixels = np.asarray(crop, dtype=np.float32)
    if colored:
        # Arena core tokens have metal and cyan details; keep their real colours.
        mask = Image.new("L", crop.size, 0)
        draw = ImageDraw.Draw(mask)
        inset = max(2, round(min(crop.size) * .04))
        draw.ellipse((inset, inset, crop.width - inset, crop.height - inset), fill=255)
        rgba = crop.convert("RGBA")
        rgba.putalpha(mask)
    else:
        luminance = pixels.min(axis=2)
        alpha = np.clip((luminance - threshold) / (160 - threshold) * 255, 0, 255).astype("uint8")
        rgba_pixels = np.full((crop.height, crop.width, 4), 255, dtype=np.uint8)
        rgba_pixels[:, :, 3] = alpha
        rgba = Image.fromarray(rgba_pixels, "RGBA")
    bounds = rgba.getchannel("A").point(lambda p: 255 if p > 24 else 0).getbbox()
    if bounds:
        rgba = rgba.crop(bounds)
    canvas = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    rgba.thumbnail((112, 112), Image.Resampling.LANCZOS)
    canvas.alpha_composite(rgba, ((128 - rgba.width) // 2, (128 - rgba.height) // 2))
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runes", type=Path, required=True)
    parser.add_argument("--creative", type=Path, required=True)
    parser.add_argument("--blood", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("public/assets/icons/extracted"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    assets: list[dict[str, object]] = []
    icons: list[Image.Image] = []

    def emit(sheet: str, row: int, col: int, image: Image.Image, x: float, y: float,
             width: int, height: int, threshold: int = 70, colored: bool = False) -> None:
        name = f"{sheet}-{row:02d}-{col:02d}"
        icon = cut_icon(image, x, y, width, height, threshold, colored)
        icon.save(args.output / f"{name}.png", optimize=True)
        assets.append({"id": name, "sheet": sheet, "row": row, "column": col,
                       "path": f"/assets/icons/extracted/{name}.png"})
        icons.append(icon)

    rune = Image.open(args.runes)
    # Eleven regular rows of six large, high-contrast rune silhouettes.
    for row, y in enumerate([578, 730, 882, 1034, 1186, 1338, 1490, 1642, 1794, 1946, 2098], 1):
        for col, x in enumerate([166, 307, 448, 589, 730, 871], 1):
            emit("rune", row, col, rune, x, y, 116, 112, threshold=85)

    creative = Image.open(args.creative)
    # The 1900px source is the same grid as the supplied small icons.jpg.
    if creative.width < 1000:
        creative = creative.resize((1900, 1080), Image.Resampling.LANCZOS)
    for row, y in enumerate(linspace(105, 1000, 10), 1):
        for col, x in enumerate(linspace(935, 1780, 10), 1):
            emit("creative", row, col, creative, x, y, 78, 82, threshold=65)

    blood = Image.open(args.blood)
    # Each group on the tall sheet uses its own grid. Only the circular arena
    # cores keep their colour; the white silhouettes become tintable masks.
    groups = [
        ("skill", [158, 290, 416], [linspace(126, 1698, 10), linspace(220, 1795, 10), linspace(126, 1698, 10)], 128, 108),
        ("hero", [744], [linspace(110, 1800, 10)], 142, 118),
        ("quest", [1050], [linspace(205, 1685, 9)], 144, 120),
        ("mode", [1385], [[500, 730, 960, 1190, 1420]], 146, 125),
        ("misc", [1690, 1870], [[615, 790, 955, 1130, 1315], linspace(170, 1750, 12)], 112, 110),
        ("stat", [2175, 2355], [linspace(205, 1715, 9), linspace(205, 1715, 9)], 142, 125),
        ("emote", [2665, 2855, 2980], [linspace(115, 1790, 10), linspace(115, 1790, 10), [585, 775, 970, 1160, 1350]], 139, 122),
        ("lobby", [3230], [linspace(195, 1727, 12)], 128, 116),
        ("weapon", [3530], [linspace(185, 1730, 13)], 112, 115),
        ("core", [3800], [linspace(205, 1730, 8)], 170, 158),
    ]
    for sheet, ys, rows, width, height in groups:
        for row, (y, xs) in enumerate(zip(ys, rows), 1):
            for col, x in enumerate(xs, 1):
                emit(sheet, row, col, blood, x, y, width, height,
                     threshold=95, colored=sheet == "core")

    (args.output / "manifest.json").write_text(json.dumps(assets, indent=2) + "\n", encoding="utf-8")
    # Review sheet stays outside public assets and can be deleted after inspection.
    preview = Image.new("RGB", (12 * 144, ((len(icons) + 11) // 12) * 150), "#24272d")
    draw = ImageDraw.Draw(preview)
    for index, (item, icon) in enumerate(zip(assets, icons)):
        x = (index % 12) * 144
        y = (index // 12) * 150
        preview.paste(icon, (x + 8, y), icon)
        draw.text((x + 8, y + 128), str(item["id"]), fill="#ffcb66")
    preview.save(Path("tmp-icons-contact.png"), optimize=True)
    print(f"Extracted {len(assets)} icons to {args.output}")


if __name__ == "__main__":
    main()
