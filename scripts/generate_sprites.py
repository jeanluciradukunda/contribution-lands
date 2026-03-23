"""
Contribution Lands Sprite Generator
=========================
Generates all isometric sprites using the Gemini API (Nano Banana).
Free tier: ~500 images/day. We need ~150-250 total.

Setup:
  pip install google-genai Pillow
  export GOOGLE_API_KEY="your-api-key-from-aistudio.google.com"

Usage:
  python generate_sprites.py                    # Generate all themes
  python generate_sprites.py forest-summer      # Generate one theme
  python generate_sprites.py forest-summer 3    # Generate one level
"""

import os
import sys
import time
import json
from pathlib import Path
from google import genai
from google.genai import types
from PIL import Image
import numpy as np

# ============================================================
#  CONFIG
# ============================================================

MODEL = "gemini-2.5-flash-image"  # Free tier Nano Banana (~500 images/day)
# Alternative models:
# MODEL = "gemini-3.1-flash-image-preview"  # Nano Banana 2
# MODEL = "gemini-3-pro-image-preview"      # Nano Banana Pro (limited free)

VARIANTS_PER_LEVEL = 3
OUTPUT_DIR = Path(__file__).parent.parent / "sprites"
DELAY_BETWEEN_REQUESTS = 3  # seconds, to respect rate limits

# ============================================================
#  PROMPT TEMPLATES
# ============================================================

BASE_SUFFIX = """Low-poly 3D render, clean colors, {lighting} from top-left, \
SimCity 2000 / RollerCoaster Tycoon game asset style. \
Single isolated object centered on solid #00FF00 chroma green background. \
White 2px outline around the object. No ground shadow. No text. No labels. \
Strict isometric projection, 2:1 pixel ratio."""

THEMES = {
    "forest-summer": {
        "lighting": "warm summer lighting",
        "levels": {
            0: [
                "A small square patch of lush green grass with a few tiny wildflowers and small stones. Flat ground tile, no trees, no tall objects.",
            ],
            1: [
                "A tiny young sapling tree, very small, only about 1 foot tall, thin stem with a few small green leaves. Planted in a small patch of grass.",
                "A small green bush, round and compact, about 2 feet tall, sitting on a tiny grass patch.",
                "A very young small pine seedling, about 1.5 feet tall, thin trunk with sparse tiny branches. On a small grass patch.",
            ],
            2: [
                "A young birch tree, about 8 feet tall, slender white trunk with light green leafy canopy. On a small grass patch.",
                "A young pine tree, about 8 feet tall, classic conical Christmas tree shape, dark green needles. On a small grass patch.",
                "A young maple tree, about 10 feet tall, medium-sized green canopy, visible brown trunk. On a small grass patch.",
            ],
            3: [
                "A mature oak tree, about 25 feet tall, thick brown trunk, wide spreading green canopy with dense foliage. On a small grass patch.",
                "A tall mature pine tree, about 30 feet tall, straight trunk, layered green needle branches. On a small grass patch.",
                "A mature elm tree, about 25 feet tall, elegant vase-shaped canopy, rich green leaves, thick trunk. On a small grass patch.",
            ],
            4: [
                "A giant ancient redwood tree, towering about 50 feet tall, massive thick trunk with visible bark texture, enormous dense dark green canopy. On a small grass patch with exposed roots.",
                "A colossal ancient oak tree, about 45 feet tall, gnarled thick trunk, massive sprawling dark green canopy that dominates the scene. On a small grass patch.",
                "A towering ancient sequoia tree, about 55 feet tall, enormously wide trunk, dense evergreen canopy reaching high. On a small grass patch with mossy rocks.",
            ],
        },
    },
    "forest-autumn": {
        "lighting": "warm golden autumn lighting",
        "levels": {
            0: [
                "A small square patch of grass with fallen autumn leaves in orange and brown, a few small stones. Flat ground tile, autumn atmosphere.",
            ],
            1: [
                "A tiny young sapling tree with orange-gold autumn leaves, very small, about 1 foot tall. On a grass patch with fallen leaves.",
                "A small bush with autumn colored leaves in red and orange, about 2 feet tall. On a grass patch with fallen leaves.",
                "A very young small pine seedling, about 1.5 feet tall, dark green needles. On a grass patch with fallen autumn leaves.",
            ],
            2: [
                "A young birch tree, about 8 feet tall, slender white trunk with golden yellow autumn leaves. Fallen leaves on grass below.",
                "A young pine tree, about 8 feet tall, conical shape, dark green needles among autumn colored surroundings. Fallen leaves on grass.",
                "A young maple tree, about 10 feet tall, brilliant red and orange autumn foliage. Fallen leaves on grass below.",
            ],
            3: [
                "A mature oak tree, about 25 feet tall, thick trunk, wide canopy with dense autumn foliage in orange, red, gold, and brown. Fallen leaves on grass.",
                "A tall mature pine tree, about 30 feet tall, straight trunk, green needles among autumn surroundings. Fallen leaves on grass.",
                "A mature maple tree, about 25 feet tall, spectacular brilliant red and orange autumn canopy. Fallen leaves covering grass below.",
            ],
            4: [
                "A giant ancient oak tree, about 45 feet tall, gnarled trunk, massive canopy in deep red and burnt orange autumn colors. Thick carpet of fallen leaves on grass.",
                "A colossal ancient maple, about 50 feet tall, enormous canopy ablaze with red, orange, and gold autumn leaves. Fallen leaves everywhere.",
                "A towering ancient tree, about 50 feet tall, wide trunk, massive canopy in rich autumn browns, reds, and golds. Fallen leaves and exposed roots.",
            ],
        },
    },
    "forest-winter": {
        "lighting": "cool blue-white winter lighting",
        "levels": {
            0: [
                "A small square patch of snow-covered ground, white snow, a few small frosted stones. Flat ground tile, winter atmosphere, frost.",
            ],
            1: [
                "A tiny bare sapling with no leaves, thin branches with a light dusting of snow. On snow-covered ground. Winter season.",
                "A small evergreen bush partially covered in snow, about 2 feet tall. On snow-covered ground. Winter frost.",
                "A very small pine seedling, about 1.5 feet tall, with snow on its tiny branches. On snow-covered ground.",
            ],
            2: [
                "A young birch tree, about 8 feet tall, completely bare branches with no leaves, snow dusting on branches. Snow-covered ground. Winter.",
                "A young pine tree, about 8 feet tall, branches heavily laden with white snow. Snow-covered ground. Winter.",
                "A young bare deciduous tree, about 8 feet tall, no leaves, frost on branches. Snow-covered ground. Winter.",
            ],
            3: [
                "A mature pine tree, about 30 feet tall, branches heavy with snow, green needles peeking through. Snow-covered ground. Winter.",
                "A mature bare oak tree, about 25 feet tall, no leaves, intricate bare branch pattern with snow. Snow-covered ground. Winter.",
                "A mature spruce tree, about 28 feet tall, drooping snow-covered branches. Snow-covered ground. Winter atmosphere.",
            ],
            4: [
                "A giant ancient pine tree, about 50 feet tall, massive snow-covered branches, some green visible. Deep snow on ground. Winter.",
                "A colossal bare ancient oak, about 45 feet tall, dramatic bare branch silhouette covered in frost and snow. Deep snow on ground.",
                "A towering ancient evergreen, about 55 feet tall, enormous snow-laden branches. Deep snow with small animal tracks. Winter.",
            ],
        },
    },
    "forest-spring": {
        "lighting": "bright soft spring lighting",
        "levels": {
            0: [
                "A small square patch of fresh spring grass with small wildflowers, daisies, and dandelions. Flat ground tile, spring blooming atmosphere.",
            ],
            1: [
                "A tiny young sapling with fresh light green spring leaves, very small, about 1 foot tall. On fresh spring grass with small flowers.",
                "A small flowering bush with pink and white spring blossoms, about 2 feet tall. On spring grass with wildflowers.",
                "A very small pine seedling with bright new growth tips, about 1.5 feet tall. On spring grass with flowers.",
            ],
            2: [
                "A young birch tree, about 8 feet tall, fresh light green spring leaves. On spring grass with wildflowers. Spring season.",
                "A young flowering cherry tree, about 8 feet tall, covered in pink cherry blossom flowers. On spring grass. Blooming.",
                "A young maple tree, about 10 feet tall, bright fresh green new spring leaves. On spring grass with daisies.",
            ],
            3: [
                "A mature cherry blossom tree, about 25 feet tall, thick trunk, canopy completely covered in beautiful pink and white cherry blossoms. A few petals falling. Spring grass with flowers below.",
                "A mature oak tree, about 25 feet tall, fresh vibrant spring green canopy. Spring grass with wildflowers below. Spring atmosphere.",
                "A mature magnolia tree, about 22 feet tall, large pink and white magnolia flowers among fresh green leaves. Spring grass below.",
            ],
            4: [
                "A magnificent giant cherry blossom tree, about 40 feet tall, enormous canopy covered in pink and white cherry blossoms, petals drifting in the air. Fresh spring grass with flowers below.",
                "A colossal ancient wisteria tree, about 45 feet tall, cascading purple wisteria flowers hanging from branches. Spring grass and flowers below.",
                "A towering ancient oak, about 50 feet tall, massive canopy of fresh bright spring green, with flowering vines. Spring grass with wildflowers.",
            ],
        },
    },
    "city-nyc": {
        "lighting": "warm evening lighting",
        "levels": {
            0: [
                "A small empty city lot with cracked concrete sidewalk, a fire hydrant, and a thin city tree grate. Urban New York City style.",
            ],
            1: [
                "A small New York City brownstone building, 3 stories tall, classic brown brick facade with window details and front stoop stairs.",
                "A small NYC corner bodega/deli shop, 2 stories, ground floor storefront with awning, apartment above.",
                "A NYC hot dog cart with a small umbrella and a park bench next to it. Small urban scene element.",
            ],
            2: [
                "A medium NYC apartment building, 6 stories tall, red brick facade, fire escapes on the front, rows of windows with AC units.",
                "A medium NYC office building, 8 stories, art deco style facade with ornamental details, regular window grid.",
                "A medium NYC pre-war apartment building, 7 stories, limestone facade, water tower on roof, classic New York architecture.",
            ],
            3: [
                "A tall NYC skyscraper, about 20 stories, modern glass and steel facade, setback architecture typical of midtown Manhattan. Lit windows.",
                "A tall NYC art deco tower, about 25 stories, ornate crown and setbacks, similar to Chrysler Building style but generic. Warm lit windows.",
                "A tall NYC residential tower, about 22 stories, modern luxury condo building, balconies on some floors, rooftop amenities.",
            ],
            4: [
                "A massive NYC supertall skyscraper, about 50 stories, sleek modern glass tower inspired by One World Trade Center style, tapering top with antenna spire.",
                "A massive NYC art deco skyscraper, about 45 stories, inspired by Empire State Building style, ornate stepped crown with antenna, limestone and steel facade.",
                "A massive slim NYC supertall skyscraper, about 55 stories, ultra-modern pencil tower style inspired by 432 Park Avenue, grid facade pattern.",
            ],
        },
    },
    "city-paris": {
        "lighting": "warm golden Parisian lighting",
        "levels": {
            0: [
                "A small Parisian cobblestone ground tile with a classic green Parisian street lamp and a small flower pot.",
            ],
            1: [
                "A small Parisian cafe with outdoor seating, striped awning, bistro chairs and small round tables. 2 stories.",
                "A small Parisian patisserie shop, 2 stories, cream-colored facade with green shopfront, classic French signage area.",
                "A Parisian newspaper kiosk, small green metal structure, classic Morris column style.",
            ],
            2: [
                "A medium Parisian Haussmann-style apartment building, 5 stories, cream limestone facade, wrought iron juliet balconies, mansard roof with zinc grey and dormer windows.",
                "A medium Parisian corner building, 5 stories, curved corner facade, ground floor boulangerie with awning, classic French windows with shutters, grey mansard roof.",
                "A medium Parisian residential building, 6 stories, light sandstone facade, ornate wrought iron balcony railings, tall French windows, classic zinc mansard roof with chimneys.",
            ],
            3: [
                "A tall elegant Parisian Haussmann building, 8 stories, ornate cream facade with detailed stone carvings, continuous wrought iron balconies, tall arched windows, elaborate mansard roof with decorative dormers and chimneys.",
                "A tall Parisian art nouveau building, 8 stories, flowing organic facade details, curved iron balconies, decorative floral elements, classic French mansard roof.",
                "A tall Parisian grand boulevard building, 9 stories, wide impressive facade, multiple balcony levels, ornate cornices, large mansard roof with multiple chimneys. Ground floor luxury boutique with awning.",
            ],
            4: [
                "A miniature Eiffel Tower, detailed iron lattice structure, all four legs visible from isometric angle, warm golden color.",
                "A grand Parisian cathedral inspired by Notre-Dame, gothic architecture, flying buttresses, rose window, twin towers, detailed stone facade.",
                "A magnificent Parisian opera house inspired by Palais Garnier, ornate Beaux-Arts architecture, grand facade with columns, green copper dome roof, golden statues on top.",
            ],
        },
    },
    "city-capetown": {
        "lighting": "warm bright South African sunlight",
        "levels": {
            0: [
                "A small patch of sandy African earth with fynbos scrubland, small protea flowers, and a weathered stone.",
            ],
            1: [
                "A small Cape Dutch style cottage, whitewashed walls, distinctive curved gable, thatched roof. On sandy ground with fynbos.",
                "A small colorful Bo-Kaap house, bright painted facade in turquoise or pink, 2 stories, flat roof. Cape Town style.",
                "A small fruit vendor stall with colorful awning, crates of fruit, on a small patch of ground. Cape Town street scene.",
            ],
            2: [
                "A medium Cape Town Victorian terrace building, 3 stories, ornate iron lacework balconies, painted facade. On sandy ground.",
                "A medium modern Cape Town apartment building, 5 stories, white and glass facade, rooftop terrace. On sandy ground.",
                "A medium Cape Town commercial building, 4 stories, mixed architectural style, ground floor shops with awnings.",
            ],
            3: [
                "A tall modern Cape Town office tower, about 15 stories, glass and concrete, reflecting blue sky. On sandy ground.",
                "A tall Cape Town waterfront building, about 12 stories, modern design with maritime elements, balconies overlooking the sea.",
                "A tall Cape Town hotel building, about 18 stories, modern luxury style, rooftop pool visible. On sandy ground.",
            ],
            4: [
                "A miniature Table Mountain with its iconic flat top and dramatic cliff faces, green vegetation on slopes, small cable car visible.",
                "A large Cape Town stadium inspired by Cape Town Stadium, modern circular design with distinctive roof structure.",
                "A tall modern Cape Town skyscraper, about 30 stories, sleek glass design, inspired by Portside Tower. On sandy ground with palm trees.",
            ],
        },
    },
}

# ============================================================
#  GENERATION
# ============================================================

def get_prompt_for(theme_name, level, variant_idx):
    """Get the full prompt for a specific theme/level/variant.

    Returns (full_prompt, lighting) or (None, None) if not found.
    """
    theme = THEMES.get(theme_name)
    if not theme:
        return None, None
    prompts = theme["levels"].get(level, [])
    if variant_idx >= len(prompts):
        return None, None
    lighting = theme["lighting"]
    prompt = prompts[variant_idx]
    full_prompt = f"Strict isometric projection, 2:1 ratio. {prompt} {BASE_SUFFIX.format(lighting=lighting)}"
    return full_prompt, lighting


def generate_sprite(client, prompt, output_path, lighting=None, retries=3):
    """Generate a single sprite image and save it."""
    if lighting:
        full_prompt = f"Strict isometric projection, 2:1 ratio. {prompt} {BASE_SUFFIX.format(lighting=lighting)}"
    else:
        full_prompt = prompt  # Already fully formed

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
                    # Save the raw image
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


def remove_green_background(input_path, output_path):
    """Remove #00FF00 chroma green background using HSV-based detection (numpy vectorized)."""
    try:
        img = Image.open(input_path).convert("RGBA")
        arr = np.array(img)
        r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]

        # Detect chroma green: high green, low red, low blue
        # This is narrow enough to avoid catching natural tree greens
        green_mask = (g > 150) & (r < 100) & (b < 100)

        # Also catch near-green anti-aliased edge pixels via HSV
        # Convert to float for HSV computation
        rf, gf, bf = r.astype(float)/255, g.astype(float)/255, b.astype(float)/255
        cmax = np.maximum(rf, np.maximum(gf, bf))
        cmin = np.minimum(rf, np.minimum(gf, bf))
        delta = cmax - cmin

        # Hue calculation (only for green-ish pixels)
        hue = np.zeros_like(rf)
        mask_g = (cmax == gf) & (delta > 0)
        hue[mask_g] = 60 * (((bf[mask_g] - rf[mask_g]) / delta[mask_g]) + 2)
        hue[hue < 0] += 360

        sat = np.zeros_like(rf)
        sat[cmax > 0] = delta[cmax > 0] / cmax[cmax > 0]

        # Chroma green in HSV: hue 100-140, sat > 0.6, val > 0.4
        hsv_green_mask = (hue >= 100) & (hue <= 140) & (sat > 0.6) & (cmax > 0.4)

        combined_mask = green_mask | hsv_green_mask

        # Set matching pixels to transparent
        arr[combined_mask] = [0, 0, 0, 0]

        result = Image.fromarray(arr)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        result.save(str(output_path))
        return True
    except Exception as e:
        print(f"  ✗ Background removal failed: {e}")
        return False


def process_theme(client, theme_name, target_level=None):
    """Generate all sprites for a theme."""
    theme = THEMES[theme_name]
    lighting = theme["lighting"]
    theme_dir = OUTPUT_DIR / theme_name
    raw_dir = theme_dir / "raw"
    clean_dir = theme_dir / "clean"

    raw_dir.mkdir(parents=True, exist_ok=True)
    clean_dir.mkdir(parents=True, exist_ok=True)

    total = 0
    success = 0
    failed = []

    for level, prompts in theme["levels"].items():
        if target_level is not None and level != target_level:
            continue

        for variant_idx, prompt in enumerate(prompts):
            variant_letter = chr(97 + variant_idx)  # a, b, c
            filename = f"level-{level}-{variant_letter}.png"
            raw_path = raw_dir / filename
            clean_path = clean_dir / filename

            # Skip if already generated
            if clean_path.exists():
                print(f"  → Skipping {filename} (already exists)")
                continue

            total += 1

            if generate_sprite(client, prompt, raw_path, lighting=lighting):
                # Remove green background
                if remove_green_background(raw_path, clean_path):
                    success += 1
                    print(f"  ✓ Cleaned: {clean_path.name}")
                else:
                    failed.append(filename)
            else:
                failed.append(filename)

            # Rate limit delay
            time.sleep(DELAY_BETWEEN_REQUESTS)

    return total, success, failed


def main():
    # Check API key
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: Set your GOOGLE_API_KEY environment variable.")
        print("Get one free at: https://aistudio.google.com/apikey")
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    # Parse args
    target_theme = sys.argv[1] if len(sys.argv) > 1 else None
    target_level = int(sys.argv[2]) if len(sys.argv) > 2 else None

    theme_names = [target_theme] if target_theme else list(THEMES.keys())

    print(f"\n{'='*60}")
    print(f"  Contribution Lands Sprite Generator")
    print(f"  Model: {MODEL}")
    print(f"  Themes: {', '.join(theme_names)}")
    print(f"  Output: {OUTPUT_DIR}")
    print(f"{'='*60}\n")

    grand_total = 0
    grand_success = 0
    all_failed = []

    for theme_name in theme_names:
        print(f"\n▸ Theme: {theme_name}")
        print(f"  {'─'*40}")

        total, success, failed = process_theme(client, theme_name, target_level)
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
    print(f"  Output: {OUTPUT_DIR}")
    print(f"{'='*60}\n")

    # Save manifest
    manifest = {}
    for theme_name in theme_names:
        clean_dir = OUTPUT_DIR / theme_name / "clean"
        if clean_dir.exists():
            sprites = sorted([f.name for f in clean_dir.glob("*.png")])
            manifest[theme_name] = sprites

    manifest_path = OUTPUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"Manifest saved: {manifest_path}")


if __name__ == "__main__":
    main()
