"""
Generate programmatic SVG→PNG isometric NYC sprites.
No API needed — builds sprites from code with detailed isometric buildings.

Usage:
    python create_nyc_sprites.py
"""

import math
from pathlib import Path
from PIL import Image, ImageDraw

OUTPUT_DIR = Path(__file__).parent.parent.parent / "themes" / "city-nyc" / "sprites"


def iso_point(x, y, z, scale=1.0):
    """Convert 3D coords to 2D isometric screen coords."""
    sx = (x - y) * math.cos(math.radians(30)) * scale
    sy = (x + y) * math.sin(math.radians(30)) * scale - z * scale
    return sx, sy


def draw_iso_block(draw, cx, cy, w, d, h, top_color, left_color, right_color):
    """Draw an isometric rectangular block."""
    # Define the 8 corners in iso space, then project
    hw, hd = w / 2, d / 2

    # Top face
    t0 = (cx, cy - h)
    t1 = (cx + hw, cy - h + hd)
    t2 = (cx, cy - h + d)
    t3 = (cx - hw, cy - h + hd)
    draw.polygon([t0, t1, t2, t3], fill=top_color)

    # Left face
    l0 = (cx - hw, cy - h + hd)
    l1 = (cx, cy - h + d)
    l2 = (cx, cy + d)
    l3 = (cx - hw, cy + hd)
    draw.polygon([l0, l1, l2, l3], fill=left_color)

    # Right face
    r0 = (cx + hw, cy - h + hd)
    r1 = (cx, cy - h + d)
    r2 = (cx, cy + d)
    r3 = (cx + hw, cy + hd)
    draw.polygon([r0, r1, r2, r3], fill=right_color)


def draw_windows(draw, cx, cy, w, h, d, window_color, dark_color, rows, cols, seed=0):
    """Draw windows on the right and left faces of a building."""
    import random
    rng = random.Random(seed)

    hw, hd = w / 2, d / 2

    # Right face windows
    for r in range(rows):
        for c in range(cols):
            wy = cy - h * 0.1 - (r / rows) * h * 0.8
            wx = cx + 2 + c * (hw / cols)
            if wx < cx + hw - 2:
                color = window_color if rng.random() > 0.3 else dark_color
                draw.rectangle([wx, wy, wx + 2, wy + 3], fill=color)

    # Left face windows
    for r in range(rows):
        for c in range(cols):
            wy = cy - h * 0.1 - (r / rows) * h * 0.8
            wx = cx - 3 - c * (hw / cols)
            if wx > cx - hw + 2:
                color = window_color if rng.random() > 0.3 else dark_color
                draw.rectangle([wx, wy, wx + 2, wy + 3], fill=color)


def create_sprite(width, height, draw_func):
    """Create a transparent RGBA image and call draw_func on it."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw_func(draw, width, height)
    return img


def trim_and_save(img, path):
    """Trim transparent padding and save."""
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(path))
    print(f"  ✓ {path.name} ({img.size[0]}x{img.size[1]})")


# ================================================================
#  LEVEL 0 — Empty lot
# ================================================================

def draw_level_0(draw, w, h):
    cx, cy = w // 2, h // 2 + 10

    # Ground - concrete with cracks
    tw, td = 50, 25
    draw_iso_block(draw, cx, cy, tw, td, 2, "#5a5a60", "#484850", "#505058")

    # Sidewalk edge
    draw_iso_block(draw, cx, cy + 2, tw + 4, td + 2, 1, "#6a6a70", "#585860", "#606068")

    # Fire hydrant
    hx, hy = cx + 10, cy - 3
    draw.rectangle([hx - 2, hy - 10, hx + 2, hy], fill="#cc3333")
    draw.rectangle([hx - 3, hy - 8, hx + 3, hy - 7], fill="#aa2222")
    draw.ellipse([hx - 2, hy - 12, hx + 2, hy - 10], fill="#dd4444")

    # Crack lines
    draw.line([(cx - 8, cy - 1), (cx - 3, cy + 2), (cx + 2, cy)], fill="#3a3a40", width=1)


# ================================================================
#  LEVEL 1 — Brownstone / Bodega / Hot dog cart
# ================================================================

def draw_brownstone(draw, w, h):
    cx, cy = w // 2, h - 20
    bw, bd, bh = 44, 22, 50

    # Main building
    draw_iso_block(draw, cx, cy, bw, bd, bh, "#8B6B4A", "#6B4B2A", "#7B5B3A")

    # Stoop stairs
    for i in range(3):
        sx = cx + bw // 4
        sy = cy - i * 3
        draw_iso_block(draw, sx, sy, 12, 6, 3, "#9a8070", "#7a6050", "#8a7060")

    # Windows (3 floors x 3 windows)
    draw_windows(draw, cx, cy, bw, bh, bd, "#ffd866", "#554422", 3, 3, seed=1)

    # Door
    draw.rectangle([cx - 2, cy - 12, cx + 2, cy - 2], fill="#3a2a1a")

    # Roof cornice
    draw_iso_block(draw, cx, cy - bh, bw + 2, bd + 1, 2, "#6a5030", "#5a4020", "#5a4525")


def draw_bodega(draw, w, h):
    cx, cy = w // 2, h - 20
    bw, bd, bh = 40, 20, 38

    # Building
    draw_iso_block(draw, cx, cy, bw, bd, bh, "#c8b898", "#a89878", "#b8a888")

    # Storefront awning
    aw = bw + 4
    draw_iso_block(draw, cx, cy - 4, aw, bd // 2 + 4, 2, "#cc3333", "#aa2222", "#bb2828")

    # Shop window
    draw.rectangle([cx - 8, cy - 12, cx + 8, cy - 4], fill="#88bbdd")
    draw.rectangle([cx - 8, cy - 12, cx + 8, cy - 11], fill="#445566")

    # Upper windows
    draw_windows(draw, cx, cy, bw, bh, bd, "#ffd866", "#554422", 2, 2, seed=2)

    # Sign area
    draw.rectangle([cx - 6, cy - bh + 5, cx + 6, cy - bh + 10], fill="#228833")


def draw_hotdog_cart(draw, w, h):
    cx, cy = w // 2, h - 15

    # Cart body
    draw_iso_block(draw, cx, cy, 24, 12, 14, "#dddddd", "#bbbbbb", "#cccccc")

    # Umbrella
    umbrella_colors = ["#cc3333", "#ffcc00", "#cc3333", "#ffcc00"]
    uy = cy - 30
    # Pole
    draw.line([(cx, cy - 14), (cx, uy)], fill="#888888", width=2)
    # Canopy
    for i, color in enumerate(umbrella_colors):
        angle_start = i * 90 - 45
        draw.pieslice([cx - 16, uy - 8, cx + 16, uy + 8], angle_start, angle_start + 90, fill=color)

    # Wheels
    draw.ellipse([cx - 14, cy - 2, cx - 10, cy + 2], fill="#333333")
    draw.ellipse([cx + 10, cy - 2, cx + 14, cy + 2], fill="#333333")

    # Bench
    bx = cx + 20
    draw_iso_block(draw, bx, cy + 2, 14, 7, 8, "#6a5a3a", "#5a4a2a", "#5a4a30")


# ================================================================
#  LEVEL 2 — Medium apartment / office
# ================================================================

def draw_apartment(draw, w, h):
    cx, cy = w // 2, h - 20
    bw, bd, bh = 48, 24, 90

    # Main building
    draw_iso_block(draw, cx, cy, bw, bd, bh, "#a05040", "#803020", "#903030")

    # Fire escapes (zigzag on right face)
    for i in range(4):
        fy = cy - 15 - i * 18
        fx = cx + bw // 4
        draw.rectangle([fx, fy, fx + 8, fy + 2], fill="#555555")
        if i < 3:
            draw.line([(fx + 8, fy), (fx, fy - 16)], fill="#555555", width=1)

    # Windows
    draw_windows(draw, cx, cy, bw, bh, bd, "#ffd866", "#443322", 6, 3, seed=10)

    # AC units (random boxes on windows)
    import random
    rng = random.Random(42)
    for i in range(3):
        ax = cx + 3 + i * 8
        ay = cy - 20 - rng.randint(0, 40)
        draw.rectangle([ax, ay, ax + 4, ay + 3], fill="#888888")


def draw_office(draw, w, h):
    cx, cy = w // 2, h - 20
    bw, bd, bh = 46, 23, 100

    # Main building - art deco
    draw_iso_block(draw, cx, cy, bw, bd, bh, "#d4c8b0", "#b4a890", "#c4b8a0")

    # Ornamental top band
    draw_iso_block(draw, cx, cy - bh, bw + 2, bd + 1, 4, "#c0a880", "#a08860", "#b09870")

    # Base band
    draw_iso_block(draw, cx, cy - 6, bw + 2, bd + 1, 6, "#b0a080", "#907860", "#a09070")

    # Window grid
    draw_windows(draw, cx, cy, bw, bh, bd, "#88aacc", "#445566", 8, 3, seed=20)


def draw_prewar(draw, w, h):
    cx, cy = w // 2, h - 20
    bw, bd, bh = 46, 23, 95

    # Building
    draw_iso_block(draw, cx, cy, bw, bd, bh, "#d8ccb8", "#b8ac98", "#c8bca8")

    # Water tower on roof
    wtx, wty = cx - 5, cy - bh - 2
    # Legs
    draw.line([(wtx - 4, wty), (wtx - 3, wty + 6)], fill="#5a4a3a", width=1)
    draw.line([(wtx + 4, wty), (wtx + 3, wty + 6)], fill="#5a4a3a", width=1)
    # Tank
    draw.rectangle([wtx - 4, wty - 8, wtx + 4, wty], fill="#6a5a4a")
    draw.rectangle([wtx - 5, wty - 9, wtx + 5, wty - 8], fill="#5a4a3a")

    # Windows
    draw_windows(draw, cx, cy, bw, bh, bd, "#ffd866", "#443322", 7, 3, seed=30)


# ================================================================
#  LEVEL 3 — Tall buildings
# ================================================================

def draw_skyscraper(draw, w, h):
    cx, cy = w // 2, h - 20
    bw, bd, bh = 42, 21, 150

    # Modern glass tower
    draw_iso_block(draw, cx, cy, bw, bd, bh, "#8899aa", "#667788", "#778899")

    # Setback at 2/3 height
    draw_iso_block(draw, cx, cy - bh * 0.65, bw - 6, bd - 3, bh * 0.35,
                   "#99aabb", "#778899", "#8899aa")

    # Glass windows (dense grid)
    draw_windows(draw, cx, cy, bw, bh, bd, "#aaccee", "#556677", 15, 4, seed=40)

    # Antenna
    draw.line([(cx, cy - bh - 2), (cx, cy - bh - 15)], fill="#888888", width=1)
    draw.ellipse([cx - 1, cy - bh - 16, cx + 1, cy - bh - 14], fill="#ff3333")


def draw_art_deco_tower(draw, w, h):
    cx, cy = w // 2, h - 20
    bw, bd, bh = 44, 22, 160

    # Base (wider)
    draw_iso_block(draw, cx, cy, bw + 6, bd + 3, bh * 0.3,
                   "#d4c8a8", "#b4a888", "#c4b898")

    # Middle section
    draw_iso_block(draw, cx, cy - bh * 0.3, bw, bd, bh * 0.4,
                   "#d0c4a4", "#b0a484", "#c0b494")

    # Upper section (narrower)
    draw_iso_block(draw, cx, cy - bh * 0.7, bw - 8, bd - 4, bh * 0.2,
                   "#ccc0a0", "#aca080", "#bcb090")

    # Crown
    draw_iso_block(draw, cx, cy - bh * 0.9, bw - 16, bd - 8, bh * 0.1,
                   "#c8bc98", "#a89c78", "#b8ac88")

    # Ornamental crown details
    for i in range(-2, 3):
        draw.line([(cx + i * 3, cy - bh), (cx + i * 3, cy - bh - 8)], fill="#a89878", width=1)

    # Windows
    draw_windows(draw, cx, cy, bw + 6, bh * 0.3, bd + 3, "#ffd866", "#554422", 4, 4, seed=50)
    draw_windows(draw, cx, cy - bh * 0.3, bw, bh * 0.4, bd, "#ffd866", "#554422", 6, 3, seed=51)

    # Spire
    draw.line([(cx, cy - bh), (cx, cy - bh - 20)], fill="#999999", width=2)
    draw.ellipse([cx - 1, cy - bh - 22, cx + 1, cy - bh - 20], fill="#ff3333")


def draw_residential_tower(draw, w, h):
    cx, cy = w // 2, h - 20
    bw, bd, bh = 40, 20, 145

    # Modern luxury tower
    draw_iso_block(draw, cx, cy, bw, bd, bh, "#c0d0e0", "#a0b0c0", "#b0c0d0")

    # Balconies (every 4th floor)
    for i in range(5):
        by = cy - 20 - i * 25
        draw_iso_block(draw, cx + bw // 4 + 2, by, 8, 4, 1, "#aabbcc", "#8899aa", "#99aabb")

    # Windows
    draw_windows(draw, cx, cy, bw, bh, bd, "#aaccee", "#556677", 12, 3, seed=60)

    # Rooftop amenities
    draw_iso_block(draw, cx, cy - bh - 1, 12, 6, 4, "#88aa88", "#668866", "#779977")


# ================================================================
#  LEVEL 4 — Supertall / Iconic
# ================================================================

def draw_supertall_modern(draw, w, h):
    cx, cy = w // 2, h - 18
    bw, bd, bh = 38, 19, 220

    # Sleek glass tower tapering slightly
    # Base
    draw_iso_block(draw, cx, cy, bw + 4, bd + 2, bh * 0.15, "#8899aa", "#667788", "#778899")
    # Main shaft
    draw_iso_block(draw, cx, cy - bh * 0.15, bw, bd, bh * 0.75, "#99aabb", "#778899", "#8899aa")
    # Taper top
    draw_iso_block(draw, cx, cy - bh * 0.9, bw - 6, bd - 3, bh * 0.1, "#aabbcc", "#8899aa", "#99aabb")

    # Dense window grid
    draw_windows(draw, cx, cy, bw + 4, bh * 0.15, bd + 2, "#bbddff", "#556677", 2, 4, seed=70)
    draw_windows(draw, cx, cy - bh * 0.15, bw, bh * 0.75, bd, "#bbddff", "#556677", 20, 3, seed=71)

    # Antenna spire
    draw.line([(cx, cy - bh), (cx, cy - bh - 30)], fill="#aaaaaa", width=2)
    draw.line([(cx, cy - bh - 30), (cx, cy - bh - 40)], fill="#888888", width=1)
    draw.ellipse([cx - 2, cy - bh - 42, cx + 2, cy - bh - 40], fill="#ff3333")


def draw_empire_state(draw, w, h):
    cx, cy = w // 2, h - 18
    bw, bd = 44, 22
    bh = 230

    # Base (widest)
    draw_iso_block(draw, cx, cy, bw + 8, bd + 4, bh * 0.2, "#d4c8a8", "#b4a888", "#c4b898")

    # Setback 1
    draw_iso_block(draw, cx, cy - bh * 0.2, bw + 2, bd + 1, bh * 0.25, "#d0c4a4", "#b0a484", "#c0b494")

    # Setback 2
    draw_iso_block(draw, cx, cy - bh * 0.45, bw - 4, bd - 2, bh * 0.25, "#ccc0a0", "#aca080", "#bcb090")

    # Setback 3
    draw_iso_block(draw, cx, cy - bh * 0.7, bw - 12, bd - 6, bh * 0.15, "#c8bc98", "#a89c78", "#b8ac88")

    # Crown
    draw_iso_block(draw, cx, cy - bh * 0.85, bw - 20, bd - 10, bh * 0.08, "#c4b894", "#a49874", "#b4a884")

    # Windows per section
    draw_windows(draw, cx, cy, bw + 8, bh * 0.2, bd + 4, "#ffd866", "#554422", 4, 5, seed=80)
    draw_windows(draw, cx, cy - bh * 0.2, bw + 2, bh * 0.25, bd + 1, "#ffd866", "#554422", 5, 4, seed=81)
    draw_windows(draw, cx, cy - bh * 0.45, bw - 4, bh * 0.25, bd - 2, "#ffd866", "#554422", 5, 3, seed=82)

    # Spire
    draw.line([(cx, cy - bh * 0.93), (cx, cy - bh - 25)], fill="#aaaaaa", width=2)
    draw.ellipse([cx - 2, cy - bh - 27, cx + 2, cy - bh - 25], fill="#ff3333")


def draw_pencil_tower(draw, w, h):
    cx, cy = w // 2, h - 18
    bw, bd, bh = 28, 14, 240

    # Ultra-slim pencil tower (432 Park inspired)
    draw_iso_block(draw, cx, cy, bw, bd, bh, "#d8d0c8", "#b8b0a8", "#c8c0b8")

    # Grid pattern (signature look)
    for r in range(24):
        for c in range(3):
            wy = cy - 8 - r * 9.5
            # Right face
            wx = cx + 2 + c * 4
            if wx < cx + bw // 2 - 2:
                draw.rectangle([wx, wy, wx + 2.5, wy + 6], fill="#88aacc")
            # Left face
            lwx = cx - 3 - c * 4
            if lwx > cx - bw // 2 + 2:
                draw.rectangle([lwx, wy, lwx + 2.5, wy + 6], fill="#88aacc")

    # Roof
    draw_iso_block(draw, cx, cy - bh, bw + 2, bd + 1, 3, "#e0d8d0", "#c0b8b0", "#d0c8c0")


# ================================================================
#  MAIN — Generate all sprites
# ================================================================

SPRITES = {
    "level-0-a": (80, 60, draw_level_0),
    "level-1-a": (80, 90, draw_brownstone),
    "level-1-b": (80, 80, draw_bodega),
    "level-1-c": (100, 70, draw_hotdog_cart),
    "level-2-a": (80, 130, draw_apartment),
    "level-2-b": (80, 140, draw_office),
    "level-2-c": (80, 135, draw_prewar),
    "level-3-a": (80, 195, draw_skyscraper),
    "level-3-b": (80, 210, draw_art_deco_tower),
    "level-3-c": (80, 190, draw_residential_tower),
    "level-4-a": (80, 280, draw_supertall_modern),
    "level-4-b": (80, 280, draw_empire_state),
    "level-4-c": (80, 290, draw_pencil_tower),
}


def main():
    print(f"\n{'='*50}")
    print(f"  NYC Sprite Generator (Programmatic)")
    print(f"  Output: {OUTPUT_DIR}")
    print(f"{'='*50}\n")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for name, (w, h, draw_func) in SPRITES.items():
        img = create_sprite(w, h, draw_func)
        trim_and_save(img, OUTPUT_DIR / f"{name}.png")

    print(f"\n  ✓ Generated {len(SPRITES)} NYC sprites")
    print(f"  Output: {OUTPUT_DIR}\n")


if __name__ == "__main__":
    main()
