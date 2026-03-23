"""
Contribution Lands — Theme Generator
=====================================
Generates isometric sprite assets for themes using the Gemini API (Nano Banana).
Free tier: ~500 images/day. Full generation needs ~91 sprites.

Setup:
  cd tools/theme-generator
  python -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt
  export GOOGLE_API_KEY="your-key-from-aistudio.google.com"

Usage:
  python generate.py                          # Generate all themes
  python generate.py forest-summer            # Generate one theme
  python generate.py forest-summer --level 3  # Generate one level
  python generate.py --list                   # List available themes
"""

import os
import sys
import time
import argparse
from pathlib import Path

from google import genai
from google.genai import types

from prompts import THEMES, get_prompt_for
from prompts.registry import THEME_NAMES
from processing.background import remove_green_background
from processing.resize import standardize_sprite

# ============================================================
#  CONFIG
# ============================================================

MODEL = "gemini-2.5-flash-image"  # Free tier (~500 images/day)
DELAY_BETWEEN_REQUESTS = 3  # seconds
THEMES_OUTPUT_DIR = Path(__file__).parent.parent.parent / "themes"
RAW_CACHE_DIR = Path(__file__).parent / ".cache" / "raw"  # Intermediate raw files


# ============================================================
#  GENERATION
# ============================================================

def generate_sprite(client, full_prompt, output_path, retries=3):
    """Generate a single sprite image via Gemini API and save it."""
    for attempt in range(retries):
        try:
            print(f"  Generating: {output_path.name} (attempt {attempt + 1})")
            response = client.models.generate_content(
                model=MODEL,
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                ),
            )

            for part in response.parts:
                if part.inline_data is not None:
                    image = part.as_image()
                    output_path.parent.mkdir(parents=True, exist_ok=True)
                    image.save(str(output_path))
                    print(f"  ✓ Saved: {output_path}")
                    return True

            print(f"  ✗ No image in response, retrying...")

        except Exception as e:
            print(f"  ✗ Error: {e}")
            if attempt < retries - 1:
                wait = DELAY_BETWEEN_REQUESTS * (attempt + 1)
                print(f"    Waiting {wait}s before retry...")
                time.sleep(wait)

    print(f"  ✗✗ FAILED after {retries} attempts: {output_path.name}")
    return False


def process_theme(client, theme_name, target_level=None):
    """Generate all sprites for a theme: generate -> clean -> resize -> output."""
    theme = THEMES.get(theme_name)
    if not theme:
        print(f"ERROR: Unknown theme '{theme_name}'")
        return 0, 0, []

    sprites_out = THEMES_OUTPUT_DIR / theme_name / "sprites"
    sprites_out.mkdir(parents=True, exist_ok=True)

    raw_dir = RAW_CACHE_DIR / theme_name
    raw_dir.mkdir(parents=True, exist_ok=True)

    total = 0
    success = 0
    failed = []

    for level, prompts in theme["levels"].items():
        if target_level is not None and level != target_level:
            continue

        for variant_idx, prompt_text in enumerate(prompts):
            variant = chr(97 + variant_idx)
            filename = f"level-{level}-{variant}.png"
            final_path = sprites_out / filename
            raw_path = raw_dir / filename

            if final_path.exists():
                print(f"  → Skipping {filename} (already exists)")
                continue

            total += 1

            # Step 1: Generate raw sprite
            full_prompt, _ = get_prompt_for(theme_name, level, variant_idx)
            if not generate_sprite(client, full_prompt, raw_path):
                failed.append(filename)
                time.sleep(DELAY_BETWEEN_REQUESTS)
                continue

            # Step 2: Remove green background
            clean_path = raw_dir / f"{Path(filename).stem}_clean.png"
            if not remove_green_background(raw_path, clean_path):
                failed.append(filename)
                time.sleep(DELAY_BETWEEN_REQUESTS)
                continue

            # Step 3: Trim and resize
            if not standardize_sprite(clean_path, final_path):
                failed.append(filename)
                time.sleep(DELAY_BETWEEN_REQUESTS)
                continue

            success += 1
            print(f"  ✓ Complete: {theme_name}/{filename}")
            time.sleep(DELAY_BETWEEN_REQUESTS)

    return total, success, failed


def main():
    parser = argparse.ArgumentParser(
        description="Contribution Lands Theme Generator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n"
               "  python generate.py                       # All themes\n"
               "  python generate.py forest-summer          # One theme\n"
               "  python generate.py city-nyc --level 4     # Specific level\n"
               "  python generate.py --list                 # List themes\n",
    )
    parser.add_argument("theme", nargs="?", help="Theme to generate (omit for all)")
    parser.add_argument("--level", type=int, help="Generate only this level (0-4)")
    parser.add_argument("--list", action="store_true", help="List available themes")
    args = parser.parse_args()

    if args.list:
        print("Available themes:")
        for name in THEME_NAMES:
            levels = THEMES[name]["levels"]
            sprite_count = sum(len(v) for v in levels.values())
            print(f"  {name:20s} ({sprite_count} sprites)")
        return

    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: Set your GOOGLE_API_KEY environment variable.")
        print("Get one free at: https://aistudio.google.com/apikey")
        sys.exit(1)

    client = genai.Client(api_key=api_key)
    theme_names = [args.theme] if args.theme else THEME_NAMES

    print(f"\n{'='*60}")
    print(f"  Contribution Lands — Theme Generator")
    print(f"  Model: {MODEL}")
    print(f"  Themes: {', '.join(theme_names)}")
    print(f"  Output: {THEMES_OUTPUT_DIR}")
    print(f"{'='*60}\n")

    grand_total = 0
    grand_success = 0
    all_failed = []

    for theme_name in theme_names:
        print(f"\n▸ Theme: {theme_name}")
        print(f"  {'─'*40}")

        total, success, failed = process_theme(client, theme_name, args.level)
        grand_total += total
        grand_success += success
        all_failed.extend([(theme_name, f) for f in failed])
        print(f"\n  Result: {success}/{total} generated")

    print(f"\n{'='*60}")
    print(f"  COMPLETE: {grand_success}/{grand_total} sprites generated")
    if all_failed:
        print(f"  FAILED ({len(all_failed)}):")
        for theme, name in all_failed:
            print(f"    - {theme}/{name}")
    print(f"  Output: {THEMES_OUTPUT_DIR}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
