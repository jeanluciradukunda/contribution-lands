import { installChromeShim } from './chrome-shim';

const params = new URLSearchParams(location.search);
const theme = params.get('theme') ?? 'city-nyc';
document.documentElement.setAttribute('data-color-mode', params.get('scheme') === 'dark' ? 'dark' : 'light');

installChromeShim({
  themeUrl: (path) => `/${path}`,
  initial: {
    local: { viewSetting: 'cubes', motion: false, showStats: true },
    sync: { contributionLandsPopupSettings: { selectedThemeId: theme } },
  },
});

const user = decodeURIComponent(location.pathname.split('/').filter(Boolean)[0] ?? '');
const themeName = await fetch(`/themes/${theme}/theme.json`).then((r) => r.json()).then((t) => t.name as string);
document.getElementById('card-footer')!.textContent = `@${user} · ${themeName} · Contribution Lands`;

const calendar = await fetch('/__calendar').then((r) => r.text());
document.getElementById('calendar')!.innerHTML = calendar;
await document.fonts.ready;
await import('../src/content/content');
