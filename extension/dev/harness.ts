import fixture from './fixture-calendar.html?raw';
import { installChromeShim } from '../card/chrome-shim';

declare const __THEMES_ROOT__: string;
const THEMES_ROOT = __THEMES_ROOT__;
const { store, areas } = installChromeShim({
  themeUrl: (path) => `/@fs${THEMES_ROOT}${path.replace(/^themes\//, '')}`,
  persist: true,
});
(window as unknown as { clStore: unknown }).clStore = areas;

document.getElementById('fixture')!.innerHTML = fixture;

const todayLevel = new URLSearchParams(location.search).get('today');
if (todayLevel !== null) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
  const cell = document.querySelector<HTMLElement>(`td.ContributionCalendar-day[data-date="${today}"]`);
  const tip = cell && document.querySelector(`tool-tip[for="${cell.id}"]`);
  if (cell && tip) {
    const level = Number(todayLevel);
    tip.textContent = level === 0 ? 'No contributions on today.' : `${level * 9} contributions on today.`;
    cell.dataset.level = String(level);
  }
}

const themes = ['city-nyc', 'city-paris', 'city-capetown', 'city-tokyo', 'forest-summer', 'forest-autumn', 'forest-winter', 'forest-spring', 'forest-rainforest'];
const select = document.getElementById('theme') as HTMLSelectElement;
const current = (store.sync.contributionLandsPopupSettings as { selectedThemeId?: string } | undefined)?.selectedThemeId ?? 'city-nyc';
for (const t of themes) select.add(new Option(t, t, false, t === current));
select.addEventListener('change', () => areas.sync.set({ contributionLandsPopupSettings: { selectedThemeId: select.value } }));

for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
  btn.addEventListener('click', () => document.documentElement.setAttribute('data-color-mode', btn.dataset.mode!));
}
for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-width]')) {
  btn.addEventListener('click', () => (document.getElementById('profile-column')!.style.width = `${btn.dataset.width}px`));
}

await import('../src/content/content');
