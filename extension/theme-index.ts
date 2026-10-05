import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

export const THEMES_DIR = resolve(__dirname, '..', 'themes');

/** Themes shipped in the store package. Override with CL_THEMES=city-nyc,city-paris for local experiments. */
export const RELEASE_THEMES = (process.env.CL_THEMES ?? 'city-nyc').split(',').map((t) => t.trim()).filter(Boolean);

export interface ThemeIndexEntry {
  definition: Record<string, unknown>;
  sprites: Record<number, string[]>;
}

export function buildThemeIndex(allow?: string[]): Record<string, ThemeIndexEntry> {
  const index: Record<string, ThemeIndexEntry> = {};
  for (const id of readdirSync(THEMES_DIR).sort()) {
    const themeJson = resolve(THEMES_DIR, id, 'theme.json');
    if (!existsSync(themeJson) || (allow && !allow.includes(id))) continue;
    const spritesDir = resolve(THEMES_DIR, id, 'sprites');
    const sprites: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    for (const file of existsSync(spritesDir) ? readdirSync(spritesDir).sort() : []) {
      const level = file.match(/^level-([0-4])-.*\.png$/)?.[1];
      if (level && !file.includes('-road-')) sprites[Number(level)].push(file);
    }
    index[id] = { definition: JSON.parse(readFileSync(themeJson, 'utf8')), sprites };
  }
  return index;
}
