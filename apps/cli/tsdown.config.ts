import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  outDir: 'dist',
  clean: true,
  deps: {
    alwaysBundle: ['@cartesia-download/core'],
  },
  banner: {
    js: '#!/usr/bin/env node',
  },
});
