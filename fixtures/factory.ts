import type { APIRequestContext, Page, PlaywrightWorkerArgs } from '@playwright/test';

type PageObjectClass<T> = new (page: Page) => T;
type ApiServiceClass<T> = new (request: APIRequestContext, baseUrl: string) => T;

/**
 * Fixture that gives each test a new instance of a page object.
 *
 * ```ts
 * homePage: pageFixture(HomePage),
 * ```
 */
export function pageFixture<T>(PageObject: PageObjectClass<T>) {
  return async ({ page }: { page: Page }, use: (pageObject: T) => Promise<void>): Promise<void> => {
    await use(new PageObject(page));
  };
}

/**
 * Fixture that gives each worker an API service with its own request context, disposed when the
 * worker finishes. Register it with `{ scope: 'worker' }`.
 *
 * ```ts
 * catalog: [apiServiceFixture(CatalogApiService, env.catalogApiUrl), { scope: 'worker' }],
 * ```
 */
export function apiServiceFixture<T>(Service: ApiServiceClass<T>, baseUrl: string) {
  return async ({ playwright }: PlaywrightWorkerArgs, use: (service: T) => Promise<void>): Promise<void> => {
    const request = await playwright.request.newContext({ baseURL: baseUrl, ignoreHTTPSErrors: true });
    await use(new Service(request, baseUrl));
    await request.dispose();
  };
}
