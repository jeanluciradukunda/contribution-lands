/** Public account calendars for the standalone popup. No GitHub session is sent. */
export interface ContributionDay { date: string; count: number }
export interface DateRange { from: string; to: string }
export interface AccountCalendarResult {
  username: string;
  days: ContributionDay[];
  status: 'fresh' | 'cached' | 'stale' | 'error';
  fetchedAt: number | null;
  error?: string;
  incomplete: boolean;
}
export interface AggregateDay extends ContributionDay {
  week: number;
  day: number;
  level: 0 | 1 | 2 | 3 | 4;
}
export interface CalendarAggregate {
  days: AggregateDay[];
  complete: boolean;
  missingDates: string[];
}

export const MAX_ACCOUNTS = 10;
export const CACHE_TTL_MS = 30 * 60 * 1000;
export const CACHE_STORAGE_KEY = 'watchedAccountCalendarsV1';
const DAY_MS = 86_400_000;
const REQUEST_TIMEOUT_MS = 15_000;
const ABSOLUTE_BANDS = [1, 5, 15, 40];

interface CacheEntry { days: ContributionDay[]; fetchedAt: number }
type AccountCache = Record<string, CacheEntry>;

export function normalizeUsername(input: string): string | null {
  let value = input.trim();
  if (/^https:\/\//i.test(value)) {
    const profile = value.match(/^https:\/\/github\.com\/([^/?#]+)\/?$/i);
    if (!profile) return null;
    value = profile[1];
  } else {
    value = value.replace(/^@/, '');
  }
  const username = value.toLowerCase();
  // Usernames are ASCII, at most 39 characters, with no adjacent/edge hyphens.
  return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/.test(username) ? username : null;
}
export function normalizeAccounts(inputs: readonly string[]): string[] {
  return [...new Set(inputs.map(normalizeUsername).filter((name): name is string => name !== null))].slice(0, MAX_ACCOUNTS);
}

function dateTime(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date ? time : NaN;
}

export function dateKeys(range: DateRange): string[] {
  const from = dateTime(range.from);
  const to = dateTime(range.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || to - from > 366 * DAY_MS) {
    throw new Error('Invalid calendar date range.');
  }
  return Array.from({ length: Math.round((to - from) / DAY_MS) + 1 }, (_, i) => new Date(from + i * DAY_MS).toISOString().slice(0, 10));
}

/** Last calendar year through today, using the same local day as the city. */
export function rollingDateRange(now = new Date()): DateRange {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const previousMonthEnd = new Date(Date.UTC(year - 1, month + 1, 0)).getUTCDate();
  const previous = Date.UTC(year - 1, month, Math.min(day, previousMonthEnd));
  return {
    from: new Date(previous + DAY_MS).toISOString().slice(0, 10),
    to: new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10),
  };
}

/** Missing cells and unreadable counts are unknown, never implicit zeroes. */
export function validateCalendar(days: readonly ContributionDay[], range: DateRange): ContributionDay[] {
  const dates = dateKeys(range);
  const byDate = new Map<string, ContributionDay>();
  for (const day of days) {
    if (day.date < range.from || day.date > range.to) continue;
    if (!Number.isFinite(dateTime(day.date)) || !Number.isSafeInteger(day.count) || day.count < 0) {
      throw new Error('GitHub returned an unreadable contribution count.');
    }
    if (byDate.has(day.date)) throw new Error('GitHub returned duplicate contribution dates.');
    byDate.set(day.date, { date: day.date, count: day.count });
  }
  const missing = dates.filter((date) => !byDate.has(date));
  if (missing.length) {
    const received = [...byDate.keys()].sort();
    const coverage = received.length ? `${received[0]} to ${received[received.length - 1]}` : 'none';
    throw new Error(`GitHub returned an incomplete contribution calendar (${received.length}/${dates.length} days; received ${coverage}; first missing ${missing[0]}).`);
  }
  return dates.map((date) => byDate.get(date)!);
}

function readCount(text: string | null): number | undefined {
  const match = text?.match(/(?:^|\s)(No|\d[\d,]*) contributions? on\b/i);
  if (!match) return undefined;
  return match[1].toLowerCase() === 'no' ? 0 : Number(match[1].replace(/,/g, ''));
}

export function parseContributionCalendar(html: string, range: DateRange): ContributionDay[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const counts = new Map<string, number>();
  for (const tip of doc.querySelectorAll('tool-tip')) {
    const count = readCount(tip.textContent);
    if (count === undefined) continue;
    if (tip.id) counts.set(tip.id, count);
    const target = tip.getAttribute('for');
    if (target) counts.set(target, count);
  }
  const days: ContributionDay[] = [];
  for (const cell of doc.querySelectorAll('[data-date].ContributionCalendar-day')) {
    const date = cell.getAttribute('data-date')!;
    if (date < range.from || date > range.to) continue;
    const explicit = cell.getAttribute('data-count');
    const labelledCount = (cell.getAttribute('aria-labelledby') ?? '').split(/\s+/).map((id) => counts.get(id)).find((n) => n !== undefined);
    const count = explicit !== null && /^\d+$/.test(explicit)
      ? Number(explicit)
      : counts.get(cell.id) ?? labelledCount ?? readCount(cell.getAttribute('aria-label'));
    // A valid zero has an explicit count or a "No contributions" tooltip.
    if (count === undefined) throw new Error('GitHub returned an unreadable contribution count.');
    days.push({ date, count });
  }
  return validateCalendar(days, range);
}

function validCache(raw: unknown): AccountCache {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const cache: AccountCache = {};
  for (const [username, value] of Object.entries(raw).slice(0, MAX_ACCOUNTS)) {
    if (normalizeUsername(username) !== username || !value || typeof value !== 'object') continue;
    const entry = value as Partial<CacheEntry>;
    if (!Array.isArray(entry.days) || !entry.days.length || entry.days.length > 367 || !Number.isFinite(entry.fetchedAt) || entry.fetchedAt! <= 0 || entry.fetchedAt! > Date.now() + 60_000) continue;
    const days: ContributionDay[] = [];
    let invalid = false;
    const seen = new Set<string>();
    for (const day of entry.days) {
      if (!day || typeof day.date !== 'string' || !Number.isFinite(dateTime(day.date)) || !Number.isSafeInteger(day.count) || day.count < 0 || seen.has(day.date)) { invalid = true; break; }
      days.push({ date: day.date, count: day.count });
      seen.add(day.date);
    }
    if (!invalid) cache[username] = { days, fetchedAt: entry.fetchedAt! };
  }
  return cache;
}

async function readCache(): Promise<AccountCache> {
  try { return validCache((await chrome.storage.local.get(CACHE_STORAGE_KEY))[CACHE_STORAGE_KEY]); }
  catch { return {}; }
}

function cachedResult(username: string, cache: AccountCache, range: DateRange): AccountCalendarResult {
  const entry = Object.prototype.hasOwnProperty.call(cache, username) ? cache[username] : undefined;
  const days = entry?.days.filter((day) => day.date >= range.from && day.date <= range.to) ?? [];
  const present = new Set(days.map((day) => day.date));
  const incomplete = dateKeys(range).some((date) => !present.has(date));
  return {
    username, days, incomplete,
    fetchedAt: entry?.fetchedAt ?? null,
    status: !days.length ? 'error' : incomplete || Date.now() - entry!.fetchedAt > CACHE_TTL_MS ? 'stale' : 'cached',
  };
}

export async function getCachedAccounts(usernames: readonly string[], range = rollingDateRange()): Promise<AccountCalendarResult[]> {
  const cache = await readCache();
  return normalizeAccounts(usernames).map((username) => cachedResult(username, cache, range));
}

interface LoadOptions {
  range?: DateRange;
  force?: boolean;
  signal?: AbortSignal;
  onUpdate?: (results: AccountCalendarResult[]) => void;
}

function abortError(): DOMException { return new DOMException('Loading cancelled.', 'AbortError'); }

async function fetchCalendarYear(username: string, year: number, range: DateRange, signal?: AbortSignal): Promise<ContributionDay[]> {
  if (signal?.aborted) throw abortError();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, REQUEST_TIMEOUT_MS);
  try {
    const url = `https://github.com/users/${encodeURIComponent(username)}/contributions?from=${year}-01-01&to=${year}-12-31`;
    const response = await fetch(url, { credentials: 'omit', signal: controller.signal, headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
    if (!response.ok) {
      if (response.status === 404) throw new Error('Account not found or its calendar is not public.');
      if (response.status === 429) throw new Error('GitHub is limiting requests. Try again later.');
      throw new Error(`GitHub could not load this calendar (${response.status}).`);
    }
    return parseContributionCalendar(await response.text(), range);
  } catch (error) {
    if (signal?.aborted) throw abortError();
    if (controller.signal.aborted) throw new Error('GitHub took too long to respond. Try refreshing.');
    if (error instanceof TypeError) throw new Error('Could not reach GitHub. Check your connection.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}

/** Use GitHub’s year-scoped calendar views, then assemble the rolling window. */
async function fetchCalendar(username: string, range: DateRange, signal?: AbortSignal): Promise<ContributionDay[]> {
  const days: ContributionDay[] = [];
  for (let year = Number(range.from.slice(0, 4)); year <= Number(range.to.slice(0, 4)); year++) {
    // Request a whole year, but require only dates inside our rolling window.
    // In particular, the current year's future dates must not be required.
    const from = [range.from, String(year) + '-01-01'].sort()[1];
    const to = [range.to, String(year) + '-12-31'].sort()[0];
    days.push(...await fetchCalendarYear(username, year, { from, to }, signal));
  }
  return validateCalendar(days, range);
}

/** Restores the local city immediately, then refreshes expired calendars, three at a time. */
export async function loadWatchedAccounts(usernames: readonly string[], options: LoadOptions = {}): Promise<AccountCalendarResult[]> {
  const accounts = normalizeAccounts(usernames);
  const range = options.range ?? rollingDateRange();
  dateKeys(range);
  if (options.signal?.aborted) throw abortError();
  const cache = await readCache();
  const results = accounts.map((username) => cachedResult(username, cache, range));
  const emit = () => { if (!options.signal?.aborted) options.onUpdate?.([...results]); };
  const persist = async () => {
    // Retain only watched accounts, and save progress before the popup closes.
    const bounded = Object.fromEntries(accounts.filter((username) => Object.prototype.hasOwnProperty.call(cache, username)).map((username) => [username, cache[username]]));
    try { await chrome.storage.local.set({ [CACHE_STORAGE_KEY]: bounded }); } catch { /* Viewing still works if local storage is unavailable. */ }
  };
  emit();
  let next = 0;
  const worker = async () => {
    while (next < accounts.length) {
      const index = next++;
      if (options.signal?.aborted) throw abortError();
      if (!options.force && results[index].status === 'cached') continue;
      const username = accounts[index];
      try {
        const days = await fetchCalendar(username, range, options.signal);
        const fetchedAt = Date.now();
        cache[username] = { days, fetchedAt };
        results[index] = { username, days, fetchedAt, status: 'fresh', incomplete: false };
        await persist();
      } catch (error) {
        if (options.signal?.aborted) throw abortError();
        results[index] = {
          ...results[index], status: results[index].days.length ? 'stale' : 'error',
          error: error instanceof Error ? error.message : 'Could not load this GitHub calendar.',
        };
      }
      emit();
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, accounts.length) }, worker));
  if (options.signal?.aborted) throw abortError();
  await persist();
  return results;
}

export function aggregateCalendars(
  calendars: readonly Pick<AccountCalendarResult, 'username' | 'days' | 'incomplete'>[],
  range = rollingDateRange(),
  scale: 'absolute' | 'relative' = 'absolute',
): CalendarAggregate {
  const dates = dateKeys(range);
  const unique = new Map<string, typeof calendars[number]>();
  for (const calendar of calendars) {
    const username = normalizeUsername(calendar.username);
    if (username) unique.set(username, calendar);
  }
  const accountDays = [...unique.values()].map((calendar) => new Map(calendar.days.map((day) => [day.date, day.count])));
  const missingDates: string[] = [];
  const known: ContributionDay[] = [];
  for (const date of dates) {
    const counts = accountDays.map((days) => days.get(date));
    const valid = counts.filter((count): count is number => count !== undefined && Number.isSafeInteger(count) && count >= 0);
    if (!counts.length || valid.length !== counts.length) missingDates.push(date);
    // Leave wholly unknown days absent. The UI labels partial sums as incomplete.
    if (valid.length) known.push({ date, count: valid.reduce((sum, count) => sum + count, 0) });
  }
  const max = Math.max(1, ...known.map((day) => day.count));
  const firstWeekDay = new Date(`${range.from}T00:00:00Z`).getUTCDay();
  const firstTime = dateTime(range.from);
  const days: AggregateDay[] = known.map((day) => ({
    ...day,
    day: new Date(`${day.date}T00:00:00Z`).getUTCDay(),
    week: Math.floor(((dateTime(day.date) - firstTime) / DAY_MS + firstWeekDay) / 7),
    level: (scale === 'absolute' ? ABSOLUTE_BANDS.filter((min) => day.count >= min).length : day.count === 0 ? 0 : Math.min(4, Math.ceil(day.count / max * 4))) as AggregateDay['level'],
  }));
  return { days, complete: unique.size > 0 && !missingDates.length && ![...unique.values()].some((calendar) => calendar.incomplete), missingDates };
}
