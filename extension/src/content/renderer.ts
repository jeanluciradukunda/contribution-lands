/**
 * Isometric sprite renderer for the contribution grid.
 *
 * Takes parsed GitHub contribution data + theme sprites and renders
 * a depth-sorted isometric scene on a canvas element.
 */

// ============================================================
//  TYPES
// ============================================================

export interface ContributionData {
  date: string;
  week: number;     // column (0-51)
  day: number;      // row (0-6)
  level: 0 | 1 | 2 | 3 | 4;
  count: number;
}

interface ThemeConfig {
  name: string;
  background: string;
  ground_colors: string[];
  ground_stroke: string;
}

// ============================================================
//  CONSTANTS
// ============================================================

const TILE_W = 20;
const TILE_H = 10;
const SPRITE_SCALE = 0.16;

// Road grid
const ROAD_INTERVAL = 6;
const CROSS_STREETS = [0, 3, 6];

// ============================================================
//  SEEDED RANDOM
// ============================================================

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
//  ISOMETRIC MATH
// ============================================================

function isoProject(col: number, row: number) {
  return {
    x: (col - row) * (TILE_W / 2),
    y: (col + row) * (TILE_H / 2),
  };
}

// ============================================================
//  RENDERER
// ============================================================

export class IsoRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private theme: ThemeConfig;
  private sprites: Record<number, HTMLImageElement[]>;
  private gridOffsetX = 0;
  private gridOffsetY = 0;
  private weeks = 0;
  private days = 7;
  // Grid indexed by [week][day]
  private grid: (ContributionData | null)[][] = [];

  constructor(
    canvas: HTMLCanvasElement,
    contributions: ContributionData[],
    theme: ThemeConfig,
    sprites: Record<number, HTMLImageElement[]>,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.theme = theme;
    this.sprites = sprites;

    // Build grid from flat contribution array
    this.weeks = Math.max(...contributions.map((c) => c.week)) + 1;
    this.grid = Array.from({ length: this.weeks }, () => Array(this.days).fill(null));
    for (const c of contributions) {
      if (c.week < this.weeks && c.day < this.days) {
        this.grid[c.week][c.day] = c;
      }
    }
  }

  private gridToScreen(col: number, row: number) {
    const iso = isoProject(col, row);
    return {
      x: iso.x + this.gridOffsetX,
      y: iso.y + this.gridOffsetY,
    };
  }

  private isRoadCell(w: number, d: number): boolean {
    return (w % ROAD_INTERVAL === 0) || CROSS_STREETS.includes(d);
  }

  private drawIsoDiamond(
    cx: number, cy: number,
    w: number, h: number,
    fill: string, stroke?: string,
  ) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2);
    ctx.lineTo(cx + w / 2, cy);
    ctx.lineTo(cx, cy + h / 2);
    ctx.lineTo(cx - w / 2, cy);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  private drawRoadNetwork() {
    const ctx = this.ctx;

    // Avenues (columns)
    for (let w = 0; w < this.weeks; w += ROAD_INTERVAL) {
      const f = this.gridToScreen(w, 0);
      const l = this.gridToScreen(w, this.days - 1);
      ctx.beginPath();
      ctx.moveTo(f.x, f.y - TILE_H / 2);
      ctx.lineTo(f.x + TILE_W / 2, f.y);
      ctx.lineTo(l.x + TILE_W / 2, l.y);
      ctx.lineTo(l.x, l.y + TILE_H / 2);
      ctx.lineTo(l.x - TILE_W / 2, l.y);
      ctx.lineTo(f.x - TILE_W / 2, f.y);
      ctx.closePath();
      ctx.fillStyle = '#505058';
      ctx.fill();

      // Center dashes
      ctx.strokeStyle = '#ccbb44';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(l.x, l.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Cross streets (rows)
    for (const d of CROSS_STREETS) {
      const f = this.gridToScreen(0, d);
      const l = this.gridToScreen(this.weeks - 1, d);
      ctx.beginPath();
      ctx.moveTo(f.x, f.y - TILE_H / 2);
      ctx.lineTo(l.x + TILE_W / 2, l.y);
      ctx.lineTo(l.x, l.y + TILE_H / 2);
      ctx.lineTo(f.x - TILE_W / 2, f.y);
      ctx.closePath();
      ctx.fillStyle = '#505058';
      ctx.fill();

      // Center dashes
      ctx.strokeStyle = '#ccbb44';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(l.x, l.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  render() {
    const ctx = this.ctx;
    const weeks = this.weeks;
    const days = this.days;

    // Calculate canvas size
    const maxIso = isoProject(weeks - 1, 0);
    const minIso = isoProject(0, days - 1);
    const padding = 60;
    const topPadding = 120;
    const canvasW = (maxIso.x - minIso.x) + TILE_W + padding * 2;
    const canvasH = (isoProject(weeks - 1, days - 1).y - isoProject(0, 0).y) + TILE_H + padding * 2 + topPadding;

    this.canvas.width = canvasW;
    this.canvas.height = canvasH;
    this.gridOffsetX = -minIso.x + TILE_W / 2 + padding;
    this.gridOffsetY = padding + topPadding;

    // Background
    // Transparent background — adapts to GitHub's light/dark mode
    ctx.clearRect(0, 0, canvasW, canvasH);

    // Layer 1: Ground diamonds
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < days; d++) {
        if (!this.isRoadCell(w, d)) {
          const scr = this.gridToScreen(w, d);
          const gc = this.theme.ground_colors[((w + d) * 7 + w) % this.theme.ground_colors.length];
          this.drawIsoDiamond(scr.x, scr.y, TILE_W, TILE_H, gc, this.theme.ground_stroke);
        }
      }
    }

    // Layer 2: Road network
    this.drawRoadNetwork();

    // Layer 3: Depth-sorted sprites
    const drawList: { depth: number; w: number; d: number }[] = [];
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < days; d++) {
        drawList.push({ depth: w + d, w, d });
      }
    }
    drawList.sort((a, b) => a.depth - b.depth);

    for (const { w, d } of drawList) {
      // Skip road cells
      if (this.isRoadCell(w, d)) continue;

      const cell = this.grid[w]?.[d];
      if (!cell || cell.level === 0) continue;

      const levelSprites = this.sprites[cell.level];
      if (!levelSprites || levelSprites.length === 0) continue;

      const scr = this.gridToScreen(w, d);
      const rng = mulberry32((w * 7 + d) * 31337 + 12345);
      const sprite = levelSprites[Math.floor(rng() * levelSprites.length)];

      const sw = sprite.width * SPRITE_SCALE;
      const sh = sprite.height * SPRITE_SCALE;
      const sx = scr.x - sw / 2;
      const sy = scr.y - sh + TILE_H / 4;

      ctx.drawImage(sprite, sx, sy, sw, sh);
    }

    // Add tooltip handler
    this.setupTooltip();
  }

  private setupTooltip() {
    let tooltip: HTMLElement | null = document.getElementById('cl-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'cl-tooltip';
      tooltip.style.cssText = `
        position: fixed; background: #1c2128; border: 1px solid #30363d;
        border-radius: 6px; padding: 6px 10px; font-size: 12px;
        color: #e6edf3; pointer-events: none; display: none;
        z-index: 10000; white-space: nowrap;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      `;
      document.body.appendChild(tooltip);
    }

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (this.canvas.height / rect.height);

      // Find which cell the mouse is over
      let found: ContributionData | null = null;
      for (let w = this.weeks - 1; w >= 0; w--) {
        for (let d = this.days - 1; d >= 0; d--) {
          const scr = this.gridToScreen(w, d);
          const dx = Math.abs(mx - scr.x) / (TILE_W / 2);
          const dy = Math.abs(my - scr.y) / (TILE_H / 2);
          if (dx + dy <= 1) {
            found = this.grid[w]?.[d] ?? null;
            break;
          }
        }
        if (found) break;
      }

      if (found && tooltip) {
        const date = new Date(found.date);
        const dateStr = date.toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        });
        tooltip.innerHTML = `<strong>${found.count} contribution${found.count !== 1 ? 's' : ''}</strong> on ${dateStr}`;
        tooltip.style.display = 'block';
        tooltip.style.left = `${e.clientX + 12}px`;
        tooltip.style.top = `${e.clientY - 30}px`;
      } else if (tooltip) {
        tooltip.style.display = 'none';
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      if (tooltip) tooltip.style.display = 'none';
    });
  }
}
