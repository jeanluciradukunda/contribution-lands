# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-03-23

### Added
- **Chrome Extension (MV3)** — content script + popup working on GitHub profiles
  - Content script detects contribution graph, renders isometric sprite scene
  - Toggle buttons: 2D | Lands | Both (persisted via chrome.storage)
  - Hover tooltips with contribution count and date
  - Transparent canvas adapts to GitHub light/dark mode
  - SPA navigation support (turbo:load, MutationObserver)
  - Animated entities: taxis on roads, people on sidewalks, birds overhead
  - Popup with liquid glass UI, theme selector, L0-L4 preview (by OpenAI Codex)
- **NYC Skyline theme** — 42 AI-generated isometric sprites
  - L0: 30 variants (roads, parks, trees, fountains, basketball courts, dog parks, food trucks, subway entrances, bridges, tunnels)
  - L1-L4: 3 variants each (brownstones, apartments, art deco towers, Empire State, Chrysler, One WTC, 432 Park)
  - Programmatic connected road grid with city blocks
  - L0 placement rules matrix (road-adjacent→sidewalk, building-adjacent→urban, clusters→park)
- **Sprite generation pipeline** (`tools/theme-generator/`)
  - Gemini API paid generation (`generate.py`)
  - Gemini web app free generation (`generate_web.py`)
  - Programmatic sprite generation (`create_nyc_sprites.py`)
  - Adaptive background removal with alpha matting and color decontamination
  - Green fringe suppression (<0.5% residual)
  - White outline removal (baked-in AI artifact stripping)
  - Watermark removal (largest connected component filter)
  - Sprite standardization and resizing
- **Validation framework** — pytest suite with API/offline markers
- **7 theme prompt sets** — forest (4 seasons), NYC, Paris, Cape Town
- **Theme schema** with `theme.json` per theme (entity config, colors, metadata)
- **Project icon** — SVG globe with contribution grid and themes rising above

### Infrastructure
- Repo restructured: `extension/`, `themes/`, `tools/theme-generator/`, `docs/`
- GitHub issue templates (bug report, feature request)
- MIT license, CONTRIBUTING.md, comprehensive README
