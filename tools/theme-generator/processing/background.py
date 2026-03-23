"""Green chroma key background removal using HSV-based detection."""

from pathlib import Path
import numpy as np
from PIL import Image


def remove_green_background(input_path, output_path):
    """Remove #00FF00 chroma green background (numpy-vectorized HSV detection).

    Uses both RGB thresholds and HSV hue analysis to cleanly separate
    chroma green from natural greens (e.g., tree foliage).

    Args:
        input_path: Path to raw sprite with green background.
        output_path: Path to save cleaned transparent PNG.

    Returns:
        True on success, False on failure.
    """
    try:
        img = Image.open(input_path).convert("RGBA")
        arr = np.array(img)
        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

        # RGB check: high green, low red and blue (catches pure chroma green)
        rgb_mask = (g > 150) & (r < 100) & (b < 100)

        # HSV check: catch anti-aliased edge pixels blending into green
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

        # Chroma green in HSV: hue 100-140°, saturation > 0.6, value > 0.4
        hsv_mask = (hue >= 100) & (hue <= 140) & (sat > 0.6) & (cmax > 0.4)

        combined_mask = rgb_mask | hsv_mask
        arr[combined_mask] = [0, 0, 0, 0]

        result = Image.fromarray(arr)
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        result.save(str(output_path))
        return True
    except Exception as e:
        print(f"  ✗ Background removal failed: {e}")
        return False
