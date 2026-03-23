"""Layer 4: Cross-theme completeness validation."""

import json
import pytest
from pathlib import Path
from validation.config import THEME_NAMES, SPRITES_DIR, LEVELS
from validation.theme_analyzer import check_completeness


def test_sprites_directory_exists():
    """The sprites output directory should exist."""
    assert SPRITES_DIR.exists(), f"Sprites directory not found: {SPRITES_DIR}"


@pytest.mark.parametrize("theme_name", THEME_NAMES)
def test_theme_directory_exists(theme_name):
    """Each theme should have a directory."""
    theme_dir = SPRITES_DIR / theme_name
    if not theme_dir.exists():
        pytest.skip(f"Theme {theme_name} not generated yet")
    assert (theme_dir / "clean").exists(), f"Missing clean/ subdirectory for {theme_name}"


def test_completeness_report():
    """Check overall completeness and report missing sprites."""
    if not SPRITES_DIR.exists():
        pytest.skip("No sprites generated yet")

    results = check_completeness(SPRITES_DIR)

    all_missing = []
    for theme_name, info in results.items():
        for missing in info["missing"]:
            all_missing.append(f"{theme_name}/{missing}")

    if all_missing:
        # Warn but don't fail — incomplete generation is expected during development
        import warnings
        warnings.warn(
            f"Missing {len(all_missing)} sprites:\n  " + "\n  ".join(all_missing[:20])
        )


def test_manifest_matches_disk():
    """manifest.json should reflect what's actually on disk."""
    manifest_path = SPRITES_DIR / "manifest.json"
    if not manifest_path.exists():
        pytest.skip("No manifest.json found")

    with open(manifest_path) as f:
        manifest = json.load(f)

    mismatches = []
    for theme_name, listed_files in manifest.items():
        clean_dir = SPRITES_DIR / theme_name / "clean"
        if not clean_dir.exists():
            mismatches.append(f"{theme_name}: directory missing but listed in manifest")
            continue

        actual_files = sorted([f.name for f in clean_dir.glob("*.png")])
        listed_sorted = sorted(listed_files)

        if actual_files != listed_sorted:
            in_manifest_only = set(listed_sorted) - set(actual_files)
            on_disk_only = set(actual_files) - set(listed_sorted)
            if in_manifest_only:
                mismatches.append(f"{theme_name}: in manifest but not on disk: {in_manifest_only}")
            if on_disk_only:
                mismatches.append(f"{theme_name}: on disk but not in manifest: {on_disk_only}")

    assert not mismatches, "Manifest/disk mismatches:\n  " + "\n  ".join(mismatches)
