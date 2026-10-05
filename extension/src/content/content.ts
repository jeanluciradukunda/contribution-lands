/**
 * Contribution Lands — content script.
 *
 * Same lifecycle as isometric-contributions: wait for a profile page, watch
 * for the lazily rendered calendar, then inject the canvas, stats and toggle.
 */

import { IsoRenderer, type ContributionData, type Sprite, type SpriteSet, type ThemeConfig } from './renderer';
import { addDays, averagePerDay, computeStats, fetchDays, reconcileStart, todayKey, tooltipCounts, extendWithHistory, formatDate, formatRange, longestStreak, currentStreak, type ContributionStats, type Streak } from './stats';
import contentCss from './content.css?inline';

type ViewSetting = 'squares' | 'cubes' | 'both';

interface Settings {
  viewSetting: ViewSetting;
  motion: boolean;
  showStats: boolean;
}

const DEFAULTS: Settings = { viewSetting: 'cubes', motion: true, showStats: true };
const POPUP_KEY = 'contributionLandsPopupSettings';

let settings: Settings = { ...DEFAULTS };
let observer: MutationObserver | null = null;
let renderer: IsoRenderer | null = null;
let historyRequest: AbortController | null = null;
let generating = false;
let selectionObserver: MutationObserver | null = null;

// ============================================================
//  SETTINGS
// ============================================================

async function loadSettings(): Promise<Settings> {
  try {
    const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
    return { ...DEFAULTS, ...stored } as Settings;
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  settings[key] = value;
  try {
    void chrome.storage.local.set({ [key]: value });
  } catch {
    // Extension context invalidated after a reload; the page keeps working.
  }
}

// ============================================================
//  DOM PARSING
// ============================================================

function parseCalendarGraph(): ContributionData[] | null {
  const dayElements = document.querySelectorAll<HTMLElement>('.js-calendar-graph-table tbody td.ContributionCalendar-day');
  if (!dayElements.length) return null;

  const counts = tooltipCounts(document.querySelectorAll('.js-calendar-graph tool-tip'));

  const data: ContributionData[] = [];
  for (const td of dayElements) {
    const date = td.dataset.date;
    if (!date) continue;
    const row = td.closest('tr');
    const day = row?.parentElement ? [...row.parentElement.children].indexOf(row) : 0;
    data.push({
      date,
      week: Number.parseInt(td.dataset.ix ?? '0', 10),
      day,
      level: Math.min(4, Math.max(0, Number.parseInt(td.dataset.level ?? '0', 10))) as ContributionData['level'],
      count: counts.get(td.id) ?? counts.get(td.getAttribute('aria-labelledby') ?? '') ?? 0,
    });
  }
  return data.length ? data : null;
}

// ============================================================
//  THEME + SPRITES
// ============================================================

const FALLBACK_THEME: ThemeConfig = {
  name: 'NYC Skyline',
  category: 'city',
  background: '#0a0e14',
  ground_colors: ['#3a3a40', '#35353b', '#404046'],
  ground_stroke: '#2a2a30',
};

async function loadBitmap(path: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(chrome.runtime.getURL(path));
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

async function spriteFiles(themeId: string): Promise<Record<string, string[]>> {
  try {
    const res = await fetch(chrome.runtime.getURL(`themes/${themeId}/sprites/sprites.json`));
    if (res.ok) return await res.json();
  } catch {
    // Dev builds have no manifest; fall through to probing.
  }
  const found: Record<string, string[]> = {};
  for (let level = 0; level <= 4; level++) {
    found[level] = [];
    for (let i = 0; i < 26; i++) {
      const name = `level-${level}-${String.fromCharCode(97 + i)}.png`;
      const res = await fetch(chrome.runtime.getURL(`themes/${themeId}/sprites/${name}`)).catch(() => null);
      if (!res?.ok) break;
      found[level].push(name);
    }
  }
  return found;
}

async function loadTheme(): Promise<{ config: ThemeConfig; sprites: SpriteSet; todayStages: Array<ImageBitmap | null> }> {
  let themeId = 'city-nyc';
  try {
    const result = await chrome.storage.sync.get(POPUP_KEY);
    const saved = result[POPUP_KEY] as { selectedThemeId?: string } | undefined;
    if (saved?.selectedThemeId) themeId = saved.selectedThemeId;
  } catch {
    // Use the default theme.
  }

  let config = FALLBACK_THEME;
  try {
    const res = await fetch(chrome.runtime.getURL(`themes/${themeId}/theme.json`));
    config = await res.json();
  } catch {
    themeId = 'city-nyc';
  }

  const files = await spriteFiles(themeId);
  const sprites: SpriteSet = {};
  await Promise.all(
    [0, 1, 2, 3, 4].map(async (level) => {
      const names = (files[level] ?? []).filter((f) => !f.includes('-road-'));
      const loaded = await Promise.all(
        names.map(async (name) => ({ name, image: await loadBitmap(`themes/${themeId}/sprites/${name}`) })),
      );
      sprites[level] = loaded.filter((s): s is Sprite => s.image !== null);
    }),
  );
  const stageNames = config.today_sprites ?? (config.today_sprite ? [config.today_sprite] : []);
  const todayStages = await Promise.all(stageNames.map((name) => loadBitmap(`themes/${themeId}/sprites/${name}`)));
  return { config, sprites, todayStages };
}

// ============================================================
//  STATS PANELS
// ============================================================

function statBlock(id: string, value: string, unit: string, label: string, detail: string): string {
  return `
    <div class="cl-stat">
      <span class="cl-stat-value" id="${id}-value">${value}${unit ? ` <span class="cl-stat-unit">${unit}</span>` : ''}</span>
      <span class="cl-stat-label">${label}</span>
      <span class="cl-stat-detail" id="${id}-detail">${detail}</span>
    </div>`;
}

function streakDetail(streak: Streak, empty: string): string {
  return streak.length > 0 && streak.start && streak.end ? formatRange(streak.start, streak.end, streak.length) : empty;
}

interface Pending {
  longest: boolean;
  current: boolean;
}

function renderStats(wrapper: HTMLElement, stats: ContributionStats, viewingYear: boolean, pending: Pending) {
  const top = document.createElement('div');
  top.className = 'cl-panel cl-panel-top';
  top.innerHTML = `
    <h5 class="cl-panel-title">Contributions</h5>
    <div class="cl-panel-box">
      ${statBlock('cl-total', stats.total.toLocaleString(), '', 'Total', formatRange(stats.firstDate, stats.lastDate))}
      ${viewingYear ? '' : statBlock('cl-week', stats.weekTotal.toLocaleString(), '', 'This week', formatRange(stats.weekStart, stats.lastDate))}
      ${statBlock('cl-best', stats.bestCount.toLocaleString(), '', 'Best day', stats.bestDate ? formatDate(stats.bestDate) : 'No activity')}
    </div>
    <p class="cl-panel-note">Average: <strong id="cl-average">${stats.average}</strong> <span>/ day</span></p>`;

  const bottom = document.createElement('div');
  bottom.className = 'cl-panel cl-panel-bottom';
  const streak = (id: string, s: Streak, label: string, empty: string, loading: boolean) =>
    loading
      ? statBlock(id, '…', 'days', label, 'Checking earlier years…')
      : statBlock(id, String(s.length), 'days', label, streakDetail(s, empty));
  bottom.innerHTML = `
    <h5 class="cl-panel-title">Streaks</h5>
    <div class="cl-panel-box">
      ${streak('cl-longest', stats.longest, 'Longest', 'No streak yet', pending.longest)}
      ${viewingYear ? '' : streak('cl-current', stats.current, 'Current', 'No current streak', pending.current)}
    </div>`;

  wrapper.append(top, bottom);
}

function updateStreak(id: string, streak: Streak, empty: string) {
  const value = document.getElementById(`${id}-value`);
  const detail = document.getElementById(`${id}-detail`);
  if (value) value.innerHTML = `${streak.length} <span class="cl-stat-unit">days</span>`;
  if (detail) detail.textContent = streakDetail(streak, empty);
}

function headingTotal(box: Element): number | null {
  const match = box.querySelector('h2')?.textContent?.match(/([\d,]+)\s+contributions?/);
  return match ? Number.parseInt(match[1].replace(/,/g, ''), 10) : null;
}

/**
 * The panel must agree with GitHub's heading. When the heading counts days the
 * calendar no longer shows, fetch them so the range and average describe the
 * same window as the number.
 */
async function alignWithHeading(stats: ContributionStats, heading: number) {
  const calendarTotal = stats.total;
  stats.total = heading;
  const username = location.pathname.split('/').filter(Boolean)[0];
  if (heading <= calendarTotal || !username) return;
  try {
    const earlier = await fetchDays(username, addDays(stats.firstDate, -7), addDays(stats.firstDate, -1));
    const start = reconcileStart(calendarTotal, heading, earlier);
    if (!start || !document.querySelector('.cl-contributions-wrapper')) return;
    stats.firstDate = start;
    stats.average = averagePerDay(heading, start, stats.lastDate);
    const detail = document.getElementById('cl-total-detail');
    const average = document.getElementById('cl-average');
    if (detail) detail.textContent = formatRange(start, stats.lastDate);
    if (average) average.textContent = String(stats.average);
  } catch {
    // Keep the heading's total with the calendar's range.
  }
}

function pendingHistory(data: ContributionData[], stats: ContributionStats): Pending {
  const username = location.pathname.split('/').filter(Boolean)[0];
  const first = data.reduce((a, b) => (a.date <= b.date ? a : b));
  const reachesStart = (s: Streak) => Boolean(username) && first.count > 0 && s.start === first.date;
  return { longest: reachesStart(stats.longest), current: reachesStart(stats.current) };
}

async function extendStreaks(data: ContributionData[], stats: ContributionStats, pending: Pending) {
  if (!pending.longest && !pending.current) return;
  const username = location.pathname.split('/').filter(Boolean)[0];
  historyRequest?.abort();
  const request = new AbortController();
  historyRequest = request;
  let days: Array<{ date: string; count: number }> = data;
  try {
    days = await extendWithHistory(username, data, request.signal);
  } catch {
    // Fall back to the visible calendar.
  }
  if (request.signal.aborted) return;
  const longest = days === data ? stats.longest : longestStreak(days);
  const current = days === data ? stats.current : currentStreak(days);
  updateStreak('cl-longest', longest, 'No streak yet');
  updateStreak('cl-current', current, 'No current streak');
  renderer?.setStreaks({ longest, current });
}

// ============================================================
//  VIEW TOGGLE
// ============================================================

function applyView(box: Element, view: ViewSetting) {
  box.classList.toggle('cl-squares', view === 'squares');
  box.classList.toggle('cl-cubes', view === 'cubes');
  box.classList.toggle('cl-both', view === 'both');
  for (const btn of document.querySelectorAll<HTMLButtonElement>('.cl-toggle-option')) {
    const selected = btn.dataset.clOption === view;
    btn.classList.toggle('selected', selected);
    btn.setAttribute('aria-pressed', String(selected));
  }
}

function applyStatsVisibility(box: Element) {
  box.classList.toggle('cl-hide-stats', !settings.showStats);
}

function injectToggle(box: Element) {
  const group = document.createElement('div');
  group.className = 'BtnGroup cl-toggle';
  const modes: Array<[string, ViewSetting]> = [['2D', 'squares'], ['Lands', 'cubes'], ['Both', 'both']];
  for (const [label, value] of modes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.className = 'cl-toggle-option btn BtnGroup-item btn-sm py-0 px-2';
    btn.dataset.clOption = value;
    btn.addEventListener('click', () => {
      saveSetting('viewSetting', value);
      applyView(box, value);
    });
    group.append(btn);
  }

  const expand = document.createElement('button');
  expand.type = 'button';
  expand.className = 'cl-expand btn btn-sm py-0 px-2';
  expand.setAttribute('aria-label', 'Expand the land');
  expand.setAttribute('aria-expanded', 'false');
  expand.title = 'Expand';
  expand.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M3.72 3.72a.75.75 0 0 1 .53-.22h2.5a.75.75 0 0 1 0 1.5H6.06l1.97 1.97a.75.75 0 0 1-1.06 1.06L5 6.06v.69a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 .22-.53Zm8.56 8.56a.75.75 0 0 1-.53.22h-2.5a.75.75 0 0 1 0-1.5h.69l-1.97-1.97a.75.75 0 1 1 1.06-1.06L11 9.94v-.69a.75.75 0 0 1 1.5 0v2.5a.75.75 0 0 1-.22.53Z"/></svg>';
  expand.addEventListener('click', () => openExpanded(expand));

  const controls = document.createElement('div');
  controls.className = 'cl-controls d-flex flex-items-center float-right';
  const settingsMenu = box.querySelector('focus-group, details.contrib-settings');
  if (settingsMenu) {
    settingsMenu.before(controls);
    controls.append(settingsMenu, group, expand);
  } else {
    controls.append(group, expand);
    box.querySelector('h2')?.before(controls);
  }
}

/**
 * Moves the existing land into a near-full-screen overlay; the renderer re-lays
 * itself out for the new width, so nothing is rebuilt and all interaction keeps working.
 */
function openExpanded(trigger: HTMLElement) {
  const wrapper = document.querySelector<HTMLElement>('.cl-contributions-wrapper');
  if (!wrapper || document.querySelector('.cl-overlay')) return;
  const placeholder = document.createComment('cl-land');
  wrapper.before(placeholder);

  const overlay = document.createElement('div');
  overlay.className = 'cl-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Contribution land, expanded');
  const panel = document.createElement('div');
  panel.className = 'cl-overlay-panel';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'cl-overlay-close btn btn-sm';
  close.textContent = 'Close';
  close.setAttribute('aria-label', 'Close the expanded land');
  panel.append(close, wrapper);
  overlay.append(panel);
  document.body.append(overlay);
  document.documentElement.classList.add('cl-overlay-open');
  trigger.setAttribute('aria-expanded', 'true');
  wrapper.classList.add('is-expanded');
  close.focus();

  const shut = () => {
    document.removeEventListener('keydown', onKey, true);
    wrapper.classList.remove('is-expanded');
    placeholder.replaceWith(wrapper);
    overlay.remove();
    document.documentElement.classList.remove('cl-overlay-open');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      shut();
    }
  };
  document.addEventListener('keydown', onKey, true);
  close.addEventListener('click', shut);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) shut();
  });
  closeExpanded = shut;
}

let closeExpanded: (() => void) | null = null;

function dayCell(date: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.js-calendar-graph td.ContributionCalendar-day[data-date="${date}"]`);
}

/** GitHub owns day selection (it filters the activity feed); the land only reflects it. */
function mirrorSelection(calendarGraph: Element) {
  const sync = () => {
    const selected = calendarGraph.querySelector<HTMLElement>('td.ContributionCalendar-day[aria-selected="true"]');
    renderer?.setSelected(selected?.dataset.date ?? null);
  };
  selectionObserver?.disconnect();
  selectionObserver = new MutationObserver(sync);
  selectionObserver.observe(calendarGraph, { subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
  sync();
}

function teardown() {
  closeExpanded?.();
  closeExpanded = null;
  selectionObserver?.disconnect();
  selectionObserver = null;
  historyRequest?.abort();
  historyRequest = null;
  renderer?.destroy();
  renderer = null;
  document.querySelector('.cl-contributions-wrapper')?.remove();
  const controls = document.querySelector('.cl-controls');
  if (controls) {
    const settingsMenu = controls.querySelector('focus-group, details.contrib-settings');
    if (settingsMenu) controls.before(settingsMenu);
    controls.remove();
  }
}

// ============================================================
//  MAIN
// ============================================================

async function generate() {
  if (generating || document.querySelector('.cl-contributions-wrapper')) return;
  generating = true;
  try {
    const calendarGraph = document.querySelector('.js-calendar-graph');
    const box = document.querySelector('.js-yearly-contributions');
    if (!calendarGraph || !box) return;
    const data = parseCalendarGraph();
    if (!data) return;

    const { config, sprites, todayStages } = await loadTheme();
    if (document.querySelector('.cl-contributions-wrapper') || !calendarGraph.isConnected) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'cl-contributions-wrapper';
    calendarGraph.before(wrapper);

    const canvas = document.createElement('canvas');
    canvas.id = 'contribution-lands-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${config.name} contribution land`);
    wrapper.append(canvas);

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stats = computeStats(data);
    renderer = new IsoRenderer(canvas, data, config, sprites, {
      today: { date: todayKey(), stages: todayStages },
      streaks: { longest: stats.longest, current: stats.current },
      motion: settings.motion && !reducedMotion,
      obstacles: () => {
        const panel = wrapper.querySelector<HTMLElement>('.cl-panel-top');
        if (!panel || getComputedStyle(panel).position !== 'absolute' || panel.offsetParent === null) return [];
        return [{ left: panel.offsetLeft, right: panel.offsetLeft + panel.offsetWidth, bottom: panel.offsetTop + panel.offsetHeight }];
      },
      onSelect: (date) => dayCell(date)?.click(),
    });
    mirrorSelection(calendarGraph);

    const heading = box.querySelector('h2')?.textContent ?? '';
    const viewingYear = /in \d{4}/.test(heading);
    const shownTotal = headingTotal(box);
    if (shownTotal !== null && shownTotal !== stats.total) void alignWithHeading(stats, shownTotal);
    const pending = pendingHistory(data, stats);
    renderStats(wrapper, stats, viewingYear, pending);
    if (!document.querySelector('.cl-controls')) injectToggle(box);
    applyView(box, settings.viewSetting);
    applyStatsVisibility(box);
    void extendStreaks(data, stats, pending);
  } finally {
    generating = false;
  }
}

function setupObserver() {
  observer?.disconnect();
  teardown();
  if (!document.querySelector('.vcard-names-container')) return;

  const initIfReady = () => {
    if (document.querySelector('.js-calendar-graph') && !document.querySelector('.cl-contributions-wrapper')) {
      void generate();
    }
  };
  initIfReady();
  observer = new MutationObserver(initIfReady);
  observer.observe(document.querySelector('main') ?? document.body, { childList: true, subtree: true });
}

function injectCss() {
  if (document.getElementById('contribution-lands-css')) return;
  const style = document.createElement('style');
  style.id = 'contribution-lands-css';
  style.textContent = contentCss;
  document.head.append(style);
}

(async () => {
  injectCss();
  settings = await loadSettings();
  setupObserver();
  document.addEventListener('turbo:load', setupObserver);

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes[POPUP_KEY]) {
        teardown();
        void generate();
        return;
      }
      if (area !== 'local') return;
      const box = document.querySelector('.js-yearly-contributions');
      if (changes.viewSetting) {
        settings.viewSetting = changes.viewSetting.newValue as ViewSetting;
        if (box) applyView(box, settings.viewSetting);
      }
      if (changes.motion) {
        settings.motion = Boolean(changes.motion.newValue);
        renderer?.setMotion(settings.motion && !matchMedia('(prefers-reduced-motion: reduce)').matches);
      }
      if (changes.showStats) {
        settings.showStats = Boolean(changes.showStats.newValue);
        if (box) applyStatsVisibility(box);
        renderer?.relayout();
      }
    });
  } catch {
    // No extension context (harness or invalidated).
  }
})();
