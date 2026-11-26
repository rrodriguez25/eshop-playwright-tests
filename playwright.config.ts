import { defineConfig, devices } from '@playwright/test';
import { env } from './config/env';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [['blob'], ['github']] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: env.baseUrl,
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'api',
      testDir: './tests/api',
    },
    {
      name: 'db',
      testDir: './tests/db',
    },
    {
      // Tests of the suite's own tooling, such as knownBug and its reporter. Needs no running eShop.
      name: 'suite',
      testDir: './tests/suite',
      testMatch: /.*\.suite\.spec\.ts/,
    },
    {
      // Checks run before the suite. No retries: each retry of a wrong password counts toward
      // Identity's lockout of a static user.
      name: 'preflight',
      testDir: './tests/preflight',
      testMatch: /.*\.preflight\.ts/,
      retries: 0,
    },
    {
      name: 'chromium',
      testDir: './tests/ui',
      dependencies: ['preflight'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
