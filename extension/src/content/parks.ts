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
