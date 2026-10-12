"""Generate the Central Park ground textures and tree sprites for city-nyc.

    GOOGLE_API_KEY=... python generate_park_textures.py [name ...] [--budget N]

Textures are top-down and made seamless in the renderer by mirroring, so they are
only downscaled here. Every API call is counted in the cache dir and the run stops
at the budget.
"""

import argparse
import os
import sys
from pathlib import Path

from PIL import Image

from generate import MODEL
from generate_central_park import strip_magenta_fringe
from processing.background import remove_green_background
from processing.resize import standardize_sprite

ROOT = Path(__file__).parent
OUT = ROOT.parent.parent / "themes" / "city-nyc" / "sprites"
CACHE = Path(os.environ.get("PARK_CACHE", ROOT / ".cache" / "park_textures"))
TEXTURE_SIZE = 256
TREE_WIDTH = 96

STYLE = (
    "Stylised low-poly game-art, clean saturated colours, warm evening light from the top left, "
    "matching an isometric New York City builder set. Fills the whole frame edge to edge. "
    "No horizon, no buildings, no roads, no people, no text, no border, no vignette."
)

TEXTURES = {
    "park-cp-tex-canopy": (
        "A perfectly top-down orthographic view straight down onto a dense continuous tree canopy in "
        "Central Park in early autumn: overlapping rounded tree crowns in deep green, olive, gold and a few "
        "orange and red, soft shading between crowns, no ground visible. " + STYLE
    ),
    "park-cp-tex-lawn": (
        "A perfectly top-down orthographic view straight down onto a mown park lawn: fresh green grass with "
        "subtle mowing stripes and soft tonal patches, a few tiny pale picnic blankets and scattered dots of "
        "people, otherwise empty. " + STYLE
    ),
    "park-cp-tex-water": (
        "A perfectly top-down orthographic view straight down onto calm dark teal-blue park lake water: "
        "gentle ripples and soft highlights, a few small floating leaves, no shoreline. " + STYLE
    ),
}

TREES = {
    "park-cp-tree-a": "A single round-crowned green oak tree: a rounded, slightly lumpy dome of leaves in two greens with a short trunk, seen in strict isometric projection.",
    "park-cp-tree-b": "A single round-crowned autumn tree: a rounded, slightly lumpy dome of leaves in gold and orange with a hint of red, a short trunk, seen in strict isometric projection.",
}
TREE_SUFFIX = (
    "Low-poly 3D render, clean colours, warm evening lighting from top-left, SimCity 2000 style game asset. "
    "ONLY the tree, no ground, no grass, no tile, no plinth. "
    "Isolated on a solid #FF00FF magenta background, perfectly flat and evenly lit, the tree casts no shadow. "
    "No outline. No text."
)


def calls_made():
    f = CACHE / "calls.txt"
    return int(f.read_text()) if f.exists() else 0


def bump():
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / "calls.txt").write_text(str(calls_made() + 1))


def process_texture(name):
    img = Image.open(CACHE / f"{name}.png").convert("RGB")
    side = min(img.size)
    left, top = (img.width - side) // 2, (img.height - side) // 2
    img = img.crop((left, top, left + side, top + side)).resize((TEXTURE_SIZE, TEXTURE_SIZE), Image.LANCZOS)
    img.save(OUT / f"{name}.png", optimize=True)
    return True


def process_tree(name):
    clean = CACHE / f"{name}_clean.png"
    final = OUT / f"{name}.png"
    if not remove_green_background(CACHE / f"{name}.png", clean) or not standardize_sprite(clean, final, base_width=TREE_WIDTH):
        return False
    strip_magenta_fringe(final)
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("names", nargs="*")
    parser.add_argument("--budget", type=int, default=15)
    parser.add_argument("--process-only", action="store_true")
    args = parser.parse_args()
    names = args.names or [*TEXTURES, *TREES]

    client = None
    if not args.process_only:
        from google import genai

        client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    from google.genai import types

    for name in names:
        raw = CACHE / f"{name}.png"
        if client and not raw.exists():
            if calls_made() >= args.budget:
                print(f"budget of {args.budget} calls reached, stopping")
                sys.exit(2)
            prompt = TEXTURES[name] if name in TEXTURES else f"Strict isometric projection, 2:1 ratio. {TREES[name]} {TREE_SUFFIX}"
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
            ok = process_texture(name) if name in TEXTURES else process_tree(name)
            print(f"{name}: {'ok' if ok else 'processing failed'}")
    print(f"calls so far: {calls_made()}")


if __name__ == "__main__":
    main()
