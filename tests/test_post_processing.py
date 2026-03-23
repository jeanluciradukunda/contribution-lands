"""Layer 5: Post-processing validation — transparency, fringe, integrity."""

import pytest
import numpy as np
from PIL import Image

from validation.config import discover_clean_sprites, get_theme_from_path
from validation.sprite_analyzer import analyze_clean_sprite


def _get_clean_sprites():
    return discover_clean_sprites()


def _sprite_id(path):
    return f"{get_theme_from_path(path)}/{path.name}"


clean_sprites = _get_clean_sprites()


@pytest.mark.skipif(not clean_sprites, reason="No clean sprites found")
@pytest.mark.parametrize("sprite_path", clean_sprites, ids=_sprite_id)
def test_has_alpha_channel(sprite_path):
    img = Image.open(sprite_path)
    assert img.mode == "RGBA" or "A" in img.getbands(), (
        f"Clean sprite should have alpha channel, got mode={img.mode}"
    )


@pytest.mark.skipif(not clean_sprites, reason="No clean sprites found")
@pytest.mark.parametrize("sprite_path", clean_sprites, ids=_sprite_id)
def test_transparent_background(sprite_path, thresholds):
    img = Image.open(sprite_path).convert("RGBA")
    arr = np.array(img)
    transparent = np.sum(arr[:, :, 3] == 0)
    total = arr.shape[0] * arr.shape[1]
    ratio = transparent / total
    assert ratio >= thresholds.MIN_TRANSPARENCY_RATIO, (
        f"Not enough transparency: {ratio:.1%} (min {thresholds.MIN_TRANSPARENCY_RATIO:.0%})"
    )


@pytest.mark.skipif(not clean_sprites, reason="No clean sprites found")
@pytest.mark.parametrize("sprite_path", clean_sprites, ids=_sprite_id)
def test_object_exists(sprite_path):
    img = Image.open(sprite_path).convert("RGBA")
    arr = np.array(img)
    object_pixels = np.sum(arr[:, :, 3] > 0)
    assert object_pixels > 100, (
        f"Clean sprite has too few visible pixels: {object_pixels}"
    )


@pytest.mark.skipif(not clean_sprites, reason="No clean sprites found")
@pytest.mark.parametrize("sprite_path", clean_sprites, ids=_sprite_id)
def test_no_green_fringe(sprite_path, thresholds):
    """Check that edges of the object don't have green color bleeding."""
    analysis = analyze_clean_sprite(sprite_path, thresholds=thresholds)
    assert analysis.green_fringe_ratio <= thresholds.MAX_GREEN_FRINGE_RATIO, (
        f"Green fringe detected: {analysis.green_fringe_ratio:.1%} "
        f"(max {thresholds.MAX_GREEN_FRINGE_RATIO:.0%})"
    )
