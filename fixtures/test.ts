import { test as base, expect } from '@playwright/test';
import { ApiClient } from '../api/api-client';
import { CatalogApiService } from '../api/catalog-api-service';
import { OrderingApiService } from '../api/ordering-api-service';
import { env } from '../config/env';
import { DbClient } from '../db/db-client';
import { createCatalogItem, type CreatedCatalogItem } from '../helpers/api/catalog';
import { HomePage } from '../pages/home-page';

type TestFixtures = {
  homePage: HomePage;
  api: ApiClient;
  /** A uniquely named catalog item created for this test and deleted after it. */
  catalogItem: CreatedCatalogItem;
};

type WorkerFixtures = {
  catalog: CatalogApiService;
  ordering: OrderingApiService;
  db: DbClient;
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
  catalogItem: async ({ catalog }, use) => {
    const item = await createCatalogItem(catalog);
    await use(item);
    await catalog.deleteItem(item.id);
  },
  catalog: [async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({
      baseURL: env.catalogApiUrl,
      ignoreHTTPSErrors: true,
    });
    await use(new CatalogApiService(ctx, env.catalogApiUrl));
    await ctx.dispose();
  }, { scope: 'worker' }],
  ordering: [async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({
      baseURL: env.orderingApiUrl,
      ignoreHTTPSErrors: true,
    });
    await use(new OrderingApiService(ctx, env.orderingApiUrl));
    await ctx.dispose();
  }, { scope: 'worker' }],
  db: [async ({}, use) => {
    const client = new DbClient(env.db);
    await use(client);
    await client.close();
  }, { scope: 'worker' }],
});

export { expect };
