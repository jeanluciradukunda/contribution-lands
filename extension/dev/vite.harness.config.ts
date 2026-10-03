import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, '..'),
  plugins: [react()],
  define: { __THEMES_ROOT__: JSON.stringify(`${resolve(__dirname, '../../themes')}/`) },
  resolve: { alias: { '@': resolve(__dirname, '../src') } },
  server: { port: 5199, strictPort: true, fs: { allow: [resolve(__dirname, '../..')] } },
});
