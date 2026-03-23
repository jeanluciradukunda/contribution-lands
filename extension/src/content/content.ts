/**
 * Contribution Lands — Content Script
 *
 * Injected into GitHub profile pages. Reads the contribution calendar,
 * replaces it with an isometric themed visualization using sprites.
 *
 * How isometric-contributions does it (our reference):
 *   1. Wait for .js-calendar-graph to appear in DOM
 *   2. Read <td class="ContributionCalendar-day"> elements
 *   3. Extract data-date and data-level (0-4) from each cell
 *   4. Create a <canvas> overlay
 *   5. Render isometric view
 *   6. Toggle between original/isometric via injected buttons
 *   7. MutationObserver to re-init on SPA navigation
 *
 * We follow the same pattern but render sprites instead of obelisk.js cubes.
 */

import { IsoRenderer, type ContributionData } from './renderer';

// ============================================================
//  DOM SELECTORS (matching GitHub's contribution graph)
// ============================================================

const SELECTORS = {
  calendarGraph: '.js-calendar-graph',
  calendarTable: '.js-calendar-graph-table',
  contributionDay: 'td.ContributionCalendar-day',
  yearlyContributions: '.js-yearly-contributions',
  profileIndicator: '.vcard-names-container, [itemtype="http://schema.org/Person"]',
};

// ============================================================
//  CONTRIBUTION DATA EXTRACTION
// ============================================================

function parseContributionGraph(): ContributionData[] | null {
  const table = document.querySelector(SELECTORS.calendarTable);
  if (!table) return null;

  const cells = table.querySelectorAll(SELECTORS.contributionDay);
  if (!cells.length) return null;

  const data: ContributionData[] = [];

  cells.forEach((cell) => {
    const td = cell as HTMLElement;
    const date = td.getAttribute('data-date');
    const level = parseInt(td.getAttribute('data-level') ?? '0', 10);

    if (!date) return;

    // data-ix is the week index (column position)
    const week = parseInt(td.getAttribute('data-ix') ?? '0', 10);

    // Row position from the <tr> parent (0 = Sun, 6 = Sat)
    const tr = td.closest('tr');
    const rows = tr?.parentElement?.querySelectorAll('tr');
    let day = 0;
    if (rows) {
      rows.forEach((row, idx) => {
        if (row === tr) day = idx;
      });
    }

    // Get contribution count from tooltip
    let count = 0;
    const tooltipId = td.getAttribute('aria-labelledby');
    if (tooltipId) {
      const tooltip = document.getElementById(tooltipId);
      if (tooltip) {
        const match = tooltip.textContent?.match(/(\d+)\s+contribution/);
        if (match) count = parseInt(match[1], 10);
      }
    }

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
//  UI INJECTION
// ============================================================

type ViewMode = 'original' | 'isometric' | 'both';

function createToggleButtons(
  container: HTMLElement,
  onToggle: (mode: ViewMode) => void,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'cl-toggle-wrapper';
  wrapper.style.cssText = `
    display: flex; gap: 4px; margin-bottom: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  `;

  const modes: { label: string; value: ViewMode }[] = [
    { label: '■ Squares', value: 'original' },
    { label: '◆ Lands', value: 'isometric' },
    { label: '■◆ Both', value: 'both' },
  ];

  modes.forEach(({ label, value }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.dataset.clMode = value;
    btn.style.cssText = `
      padding: 3px 10px; font-size: 12px; border-radius: 6px;
      border: 1px solid #30363d; background: #21262d; color: #8b949e;
      cursor: pointer; transition: all 0.15s;
    `;
    btn.addEventListener('click', () => {
      wrapper.querySelectorAll('button').forEach((b) => {
        (b as HTMLElement).style.background = '#21262d';
        (b as HTMLElement).style.color = '#8b949e';
        (b as HTMLElement).style.borderColor = '#30363d';
      });
      btn.style.background = '#1f6feb';
      btn.style.color = '#fff';
      btn.style.borderColor = '#1f6feb';
      onToggle(value);
    });
    wrapper.appendChild(btn);
  });

  // Find the H2 heading before the graph and insert toggle before it
  const heading = container.querySelector('h2');
  if (heading?.parentElement) {
    heading.parentElement.insertBefore(wrapper, heading);
  } else {
    container.prepend(wrapper);
  }

  return wrapper;
}

function createCanvasContainer(): HTMLElement {
  const div = document.createElement('div');
  div.id = 'contribution-lands-container';
  div.style.cssText = `
    width: 100%; overflow-x: auto; margin-top: 8px;
    border-radius: 6px; position: relative;
  `;
  return div;
}

// ============================================================
//  THEME LOADING
// ============================================================

interface ThemeConfig {
  name: string;
  background: string;
  ground_colors: string[];
  ground_stroke: string;
}

async function loadSelectedTheme(): Promise<{
  themeId: string;
  config: ThemeConfig;
  sprites: Record<number, HTMLImageElement[]>;
}> {
  // Read theme selection from chrome.storage
  let themeId = 'city-nyc'; // default
  try {
    const stored = await chrome.storage.sync.get('selectedThemeId');
    if (stored.selectedThemeId) themeId = stored.selectedThemeId;
  } catch {
    // Not in extension context (e.g., testing). Use default.
  }

  // Load theme.json
  const themeUrl = chrome.runtime.getURL(`themes/${themeId}/theme.json`);
  let config: ThemeConfig;
  try {
    const res = await fetch(themeUrl);
    config = await res.json();
  } catch {
    config = {
      name: 'NYC Skyline',
      background: '#0a0e14',
      ground_colors: ['#3a3a40', '#35353b', '#404046'],
      ground_stroke: '#2a2a30',
    };
  }

  // Discover and load sprites
  const sprites: Record<number, HTMLImageElement[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };

  for (let level = 0; level <= 4; level++) {
    const variants = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    for (const v of variants) {
      try {
        const url = chrome.runtime.getURL(`themes/${themeId}/sprites/level-${level}-${v}.png`);
        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => { sprites[level].push(img); resolve(); };
          img.onerror = () => resolve(); // Skip missing variants
        });
        img.src = url;
      } catch {
        break;
      }
    }
  }

  return { themeId, config, sprites };
}

// ============================================================
//  MAIN INITIALIZATION
// ============================================================

let currentRenderer: IsoRenderer | null = null;
let currentToggle: HTMLElement | null = null;

async function initContributionLands() {
  const graphContainer = document.querySelector(SELECTORS.yearlyContributions);
  const calendarGraph = document.querySelector(SELECTORS.calendarGraph);
  if (!graphContainer || !calendarGraph) return;

  // Don't double-initialize
  if (document.getElementById('contribution-lands-container')) return;

  // Parse contribution data
  const contributions = parseContributionGraph();
  if (!contributions || contributions.length === 0) return;

  // Load theme and sprites
  const { config, sprites } = await loadSelectedTheme();

  // Create canvas container
  const canvasContainer = createCanvasContainer();
  calendarGraph.parentElement?.insertBefore(canvasContainer, calendarGraph.nextSibling);

  // Create renderer
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width: 100%; display: block;';
  canvasContainer.appendChild(canvas);

  currentRenderer = new IsoRenderer(canvas, contributions, config, sprites);
  currentRenderer.render();

  // Add toggle buttons
  let viewMode: ViewMode = 'isometric';
  const originalGraph = calendarGraph as HTMLElement;

  // Load saved view mode
  try {
    const stored = await chrome.storage.sync.get('viewMode');
    if (stored.viewMode) viewMode = stored.viewMode;
  } catch {}

  currentToggle = createToggleButtons(graphContainer as HTMLElement, (mode) => {
    viewMode = mode;
    try { chrome.storage.sync.set({ viewMode: mode }); } catch {}

    if (mode === 'original') {
      originalGraph.style.display = '';
      canvasContainer.style.display = 'none';
    } else if (mode === 'isometric') {
      originalGraph.style.display = 'none';
      canvasContainer.style.display = '';
    } else {
      originalGraph.style.display = '';
      canvasContainer.style.display = '';
    }
  });

  // Apply initial view mode
  if (viewMode === 'isometric') {
    originalGraph.style.display = 'none';
  } else if (viewMode === 'original') {
    canvasContainer.style.display = 'none';
  }

  // Activate the right button
  const activeBtn = currentToggle.querySelector(`[data-cl-mode="${viewMode}"]`) as HTMLElement;
  if (activeBtn) {
    activeBtn.style.background = '#1f6feb';
    activeBtn.style.color = '#fff';
    activeBtn.style.borderColor = '#1f6feb';
  }

  console.log(`[Contribution Lands] Initialized with ${contributions.length} cells, theme: ${config.name}`);
}

// ============================================================
//  CLEANUP (for SPA re-navigation)
// ============================================================

function cleanup() {
  const existing = document.getElementById('contribution-lands-container');
  if (existing) existing.remove();
  if (currentToggle) currentToggle.remove();
  currentRenderer = null;
  currentToggle = null;
}

// ============================================================
//  OBSERVER — detect GitHub SPA navigation
// ============================================================

function setupObserver() {
  // Initial attempt
  if (document.querySelector(SELECTORS.calendarGraph)) {
    initContributionLands();
  }

  // Watch for DOM changes (GitHub is an SPA — the page mutates)
  const observer = new MutationObserver(() => {
    // Check if we're on a profile page with a contribution graph
    if (document.querySelector(SELECTORS.calendarGraph)) {
      if (!document.getElementById('contribution-lands-container')) {
        initContributionLands();
      }
    } else {
      // Navigated away from profile — clean up
      cleanup();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Also listen to GitHub's turbo navigation events
  document.addEventListener('turbo:load', () => {
    cleanup();
    setTimeout(initContributionLands, 500);
  });

  // Re-render on theme change from popup
  try {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.selectedThemeId) {
        cleanup();
        initContributionLands();
      }
    });
  } catch {}
}

// ============================================================
//  ENTRY POINT
// ============================================================

setupObserver();
