"""Regenerate failed sprites from redo_list.json.

Usage:
  python regenerate.py                        # Use default redo_list.json
  python regenerate.py path/to/redo_list.json # Custom redo list
"""

import os
import sys
import time
from pathlib import Path

from google import genai

from generate import generate_sprite, DELAY_BETWEEN_REQUESTS, THEMES_OUTPUT_DIR, RAW_CACHE_DIR
from prompts import get_prompt_for
from processing.background import remove_green_background
from processing.resize import standardize_sprite
from validation.redo import read_redo_list


def main():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: Set GOOGLE_API_KEY environment variable.")
        sys.exit(1)

    redo_path = sys.argv[1] if len(sys.argv) > 1 else THEMES_OUTPUT_DIR / "redo_list.json"
    redo_list = read_redo_list(redo_path)

    if not redo_list:
        print("No sprites to regenerate.")
        return

    client = genai.Client(api_key=api_key)

    print(f"\n{'='*60}")
    print(f"  Contribution Lands — Sprite Regenerator")
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

        full_prompt, _ = get_prompt_for(theme, level, variant_idx)
        if not full_prompt:
            print(f"  ✗ No prompt found")
            failed += 1
            continue

        filename = f"level-{level}-{variant}.png"
        final_path = THEMES_OUTPUT_DIR / theme / "sprites" / filename
        raw_path = RAW_CACHE_DIR / theme / filename

        # Delete old files
        for p in [final_path, raw_path]:
            if p.exists():
                p.unlink()

        # Regenerate: generate → clean → resize
        raw_path.parent.mkdir(parents=True, exist_ok=True)
        if not generate_sprite(client, full_prompt, raw_path):
            failed += 1
            time.sleep(DELAY_BETWEEN_REQUESTS)
            continue

        clean_path = RAW_CACHE_DIR / theme / f"level-{level}-{variant}_clean.png"
        if not remove_green_background(raw_path, clean_path):
            failed += 1
            time.sleep(DELAY_BETWEEN_REQUESTS)
            continue

        if not standardize_sprite(clean_path, final_path):
            failed += 1
            time.sleep(DELAY_BETWEEN_REQUESTS)
            continue

        print(f"  ✓ Regenerated successfully")
        success += 1
        time.sleep(DELAY_BETWEEN_REQUESTS)

    print(f"\n{'='*60}")
    print(f"  DONE: {success} regenerated, {failed} failed")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
