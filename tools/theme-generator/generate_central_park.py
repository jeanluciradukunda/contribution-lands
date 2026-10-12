"""Generate the Central Park landmark sprites for city-nyc (ground textures and trees: generate_park_textures.py).

    GOOGLE_API_KEY=... python generate_central_park.py [name ...] [--budget N]

Every API call is counted in .cache/central_park/calls.txt and the run stops at
the budget. Raw results are cached; processed sprites land in themes/city-nyc/sprites.
"""

import argparse
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from google import genai
from google.genai import types

from generate import MODEL
from processing.background import remove_green_background
from processing.resize import standardize_sprite
from processing.shadow_cleanup import clean as shadow_clean

ROOT = Path(__file__).parent
OUT = ROOT.parent.parent / "themes" / "city-nyc" / "sprites"
CACHE = ROOT / ".cache" / "central_park"
LIGHT = "warm evening lighting"

TILE = (
    "The model sits on ONE square isometric ground tile whose footprint is a flush 2:1 diamond: "
    "the ground reaches the edges of the diamond and stops there, with no plinth, no base slab, "
    "no terrain diorama and nothing extending beyond the tile. "
)
SUFFIX = (
    f"Low-poly 3D render, clean colours, {LIGHT} from top-left, SimCity 2000 / RollerCoaster Tycoon "
    "game asset style, matching a New York City isometric set. "
    "Single isolated tile centred on a solid #00FF00 chroma green background. "
    "The backdrop is perfectly flat and evenly lit: the object casts no shadow onto the background at all. "
    "No outline. No text. No labels. Strict isometric projection, 2:1 pixel ratio."
)

SPRITES = {
    "park-cp-bethesda": "Bethesda Terrace and Fountain in Central Park: the Angel of the Waters fountain with its tiered round basin and winged angel statue, in front of a sandstone arcaded terrace with wide steps and balustrades, hexagonal paving.",
    "park-cp-belvedere": "Belvedere Castle in Central Park: a small grey stone Gothic-Romanesque castle with a tower and turret and a flag, standing on its rocky schist outcrop with a few autumn trees.",
}


# Mostly-green sprites are keyed on magenta, or the backdrop eats their lawn.
MAGENTA: set[str] = set()


def calls_made():
    f = CACHE / "calls.txt"
    return int(f.read_text()) if f.exists() else 0


def bump():
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / "calls.txt").write_text(str(calls_made() + 1))


def strip_magenta_fringe(path):
    arr = np.array(Image.open(path).convert("RGBA"))
    r, g, b, a = (arr[..., i].astype(int) for i in range(4))
    near_edge = ndimage.binary_dilation(a < 40, iterations=3)
    arr[near_edge & (r > g + 20) & (b > g + 20), 3] = 0
    Image.fromarray(arr).save(path)


def process(name, shadow=False):
    raw = CACHE / f"{name}.png"
    clean = CACHE / f"{name}_clean.png"
    final = OUT / f"{name}.png"
    if not remove_green_background(raw, clean) or not standardize_sprite(clean, final):
        return False
    if shadow:
        shadow_clean(final, max_std=14.0)
    if name in MAGENTA:
        strip_magenta_fringe(final)
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("names", nargs="*")
    parser.add_argument("--budget", type=int, default=30)
    parser.add_argument("--process-only", action="store_true")
    parser.add_argument("--shadow-clean", nargs="*", default=[], help="sprites with a leftover green patch and no green of their own")
    args = parser.parse_args()
    names = args.names or list(SPRITES)

    client = None if args.process_only else genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    for name in names:
        raw = CACHE / f"{name}.png"
        if client and not raw.exists():
            if calls_made() >= args.budget:
                print(f"budget of {args.budget} calls reached, stopping")
                sys.exit(2)
            suffix = SUFFIX.replace("#00FF00 chroma green", "#FF00FF magenta") if name in MAGENTA else SUFFIX
            prompt = f"Strict isometric projection, 2:1 ratio. {SPRITES[name]} {TILE}{suffix}"
            bump()
            try:
                resp = client.models.generate_content(
                    model=MODEL, contents=prompt, config=types.GenerateContentConfig(response_modalities=["IMAGE"])
                )
            except Exception as e:
                print(f"{name}: API error {type(e).__name__}")
                continue
            image = next((p.as_image() for p in resp.parts if p.inline_data is not None), None)
            if image is None:
                print(f"{name}: no image returned")
                continue
            raw.parent.mkdir(parents=True, exist_ok=True)
            image.save(str(raw))
        if raw.exists():
            print(f"{name}: {'ok' if process(name, name in args.shadow_clean) else 'processing failed'}")
    print(f"calls so far: {calls_made()}")


if __name__ == "__main__":
    main()
