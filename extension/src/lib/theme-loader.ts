/** Shared packaged artwork loading for the profile land and toolbar popup. */
import { PARK_LANDMARKS } from '../content/parks';
import type { ParkSprites, Sprite, SpriteSet, ThemeConfig } from '../content/renderer';

const POPUP_KEY = 'contributionLandsPopupSettings';

export interface LoadedTheme {
  config: ThemeConfig;
  sprites: SpriteSet;
  todayStages: Array<ImageBitmap | null>;
  park: ParkSprites | null;
}
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

async function loadParkSprites(themeId: string, config: ThemeConfig): Promise<ParkSprites | null> {
  const names = config.central_park_sprites;
  if (!names) return null;
  const load = async (name: string | undefined) => (name ? loadBitmap(`themes/${themeId}/sprites/${name}`) : null);
  const [canopy, lawn, water, trees, landmarks] = await Promise.all([
    load(names.textures.canopy),
    load(names.textures.lawn),
    load(names.textures.water),
    Promise.all(names.trees.map(load)),
    Promise.all(PARK_LANDMARKS.map(async (role) => [role, await load(names.landmarks?.[role])] as const)),
  ]);
  if (!canopy || !lawn || !water) return null;
  return {
    textures: { canopy, lawn, water },
    trees: trees.filter((b): b is ImageBitmap => b !== null),
    landmarks: Object.fromEntries(landmarks.filter(([, b]) => b !== null)),
  };
}

export async function loadTheme(options: { themeId?: string | null; centralPark?: boolean } = {}): Promise<LoadedTheme> {
  let themeId = options.themeId || 'city-nyc';
  try {
    const result: Record<string, unknown> = options.themeId === undefined ? await chrome.storage.sync.get(POPUP_KEY) : {};
    const saved = result[POPUP_KEY] as { selectedThemeId?: string } | undefined;
    if (saved?.selectedThemeId) themeId = saved.selectedThemeId;
  } catch {
    // Use the default theme.
  }

  let config = FALLBACK_THEME;
  try {
    const res = await fetch(chrome.runtime.getURL(`themes/${themeId}/theme.json`));
    if (!res.ok) throw new Error('Theme unavailable');
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
  const park = options.centralPark ? await loadParkSprites(themeId, config) : null;
  return { config, sprites, todayStages, park };
}

