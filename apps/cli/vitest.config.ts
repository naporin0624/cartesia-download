import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    server: {
      deps: {
        inline: ['@cartesia-download/core'],
      },
    },
  },
});
