import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
  server: {
    deps: {
      inline: ['@cartesia-download/core'],
    },
  },
});
