import { expect, test, type Locator, type Page, type Response } from '@playwright/test';
import { HeaderBar } from './components/header-bar';

/** Values for the `:name` placeholders in a page's `URL_PATH`. */
export type RouteParams = Record<string, string | number>;

/** `goto()` takes the route parameters when the page has them, and nothing otherwise. */
type GotoArgs<TParams> = TParams extends RouteParams ? [params: TParams] : [];

/** `verifyPageIsOpen()` takes the route parameters optionally when the page has them. */
type VerifyArgs<TParams> = TParams extends RouteParams ? [params?: TParams] : [];

/**
 * Base for every page object. A page with route parameters declares their types here:
 * `class ItemPage extends BasePage<{ itemId: number }>` with `URL_PATH = '/item/:itemId'`.
 */
export abstract class BasePage<TParams extends RouteParams | void = void> {
  /**
   * This screen's path, relative to the base URL. Route parameters are `:name` placeholders,
   * such as `/item/:itemId`.
   */
  abstract readonly URL_PATH: string;

  /**
   * An element that only this page shows once it has rendered, such as its main heading.
   * `verifyPageIsOpen()` waits for it, so pick one that proves the page is usable.
   */
  protected abstract readonly readyIndicator: Locator;

  /** The top bar every web app screen shows. */
  readonly header: HeaderBar;

  protected constructor(protected readonly page: Page) {
    this.header = new HeaderBar(page);
  }

  /** Opens the page at `URL_PATH`, filled in with the route parameters when the page has them. */
  async goto(...args: GotoArgs<TParams>): Promise<Response | null> {
    const path = this.resolvePath(args[0]);
    return test.step(`Open ${this.constructor.name} at ${path}`, () => this.page.goto(path));
  }

  /**
   * Asserts the browser is on this page: the URL path matches `URL_PATH` and the ready indicator
   * is visible. With route parameters it checks the exact path; without them, any value.
   */
  async verifyPageIsOpen(...args: VerifyArgs<TParams>): Promise<void> {
    const params = args[0];
    const expected = params === undefined ? this.pathPattern() : this.resolvePath(params);
    const label = typeof expected === 'string' ? expected : this.URL_PATH;
    await test.step(`Verify ${this.constructor.name} is open at ${label}`, async () => {
      await expect(this.page, `URL path should match ${label}`).toHaveURL(url =>
        typeof expected === 'string' ? url.pathname === expected : expected.test(url.pathname),
      );
      await expect(this.readyIndicator).toBeVisible();
    });
  }

  /** `URL_PATH` with each `:name` replaced by its value. Throws when a value is missing. */
  private resolvePath(params: RouteParams | undefined): string {
    const template = new URL(this.URL_PATH, 'http://placeholder').pathname;
    return template.replace(/:(\w+)/g, (_, name: string) => {
      const value = params?.[name];
      if (value === undefined) {
        throw new Error(`${this.constructor.name}: missing route parameter "${name}" for ${this.URL_PATH}`);
      }
      return encodeURIComponent(String(value));
    });
  }

  /** `URL_PATH` as a pattern where each `:name` matches any single path segment. */
  private pathPattern(): RegExp {
    const template = new URL(this.URL_PATH, 'http://placeholder').pathname;
    const source = template
      .split(/(:\w+)/)
      .map(part => (part.startsWith(':') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('');
    return new RegExp(`^${source}$`);
  }
}
