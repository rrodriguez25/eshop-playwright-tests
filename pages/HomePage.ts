import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class HomePage extends BasePage {
  /** Text shown on the screen, used by locators and verifications. */
  static readonly TEXTS = {
    heading: 'Ready for a new adventure?',
  } as const;

  readonly URL_PATH = '/';
  protected readonly readyIndicator: Locator;

  constructor(page: Page) {
    super(page);
    this.readyIndicator = page.getByRole('heading', { name: HomePage.TEXTS.heading });
  }
}
