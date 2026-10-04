import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: __dirname,
  base: '/',
  resolve: { alias: { '@': resolve(__dirname, '../src') } },
  build: { outDir: resolve(__dirname, '../card-dist'), emptyOutDir: true, target: 'es2022' },
});
