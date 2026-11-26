import { defineConfig } from '@playwright/test';

/** Runs the known-bug probes alone, for known-bug-outcomes.suite.spec.ts. */
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.probe\.ts/,
  workers: 1,
  retries: 0,
  reporter: [['json']],
});
