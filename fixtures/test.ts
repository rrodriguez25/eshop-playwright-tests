import { test as base, expect } from '@playwright/test';
import { ApiClient } from '../api/ApiClient';
import { CatalogApiService } from '../api/CatalogApiService';
import { env } from '../config/env';
import { HomePage } from '../pages/HomePage';

type TestFixtures = {
  homePage: HomePage;
  api: ApiClient;
};

type WorkerFixtures = {
  catalog: CatalogApiService;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
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
  catalog: [async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({
      baseURL: env.catalogApiUrl,
      ignoreHTTPSErrors: true,
    });
    await use(new CatalogApiService(ctx, env.catalogApiUrl));
    await ctx.dispose();
  }, { scope: 'worker' }],
});

export { expect };
