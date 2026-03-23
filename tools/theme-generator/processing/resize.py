"""Standardize sprite dimensions for the extension grid."""

from pathlib import Path
from PIL import Image


# Target base width for sprites in the contribution grid.
# Height varies per level (taller = more contributions).
TARGET_BASE_WIDTH = 64


def standardize_sprite(input_path, output_path=None, base_width=TARGET_BASE_WIDTH):
    """Trim whitespace and resize sprite to a standard base width.

    Maintains aspect ratio. Trims transparent padding first, then scales
    so the object fits within the target width.

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
