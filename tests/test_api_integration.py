"""Layer 1: API Integration Tests — verify Gemini API connectivity and image generation."""

import os
import pytest
from pathlib import Path

pytestmark = pytest.mark.api


def test_api_key_present():
    """API key must be set in environment."""
    assert os.environ.get("GOOGLE_API_KEY"), (
        "GOOGLE_API_KEY not set. Get one free at https://aistudio.google.com/apikey"
    )


def test_client_creation(gemini_client):
    """Client should be creatable with the API key."""
    assert gemini_client is not None


def test_single_image_generation(gemini_client):
    """Generate a minimal test image and verify response structure."""
    from google.genai import types
    from scripts.generate_sprites import MODEL

    response = gemini_client.models.generate_content(
        model=MODEL,
        contents="A simple red cube on solid #00FF00 green background, isometric view, centered",
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
        ),
    )

    assert response.parts, "Response should have parts"

    found_image = False
    for part in response.parts:
        if part.inline_data is not None:
            found_image = True
            assert part.inline_data.mime_type.startswith("image/"), (
                f"Expected image mime type, got {part.inline_data.mime_type}"
            )
            break

    assert found_image, "Response should contain at least one image"


def test_image_save_roundtrip(gemini_client, tmp_path):
    """Generate, save, and re-open an image to verify integrity."""
    from google.genai import types
    from PIL import Image
    from scripts.generate_sprites import MODEL

    response = gemini_client.models.generate_content(
        model=MODEL,
        contents="A small green tree on solid #00FF00 green background, isometric, centered",
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
        ),
    )

    saved = False
    for part in response.parts:
        if part.inline_data is not None:
            image = part.as_image()
            save_path = tmp_path / "test_sprite.png"
            image.save(str(save_path))

            # Re-open and verify
            reloaded = Image.open(save_path)
            assert reloaded.size[0] > 0
            assert reloaded.size[1] > 0
            assert reloaded.mode in ("RGB", "RGBA")
            saved = True
            break

    assert saved, "Should have saved an image"
