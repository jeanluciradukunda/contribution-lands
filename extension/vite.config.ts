import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import manifest from './manifest.json';
import { RELEASE_THEMES, THEMES_DIR, buildThemeIndex } from './theme-index';

const themeIndex = buildThemeIndex(RELEASE_THEMES);

/** Copies only the release themes' theme.json and level sprites, plus a per-theme sprite manifest. */
function copyThemesPlugin() {
  return {
    name: 'copy-themes',
    writeBundle() {
      for (const [id, { sprites }] of Object.entries(themeIndex)) {
        const dest = resolve(__dirname, 'dist', 'themes', id);
        mkdirSync(resolve(dest, 'sprites'), { recursive: true });
        cpSync(resolve(THEMES_DIR, id, 'theme.json'), resolve(dest, 'theme.json'));
        const extras = ['special-today.png', ...[0, 1, 2, 3, 4].map((n) => `special-today-${n}.png`)];
        for (const file of [...Object.values(sprites).flat(), ...extras]) {
          const from = resolve(THEMES_DIR, id, 'sprites', file);
          if (existsSync(from)) cpSync(from, resolve(dest, 'sprites', file));
        }
        writeFileSync(resolve(dest, 'sprites', 'sprites.json'), JSON.stringify(sprites));
      }
      cpSync(resolve(__dirname, '..', 'THIRD_PARTY_NOTICES.md'), resolve(__dirname, 'dist', 'THIRD_PARTY_NOTICES.md'));
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    copyThemesPlugin(),
  ],
  define: {
    __THEME_INDEX__: JSON.stringify(themeIndex),
    __THEMES_BASE__: JSON.stringify('/themes/'),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    fs: {
      allow: [
        resolve(__dirname, '..'),
      ],
    },
  },
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
      },
    },
  },
});
