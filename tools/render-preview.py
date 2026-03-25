#!/usr/bin/env python3
"""
render-preview.py — CLI tool for rendering contribution graph previews.

Usage examples:
    python3 tools/render-preview.py --theme city-nyc --output docs/preview-nyc.png
    python3 tools/render-preview.py --all --output-dir docs/previews/
    python3 tools/render-preview.py --theme city-nyc --weeks 12 --output test.png
    python3 tools/render-preview.py --theme city-nyc --pattern busy
    python3 tools/render-preview.py --theme city-nyc --pattern gradient
    python3 tools/render-preview.py --theme city-nyc --pattern real --username jeanluciradukunda
    python3 tools/render-preview.py --theme city-nyc --tile-width 96 --output hero-hq.png
    python3 tools/render-preview.py --theme city-nyc --background "#0a0e14"
"""

import argparse
import json
import os
import random
import re
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required. Install it with: pip install Pillow")

# ---------------------------------------------------------------------------
# Repository layout
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).parent.resolve()
REPO_ROOT = SCRIPT_DIR.parent
THEMES_DIR = REPO_ROOT / "themes"

SPRITE_WIDTH = 128  # native width of every sprite PNG

# ---------------------------------------------------------------------------
# Sprite loading
# ---------------------------------------------------------------------------


def load_sprites(theme_dir: Path) -> dict[int, list[Image.Image]]:
    """Return {level: [PIL.Image, ...]} for levels 0-4, skipping road sprites."""
    sprites_dir = theme_dir / "sprites"
    if not sprites_dir.exists():
        raise FileNotFoundError(f"No sprites/ directory found in {theme_dir}")

    result: dict[int, list[Image.Image]] = {lvl: [] for lvl in range(5)}
    road_re = re.compile(r"level-\d+-road-")

    for png in sorted(sprites_dir.glob("level-*.png")):
        if road_re.search(png.name):
            continue
        m = re.match(r"level-(\d+)-", png.name)
        if m:
            lvl = int(m.group(1))
            if 0 <= lvl <= 4:
                img = Image.open(png).convert("RGBA")
                result[lvl].append(img)

    missing = [lvl for lvl, imgs in result.items() if not imgs]
    if missing:
        raise ValueError(
            f"Theme {theme_dir.name} is missing sprites for levels: {missing}. "
            "Make sure the theme has generated sprites before rendering."
        )
    return result


# ---------------------------------------------------------------------------
# Contribution-pattern generators
# ---------------------------------------------------------------------------


def _clamp(value: int, lo: int = 0, hi: int = 4) -> int:
    return max(lo, min(hi, value))


def pattern_realistic(weeks: int, seed: int) -> list[list[int]]:
    """Busy weekdays, quiet weekends, occasional vacation gaps."""
    rng = random.Random(seed)
    grid: list[list[int]] = []
    for w in range(weeks):
        week_row: list[int] = []
        is_vacation = rng.random() < 0.08
        is_busy_week = rng.random() < 0.35
        for d in range(7):
            if is_vacation:
                level = 0 if rng.random() < 0.85 else 1
            elif d >= 5:  # weekend
                level = _clamp(rng.randint(0, 2))
            elif is_busy_week:
                level = _clamp(rng.randint(2, 4))
            else:
                level = _clamp(rng.randint(0, 4))
            week_row.append(level)
        grid.append(week_row)
    return grid


def pattern_busy(weeks: int, seed: int) -> list[list[int]]:
    """Heavy contributions every day (stress-test for tall sprites)."""
    rng = random.Random(seed)
    grid: list[list[int]] = []
    for _ in range(weeks):
        grid.append([_clamp(rng.randint(3, 4)) for _ in range(7)])
    return grid


def pattern_sparse(weeks: int, seed: int) -> list[list[int]]:
    """Mostly empty, occasional bursts (tests level-0 variety)."""
    rng = random.Random(seed)
    grid: list[list[int]] = []
    for _ in range(weeks):
        week_row: list[int] = []
        for _ in range(7):
            r = rng.random()
            if r < 0.60:
                level = 0
            elif r < 0.80:
                level = 1
            elif r < 0.92:
                level = 2
            elif r < 0.97:
                level = 3
            else:
                level = 4
            week_row.append(level)
        grid.append(week_row)
    return grid


def pattern_gradient(weeks: int, _seed: int) -> list[list[int]]:
    """Level 0 on the left, level 4 on the right (shows full progression)."""
    grid: list[list[int]] = []
    for w in range(weeks):
        # Map week index to a level 0-4 uniformly
        level = round(w / max(weeks - 1, 1) * 4)
        grid.append([level] * 7)
    return grid


def pattern_random(weeks: int, seed: int) -> list[list[int]]:
    """Uniform random across all levels."""
    rng = random.Random(seed)
    return [[rng.randint(0, 4) for _ in range(7)] for _ in range(weeks)]


_GITHUB_USERNAME_RE = re.compile(r"^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$")


def pattern_real(username: str, weeks: int) -> list[list[int]]:
    """Fetch actual GitHub contribution data via `gh` CLI."""
    if not _GITHUB_USERNAME_RE.match(username):
        sys.exit(
            f"Invalid GitHub username {username!r}. "
            "Usernames may only contain alphanumeric characters and hyphens, "
            "and must not start or end with a hyphen."
        )
    query = (
        "{ user(login: \"%s\") { contributionsCollection {"
        " contributionCalendar { weeks { contributionDays {"
        " contributionCount date } } } } } }" % username
    )
    try:
        result = subprocess.run(
            ["gh", "api", "graphql", "-f", f"query={query}"],
            capture_output=True,
            text=True,
            check=True,
        )
    except FileNotFoundError:
        sys.exit(
            "The 'gh' CLI is not installed or not on PATH. "
            "Install it from https://cli.github.com/"
        )
    except subprocess.CalledProcessError as exc:
        sys.exit(f"gh api call failed:\n{exc.stderr}")

    data = json.loads(result.stdout)
    try:
        gh_weeks = data["data"]["user"]["contributionsCollection"][
            "contributionCalendar"
        ]["weeks"]
    except (KeyError, TypeError):
        sys.exit(
            f"Unexpected response from GitHub API. "
            f"Check that user '{username}' exists and you are authenticated."
        )

    # Collect all counts to compute quartile thresholds
    counts: list[int] = []
    for wk in gh_weeks:
        for day in wk["contributionDays"]:
            counts.append(day["contributionCount"])

    counts_nonzero = sorted(c for c in counts if c > 0)

    def to_level(count: int) -> int:
        if count == 0:
            return 0
        if not counts_nonzero:
            return 0
        q1 = counts_nonzero[len(counts_nonzero) // 4]
        q2 = counts_nonzero[len(counts_nonzero) // 2]
        q3 = counts_nonzero[3 * len(counts_nonzero) // 4]
        if count <= q1:
            return 1
        if count <= q2:
            return 2
        if count <= q3:
            return 3
        return 4

    # Take the most-recent `weeks` weeks
    recent = gh_weeks[-weeks:] if len(gh_weeks) >= weeks else gh_weeks
    grid: list[list[int]] = []
    for wk in recent:
        week_row = [to_level(d["contributionCount"]) for d in wk["contributionDays"]]
        # Pad to 7 days if needed (partial first week)
        while len(week_row) < 7:
            week_row.insert(0, 0)
        grid.append(week_row)
    return grid


PATTERN_GENERATORS = {
    "realistic": pattern_realistic,
    "busy": pattern_busy,
    "sparse": pattern_sparse,
    "gradient": pattern_gradient,
    "random": pattern_random,
}


def generate_contributions(
    pattern: str,
    weeks: int,
    seed: int,
    username: str | None = None,
) -> list[list[int]]:
    """Build a weeks×7 grid of contribution levels (0-4)."""
    if pattern == "real":
        if not username:
            sys.exit("--username is required when --pattern real is used.")
        return pattern_real(username, weeks)
    gen = PATTERN_GENERATORS.get(pattern)
    if gen is None:
        sys.exit(
            f"Unknown pattern '{pattern}'. "
            f"Choose from: {', '.join(sorted(PATTERN_GENERATORS) + ['real'])}"
        )
    return gen(weeks, seed)


# ---------------------------------------------------------------------------
# Isometric renderer
# ---------------------------------------------------------------------------


def render(
    contributions: list[list[int]],
    sprites: dict[int, list[Image.Image]],
    tile_width: int,
    background: str | None,
    seed: int,
) -> Image.Image:
    """
    Render the contribution grid isometrically and return a cropped PIL Image.

    Coordinate system:
      - tile_w  = tile_width   (horizontal spacing)
      - tile_h  = tile_width // 2  (vertical spacing, 2:1 isometric)
      - iso_x   = (week - day) * tile_w / 2
      - iso_y   = (week + day) * tile_h / 2
    Render order: back-to-front (ascending week + day), so foreground sprites
    naturally overlap background ones.
    """
    rng = random.Random(seed + 1)

    num_weeks = len(contributions)
    num_days = max(len(row) for row in contributions) if contributions else 7

    tile_w = tile_width
    tile_h = tile_w // 2

    # Scale factor from native sprite width to tile width
    scale = tile_w / SPRITE_WIDTH

    # Estimate canvas size generously; we will crop later.
    # Extra headroom: sprites can be taller than they are wide; use 2× SPRITE_WIDTH.
    canvas_w = (num_weeks + num_days) * tile_w + SPRITE_WIDTH * 2
    canvas_h = (num_weeks + num_days) * tile_h + SPRITE_WIDTH * 2
    canvas = Image.new("RGBA", (int(canvas_w), int(canvas_h)), (0, 0, 0, 0))

    # Origin offset so negative iso_x values don't go off the left edge
    origin_x = num_days * tile_w // 2 + tile_w
    origin_y = tile_h + SPRITE_WIDTH

    # Build list of (sort_key, week, day, level) and sort back-to-front
    cells: list[tuple[int, int, int, int]] = []
    for w, week_row in enumerate(contributions):
        for d, level in enumerate(week_row):
            cells.append((w + d, w, d, level))
    cells.sort(key=lambda c: c[0])

    for _, w, d, level in cells:
        sprite_list = sprites[level]
        sprite_src = rng.choice(sprite_list)

        # Scale sprite to tile_width
        new_w = int(sprite_src.width * scale)
        new_h = int(sprite_src.height * scale)
        if new_w < 1 or new_h < 1:
            continue
        sprite = sprite_src.resize((new_w, new_h), Image.LANCZOS)

        # Isometric position (top-left of the bounding box)
        iso_x = (w - d) * tile_w / 2
        iso_y = (w + d) * tile_h / 2

        # Anchor: bottom-center of the sprite sits on the tile center
        paste_x = int(origin_x + iso_x - new_w / 2)
        paste_y = int(origin_y + iso_y - new_h)

        canvas.paste(sprite, (paste_x, paste_y), sprite)

    # Auto-crop transparent padding
    bbox = canvas.getbbox()
    if bbox is None:
        # Nothing was drawn; return a small blank image
        return Image.new("RGBA", (64, 32), (0, 0, 0, 0))

    margin = tile_w // 2
    x0 = max(bbox[0] - margin, 0)
    y0 = max(bbox[1] - margin, 0)
    x1 = min(bbox[2] + margin, canvas.width)
    y1 = min(bbox[3] + margin, canvas.height)
    cropped = canvas.crop((x0, y0, x1, y1))

    if background:
        bg_color = _parse_hex_color(background)
        bg = Image.new("RGBA", cropped.size, bg_color)
        bg.paste(cropped, (0, 0), cropped)
        return bg

    return cropped


def _parse_hex_color(hex_color: str) -> tuple[int, int, int, int]:
    """Parse a hex color string (#rgb, #rrggbb, #rrggbbaa) to an RGBA tuple."""
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) == 6:
        h += "ff"
    if len(h) != 8:
        raise ValueError(f"Invalid hex color: {hex_color!r}")
    r, g, b, a = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(h[6:8], 16)
    return (r, g, b, a)


# ---------------------------------------------------------------------------
# Per-theme render orchestration
# ---------------------------------------------------------------------------


def render_theme(
    theme_name: str,
    output_path: Path,
    weeks: int,
    tile_width: int,
    seed: int,
    pattern: str,
    username: str | None,
    background: str | None,
) -> None:
    """Load sprites, generate data, render, and save for a single theme."""
    theme_dir = THEMES_DIR / theme_name
    if not theme_dir.is_dir():
        raise FileNotFoundError(f"Theme directory not found: {theme_dir}")

    print(f"  Loading sprites from {theme_dir.name}/sprites/ …", end=" ", flush=True)
    sprites = load_sprites(theme_dir)
    total = sum(len(v) for v in sprites.values())
    print(f"{total} sprites loaded.")

    print(f"  Generating {weeks}×7 contribution grid (pattern={pattern}) …")
    contributions = generate_contributions(pattern, weeks, seed, username)

    print(f"  Rendering isometric grid (tile_width={tile_width}) …")
    image = render(contributions, sprites, tile_width, background, seed)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(str(output_path), "PNG")
    print(f"  ✓ Saved {output_path}  ({image.width}×{image.height} px)")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="render-preview.py",
        description="Render isometric contribution graph previews from any theme.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    source = p.add_mutually_exclusive_group(required=True)
    source.add_argument(
        "--theme",
        metavar="THEME",
        help="Theme directory name (e.g. city-nyc, forest-summer).",
    )
    source.add_argument(
        "--all",
        action="store_true",
        help="Render all themes found in the themes/ directory.",
    )

    p.add_argument(
        "--output",
        metavar="PATH",
        help="Output PNG path (default: preview-{theme}.png). "
        "Ignored when --all is used.",
    )
    p.add_argument(
        "--output-dir",
        metavar="DIR",
        default="docs/previews",
        help="Output directory for --all mode (default: docs/previews).",
    )
    p.add_argument(
        "--weeks",
        type=int,
        default=52,
        metavar="N",
        help="Number of weeks to render (default: 52).",
    )
    p.add_argument(
        "--tile-width",
        type=int,
        default=64,
        metavar="PX",
        help="Horizontal tile spacing in pixels (default: 64). "
        "Larger values produce higher-quality images.",
    )
    p.add_argument(
        "--seed",
        type=int,
        default=42,
        metavar="N",
        help="Random seed for reproducibility (default: 42).",
    )
    p.add_argument(
        "--pattern",
        default="realistic",
        choices=["realistic", "busy", "sparse", "gradient", "random", "real"],
        help="Contribution pattern to use (default: realistic).",
    )
    p.add_argument(
        "--username",
        metavar="USER",
        help="GitHub username — required when --pattern real.",
    )
    p.add_argument(
        "--background",
        metavar="HEX",
        help="Background color as a hex string (e.g. #0a0e14). "
        "Defaults to transparent.",
    )
    return p


def discover_themes() -> list[str]:
    """Return sorted list of theme directory names that contain a sprites/ dir."""
    if not THEMES_DIR.is_dir():
        sys.exit(f"Themes directory not found: {THEMES_DIR}")
    return sorted(
        d.name
        for d in THEMES_DIR.iterdir()
        if d.is_dir() and (d / "sprites").is_dir()
    )


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.all:
        themes = discover_themes()
        if not themes:
            sys.exit("No themes with sprites/ directories found.")
        output_dir = Path(args.output_dir)
        errors: list[str] = []
        for theme_name in themes:
            out = output_dir / f"{theme_name}.png"
            print(f"\n[{theme_name}]")
            try:
                render_theme(
                    theme_name=theme_name,
                    output_path=out,
                    weeks=args.weeks,
                    tile_width=args.tile_width,
                    seed=args.seed,
                    pattern=args.pattern,
                    username=args.username,
                    background=args.background,
                )
            except (FileNotFoundError, ValueError) as exc:
                print(f"  ✗ Skipped: {exc}")
                errors.append(f"{theme_name}: {exc}")
        if errors:
            print("\nThe following themes were skipped:")
            for e in errors:
                print(f"  • {e}")
    else:
        theme_name: str = args.theme
        output_path = Path(
            args.output if args.output else f"preview-{theme_name}.png"
        )
        print(f"\n[{theme_name}]")
        render_theme(
            theme_name=theme_name,
            output_path=output_path,
            weeks=args.weeks,
            tile_width=args.tile_width,
            seed=args.seed,
            pattern=args.pattern,
            username=args.username,
            background=args.background,
        )


if __name__ == "__main__":
    main()
