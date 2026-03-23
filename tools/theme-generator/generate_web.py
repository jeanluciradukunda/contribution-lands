"""
Contribution Lands — Free Sprite Generator (Gemini Web API)
============================================================
Generates isometric sprites using the Gemini web app's free quota
via reverse-engineered API. No billing required.

This uses your browser cookies to authenticate with gemini.google.com,
which has its own free image generation quota separate from the paid API.

Setup:
  cd tools/theme-generator
  source .venv/bin/activate
  pip install -r requirements.txt  # includes gemini_webapi[browser]

  # Make sure you're logged into gemini.google.com in Chrome/Firefox first!

Usage:
  python generate_web.py city-nyc              # Generate one theme
  python generate_web.py city-nyc --level 4    # Generate one level
  python generate_web.py --list                # List available themes
  python generate_web.py --cookies             # Manual cookie entry

How it works:
  1. Reads your browser cookies from Chrome/Firefox automatically
  2. Sends prompts to gemini.google.com (same as typing in the web UI)
  3. Downloads generated images
  4. Removes green chroma key background
  5. Trims and resizes to standard dimensions
  6. Saves final sprites to themes/{name}/sprites/

Rate limits:
  The Gemini web app has its own daily quota (separate from the API).
  Exact limits vary but are typically generous for personal use.
  The script adds delays between requests to be respectful.
"""

import asyncio
import argparse
import sys
import time
from pathlib import Path

# ============================================================
#  CONFIG
# ============================================================

THEMES_OUTPUT_DIR = Path(__file__).parent.parent.parent / "themes"
RAW_CACHE_DIR = Path(__file__).parent / ".cache" / "web-raw"
DELAY_BETWEEN_REQUESTS = 5  # seconds — be respectful of free quota

# ============================================================
#  IMPORTS (after path setup)
# ============================================================

from prompts import THEMES, get_prompt_for
from prompts.registry import THEME_NAMES
from processing.background import remove_green_background
from processing.resize import standardize_sprite


# ============================================================
#  GEMINI WEB CLIENT
# ============================================================

async def create_client(cookies=None):
    """Create and initialize a Gemini web API client.

    Args:
        cookies: Tuple of (Secure_1PSID, Secure_1PSIDTS) or None for auto-detect.

    Returns:
        Initialized GeminiClient.
    """
    from gemini_webapi import GeminiClient

    if cookies:
        psid, psidts = cookies
        client = GeminiClient(psid, psidts)
    else:
        # Auto-detect cookies from browser
        print("  Auto-detecting browser cookies...")
        client = GeminiClient()

    await client.init(timeout=60, auto_close=False, close_delay=300, auto_refresh=True)
    print("  ✓ Connected to Gemini web app")
    return client


async def generate_sprite_web(client, prompt, raw_path, retries=3):
    """Generate a sprite via the Gemini web app and save the image.

    Args:
        client: Initialized GeminiClient.
        prompt: Full generation prompt.
        raw_path: Where to save the raw generated image.
        retries: Number of retry attempts.

    Returns:
        True on success, False on failure.
    """
    for attempt in range(retries):
        try:
            print(f"  Generating: {raw_path.name} (attempt {attempt + 1})")
            response = await client.generate_content(prompt)

            if response.images and len(response.images) > 0:
                raw_path.parent.mkdir(parents=True, exist_ok=True)
                # Save the first generated image
                await response.images[0].save(
                    path=str(raw_path.parent),
                    filename=raw_path.name,
                    verbose=False,
                )
                print(f"  ✓ Downloaded: {raw_path.name}")
                return True
            else:
                print(f"  ✗ No images in response")
                # Check if there's text explaining why
                if response.text:
                    snippet = response.text[:200]
                    print(f"    Response: {snippet}")

        except Exception as e:
            print(f"  ✗ Error: {e}")
            if attempt < retries - 1:
                wait = DELAY_BETWEEN_REQUESTS * (attempt + 1)
                print(f"    Retrying in {wait}s...")
                await asyncio.sleep(wait)

    print(f"  ✗✗ FAILED after {retries} attempts: {raw_path.name}")
    return False


# ============================================================
#  PIPELINE
# ============================================================

async def process_theme(client, theme_name, target_level=None):
    """Generate all sprites for a theme via Gemini web app.

    Pipeline: generate → download → remove bg → resize → save
    """
    theme = THEMES.get(theme_name)
    if not theme:
        print(f"ERROR: Unknown theme '{theme_name}'")
        return 0, 0, []

    # Version the output: AI-generated sprites go into a 'v2-gemini' subdirectory
    # alongside the existing 'sprites' (v1-programmatic)
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

            # Skip if final output exists
            if final_path.exists():
                print(f"  → Skipping {filename} (already exists)")
                continue

            total += 1
            full_prompt, _ = get_prompt_for(theme_name, level, variant_idx)

            # Step 1: Generate via web app
            if not await generate_sprite_web(client, full_prompt, raw_path):
                failed.append(filename)
                await asyncio.sleep(DELAY_BETWEEN_REQUESTS)
                continue

            # Step 2: Remove green background
            clean_path = raw_dir / f"{Path(filename).stem}_clean.png"
            if not remove_green_background(raw_path, clean_path):
                failed.append(filename)
                await asyncio.sleep(DELAY_BETWEEN_REQUESTS)
                continue

            # Step 3: Trim and resize
            if not standardize_sprite(clean_path, final_path):
                failed.append(filename)
                await asyncio.sleep(DELAY_BETWEEN_REQUESTS)
                continue

            success += 1
            print(f"  ✓ Complete: {theme_name}/{filename}")
            await asyncio.sleep(DELAY_BETWEEN_REQUESTS)

    return total, success, failed


# ============================================================
#  CLI
# ============================================================

async def async_main():
    parser = argparse.ArgumentParser(
        description="Contribution Lands — Free Sprite Generator (Gemini Web)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python generate_web.py city-nyc              # Generate NYC theme\n"
            "  python generate_web.py city-nyc --level 4    # Just level 4\n"
            "  python generate_web.py --list                # List themes\n"
            "  python generate_web.py city-nyc --cookies    # Enter cookies manually\n"
            "\n"
            "Prerequisites:\n"
            "  1. Log into gemini.google.com in Chrome or Firefox\n"
            "  2. pip install gemini_webapi[browser]\n"
            "  3. Run this script — cookies are auto-detected from your browser\n"
        ),
    )
    parser.add_argument("theme", nargs="?", help="Theme to generate")
    parser.add_argument("--level", type=int, help="Generate only this level (0-4)")
    parser.add_argument("--list", action="store_true", help="List available themes")
    parser.add_argument("--cookies", action="store_true",
                        help="Manually enter cookie values instead of auto-detect")
    parser.add_argument("--delay", type=int, default=DELAY_BETWEEN_REQUESTS,
                        help=f"Seconds between requests (default: {DELAY_BETWEEN_REQUESTS})")
    args = parser.parse_args()

    if args.list:
        print("Available themes:")
        for name in THEME_NAMES:
            levels = THEMES[name]["levels"]
            sprite_count = sum(len(v) for v in levels.values())
            has_sprites = (THEMES_OUTPUT_DIR / name / "sprites").exists()
            status = "✓" if has_sprites and list((THEMES_OUTPUT_DIR / name / "sprites").glob("level-*.png")) else "·"
            print(f"  {status} {name:20s} ({sprite_count} sprites)")
        return

    if not args.theme:
        parser.print_help()
        print("\nERROR: Specify a theme name (or --list to see options)")
        sys.exit(1)

    # Update module-level delay
    import generate_web
    generate_web.DELAY_BETWEEN_REQUESTS = args.delay

    # Get cookies
    cookies = None
    if args.cookies:
        print("\nManual cookie entry:")
        print("  1. Go to gemini.google.com in Chrome")
        print("  2. Open DevTools (F12) → Application → Cookies")
        print("  3. Copy the values for these cookies:\n")
        psid = input("  __Secure-1PSID: ").strip()
        psidts = input("  __Secure-1PSIDTS: ").strip()
        cookies = (psid, psidts)

    print(f"\n{'='*60}")
    print(f"  Contribution Lands — Free Sprite Generator")
    print(f"  Method: Gemini Web App (gemini.google.com)")
    print(f"  Theme: {args.theme}")
    print(f"  Delay: {DELAY_BETWEEN_REQUESTS}s between requests")
    print(f"  Output: {THEMES_OUTPUT_DIR / args.theme / 'sprites'}")
    print(f"{'='*60}\n")

    # Connect
    try:
        client = await create_client(cookies)
    except Exception as e:
        print(f"\nERROR: Could not connect to Gemini web app: {e}")
        print("\nTroubleshooting:")
        print("  1. Make sure you're logged into gemini.google.com in Chrome/Firefox")
        print("  2. Try --cookies flag to enter cookies manually")
        print("  3. Clear browser cookies and re-login to gemini.google.com")
        sys.exit(1)

    # Generate
    theme_names = [args.theme]

    grand_total = 0
    grand_success = 0
    all_failed = []

    for theme_name in theme_names:
        print(f"\n▸ Theme: {theme_name}")
        print(f"  {'─'*40}")

        total, success, failed = await process_theme(client, theme_name, args.level)
        grand_total += total
        grand_success += success
        all_failed.extend([(theme_name, f) for f in failed])
        print(f"\n  Result: {success}/{total} generated")

    # Summary
    print(f"\n{'='*60}")
    print(f"  COMPLETE: {grand_success}/{grand_total} sprites generated")
    if all_failed:
        print(f"  FAILED ({len(all_failed)}):")
        for theme, name in all_failed:
            print(f"    - {theme}/{name}")
    print(f"  Output: {THEMES_OUTPUT_DIR}")
    print(f"{'='*60}\n")


def main():
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
