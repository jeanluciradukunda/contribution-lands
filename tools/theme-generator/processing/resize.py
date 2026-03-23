"""Standardize sprite dimensions and remove AI watermarks."""

from pathlib import Path
import numpy as np
from PIL import Image


# Target base width for sprites in the contribution grid.
# Height varies per level (taller = more contributions).
TARGET_BASE_WIDTH = 128


def _remove_watermark(img):
    """Remove isolated small blobs (AI watermarks) by keeping only the largest component.

    Gemini adds a sparkle watermark in the corner. Since the main sprite is always
    the largest connected region of non-transparent pixels, we keep only that.
    """
    arr = np.array(img)
    alpha = arr[:, :, 3]

    try:
        from scipy import ndimage
        labeled, num_features = ndimage.label(alpha > 10)

        if num_features <= 1:
            return img  # Nothing to remove

        # Find the largest component
        sizes = ndimage.sum(alpha > 10, labeled, range(1, num_features + 1))
        largest_idx = np.argmax(sizes) + 1

        # Zero out everything except the largest component
        mask = labeled != largest_idx
        arr[mask] = [0, 0, 0, 0]

        return Image.fromarray(arr)
    except ImportError:
        # scipy not available — fall back to simple bbox trim
        return img


def standardize_sprite(input_path, output_path=None, base_width=TARGET_BASE_WIDTH):
    """Remove watermark, trim transparent padding, and resize to standard width.

    Args:
        input_path: Path to clean (transparent bg) sprite PNG.
        output_path: Where to save. If None, overwrites input.
        base_width: Target width in pixels.

    Returns:
        True on success, False on failure.
    """
    if output_path is None:
        output_path = input_path

    try:
        img = Image.open(input_path).convert("RGBA")

        # Remove watermark (keeps largest connected component only)
        img = _remove_watermark(img)

        # Trim transparent padding
        bbox = img.getbbox()
        if bbox is None:
            print(f"  ✗ Empty image (no visible pixels): {input_path}")
            return False

        trimmed = img.crop(bbox)

        # Scale to target width, preserving aspect ratio
        w, h = trimmed.size
        if w > 0:
            scale = base_width / w
            new_w = base_width
            new_h = max(1, int(h * scale))
            resized = trimmed.resize((new_w, new_h), Image.LANCZOS)
        else:
            resized = trimmed

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        resized.save(str(output_path))
        return True
    except Exception as e:
        print(f"  ✗ Resize failed: {e}")
        return False
