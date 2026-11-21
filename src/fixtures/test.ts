import { test as base, expect } from '@playwright/test';
import { ApiClient } from '../api/ApiClient';
import { env } from '../config/env';
import { HomePage } from '../pages/HomePage';

type Fixtures = {
  homePage: HomePage;
  api: ApiClient;
};

export const test = base.extend<Fixtures>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  api: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL: env.apiUrl,
      ignoreHTTPSErrors: true,
    });
    await use(new ApiClient(context));
    await context.dispose();
  },
});

export { expect };
