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

## Releasing

Releases are cut from `main` by the Release workflow, which also publishes to the Chrome Web Store:

```bash
gh workflow run release.yml -f version=0.2.1
```

The workflow tags `v<version>`, writes the version into the manifest, builds, checks the package (NYC only, one `manifest.json`, the notices file), creates a GitHub release with the zip, and uploads it to the Chrome Web Store and submits it for review. Pushing a `v*` tag does the same. Review of an update has taken minutes to a few days.

Each release waits for the maintainer to approve it in the protected `chrome-web-store` environment, which holds the store credentials. The store upload needs five secrets there: `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_PUBLISHER_ID` and `CWS_EXTENSION_ID`. Without `CWS_EXTENSION_ID` the upload step is skipped and only the GitHub release is made. The maintainer creates and rotates the OAuth credentials with `tools/store/cws-keys.sh` and `tools/store/cws-rotate.sh`, run in their own terminal. The Google Cloud consent screen must stay "In production", or the refresh token expires after 7 days and uploads fail.

Listing text and assets for the store dashboard live in `store/`.

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
