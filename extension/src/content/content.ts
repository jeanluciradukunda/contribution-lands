/**
 * Contribution Lands — Content Script
 *
 * Mirrors the exact initialization pattern from isometric-contributions:
 *   1. Wait for .vcard-names-container (confirms profile page)
 *   2. MutationObserver on <main> or <body> watching for .js-calendar-graph
 *   3. Parse contribution data from DOM
 *   4. Inject canvas + toggle buttons
 *   5. Re-init on turbo:load (GitHub SPA navigation)
 */

import { IsoRenderer, type ContributionData } from './renderer';

// ============================================================
//  STATE
// ============================================================

let contributionsWrapper: HTMLElement | null = null;
let observer: MutationObserver | null = null;
let viewSetting: 'squares' | 'cubes' | 'both' = 'cubes';

// ============================================================
//  STORAGE (same pattern as isometric-contributions)
// ============================================================

function getStorage() {
  if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
    return chrome.storage.local;
  }
  return null;
}

async function loadSetting<T>(key: string, defaultValue: T): Promise<T> {
  const storage = getStorage();
  if (storage && typeof storage.get === 'function') {
    return new Promise((resolve) => {
      storage.get([key], (result: Record<string, T>) => {
        resolve(result[key] ?? defaultValue);
      });
    });
  }
  return defaultValue;
}

function saveSetting(key: string, value: unknown) {
  const storage = getStorage();
  if (storage && typeof storage.set === 'function') {
    storage.set({ [key]: value });
  }
}

// ============================================================
//  DOM PARSING (adapted from isometric-contributions/utils.js)
// ============================================================

function getContributionCount(text: string): number {
  const match = text.match(/(\d+|No) contributions? on/);
  if (!match) return 0;
  return match[1] === 'No' ? 0 : parseInt(match[1], 10);
}

function parseCalendarGraph(): ContributionData[] | null {
  const dayElements = document.querySelectorAll(
    '.js-calendar-graph-table tbody td.ContributionCalendar-day'
  );
  const tooltipElements = document.querySelectorAll(
    '.js-calendar-graph tool-tip'
  );

  if (!dayElements.length) {
    console.log('[CL] No calendar day elements found');
    return null;
  }

  console.log(`[CL] Found ${dayElements.length} day cells, ${tooltipElements.length} tooltips`);

  // Build tooltip lookup
  const tooltipMap = new Map<string, number>();
  tooltipElements.forEach((t) => {
    tooltipMap.set(t.id, getContributionCount(t.textContent ?? ''));
  });

  const data: ContributionData[] = [];

  dayElements.forEach((el) => {
    const td = el as HTMLElement;
    const date = td.dataset.date;
    if (!date) return;

    const week = parseInt(td.dataset.ix ?? '0', 10);
    const level = parseInt(td.getAttribute('data-level') ?? '0', 10);

    // Get row index (day of week)
    const tr = td.closest('tr');
    let day = 0;
    if (tr?.parentElement) {
      const rows = tr.parentElement.querySelectorAll('tr');
      rows.forEach((row, idx) => {
        if (row === tr) day = idx;
      });
    }

    // Get count from tooltip
    const tid = td.getAttribute('aria-labelledby') ?? '';
    const count = tooltipMap.get(tid) ?? 0;

    data.push({
      date,
      week,
      day,
      level: Math.min(4, Math.max(0, level)) as 0 | 1 | 2 | 3 | 4,
      count,
    });
  });

  return data.length > 0 ? data : null;
}

// ============================================================
//  THEME + SPRITE LOADING
// ============================================================

async function loadThemeAndSprites() {
  let themeId = 'city-nyc';
  try {
    themeId = await loadSetting('selectedThemeId', 'city-nyc');
  } catch {}

  // Load theme config
  let config = {
    name: 'NYC Skyline',
    background: '#0a0e14',
    ground_colors: ['#3a3a40', '#35353b', '#404046'],
    ground_stroke: '#2a2a30',
  };

  try {
    const url = chrome.runtime.getURL(`themes/${themeId}/theme.json`);
    const res = await fetch(url);
    config = await res.json();
  } catch (e) {
    console.log('[CL] Failed to load theme config, using defaults', e);
  }

  // Load sprites — try variants a through z, stop when not found
  const sprites: Record<number, HTMLImageElement[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };

  for (let level = 0; level <= 4; level++) {
    for (let vi = 0; vi < 26; vi++) {
      const variant = String.fromCharCode(97 + vi);
      const spriteUrl = chrome.runtime.getURL(`themes/${themeId}/sprites/level-${level}-${variant}.png`);

      try {
        const img = await new Promise<HTMLImageElement | null>((resolve) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => resolve(null);
          image.src = spriteUrl;
        });
        if (img) {
          sprites[level].push(img);
        } else {
          break; // No more variants for this level
        }
      } catch {
        break;
      }
    }
  }

  console.log(`[CL] Loaded theme "${config.name}", sprites:`,
    Object.entries(sprites).map(([l, s]) => `L${l}:${s.length}`).join(' '));

  return { themeId, config, sprites };
}

// ============================================================
//  VIEW TOGGLE (CSS class approach from isometric-contributions)
// ============================================================

function applyViewType(container: HTMLElement, type: string) {
  container.classList.toggle('cl-squares', type === 'squares');
  container.classList.toggle('cl-cubes', type === 'cubes');
  container.classList.toggle('cl-both', type === 'both');
}

function injectCSS() {
  if (document.getElementById('contribution-lands-css')) return;
  const style = document.createElement('style');
  style.id = 'contribution-lands-css';
  style.textContent = `
    /* Original graph only */
    .cl-squares #contribution-lands-canvas,
    .cl-squares .cl-contributions-wrapper { display: none; }

    /* Isometric only */
    .cl-cubes .js-calendar-graph { display: none !important; }

    /* Both — everything visible */

    /* Toggle buttons */
    .cl-toggle-option.selected {
      background-color: #1f6feb !important;
      color: #fff !important;
      border-color: #1f6feb !important;
    }
  `;
  document.head.appendChild(style);
}

// ============================================================
//  MAIN: generateIsometricChart (mirrors isometric-contributions)
// ============================================================

async function generateIsometricChart() {
  const calendarGraph = document.querySelector('.js-calendar-graph');
  const contributionsBox = document.querySelector('.js-yearly-contributions');

  if (!calendarGraph || !contributionsBox) {
    console.log('[CL] Calendar graph or contributions box not found');
    return;
  }

  console.log('[CL] Generating isometric chart...');

  // Parse contribution data
  const data = parseCalendarGraph();
  if (!data || data.length === 0) {
    console.log('[CL] No contribution data parsed');
    return;
  }

  // Load theme
  const { config, sprites } = await loadThemeAndSprites();

  // Create wrapper (same pattern as isometric-contributions)
  contributionsWrapper = document.createElement('div');
  contributionsWrapper.className = 'cl-contributions-wrapper position-relative';
  calendarGraph.before(contributionsWrapper);

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'contribution-lands-canvas';
  canvas.style.width = '100%';
  contributionsWrapper.appendChild(canvas);

  // Render
  const renderer = new IsoRenderer(canvas, data, config, sprites);
  renderer.render();

  // Inject toggle buttons (same position as isometric-contributions: before the H2)
  let insertLocation: Element | null = contributionsBox.querySelector('h2');
  if (
    insertLocation?.previousElementSibling &&
    insertLocation.previousElementSibling.nodeName === 'DETAILS'
  ) {
    insertLocation = insertLocation.previousElementSibling;
  }

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'BtnGroup mt-1 ml-3 position-relative top-0 float-right';

  const modes: { label: string; value: string }[] = [
    { label: '2D', value: 'squares' },
    { label: 'Lands', value: 'cubes' },
    { label: 'Both', value: 'both' },
  ];

  modes.forEach(({ label, value }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = `cl-toggle-option ${value} btn BtnGroup-item btn-sm py-0 px-1`;
    btn.dataset.clOption = value;
    if (viewSetting === value) btn.classList.add('selected');

    btn.addEventListener('click', () => {
      for (const toggle of document.querySelectorAll('.cl-toggle-option')) {
        toggle.classList.remove('selected');
      }
      btn.classList.add('selected');
      viewSetting = value as typeof viewSetting;
      saveSetting('viewSetting', value);
      applyViewType(contributionsBox as HTMLElement, value);
    });

    buttonGroup.appendChild(btn);
  });

  if (insertLocation) {
    insertLocation.before(buttonGroup);
  }

  // Apply current view
  applyViewType(contributionsBox as HTMLElement, viewSetting);

  console.log(`[CL] Initialized! ${data.length} cells, theme: ${config.name}, view: ${viewSetting}`);
}

// ============================================================
//  SETUP OBSERVER (exact pattern from isometric-contributions)
// ============================================================

function setupObserver() {
  // Must be on a profile page
  if (!document.querySelector('.vcard-names-container')) {
    console.log('[CL] Not a profile page (no .vcard-names-container)');
    return;
  }

  // Cleanup previous
  document.querySelector('.cl-contributions-wrapper')?.remove();
  document.querySelector('.cl-toggle-option')?.parentElement?.remove();

  // Try immediately
  const initIfReady = () => {
    if (
      document.querySelector('.js-calendar-graph') &&
      !document.querySelector('.cl-contributions-wrapper')
    ) {
      generateIsometricChart();
    }
  };

  initIfReady();

  // Observe for lazy-loaded graph
  observer?.disconnect();
  const target = document.querySelector('main') || document.body;
  observer = new MutationObserver(() => initIfReady());
  observer.observe(target, { childList: true, subtree: true });
}

// ============================================================
//  ENTRY POINT (exact pattern from isometric-contributions)
// ============================================================

(async () => {
  console.log('[CL] Content script loaded on', window.location.href);

  injectCSS();
  viewSetting = await loadSetting('viewSetting', 'cubes');

  // Listen for theme changes (dark/light mode)
  globalThis.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (document.querySelector('.cl-contributions-wrapper')) {
      document.querySelector('.cl-contributions-wrapper')?.remove();
      document.querySelector('.cl-toggle-option')?.parentElement?.remove();
      generateIsometricChart();
    }
  });

  setupObserver();
  document.addEventListener('turbo:load', setupObserver);
  document.addEventListener('visibilitychange', () => {
    if (
      document.visibilityState === 'visible' &&
      document.querySelector('.cl-contributions-wrapper')
    ) {
      // Re-render when tab becomes visible (performance optimization)
    }
  });

  // Re-render on theme change from popup
  try {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.selectedThemeId) {
        document.querySelector('.cl-contributions-wrapper')?.remove();
        document.querySelector('.cl-toggle-option')?.parentElement?.remove();
        generateIsometricChart();
      }
    });
  } catch {}
})();
