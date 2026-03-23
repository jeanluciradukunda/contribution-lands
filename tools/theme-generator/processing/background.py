"""
Adaptive chroma key background removal with alpha matting.

AI generators often DON'T produce exact #00FF00 — they generate "a green
background" which can be any shade. This module:
  1. Auto-detects the actual background color from image corners
  2. Uses color distance from that detected bg for the core mask
  3. Applies alpha matting at edges (not binary on/off)
  4. Decontaminates green spill from semi-transparent edge pixels
  5. Smooths the alpha channel for clean compositing

This handles Gemini/Nano Banana output which typically produces
backgrounds around R=8, G=167, B=42 instead of pure #00FF00.
"""

from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter


def _detect_bg_color(pixels, sample_size=20):
    """Auto-detect background color by sampling image corners.

    Returns the median color of corner pixels as (R, G, B) float array.
    """
    h, w = pixels.shape[:2]
    s = min(sample_size, h // 4, w // 4)

    corners = np.concatenate([
        pixels[:s, :s].reshape(-1, 3),      # top-left
        pixels[:s, -s:].reshape(-1, 3),      # top-right
        pixels[-s:, :s].reshape(-1, 3),      # bottom-left
        pixels[-s:, -s:].reshape(-1, 3),     # bottom-right
    ])

    return np.median(corners, axis=0)


def remove_green_background(input_path, output_path):
    """Remove green background with adaptive detection and alpha matting.

    Pipeline:
      1. Detect actual background color from corners
      2. Color-distance-based mask for definite background
      3. Edge zone alpha matting for anti-aliased pixels
      4. Color decontamination on edge pixels only
      5. Alpha smoothing for clean compositing

    Returns True on success, False on failure.
    """
    try:
        img = Image.open(input_path).convert("RGB")
        pixels = np.array(img, dtype=np.float64)
        h, w = pixels.shape[:2]

        # ============================================================
        #  STEP 1: Detect actual background color
        # ============================================================

        bg_color = _detect_bg_color(pixels)
        print(f"    Detected bg: R={bg_color[0]:.0f} G={bg_color[1]:.0f} B={bg_color[2]:.0f}")

        # ============================================================
        #  STEP 2: Color distance mask
        # ============================================================
        #
        # Compute per-pixel euclidean distance from detected bg color.
        # Close to bg → transparent. Far from bg → opaque.

        diff = pixels - bg_color[np.newaxis, np.newaxis, :]
        dist = np.sqrt(np.sum(diff ** 2, axis=2))

        # Thresholds based on distance from bg
        # These are tuned for AI-generated sprites where the bg is fairly uniform
        TIGHT_THRESHOLD = 30    # Definite background — very close to bg color
        LOOSE_THRESHOLD = 80    # Edge zone — could be bg or blended

        bg_mask = dist < TIGHT_THRESHOLD
        edge_candidate = (dist >= TIGHT_THRESHOLD) & (dist < LOOSE_THRESHOLD)

        # ============================================================
        #  STEP 3: Edge zone detection
        # ============================================================
        #
        # Not all pixels in the loose range are edges — only those
        # ADJACENT to background pixels. Interior pixels with similar
        # colors should stay fully opaque.

        bg_u8 = (bg_mask.astype(np.uint8) * 255)
        bg_img = Image.fromarray(bg_u8, mode='L')

        # Dilate bg mask by 4px to find the edge band
        dilated = bg_img.filter(ImageFilter.MaxFilter(9))
        near_bg = np.array(dilated) > 127

        # Edge zone: within loose threshold AND adjacent to background
        edge_zone = edge_candidate & near_bg & (~bg_mask)

        # ============================================================
        #  STEP 4: Compute alpha
        # ============================================================

        alpha = np.ones((h, w), dtype=np.float64)
        alpha[bg_mask] = 0.0

        # Edge pixels: alpha scales linearly with distance from bg
        # At TIGHT_THRESHOLD: alpha ≈ 0 (mostly bg)
        # At LOOSE_THRESHOLD: alpha ≈ 1 (mostly fg)
        edge_dist = dist[edge_zone]
        edge_alpha = (edge_dist - TIGHT_THRESHOLD) / (LOOSE_THRESHOLD - TIGHT_THRESHOLD)
        edge_alpha = np.clip(edge_alpha, 0.0, 1.0)
        alpha[edge_zone] = edge_alpha

        # ============================================================
        #  STEP 5: Color decontamination (edge pixels only)
        # ============================================================
        #
        # Semi-transparent edge pixels have bg color mixed in.
        # Remove it: F = (C - (1-α)·B) / α

        fg = pixels.copy()

        decontam = edge_zone & (alpha > 0.05) & (alpha < 0.95)
        if np.any(decontam):
            a = alpha[decontam]
            for ch in range(3):
                c = pixels[:, :, ch][decontam]
                bg_ch = bg_color[ch]
                cleaned = (c - (1.0 - a) * bg_ch) / np.maximum(a, 0.05)
                fg[:, :, ch][decontam] = cleaned

        fg = np.clip(fg, 0, 255)

        # ============================================================
        #  STEP 6: Alpha smoothing
        # ============================================================

        alpha_u8 = (alpha * 255).astype(np.uint8)
        alpha_img = Image.fromarray(alpha_u8, mode='L')
        # Gentle blur for smooth edges
        alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=0.7))
        alpha_final = np.array(alpha_img, dtype=np.float64) / 255.0

        # Kill any near-zero alpha pixels (cleanup noise)
        alpha_final[alpha_final < 0.02] = 0.0

        # ============================================================
        #  STEP 7: Final green fringe suppression
        # ============================================================
        #
        # After all the above, some edge pixels may still have a green
        # tint (G dominates R and B). For these, suppress green toward
        # the average of R and B, and reduce alpha slightly.

        fg_r, fg_g, fg_b = fg[:, :, 0], fg[:, :, 1], fg[:, :, 2]
        # Two-pass green suppression:
        # Pass 1: semi-transparent pixels with any green excess → nuke hard
        semi = (alpha_final > 0.01) & (alpha_final < 0.85)
        green_excess = fg_g - np.maximum(fg_r, fg_b)
        fringe_soft = semi & (green_excess > 8)

        if np.any(fringe_soft):
            avg_rb = (fg_r[fringe_soft] + fg_b[fringe_soft]) / 2.0
            fg[:, :, 1][fringe_soft] = avg_rb
            alpha_final[fringe_soft] *= 0.3

        # Pass 2: even opaque-ish edge pixels with green tint → desaturate green
        near_edge = (alpha_final > 0.85) & (alpha_final < 0.98)
        fringe_hard = near_edge & (green_excess > 12)

        if np.any(fringe_hard):
            avg_rb = (fg_r[fringe_hard] + fg_b[fringe_hard]) / 2.0
            fg[:, :, 1][fringe_hard] = avg_rb + (fg_g[fringe_hard] - avg_rb) * 0.2

        # ============================================================
        #  STEP 8: White outline removal
        # ============================================================
        #
        # Our prompt used to request a white outline. Even without it,
        # AI generators sometimes add a light border. Strip near-white
        # semi-transparent edge pixels by fading them out.

        fg_r, fg_g, fg_b = fg[:, :, 0], fg[:, :, 1], fg[:, :, 2]
        brightness = (fg_r + fg_g + fg_b) / 3.0
        low_saturation = (np.max(fg[:, :, :3], axis=2) - np.min(fg[:, :, :3], axis=2)) < 40

        # Gemini bakes a white outline INTO the artwork (fully opaque bright
        # pixels at the object boundary). Erode these away completely.
        from scipy import ndimage as _ndi
        opaque_mask = alpha_final > 0.5
        eroded = _ndi.binary_erosion(opaque_mask, iterations=1)
        boundary = opaque_mask & ~eroded  # 1px outer ring of the object

        # Kill bright/white boundary pixels (the baked-in outline)
        white_boundary = boundary & (brightness > 160) & low_saturation
        alpha_final[white_boundary] = 0.0

        # Also fade any semi-transparent white-ish pixels near edges
        white_semi = (alpha_final > 0.01) & (alpha_final < 0.9) & (brightness > 160) & low_saturation
        alpha_final[white_semi] = 0.0

        # ============================================================
        #  STEP 9: Assemble and save
        # ============================================================

        result = np.zeros((h, w, 4), dtype=np.uint8)
        result[:, :, 0] = np.clip(fg[:, :, 0], 0, 255).astype(np.uint8)
        result[:, :, 1] = np.clip(fg[:, :, 1], 0, 255).astype(np.uint8)
        result[:, :, 2] = np.clip(fg[:, :, 2], 0, 255).astype(np.uint8)
        result[:, :, 3] = (alpha_final * 255).astype(np.uint8)

        out_img = Image.fromarray(result, mode='RGBA')
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        out_img.save(str(output_path))
        return True

    except Exception as e:
        print(f"  ✗ Background removal failed: {e}")
        import traceback
        traceback.print_exc()
        return False
