import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * The top bar every web app screen shows: logo, primary navigation, account and shopping bag.
 * Reached through any page object as `header`. The hero heading under it belongs to each page.
 * Source: eShop `src/WebApp/Components/Layout/HeaderBar.razor`, `UserMenu.razor`, `CartMenu.razor`.
 */
export class HeaderBar {
  /** Text shown on the screen, used by locators and verifications. */
  static readonly TEXTS = {
    home: 'AdventureWorks home',
    primaryNavigation: 'Primary',
    shopAll: 'Shop all',
    signIn: 'Sign in',
    account: 'Account',
    myOrders: 'My orders',
    logOut: 'Log out',
    shoppingBag: 'Shopping bag',
  } as const;

  readonly root: Locator;
  readonly homeLink: Locator;
  readonly primaryNavigation: Locator;
  readonly shopAllLink: Locator;
  /** Rendered only when logged out. */
  readonly signInLink: Locator;
  /** Rendered only when logged in. Hovering or focusing it (a click does) reveals the account menu. */
  readonly accountButton: Locator;
  /** The account menu's items; visible only while the menu is revealed. */
  readonly myOrdersLink: Locator;
  readonly logOutButton: Locator;
  /**
   * "Shopping bag" when the bag is empty, "Shopping bag, 1 item" or "Shopping bag, 3 items"
   * otherwise; the count badge shows 99+ above 99.
   */
  readonly shoppingBagLink: Locator;

  constructor(page: Page) {
    this.root = page.getByRole('banner');
    this.homeLink = this.root.getByRole('link', { name: HeaderBar.TEXTS.home });
    this.primaryNavigation = this.root.getByRole('navigation', { name: HeaderBar.TEXTS.primaryNavigation });
    this.shopAllLink = this.primaryNavigation.getByRole('link', { name: HeaderBar.TEXTS.shopAll });
    this.signInLink = this.root.getByRole('link', { name: HeaderBar.TEXTS.signIn });
    this.accountButton = this.root.getByRole('button', { name: HeaderBar.TEXTS.account });
    this.myOrdersLink = this.root.getByRole('link', { name: HeaderBar.TEXTS.myOrders });
    this.logOutButton = this.root.getByRole('button', { name: HeaderBar.TEXTS.logOut });
    this.shoppingBagLink = this.root.getByRole('link', { name: new RegExp(`^${HeaderBar.TEXTS.shoppingBag}`) });
  }

  /** The signed-in user's name at the top of the account menu. It has no role or label, so it is found by the expected name. */
  userName(name: string): Locator {
    return this.root.getByText(name, { exact: true });
  }

  /** Opens the account menu and checks it names the logged-in user, by username. */
  async verifyLoggedInAs(username: string): Promise<void> {
    await test.step(`Verify logged in as ${username}`, async () => {
      await this.accountButton.hover();
      await expect(this.userName(username), `Account menu should name ${username}`).toBeVisible();
    });
  }
}
