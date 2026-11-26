import { test, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page';
import { ItemPage } from './item-page';

type SortOption = (typeof HomePage.TEXTS.sortOptions)[keyof typeof HomePage.TEXTS.sortOptions];

/**
 * The catalog at `/`: brand and type filters, product grid, sort control, pagination and the
 * no-results state.
 *
 * Filter options are links that toggle a `brand` or `type` query parameter. Selections within a
 * group combine as OR, across groups as AND. Each option shows how many products it would leave,
 * and an option that would leave none is disabled.
 *
 * Source: eShop `src/WebApp/Components/Pages/Catalog/Catalog.razor`,
 * `src/WebAppComponents/Catalog/CatalogSearch.razor`, `src/WebAppComponents/Catalog/CatalogListItem.razor`,
 * `src/WebApp/wwwroot/js/catalog-sort.js`.
 */
export class HomePage extends BasePage {
  /** Text shown on the screen, used by locators and verifications. */
  static readonly TEXTS = {
    heading: 'Ready for a new adventure?',
    subtitle: 'Start the season with the latest in clothing and equipment.',
    filters: 'Filters',
    brandHeading: 'Brand',
    typeHeading: 'Type',
    allOption: 'All',
    clearAllFilters: 'Clear all filters',
    loading: 'Loading products',
    sortLabel: 'Sort',
    sortOptions: {
      nameAscending: 'Name: A to Z',
      nameDescending: 'Name: Z to A',
      priceAscending: 'Price: Low to High',
      priceDescending: 'Price: High to Low',
    },
    pagination: 'Catalog pages',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    emptyHeading: 'No products match these filters',
    emptyMessage: 'Try removing a filter, or start over with the full collection.',
  } as const;

  readonly URL_PATH = '/';
  protected readonly readyIndicator: Locator;
  readonly subtitle: Locator;

  // Filters panel
  readonly filtersPanel: Locator;
  /** Toggles the panel open and closed. Its text is "Filters", then the active filter count when there is one. */
  readonly filtersSummary: Locator;
  /** Rendered only while at least one brand or type is selected. */
  readonly filtersClearAllLink: Locator;
  readonly brandFilterGroup: Locator;
  readonly typeFilterGroup: Locator;
  readonly allBrandsLink: Locator;
  readonly allTypesLink: Locator;

  // Results
  /** "101 products", "1 product". Rendered only when there are results. */
  readonly productCount: Locator;
  /** Its accessible name is "Sort" followed by the selected option, such as "Sort Name: A to Z". */
  readonly sortCombobox: Locator;
  readonly sortListbox: Locator;
  readonly productGrid: Locator;
  /** Every product card on the current page; each card is one link to its item page. */
  readonly productLinks: Locator;
  /** Rendered only when results span more than one page (9 products per page). */
  readonly pagination: Locator;
  /** Absent on the first page, where "Prev" is plain text. */
  readonly previousPageLink: Locator;
  /** Absent on the last page, where "Next" is plain text. */
  readonly nextPageLink: Locator;
  readonly currentPage: Locator;
  readonly emptyHeading: Locator;
  readonly emptyMessage: Locator;
  readonly emptyClearFiltersLink: Locator;
  // Unverified: from Catalog.razor, renders only while products are still streaming in (catalogResult is null).
  readonly loadingStatus: Locator;

  constructor(page: Page) {
    super(page);
    this.readyIndicator = page.getByRole('heading', { name: HomePage.TEXTS.heading });
    this.subtitle = page.getByText(HomePage.TEXTS.subtitle);

    this.filtersPanel = page.getByRole('complementary');
    // <summary> has no role in the accessibility tree.
    this.filtersSummary = this.filtersPanel.getByRole('group').locator('summary');
    this.filtersClearAllLink = this.filtersPanel.getByRole('link', { name: HomePage.TEXTS.clearAllFilters });
    // The groups have no role or accessible name, and both contain an "All" link; the class plus
    // the group's heading tells them apart.
    this.brandFilterGroup = this.filtersPanel
      .locator('.catalog-search-group')
      .filter({ has: page.getByRole('heading', { name: HomePage.TEXTS.brandHeading }) });
    this.typeFilterGroup = this.filtersPanel
      .locator('.catalog-search-group')
      .filter({ has: page.getByRole('heading', { name: HomePage.TEXTS.typeHeading }) });
    this.allBrandsLink = this.brandFilter(HomePage.TEXTS.allOption);
    this.allTypesLink = this.typeFilter(HomePage.TEXTS.allOption);

    this.productCount = page.getByText(/^\d+ products?$/);
    this.sortCombobox = page.getByRole('combobox', { name: new RegExp(`^${HomePage.TEXTS.sortLabel} `) });
    this.sortListbox = page.getByRole('listbox', { name: HomePage.TEXTS.sortLabel });
    // The grid has no role or accessible name; its class is the only hook.
    this.productGrid = page.locator('.catalog-items');
    this.productLinks = this.productGrid.getByRole('link');
    this.pagination = page.getByRole('navigation', { name: HomePage.TEXTS.pagination });
    this.previousPageLink = this.pagination.getByRole('link', { name: HomePage.TEXTS.previousPage });
    this.nextPageLink = this.pagination.getByRole('link', { name: HomePage.TEXTS.nextPage });
    // The current page number is a span with aria-current but no role, so the accessibility tree doesn't expose it.
    this.currentPage = this.pagination.locator('[aria-current="page"]');
    this.emptyHeading = page.getByRole('heading', { name: HomePage.TEXTS.emptyHeading });
    this.emptyMessage = page.getByText(HomePage.TEXTS.emptyMessage);
    // The filters panel has a link with the same name; the empty state has no role to scope by.
    this.emptyClearFiltersLink = page
      .locator('.catalog-empty')
      .getByRole('link', { name: HomePage.TEXTS.clearAllFilters });
    this.loadingStatus = page.getByRole('status', { name: HomePage.TEXTS.loading });
  }

  /** A brand filter option. Its accessible name is the brand followed by its product count ("Daybird 10"). */
  brandFilter(brand: string): Locator {
    return this.brandFilterGroup.getByRole('link', { name: filterOptionName(brand) });
  }

  /** A type filter option. Its accessible name is the type followed by its product count ("Bags 16"). */
  typeFilter(type: string): Locator {
    return this.typeFilterGroup.getByRole('link', { name: filterOptionName(type) });
  }

  /**
   * One product card. Product names are not unique (two brands sell an "Apex Climbing Harness"),
   * so pass the brand when the name alone is ambiguous.
   */
  productLink(name: string, brand?: string): Locator {
    const byName = this.productLinks.filter({ has: this.page.getByText(name, { exact: true }) });
    return brand ? byName.filter({ has: this.page.getByText(brand, { exact: true }) }) : byName;
  }

  /** A numbered page link in the pagination. The current page is not a link. */
  pageLink(pageNumber: number): Locator {
    return this.pagination.getByRole('link', { name: String(pageNumber), exact: true });
  }

  async openProduct(name: string, brand?: string): Promise<ItemPage> {
    const label = brand ? `${name} by ${brand}` : name;
    return test.step(`Open product ${label}`, async () => {
      const link = this.productLink(name, brand);
      const href = await link.getAttribute('href');
      const itemId = Number(href?.match(/item\/(\d+)/)?.[1]);
      if (!Number.isInteger(itemId)) {
        throw new Error(`Product link for ${label} has no item id in its href: ${href}`);
      }
      await link.click();
      const itemPage = new ItemPage(this.page);
      await itemPage.verifyPageIsOpen({ itemId });
      return itemPage;
    });
  }

  /** Reorders the products on the current page. The choice is kept in localStorage across pages. */
  async sortBy(option: SortOption): Promise<void> {
    await test.step(`Sort products by ${option}`, async () => {
      await this.sortCombobox.click();
      await this.sortListbox.getByRole('option', { name: option, exact: true }).click();
    });
  }
}

/** Matches a filter option's accessible name: its label, a space, then the live count. */
function filterOptionName(label: string): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped} \\d+$`);
}
