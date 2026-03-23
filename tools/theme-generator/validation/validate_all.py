"""CLI entry point: run full validation suite and generate HTML report.

Usage:
  python -m validation.validate_all                          # validate + report
  python -m validation.validate_all --redo                   # also write redo_list.json
  python -m validation.validate_all --sprites-dir ./sprites  # custom paths
"""

import argparse
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from validation import config as cfg
from validation.sprite_analyzer import analyze_raw_sprite, analyze_clean_sprite
from validation.theme_analyzer import check_scale_progression, check_color_consistency, check_completeness
from validation.report import generate_report
from validation.redo import collect_failures, write_redo_list


def main():
    parser = argparse.ArgumentParser(description="Contribution Lands Sprite Validation")
    parser.add_argument("--sprites-dir", default=str(cfg.SPRITES_DIR), help="Sprites directory")
    parser.add_argument("--report-dir", default=None, help="Report output directory")
    parser.add_argument("--redo", action="store_true", help="Write redo_list.json for failed sprites")
    parser.add_argument("--thumbnail-size", type=int, default=128, help="Thumbnail size in report")
    args = parser.parse_args()

    sprites_dir = Path(args.sprites_dir)
    report_dir = Path(args.report_dir) if args.report_dir else sprites_dir.parent / "reports"

    if not sprites_dir.exists():
        print(f"ERROR: Sprites directory not found: {sprites_dir}")
        print("Run generate.py first.")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  Contribution Lands Sprite Validation")
    print(f"  Sprites: {sprites_dir}")
    print(f"{'='*60}\n")

    # Layer 2: Individual sprite quality
    print("▸ Checking individual sprite quality...")
    raw_sprites = cfg.discover_raw_sprites(sprites_dir)
    clean_sprites = cfg.discover_clean_sprites(sprites_dir)

    raw_pass, raw_fail = 0, 0
    for path in raw_sprites:
        result = analyze_raw_sprite(path)
        if result.passed:
            raw_pass += 1
        else:
            raw_fail += 1
            print(f"  ✗ {cfg.get_theme_from_path(path)}/{path.name}: {', '.join(result.failures)}")

    clean_pass, clean_fail = 0, 0
    for path in clean_sprites:
        result = analyze_clean_sprite(path)
        if result.passed:
            clean_pass += 1
        else:
            clean_fail += 1
            print(f"  ✗ {cfg.get_theme_from_path(path)}/{path.name}: {', '.join(result.failures)}")

    print(f"  Raw: {raw_pass} pass, {raw_fail} fail ({len(raw_sprites)} total)")
    print(f"  Clean: {clean_pass} pass, {clean_fail} fail ({len(clean_sprites)} total)")

    # Layer 3: Theme consistency
    print("\n▸ Checking theme consistency...")
    for theme_name in cfg.THEME_NAMES:
        theme_dir = sprites_dir / theme_name
        if not theme_dir.exists():
            continue

        scale = check_scale_progression(theme_dir)
        if scale["violations"]:
            print(f"  ✗ {theme_name} scale: {scale['violations']}")
        else:
            print(f"  ✓ {theme_name} scale progression OK")

        color = check_color_consistency(theme_dir)
        if color.get("outliers"):
            print(f"  ✗ {theme_name} color outliers: {color['outliers']}")

    # Layer 4: Completeness
    print("\n▸ Checking completeness...")
    completeness = check_completeness(sprites_dir)
    for theme_name, info in completeness.items():
        if info["missing"]:
            print(f"  ✗ {theme_name}: missing {len(info['missing'])} sprites")
        else:
            print(f"  ✓ {theme_name}: complete ({len(info['present'])} sprites)")

    # Generate HTML report
    print("\n▸ Generating HTML report...")
    report_path = generate_report(
        sprites_dir=sprites_dir,
        output_path=report_dir / "validation_report.html",
        thumbnail_size=args.thumbnail_size,
    )

    # Redo list
    if args.redo:
        print("\n▸ Collecting failures for redo list...")
        failures = collect_failures(sprites_dir)
        if failures:
            redo_path = write_redo_list(failures, sprites_dir / "redo_list.json")
            print(f"  {len(failures)} sprites need regeneration")
        else:
            print("  No failures — nothing to redo!")

    # Summary
    total_sprites = len(raw_sprites) + len(clean_sprites)
    total_fail = raw_fail + clean_fail
    print(f"\n{'='*60}")
    print(f"  DONE: {total_sprites} sprites checked, {total_fail} failures")
    print(f"  Report: {report_path}")
    print(f"{'='*60}\n")

    sys.exit(1 if total_fail > 0 else 0)


if __name__ == "__main__":
    main()
