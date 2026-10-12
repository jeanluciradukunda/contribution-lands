"""
Programmatic Central Park tiles for the NYC theme (no API key needed).

Draws flush 1x1 diamond tiles in the same low-poly look as the level-0 park
sprites, supersampled and reduced to the standard 128px width. The lake is a
3x3-footprint tile; the bridge is drawn over it. To replace these with
Gemini renders, generate with the same file names and run the usual
background removal and standardize_sprite.

The lake, bridge, path and left/right edge tiles it also draws are no longer
used: the park now takes its landmarks, canopy and walls from
generate_central_park.py. Only the lawn tiles and the corner come from here.

Usage:
    python create_central_park_sprites.py
"""

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw

from processing.resize import TARGET_BASE_WIDTH, standardize_sprite

OUTPUT_DIR = Path(__file__).parent.parent.parent / "themes" / "city-nyc" / "sprites"

S = 4
W = 128 * S
H = 64 * S
CANVAS_H = 200 * S
BASE_Y = 110 * S
SLAB = 5 * S

GRASS = [(92, 144, 50), (102, 156, 54), (82, 134, 44), (112, 164, 60)]
SOIL_L = (122, 86, 52)
SOIL_R = (96, 66, 40)
STONE = [(150, 146, 140), (128, 124, 120), (104, 100, 98)]
WATER = [(74, 160, 168), (92, 178, 184), (58, 138, 150)]
CREAM = [(240, 232, 214), (206, 198, 182), (172, 164, 150)]
WOOD = [(176, 124, 70), (142, 96, 54)]


def P(u, v, z=0.0):
    """Tile coords (0..1 along gx, gy) and height in output px to canvas px."""
    return (W / 2 + (u - v) * W / 2, BASE_Y + (u + v) * H / 2 - z * S)


def poly(d, pts, fill):
    d.polygon(pts, fill=fill)


def slab(d, top, left=SOIL_L, right=SOIL_R, depth=SLAB, extent=1.0):
    e = extent
    a, b, c, f = P(0, 0), P(e, 0), P(e, e), P(0, e)
    poly(d, [f, c, (c[0], c[1] + depth), (f[0], f[1] + depth)], left)
    poly(d, [c, b, (b[0], b[1] + depth), (c[0], c[1] + depth)], right)
    poly(d, [a, b, c, f], top)


def grass_top(d, rng, extent=1.0, n=10):
    slab(d, GRASS[0], extent=extent)
    step = extent / n
    for i in range(n):
        for j in range(n):
            if rng.random() < 0.55:
                u0, v0 = i * step, j * step
                shade = rng.choice(GRASS[1:])
                poly(d, [P(u0, v0), P(u0 + step, v0), P(u0 + step, v0 + step), P(u0, v0 + step)], shade)


def box(d, u0, v0, u1, v1, z0, z1, top, left, right):
    """Axis-aligned box in tile space; the left face is the v=v1 side, the right is u=u1."""
    poly(d, [P(u0, v1, z1), P(u1, v1, z1), P(u1, v1, z0), P(u0, v1, z0)], left)
    poly(d, [P(u1, v0, z1), P(u1, v1, z1), P(u1, v1, z0), P(u1, v0, z0)], right)
    poly(d, [P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)], top)


def facet(d, cx, cy, r, base, light, dark, rng):
    """A low-poly rounded canopy: octagon plus a lit upper-left and a shaded lower-right facet."""
    pts = []
    for k in range(9):
        a = k * math.pi / 4 + rng.uniform(-0.08, 0.08)
        pts.append((cx + math.cos(a) * r * rng.uniform(0.92, 1.05), cy + math.sin(a) * r * 0.9 * rng.uniform(0.92, 1.05)))
    poly(d, pts, base)
    poly(d, [pts[4], pts[5], pts[6], (cx, cy), pts[3]], light)
    poly(d, [pts[0], pts[1], pts[2], pts[3], (cx, cy)], light)
    poly(d, [pts[7], pts[8], pts[1], pts[0], (cx + r * 0.1, cy + r * 0.1)], dark)
    poly(d, [(cx, cy), pts[0], pts[7], pts[6]], dark)


def tree(d, u, v, height, radius, rng, gold=False):
    x, y = P(u, v)
    t = 1.6 * S
    d.polygon([(x - t, y), (x + t, y), (x + t * 0.8, y - height * S * 0.55), (x - t * 0.8, y - height * S * 0.55)], fill=(110, 72, 44))
    d.polygon([(x + t * 0.2, y), (x + t, y), (x + t * 0.8, y - height * S * 0.55), (x + t * 0.2, y - height * S * 0.55)], fill=(88, 56, 34))
    if gold:
        base, light, dark = (226, 160, 44), (244, 192, 70), (190, 120, 36)
    else:
        base, light, dark = (86, 148, 52), (118, 178, 66), (58, 112, 44)
    cy = y - height * S * 0.7
    r = radius * S
    facet(d, x - r * 0.35, cy + r * 0.25, r * 0.7, base, light, dark, rng)
    facet(d, x + r * 0.4, cy + r * 0.2, r * 0.7, base, light, dark, rng)
    facet(d, x, cy - r * 0.2, r * 0.9, base, light, dark, rng)


def rock(d, u, v, size, rng):
    x, y = P(u, v)
    s = size * S
    top = [(x - s, y - s * 0.4), (x - s * 0.3, y - s * 1.2), (x + s * 0.5, y - s * 1.0), (x + s, y - s * 0.3), (x + s * 0.2, y + s * 0.1), (x - s * 0.7, y + s * 0.1)]
    poly(d, top, STONE[0])
    poly(d, [top[0], top[1], (x, y - s * 0.4), top[5]], (170, 166, 158))
    poly(d, [top[3], top[4], top[5], (x, y - s * 0.4), top[2]], STONE[2])


def shrub(d, u, v, size):
    x, y = P(u, v)
    s = size * S
    d.ellipse([x - s, y - s * 1.2, x + s, y + s * 0.2], fill=(70, 126, 48))
    d.ellipse([x - s * 0.7, y - s * 1.3, x + s * 0.4, y - s * 0.3], fill=(98, 160, 58))


def lamp(d, u, v):
    x, y = P(u, v)
    d.rectangle([x - S * 0.6, y - 16 * S, x + S * 0.6, y], fill=(34, 36, 38))
    d.rectangle([x - S * 1.8, y - 3 * S, x + S * 1.8, y], fill=(34, 36, 38))
    d.polygon([(x - 2 * S, y - 20 * S), (x + 2 * S, y - 20 * S), (x + 1.4 * S, y - 16 * S), (x - 1.4 * S, y - 16 * S)], fill=(255, 214, 120))
    d.polygon([(x - 2.4 * S, y - 20 * S), (x + 2.4 * S, y - 20 * S), (x, y - 23 * S)], fill=(34, 36, 38))


def bench(d, u, v):
    box(d, u - 0.1, v - 0.045, u + 0.1, v + 0.045, 2.5, 3.5, WOOD[0], WOOD[0], WOOD[1])
    box(d, u - 0.1, v - 0.045, u + 0.1, v - 0.03, 3.5, 7, WOOD[0], WOOD[0], WOOD[1])
    box(d, u - 0.09, v - 0.04, u - 0.07, v + 0.04, 0, 2.5, (40, 40, 44), (40, 40, 44), (30, 30, 34))
    box(d, u + 0.07, v - 0.04, u + 0.09, v + 0.04, 0, 2.5, (40, 40, 44), (40, 40, 44), (30, 30, 34))


def path_strip(d, along_u, width=0.26):
    c, h = 0.5, width / 2
    if along_u:
        pts = [P(0, c - h), P(1, c - h), P(1, c + h), P(0, c + h)]
    else:
        pts = [P(c - h, 0), P(c + h, 0), P(c + h, 1), P(c - h, 1)]
    poly(d, pts, CREAM[0])
    edge = [pts[3], pts[2]] if along_u else [pts[3], pts[2]]
    d.line(edge, fill=CREAM[2], width=S)


def wall(d, side, rng):
    """A low schist wall with an ivy cap along the v=1 (lower-left) or u=1 (lower-right) edge."""
    t = 0.12
    if side == "left":
        box(d, 0, 1 - t, 1, 1, 0, 7, STONE[1], STONE[0], STONE[2])
        for k in range(10):
            u = (k + rng.random()) / 10
            shrub(d, u, 1 - t / 2, 1.8 + rng.random())
    else:
        box(d, 1 - t, 0, 1, 1, 0, 7, STONE[1], STONE[0], STONE[2])
        for k in range(10):
            v = (k + rng.random()) / 10
            shrub(d, 1 - t / 2, v, 1.8 + rng.random())


def new():
    img = Image.new("RGBA", (W, CANVAS_H), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def finish(img, name, framed=False):
    """Framed sprites keep the lake tile's footprint box so the bridge lines up when drawn over it."""
    bbox = img.getbbox()
    if framed:
        bbox = (0, bbox[1], W, BASE_Y + H + SLAB // 2)
    out = img.crop(bbox)
    scale = 128 / out.width
    out = out.resize((128, max(1, round(out.height * scale))), Image.LANCZOS)
    path = OUTPUT_DIR / f"park-cp-{name}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    out.save(path)
    if not framed:
        standardize_sprite(path)
    print(f"  {path.name} {Image.open(path).size}")


def lawn_a():
    img, d = new()
    rng = random.Random(1)
    grass_top(d, rng)
    for _ in range(9):
        x, y = P(rng.uniform(0.1, 0.9), rng.uniform(0.1, 0.9))
        d.ellipse([x - S, y - S * 0.5, x + S, y + S * 0.5], fill=rng.choice([(250, 244, 220), (246, 206, 90), (232, 140, 160)]))
    tree(d, 0.66, 0.4, 34, 11, rng)
    finish(img, "lawn-a")


def lawn_b():
    img, d = new()
    rng = random.Random(2)
    grass_top(d, rng)
    tree(d, 0.5, 0.52, 62, 19, rng)
    finish(img, "lawn-b")


def lawn_c():
    img, d = new()
    rng = random.Random(3)
    grass_top(d, rng)
    tree(d, 0.28, 0.3, 38, 12, rng)
    tree(d, 0.72, 0.4, 44, 13, rng, gold=True)
    tree(d, 0.44, 0.74, 34, 11, rng)
    finish(img, "lawn-c")


def lawn_d():
    img, d = new()
    rng = random.Random(4)
    grass_top(d, rng)
    rock(d, 0.4, 0.45, 9, rng)
    rock(d, 0.62, 0.6, 6, rng)
    shrub(d, 0.25, 0.7, 4)
    shrub(d, 0.76, 0.28, 3.4)
    shrub(d, 0.55, 0.78, 3)
    finish(img, "lawn-d")


def edge_a():
    img, d = new()
    rng = random.Random(5)
    grass_top(d, rng)
    tree(d, 0.7, 0.3, 30, 10, rng)
    wall(d, "left", rng)
    finish(img, "edge-a")


def edge_b():
    img, d = new()
    rng = random.Random(6)
    grass_top(d, rng)
    tree(d, 0.3, 0.68, 30, 10, rng)
    wall(d, "right", rng)
    finish(img, "edge-b")


def edge_c():
    img, d = new()
    rng = random.Random(7)
    grass_top(d, rng)
    tree(d, 0.4, 0.38, 30, 10, rng)
    wall(d, "left", rng)
    wall(d, "right", rng)
    finish(img, "edge-c")


def lake():
    img, d = new()
    rng = random.Random(8)
    slab(d, STONE[1], left=STONE[0], right=STONE[2], depth=SLAB // 2)
    m = 0.045
    poly(d, [P(m, m), P(1 - m, m), P(1 - m, 1 - m), P(m, 1 - m)], WATER[0])
    n = 14
    step = (1 - 2 * m) / n
    for i in range(n):
        for j in range(n):
            if rng.random() < 0.5:
                u0, v0 = m + i * step, m + j * step
                poly(d, [P(u0, v0), P(u0 + step, v0), P(u0 + step, v0 + step), P(u0, v0 + step)], rng.choice(WATER[1:]))
    for _ in range(14):
        u, v = rng.uniform(0.12, 0.88), rng.uniform(0.12, 0.88)
        x, y = P(u, v)
        d.ellipse([x - 2.4 * S, y - 1.2 * S, x + 2.4 * S, y + 1.2 * S], fill=(70, 132, 60))
    for _ in range(18):
        u, v = rng.choice([(rng.uniform(0.04, 0.96), rng.choice([0.07, 0.93])), (rng.choice([0.07, 0.93]), rng.uniform(0.04, 0.96))])
        x, y = P(u, v)
        d.line([(x, y), (x + rng.uniform(-S, S), y - rng.uniform(4, 8) * S)], fill=(92, 132, 56), width=S)
    finish(img, "lake")


def bridge():
    """Bow Bridge style: a low white cast-iron arch crossing the tile along gx, drawn over the lake."""
    img, d = new()
    steps = 24
    half = 0.11

    def z(u):
        return 5 + 9 * math.sin(math.pi * u)

    for k in range(steps):
        u0, u1 = k / steps, (k + 1) / steps
        a, b = z(u0), z(u1)
        poly(d, [P(u0, 0.5 + half, a), P(u1, 0.5 + half, b), P(u1, 0.5 + half, b - 3), P(u0, 0.5 + half, a - 3)], CREAM[1])
    for k in range(steps):
        u0, u1 = k / steps, (k + 1) / steps
        a, b = z(u0), z(u1)
        poly(d, [P(u0, 0.5 - half, a), P(u1, 0.5 - half, b), P(u1, 0.5 + half, b), P(u0, 0.5 + half, a)], CREAM[0])
    for sgn in (-1, 1):
        v = 0.5 + sgn * half
        pts = [P(k / steps, v, z(k / steps) + 5) for k in range(steps + 1)]
        d.line(pts, fill=(250, 246, 236), width=int(1.2 * S))
        for k in range(0, steps + 1, 3):
            u = k / steps
            d.line([P(u, v, z(u)), P(u, v, z(u) + 5)], fill=CREAM[1], width=int(0.9 * S))
    finish(img, "bridge", framed=True)


def path_a():
    img, d = new()
    rng = random.Random(9)
    grass_top(d, rng)
    path_strip(d, True)
    bench(d, 0.68, 0.32)
    lamp(d, 0.3, 0.3)
    finish(img, "path-a")


def path_b():
    img, d = new()
    rng = random.Random(10)
    grass_top(d, rng)
    path_strip(d, True)
    path_strip(d, False)
    bench(d, 0.8, 0.28)
    bench(d, 0.2, 0.72)
    lamp(d, 0.3, 0.3)
    finish(img, "path-b")


if __name__ == "__main__":
    for fn in (lawn_a, lawn_b, lawn_c, lawn_d, edge_a, edge_b, edge_c, lake, bridge, path_a, path_b):
        fn()
