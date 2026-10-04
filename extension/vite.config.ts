import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import { cpSync, existsSync, readdirSync, writeFileSync } from 'fs';
import manifest from './manifest.json';

function copyThemesPlugin() {
  return {
    name: 'copy-themes',
    writeBundle() {
      const src = resolve(__dirname, '..', 'themes');
      const dest = resolve(__dirname, 'dist', 'themes');
      if (existsSync(src)) {
        cpSync(src, dest, { recursive: true });
        // Generate sprite manifests to avoid 404 probing
        for (const theme of readdirSync(dest)) {
          const spritesDir = resolve(dest, theme, 'sprites');
          if (!existsSync(spritesDir)) continue;
          const files = readdirSync(spritesDir).filter(f => f.endsWith('.png'));
          const grouped: Record<string, string[]> = {};
          for (const file of files) {
            const match = file.match(/^level-(\d)-/);
            if (match) {
              const level = match[1];
              (grouped[level] ??= []).push(file);
            }
          }
          for (const level of Object.keys(grouped)) {
            grouped[level].sort();
          }
          writeFileSync(resolve(spritesDir, 'manifest.json'), JSON.stringify(grouped));
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    copyThemesPlugin(),
  ],
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
