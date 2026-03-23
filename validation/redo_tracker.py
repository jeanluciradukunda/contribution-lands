"""Track failed sprites and generate redo lists for regeneration."""

import json
from pathlib import Path

from . import config as cfg
from .sprite_analyzer import analyze_raw_sprite, analyze_clean_sprite


def collect_failures(sprites_dir=None):
    """Scan all sprites and collect failures.

    Returns list of dicts: [{"theme", "level", "variant", "reasons"}]
    """
    sprites_dir = Path(sprites_dir) if sprites_dir else cfg.SPRITES_DIR
    failures = []

    for theme_name in cfg.THEME_NAMES:
        for level in cfg.LEVELS:
            for variant in cfg.VARIANTS:
                raw_p = cfg.raw_path(sprites_dir, theme_name, level, variant)
                clean_p = cfg.clean_path(sprites_dir, theme_name, level, variant)

                reasons = []

                if raw_p.exists():
                    raw_result = analyze_raw_sprite(raw_p)
                    reasons.extend(raw_result.failures)

                if clean_p.exists():
                    clean_result = analyze_clean_sprite(clean_p, raw_path=raw_p)
                    reasons.extend(clean_result.failures)
                elif raw_p.exists():
                    reasons.append("clean_missing")

                if reasons:
                    failures.append({
                        "theme": theme_name,
                        "level": level,
                        "variant": variant,
                        "reasons": reasons,
                    })

    return failures


def write_redo_list(failures, output_path=None):
    """Write redo_list.json from collected failures."""
    if output_path is None:
        output_path = cfg.SPRITES_DIR / "redo_list.json"

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        json.dump(failures, f, indent=2)

    print(f"Redo list saved: {output_path} ({len(failures)} sprites to regenerate)")
    return output_path


def read_redo_list(path=None):
    """Read redo_list.json."""
    if path is None:
        path = cfg.SPRITES_DIR / "redo_list.json"
    path = Path(path)
    if not path.exists():
        return []
    with open(path) as f:
        return json.load(f)
