"""Layer 3: Within-theme consistency (scale progression, color palette, style)."""

import pytest
from validation.config import THEME_NAMES, SPRITES_DIR
from validation.theme_analyzer import check_scale_progression, check_color_consistency


def _themes_with_sprites():
    """Only test themes that have generated sprites."""
    themes = []
    for name in THEME_NAMES:
        clean_dir = SPRITES_DIR / name / "clean"
        if clean_dir.exists() and list(clean_dir.glob("level-*.png")):
            themes.append(name)
    return themes


available_themes = _themes_with_sprites()


@pytest.mark.skipif(not available_themes, reason="No sprites generated yet")
@pytest.mark.parametrize("theme_name", available_themes)
def test_scale_progression(theme_name):
    """Trees/buildings should get taller from level 1 to level 4."""
    result = check_scale_progression(SPRITES_DIR / theme_name)
    assert not result["violations"], (
        f"Scale violations in {theme_name}: {result['violations']}\n"
        f"Heights: {result['heights']}"
    )


@pytest.mark.skipif(not available_themes, reason="No sprites generated yet")
@pytest.mark.parametrize("theme_name", available_themes)
def test_color_consistency(theme_name):
    """Sprites within a theme should have a consistent color palette."""
    result = check_color_consistency(SPRITES_DIR / theme_name)
    assert not result.get("outliers"), (
        f"Color outliers in {theme_name}: {result['outliers']}\n"
        f"Divergences: {result.get('divergences', {})}"
    )
