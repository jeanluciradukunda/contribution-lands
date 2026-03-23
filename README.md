# Contribution Lands

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

> Transform your GitHub contribution graph into a living isometric world — forests, cities, and beyond.

<p align="center">
  <em>Your contributions grow into forests. Your commits build cities.</em>
</p>

## What is Contribution Lands?

A browser extension that replaces GitHub's flat contribution graph with themed isometric visualizations. Each contribution level maps to increasingly impressive elements — from saplings to ancient redwoods, from brownstones to skyscrapers.

### Themes

| Theme | Level 0 | Level 1 | Level 2 | Level 3 | Level 4 |
|-------|---------|---------|---------|---------|---------|
| **Summer Forest** | Grass | Sapling | Young tree | Mature tree | Ancient redwood |
| **Autumn Forest** | Fallen leaves | Orange sapling | Red maple | Autumn oak | Blazing canopy |
| **Winter Forest** | Snow | Bare twig | Frosted pine | Snow-laden spruce | Ice giant |
| **Spring Forest** | Wildflowers | Sprout | Cherry tree | Cherry blossom | Wisteria |
| **NYC Skyline** | Empty lot | Brownstone | Apartment | Skyscraper | Supertall |
| **Paris** | Cobblestone | Cafe | Haussmann | Grand boulevard | Eiffel Tower |
| **Cape Town** | Sandy earth | Bo-Kaap house | Victorian | Office tower | Table Mountain |

### Ambient Life

Themes come alive with animated entities:
- **Forests**: Deer, rabbits, birds, butterflies; falling leaves, snow, cherry blossoms
- **Cities**: Taxis, pedestrians, cyclists, pigeons

## Project Structure

```
contribution-lands/
├── prototype.html              # Interactive preview (open in browser)
├── scripts/
│   ├── generate_sprites.py     # Gemini API sprite generator
│   └── regenerate.py           # Re-generate failed sprites
├── validation/
│   ├── sprite_analyzer.py      # Image quality analysis
│   ├── theme_analyzer.py       # Cross-sprite consistency
│   ├── report_generator.py     # HTML visual review report
│   ├── redo_tracker.py         # Failed sprite tracking
│   └── validate_all.py         # Full validation CLI
├── tests/                      # pytest test suite
├── sprites/                    # Generated assets (gitignored)
└── SPRITE_GENERATION_GUIDE.md  # Prompts for AI sprite generation
```

## Getting Started

### Prerequisites

- Python 3.10+
- A free [Google AI Studio API key](https://aistudio.google.com/apikey)

### Setup

```bash
git clone https://github.com/jeanluciradukunda/contribution-lands.git
cd contribution-lands
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Preview the Prototype

Open `prototype.html` in your browser to see the animated canvas-based prototype with all themes.

### Generate Sprites

```bash
export GOOGLE_API_KEY="your-key"

# Generate all themes (~91 sprites, runs overnight on free tier)
python scripts/generate_sprites.py

# Generate a single theme
python scripts/generate_sprites.py forest-summer

# Generate a specific level
python scripts/generate_sprites.py city-nyc 4
```

### Validate Sprites

```bash
# Run the full test suite
pytest

# Run only offline validation (no API calls)
pytest -m "not api"

# Run the full validation pipeline with HTML report
python -m validation.validate_all

# Also generate a redo list for failed sprites
python -m validation.validate_all --redo

# Regenerate failed sprites
python scripts/regenerate.py
```

## How It Works

1. **Sprite Generation**: The Gemini API (Nano Banana) generates isometric game assets from text prompts, using a chroma green background for transparency
2. **Post-Processing**: Green backgrounds are removed via HSV-based detection, producing clean transparent PNGs
3. **Validation**: Automated quality checks verify perspective, centering, scale progression, color consistency, and transparency
4. **Rendering**: A canvas-based renderer places sprites on an isometric grid matching GitHub's 52x7 contribution layout
5. **Animation**: Ambient entities (animals, vehicles, pedestrians) and weather particles bring the scene to life

## Inspiration

- [isometric-contributions](https://github.com/jasonlong/isometric-contributions) — The original isometric GitHub extension
- [isometric-nyc](https://cannoneyed.com/projects/isometric-nyc) — AI-generated isometric pixel art of NYC

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

[MIT](LICENSE) — Jean Luc Iradukunda
