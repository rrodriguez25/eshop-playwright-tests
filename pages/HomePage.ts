import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class HomePage extends BasePage {
  protected readonly readyIndicator: Locator;

  constructor(page: Page) {
    super(page, '/');
    this.readyIndicator = page.getByRole('heading', { name: 'Ready for a new adventure?' });
  }
}
