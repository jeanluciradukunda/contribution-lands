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

// Entity config
const MAX_TAXIS = 4;
const MAX_PEOPLE = 8;
const MAX_BIRDS = 3;
const TAXI_SPEED = 0.04;
const PERSON_SPEED = 0.015;
const BIRD_SPEED = 0.03;

// ============================================================
//  ENTITY TYPES
// ============================================================

type CellType = 'road' | 'sidewalk' | 'building';

interface Entity {
  col: number;
  row: number;
  dcol: number;
  drow: number;
  type: 'taxi' | 'person' | 'bird';
  color: string;
  frame: number;
  flyHeight: number;
}

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
      // Skip road cells — they're drawn as parallelograms
      if (this.isRoadCell(w, d)) continue;

      const cell = this.grid[w]?.[d];
      if (!cell) continue;

      // Pick sprite: L0 cells get parks/trees/sidewalks, L1-4 get buildings
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

    // Build cell type map and spawn entities
    this.buildCellMap();
    this.spawnEntities();
    this.setupTooltip();

    // Start animation loop
    this.animate();
  }

  // ============================================================
  //  CELL TYPE MAP — what's at each grid position
  // ============================================================

  private cellMap: CellType[][] = [];
  private entities: Entity[] = [];
  private animId: number | null = null;

  private buildCellMap() {
    this.cellMap = Array.from({ length: this.weeks }, () =>
      Array(this.days).fill('sidewalk' as CellType)
    );
    for (let w = 0; w < this.weeks; w++) {
      for (let d = 0; d < this.days; d++) {
        if (this.isRoadCell(w, d)) {
          this.cellMap[w][d] = 'road';
        } else if (this.grid[w]?.[d] && this.grid[w][d]!.level > 0) {
          this.cellMap[w][d] = 'building';
        } else {
          this.cellMap[w][d] = 'sidewalk';
        }
      }
    }
  }

  // ============================================================
  //  ENTITY SPAWNING — place on valid cells
  // ============================================================

  private spawnEntities() {
    this.entities = [];
    const rng = mulberry32(88888);

    // Taxis on roads
    for (let i = 0; i < MAX_TAXIS; i++) {
      const roadCells = this.getRoadCells();
      if (roadCells.length === 0) break;
      const cell = roadCells[Math.floor(rng() * roadCells.length)];
      // Pick direction along the road
      const isAvenue = cell.w % ROAD_INTERVAL === 0;
      this.entities.push({
        col: cell.w, row: cell.d,
        dcol: isAvenue ? 0 : TAXI_SPEED * (rng() > 0.5 ? 1 : -1),
        drow: isAvenue ? TAXI_SPEED * (rng() > 0.5 ? 1 : -1) : 0,
        type: 'taxi', color: '#ffd700', frame: 0, flyHeight: 0,
      });
    }

    // People on sidewalks
    for (let i = 0; i < MAX_PEOPLE; i++) {
      const sidewalkCells = this.getSidewalkCells();
      if (sidewalkCells.length === 0) break;
      const cell = sidewalkCells[Math.floor(rng() * sidewalkCells.length)];
      const angle = rng() * Math.PI * 2;
      const colors = ['#4488cc', '#cc4444', '#44aa44', '#ddaa33', '#aa44aa', '#666'];
      this.entities.push({
        col: cell.w, row: cell.d,
        dcol: Math.cos(angle) * PERSON_SPEED,
        drow: Math.sin(angle) * PERSON_SPEED,
        type: 'person', color: colors[Math.floor(rng() * colors.length)],
        frame: 0, flyHeight: 0,
      });
    }

    // Birds overhead
    for (let i = 0; i < MAX_BIRDS; i++) {
      this.entities.push({
        col: rng() * this.weeks, row: rng() * this.days,
        dcol: BIRD_SPEED * (rng() > 0.5 ? 1 : -1),
        drow: BIRD_SPEED * (rng() - 0.5) * 0.5,
        type: 'bird', color: '#333', frame: 0,
        flyHeight: 15 + rng() * 20,
      });
    }
  }

  private getRoadCells(): { w: number; d: number }[] {
    const cells: { w: number; d: number }[] = [];
    for (let w = 0; w < this.weeks; w++)
      for (let d = 0; d < this.days; d++)
        if (this.cellMap[w]?.[d] === 'road') cells.push({ w, d });
    return cells;
  }

  private getSidewalkCells(): { w: number; d: number }[] {
    const cells: { w: number; d: number }[] = [];
    for (let w = 0; w < this.weeks; w++)
      for (let d = 0; d < this.days; d++)
        if (this.cellMap[w]?.[d] === 'sidewalk') cells.push({ w, d });
    return cells;
  }

  // ============================================================
  //  ENTITY MOVEMENT — respects map structure
  // ============================================================

  private updateEntities() {
    for (const e of this.entities) {
      e.frame++;

      const nextCol = e.col + e.dcol;
      const nextRow = e.row + e.drow;

      if (e.type === 'taxi') {
        // Taxis stay on roads. If next cell isn't road, reverse or turn
        const nw = Math.round(nextCol);
        const nd = Math.round(nextRow);
        if (nw >= 0 && nw < this.weeks && nd >= 0 && nd < this.days) {
          if (this.cellMap[nw]?.[nd] === 'road') {
            e.col = nextCol;
            e.row = nextRow;
          } else {
            // Try turning at intersection
            if (e.dcol !== 0) { e.dcol = 0; e.drow = TAXI_SPEED * (Math.random() > 0.5 ? 1 : -1); }
            else { e.drow = 0; e.dcol = TAXI_SPEED * (Math.random() > 0.5 ? 1 : -1); }
          }
        } else {
          // Reverse at grid edge
          e.dcol = -e.dcol;
          e.drow = -e.drow;
        }
        // Wrap
        if (e.col < 0) e.col = this.weeks - 1;
        if (e.col >= this.weeks) e.col = 0;
        if (e.row < 0) e.row = this.days - 1;
        if (e.row >= this.days) e.row = 0;

      } else if (e.type === 'person') {
        // People stay on sidewalks. Wander, avoid buildings and roads
        const nw = Math.round(nextCol);
        const nd = Math.round(nextRow);
        if (nw >= 0 && nw < this.weeks && nd >= 0 && nd < this.days &&
            this.cellMap[nw]?.[nd] === 'sidewalk') {
          e.col = nextCol;
          e.row = nextRow;
        } else {
          // Random new direction
          const angle = Math.random() * Math.PI * 2;
          e.dcol = Math.cos(angle) * PERSON_SPEED;
          e.drow = Math.sin(angle) * PERSON_SPEED;
        }
        // Keep in bounds
        e.col = Math.max(0, Math.min(this.weeks - 1, e.col));
        e.row = Math.max(0, Math.min(this.days - 1, e.row));

      } else if (e.type === 'bird') {
        // Birds fly freely, bob up and down
        e.col += e.dcol;
        e.row += e.drow;
        e.flyHeight = 15 + Math.sin(e.frame * 0.03) * 8;
        // Wrap around
        if (e.col < -2) e.col = this.weeks + 1;
        if (e.col > this.weeks + 2) e.col = -1;
        if (e.row < -1) e.row = this.days;
        if (e.row > this.days + 1) e.row = -1;
      }
    }
  }

  // ============================================================
  //  ENTITY DRAWING — tiny scale-appropriate sprites
  // ============================================================

  private drawEntity(e: Entity) {
    const ctx = this.ctx;
    const scr = this.gridToScreen(e.col, e.row);
    const x = scr.x;
    const y = scr.y - e.flyHeight;

    ctx.save();

    if (e.type === 'taxi') {
      // Yellow rectangle, ~4x2px
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(x - 2, y - 1.5, 4, 2);
      // Windshield
      ctx.fillStyle = '#88bbdd';
      ctx.fillRect(x + (e.dcol >= 0 ? 1 : -2), y - 1, 1, 1);
    } else if (e.type === 'person') {
      // Tiny colored dot with head
      ctx.fillStyle = e.color;
      ctx.fillRect(x - 0.5, y - 2, 1, 2);
      // Head
      ctx.fillStyle = '#ddbba0';
      ctx.beginPath();
      ctx.arc(x, y - 2.5, 0.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'bird') {
      // V-shape with flapping
      const wing = Math.sin(e.frame * 0.5) * 0.5;
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x - 2, y + wing * 2);
      ctx.lineTo(x, y);
      ctx.lineTo(x + 2, y + wing * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ============================================================
  //  ANIMATION LOOP
  // ============================================================

  private staticImage: ImageData | null = null;

  private captureStatic() {
    // Capture the static rendered frame so we don't re-render sprites every tick
    this.staticImage = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  private animate() {
    // Capture the static scene on first frame
    if (!this.staticImage) {
      this.captureStatic();
    }

    const loop = () => {
      // Restore static background
      if (this.staticImage) {
        this.ctx.putImageData(this.staticImage, 0, 0);
      }

      // Update and draw entities
      this.updateEntities();

      // Sort by depth for proper overlap
      const sorted = [...this.entities].sort((a, b) => (a.col + a.row) - (b.col + b.row));
      for (const e of sorted) {
        this.drawEntity(e);
      }

      this.animId = requestAnimationFrame(loop);
    };

    loop();
  }

  destroy() {
    if (this.animId) cancelAnimationFrame(this.animId);
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
