"""Base prompt template shared across all themes."""

BASE_SUFFIX = (
    "Low-poly 3D render, clean colors, {lighting} from top-left, "
    "SimCity 2000 / RollerCoaster Tycoon game asset style. "
    "Single isolated object centered on solid #00FF00 chroma green background. "
    "White 2px outline around the object. No ground shadow. No text. No labels. "
    "Strict isometric projection, 2:1 pixel ratio."
)


def build_full_prompt(prompt, lighting):
    """Assemble a complete generation prompt from subject + lighting."""
    return f"Strict isometric projection, 2:1 ratio. {prompt} {BASE_SUFFIX.format(lighting=lighting)}"
