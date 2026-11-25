import { test as base, expect } from '@playwright/test';
import { ApiClient } from '../api/api-client';
import { CatalogApiService } from '../api/catalog-api-service';
import { OrderingApiService } from '../api/ordering-api-service';
import { IdentityClient, type Credentials } from '../auth/identity-client';
import { SessionStore } from '../auth/session-store';
import { env } from '../config/env';
import { DbClient } from '../db/db-client';
import { createCatalogItem, type CreatedCatalogItem } from '../helpers/api/catalog';
import { staticUser, type StaticUserKey } from '../helpers/setup/static-users';
import { HomePage } from '../pages/home-page';
import { ItemPage } from '../pages/item-page';
import { apiServiceFixture, pageFixture } from './factory';

/** Where each worker saves its logged-in sessions. Ignored by git. */
const SESSION_DIR = '.auth';

type TestFixtures = {
  homePage: HomePage;
  itemPage: ItemPage;
  api: ApiClient;
  /** A uniquely named catalog item created for this test and deleted after it. */
  catalogItem: CreatedCatalogItem;
  /** The static user the browser is logged in as: `test.use({ user: 'alice' })`. None by default. */
  user: StaticUserKey | undefined;
};

type WorkerFixtures = {
  catalog: CatalogApiService;
  ordering: OrderingApiService;
  db: DbClient;
  /** Logs users in to eShop's web app over HTTP. */
  identity: IdentityClient;
  /** Username and the shared `USER_PASSWORD` of a static user from `data/users.json`. */
  staticCredentials: (key: StaticUserKey) => Credentials;
  /** This worker's logged-in sessions, one per user, made on first use. */
  sessions: SessionStore;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  homePage: pageFixture(HomePage),
  itemPage: pageFixture(ItemPage),
  user: [undefined, { option: true }],
  storageState: async ({ user, sessions, staticCredentials, storageState }, use) => {
    await use(user === undefined ? storageState : await sessions.sessionFile(user, staticCredentials(user)));
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
  catalog: [apiServiceFixture(CatalogApiService, env.catalogApiUrl), { scope: 'worker' }],
  ordering: [apiServiceFixture(OrderingApiService, env.orderingApiUrl), { scope: 'worker' }],
  db: [async ({}, use) => {
    const client = new DbClient(env.db);
    await use(client);
    await client.close();
  }, { scope: 'worker' }],
  identity: [async ({ playwright }, use) => {
    await use(new IdentityClient(playwright.request, env.baseUrl));
  }, { scope: 'worker' }],
  staticCredentials: [async ({}, use) => {
    await use(key => ({ username: staticUser(key).username, password: env.userPassword }));
  }, { scope: 'worker' }],
  sessions: [async ({ identity }, use, workerInfo) => {
    await use(new SessionStore(identity, SESSION_DIR, workerInfo.parallelIndex));
  }, { scope: 'worker' }],
});

export { expect };
