import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Slow metrics (deck stats on 100,000 cards) can take a while before they are fixed.
    testTimeout: 300_000,
    benchmark: { include: ['*.bench.ts'] },
  },
});
