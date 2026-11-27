import { defineConfig, devices } from '@playwright/test';
import { env } from './config/env';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [['blob'], ['github'], ['./test-tooling/bugs/reporter.ts']]
    : [['list'], ['html', { open: 'never' }], ['./test-tooling/bugs/reporter.ts']],
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
