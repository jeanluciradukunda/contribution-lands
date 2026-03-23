# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Interactive HTML prototype with 6 themes (4 forest seasons, NYC, Paris)
- Animated ambient entities (deer, rabbits, birds, taxis, pedestrians, cyclists)
- Weather particles (snow, falling leaves, cherry blossom petals)
- Hover tooltips showing contribution date and count
- Gemini API sprite generation pipeline with 7 theme prompt sets
- Green chroma key background removal (HSV-based, numpy-vectorized)
- Comprehensive validation framework:
  - Per-sprite quality checks (dimensions, green bg, object presence, centering)
  - Theme consistency analysis (scale progression, color palette)
  - Cross-theme completeness verification
  - Post-processing validation (transparency, green fringe, object integrity)
  - HTML visual review report with embedded thumbnails
  - Redo tracker for failed sprite regeneration
- Full pytest test suite with API/offline marker separation
- Sprite generation guide with prompts for all themes and levels
