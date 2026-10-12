export const PARK_MIN_DAYS = 56;
const DAYS_PER_WEEK = 7;
export const PARK_MIN_WEEKS = Math.max(8, Math.ceil(PARK_MIN_DAYS / DAYS_PER_WEEK));

export interface ParkDay {
  date: string;
  week: number;
  count: number;
}

export interface ParkSpan {
  firstWeek: number;
  lastWeek: number;
}

/**
 * One district of whole, fully empty week columns, or null. A gap that reaches
 * today or later wins; otherwise the longest past gap, the most recent on a tie.
 */
export function findPark(days: ParkDay[], today: string): ParkSpan | null {
  const columns = new Map<number, ParkDay[]>();
  for (const d of days) {
    const column = columns.get(d.week);
    if (column) column.push(d);
    else columns.set(d.week, [d]);
  }

  const runs: Array<ParkSpan & { reachesToday: boolean }> = [];
  let open: (ParkSpan & { reachesToday: boolean }) | null = null;
  for (const week of [...columns.keys()].sort((a, b) => a - b)) {
    const column = columns.get(week)!;
    const empty = column.length === DAYS_PER_WEEK && column.every((d) => d.count === 0);
    if (!empty) {
      open = null;
      continue;
    }
    const reaches = column.some((d) => d.date >= today);
    if (open && open.lastWeek === week - 1) {
      open.lastWeek = week;
      open.reachesToday ||= reaches;
    } else {
      open = { firstWeek: week, lastWeek: week, reachesToday: reaches };
      runs.push(open);
    }
  }

  const length = (r: ParkSpan) => r.lastWeek - r.firstWeek + 1;
  const eligible = runs.filter((r) => length(r) >= PARK_MIN_WEEKS);
  const pool = eligible.some((r) => r.reachesToday) ? eligible.filter((r) => r.reachesToday) : eligible;
  const best = pool.reduce<(typeof pool)[number] | null>(
    (a, b) => (!a || length(b) > length(a) || (length(b) === length(a) && b.firstWeek > a.firstWeek) ? b : a),
    null,
  );
  return best ? { firstWeek: best.firstWeek, lastWeek: best.lastWeek } : null;
}

export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sprite landmarks; the Reservoir, Lake, lawns and Bow Bridge are painted into the ground. */
export const PARK_LANDMARKS = ['bethesda', 'belvedere'] as const;
export type ParkLandmark = (typeof PARK_LANDMARKS)[number];

export interface Pt {
  x: number;
  y: number;
}

export interface ParkRegion {
  kind: 'lawn' | 'water' | 'reservoir';
  /** Same winding, so one fill paints their union. */
  polys: Pt[][];
}

export interface ParkTree {
  x: number;
  y: number;
  variant: number;
  /** Fraction of a cell's width. */
  size: number;
}

export interface ParkLayout {
  width: number;
  height: number;
  regions: ParkRegion[];
  paths: Pt[][];
  landmarks: Array<{ role: ParkLandmark; x: number; y: number }>;
  bridge: { x0: number; y0: number; x1: number; y1: number };
  rock: { x: number; y: number; r: number };
  trees: ParkTree[];
}

/**
 * Coordinates are in cells. North is later dates, so x grows with the week and
 * the long axis runs south (Sheep Meadow) to north (Harlem Meer); y runs west to east.
 */
export function parkLayout(width: number, height: number, seed = 11): ParkLayout {
  const rng = mulberry32(seed);
  const W = width;
  const H = height;
  const inset = 0.2;

  const blob = (cx: number, cy: number, rx: number, ry: number, wobble: number, dent = 0): Pt[] => {
    const phases = [rng() * 6.28, rng() * 6.28, rng() * 6.28];
    const points: Pt[] = [];
    const n = 96;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const bite = dent * Math.exp(-(((a - Math.PI * 0.5) / 0.55) ** 2));
      const r = 1 - bite + phases.reduce((sum, ph, k) => sum + (wobble / (k + 2)) * Math.cos((k + 2) * a + ph), 0);
      points.push({
        x: Math.min(W - inset, Math.max(inset, cx + Math.cos(a) * rx * r)),
        y: Math.min(H - inset, Math.max(inset, cy + Math.sin(a) * ry * r)),
      });
    }
    return points;
  };
  const along = (t: number) => t * W;
  const across = (s: number) => s * H;
  const reach = (fraction: number, minimum: number) => Math.max(minimum, fraction * W);

  const lakeX = along(0.22);
  const lakeRx = reach(0.05, 0.75);
  const reservoirX = along(0.64);
  const reservoirRx = reach(0.16, 1.4);
  const roomy = W >= 12;
  const wide = W >= 18;

  const regions: ParkRegion[] = [
    { kind: 'lawn', polys: [blob(along(0.07), across(0.45), reach(0.045, 0.85), across(0.21), 0.14)] },
    { kind: 'lawn', polys: [blob(along(0.37), across(0.5), reach(0.04, 0.7), across(0.2), 0.13)] },
    { kind: 'lawn', polys: [blob(along(0.85), across(0.2), reach(0.022, 0.5), across(0.09), 0.16)] },
    { kind: 'lawn', polys: [blob(along(0.87), across(0.8), reach(0.02, 0.45), across(0.08), 0.16)] },
    ...(wide ? [{ kind: 'lawn' as const, polys: [blob(along(0.15), across(0.82), reach(0.018, 0.4), across(0.07), 0.16)] }] : []),
    {
      kind: 'water',
      polys: [
        blob(lakeX, across(0.52), lakeRx, across(0.16), 0.15),
        blob(lakeX - along(0.018), across(0.32), lakeRx * 0.55, across(0.1), 0.18),
      ],
    },
    ...(roomy ? [{ kind: 'water' as const, polys: [blob(along(0.955), across(0.52), reach(0.02, 0.5), across(0.12), 0.12)] }] : []),
    { kind: 'reservoir', polys: [blob(reservoirX, across(0.5), reservoirRx, across(0.31), 0.1, 0.3)] },
  ];

  const waypoints: Array<Array<[number, number]>> = [
    [[0, 0.9], [0.1, 0.84], [0.2, 0.94], [0.33, 0.9], [0.5, 0.93], [0.7, 0.95], [0.85, 0.9], [1, 0.88]],
    [[0, 0.12], [0.1, 0.08], [0.22, 0.16], [0.4, 0.1], [0.55, 0.06], [0.7, 0.04], [0.85, 0.12], [1, 0.25]],
    [[0.04, 0.6], [0.12, 0.68], [0.2, 0.5], [0.3, 0.78], [0.45, 0.86], [0.52, 0.5]],
  ];
  const paths = waypoints.map((line) => spline(line.map(([t, s]) => ({ x: along(t), y: across(s) }))));

  const belvedere = { x: reservoirX - reservoirRx * 1.02 - 0.45, y: across(0.56) };
  const bridgeX = lakeX - along(0.004);
  const bridge = { x0: bridgeX, y0: across(0.4), x1: bridgeX, y1: across(0.64) };
  const rock = { x: belvedere.x, y: belvedere.y, r: 0.5 };
  const landmarks: ParkLayout['landmarks'] = [
    { role: 'bethesda', x: lakeX + lakeRx * 1.05 + 0.45, y: across(0.52) },
    { role: 'belvedere', ...belvedere },
  ];

  const layout: ParkLayout = { width: W, height: H, regions, paths, landmarks, bridge, rock, trees: [] };
  layout.trees = scatterTrees(layout, rng);
  return layout;
}

function spline(points: Pt[], steps = 14): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

export function inPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Whether a point is within `clearance` cells of the region (probed on a ring). */
export function nearRegion(p: Pt, region: ParkRegion, clearance: number): boolean {
  const probes: Pt[] = [p];
  if (clearance > 0) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      probes.push({ x: p.x + Math.cos(a) * clearance, y: p.y + Math.sin(a) * clearance });
    }
  }
  return probes.some((q) => region.polys.some((poly) => inPolygon(q, poly)));
}

const CLEARANCE = { lawn: 0.1, water: 0.35, reservoir: 0.45 } as const;
const MAX_TREES = 2400;

function scatterTrees(layout: ParkLayout, rng: () => number): ParkTree[] {
  const { width: W, height: H } = layout;
  const edge = 0.22;
  const spacing = Math.max(0.26, Math.sqrt((W * H) / 0.7 / MAX_TREES));
  const near = (p: Pt, q: Pt, d: number) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2 < d * d;
  const trees: ParkTree[] = [];

  for (let gx = edge; gx < W - edge; gx += spacing) {
    for (let gy = edge; gy < H - edge; gy += spacing) {
      const p = { x: gx + (rng() - 0.5) * spacing * 0.9, y: gy + (rng() - 0.5) * spacing * 0.9 };
      const roll = rng();
      const variant = rng() < 0.88 ? 0 : 1;
      const size = 0.22 + rng() * 0.14;
      if (p.x < edge || p.y < edge || p.x > W - edge || p.y > H - edge) continue;
      if (roll > 0.97) continue;
      if (layout.regions.some((r) => nearRegion(p, r, CLEARANCE[r.kind]))) continue;
      if (layout.paths.some((path) => path.some((q) => near(p, q, 0.2)))) continue;
      if (layout.landmarks.some((l) => near(p, l, 0.55)) || near(p, layout.rock, layout.rock.r + 0.2)) continue;
      const { bridge } = layout;
      if (Math.abs(p.x - bridge.x0) < 0.35 && p.y > bridge.y0 - 0.4 && p.y < bridge.y1 + 0.4) continue;
      trees.push({ x: p.x, y: p.y, variant, size });
    }
  }
  return trees.sort((a, b) => a.x + a.y - (b.x + b.y));
}
