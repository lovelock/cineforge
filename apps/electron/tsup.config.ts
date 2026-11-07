import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/main/index.ts' },
    outDir: 'dist/main',
    format: ['cjs'],
    platform: 'node',
    target: 'node20',
    external: ['electron'],
    sourcemap: true,
    clean: true,
  },
  {
    entry: { index: 'src/preload/index.ts' },
    outDir: 'dist/preload',
    format: ['cjs'],
    platform: 'node',
    target: 'node20',
    external: ['electron'],
    sourcemap: true,
    clean: true,
  },
]);
