# Contributing to Contribution Lands

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/jeanluciradukunda/contribution-lands.git
cd contribution-lands
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Running Tests

```bash
# All tests (requires GOOGLE_API_KEY for API tests)
pytest -v

# Offline tests only (no API key needed)
pytest -m "not api" -v

# Single smoke test
pytest tests/test_single_sprite.py -v
```

## Sprite Generation

To generate sprites, you need a free Google AI Studio API key:

```bash
export GOOGLE_API_KEY="your-key"
python scripts/generate_sprites.py forest-summer
```

## Validation

After generating sprites, validate them:

```bash
python -m validation.validate_all
open reports/validation_report.html
```

## Pull Requests

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests (`pytest -m "not api"`)
5. Commit with a clear message
6. Push and open a PR

## Adding a New Theme

1. Add prompt templates to `scripts/generate_sprites.py` in the `THEMES` dict
2. Add entity/particle config to the prototype's theme definition in `prototype.html`
3. Generate sprites: `python scripts/generate_sprites.py your-theme-name`
4. Validate: `python -m validation.validate_all`
5. Update the README theme table

## Code Style

- Python: Follow PEP 8
- Keep functions focused and small
- Add docstrings to public functions
