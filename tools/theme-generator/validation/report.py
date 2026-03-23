"""Generate a self-contained HTML visual review report for all sprites."""

import base64
from pathlib import Path
from datetime import datetime

from PIL import Image
import io

from . import config as cfg
from .sprite_analyzer import analyze_raw_sprite, analyze_clean_sprite


def _img_to_base64(path, max_size=128):
    """Load image, resize to thumbnail, return base64 data URI."""
    try:
        img = Image.open(path).convert("RGBA")
        img.thumbnail((max_size, max_size * 2), Image.LANCZOS)  # Allow tall sprites
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        return f"data:image/png;base64,{b64}"
    except Exception:
        return ""


def generate_report(sprites_dir=None, output_path=None, thumbnail_size=128):
    """Generate HTML validation report.

    Args:
        sprites_dir: Path to sprites directory
        output_path: Where to write the HTML report
        thumbnail_size: Max dimension for embedded thumbnails
    """
    sprites_dir = Path(sprites_dir) if sprites_dir else cfg.SPRITES_DIR
    if output_path is None:
        output_path = sprites_dir.parent / "reports" / "validation_report.html"

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Collect all analysis results
    theme_results = {}
    total_pass = 0
    total_fail = 0

    for theme_name in cfg.THEME_NAMES:
        theme_data = {"levels": {}, "pass": 0, "fail": 0}

        for level in cfg.LEVELS:
            level_data = []

            for variant in cfg.VARIANTS:
                raw_p = cfg.raw_path(sprites_dir, theme_name, level, variant)
                clean_p = cfg.clean_path(sprites_dir, theme_name, level, variant)

                entry = {
                    "variant": variant,
                    "raw_exists": raw_p.exists(),
                    "clean_exists": clean_p.exists(),
                    "raw_thumb": "",
                    "clean_thumb": "",
                    "raw_analysis": None,
                    "clean_analysis": None,
                    "failures": [],
                }

                if raw_p.exists():
                    entry["raw_thumb"] = _img_to_base64(raw_p, thumbnail_size)
                    entry["raw_analysis"] = analyze_raw_sprite(raw_p)
                    entry["failures"].extend(entry["raw_analysis"].failures)

                if clean_p.exists():
                    entry["clean_thumb"] = _img_to_base64(clean_p, thumbnail_size)
                    entry["clean_analysis"] = analyze_clean_sprite(clean_p)
                    entry["failures"].extend(entry["clean_analysis"].failures)

                if entry["raw_exists"] or entry["clean_exists"]:
                    if entry["failures"]:
                        theme_data["fail"] += 1
                        total_fail += 1
                    else:
                        theme_data["pass"] += 1
                        total_pass += 1

                    level_data.append(entry)

            if level_data:
                theme_data["levels"][level] = level_data

        if theme_data["levels"]:
            theme_results[theme_name] = theme_data

    # Build HTML
    html = _build_html(theme_results, total_pass, total_fail)
    output_path.write_text(html)
    print(f"Report saved: {output_path}")
    return output_path


def _build_html(theme_results, total_pass, total_fail):
    total = total_pass + total_fail
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    rows_html = []
    for theme_name, theme_data in theme_results.items():
        rows_html.append(f"""
        <div class="theme-section">
            <h2>{theme_name}
                <span class="badge pass">{theme_data['pass']} pass</span>
                <span class="badge fail">{theme_data['fail']} fail</span>
            </h2>
            <div class="sprite-grid">
        """)

        for level in sorted(theme_data["levels"].keys()):
            for entry in theme_data["levels"][level]:
                failed_class = "failed" if entry["failures"] else ""
                failures_html = ""
                if entry["failures"]:
                    failures_html = '<div class="failures">' + "<br>".join(entry["failures"]) + "</div>"

                raw_img = f'<img src="{entry["raw_thumb"]}" alt="raw">' if entry["raw_thumb"] else '<div class="no-img">no raw</div>'
                clean_img = f'<img src="{entry["clean_thumb"]}" alt="clean">' if entry["clean_thumb"] else '<div class="no-img">no clean</div>'

                rows_html.append(f"""
                <div class="sprite-card {failed_class}">
                    <div class="sprite-label">L{level}-{entry['variant']}</div>
                    <div class="sprite-pair">
                        <div class="sprite-img">{raw_img}<span>raw</span></div>
                        <div class="sprite-img">{clean_img}<span>clean</span></div>
                    </div>
                    {failures_html}
                </div>
                """)

        rows_html.append("</div></div>")

    body = "\n".join(rows_html)

    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Contribution Lands Sprite Validation Report</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ background: #0d1117; color: #e6edf3; font-family: -apple-system, sans-serif; padding: 24px; }}
  h1 {{ margin-bottom: 8px; }}
  .summary {{ color: #8b949e; margin-bottom: 24px; }}
  .badge {{ font-size: 13px; padding: 2px 8px; border-radius: 12px; margin-left: 8px; }}
  .badge.pass {{ background: #1a4d2e; color: #3fb950; }}
  .badge.fail {{ background: #4d1a1a; color: #f85149; }}
  .theme-section {{ margin-bottom: 32px; border: 1px solid #30363d; border-radius: 8px; padding: 16px; }}
  .theme-section h2 {{ margin-bottom: 12px; font-size: 18px; }}
  .sprite-grid {{ display: flex; flex-wrap: wrap; gap: 12px; }}
  .sprite-card {{
    background: #161b22; border: 1px solid #30363d; border-radius: 6px;
    padding: 8px; width: 160px; text-align: center;
  }}
  .sprite-card.failed {{ border-color: #f85149; border-width: 2px; }}
  .sprite-label {{ font-size: 12px; font-weight: 600; margin-bottom: 4px; color: #8b949e; }}
  .sprite-pair {{ display: flex; gap: 4px; justify-content: center; }}
  .sprite-img {{ display: flex; flex-direction: column; align-items: center; }}
  .sprite-img img {{ max-width: 64px; max-height: 128px; image-rendering: pixelated; background: repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 50%/16px 16px; }}
  .sprite-img span {{ font-size: 10px; color: #8b949e; }}
  .no-img {{ width: 64px; height: 64px; background: #21262d; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #484f58; }}
  .failures {{ font-size: 11px; color: #f85149; margin-top: 6px; padding-top: 6px; border-top: 1px solid #30363d; text-align: left; }}
</style></head><body>
<h1>Contribution Lands Sprite Validation Report</h1>
<p class="summary">{timestamp} — {total} sprites analyzed: <span style="color:#3fb950">{total_pass} passed</span>, <span style="color:#f85149">{total_fail} failed</span></p>
{body}
</body></html>"""
