export type ViewSetting = 'squares' | 'cubes' | 'both';

export interface PopupSettings {
  selectedThemeId: string | null;
}

export type Scale = 'absolute' | 'relative';

export interface DisplaySettings {
  viewSetting: ViewSetting;
  motion: boolean;
  showStats: boolean;
  scale: Scale;
}

const STORAGE_KEY = 'contributionLandsPopupSettings';

export const DEFAULT_SETTINGS: PopupSettings = { selectedThemeId: null };
export const DEFAULT_DISPLAY: DisplaySettings = { viewSetting: 'cubes', motion: true, showStats: true, scale: 'absolute' };

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.sync;
}

export async function loadPopupSettings(): Promise<PopupSettings> {
  const raw = hasChromeStorage()
    ? (await chrome.storage.sync.get(STORAGE_KEY))[STORAGE_KEY]
    : JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
  const id = (raw as Partial<PopupSettings> | null)?.selectedThemeId;
  return { selectedThemeId: typeof id === 'string' ? id : null };
}

export async function savePopupSettings(settings: PopupSettings): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export async function loadDisplaySettings(): Promise<DisplaySettings> {
  if (!hasChromeStorage()) return DEFAULT_DISPLAY;
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_DISPLAY));
  return { ...DEFAULT_DISPLAY, ...stored } as DisplaySettings;
}

export async function saveDisplaySetting<K extends keyof DisplaySettings>(key: K, value: DisplaySettings[K]) {
  if (hasChromeStorage()) await chrome.storage.local.set({ [key]: value });
}
