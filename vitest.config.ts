import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Procesa la hoja del widget para que `?raw` la lea entera (tokens-cards.test.ts).
    css: { include: [/aichat\.css/] },
  },
});
