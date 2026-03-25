#!/usr/bin/env python3
"""
Render a fake year of GitHub contributions as an isometric NYC skyline.
Outputs a large transparent PNG for use as the README hero image.
"""

import os
import random
import math
from PIL import Image

SPRITE_DIR = os.path.join(os.path.dirname(__file__), "..", "themes", "city-nyc", "sprites")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "docs", "hero-nyc.png")

# Contribution grid: 52 weeks × 7 days
WEEKS = 52
DAYS = 7

# Isometric tile spacing
TILE_W = 64   # horizontal spacing between columns
TILE_H = 32   # vertical spacing between rows (isometric half-height)

# Padding for tall sprites that extend above their tile
TOP_PADDING = 600
SIDE_PADDING = 200


def load_sprites():
    """Load all non-road sprites grouped by level."""
    sprites = {i: [] for i in range(5)}
    for level in range(5):
        files = sorted([
            f for f in os.listdir(SPRITE_DIR)
            if f.startswith(f"level-{level}-") and "road" not in f
        ])
        for f in files:
            img = Image.open(os.path.join(SPRITE_DIR, f)).convert("RGBA")
            sprites[level].append(img)
    return sprites


def generate_contributions():
    """Generate a realistic-looking year of contribution data (0-4)."""
    random.seed(42)  # Reproducible
    data = []
    for week in range(WEEKS):
        row = []
        for day in range(DAYS):
            # Weekends are quieter
            is_weekend = day >= 5
            # Some weeks are busier (sprints)
            is_busy_week = week % 8 < 5
            # Occasional vacation weeks
            is_vacation = week in [2, 3, 25, 26, 51]

            if is_vacation:
                level = 0
            elif is_weekend:
                level = random.choices([0, 0, 1, 1, 2], weights=[40, 20, 20, 15, 5])[0]
            elif is_busy_week:
                level = random.choices([0, 1, 2, 3, 4], weights=[5, 15, 30, 30, 20])[0]
            else:
                level = random.choices([0, 1, 2, 3, 4], weights=[20, 30, 25, 15, 10])[0]
            row.append(level)
        data.append(row)
    return data


def render(contributions, sprites):
    """Render the isometric contribution graph."""
    # Calculate canvas size
    canvas_w = (WEEKS + DAYS) * TILE_W // 2 + SIDE_PADDING * 2
    canvas_h = (WEEKS + DAYS) * TILE_H // 2 + TOP_PADDING + 200

    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

    # Render back-to-front (top-left of grid first in isometric space)
    for week in range(WEEKS):
        for day in range(DAYS):
            level = contributions[week][day]

            # Pick a random sprite for this level
            sprite_list = sprites[level]
            if not sprite_list:
                continue
            sprite = random.choice(sprite_list)

            # Scale sprite to tile width
            scale = TILE_W / sprite.width
            scaled_w = TILE_W
            scaled_h = int(sprite.height * scale)
            scaled_sprite = sprite.resize((scaled_w, scaled_h), Image.LANCZOS)

            # Isometric position
            iso_x = (week - day) * TILE_W // 2 + canvas_w // 2 - TILE_W // 2
            iso_y = (week + day) * TILE_H // 2 + TOP_PADDING

            # Anchor sprite at bottom-center of tile
            paste_x = iso_x
            paste_y = iso_y - scaled_h + TILE_H

            # Paste with alpha compositing
            canvas.paste(scaled_sprite, (paste_x, paste_y), scaled_sprite)

    # Crop to content (remove excess transparent space)
    bbox = canvas.getbbox()
    if bbox:
        # Add a small margin
        margin = 20
        bbox = (
            max(0, bbox[0] - margin),
            max(0, bbox[1] - margin),
            min(canvas_w, bbox[2] + margin),
            min(canvas_h, bbox[3] + margin),
        )
        canvas = canvas.crop(bbox)

    return canvas


def main():
    print("Loading sprites...")
    sprites = load_sprites()
    for level, imgs in sprites.items():
        print(f"  Level {level}: {len(imgs)} sprites")

    print("Generating contribution data (52 weeks × 7 days)...")
    contributions = generate_contributions()

    # Count levels
    from collections import Counter
    flat = [c for week in contributions for c in week]
    counts = Counter(flat)
    print(f"  Distribution: {dict(sorted(counts.items()))}")

    print("Rendering isometric NYC skyline...")
    image = render(contributions, sprites)
    print(f"  Canvas size: {image.size}")

    print(f"Saving to {OUTPUT_PATH}...")
    image.save(OUTPUT_PATH, "PNG", optimize=True)
    print(f"Done! File size: {os.path.getsize(OUTPUT_PATH) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
