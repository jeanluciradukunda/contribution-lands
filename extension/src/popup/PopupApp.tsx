import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import iconUrl from '../../icon.svg';
// color utils no longer used by popup
import {
  firstReadyTheme,
  getThemeById,
  themeRegistry,
  type ContributionLevel,
  type ThemeRegistryItem,
} from '@/popup/theme-registry';
import {
  DEFAULT_SETTINGS,
  loadPopupSettings,
  savePopupSettings,
} from '@/popup/storage';

/* Glass CSS variable interface removed */

const LEVELS: ContributionLevel[] = [0, 1, 2, 3, 4];

const SCENE_ITEMS: Array<{
  key: string;
  level: ContributionLevel;
  left: string;
  top: string;
  scale: number;
  delay: string;
}> = [
  { key: 'tile-a', level: 0, left: '8%', top: '64%', scale: 0.78, delay: '-3s' },
  { key: 'tile-b', level: 1, left: '22%', top: '55%', scale: 0.84, delay: '-7s' },
  { key: 'tile-c', level: 0, left: '36%', top: '60%', scale: 0.75, delay: '-4s' },
  { key: 'tile-d', level: 2, left: '41%', top: '44%', scale: 0.94, delay: '-9s' },
  { key: 'tile-e', level: 1, left: '57%', top: '50%', scale: 0.86, delay: '-11s' },
  { key: 'tile-f', level: 3, left: '60%', top: '30%', scale: 1.08, delay: '-5s' },
  { key: 'tile-g', level: 4, left: '78%', top: '16%', scale: 1.24, delay: '-13s' },
];

function resolveThemeId(themeId: string | null | undefined): string | null {
  const candidate = getThemeById(themeId);

  if (candidate?.isReady) {
    return candidate.id;
  }

  return firstReadyTheme?.id ?? candidate?.id ?? themeRegistry[0]?.id ?? null;
}

/* Glass variable generator removed — clean design uses CSS custom properties only */

function getOpacityLabel(value: number): string {
  if (value < 34) {
    return 'Liquid';
  }

  if (value < 68) {
    return 'Frosted';
  }

  return 'Opaque';
}

function HeroPreview({ theme }: { theme: ThemeRegistryItem | null }) {
  if (!theme) {
    return (
      <div className="hero-empty">
        <p>No theme metadata found.</p>
      </div>
    );
  }

  return (
    <div className="hero-scene" aria-hidden="true">
      <div className="hero-grid-shadow" />
      {SCENE_ITEMS.map((item) => {
        const spriteUrl = theme.previewSprites[item.level];
        const tileColor = theme.groundColors[item.level % theme.groundColors.length] ?? theme.background;
        const tileStyle = {
          '--scene-left': item.left,
          '--scene-top': item.top,
          '--scene-scale': item.scale,
          '--scene-delay': item.delay,
          '--tile-color': tileColor,
          '--tile-stroke': theme.uiAccent,
        } as CSSProperties;

        return (
          <div className="scene-item" key={item.key} style={tileStyle}>
            <div className="scene-diamond" />
            {spriteUrl ? (
              <img className="scene-sprite" src={spriteUrl} alt="" />
            ) : (
              <div className="scene-placeholder">
                <span>{`L${item.level}`}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PopupApp() {
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(resolveThemeId(DEFAULT_SETTINGS.selectedThemeId));
  const [glassOpacity, setGlassOpacity] = useState(DEFAULT_SETTINGS.glassOpacity);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);

  const selectedTheme = useMemo(
    () => getThemeById(selectedThemeId) ?? firstReadyTheme ?? themeRegistry[0] ?? null,
    [selectedThemeId],
  );

  // Glass variables removed — clean design uses CSS custom properties only
  void glassOpacity; // keep for settings persistence

  useEffect(() => {
    let isActive = true;

    void (async () => {
      const savedSettings = await loadPopupSettings();

      if (!isActive) {
        return;
      }

      setSelectedThemeId(resolveThemeId(savedSettings.selectedThemeId));
      setGlassOpacity(savedSettings.glassOpacity);
      setHydrated(true);
    })();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const timer = setTimeout(() => {
      void savePopupSettings({
        selectedThemeId: resolveThemeId(selectedThemeId),
        glassOpacity,
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [glassOpacity, hydrated, selectedThemeId]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        settingsOpen &&
        !settingsRef.current?.contains(target) &&
        !settingsButtonRef.current?.contains(target)
      ) {
        setSettingsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSettingsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [settingsOpen]);

  const opacityLabel = getOpacityLabel(glassOpacity);

  return (
    <div className="popup-root">
      <div className="ambient-stage" aria-hidden="true">
        <HeroPreview theme={selectedTheme} />
      </div>

      <div className="glass-shell">
        <header className="app-header">
          <div className="brand-lockup">
            <div className="brand-mark">
              <img src={iconUrl} alt="" />
            </div>
            <div>
              <p className="section-kicker">Liquid Glass Selector</p>
              <h1>Contribution Lands</h1>
              <p className="theme-caption">
                {selectedTheme ? selectedTheme.name : 'Theme preview'} · {opacityLabel}
              </p>
            </div>
          </div>

          <button
            className="icon-button"
            ref={settingsButtonRef}
            type="button"
            onClick={() => setSettingsOpen((current) => !current)}
            aria-expanded={settingsOpen}
            aria-label="Open popup settings"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10.2 2.9a1 1 0 0 1 1.6 0l.6.9a2 2 0 0 0 2.2.8l1-.3a1 1 0 0 1 1.2.7l.3 1a2 2 0 0 0 1.7 1.6l1 .1a1 1 0 0 1 .9 1.3l-.3 1a2 2 0 0 0 .5 2.2l.8.7a1 1 0 0 1 0 1.6l-.8.7a2 2 0 0 0-.5 2.2l.3 1a1 1 0 0 1-.9 1.3l-1 .1a2 2 0 0 0-1.7 1.6l-.3 1a1 1 0 0 1-1.2.7l-1-.3a2 2 0 0 0-2.2.8l-.6.9a1 1 0 0 1-1.6 0l-.6-.9a2 2 0 0 0-2.2-.8l-1 .3a1 1 0 0 1-1.2-.7l-.3-1a2 2 0 0 0-1.7-1.6l-1-.1a1 1 0 0 1-.9-1.3l.3-1a2 2 0 0 0-.5-2.2l-.8-.7a1 1 0 0 1 0-1.6l.8-.7a2 2 0 0 0 .5-2.2l-.3-1a1 1 0 0 1 .9-1.3l1-.1a2 2 0 0 0 1.7-1.6l.3-1a1 1 0 0 1 1.2-.7l1 .3a2 2 0 0 0 2.2-.8l.6-.9Z" />
              <circle cx="12" cy="12" r="3.1" />
            </svg>
          </button>
        </header>

        <section className="panel-section">
          <div className="section-heading">
            <p className="section-kicker">Theme Selector</p>
            <span className="section-meta">{themeRegistry.length} available</span>
          </div>
          <div className="theme-rail" role="tablist" aria-label="Contribution lands themes">
            {themeRegistry.map((theme) => {
              const isSelected = theme.id === selectedTheme?.id;

              return (
                <button
                  key={theme.id}
                  className={`theme-pill${isSelected ? ' is-active' : ''}${theme.isReady ? '' : ' is-locked'}`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => {
                    if (theme.isReady) {
                      setSelectedThemeId(theme.id);
                    }
                  }}
                >
                  <span className="theme-pill-topline">
                    <span className="theme-pill-dot" style={{ backgroundColor: theme.uiAccent }} />
                    {theme.category}
                  </span>
                  <span className="theme-pill-name">{theme.name}</span>
                  <span className="theme-pill-status">{theme.isReady ? 'Live' : 'Coming soon'}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel-section">
          <div className="section-heading">
            <p className="section-kicker">Level Preview</p>
            <span className="section-meta">L0 → L4</span>
          </div>
          <div className="sprite-strip" aria-label="Theme level sprites">
            {LEVELS.map((level) => {
              const spriteUrl = selectedTheme?.previewSprites[level] ?? null;

              return (
                <div className="sprite-slot" key={level}>
                  <div className="sprite-frame">
                    {spriteUrl ? (
                      <img src={spriteUrl} alt={`${selectedTheme?.name ?? 'Theme'} level ${level}`} />
                    ) : (
                      <div className="sprite-fallback">{`L${level}`}</div>
                    )}
                  </div>
                  <span>{`L${level}`}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="hero-panel">
          <div className="hero-panel-copy">
            <p className="section-kicker">Hero Preview</p>
            <div className="hero-panel-title-row">
              <h2>{selectedTheme?.name ?? 'No ready theme'}</h2>
              {selectedTheme?.isReady ? (
                <span className="hero-badge">Ready</span>
              ) : (
                <span className="hero-badge is-muted">Locked</span>
              )}
            </div>
            <p>
              Canonical sprite progression rendered as a compact scene. Locked themes stay visible until their full sprite
              packs land.
            </p>
          </div>
          <HeroPreview theme={selectedTheme} />
        </section>
      </div>

      <div
        className={`settings-popover${settingsOpen ? ' is-open' : ''}`}
        ref={settingsRef}
        role="dialog"
        aria-label="Popup settings"
      >
        <div className="settings-header">
          <div>
            <p className="section-kicker">Settings</p>
            <h2>Material Tone</h2>
          </div>
          <span className="settings-value">{opacityLabel}</span>
        </div>

        <div className="slider-block">
          <label htmlFor="glassOpacity">Glass opacity</label>
          <input
            id="glassOpacity"
            type="range"
            min="0"
            max="100"
            value={glassOpacity}
            onChange={(event) => setGlassOpacity(Number(event.target.value))}
          />
          <div className="slider-stops" aria-hidden="true">
            <span>Liquid</span>
            <span>Frosted</span>
            <span>Opaque</span>
          </div>
        </div>
      </div>
    </div>
  );
}
