"""Central configuration for sprite validation thresholds and path conventions."""

from pathlib import Path
import sys

# Add project root to path so we can import from scripts
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from generate_sprites import THEMES, OUTPUT_DIR  # noqa: E402

# ============================================================
#  THEME REGISTRY
# ============================================================

THEME_NAMES = list(THEMES.keys())
LEVELS = [0, 1, 2, 3, 4]
VARIANTS = ["a", "b", "c"]
SPRITE_FILENAME_PATTERN = "level-{level}-{variant}.png"

# ============================================================
#  QUALITY THRESHOLDS (Raw sprites)
# ============================================================

# Green background coverage in raw images
MIN_GREEN_RATIO = 0.35  # At least 35% should be chroma green bg
MAX_GREEN_RATIO = 0.98  # If >98% green, no object was generated

# Object presence
MIN_OBJECT_RATIO = 0.02  # At least 2% of pixels should be the object

# Object centering (normalized offset from image center)
MAX_CENTER_OFFSET = 0.30  # Object center within 30% of image center

# Image dimensions
MIN_DIMENSION = 128  # Minimum width or height
MAX_DIMENSION = 4096  # Sanity upper bound

# Aspect ratio
MIN_ASPECT_RATIO = 0.5  # Not too narrow
MAX_ASPECT_RATIO = 2.0  # Not too wide

# ============================================================
#  POST-PROCESSING THRESHOLDS (Clean sprites)
# ============================================================

# Transparency after background removal
MIN_TRANSPARENCY_RATIO = 0.25  # >25% of pixels should be transparent

# Green fringing at object edges
MAX_GREEN_FRINGE_RATIO = 0.03  # <3% of edge pixels can be green

# Object integrity (clean vs raw pixel count comparison)
MAX_OBJECT_LOSS_RATIO = 0.20  # Object pixels shouldn't shrink >20%

# ============================================================
#  CONSISTENCY THRESHOLDS (Cross-sprite)
# ============================================================

# Scale progression: level N+1 avg height >= level N avg height * this factor
SCALE_TOLERANCE = 0.75

# Color palette: max Jensen-Shannon divergence between sprites in same theme
MAX_COLOR_DIVERGENCE = 0.6

# Style: min grayscale histogram correlation
MIN_STYLE_CORRELATION = 0.2

# ============================================================
#  PATH HELPERS
# ============================================================

SPRITES_DIR = OUTPUT_DIR


def raw_path(sprites_dir, theme, level, variant):
    """Get path to a raw sprite."""
    return Path(sprites_dir) / theme / "raw" / f"level-{level}-{variant}.png"


def clean_path(sprites_dir, theme, level, variant):
    """Get path to a cleaned sprite."""
    return Path(sprites_dir) / theme / "clean" / f"level-{level}-{variant}.png"


def discover_raw_sprites(sprites_dir=None):
    """Find all raw sprite PNGs."""
    d = Path(sprites_dir) if sprites_dir else SPRITES_DIR
    return sorted(d.glob("*/raw/level-*.png"))


def discover_clean_sprites(sprites_dir=None):
    """Find all cleaned sprite PNGs."""
    d = Path(sprites_dir) if sprites_dir else SPRITES_DIR
    return sorted(d.glob("*/clean/level-*.png"))


def parse_sprite_filename(path):
    """Parse 'level-2-b.png' into (level=2, variant='b')."""
    stem = Path(path).stem  # 'level-2-b'
    parts = stem.split("-")
    if len(parts) == 3 and parts[0] == "level":
        return int(parts[1]), parts[2]
    return None, None


def get_theme_from_path(path):
    """Extract theme name from sprite path like .../forest-summer/raw/level-1-a.png"""
    path = Path(path)
    # Parent is 'raw' or 'clean', parent.parent is the theme dir
    return path.parent.parent.name
