import type { ContributionData } from './renderer';

export interface ContributionStats {
  total: number;
  firstDate: string;
  lastDate: string;
  weekTotal: number;
  weekStart: string;
  bestCount: number;
  bestDate: string | null;
  average: number;
  longest: Streak;
  current: Streak;
}

export interface Streak {
  length: number;
  start: string | null;
  end: string | null;
}

interface Day {
  date: string;
  count: number;
}

const DAY_MS = 86_400_000;

const shortDate = new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const longDate = new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function utc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function todayKey(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
}

export function formatDate(date: string): string {
  return shortDate.format(utc(date));
}

export function formatRange(start: string, end: string, spanDays = 0): string {
  const fmt = spanDays > 365 || utc(start).getUTCFullYear() !== utc(end).getUTCFullYear() ? longDate : shortDate;
  return `${fmt.format(utc(start))} → ${fmt.format(utc(end))}`;
}

function sortedDays<T extends Day>(days: T[]): T[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date));
}

export function longestStreak(days: Day[]): Streak {
  let best: Streak = { length: 0, start: null, end: null };
  let run = 0;
  let runStart: string | null = null;
  for (const d of sortedDays(days)) {
    if (d.count > 0) {
      if (run === 0) runStart = d.date;
      run++;
      if (run >= best.length) best = { length: run, start: runStart, end: d.date };
    } else {
      run = 0;
    }
  }
  return best;
}

export function currentStreak(days: Day[], today = todayKey()): Streak {
  const past = sortedDays(days).filter((d) => d.date <= today).reverse();
  if (past.length === 0) return { length: 0, start: null, end: null };

  // No activity yet today does not break the streak.
  const startIdx = past[0].count === 0 && past.length > 1 ? 1 : 0;
  let length = 0;
  let start: string | null = null;
  for (let i = startIdx; i < past.length && past[i].count > 0; i++) {
    length++;
    start = past[i].date;
  }
  return { length, start, end: length > 0 ? past[startIdx].date : null };
}

export function computeStats(data: ContributionData[], today = todayKey()): ContributionStats {
  const days = sortedDays(data);
  const visible = days.filter((d) => d.date <= today);
  const total = days.reduce((sum, d) => sum + d.count, 0);

  let bestCount = 0;
  let bestDate: string | null = null;
  for (const d of days) {
    if (d.count > bestCount) {
      bestCount = d.count;
      bestDate = d.date;
    }
  }

  const lastWeek = Math.max(...days.map((d) => d.week));
  const weekDays = days.filter((d) => d.week === lastWeek);
  const firstDate = days[0].date;
  const lastDate = (visible[visible.length - 1] ?? days[days.length - 1]).date;

  return {
    total,
    firstDate,
    lastDate,
    weekTotal: weekDays.reduce((sum, d) => sum + d.count, 0),
    weekStart: weekDays[0]?.date ?? lastDate,
    bestCount,
    bestDate,
    average: averagePerDay(total, firstDate, lastDate),
    longest: longestStreak(days),
    current: currentStreak(days, today),
  };
}

/** Keys each count by the tooltip's target cell id and by its own id. */
export function tooltipCounts(tips: Iterable<Element>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tip of tips) {
    const match = tip.textContent?.match(/(\d[\d,]*|No) contributions? on/);
    if (!match) continue;
    const count = match[1] === 'No' ? 0 : Number.parseInt(match[1].replace(/,/g, ''), 10);
    counts.set(tip.id, count);
    const target = tip.getAttribute('for');
    if (target) counts.set(target, count);
  }
  return counts;
}

function parseContributionsHtml(html: string): Day[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const counts = tooltipCounts(doc.querySelectorAll('tool-tip'));
  const days: Day[] = [];
  for (const cell of doc.querySelectorAll<HTMLElement>('td.ContributionCalendar-day[data-date]')) {
    days.push({
      date: cell.dataset.date!,
      count: counts.get(cell.id) ?? counts.get(cell.getAttribute('aria-labelledby') ?? '') ?? 0,
    });
  }
  return days;
}

export function averagePerDay(total: number, firstDate: string, lastDate: string): number {
  const span = Math.max(1, Math.round((utc(lastDate).getTime() - utc(firstDate).getTime()) / DAY_MS) + 1);
  return Math.round((total / span) * 10) / 10;
}

export function addDays(date: string, days: number): string {
  return new Date(utc(date).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export async function fetchDays(username: string, from: string, to: string, signal?: AbortSignal): Promise<Day[]> {
  const url = `https://github.com/users/${encodeURIComponent(username)}/contributions?from=${from}&to=${to}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`contributions ${res.status}`);
  return sortedDays(parseContributionsHtml(await res.text()).filter((d) => d.date >= from && d.date <= to));
}

/**
 * GitHub's heading can count days before the first square of its own calendar
 * (on Sundays the graph drops the oldest week but the total keeps it). Walks
 * back through `earlier` (the days just before the calendar, oldest first) and
 * returns the first date of the window whose total matches the heading.
 */
export function reconcileStart(calendarTotal: number, headingTotal: number, earlier: Day[]): string | null {
  let sum = calendarTotal;
  let i = earlier.length;
  while (sum < headingTotal && i > 0) sum += earlier[--i].count;
  if (sum !== headingTotal || i === earlier.length) return null;
  while (i > 0 && earlier[i - 1].count === 0) i--;
  return earlier[i].date;
}

/**
 * Walks back through earlier years while the streak could still continue,
 * so a streak that started before the visible calendar is reported in full.
 */
export async function extendWithHistory(
  username: string,
  data: ContributionData[],
  signal: AbortSignal,
  maxYears = 10,
): Promise<Day[]> {
  let combined: Day[] = sortedDays(data);
  for (let i = 0; i < maxYears && !signal.aborted; i++) {
    const earliest = utc(combined[0].date);
    const year = earliest.getUTCMonth() === 0 && earliest.getUTCDate() === 1
      ? earliest.getUTCFullYear() - 1
      : earliest.getUTCFullYear();
    const url = `https://github.com/users/${encodeURIComponent(username)}/contributions?from=${year}-01-01&to=${year}-12-31`;
    const res = await fetch(url, { signal });
    if (!res.ok) break;
    const byDate = new Map(parseContributionsHtml(await res.text()).map((d) => [d.date, d]));

    const earlier: Day[] = [];
    for (let t = Date.UTC(year, 0, 1); t < earliest.getTime(); t += DAY_MS) {
      const day = byDate.get(new Date(t).toISOString().slice(0, 10));
      // A missing date must not bridge a gap in the streak.
      if (!day) return combined;
      earlier.push(day);
    }
    combined = [...earlier, ...combined];
    if (earlier.some((d) => d.count === 0)) break;
  }
  return combined;
}
