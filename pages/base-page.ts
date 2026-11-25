import { expect, test, type Locator, type Page, type Response } from '@playwright/test';

export abstract class BasePage {
  /**
   * This screen's path, relative to the base URL. A page that takes route parameters assigns it
   * in its constructor, such as `/item/${itemId}`.
   */
  abstract readonly URL_PATH: string;

  /**
   * An element that only this page shows once it has rendered, such as its main heading.
   * `verifyPageIsOpen()` waits for it, so pick one that proves the page is usable.
   */
  protected abstract readonly readyIndicator: Locator;

  protected constructor(protected readonly page: Page) {}

  /** Opens the page at `URL_PATH`. */
  async goto(): Promise<Response | null> {
    return test.step(`Open ${this.constructor.name}`, () => this.page.goto(this.URL_PATH));
  }

  /** Asserts the browser is on this page: the URL path matches `URL_PATH` and the ready indicator is visible. */
  async verifyPageIsOpen(): Promise<void> {
    await test.step(`Verify ${this.constructor.name} is open`, async () => {
      const expectedPath = new URL(this.URL_PATH, 'http://placeholder').pathname;
      await expect(this.page, `URL path should be ${expectedPath}`)
        .toHaveURL(url => url.pathname === expectedPath);
      await expect(this.readyIndicator).toBeVisible();
    });
  }
}
