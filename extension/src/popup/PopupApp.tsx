import { type CSSProperties, useEffect, useState } from 'react';
import iconUrl from '../../icon.svg';
import { firstReadyTheme, getThemeById, themeRegistry, type ThemeRegistryItem } from '@/popup/theme-registry';
import {
  DEFAULT_DISPLAY,
  loadDisplaySettings,
  loadPopupSettings,
  saveDisplaySetting,
  savePopupSettings,
  type DisplaySettings,
  type ViewSetting,
} from '@/popup/storage';

const VIEWS: Array<{ value: ViewSetting; label: string }> = [
  { value: 'squares', label: '2D' },
  { value: 'cubes', label: 'Lands' },
  { value: 'both', label: 'Both' },
];

const CATEGORY_ORDER: Record<ThemeRegistryItem['category'], number> = { city: 0, forest: 1 };
const byCategory = (a: ThemeRegistryItem, b: ThemeRegistryItem) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
const readyThemes = themeRegistry.filter((t) => t.isReady).sort(byCategory);
const upcomingThemes = themeRegistry.filter((t) => !t.isReady);

const DEFAULT_THEME_ID = 'city-nyc';

function resolveThemeId(themeId: string | null): string | null {
  for (const id of [themeId, DEFAULT_THEME_ID]) {
    const candidate = getThemeById(id);
    if (candidate?.isReady) return candidate.id;
  }
  return firstReadyTheme?.id ?? null;
}

function Skyline({ theme }: { theme: ThemeRegistryItem }) {
  const sprites = [theme.previewSprites[1], theme.previewSprites[3], theme.previewSprites[4], theme.previewSprites[2]];
  const style = {
    '--sky': theme.background,
    '--ground': theme.groundColors[0] ?? theme.background,
  } as CSSProperties;

  return (
    <div className="skyline" style={style} aria-hidden="true">
      <div className="skyline-ground" />
      <div className="skyline-row">
        {sprites.map((src, i) => (src ? <img key={i} src={src} alt="" /> : <span key={i} className="skyline-empty" />))}
      </div>
    </div>
  );
}

function ThemeCard({ theme, selected, onSelect }: { theme: ThemeRegistryItem; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={`theme-card${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <Skyline theme={theme} />
      <span className="theme-card-name">{theme.name}</span>
    </button>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>
        <span className="toggle-label">{label}</span>
        <span className="toggle-hint">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export default function PopupApp() {
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(resolveThemeId(null));
  const [display, setDisplay] = useState<DisplaySettings>(DEFAULT_DISPLAY);

  useEffect(() => {
    void loadPopupSettings().then((s) => setSelectedThemeId(resolveThemeId(s.selectedThemeId)));
    void loadDisplaySettings().then(setDisplay);
  }, []);

  const selectTheme = (id: string) => {
    setSelectedThemeId(id);
    void savePopupSettings({ selectedThemeId: id });
  };

  const updateDisplay = <K extends keyof DisplaySettings>(key: K, value: DisplaySettings[K]) => {
    setDisplay((current) => ({ ...current, [key]: value }));
    void saveDisplaySetting(key, value);
  };

  return (
    <main className="popup">
      <header className="popup-header">
        <img src={iconUrl} alt="" className="popup-icon" />
        <div>
          <h1>Contribution Lands</h1>
          <p>Your contribution graph, built as a world.</p>
        </div>
      </header>

      <section className="section">
        <h2>World</h2>
        <div className="theme-grid">
          {readyThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              selected={theme.id === selectedThemeId}
              onSelect={() => selectTheme(theme.id)}
            />
          ))}
        </div>
        {upcomingThemes.length > 0 && (
          <p className="upcoming">Coming soon: {upcomingThemes.map((t) => t.name).join(', ')}</p>
        )}
      </section>

      <section className="section">
        <h2>Display</h2>
        <div className="segmented" role="radiogroup" aria-label="Graph view">
          {VIEWS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={display.viewSetting === value}
              className={display.viewSetting === value ? 'is-active' : ''}
              onClick={() => updateDisplay('viewSetting', value)}
            >
              {label}
            </button>
          ))}
        </div>
        <Toggle
          label="Stats"
          hint="Totals and streaks over the land"
          checked={display.showStats}
          onChange={(v) => updateDisplay('showStats', v)}
        />
        <Toggle
          label="Motion"
          hint="Taxis in the streets and a train on your streak"
          checked={display.motion}
          onChange={(v) => updateDisplay('motion', v)}
        />
      </section>

      <footer className="popup-footer">Changes apply instantly to open GitHub profiles.</footer>
    </main>
  );
}
