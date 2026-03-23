# Theme Generator

A self-contained tool for creating new Contribution Lands themes using AI-generated isometric sprites.

## How It Works

```
Prompt → Gemini API → Raw PNG → Remove Green BG → Trim & Resize → Final Sprite
```

1. **Prompt**: Each theme has text prompts describing isometric sprites at 5 contribution levels
2. **Generate**: Gemini API (Nano Banana) renders the prompt as an image with green chroma key background
3. **Clean**: HSV-based detection removes the green background, producing transparent PNGs
4. **Resize**: Sprites are trimmed and standardized to a consistent base width
5. **Validate**: Automated checks verify quality, centering, scale progression, and transparency
6. **Output**: Final sprites land in `themes/{name}/sprites/` ready for the extension

## Setup

```bash
cd tools/theme-generator
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export GOOGLE_API_KEY="your-key"  # Free at https://aistudio.google.com/apikey
```

## Usage

```bash
# List available themes
python generate.py --list

# Generate all themes (~91 sprites, ~4.5 min on free tier)
python generate.py

# Generate a single theme
python generate.py forest-summer

# Generate a specific level
python generate.py city-nyc --level 4

# Validate all generated sprites
python -m validation.validate_all

# Regenerate failed sprites
python regenerate.py
```

## Creating a New Theme

### 1. Create a prompt file

Copy an existing prompt file and modify it:

```bash
cp prompts/forest_summer.py prompts/my_theme.py
```

Edit `prompts/my_theme.py`:

```python
"""My Custom Theme prompts."""

THEME = {
    "lighting": "warm sunset lighting",
    "levels": {
        0: ["Ground tile description..."],
        1: [
            "Small element (level 1 - lowest contributions)...",
            "Variant B...",
            "Variant C...",
        ],
        2: ["Medium element..."],
        3: ["Large element..."],
        4: ["Massive/iconic element (level 4 - highest contributions)..."],
    },
}
```

### 2. Register the theme

Add your import to `prompts/registry.py`:

```python
from . import my_theme

THEMES = {
    ...
    "my-theme": my_theme.THEME,
}
```

### 3. Generate sprites

```bash
python generate.py my-theme
```

### 4. Validate

```bash
python -m validation.validate_all
open ../../reports/validation_report.html
```

### 5. Create theme.json

Create `themes/my-theme/theme.json` with entity/particle config:

```json
{
  "name": "My Theme",
  "category": "city",
  "author": "Your Name",
  "background": "#0a0e14",
  "ground_colors": ["#3a3a40", "#35353b"],
  "ground_stroke": "#2a2a30",
  "entities": [
    { "type": "person", "count": 5, "speed": 0.012 }
  ],
  "particles": null
}
```

See `themes/theme.schema.json` for the full schema.

### 6. Regenerate failures

If some sprites fail validation:

```bash
python -m validation.validate_all --redo
python regenerate.py
```

## Prompt Writing Tips

- Always include: `"Strict isometric projection, 2:1 ratio"` (handled automatically)
- Specify size progression clearly: Level 1 = "tiny/small", Level 4 = "massive/towering"
- Include `"on a small grass/ground patch"` for consistent base area
- The base suffix adds: SimCity 2000 style, green background, white outline, top-left lighting
- Generate 3 variants per level for visual variety

## Project Structure

```
tools/theme-generator/
├── generate.py           # Main CLI
├── regenerate.py         # Redo failed sprites
├── prompts/
│   ├── base.py           # Shared prompt suffix
│   ├── registry.py       # Theme registry
│   ├── forest_summer.py  # Per-theme prompts
│   └── ...
├── processing/
│   ├── background.py     # Green chroma key removal
│   └── resize.py         # Sprite standardization
├── validation/
│   ├── sprite_analyzer.py
│   ├── theme_analyzer.py
│   ├── report.py
│   ├── redo.py
│   └── validate_all.py
└── tests/
    ├── test_api.py
    ├── test_smoke.py
    ├── test_quality.py
    └── ...
```

## Free Tier Limits

The Gemini API free tier allows ~500 images/day — enough to generate all 7 themes (~91 sprites) in a single session. Rate limiting (3s between requests) is built into the generator.
