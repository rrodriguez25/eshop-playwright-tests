import { expect, test, type Locator, type Page, type Response } from '@playwright/test';

export abstract class BasePage {
  /**
   * An element that only this page shows once it has rendered, such as its main heading.
   * `verifyPageIsOpen()` waits for it, so pick one that proves the page is usable.
   */
  protected abstract readonly readyIndicator: Locator;

  protected constructor(
    protected readonly page: Page,
    private readonly path: string,
  ) {}

  /** Opens the page by its path. */
  async goto(): Promise<Response | null> {
    return test.step(`Open ${this.constructor.name}`, () => this.page.goto(this.path));
  }

  /** Asserts the browser is on this page: the URL path matches and the ready indicator is visible. */
  async verifyPageIsOpen(): Promise<void> {
    await test.step(`Verify ${this.constructor.name} is open`, async () => {
      const expectedPath = new URL(this.path, 'http://placeholder').pathname;
      await expect(this.page, `URL path should be ${expectedPath}`)
        .toHaveURL(url => url.pathname === expectedPath);
      await expect(this.readyIndicator).toBeVisible();
    });
  }
}
