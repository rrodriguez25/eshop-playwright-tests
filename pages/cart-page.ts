import { test, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * The shopping bag at `/cart`. It requires login: a logged-out visit is redirected to the
 * Identity login page, and after login back here.
 *
 * The page streams its content: the heading renders first, then "Loading...", then either the
 * empty state or the bag's items with a summary. `verifyPageIsOpen()` waits only for the heading,
 * so assert on the state you expect (`emptyHeading`, `item(name)`) after it.
 *
 * Each item row has a quantity stepper and a Remove button; each submits the change right away.
 * Typing a quantity is committed on change or Enter by a script; values below 1 become 1.
 *
 * Source: eShop `src/WebApp/Components/Pages/Cart/CartPage.razor`, `CartPage.razor.css`,
 * `src/WebApp/wwwroot/js/cart-quantity.js`.
 */
export class CartPage extends BasePage {
  /** Text shown on the screen, used by locators and verifications. */
  static readonly TEXTS = {
    heading: 'Shopping bag',
    loading: 'Loading...',
    emptyHeading: 'Your shopping bag is empty',
    emptyMessage:
      'Browse the catalog and add the gear you love. Anything you add shows up here, ready to check out.',
    startShopping: 'Start shopping',
    decreaseQuantityPrefix: 'Decrease quantity of',
    quantityPrefix: 'Quantity of',
    increaseQuantityPrefix: 'Increase quantity of',
    removePrefix: 'Remove',
    removeSuffix: 'from your bag',
    summaryHeading: 'Your shopping bag',
    total: 'Total',
    checkOut: 'Check out',
    continueShopping: 'Continue shopping',
  } as const;

  readonly URL_PATH = '/cart';
  protected readonly readyIndicator: Locator;
  // Unverified: from CartPage.razor, renders only while the bag's items are still streaming in (basketItems is null).
  readonly loadingMessage: Locator;

  // Empty state
  readonly emptyHeading: Locator;
  readonly emptyMessage: Locator;
  /** Goes to the catalog at `/`. */
  readonly startShoppingLink: Locator;

  // Items
  // Unverified: from CartPage.razor, renders only when the bag has items. Every row, in the order added.
  readonly itemRows: Locator;

  // Summary
  // Unverified: from CartPage.razor, the summary renders only when the bag has items.
  readonly summary: Locator;
  // Unverified: from CartPage.razor, same condition as summary. The sum of all item quantities.
  readonly summaryQuantity: Locator;
  // Unverified: from CartPage.razor, same condition as summary. The bag's total price, such as "$1,234.50".
  readonly summaryTotal: Locator;
  // Unverified: from CartPage.razor, same condition as summary. Goes to `/checkout`.
  readonly checkOutLink: Locator;
  // Unverified: from CartPage.razor, same condition as summary. Goes to the catalog at `/`.
  readonly continueShoppingLink: Locator;

  constructor(page: Page) {
    super(page);
    // The heading is the header bar's hero title, outside the main landmark.
    this.readyIndicator = page.getByRole('heading', { level: 1, name: CartPage.TEXTS.heading, exact: true });
    const main = page.getByRole('main');
    this.loadingMessage = main.getByText(CartPage.TEXTS.loading, { exact: true });

    this.emptyHeading = main.getByRole('heading', { name: CartPage.TEXTS.emptyHeading });
    this.emptyMessage = main.getByText(CartPage.TEXTS.emptyMessage);
    this.startShoppingLink = main.getByRole('link', { name: CartPage.TEXTS.startShopping });

    // Item rows are plain divs with no role or accessible name; their class is the only hook.
    this.itemRows = main.locator('.cart-item');

    // The summary has no landmark or heading role; its class is the only hook.
    this.summary = main.locator('.cart-summary');
    // The quantity badge is a span with no role or label.
    this.summaryQuantity = this.summary.locator('.filter-badge');
    this.summaryTotal = this.summary.locator('.cart-summary-total').getByText(/^\$[\d,]+\.\d{2}$/);
    this.checkOutLink = this.summary.getByRole('link', { name: CartPage.TEXTS.checkOut });
    this.continueShoppingLink = this.summary.getByRole('link', { name: CartPage.TEXTS.continueShopping });
  }

  // Unverified: from CartPage.razor, renders only when the bag has this product.
  /**
   * One item's row, found by product name. The bag shows no brand, so two products with the same
   * name (two brands sell an "Apex Climbing Harness") can't be told apart here.
   */
  item(productName: string): Locator {
    return this.itemRows.filter({ has: this.page.getByText(productName, { exact: true }) });
  }

  // Unverified: from CartPage.razor, same condition as item(). The unit price, such as "$12.50".
  itemUnitPrice(productName: string): Locator {
    // The price is a paragraph with no label; its class is the only hook.
    return this.item(productName).locator('.price');
  }

  // Unverified: from CartPage.razor, same condition as item(). Unit price times quantity.
  itemTotal(productName: string): Locator {
    // The line total is a div with no role or label; its class is the only hook.
    return this.item(productName).locator('.catalog-item-total');
  }

  // Unverified: from CartPage.razor, same condition as item(). Disabled while the quantity is 1.
  decreaseQuantityButton(productName: string): Locator {
    return this.page
      .getByRole('main')
      .getByRole('button', { name: `${CartPage.TEXTS.decreaseQuantityPrefix} ${productName}`, exact: true });
  }

  // Unverified: from CartPage.razor, same condition as item(). A number input; see setQuantity().
  quantityInput(productName: string): Locator {
    return this.page
      .getByRole('main')
      .getByRole('spinbutton', { name: `${CartPage.TEXTS.quantityPrefix} ${productName}`, exact: true });
  }

  // Unverified: from CartPage.razor, same condition as item().
  increaseQuantityButton(productName: string): Locator {
    return this.page
      .getByRole('main')
      .getByRole('button', { name: `${CartPage.TEXTS.increaseQuantityPrefix} ${productName}`, exact: true });
  }

  // Unverified: from CartPage.razor, same condition as item(). Shows "Remove"; its accessible name names the product.
  removeButton(productName: string): Locator {
    return this.page.getByRole('main').getByRole('button', {
      name: `${CartPage.TEXTS.removePrefix} ${productName} ${CartPage.TEXTS.removeSuffix}`,
      exact: true,
    });
  }

  /**
   * Types a quantity and commits it with Enter, as cart-quantity.js expects. The basket updates
   * in place; wait for the outcome (`quantityInput`, `itemTotal`, `summaryQuantity`) afterwards.
   */
  // Unverified: from CartPage.razor and cart-quantity.js, needs an item in the bag.
  async setQuantity(productName: string, quantity: number): Promise<void> {
    await test.step(`Set quantity of ${productName} to ${quantity}`, async () => {
      const input = this.quantityInput(productName);
      await input.fill(String(quantity));
      await input.press('Enter');
    });
  }
}
