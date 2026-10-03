import fixture from './fixture-calendar.html?raw';

declare const __THEMES_ROOT__: string;
const THEMES_ROOT = __THEMES_ROOT__;
const store: Record<'local' | 'sync', Record<string, unknown>> = {
  local: JSON.parse(localStorage.getItem('cl-local') ?? '{}'),
  sync: JSON.parse(localStorage.getItem('cl-sync') ?? '{}'),
};
const listeners: Array<(changes: Record<string, { newValue: unknown }>, area: string) => void> = [];

function area(name: 'local' | 'sync') {
  return {
    async get(keys: string | string[]) {
      const list = typeof keys === 'string' ? [keys] : keys;
      return Object.fromEntries(list.filter((k) => k in store[name]).map((k) => [k, store[name][k]]));
    },
    async set(values: Record<string, unknown>) {
      Object.assign(store[name], values);
      localStorage.setItem(`cl-${name}`, JSON.stringify(store[name]));
      const changes = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { newValue: v }]));
      for (const fn of listeners) fn(changes, name);
    },
  };
}

(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: { getURL: (path: string) => `/@fs${THEMES_ROOT}${path.replace(/^themes\//, '')}` },
  storage: { local: area('local'), sync: area('sync'), onChanged: { addListener: (fn: (typeof listeners)[number]) => listeners.push(fn) } },
};
(window as unknown as { clStore: unknown }).clStore = { local: area('local'), sync: area('sync') };

document.getElementById('fixture')!.innerHTML = fixture;

const themes = ['city-nyc', 'city-paris', 'city-capetown', 'city-tokyo', 'forest-summer', 'forest-autumn', 'forest-winter', 'forest-spring', 'forest-rainforest'];
const select = document.getElementById('theme') as HTMLSelectElement;
const current = (store.sync.contributionLandsPopupSettings as { selectedThemeId?: string } | undefined)?.selectedThemeId ?? 'city-nyc';
for (const t of themes) select.add(new Option(t, t, false, t === current));
select.addEventListener('change', () => area('sync').set({ contributionLandsPopupSettings: { selectedThemeId: select.value } }));

for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
  btn.addEventListener('click', () => document.documentElement.setAttribute('data-color-mode', btn.dataset.mode!));
}
for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-width]')) {
  btn.addEventListener('click', () => (document.getElementById('profile-column')!.style.width = `${btn.dataset.width}px`));
}

await import('../src/content/content');
