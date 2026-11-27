import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * A product's page at `/item/{itemId}`. Open it with `goto({ itemId })`, or through an action
 * that lands on it, such as `HomePage.openProduct()`.
 * Source: eShop `src/WebApp/Components/Pages/Item/ItemPage.razor`, `src/WebApp/wwwroot/js/image-zoom.js`.
 */
export class ItemPage extends BasePage<{ itemId: number }> {
  /** Text shown on the screen, used by locators and verifications. */
  static readonly TEXTS = {
    backToCatalog: 'Back to catalog',
    zoomImagePrefix: 'Zoom image of',
    enlargedImagePrefix: 'Enlarged image of',
    closeImage: 'Close image',
    addToBag: 'Add to shopping bag',
    logInToPurchase: 'Log in to purchase',
    inBag: 'in your',
    shoppingBag: 'shopping bag',
    notFoundHeading: 'Not found',
    notFoundMessage: "Sorry, we couldn't find any such product.",
  } as const;

  readonly URL_PATH = '/item/:itemId';
  protected readonly readyIndicator: Locator;
  /** The page heading, which is the product's name. */
  readonly productName: Locator;
  readonly description: Locator;
  /** The brand under "Brand" in the details list. */
  readonly brand: Locator;
  readonly price: Locator;
  /** Goes back to the catalog with the filters and page the shopper came from, or to `/` after a direct visit. */
  readonly backToCatalogLink: Locator;
  /** The product image; clicking it opens `imageDialog`. */
  readonly zoomImageButton: Locator;
  readonly imageDialog: Locator;
  readonly closeImageButton: Locator;
  /** Rendered only when logged in. */
  readonly addToBagButton: Locator;
  /** Rendered only when logged out; takes the shopper to the login page. */
  readonly logInToPurchaseButton: Locator;
  /** "1 in your shopping bag". Rendered only when logged in and this item is already in the bag. */
  readonly inBagNotice: Locator;
  // Unverified: from ItemPage.razor, inside inBagNotice; renders under the same condition.
  readonly inBagShoppingBagLink: Locator;
  // Unverified: from ItemPage.razor, renders when the item id doesn't exist. Live, eShop answers 404 with an empty body, so this never renders.
  readonly notFoundHeading: Locator;
  // Unverified: from ItemPage.razor, same condition as notFoundHeading.
  readonly notFoundMessage: Locator;

  constructor(page: Page) {
    super(page);
    const main = page.getByRole('main');
    this.zoomImageButton = main.getByRole('button', {
      name: new RegExp(`^${ItemPage.TEXTS.zoomImagePrefix} `),
    });
    this.readyIndicator = this.zoomImageButton;
    this.productName = page.getByRole('heading', { level: 1 });
    // The description is a plain paragraph with no label; its class is the only hook.
    this.description = main.locator('.item-desc');
    this.brand = main.getByRole('definition');
    this.price = main.getByText(/^\$[\d,]+\.\d{2}$/);
    this.backToCatalogLink = main.getByRole('link', { name: ItemPage.TEXTS.backToCatalog });
    this.imageDialog = page.getByRole('dialog', {
      name: new RegExp(`^${ItemPage.TEXTS.enlargedImagePrefix} `),
    });
    this.closeImageButton = this.imageDialog.getByRole('button', { name: ItemPage.TEXTS.closeImage });
    this.addToBagButton = main.getByRole('button', { name: ItemPage.TEXTS.addToBag });
    this.logInToPurchaseButton = main.getByRole('button', { name: ItemPage.TEXTS.logInToPurchase });
    this.inBagNotice = main.getByRole('paragraph').filter({ hasText: ItemPage.TEXTS.inBag });
    this.inBagShoppingBagLink = this.inBagNotice.getByRole('link', { name: ItemPage.TEXTS.shoppingBag });
    this.notFoundHeading = page.getByRole('heading', { name: ItemPage.TEXTS.notFoundHeading });
    this.notFoundMessage = main.getByText(ItemPage.TEXTS.notFoundMessage);
  }
}
