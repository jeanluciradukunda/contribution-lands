"""Cross-sprite consistency analysis within and across themes."""

from pathlib import Path
from collections import defaultdict

import numpy as np
from PIL import Image

from . import config as cfg
from .sprite_analyzer import analyze_clean_sprite


def check_scale_progression(theme_dir, sprites_subdir="sprites"):
    """Check that sprite heights increase with level (levels 1-4).

    Returns dict with 'heights' (level -> avg height) and 'violations' list.
    """
    theme_dir = Path(theme_dir)
    sprite_dir = theme_dir / sprites_subdir

    if not sprite_dir.exists():
        return {"heights": {}, "violations": ["directory_not_found"]}

    # Collect object heights per level
    level_heights = defaultdict(list)

    for sprite_path in sorted(sprite_dir.glob("level-*.png")):
        level, variant = cfg.parse_sprite_filename(sprite_path)
        if level is None or level == 0:
            continue  # Skip ground tiles

        try:
            img = Image.open(sprite_path).convert("RGBA")
            arr = np.array(img)
            alpha = arr[:, :, 3]
            object_mask = alpha > 0

            if np.any(object_mask):
                rows = np.any(object_mask, axis=1)
                rmin, rmax = np.where(rows)[0][[0, -1]]
                height = int(rmax - rmin)
                level_heights[level].append(height)
        except Exception:
            continue

    # Compute averages
    avg_heights = {}
    for level in sorted(level_heights.keys()):
        if level_heights[level]:
            avg_heights[level] = sum(level_heights[level]) / len(level_heights[level])

    # Check progression
    violations = []
    sorted_levels = sorted(avg_heights.keys())
    for i in range(len(sorted_levels) - 1):
        l_curr = sorted_levels[i]
        l_next = sorted_levels[i + 1]
        h_curr = avg_heights[l_curr]
        h_next = avg_heights[l_next]

        if h_next < h_curr * cfg.SCALE_TOLERANCE:
            violations.append(
                f"level {l_next} avg height ({h_next:.0f}px) < "
                f"level {l_curr} avg height ({h_curr:.0f}px) * {cfg.SCALE_TOLERANCE}"
            )

    return {"heights": avg_heights, "violations": violations}


def check_color_consistency(theme_dir, sprites_subdir="sprites"):
    """Check color palette consistency across sprites in a theme.

    Uses HSV hue histogram comparison. Returns outlier sprites.
    """
    theme_dir = Path(theme_dir)
    sprite_dir = theme_dir / sprites_subdir

    if not sprite_dir.exists():
        return {"outliers": [], "error": "directory_not_found"}

    # Compute hue histograms for each sprite
    histograms = {}
    sprite_paths = sorted(sprite_dir.glob("level-*.png"))

    for sprite_path in sprite_paths:
        try:
            img = Image.open(sprite_path).convert("RGBA")
            arr = np.array(img)
            alpha = arr[:, :, 3]
            object_mask = alpha > 0

            if np.sum(object_mask) < 100:
                continue

            # Extract object pixels, convert to HSV-ish
            rgb = arr[:, :, :3][object_mask].astype(np.float32) / 255
            r, g, b = rgb[:, 0], rgb[:, 1], rgb[:, 2]

            cmax = np.maximum(r, np.maximum(g, b))
            cmin = np.minimum(r, np.minimum(g, b))
            delta = cmax - cmin

            hue = np.zeros_like(r)
            mask = delta > 0.01
            # Red dominant
            mr = (cmax == r) & mask
            hue[mr] = 60 * (((g[mr] - b[mr]) / delta[mr]) % 6)
            # Green dominant
            mg = (cmax == g) & mask
            hue[mg] = 60 * (((b[mg] - r[mg]) / delta[mg]) + 2)
            # Blue dominant
            mb = (cmax == b) & mask
            hue[mb] = 60 * (((r[mb] - g[mb]) / delta[mb]) + 4)

            # 12-bin hue histogram (30° per bin)
            hist, _ = np.histogram(hue[mask], bins=12, range=(0, 360))
            total = hist.sum()
            if total > 0:
                hist = hist.astype(float) / total
            histograms[sprite_path.name] = hist

        except Exception:
            continue

    if len(histograms) < 2:
        return {"outliers": [], "histograms": histograms}

    # Compute pairwise Jensen-Shannon divergence
    names = list(histograms.keys())
    avg_divergences = {}

    for i, name_i in enumerate(names):
        divs = []
        for j, name_j in enumerate(names):
            if i == j:
                continue
            h1 = histograms[name_i]
            h2 = histograms[name_j]
            # JS divergence
            m = 0.5 * (h1 + h2)
            m[m == 0] = 1e-10  # avoid log(0)
            h1_safe = h1.copy()
            h2_safe = h2.copy()
            h1_safe[h1_safe == 0] = 1e-10
            h2_safe[h2_safe == 0] = 1e-10
            kl1 = np.sum(h1_safe * np.log(h1_safe / m))
            kl2 = np.sum(h2_safe * np.log(h2_safe / m))
            js = 0.5 * (kl1 + kl2)
            divs.append(js)

        avg_divergences[name_i] = np.mean(divs) if divs else 0

    outliers = [
        name for name, div in avg_divergences.items()
        if div > cfg.MAX_COLOR_DIVERGENCE
    ]

    return {"outliers": outliers, "divergences": avg_divergences}


def check_completeness(sprites_dir):
    """Check that all themes have complete sprite sets.

    Returns dict with per-theme completeness and missing sprites.
    """
    sprites_dir = Path(sprites_dir)
    results = {}

    for theme_name in cfg.THEME_NAMES:
        theme_result = {"present": [], "missing": [], "complete": False}
        clean_dir = sprites_dir / theme_name / "sprites"

        if not clean_dir.exists():
            theme_result["missing"] = [
                f"level-{l}-{v}.png"
                for l in cfg.LEVELS
                for v in cfg.VARIANTS[:1]  # At least variant 'a'
            ]
            results[theme_name] = theme_result
            continue

        # Check required sprites (at least variant 'a' for each level)
        for level in cfg.LEVELS:
            has_any = False
            for variant in cfg.VARIANTS:
                path = clean_dir / f"level-{level}-{variant}.png"
                if path.exists():
                    theme_result["present"].append(path.name)
                    has_any = True

            if not has_any:
                theme_result["missing"].append(f"level-{level}-a.png (no variants)")

        theme_result["complete"] = len(theme_result["missing"]) == 0
        results[theme_name] = theme_result

    return results
