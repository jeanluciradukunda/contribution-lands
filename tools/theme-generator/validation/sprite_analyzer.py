"""Core image analysis for individual sprites using Pillow + numpy."""

from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image

from . import config as cfg


@dataclass
class SpriteAnalysis:
    """Result of analyzing a single sprite."""
    path: Path
    is_valid_image: bool = False
    width: int = 0
    height: int = 0
    aspect_ratio: float = 0.0
    green_pixel_ratio: float = 0.0
    object_pixel_ratio: float = 0.0
    object_bbox: tuple = (0, 0, 0, 0)  # (left, top, right, bottom)
    object_height: int = 0
    object_width: int = 0
    center_offset: tuple = (0.0, 0.0)  # normalized (dx, dy)
    center_offset_magnitude: float = 0.0
    # Clean-specific
    has_alpha: bool = False
    transparency_ratio: float = 0.0
    green_fringe_ratio: float = 0.0
    object_pixel_count: int = 0
    # Verdict
    passed: bool = False
    failures: list = field(default_factory=list)


def _detect_chroma_green(arr_rgb):
    """Detect chroma green pixels using both RGB and HSV methods.

    Returns a boolean mask where True = chroma green.
    """
    r, g, b = arr_rgb[:, :, 0], arr_rgb[:, :, 1], arr_rgb[:, :, 2]

    # Simple RGB check: high green, low red and blue
    rgb_mask = (g > 150) & (r < 100) & (b < 100)

    # HSV-based check for anti-aliased edge greens
    rf = r.astype(np.float32) / 255
    gf = g.astype(np.float32) / 255
    bf = b.astype(np.float32) / 255

    cmax = np.maximum(rf, np.maximum(gf, bf))
    cmin = np.minimum(rf, np.minimum(gf, bf))
    delta = cmax - cmin

    hue = np.zeros_like(rf)
    mask_g = (cmax == gf) & (delta > 0)
    hue[mask_g] = 60 * (((bf[mask_g] - rf[mask_g]) / delta[mask_g]) + 2)
    hue[hue < 0] += 360

    sat = np.zeros_like(rf)
    sat[cmax > 0] = delta[cmax > 0] / cmax[cmax > 0]

    hsv_mask = (hue >= 100) & (hue <= 140) & (sat > 0.6) & (cmax > 0.4)

    return rgb_mask | hsv_mask


def analyze_raw_sprite(path, thresholds=None):
    """Analyze a raw sprite (with green background).

    Returns a SpriteAnalysis with pass/fail verdict.
    """
    path = Path(path)
    result = SpriteAnalysis(path=path)

    if thresholds is None:
        thresholds = cfg

    # Validate image
    try:
        img = Image.open(path)
        img.verify()
        img = Image.open(path).convert("RGB")
        result.is_valid_image = True
    except Exception:
        result.failures.append("invalid_image")
        return result

    arr = np.array(img)
    result.height, result.width = arr.shape[:2]
    result.aspect_ratio = result.width / max(result.height, 1)

    total_pixels = result.width * result.height

    # Dimension checks
    if result.width < thresholds.MIN_DIMENSION or result.height < thresholds.MIN_DIMENSION:
        result.failures.append(f"too_small ({result.width}x{result.height})")
    if result.width > thresholds.MAX_DIMENSION or result.height > thresholds.MAX_DIMENSION:
        result.failures.append(f"too_large ({result.width}x{result.height})")
    if result.aspect_ratio < thresholds.MIN_ASPECT_RATIO:
        result.failures.append(f"aspect_too_narrow ({result.aspect_ratio:.2f})")
    if result.aspect_ratio > thresholds.MAX_ASPECT_RATIO:
        result.failures.append(f"aspect_too_wide ({result.aspect_ratio:.2f})")

    # Green background analysis
    green_mask = _detect_chroma_green(arr)
    green_count = np.sum(green_mask)
    result.green_pixel_ratio = green_count / total_pixels

    if result.green_pixel_ratio < thresholds.MIN_GREEN_RATIO:
        result.failures.append(f"low_green_bg ({result.green_pixel_ratio:.2%})")
    if result.green_pixel_ratio > thresholds.MAX_GREEN_RATIO:
        result.failures.append(f"no_object_detected ({result.green_pixel_ratio:.2%} green)")

    # Object analysis (non-green pixels)
    object_mask = ~green_mask
    object_count = np.sum(object_mask)
    result.object_pixel_ratio = object_count / total_pixels
    result.object_pixel_count = int(object_count)

    if result.object_pixel_ratio < thresholds.MIN_OBJECT_RATIO:
        result.failures.append(f"object_too_small ({result.object_pixel_ratio:.2%})")

    # Bounding box of the object
    if object_count > 0:
        rows = np.any(object_mask, axis=1)
        cols = np.any(object_mask, axis=0)
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]
        result.object_bbox = (int(cmin), int(rmin), int(cmax), int(rmax))
        result.object_height = int(rmax - rmin)
        result.object_width = int(cmax - cmin)

        # Center offset
        obj_cx = (cmin + cmax) / 2
        obj_cy = (rmin + rmax) / 2
        img_cx = result.width / 2
        img_cy = result.height / 2
        dx = abs(obj_cx - img_cx) / result.width
        dy = abs(obj_cy - img_cy) / result.height
        result.center_offset = (float(dx), float(dy))
        result.center_offset_magnitude = float((dx**2 + dy**2) ** 0.5)

        if result.center_offset_magnitude > thresholds.MAX_CENTER_OFFSET:
            result.failures.append(f"off_center ({result.center_offset_magnitude:.2f})")

    result.passed = len(result.failures) == 0
    return result


def analyze_clean_sprite(path, raw_path=None, thresholds=None):
    """Analyze a cleaned sprite (with transparent background).

    Optionally compares against the raw version for integrity checks.
    """
    path = Path(path)
    result = SpriteAnalysis(path=path)

    if thresholds is None:
        thresholds = cfg

    try:
        img = Image.open(path)
        img.verify()
        img = Image.open(path).convert("RGBA")
        result.is_valid_image = True
    except Exception:
        result.failures.append("invalid_image")
        return result

    arr = np.array(img)
    result.height, result.width = arr.shape[:2]
    result.aspect_ratio = result.width / max(result.height, 1)
    result.has_alpha = True  # We converted to RGBA

    total_pixels = result.width * result.height
    alpha = arr[:, :, 3]

    # Transparency check
    transparent_count = np.sum(alpha == 0)
    result.transparency_ratio = transparent_count / total_pixels

    if result.transparency_ratio < thresholds.MIN_TRANSPARENCY_RATIO:
        result.failures.append(f"low_transparency ({result.transparency_ratio:.2%})")

    # Object pixels (non-transparent)
    object_mask = alpha > 0
    result.object_pixel_count = int(np.sum(object_mask))
    result.object_pixel_ratio = result.object_pixel_count / total_pixels

    if result.object_pixel_ratio < cfg.MIN_OBJECT_RATIO:
        result.failures.append(f"object_too_small ({result.object_pixel_ratio:.2%})")

    # Object bounding box
    if result.object_pixel_count > 0:
        rows = np.any(object_mask, axis=1)
        cols = np.any(object_mask, axis=0)
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]
        result.object_bbox = (int(cmin), int(rmin), int(cmax), int(rmax))
        result.object_height = int(rmax - rmin)
        result.object_width = int(cmax - cmin)

    # Green fringe detection at edges
    if result.object_pixel_count > 0:
        # Find edge pixels: object pixels adjacent to transparent pixels
        from scipy.ndimage import binary_dilation
        dilated = binary_dilation(~object_mask)
        edge_mask = dilated & object_mask

        edge_count = np.sum(edge_mask)
        if edge_count > 0:
            edge_rgb = arr[:, :, :3][edge_mask]
            # Check for green-ish edge pixels
            r, g, b = edge_rgb[:, 0], edge_rgb[:, 1], edge_rgb[:, 2]
            green_edge = (g > 120) & (g > r + 30) & (g > b + 30)
            result.green_fringe_ratio = float(np.sum(green_edge)) / edge_count

            if result.green_fringe_ratio > thresholds.MAX_GREEN_FRINGE_RATIO:
                result.failures.append(f"green_fringe ({result.green_fringe_ratio:.2%})")

    # Integrity check: compare with raw if available
    if raw_path and Path(raw_path).exists():
        raw_analysis = analyze_raw_sprite(raw_path, thresholds)
        if raw_analysis.object_pixel_count > 0:
            loss = 1 - (result.object_pixel_count / raw_analysis.object_pixel_count)
            if loss > thresholds.MAX_OBJECT_LOSS_RATIO:
                result.failures.append(f"object_damaged ({loss:.1%} pixels lost)")

    result.passed = len(result.failures) == 0
    return result
