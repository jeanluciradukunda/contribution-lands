export interface PopupSettings {
  selectedThemeId: string | null;
  glassOpacity: number;
}

const STORAGE_KEY = 'contributionLandsPopupSettings';

export const DEFAULT_SETTINGS: PopupSettings = {
  selectedThemeId: null,
  glassOpacity: 50,
};

function clampOpacity(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_SETTINGS.glassOpacity;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeSettings(value: unknown): PopupSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_SETTINGS;
  }

  const candidate = value as Partial<PopupSettings>;

  return {
    selectedThemeId:
      typeof candidate.selectedThemeId === 'string' ? candidate.selectedThemeId : DEFAULT_SETTINGS.selectedThemeId,
    glassOpacity: clampOpacity(candidate.glassOpacity),
  };
}

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.sync;
}

export async function loadPopupSettings(): Promise<PopupSettings> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    return normalizeSettings(result[STORAGE_KEY]);
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function savePopupSettings(settings: PopupSettings): Promise<void> {
  const normalized = normalizeSettings(settings);

  if (hasChromeStorage()) {
    await chrome.storage.sync.set({
      [STORAGE_KEY]: normalized,
    });
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}
