import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(process.cwd(), '../electron/dist/renderer'),
    emptyOutDir: true,
  },
});
