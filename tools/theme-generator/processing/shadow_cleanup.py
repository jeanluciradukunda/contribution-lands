"""Remove flat green cast-shadow patches left on finished sprites.

Background removal keys on the backdrop colour, so the object's cast shadow
(the same green, darker and shifted towards teal) survives as a flat patch.
This grows a region from the transparent area into pixels that are green-ish
AND smooth. Foliage and copper carry texture, so they stop the growth.

Run it only on sprites known to have a patch and no green of their own (it
will eat green paint, glass or foliage that touches the edge), and review the result.

    python -m processing.shadow_cleanup [--max-std 7] ../../themes/city-nyc/sprites/level-4-h.png [...]

Raise --max-std when the patch touches textured parts (wheels, railings) and
the sprite has no green of its own.
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def _shadow_like(rgb, alpha, max_std):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    greenish = (g > r + 6) & (g >= b - 6)
    # Texture is measured over opaque pixels only: transparent ones read as
    # black and would make every patch edge look busy.
    weight = (alpha > 128).astype(np.float64)
    lum = rgb.mean(axis=2) * weight
    count = np.maximum(ndimage.uniform_filter(weight, 5), 1e-6)
    mean = ndimage.uniform_filter(lum, 5) / count
    var = ndimage.uniform_filter(lum**2, 5) / count - mean**2
    std = np.sqrt(np.maximum(var, 0))
    return greenish & (std < max_std)


def clean(path, out=None, max_std=7.0):
    img = np.array(Image.open(path).convert("RGBA")).astype(np.float64)
    rgb, alpha = img[..., :3], img[..., 3]
    candidate = _shadow_like(rgb, alpha, max_std) & (alpha > 0)
    transparent = alpha < 200

    h, w = alpha.shape
    region = np.zeros((h, w), dtype=bool)
    seeds = ndimage.binary_dilation(transparent) & candidate
    queue = deque(zip(*np.nonzero(seeds)))
    region[seeds] = True
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and candidate[ny, nx] and not region[ny, nx]:
                region[ny, nx] = True
                queue.append((ny, nx))

    # The patch's own anti-aliased rim is semi-transparent green; take it too.
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    rim = ndimage.binary_dilation(region, iterations=2) & (alpha < 230) & (g > r + 6) & (g >= b - 6)
    region |= rim

    # Soften the cut so the object's edge does not look clipped.
    edge = ndimage.binary_dilation(region) & ~region & (alpha > 0)
    img[..., 3][region] = 0
    img[..., 3][edge] *= 0.6

    Image.fromarray(img.clip(0, 255).astype(np.uint8), "RGBA").save(out or path)
    return int(region.sum())


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--max-std", type=float, default=7.0)
    parser.add_argument("paths", nargs="+")
    args = parser.parse_args()
    for p in args.paths:
        print(f"{p}: removed {clean(p, max_std=args.max_std)} px")
