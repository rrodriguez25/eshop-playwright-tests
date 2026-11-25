import { test as base, expect } from '@playwright/test';
import { ApiClient } from '../api/api-client';
import { CatalogApiService } from '../api/catalog-api-service';
import { OrderingApiService } from '../api/ordering-api-service';
import { env } from '../config/env';
import { DbClient } from '../db/db-client';
import { createCatalogItem, type CreatedCatalogItem } from '../helpers/api/catalog';
import { HomePage } from '../pages/home-page';
import { ItemPage } from '../pages/item-page';
import { apiServiceFixture, pageFixture } from './factory';

type TestFixtures = {
  homePage: HomePage;
  itemPage: ItemPage;
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
  homePage: pageFixture(HomePage),
  itemPage: pageFixture(ItemPage),
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
  catalog: [apiServiceFixture(CatalogApiService, env.catalogApiUrl), { scope: 'worker' }],
  ordering: [apiServiceFixture(OrderingApiService, env.orderingApiUrl), { scope: 'worker' }],
  db: [async ({}, use) => {
    const client = new DbClient(env.db);
    await use(client);
    await client.close();
  }, { scope: 'worker' }],
});

export { expect };
