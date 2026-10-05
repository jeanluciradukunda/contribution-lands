/**
 * Isometric sprite renderer for the contribution grid.
 *
 * World space is measured in tiles: gx runs along weeks, gy along weekdays.
 * City themes insert streets *between* blocks of cells, so every day of the
 * year keeps its own tile.
 */

export interface ContributionData {
  date: string;
  week: number;
  day: number;
  level: 0 | 1 | 2 | 3 | 4;
  count: number;
}

export interface ThemeConfig {
  name: string;
  category?: 'city' | 'forest';
  background: string;
  ground_colors: string[];
  ground_stroke: string;
  ui_accent?: string;
  entities?: Array<{ type: string; count: number; speed: number; flyer?: boolean }>;
  landmarks?: Array<{ sprite: string; name: string }>;
  park_sprites?: string[];
  today_sprite?: string;
  today_sprites?: string[];
}

export interface StreakSpan {
  length: number;
  start: string | null;
  end: string | null;
}

export interface Streaks {
  longest: StreakSpan;
  current: StreakSpan;
}

export interface Sprite {
  name: string;
  image: ImageBitmap;
}

export type SpriteSet = Record<number, Sprite[]>;

export interface RendererOptions {
  motion: boolean;
  /** Overlays (in canvas CSS px, measured from the top) that tall sprites must not hide behind. */
  obstacles?: () => Array<{ left: number; right: number; bottom: number }>;
  onSelect?: (date: string) => void;
  /** Construction sprites for today's lot: one per level, or a single one used only while today is empty. */
  today?: { date: string; stages: Array<ImageBitmap | null> };
  streaks?: Streaks;
}

const TW = 20;
const TH = 10;
const SLAB_DEPTH = 7;

const BLOCK_WEEKS = 6;
const STREET_BEFORE_DAY = 4;
const STREET = 0.5;

const BUILDING_WIDTH = 0.95;
/** Street furniture and park trees on empty city lots rise no more than this (world px), about a storey and a half. */
const LOT_MAX_RISE = 7;
const SHADOW_ALPHA = 0.35;
const FOREST_WIDTH = 1.25;

const FRAME_MS = 1000 / 30;
const VIADUCT_HEIGHT = 12;
const TRAIN_SPEED = 2.2;

const CAR_COLOURS = ['#c8453a', '#e9e6df', '#3569a8', '#41444b', '#7d8a96', '#2f7a5b'];
const TAXI_YELLOW = '#f0bf2c';

interface Cell {
  data: ContributionData;
  gx: number;
  gy: number;
  sprite: ImageBitmap | null;
  width: number;
  height: number;
  landmark: { name: string; rank: number } | null;
  underConstruction: boolean;
}

interface StreakPath {
  kind: 'longest' | 'current';
  span: StreakSpan;
  x0: number;
  x1: number;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Car {
  alongX: boolean;
  fixed: number;
  pos: number;
  dir: 1 | -1;
  speed: number;
  colour: string;
  lastTurn: number;
}

interface Flyer {
  gx: number;
  gy: number;
  vx: number;
  vy: number;
  alt: number;
  phase: number;
  butterfly: boolean;
  colour: string;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hex: string, factor: number): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const ch = (shift: number) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * factor)));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

function fmtDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

const iso = (gx: number, gy: number) => ({ x: (gx - gy) * (TW / 2), y: (gx + gy) * (TH / 2) });

export class IsoRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly theme: ThemeConfig;
  private readonly sprites: SpriteSet;
  private readonly isCity: boolean;
  private readonly weeks: number;
  private readonly margin: number;
  private readonly extentX: number;
  private readonly extentY: number;
  private readonly cells: Cell[] = [];
  private readonly blocks: Rect[] = [];
  private readonly avenues: number[] = [];
  private readonly streets: number[] = [];

  private motion: boolean;
  private readonly obstacles: RendererOptions['obstacles'];
  private scale = 1;
  private originX = 0;
  private originY = 0;
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;
  private ground: HTMLCanvasElement | null = null;

  private cars: Car[] = [];
  private flyers: Flyer[] = [];
  private hovered: Cell | null = null;
  private selected: Cell | null = null;
  private readonly muted = new Map<ImageBitmap, HTMLCanvasElement>();
  private readonly onSelect: RendererOptions['onSelect'];
  private streaks: Streaks | null;
  private streakPaths: StreakPath[] = [];
  private readonly hitPaths = new Map<StreakPath, Path2D>();
  private trainPos = 0;
  private trainDir: 1 | -1 = 1;
  private visible = true;
  private frameId: number | null = null;
  private lastFrame = 0;
  private elapsed = 0;
  private readonly alphaMasks = new Map<ImageBitmap, Uint8ClampedArray>();

  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver;
  private readonly tooltip: HTMLElement;
  private readonly cleanups: Array<() => void> = [];

  constructor(
    canvas: HTMLCanvasElement,
    contributions: ContributionData[],
    theme: ThemeConfig,
    sprites: SpriteSet,
    options: RendererOptions,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.theme = theme;
    this.sprites = sprites;
    this.isCity = theme.category === 'city';
    this.motion = options.motion;
    this.obstacles = options.obstacles;
    this.onSelect = options.onSelect;
    this.streaks = options.streaks ?? null;

    this.weeks = Math.max(...contributions.map((c) => c.week)) + 1;
    this.margin = this.isCity ? STREET : 0.35;
    this.extentX = this.gxOf(this.weeks - 1) + 1 + this.margin;
    this.extentY = this.gyOf(6) + 1 + this.margin;

    this.buildCells(contributions, options.today);
    this.buildStreets();
    this.buildStreakPaths();
    this.spawnEntities();

    this.tooltip = this.createTooltip();
    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.syncLoop();
    });
    this.intersectionObserver.observe(canvas);
    this.bindPointer();

    const onVisibility = () => this.syncLoop();
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));
  }

  // ------------------------------------------------------------
  //  Grid
  // ------------------------------------------------------------

  private gxOf(week: number): number {
    return this.margin + week + (this.isCity ? Math.floor(week / BLOCK_WEEKS) * STREET : 0);
  }

  private gyOf(day: number): number {
    return this.margin + day + (this.isCity && day >= STREET_BEFORE_DAY ? STREET : 0);
  }

  private buildCells(contributions: ContributionData[], today: RendererOptions['today']) {
    const byName = new Map<string, ImageBitmap>();
    for (const level of Object.values(this.sprites)) for (const sp of level) byName.set(sp.name, sp.image);
    const landmarks = (this.theme.landmarks ?? []).filter((l) => byName.has(l.sprite));
    const reserved = new Set(landmarks.map((l) => byName.get(l.sprite)));

    const ranked = contributions
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count || b.date.localeCompare(a.date));
    // A landmark is earned: it only lands on a day at least as tall as its own sprite's level.
    const landmarkFor = new Map<string, { sprite: string; name: string; rank: number }>();
    const unused = landmarks.map((l) => ({ ...l, needs: Number(l.sprite.match(/^level-(\d)/)?.[1] ?? 4) }));
    ranked.forEach((day, i) => {
      const pick = unused.findIndex((l) => day.level >= l.needs);
      if (pick < 0) return;
      const [landmark] = unused.splice(pick, 1);
      landmarkFor.set(day.date, { sprite: landmark.sprite, name: landmark.name, rank: i + 1 });
    });

    const parks = new Set((this.theme.park_sprites ?? []).map((name) => byName.get(name)).filter(Boolean));

    const widthFactor = this.isCity ? BUILDING_WIDTH : FOREST_WIDTH;
    for (const data of contributions) {
      const all = (this.sprites[data.level] ?? []).map((sp) => sp.image);
      const unreserved = all.filter((img) => !reserved.has(img));
      let pool = unreserved.length ? unreserved : all;
      if (data.level === 0 && parks.size) {
        const weekend = [0, 6].includes(new Date(`${data.date}T00:00:00Z`).getUTCDay());
        const matching = pool.filter((img) => parks.has(img) === weekend);
        if (matching.length) pool = matching;
      }
      const landmark = landmarkFor.get(data.date);
      const stage = data.date === today?.date ? (today.stages.length > 1 ? today.stages[data.level] : data.count === 0 ? today.stages[0] : null) : null;
      const underConstruction = Boolean(stage);
      const rng = mulberry32((data.week * 7 + data.day) * 31337 + 12345);
      const sprite = underConstruction
        ? stage!
        : landmark
          ? byName.get(landmark.sprite)!
          : pool.length
            ? pool[Math.floor(rng() * pool.length)]
            : null;
      const emptyLot = data.level === 0 && !landmark && !underConstruction;
      let factor = emptyLot ? 1 : widthFactor;
      if (emptyLot && this.isCity && sprite) {
        const rise = (sprite.height / sprite.width - TH / TW) * TW;
        if (rise > LOT_MAX_RISE) factor *= LOT_MAX_RISE / rise;
      }
      const width = TW * factor;
      this.cells.push({
        data,
        gx: this.gxOf(data.week),
        gy: this.gyOf(data.day),
        sprite,
        width,
        height: sprite ? width * (sprite.height / sprite.width) : 0,
        landmark: landmark ? { name: landmark.name, rank: landmark.rank } : null,
        underConstruction,
      });
    }
    this.cells.sort((a, b) => a.gx + a.gy - (b.gx + b.gy));
  }

  /** Clips each streak to the visible calendar and maps it to a run of weeks along the front street. */
  private buildStreakPaths() {
    this.streakPaths = [];
    if (!this.streaks) return;
    const byDate = new Map(this.cells.map((c) => [c.data.date, c]));
    const dates = [...byDate.keys()].sort();
    for (const kind of ['longest', 'current'] as const) {
      const span = this.streaks[kind];
      if (!span.length || !span.start || !span.end) continue;
      const start = byDate.get(span.start < dates[0] ? dates[0] : span.start);
      const end = byDate.get(span.end);
      if (!start || !end) continue;
      this.streakPaths.push({ kind, span, x0: start.gx, x1: end.gx + 1 });
    }
  }

  setStreaks(streaks: Streaks) {
    this.streaks = streaks;
    this.buildStreakPaths();
    if (this.cssWidth) this.layout();
  }

  private get frontStreet(): number {
    return this.extentY - this.margin / 2;
  }

  private buildStreets() {
    if (!this.isCity) {
      this.blocks.push({ x0: this.margin, y0: this.margin, x1: this.extentX - this.margin, y1: this.extentY - this.margin });
      return;
    }
    const half = STREET / 2;
    this.avenues.push(half);
    for (let w = BLOCK_WEEKS; w < this.weeks; w += BLOCK_WEEKS) this.avenues.push(this.gxOf(w) - half);
    this.avenues.push(this.extentX - half);
    this.streets.push(half, this.gyOf(STREET_BEFORE_DAY) - half, this.extentY - half);

    const rows: Array<[number, number]> = [[0, STREET_BEFORE_DAY - 1], [STREET_BEFORE_DAY, 6]];
    for (let w = 0; w < this.weeks; w += BLOCK_WEEKS) {
      const last = Math.min(w + BLOCK_WEEKS, this.weeks) - 1;
      for (const [first, end] of rows) {
        this.blocks.push({ x0: this.gxOf(w), y0: this.gyOf(first), x1: this.gxOf(last) + 1, y1: this.gyOf(end) + 1 });
      }
    }
  }

  // ------------------------------------------------------------
  //  Layout
  // ------------------------------------------------------------

  private layout() {
    const host = this.canvas.parentElement ?? this.canvas;
    const cssWidth = Math.round(host.clientWidth);
    if (cssWidth === 0) return;

    let top = 0;
    for (const c of this.cells) {
      const base = iso(c.gx + 0.5, c.gy + 0.5).y + (c.width / TW) * (TH / 2);
      top = Math.min(top, base - c.height);
    }
    const left = iso(0, this.extentY).x;
    const right = iso(this.extentX, 0).x;
    const bottom = iso(this.extentX, this.extentY).y + SLAB_DEPTH;

    const padX = 16;
    const padBottom = 28;
    this.scale = (cssWidth - padX * 2) / (right - left);
    this.originX = padX - left * this.scale;
    this.originY = 24 - top * this.scale;
    this.cssWidth = cssWidth;

    let padTop = 24;
    for (const o of this.obstacles?.() ?? []) {
      for (const c of this.cells) {
        if (!c.sprite) continue;
        const r = this.spriteRect(c);
        if (r.x + r.w > o.left && r.x < o.right) padTop = Math.max(padTop, 24 + o.bottom + 8 - r.y);
      }
    }
    this.originY = padTop - top * this.scale;
    this.cssHeight = Math.round((bottom - top) * this.scale + padTop + padBottom);
    this.dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);
    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;

    this.ground = this.renderGround();
    this.draw();
    this.syncLoop();
  }

  private toScreen(gx: number, gy: number) {
    const p = iso(gx, gy);
    return { x: this.originX + p.x * this.scale, y: this.originY + p.y * this.scale };
  }

  // ------------------------------------------------------------
  //  Static ground layer
  // ------------------------------------------------------------

  private renderGround(): HTMLCanvasElement {
    const layer = document.createElement('canvas');
    layer.width = this.canvas.width;
    layer.height = this.canvas.height;
    const ctx = layer.getContext('2d')!;
    ctx.scale(this.dpr, this.dpr);

    const [g0 = '#3a3a40'] = this.theme.ground_colors;
    const base = this.isCity ? '#2c2e34' : shade(g0, 0.8);
    this.drawSlab(ctx, base);

    for (const b of this.blocks) {
      this.fillQuad(ctx, b, this.isCity ? g0 : base);
    }

    if (this.isCity) this.drawRoadMarkings(ctx);
    this.drawShadows(ctx);
    this.drawCurrentStreak(ctx);

    ctx.strokeStyle = this.theme.ground_stroke;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 0.5;
    for (const c of this.cells) {
      this.pathQuad(ctx, { x0: c.gx, y0: c.gy, x1: c.gx + 1, y1: c.gy + 1 });
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return layer;
  }

  private drawSlab(ctx: CanvasRenderingContext2D, colour: string) {
    const X = this.extentX;
    const Y = this.extentY;
    const d = SLAB_DEPTH * this.scale;
    const a = this.toScreen(0, Y);
    const b = this.toScreen(X, Y);
    const c = this.toScreen(X, 0);

    ctx.fillStyle = shade(colour, 0.62);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x, b.y + d);
    ctx.lineTo(a.x, a.y + d);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = shade(colour, 0.45);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(c.x, c.y + d);
    ctx.lineTo(b.x, b.y + d);
    ctx.closePath();
    ctx.fill();

    this.fillQuad(ctx, { x0: 0, y0: 0, x1: X, y1: Y }, colour);

    // A faint rim keeps the slab's silhouette readable on dark page backgrounds.
    const o = this.toScreen(0, 0);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y + d);
    ctx.lineTo(b.x, b.y + d);
    ctx.lineTo(c.x, c.y + d);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(o.x, o.y);
    ctx.lineTo(a.x, a.y);
    ctx.closePath();
    ctx.stroke();
  }

  /**
   * Sprites are lit from the top left, so shadows fall towards +gx. They are
   * drawn opaque on their own layer and composited once, so overlaps do not darken.
   */
  private drawShadows(ctx: CanvasRenderingContext2D) {
    const layer = document.createElement('canvas');
    layer.width = this.canvas.width;
    layer.height = this.canvas.height;
    const sc = layer.getContext('2d')!;
    sc.scale(this.dpr, this.dpr);
    sc.fillStyle = '#000';

    for (const c of this.cells) {
      if (!c.sprite || (c.data.level === 0 && !c.landmark)) continue;
      const rise = c.height - (c.width / TW) * TH;
      if (rise <= 0) continue;
      const length = (rise / TH) * 0.45;
      const half = (c.width / TW) * 0.42;
      const cx = c.gx + 0.5;
      const cy = c.gy + 0.5;
      const pts = [
        this.toScreen(cx, cy - half),
        this.toScreen(cx + length, cy - half * 0.45 + length * 0.18),
        this.toScreen(cx + length, cy + half * 0.45 + length * 0.18),
        this.toScreen(cx, cy + half),
      ];
      sc.beginPath();
      sc.moveTo(pts[0].x, pts[0].y);
      for (const q of pts.slice(1)) sc.lineTo(q.x, q.y);
      sc.closePath();
      sc.fill();
    }

    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.globalCompositeOperation = 'destination-in';
    const clip = new Path2D();
    const corners = [this.toScreen(0, 0), this.toScreen(this.extentX, 0), this.toScreen(this.extentX, this.extentY), this.toScreen(0, this.extentY)];
    clip.moveTo(corners[0].x * this.dpr, corners[0].y * this.dpr);
    for (const q of corners.slice(1)) clip.lineTo(q.x * this.dpr, q.y * this.dpr);
    clip.closePath();
    sc.fill(clip);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = SHADOW_ALPHA;
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }

  private drawCurrentStreak(ctx: CanvasRenderingContext2D) {
    const path = this.streakPaths.find((p) => p.kind === 'current');
    if (!path) return;
    const y = this.frontStreet;
    const a = this.toScreen(path.x0, y);
    const b = this.toScreen(path.x1, y);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = this.theme.ui_accent ?? '#ffcc73';
    ctx.shadowColor = this.theme.ui_accent ?? '#ffcc73';
    ctx.shadowBlur = 6 * this.scale;
    ctx.lineWidth = Math.max(1.5, 0.22 * TH * this.scale);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();

    const hit = new Path2D();
    const w = 0.35;
    const q = [this.toScreen(path.x0, y - w), this.toScreen(path.x1, y - w), this.toScreen(path.x1, y + w), this.toScreen(path.x0, y + w)];
    hit.moveTo(q[0].x, q[0].y);
    for (const p of q.slice(1)) hit.lineTo(p.x, p.y);
    hit.closePath();
    this.hitPaths.set(path, hit);
  }

  /** An elevated railway over the weeks of the longest streak, in front of every building. */
  private drawViaduct() {
    const path = this.streakPaths.find((p) => p.kind === 'longest');
    if (!path) return;
    const ctx = this.ctx;
    const y = this.frontStreet;
    const h = this.isCity ? VIADUCT_HEIGHT : 3;
    const steel = this.isCity ? '#3e6650' : '#8a6a45';
    const half = 0.22;
    const lw = (k: number) => Math.max(0.5, k * this.scale);
    const pt = (gx: number, gy: number, z: number) => {
      const s = this.toScreen(gx, gy);
      return { x: s.x, y: s.y - z * this.scale };
    };
    const poly = (pts: Array<{ x: number; y: number }>, fill: string) => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const q of pts.slice(1)) ctx.lineTo(q.x, q.y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    const line = (a: { x: number; y: number }, b: { x: number; y: number }, colour: string, width: number) => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.stroke();
    };

    ctx.save();
    ctx.lineCap = 'round';
    const deckBottom = h - 1.6;

    if (this.isCity) {
      // Paired columns with a cross beam and knee braces, like the elevated lines.
      const bents: number[] = [];
      for (let x = path.x0 + 0.35; x < path.x1 - 0.1; x += 1.4) bents.push(x);
      for (const x of bents) {
        poly([pt(x - 0.05, y - half, 0), pt(x + 0.05, y - half, 0), pt(x + 0.05, y - half, deckBottom), pt(x - 0.05, y - half, deckBottom)], shade(steel, 0.5));
      }
      for (const x of bents) {
        poly([pt(x - 0.06, y + half, 0), pt(x + 0.06, y + half, 0), pt(x + 0.06, y + half, deckBottom), pt(x - 0.06, y + half, deckBottom)], shade(steel, 0.78));
        poly([pt(x + 0.06, y + half - 0.06, 0), pt(x + 0.06, y + half, 0), pt(x + 0.06, y + half, deckBottom), pt(x + 0.06, y + half - 0.06, deckBottom)], shade(steel, 0.6));
        line(pt(x, y + half, deckBottom - 2.2), pt(x - 0.45, y + half, deckBottom), shade(steel, 0.7), lw(0.22));
        line(pt(x, y + half, deckBottom - 2.2), pt(x + 0.45, y + half, deckBottom), shade(steel, 0.7), lw(0.22));
        line(pt(x, y - half, deckBottom - 0.3), pt(x, y + half, deckBottom - 0.3), shade(steel, 0.55), lw(0.3));
      }
    }

    // Girder deck: solid face, then a lattice of diagonals and a top and bottom chord.
    poly([pt(path.x0, y + half, deckBottom), pt(path.x1, y + half, deckBottom), pt(path.x1, y + half, h), pt(path.x0, y + half, h)], shade(steel, 0.72));
    poly([pt(path.x1, y - half, deckBottom), pt(path.x1, y + half, deckBottom), pt(path.x1, y + half, h), pt(path.x1, y - half, h)], shade(steel, 0.55));
    if (this.isCity) {
      const lattice = shade(steel, 1.45);
      for (let x = path.x0, up = true; x < path.x1 - 0.01; x += 0.3, up = !up) {
        const x2 = Math.min(path.x1, x + 0.3);
        line(pt(x, y + half, up ? deckBottom + 0.15 : h - 0.15), pt(x2, y + half, up ? h - 0.15 : deckBottom + 0.15), lattice, lw(0.16));
      }
      line(pt(path.x0, y + half, h - 0.08), pt(path.x1, y + half, h - 0.08), shade(steel, 1.25), lw(0.18));
      line(pt(path.x0, y + half, deckBottom + 0.05), pt(path.x1, y + half, deckBottom + 0.05), shade(steel, 0.5), lw(0.18));
    }
    poly([pt(path.x0, y - half, h), pt(path.x1, y - half, h), pt(path.x1, y + half, h), pt(path.x0, y + half, h)], shade(steel, 0.9));

    // Sleepers and rails.
    for (let x = path.x0 + 0.08; x < path.x1; x += 0.16) {
      line(pt(x, y - half * 0.8, h + 0.05), pt(x, y + half * 0.8, h + 0.05), '#4a3a2c', lw(0.13));
    }
    for (const r of [-0.09, 0.09]) line(pt(path.x0, y + r, h + 0.18), pt(path.x1, y + r, h + 0.18), '#b8bec4', lw(0.12));

    if (this.isCity) this.drawSubway(path, y, h, pt, poly, line);
    ctx.restore();

    const hit = new Path2D();
    const q = [pt(path.x0, y - half, h + 6), pt(path.x1, y - half, h + 6), pt(path.x1, y + half, 0), pt(path.x0, y + half, 0)];
    hit.moveTo(q[0].x, q[0].y);
    for (const p of q.slice(1)) hit.lineTo(p.x, p.y);
    hit.closePath();
    this.hitPaths.set(path, hit);
  }

  private readonly carTextures = new Map<number, HTMLCanvasElement>();

  /** One car side, painted once: ribbed steel, windows and doors, and a seeded graffiti piece. */
  private carTexture(seed: number): HTMLCanvasElement {
    const cached = this.carTextures.get(seed);
    if (cached) return cached;
    const W = 320;
    const H = 80;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d')!;
    const rng = mulberry32(seed);
    const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
    const palette = ['#ff3d8b', '#ffd23f', '#2ec4ff', '#7cf05a', '#ff7a2f', '#b56bff', '#ff2f2f', '#00e0b8'];

    const steel = g.createLinearGradient(0, 0, 0, H);
    steel.addColorStop(0, '#d9dde1');
    steel.addColorStop(1, '#a9b0b7');
    g.fillStyle = steel;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 1;
    for (let x = 4; x < W; x += 6) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }

    const windowsTop = 8;
    const windowsBottom = 30;
    const wholeCar = rng() < 0.4;
    for (let i = 0; i < 6; i++) {
      const x = 14 + i * 50;
      g.fillStyle = rng() < 0.75 ? '#ffd88a' : '#3b4148';
      g.fillRect(x, windowsTop, 30, windowsBottom - windowsTop);
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.strokeRect(x + 0.5, windowsTop + 0.5, 29, windowsBottom - windowsTop - 1);
    }
    g.strokeStyle = 'rgba(40,40,40,0.5)';
    for (const x of [66, 214]) {
      g.strokeRect(x, 6, 26, H - 8);
    }

    // The piece: a backdrop, extruded bubble letters with gradient fills, outlines and highlights.
    const top = wholeCar ? 4 : windowsBottom + 2;
    const words = ['LANDS', 'SHIP', 'PUSH', 'MERGE', 'NYC', 'STREAK', 'COMMIT', 'FORK', 'DIFF', 'BUILD'];
    const word = pick(words);
    const a = pick(palette);
    let b = pick(palette);
    if (b === a) b = palette[(palette.indexOf(a) + 3) % palette.length];
    const back = pick(palette);
    g.fillStyle = back + '55';
    g.beginPath();
    g.ellipse(W / 2, top + (H - top) / 2, W * 0.47, (H - top) * 0.55, 0, 0, Math.PI * 2);
    g.fill();

    const size = Math.min((H - top) * 1.05, (W * 0.9) / word.length * 1.45);
    g.font = `900 ${size}px "Arial Black", "Helvetica Neue", Impact, sans-serif`;
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    const total = g.measureText(word).width;
    let x = (W - total) / 2;
    const midY = top + (H - top) / 2 + 2;
    for (const ch of word) {
      const cw = g.measureText(ch).width;
      const tilt = (rng() - 0.5) * 0.35;
      const lift = (rng() - 0.5) * size * 0.18;
      g.save();
      g.translate(x + cw / 2, midY + lift);
      g.rotate(tilt);
      for (let d = 5; d > 0; d--) {
        g.fillStyle = '#1a1a1a';
        g.fillText(ch, -cw / 2 + d, d);
      }
      g.strokeStyle = '#111111';
      g.lineWidth = size * 0.16;
      g.strokeText(ch, -cw / 2, 0);
      const fill = g.createLinearGradient(0, -size / 2, 0, size / 2);
      fill.addColorStop(0, a);
      fill.addColorStop(1, b);
      g.fillStyle = fill;
      g.fillText(ch, -cw / 2, 0);
      g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.lineWidth = Math.max(1, size * 0.03);
      g.strokeText(ch, -cw / 2 - 1, -1);
      g.restore();
      x += cw * 0.92;
    }
    for (let i = 0; i < 6; i++) {
      const dx = 20 + rng() * (W - 40);
      g.strokeStyle = pick([a, b, '#111111']);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(dx, H - 14 - rng() * 10);
      g.lineTo(dx, H - 2);
      g.stroke();
    }
    g.strokeStyle = '#111111';
    g.lineWidth = 1.5;
    for (let t = 0; t < 2; t++) {
      g.beginPath();
      let tx = 10 + rng() * (W - 80);
      const ty = wholeCar ? H - 8 : windowsBottom - 4 + rng() * 2;
      g.moveTo(tx, ty);
      for (let k = 0; k < 8; k++) {
        tx += 4 + rng() * 4;
        g.lineTo(tx, ty + (rng() - 0.5) * 7);
      }
      g.stroke();
    }

    this.carTextures.set(seed, cv);
    return cv;
  }

  /** Silver subway cars covered in graffiti; each car's piece is seeded so it never flickers. */
  private drawSubway(
    path: StreakPath,
    y: number,
    h: number,
    pt: (gx: number, gy: number, z: number) => { x: number; y: number },
    poly: (pts: Array<{ x: number; y: number }>, fill: string) => void,
    line: (a: { x: number; y: number }, b: { x: number; y: number }, colour: string, width: number) => void,
  ) {
    const ctx = this.ctx;
    const span = path.x1 - path.x0;
    const carLength = 1.9;
    const gap = 0.07;
    const cars = Math.max(1, Math.min(4, Math.floor((span - 0.4) / (carLength + gap))));
    const trainLength = cars * carLength + (cars - 1) * gap;
    if (trainLength > span) return;
    const tail = path.x0 + 0.2 + Math.max(0, Math.min(1, this.trainPos)) * (span - trainLength - 0.4);
    const w = 0.13;
    const zb = h + 0.35;
    const zt = zb + 3.6;
    const lw = (k: number) => Math.max(0.5, k * this.scale);

    for (let c = 0; c < cars; c++) {
      const x0 = tail + c * (carLength + gap);
      const x1 = x0 + carLength;
      const at = (u: number, v: number) => pt(x0 + u * carLength, y + w, zb + v * (zt - zb));
      const side = [at(0, 0), at(1, 0), at(1, 1), at(0, 1)];

      poly([pt(x0, y - w, zt), pt(x1, y - w, zt), pt(x1, y + w, zt), pt(x0, y + w, zt)], '#9ea5ad');
      line(pt(x0 + 0.05, y, zt + 0.12), pt(x1 - 0.05, y, zt + 0.12), '#7d848c', lw(0.2));
      poly([pt(x1, y - w, zb), pt(x1, y + w, zb), pt(x1, y + w, zt), pt(x1, y - w, zt)], '#8c939b');
      const tex = this.carTexture(path.span.length * 101 + c * 7919 + 17);
      const p0 = side[0], p1 = side[1], p3 = side[3];
      ctx.save();
      ctx.transform(
        (p1.x - p0.x) / tex.width, (p1.y - p0.y) / tex.width,
        (p0.x - p3.x) / tex.height, (p0.y - p3.y) / tex.height,
        p3.x, p3.y,
      );
      ctx.drawImage(tex, 0, 0);
      ctx.restore();

      line(side[0], side[1], '#2a2d31', lw(0.14));
    }

    const leadX = this.trainDir === 1 ? tail + trainLength : tail;
    const trailX = this.trainDir === 1 ? tail : tail + trainLength;
    const glow = (gx: number, colour: string, r: number) => {
      const p = pt(gx, y + w, zb + 0.9);
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.8, r * this.scale), 0, Math.PI * 2);
      ctx.fill();
    };
    glow(leadX, '#fff3c4', 0.32);
    glow(trailX, '#ff4a3d', 0.24);
    const bullet = pt(tail + trainLength - 0.001, y, zt - 0.8);
    ctx.fillStyle = '#a626aa';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, Math.max(0.8, 0.35 * this.scale), 0, Math.PI * 2);
    ctx.fill();
  }

  private drawRoadMarkings(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.strokeStyle = 'rgba(232, 205, 120, 0.55)';
    ctx.lineWidth = Math.max(0.5, 0.06 * TH * this.scale);
    ctx.setLineDash([2 * this.scale, 3 * this.scale]);
    const inset = STREET / 2;
    for (const x of this.avenues) {
      const p = this.toScreen(x, inset);
      const q = this.toScreen(x, this.extentY - inset);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }
    for (const y of this.streets) {
      const p = this.toScreen(inset, y);
      const q = this.toScreen(this.extentX - inset, y);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private pathQuad(ctx: CanvasRenderingContext2D, r: Rect) {
    const p = [this.toScreen(r.x0, r.y0), this.toScreen(r.x1, r.y0), this.toScreen(r.x1, r.y1), this.toScreen(r.x0, r.y1)];
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    for (const q of p.slice(1)) ctx.lineTo(q.x, q.y);
    ctx.closePath();
  }

  private fillQuad(ctx: CanvasRenderingContext2D, r: Rect, colour: string) {
    this.pathQuad(ctx, r);
    ctx.fillStyle = colour;
    ctx.fill();
  }

  // ------------------------------------------------------------
  //  Frame
  // ------------------------------------------------------------

  private spriteRect(c: Cell) {
    const centre = this.toScreen(c.gx + 0.5, c.gy + 0.5);
    const w = c.width * this.scale;
    const h = c.height * this.scale;
    const bottom = centre.y + (c.width / TW) * (TH / 2) * this.scale;
    return { x: centre.x - w / 2, y: bottom - h, w, h };
  }

  private draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.imageSmoothingQuality = 'high';
    if (this.ground) ctx.drawImage(this.ground, 0, 0, this.cssWidth, this.cssHeight);

    const site = this.cells.find((c) => c.underConstruction);
    if (site) {
      ctx.save();
      this.pathQuad(ctx, { x0: site.gx - 0.06, y0: site.gy - 0.06, x1: site.gx + 1.06, y1: site.gy + 1.06 });
      ctx.strokeStyle = this.theme.ui_accent ?? '#ffcc73';
      ctx.lineWidth = Math.max(1, 0.12 * TH * this.scale);
      ctx.globalAlpha = this.frameId === null ? 0.8 : 0.45 + 0.4 * Math.sin(performance.now() / 400);
      ctx.stroke();
      ctx.restore();
    }

    for (const mark of new Set([this.selected, this.hovered])) {
      if (!mark) continue;
      ctx.save();
      this.pathQuad(ctx, { x0: mark.gx, y0: mark.gy, x1: mark.gx + 1, y1: mark.gy + 1 });
      ctx.fillStyle = this.theme.ui_accent ?? '#ffcc73';
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.restore();
    }

    const cars = this.cars
      .map((car) => ({ car, ...this.carCentre(car) }))
      .sort((a, b) => a.gx + a.gy - (b.gx + b.gy));
    let ci = 0;

    for (const cell of this.cells) {
      const depth = cell.gx + cell.gy + 1;
      while (ci < cars.length && cars[ci].gx + cars[ci].gy < depth) {
        this.drawCar(cars[ci].car, cars[ci].gx, cars[ci].gy);
        ci++;
      }
      if (!cell.sprite) continue;
      const r = this.spriteRect(cell);
      if (cell === this.hovered || cell === this.selected) {
        ctx.filter = `brightness(1.15) drop-shadow(0 0 ${Math.max(1, this.scale)}px ${this.theme.ui_accent ?? '#ffcc73'})`;
        ctx.drawImage(cell.sprite, r.x, r.y, r.w, r.h);
        ctx.filter = 'none';
      } else if (this.selected) {
        ctx.drawImage(this.mutedSprite(cell.sprite), r.x, r.y, r.w, r.h);
      } else {
        ctx.drawImage(cell.sprite, r.x, r.y, r.w, r.h);
      }
    }
    for (; ci < cars.length; ci++) this.drawCar(cars[ci].car, cars[ci].gx, cars[ci].gy);
    this.drawViaduct();

    for (const f of this.flyers) this.drawFlyer(f);
  }

  /** Desaturated copy used for every building except the selected day, like GitHub's 2D graph. */
  private mutedSprite(sprite: ImageBitmap): HTMLCanvasElement {
    let muted = this.muted.get(sprite);
    if (!muted) {
      muted = document.createElement('canvas');
      muted.width = sprite.width;
      muted.height = sprite.height;
      const mc = muted.getContext('2d')!;
      mc.filter = 'saturate(0.25) brightness(0.92) opacity(0.75)';
      mc.drawImage(sprite, 0, 0);
      this.muted.set(sprite, muted);
    }
    return muted;
  }

  setSelected(date: string | null) {
    this.selected = date ? (this.cells.find((c) => c.data.date === date) ?? null) : null;
    if (!this.frameId) this.draw();
  }

  // ------------------------------------------------------------
  //  Traffic
  // ------------------------------------------------------------

  private spawnEntities() {
    const rng = mulberry32(88888);
    const configs = this.theme.entities ?? [];

    if (this.isCity) {
      const hasTaxis = configs.some((c) => c.type === 'taxi');
      const count = Math.round(this.weeks / 3.5);
      for (let i = 0; i < count; i++) {
        const alongX = rng() < 0.55;
        const lines = alongX ? this.streets : this.avenues;
        const fixed = lines[Math.floor(rng() * lines.length)];
        const span = alongX ? this.extentX : this.extentY;
        this.cars.push({
          alongX,
          fixed,
          pos: STREET / 2 + rng() * (span - STREET),
          dir: rng() < 0.5 ? 1 : -1,
          speed: 0.9 + rng() * 0.6,
          colour: hasTaxis && rng() < 0.45 ? TAXI_YELLOW : CAR_COLOURS[Math.floor(rng() * CAR_COLOURS.length)],
          lastTurn: Number.NaN,
        });
      }
    }

    for (const cfg of configs) {
      const flyer = cfg.flyer ?? (cfg.type === 'bird' || cfg.type === 'butterfly');
      if (!flyer) continue;
      const butterfly = cfg.type === 'butterfly';
      for (let i = 0; i < cfg.count; i++) {
        const angle = rng() * Math.PI * 2;
        const speed = butterfly ? 0.35 : 1.4;
        this.flyers.push({
          gx: rng() * this.extentX,
          gy: rng() * this.extentY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * 0.4,
          alt: butterfly ? 4 + rng() * 6 : 26 + rng() * 14,
          phase: rng() * 10,
          butterfly,
          colour: butterfly ? ['#f4a7c1', '#ffd36e', '#a8d8ff'][i % 3] : '#3b3b44',
        });
      }
    }
  }

  private carCentre(car: Car) {
    const lane = 0.11 * car.dir;
    return car.alongX
      ? { gx: car.pos, gy: car.fixed + lane }
      : { gx: car.fixed - lane, gy: car.pos };
  }

  private stepCar(car: Car, dt: number) {
    const crossings = car.alongX ? this.avenues : this.streets;
    const next = car.pos + car.dir * car.speed * dt;
    const lo = Math.min(car.pos, next);
    const hi = Math.max(car.pos, next);
    const hit = crossings.find((c) => c > lo && c <= hi && c !== car.lastTurn);

    if (hit === undefined) {
      car.pos = next;
      return;
    }

    const atEnd = hit === crossings[0] || hit === crossings[crossings.length - 1];
    if (!atEnd && Math.random() > 0.3) {
      car.pos = next;
      return;
    }

    const perpendicular = car.alongX ? this.streets : this.avenues;
    const from = car.fixed;
    car.alongX = !car.alongX;
    car.pos = from;
    car.fixed = hit;
    car.lastTurn = from;
    if (from === perpendicular[0]) car.dir = 1;
    else if (from === perpendicular[perpendicular.length - 1]) car.dir = -1;
    else car.dir = Math.random() < 0.5 ? 1 : -1;
  }

  private drawCar(car: Car, gx: number, gy: number) {
    const ctx = this.ctx;
    const half = car.alongX ? { x: 0.22, y: 0.1 } : { x: 0.1, y: 0.22 };
    const lift = (h: number) => h * this.scale;

    const box = (hx: number, hy: number, z0: number, z1: number, top: string, sideX: string, sideY: string) => {
      const p = (dx: number, dy: number, z: number) => {
        const s = this.toScreen(gx + dx, gy + dy);
        return { x: s.x, y: s.y - lift(z) };
      };
      const poly = (pts: Array<{ x: number; y: number }>, fill: string) => {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const q of pts.slice(1)) ctx.lineTo(q.x, q.y);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      };
      poly([p(hx, -hy, z0), p(hx, hy, z0), p(hx, hy, z1), p(hx, -hy, z1)], sideX);
      poly([p(-hx, hy, z0), p(hx, hy, z0), p(hx, hy, z1), p(-hx, hy, z1)], sideY);
      poly([p(-hx, -hy, z1), p(hx, -hy, z1), p(hx, hy, z1), p(-hx, hy, z1)], top);
    };

    ctx.save();
    const shadow = this.toScreen(gx, gy);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y + lift(0.4), 0.3 * TW * this.scale * 0.6, 0.3 * TH * this.scale * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    box(half.x, half.y, 0.6, 2.4, car.colour, shade(car.colour, 0.72), shade(car.colour, 0.86));
    const cabin = car.alongX ? { x: 0.11, y: 0.08 } : { x: 0.08, y: 0.11 };
    box(cabin.x, cabin.y, 2.4, 3.6, shade(car.colour, 0.95), '#5d7183', '#7890a5');

    const front = car.alongX ? { dx: half.x * car.dir, dy: 0 } : { dx: 0, dy: half.y * car.dir };
    const head = this.toScreen(gx + front.dx, gy + front.dy);
    const tail = this.toScreen(gx - front.dx, gy - front.dy);
    const r = Math.max(0.6, 0.5 * this.scale);
    ctx.fillStyle = '#fff6cf';
    ctx.beginPath();
    ctx.arc(head.x, head.y - lift(1.4), r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5a48';
    ctx.beginPath();
    ctx.arc(tail.x, tail.y - lift(1.4), r * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private stepTrain(dt: number) {
    const path = this.streakPaths.find((p) => p.kind === 'longest');
    if (!path) return;
    this.trainPos += (this.trainDir * TRAIN_SPEED * dt) / Math.max(1, path.x1 - path.x0);
    if (this.trainPos > 1) {
      this.trainPos = 1;
      this.trainDir = -1;
    } else if (this.trainPos < 0) {
      this.trainPos = 0;
      this.trainDir = 1;
    }
  }

  private stepFlyer(f: Flyer, dt: number) {
    f.phase += dt;
    f.gx += f.vx * dt;
    f.gy += f.vy * dt;
    if (f.butterfly) {
      f.vx += Math.sin(f.phase * 1.7) * 0.02;
      f.vy += Math.cos(f.phase * 1.3) * 0.02;
    }
    if (f.gx < -2) f.gx = this.extentX + 2;
    if (f.gx > this.extentX + 2) f.gx = -2;
    if (f.gy < -1) f.gy = this.extentY + 1;
    if (f.gy > this.extentY + 1) f.gy = -1;
  }

  private drawFlyer(f: Flyer) {
    const ctx = this.ctx;
    const p = this.toScreen(f.gx, f.gy);
    const y = p.y - (f.alt + Math.sin(f.phase * 2) * 2) * this.scale;
    const s = this.scale;
    ctx.save();
    if (f.butterfly) {
      const flap = Math.abs(Math.sin(f.phase * 14));
      ctx.fillStyle = f.colour;
      ctx.beginPath();
      ctx.ellipse(p.x - 0.9 * s * flap, y, 0.9 * s * flap + 0.2, 0.7 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + 0.9 * s * flap, y, 0.9 * s * flap + 0.2, 0.7 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const flap = Math.sin(f.phase * 9) * 1.4 * s;
      ctx.strokeStyle = f.colour;
      ctx.lineWidth = Math.max(0.8, 0.45 * s);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x - 2.2 * s, y - flap);
      ctx.quadraticCurveTo(p.x - 1 * s, y - 1.2 * s, p.x, y);
      ctx.quadraticCurveTo(p.x + 1 * s, y - 1.2 * s, p.x + 2.2 * s, y - flap);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------
  //  Animation loop
  // ------------------------------------------------------------

  private get animated(): boolean {
    const train = this.isCity && this.streakPaths.some((p) => p.kind === 'longest');
    return this.motion && (this.cars.length > 0 || this.flyers.length > 0 || train);
  }

  relayout() {
    this.layout();
  }

  setMotion(motion: boolean) {
    this.motion = motion;
    this.syncLoop();
    this.draw();
  }

  private syncLoop() {
    const shouldRun = this.animated && this.visible && document.visibilityState === 'visible' && this.cssWidth > 0;
    if (shouldRun && this.frameId === null) {
      this.lastFrame = performance.now();
      this.frameId = requestAnimationFrame(this.tick);
    } else if (!shouldRun && this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  private readonly tick = (now: number) => {
    this.frameId = requestAnimationFrame(this.tick);
    this.elapsed += now - this.lastFrame;
    this.lastFrame = now;
    if (this.elapsed < FRAME_MS) return;
    const step = Math.min(0.1, this.elapsed / 1000);
    this.elapsed = 0;
    for (const car of this.cars) this.stepCar(car, step);
    for (const f of this.flyers) this.stepFlyer(f, step);
    this.stepTrain(step);
    this.draw();
  };

  // ------------------------------------------------------------
  //  Hover
  // ------------------------------------------------------------

  private alphaAt(sprite: ImageBitmap, u: number, v: number): number {
    let mask = this.alphaMasks.get(sprite);
    if (!mask) {
      const c = new OffscreenCanvas(sprite.width, sprite.height);
      const cx = c.getContext('2d')!;
      cx.drawImage(sprite, 0, 0);
      const pixels = cx.getImageData(0, 0, sprite.width, sprite.height).data;
      mask = new Uint8ClampedArray(sprite.width * sprite.height);
      for (let i = 0; i < mask.length; i++) mask[i] = pixels[i * 4 + 3];
      this.alphaMasks.set(sprite, mask);
    }
    const x = Math.min(sprite.width - 1, Math.max(0, Math.floor(u * sprite.width)));
    const y = Math.min(sprite.height - 1, Math.max(0, Math.floor(v * sprite.height)));
    return mask[y * sprite.width + x];
  }

  private cellAt(x: number, y: number): Cell | null {
    for (let i = this.cells.length - 1; i >= 0; i--) {
      const c = this.cells[i];
      if (!c.sprite) continue;
      const r = this.spriteRect(c);
      if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) continue;
      if (this.alphaAt(c.sprite, (x - r.x) / r.w, (y - r.y) / r.h) > 40) return c;
    }
    const px = (x - this.originX) / this.scale / (TW / 2);
    const py = (y - this.originY) / this.scale / (TH / 2);
    const gx = (px + py) / 2;
    const gy = (py - px) / 2;
    return this.cells.find((c) => gx >= c.gx && gx < c.gx + 1 && gy >= c.gy && gy < c.gy + 1) ?? null;
  }

  private streakAt(x: number, y: number): StreakPath | null {
    for (const path of ['longest', 'current'].flatMap((k) => this.streakPaths.filter((p) => p.kind === k))) {
      const hit = this.hitPaths.get(path);
      if (hit && this.ctx.isPointInPath(hit, x * this.dpr, y * this.dpr)) return path;
    }
    return null;
  }

  private createTooltip(): HTMLElement {
    const existing = document.getElementById('cl-tooltip');
    if (existing) return existing;
    const el = document.createElement('div');
    el.id = 'cl-tooltip';
    el.setAttribute('role', 'tooltip');
    document.body.appendChild(el);
    return el;
  }

  private bindPointer() {
    const onMove = (e: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const streak = this.streakAt(e.clientX - rect.left, e.clientY - rect.top);
      if (streak) {
        if (this.hovered) {
          this.hovered = null;
          if (!this.frameId) this.draw();
        }
        this.canvas.style.cursor = '';
        const label = streak.kind === 'longest' ? 'Longest streak' : 'Current streak';
        this.tooltip.textContent = `${label}: ${streak.span.length} days`;
        const line = document.createElement('span');
        line.className = 'cl-tooltip-landmark';
        line.textContent = `${fmtDay(streak.span.start!)} → ${fmtDay(streak.span.end!)}`;
        this.tooltip.append(line);
        this.tooltip.style.left = `${e.clientX}px`;
        this.tooltip.style.top = `${e.clientY - 12}px`;
        this.tooltip.classList.add('is-visible');
        return;
      }
      const cell = this.cellAt(e.clientX - rect.left, e.clientY - rect.top);
      if (cell !== this.hovered) {
        this.hovered = cell;
        if (!this.frameId) this.draw();
      }
      this.canvas.style.cursor = cell && this.onSelect ? 'pointer' : '';
      if (!cell) {
        this.tooltip.classList.remove('is-visible');
        return;
      }
      const { count, date } = cell.data;
      const when = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
      });
      const label = count === 0 ? 'No contributions' : `${count.toLocaleString()} contribution${count === 1 ? '' : 's'}`;
      this.tooltip.textContent = !cell.underConstruction
        ? `${label} on ${when}`
        : count === 0
          ? 'No contributions yet today'
          : `${label} today, still building`;
      if (cell.landmark) {
        const line = document.createElement('span');
        line.className = 'cl-tooltip-landmark';
        line.textContent = `${cell.landmark.name} · ${cell.landmark.rank === 1 ? 'your best day' : `your ${ordinal(cell.landmark.rank)} best day`}`;
        this.tooltip.append(line);
      }
      const r = this.spriteRect(cell);
      this.tooltip.style.left = `${rect.left + r.x + r.w / 2}px`;
      this.tooltip.style.top = `${rect.top + (cell.sprite ? r.y : r.y + r.h) - 6}px`;
      this.tooltip.classList.add('is-visible');
    };
    const onLeave = () => {
      this.hovered = null;
      this.tooltip.classList.remove('is-visible');
      if (!this.frameId) this.draw();
    };
    const onClick = (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const cell = this.cellAt(e.clientX - rect.left, e.clientY - rect.top);
      if (cell) this.onSelect?.(cell.data.date);
    };
    this.canvas.addEventListener('pointermove', onMove);
    this.canvas.addEventListener('pointerleave', onLeave);
    this.canvas.addEventListener('click', onClick);
    this.cleanups.push(() => {
      this.canvas.removeEventListener('pointermove', onMove);
      this.canvas.removeEventListener('pointerleave', onLeave);
      this.canvas.removeEventListener('click', onClick);
    });
  }

  destroy() {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    this.tooltip.classList.remove('is-visible');
    for (const fn of this.cleanups) fn();
  }
}
