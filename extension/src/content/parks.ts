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

/** Most iconic first: a small park gets only the head of this list. */
export const PARK_LANDMARKS = ['bethesda', 'bowbridge', 'belvedere', 'reservoir', 'sheep_meadow', 'mall', 'gapstow', 'wollman'] as const;
export type ParkLandmark = (typeof PARK_LANDMARKS)[number];

export function parkLandmarkCount(weeks: number): number {
  if (weeks <= 9) return 3;
  if (weeks <= 12) return 5;
  if (weeks <= 16) return 6;
  return PARK_LANDMARKS.length;
}

export interface LandmarkSlot {
  week: number;
  day: number;
  /** Index into PARK_LANDMARKS. */
  index: number;
}

/**
 * Seeded cells for `count` landmarks across a park, interior only (the last week
 * and day 6 carry the stone wall), never touching each other, the most iconic
 * nearest the middle of the park.
 */
export function placeLandmarks(span: ParkSpan, count: number, free: (week: number, day: number) => boolean, seed = 7): LandmarkSlot[] {
  const first = span.firstWeek + 1;
  const last = span.lastWeek - 1;
  const width = last - first + 1;
  if (count < 1 || width < 1) return [];

  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const middle = (first + last) / 2;
  const targets = Array.from({ length: count }, (_, i) => ({
    week: Math.min(last, first + Math.floor(((i + 0.5) * width) / count)),
    day: (i % 2 === 0 ? 3 : 1) + (next() < 0.5 ? 0 : 1),
  })).sort((a, b) => Math.abs(a.week - middle) - Math.abs(b.week - middle));

  const placed: LandmarkSlot[] = [];
  for (const target of targets) {
    let best: { week: number; day: number; cost: number } | null = null;
    for (let week = first; week <= last; week++) {
      for (let day = 1; day <= 4; day++) {
        if (!free(week, day)) continue;
        if (placed.some((p) => Math.max(Math.abs(p.week - week), Math.abs(p.day - day)) < 2)) continue;
        const cost = Math.abs(week - target.week) * 2 + Math.abs(day - target.day);
        if (!best || cost < best.cost) best = { week, day, cost };
      }
    }
    if (best) placed.push({ week: best.week, day: best.day, index: placed.length });
  }
  return placed;
}
