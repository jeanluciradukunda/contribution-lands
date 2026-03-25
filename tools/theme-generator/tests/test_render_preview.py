"""Tests for tools/render-preview.py CLI tool."""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

# Add tools/ to path so we can import render-preview as a module
TOOLS_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(TOOLS_DIR))

import importlib.util

_spec = importlib.util.spec_from_file_location(
    "render_preview",
    TOOLS_DIR / "render-preview.py",
)
render_preview = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(render_preview)

# Convenience aliases
load_sprites = render_preview.load_sprites
generate_contributions = render_preview.generate_contributions
render = render_preview.render
build_parser = render_preview.build_parser
discover_themes = render_preview.discover_themes
_parse_hex_color = render_preview._parse_hex_color

REPO_ROOT = TOOLS_DIR.parent
THEMES_DIR = REPO_ROOT / "themes"
NYC_SPRITES_DIR = THEMES_DIR / "city-nyc" / "sprites"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_fake_sprites(tmp_path: Path, levels=(0, 1, 2, 3, 4)) -> Path:
    """Create a minimal theme directory with one 128×128 RGBA sprite per level."""
    sprites_dir = tmp_path / "fake-theme" / "sprites"
    sprites_dir.mkdir(parents=True)
    for lvl in levels:
        img = Image.new("RGBA", (128, 128), (100, 100, 100, 255))
        img.save(sprites_dir / f"level-{lvl}-a.png")
    return tmp_path / "fake-theme"


# ---------------------------------------------------------------------------
# load_sprites
# ---------------------------------------------------------------------------


@pytest.mark.skipif(
    not NYC_SPRITES_DIR.exists(),
    reason="city-nyc sprites not present",
)
def test_load_sprites_city_nyc():
    sprites = load_sprites(THEMES_DIR / "city-nyc")
    assert set(sprites.keys()) == {0, 1, 2, 3, 4}
    for lvl, imgs in sprites.items():
        assert len(imgs) > 0, f"Level {lvl} has no sprites"
        for img in imgs:
            assert img.mode == "RGBA"


def test_load_sprites_fake_theme(tmp_path):
    theme_dir = _make_fake_sprites(tmp_path)
    sprites = load_sprites(theme_dir)
    assert set(sprites.keys()) == {0, 1, 2, 3, 4}
    for lvl in range(5):
        assert len(sprites[lvl]) == 1


def test_load_sprites_missing_sprites_dir(tmp_path):
    (tmp_path / "empty-theme").mkdir()
    with pytest.raises(FileNotFoundError, match="No sprites/"):
        load_sprites(tmp_path / "empty-theme")


def test_load_sprites_road_sprites_excluded(tmp_path):
    sprites_dir = tmp_path / "road-theme" / "sprites"
    sprites_dir.mkdir(parents=True)
    for lvl in range(5):
        img = Image.new("RGBA", (128, 128), (50, 50, 50, 255))
        img.save(sprites_dir / f"level-{lvl}-a.png")
        # Road sprite that should be excluded
        img.save(sprites_dir / f"level-{lvl}-road-ew.png")
    sprites = load_sprites(tmp_path / "road-theme")
    for lvl in range(5):
        assert len(sprites[lvl]) == 1, f"Level {lvl} should have exactly 1 non-road sprite"


def test_load_sprites_missing_levels_raises(tmp_path):
    # Only create sprites for levels 0 and 1 — missing 2, 3, 4
    theme_dir = _make_fake_sprites(tmp_path, levels=(0, 1))
    with pytest.raises(ValueError, match="missing sprites for levels"):
        load_sprites(theme_dir)


# ---------------------------------------------------------------------------
# generate_contributions / pattern generators
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "pattern",
    ["realistic", "busy", "sparse", "gradient", "random"],
)
def test_pattern_shape(pattern):
    weeks = 10
    grid = generate_contributions(pattern, weeks=weeks, seed=42)
    assert len(grid) == weeks
    for row in grid:
        assert len(row) == 7
        for val in row:
            assert 0 <= val <= 4


def test_pattern_realistic_reproducible():
    a = generate_contributions("realistic", weeks=4, seed=99)
    b = generate_contributions("realistic", weeks=4, seed=99)
    assert a == b


def test_pattern_busy_all_high():
    grid = generate_contributions("busy", weeks=8, seed=1)
    for row in grid:
        for val in row:
            assert val >= 3


def test_pattern_sparse_mostly_low():
    grid = generate_contributions("sparse", weeks=52, seed=7)
    flat = [v for row in grid for v in row]
    low = sum(1 for v in flat if v <= 1)
    assert low / len(flat) >= 0.55, "Sparse pattern should have >55% cells at level 0-1"


def test_pattern_gradient_progression():
    grid = generate_contributions("gradient", weeks=5, seed=0)
    levels = [row[0] for row in grid]
    assert levels[0] == 0
    assert levels[-1] == 4
    # Levels should be non-decreasing
    assert levels == sorted(levels)


def test_pattern_unknown_raises():
    with pytest.raises(SystemExit):
        generate_contributions("invalid-pattern", weeks=4, seed=0)


def test_pattern_real_requires_username():
    with pytest.raises(SystemExit, match="--username"):
        generate_contributions("real", weeks=4, seed=0, username=None)


# ---------------------------------------------------------------------------
# render
# ---------------------------------------------------------------------------


def test_render_returns_image(tmp_path):
    theme_dir = _make_fake_sprites(tmp_path)
    sprites = load_sprites(theme_dir)
    contributions = generate_contributions("gradient", weeks=4, seed=0)
    img = render(contributions, sprites, tile_width=32, background=None, seed=0)
    assert isinstance(img, Image.Image)
    assert img.width > 0
    assert img.height > 0


def test_render_with_background(tmp_path):
    theme_dir = _make_fake_sprites(tmp_path)
    sprites = load_sprites(theme_dir)
    contributions = generate_contributions("gradient", weeks=4, seed=0)
    img = render(contributions, sprites, tile_width=32, background="#ff0000", seed=0)
    # With a background color, no fully-transparent pixels should be in the main area
    r, g, b, a = img.getpixel((0, 0))
    assert a == 255, "Background fill should make image fully opaque"


def test_render_larger_tile_gives_bigger_image(tmp_path):
    theme_dir = _make_fake_sprites(tmp_path)
    sprites = load_sprites(theme_dir)
    contributions = generate_contributions("gradient", weeks=4, seed=0)
    small = render(contributions, sprites, tile_width=32, background=None, seed=0)
    large = render(contributions, sprites, tile_width=64, background=None, seed=0)
    assert large.width > small.width or large.height > small.height


def test_render_empty_grid(tmp_path):
    theme_dir = _make_fake_sprites(tmp_path)
    sprites = load_sprites(theme_dir)
    img = render([], sprites, tile_width=32, background=None, seed=0)
    assert isinstance(img, Image.Image)


# ---------------------------------------------------------------------------
# _parse_hex_color
# ---------------------------------------------------------------------------


def test_parse_hex_color_six_digit():
    assert _parse_hex_color("#ff0000") == (255, 0, 0, 255)


def test_parse_hex_color_three_digit():
    assert _parse_hex_color("#f00") == (255, 0, 0, 255)


def test_parse_hex_color_eight_digit():
    assert _parse_hex_color("#ff000080") == (255, 0, 0, 128)


def test_parse_hex_color_invalid():
    with pytest.raises(ValueError):
        _parse_hex_color("#zzz")


# ---------------------------------------------------------------------------
# CLI / argparse
# ---------------------------------------------------------------------------


def test_parser_theme_arg():
    parser = build_parser()
    args = parser.parse_args(["--theme", "city-nyc"])
    assert args.theme == "city-nyc"
    assert not args.all


def test_parser_all_flag():
    parser = build_parser()
    args = parser.parse_args(["--all"])
    assert args.all


def test_parser_defaults():
    parser = build_parser()
    args = parser.parse_args(["--theme", "city-nyc"])
    assert args.weeks == 52
    assert args.tile_width == 64
    assert args.seed == 42
    assert args.pattern == "realistic"
    assert args.output is None
    assert args.background is None
    assert args.username is None


def test_parser_theme_and_all_mutually_exclusive():
    parser = build_parser()
    with pytest.raises(SystemExit):
        parser.parse_args(["--theme", "city-nyc", "--all"])


def test_parser_accepts_all_options():
    parser = build_parser()
    args = parser.parse_args(
        [
            "--theme", "city-nyc",
            "--output", "out.png",
            "--weeks", "12",
            "--tile-width", "96",
            "--seed", "7",
            "--pattern", "busy",
            "--background", "#0a0e14",
        ]
    )
    assert args.output == "out.png"
    assert args.weeks == 12
    assert args.tile_width == 96
    assert args.seed == 7
    assert args.pattern == "busy"
    assert args.background == "#0a0e14"


# ---------------------------------------------------------------------------
# discover_themes
# ---------------------------------------------------------------------------


def test_discover_themes_returns_list():
    themes = discover_themes()
    assert isinstance(themes, list)
    # city-nyc should always be present (has sprites)
    assert "city-nyc" in themes


# ---------------------------------------------------------------------------
# Integration: full CLI invocation (single theme, no network)
# ---------------------------------------------------------------------------


@pytest.mark.skipif(
    not NYC_SPRITES_DIR.exists(),
    reason="city-nyc sprites not present",
)
def test_main_single_theme(tmp_path):
    out = tmp_path / "out.png"
    render_preview.main(
        [
            "--theme", "city-nyc",
            "--weeks", "4",
            "--pattern", "gradient",
            "--output", str(out),
        ]
    )
    assert out.exists()
    img = Image.open(out)
    assert img.width > 0
    assert img.height > 0


@pytest.mark.skipif(
    not NYC_SPRITES_DIR.exists(),
    reason="city-nyc sprites not present",
)
def test_main_all_mode(tmp_path):
    render_preview.main(
        [
            "--all",
            "--weeks", "4",
            "--pattern", "gradient",
            "--output-dir", str(tmp_path / "previews"),
        ]
    )
    # At least city-nyc should have been rendered
    assert (tmp_path / "previews" / "city-nyc.png").exists()


@pytest.mark.skipif(
    not NYC_SPRITES_DIR.exists(),
    reason="city-nyc sprites not present",
)
def test_main_with_background(tmp_path):
    out = tmp_path / "bg.png"
    render_preview.main(
        [
            "--theme", "city-nyc",
            "--weeks", "2",
            "--pattern", "gradient",
            "--background", "#0a0e14",
            "--output", str(out),
        ]
    )
    assert out.exists()
    img = Image.open(out)
    r, g, b, a = img.getpixel((0, 0))
    assert a == 255
