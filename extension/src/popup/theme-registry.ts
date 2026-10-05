import { lightenHex } from '@/lib/color';

export type ThemeCategory = 'city' | 'forest';
export type ContributionLevel = 0 | 1 | 2 | 3 | 4;

interface ThemeDefinition {
  name: string;
  category: ThemeCategory;
  background: string;
  ground_colors: string[];
  ui_accent?: string;
  preview_sprites?: Partial<Record<`${ContributionLevel}`, string>>;
}

export interface ThemeRegistryItem {
  id: string;
  name: string;
  category: ThemeCategory;
  background: string;
  groundColors: string[];
  uiAccent: string;
  isReady: boolean;
  previewSprites: Record<ContributionLevel, string | null>;
}

declare const __THEME_INDEX__: Record<string, { definition: ThemeDefinition; sprites: Record<ContributionLevel, string[]> }>;
declare const __THEMES_BASE__: string;

const LEVELS: ContributionLevel[] = [0, 1, 2, 3, 4];

function spriteUrl(themeId: string, file: string): string {
  const path = `themes/${themeId}/sprites/${file}`;
  return typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL(path) : `${__THEMES_BASE__}${themeId}/sprites/${file}`;
}

export const themeRegistry: ThemeRegistryItem[] = Object.entries(__THEME_INDEX__)
  .map(([id, { definition, sprites }]) => {
    const previewSprites = {} as Record<ContributionLevel, string | null>;
    for (const level of LEVELS) {
      const configured = definition.preview_sprites?.[`${level}`];
      const file = configured && sprites[level].includes(configured) ? configured : sprites[level][0];
      previewSprites[level] = file ? spriteUrl(id, file) : null;
    }
    return {
      id,
      name: definition.name,
      category: definition.category,
      background: definition.background,
      groundColors: definition.ground_colors,
      uiAccent: definition.ui_accent ?? lightenHex(definition.ground_colors[0] ?? definition.background, 0.28),
      isReady: LEVELS.every((level) => sprites[level].length > 0),
      previewSprites,
    };
  })
  .sort((a, b) => Number(b.isReady) - Number(a.isReady) || a.name.localeCompare(b.name));

export const firstReadyTheme = themeRegistry.find((theme) => theme.isReady) ?? null;

export function getThemeById(themeId: string | null | undefined): ThemeRegistryItem | null {
  return themeId ? (themeRegistry.find((theme) => theme.id === themeId) ?? null) : null;
}
