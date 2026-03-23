"""Central registry of all available themes and their prompts."""

from .base import build_full_prompt
from . import forest_summer, forest_autumn, forest_winter, forest_spring
from . import city_nyc, city_paris, city_capetown

THEMES = {
    "forest-summer": forest_summer.THEME,
    "forest-autumn": forest_autumn.THEME,
    "forest-winter": forest_winter.THEME,
    "forest-spring": forest_spring.THEME,
    "city-nyc": city_nyc.THEME,
    "city-paris": city_paris.THEME,
    "city-capetown": city_capetown.THEME,
}

THEME_NAMES = list(THEMES.keys())


def get_theme(name):
    """Get a theme's config by name."""
    return THEMES.get(name)


def get_prompt_for(theme_name, level, variant_idx):
    """Get the full assembled prompt for a specific sprite.

    Returns (full_prompt, lighting) or (None, None) if not found.
    """
    theme = THEMES.get(theme_name)
    if not theme:
        return None, None
    prompts = theme["levels"].get(level, [])
    if variant_idx >= len(prompts):
        return None, None
    return build_full_prompt(prompts[variant_idx], theme["lighting"]), theme["lighting"]
