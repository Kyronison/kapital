import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts'],
    // Colyseus пишет в process.send, если он есть, и ломает IPC пула forks
    pool: 'threads',
  },
});
