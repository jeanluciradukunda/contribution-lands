import { lightenHex } from '@/lib/color';

export type ThemeCategory = 'city' | 'forest';
export type ContributionLevel = 0 | 1 | 2 | 3 | 4;

type PreviewSpriteKey = `${ContributionLevel}`;

interface ThemeDefinition {
  name: string;
  category: ThemeCategory;
  author?: string;
  background: string;
  ground_colors: string[];
  ground_stroke?: string;
  ui_accent?: string;
  preview_sprites?: Partial<Record<PreviewSpriteKey, string>>;
}

interface SpriteFile {
  filename: string;
  sourcePath: string;
  url: string;
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
  spriteGroups: Record<ContributionLevel, string[]>;
}

const LEVELS: ContributionLevel[] = [0, 1, 2, 3, 4];

const themeModules = import.meta.glob<ThemeDefinition>(
  '../../../themes/*/theme.json',
  { eager: true, import: 'default' },
);

const spriteModules = import.meta.glob<string>(
  '../../../themes/*/sprites/*.png',
  { eager: true, import: 'default' },
);

function createSpriteGroups(): Record<ContributionLevel, SpriteFile[]> {
  return {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
  };
}

function filenameFromPath(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

function getThemeId(path: string): string {
  const match = path.match(/themes\/([^/]+)\//);
  return match?.[1] ?? path;
}

function getLevelFromFilename(filename: string): ContributionLevel | null {
  const match = filename.match(/^level-([0-4])-/);

  if (!match) {
    return null;
  }

  return Number(match[1]) as ContributionLevel;
}

function pickPreviewSprite(
  configuredFile: string | undefined,
  files: SpriteFile[],
): string | null {
  if (configuredFile) {
    const configuredMatch = files.find((file) =>
      file.filename === configuredFile || file.sourcePath.endsWith(configuredFile),
    );

    if (configuredMatch) {
      return configuredMatch.url;
    }
  }

  return files[0]?.url ?? null;
}

const spritesByTheme = Object.entries(spriteModules).reduce<Record<string, Record<ContributionLevel, SpriteFile[]>>>(
  (registry, [sourcePath, url]) => {
    const themeId = getThemeId(sourcePath);
    const filename = filenameFromPath(sourcePath);
    const level = getLevelFromFilename(filename);

    if (level === null) {
      return registry;
    }

    const themeSprites = registry[themeId] ?? createSpriteGroups();
    themeSprites[level].push({ filename, sourcePath, url });
    registry[themeId] = themeSprites;
    return registry;
  },
  {},
);

for (const themeSprites of Object.values(spritesByTheme)) {
  for (const level of LEVELS) {
    themeSprites[level].sort((left, right) => left.filename.localeCompare(right.filename));
  }
}

export const themeRegistry: ThemeRegistryItem[] = Object.entries(themeModules)
  .map(([sourcePath, definition]) => {
    const id = getThemeId(sourcePath);
    const spriteFiles = spritesByTheme[id] ?? createSpriteGroups();
    const previewSprites = LEVELS.reduce<Record<ContributionLevel, string | null>>(
      (result, level) => {
        result[level] = pickPreviewSprite(
          definition.preview_sprites?.[String(level) as PreviewSpriteKey],
          spriteFiles[level],
        );
        return result;
      },
      { 0: null, 1: null, 2: null, 3: null, 4: null },
    );
    const isReady = LEVELS.every((level) => spriteFiles[level].length > 0);

    return {
      id,
      name: definition.name,
      category: definition.category,
      background: definition.background,
      groundColors: definition.ground_colors,
      uiAccent: definition.ui_accent ?? lightenHex(definition.ground_colors[0] ?? definition.background, 0.28),
      isReady,
      previewSprites,
      spriteGroups: LEVELS.reduce<Record<ContributionLevel, string[]>>(
        (result, level) => {
          result[level] = spriteFiles[level].map((file) => file.url);
          return result;
        },
        { 0: [], 1: [], 2: [], 3: [], 4: [] },
      ),
    };
  })
  .sort((left, right) => {
    if (left.isReady !== right.isReady) {
      return left.isReady ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });

export const firstReadyTheme = themeRegistry.find((theme) => theme.isReady) ?? null;

export function getThemeById(themeId: string | null | undefined): ThemeRegistryItem | null {
  if (!themeId) {
    return null;
  }

  return themeRegistry.find((theme) => theme.id === themeId) ?? null;
}
