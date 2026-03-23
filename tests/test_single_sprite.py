"""Quick smoke test: generate ONE sprite end-to-end and validate it."""

import pytest
from pathlib import Path

pytestmark = pytest.mark.api


def test_generate_and_validate_single_sprite(gemini_client, tmp_path, thresholds):
    """End-to-end: generate a forest-summer level-1-a sprite, clean it, validate both."""
    from scripts.generate_sprites import (
        get_prompt_for, generate_sprite, remove_green_background
    )
    from validation.sprite_analyzer import analyze_raw_sprite, analyze_clean_sprite

    # Generate
    full_prompt, lighting = get_prompt_for("forest-summer", 1, 0)
    assert full_prompt is not None, "Should find prompt for forest-summer level 1 variant 0"

    raw_path = tmp_path / "raw" / "level-1-a.png"
    raw_path.parent.mkdir(parents=True, exist_ok=True)

    success = generate_sprite(gemini_client, full_prompt, raw_path)
    assert success, "Sprite generation should succeed"
    assert raw_path.exists(), "Raw sprite file should exist"

    # Validate raw
    raw_analysis = analyze_raw_sprite(raw_path, thresholds)
    print(f"\nRaw analysis: {raw_analysis}")
    assert raw_analysis.is_valid_image, "Should be a valid image"
    assert raw_analysis.width >= thresholds.MIN_DIMENSION, "Width should meet minimum"
    assert raw_analysis.height >= thresholds.MIN_DIMENSION, "Height should meet minimum"

    # Report but don't fail on soft checks during smoke test
    if not raw_analysis.passed:
        print(f"  WARNING - Raw sprite issues: {raw_analysis.failures}")

    # Clean
    clean_path = tmp_path / "clean" / "level-1-a.png"
    clean_path.parent.mkdir(parents=True, exist_ok=True)

    clean_success = remove_green_background(raw_path, clean_path)
    assert clean_success, "Background removal should succeed"
    assert clean_path.exists(), "Clean sprite file should exist"

    # Validate clean
    clean_analysis = analyze_clean_sprite(clean_path, raw_path=raw_path, thresholds=thresholds)
    print(f"\nClean analysis: {clean_analysis}")
    assert clean_analysis.is_valid_image, "Clean sprite should be valid"
    assert clean_analysis.has_alpha, "Clean sprite should have alpha channel"

    if not clean_analysis.passed:
        print(f"  WARNING - Clean sprite issues: {clean_analysis.failures}")

    # At minimum, the object should exist in the clean version
    assert clean_analysis.object_pixel_count > 0, "Clean sprite should contain an object"
