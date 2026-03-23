# Theme Generator

A self-contained tool for creating Contribution Lands themes using AI-generated isometric sprites.

## Pipeline

```
Prompt → Gemini → Raw PNG → Remove Green BG → Trim & Resize → Final Sprite
```

1. **Prompt**: Each theme has text prompts describing isometric sprites at 5 contribution levels
2. **Generate**: Gemini renders the prompt with a green chroma key background
3. **Clean**: HSV-based detection removes the green, producing transparent PNGs
4. **Resize**: Sprites are trimmed and standardized to a consistent base width
5. **Validate**: Automated checks verify quality, centering, scale progression, and transparency
6. **Output**: Final sprites go to `themes/{name}/sprites/`

## Setup

```bash
cd tools/theme-generator
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Generation Methods

There are two ways to generate sprites:

### Method 1: Gemini Web App (Free — Recommended)

Uses the Gemini web app's free image generation quota via [`gemini_webapi`](https://github.com/HanaokaYuzu/Gemini-API). No billing required.

**Prerequisites:**
1. Log into [gemini.google.com](https://gemini.google.com) in Chrome or Firefox
2. That's it — cookies are auto-detected from your browser

```bash
# Generate a theme (auto-detects browser cookies)
python generate_web.py city-nyc

# Generate a specific level only
python generate_web.py city-nyc --level 4

# If auto-detect fails, enter cookies manually
python generate_web.py city-nyc --cookies

# List all available themes
python generate_web.py --list

# Adjust delay between requests (default: 5s)
python generate_web.py city-nyc --delay 8
```

**Manual cookie entry** (if `--cookies` is needed):
1. Go to [gemini.google.com](https://gemini.google.com) in Chrome
2. Open DevTools (F12) → Application tab → Cookies → gemini.google.com
3. Copy the values for `__Secure-1PSID` and `__Secure-1PSIDTS`
4. Paste when prompted

**Rate limits:** The web app has its own daily quota separate from the API. Exact limits vary but are generous for personal use. The script adds a 5-second delay between requests to be respectful.

### Method 2: Gemini API (Paid — Higher Quality)

Uses the official Gemini API. Requires billing enabled on your Google Cloud project.

```bash
export GOOGLE_API_KEY="your-key"  # From aistudio.google.com/apikey
python generate.py city-nyc
python generate.py --list
```

**Cost:** ~$0.04/image → ~$0.52 per theme (13 sprites) → ~$3.64 for all 7 themes.

### Method 3: Programmatic Sprites (Free — Instant)

Generate sprites from code using Pillow. Lower fidelity but zero cost and instant results.

```bash
python create_nyc_sprites.py
```

## Sprite Versioning

Sprites are versioned by generation method. The `themes/{name}/sprites/` directory contains the **active** sprites used by the extension. Previous versions are preserved:

```
themes/city-nyc/
├── theme.json
└── sprites/              # Active sprites (used by extension)
    ├── level-0-a.png
    ├── level-1-a.png
    └── ...
```

When upgrading sprites (e.g., from programmatic → AI-generated):
1. The generator overwrites files in `sprites/` with new versions
2. Previous versions are in git history (`git log -- themes/city-nyc/sprites/`)
3. To restore old versions: `git checkout <commit> -- themes/city-nyc/sprites/`

## Creating a New Theme

### 1. Create a prompt file

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
            "Small element variant A...",
            "Small element variant B...",
            "Small element variant C...",
        ],
        2: ["Medium element..."],
        3: ["Large element..."],
        4: ["Massive/iconic element..."],
    },
}
```

### 2. Register the theme

Add to `prompts/registry.py`:

```python
from . import my_theme
THEMES["my-theme"] = my_theme.THEME
```

### 3. Generate sprites

```bash
# Free method (recommended for testing)
python generate_web.py my-theme

# Or paid API
export GOOGLE_API_KEY="your-key"
python generate.py my-theme
```

### 4. Validate

```bash
python -m validation.validate_all
```

### 5. Create theme.json

Create `themes/my-theme/theme.json`:

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

### 6. Test locally

Open `extension/test-nyc.html` as a reference for how to build a test page with your theme.

## Prompt Writing Tips

- Specify size progression clearly: Level 1 = "tiny/small", Level 4 = "massive/towering"
- Include "on a small grass/ground patch" for consistent base area
- The base suffix auto-adds: SimCity 2000 style, green background, white outline, isometric projection
- Generate 3 variants per level for visual variety in the grid

## Project Structure

```
tools/theme-generator/
├── generate_web.py       # Free generation via Gemini web app
├── generate.py           # Paid generation via Gemini API
├── create_nyc_sprites.py # Programmatic NYC sprites
├── regenerate.py         # Redo failed sprites
├── prompts/
│   ├── base.py           # Shared prompt suffix
│   ├── registry.py       # Theme registry
│   ├── forest_summer.py  # Per-theme prompt files
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
```
