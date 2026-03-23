"""Layer 2: Per-sprite quality validation (parametrized over all discovered sprites)."""

import pytest
from validation.config import discover_raw_sprites, discover_clean_sprites, get_theme_from_path
from validation.sprite_analyzer import analyze_raw_sprite, analyze_clean_sprite


# ---- Raw sprite tests ----

def _get_raw_sprites():
    sprites = discover_raw_sprites()
    if not sprites:
        pytest.skip("No raw sprites found — run generate_sprites.py first")
    return sprites


def _sprite_id(path):
    return f"{get_theme_from_path(path)}/{path.name}"


raw_sprites = _get_raw_sprites() if discover_raw_sprites() else []
clean_sprites = discover_clean_sprites() if discover_clean_sprites() else []


@pytest.mark.skipif(not raw_sprites, reason="No raw sprites found")
@pytest.mark.parametrize("sprite_path", raw_sprites, ids=_sprite_id)
def test_raw_sprite_valid_image(sprite_path, thresholds):
    analysis = analyze_raw_sprite(sprite_path, thresholds)
    assert analysis.is_valid_image, f"Invalid image: {sprite_path}"


@pytest.mark.skipif(not raw_sprites, reason="No raw sprites found")
@pytest.mark.parametrize("sprite_path", raw_sprites, ids=_sprite_id)
def test_raw_sprite_dimensions(sprite_path, thresholds):
    analysis = analyze_raw_sprite(sprite_path, thresholds)
    assert analysis.width >= thresholds.MIN_DIMENSION, f"Too narrow: {analysis.width}px"
    assert analysis.height >= thresholds.MIN_DIMENSION, f"Too short: {analysis.height}px"


@pytest.mark.skipif(not raw_sprites, reason="No raw sprites found")
@pytest.mark.parametrize("sprite_path", raw_sprites, ids=_sprite_id)
def test_raw_sprite_has_green_bg(sprite_path, thresholds):
    analysis = analyze_raw_sprite(sprite_path, thresholds)
    assert analysis.green_pixel_ratio >= thresholds.MIN_GREEN_RATIO, (
        f"Not enough green bg: {analysis.green_pixel_ratio:.1%} (min {thresholds.MIN_GREEN_RATIO:.0%})"
    )


@pytest.mark.skipif(not raw_sprites, reason="No raw sprites found")
@pytest.mark.parametrize("sprite_path", raw_sprites, ids=_sprite_id)
def test_raw_sprite_has_object(sprite_path, thresholds):
    analysis = analyze_raw_sprite(sprite_path, thresholds)
    assert analysis.object_pixel_ratio >= thresholds.MIN_OBJECT_RATIO, (
        f"Object too small or missing: {analysis.object_pixel_ratio:.1%}"
    )


@pytest.mark.skipif(not raw_sprites, reason="No raw sprites found")
@pytest.mark.parametrize("sprite_path", raw_sprites, ids=_sprite_id)
def test_raw_sprite_centered(sprite_path, thresholds):
    analysis = analyze_raw_sprite(sprite_path, thresholds)
    assert analysis.center_offset_magnitude <= thresholds.MAX_CENTER_OFFSET, (
        f"Object off-center: {analysis.center_offset_magnitude:.2f} (max {thresholds.MAX_CENTER_OFFSET})"
    )


@pytest.mark.skipif(not raw_sprites, reason="No raw sprites found")
@pytest.mark.parametrize("sprite_path", raw_sprites, ids=_sprite_id)
def test_raw_sprite_all_checks(sprite_path, thresholds):
    """Combined check — reports all failures at once."""
    analysis = analyze_raw_sprite(sprite_path, thresholds)
    assert analysis.passed, f"Failures: {', '.join(analysis.failures)}"


# ---- Clean sprite tests ----

@pytest.mark.skipif(not clean_sprites, reason="No clean sprites found")
@pytest.mark.parametrize("sprite_path", clean_sprites, ids=_sprite_id)
def test_clean_sprite_all_checks(sprite_path, thresholds):
    """Combined check for clean sprites."""
    analysis = analyze_clean_sprite(sprite_path, thresholds=thresholds)
    assert analysis.passed, f"Failures: {', '.join(analysis.failures)}"
