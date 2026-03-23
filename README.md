# Contribution Lands

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

> Transform your GitHub contribution graph into a living isometric world — forests, cities, and beyond.

<p align="center">
  <em>Your contributions grow into forests. Your commits build cities.</em>
</p>

## What is Contribution Lands?

A browser extension that replaces GitHub's flat contribution graph with themed isometric visualizations. Each contribution level maps to increasingly impressive elements — from saplings to ancient redwoods, from brownstones to skyscrapers. Themes come alive with ambient animations: deer wandering through forests, taxis cruising through NYC, cherry blossoms drifting in spring.

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

## Project Structure

```
contribution-lands/
├── extension/                  # Chrome extension (prototype + future code)
│   └── prototype.html          # Interactive animated preview
├── themes/                     # Ready-to-use sprite assets (committed)
│   ├── theme.schema.json       # What a valid theme looks like
│   ├── forest-summer/
│   │   ├── theme.json          # Theme metadata, entity config, colors
│   │   └── sprites/            # Clean, transparent, correctly-sized PNGs
│   ├── city-nyc/
│   └── ...
├── tools/
│   └── theme-generator/        # Standalone sprite generation pipeline
│       ├── README.md            # How to create a new theme
│       ├── generate.py          # AI sprite generation via Gemini API
│       ├── prompts/             # Per-theme prompt templates
│       ├── processing/          # Background removal + resizing
│       ├── validation/          # Quality checks + HTML report
│       └── tests/               # pytest suite
└── docs/
    └── creating-themes.md       # Complete prompt writing guide
```

## Quick Start

### Preview the Prototype

```bash
open extension/prototype.html
```

Click through all 7 themes — each has animated entities and weather particles.

### Generate Sprites (for contributors)

See [tools/theme-generator/README.md](tools/theme-generator/README.md) for the full guide.

```bash
cd tools/theme-generator
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export GOOGLE_API_KEY="your-key"  # Free at aistudio.google.com/apikey

python generate.py --list               # See available themes
python generate.py forest-summer        # Generate one theme
python -m validation.validate_all       # Validate + HTML report
```

## Inspiration

- [isometric-contributions](https://github.com/jasonlong/isometric-contributions) — The original isometric GitHub extension
- [isometric-nyc](https://cannoneyed.com/projects/isometric-nyc) — AI-generated isometric pixel art of NYC

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). To create a new theme, follow [tools/theme-generator/README.md](tools/theme-generator/README.md).

## License

[MIT](LICENSE) — Jean Luc Iradukunda
