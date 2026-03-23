"""Regenerate failed sprites from redo_list.json.

Usage:
  python scripts/regenerate.py                        # Use default redo_list.json
  python scripts/regenerate.py path/to/redo_list.json # Custom redo list
"""

import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from google import genai
from scripts.generate_sprites import (
    THEMES, BASE_SUFFIX, MODEL, OUTPUT_DIR, DELAY_BETWEEN_REQUESTS,
    generate_sprite, remove_green_background, get_prompt_for,
)
from validation.redo_tracker import read_redo_list


def main():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: Set GOOGLE_API_KEY environment variable.")
        sys.exit(1)

    redo_path = sys.argv[1] if len(sys.argv) > 1 else OUTPUT_DIR / "redo_list.json"
    redo_list = read_redo_list(redo_path)

    if not redo_list:
        print("No sprites to regenerate.")
        return

    client = genai.Client(api_key=api_key)

    print(f"\n{'='*60}")
    print(f"  Contribution Lands Sprite Regenerator")
    print(f"  Sprites to redo: {len(redo_list)}")
    print(f"{'='*60}\n")

    success = 0
    failed = 0

    for entry in redo_list:
        theme = entry["theme"]
        level = entry["level"]
        variant = entry["variant"]
        variant_idx = ord(variant) - ord("a")
        reasons = entry.get("reasons", [])

        print(f"▸ {theme}/level-{level}-{variant} (was: {', '.join(reasons)})")

        # Get the prompt
        full_prompt, lighting = get_prompt_for(theme, level, variant_idx)
        if not full_prompt:
            print(f"  ✗ No prompt found for {theme} level {level} variant {variant_idx}")
            failed += 1
            continue

        # Delete old files
        raw_p = OUTPUT_DIR / theme / "raw" / f"level-{level}-{variant}.png"
        clean_p = OUTPUT_DIR / theme / "clean" / f"level-{level}-{variant}.png"
        if raw_p.exists():
            raw_p.unlink()
        if clean_p.exists():
            clean_p.unlink()

        # Regenerate
        raw_p.parent.mkdir(parents=True, exist_ok=True)
        if generate_sprite(client, full_prompt, raw_p):
            clean_p.parent.mkdir(parents=True, exist_ok=True)
            if remove_green_background(raw_p, clean_p):
                print(f"  ✓ Regenerated successfully")
                success += 1
            else:
                print(f"  ✗ Background removal failed")
                failed += 1
        else:
            print(f"  ✗ Generation failed")
            failed += 1

        time.sleep(DELAY_BETWEEN_REQUESTS)

    print(f"\n{'='*60}")
    print(f"  DONE: {success} regenerated, {failed} failed")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
