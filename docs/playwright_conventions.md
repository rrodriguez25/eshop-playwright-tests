# Playwright Conventions

How tests are written in this repository, for people and AI agents alike. `CLAUDE.md` imports
this file, and project skills point here instead of repeating it. A reason is given only where a
rule is specific to this project or departs from common practice.

When a rule and a real need conflict, raise it or change the rule here first. Don't leave a silent
exception in a spec.

---

## 1. Layers

```
tests/  ──►  helpers/  ──►  pages/   api/   db/  ──►  eShop (browser, HTTP, PostgreSQL)
  │                           ▲
  └──── fixtures/test.ts ─────┘   (hands page objects, API services and the db client to tests)
```

| Layer | Contains | May use |
| --- | --- | --- |
| `tests/ui`, `tests/api`, `tests/db` | Specs: what is tested and what is expected. | Fixtures, helpers, page objects, API services |
| `helpers/setup` | Test data utilities (`uniqueName`, builders). | Nothing eShop-specific |
| `helpers/ui`, `helpers/api`, `helpers/db` | Reusable multi-step actions and queries. | Page objects, API services, `db/` |
| `pages/` | Page objects: locators, actions and verifications for one page. | `@playwright/test` and other page objects |
| `api/` | One typed service class per eShop API, plus generated types. | `APIRequestContext` only |
| `db/` | Connections, queries, transactions. No eShop table knowledge. | `pg` only |
| `fixtures/test.ts` | The `test` and `expect` every spec imports. | Everything above |
| `config/env.ts` | Every environment variable the suite reads. | `process.env` |

- Specs contain no raw selectors, URLs, SQL or `process.env`.
- Only `helpers/db` contains SQL or eShop table and column names. Why: they are eShop's internal
  schema and change with its migrations; one folder keeps that change in one place. This applies
  anywhere the schema could leak, not only to SQL strings.
- Lower layers never import higher ones.

## 2. Imports

- Specs import `test` and `expect` from `fixtures/test`, never from `@playwright/test`. Why: the
  custom fixtures (`homePage`, `catalog`, `ordering`, `db`) exist only on the extended `test`;
  the base import compiles but fails at runtime.
- Use `import type` for type-only imports.

## 3. Locators

Use the first option that works:

1. `getByRole(role, { name })`
2. `getByLabel`, `getByPlaceholder`, `getByText`
3. `getByTestId`
4. CSS, scoped tightly, with a comment saying why nothing above works

- `getByTestId` is rarely available. Why: eShop's markup has few test IDs, and this repo never
  modifies eShop's source, so don't plan on adding them.
- No XPath and no layout-based selectors (`div > div:nth-child(3)`).
- Use `exact: true` when one name is a prefix of another (`'Orders'` vs `'Orders history'`).
- Narrow with `filter({ hasText })` or a parent locator rather than `.first()` or `.nth()`.
- Locators live in page objects.

## 4. Assertions and waiting

- Web-first assertions only: `await expect(locator).toBeVisible()`, never
  `expect(await locator.isVisible()).toBe(true)`.
- No `page.waitForTimeout`, fixed sleeps or `waitForLoadState('networkidle')`. Rely on
  auto-waiting, or wait for a locator state, URL, response or value.
- eShop finishes some work in the background: orders move between services through RabbitMQ, so
  their database rows and statuses appear after the request returns. Poll for those outcomes with
  `expect.poll` or `expect(...).toPass()` and an explicit timeout.
- Assert the outcome a user or caller observes, not intermediate steps.
- Add a message to an assertion when the failure wouldn't be obvious.
- Checks reused across specs live in page objects as `verify<Something>()` methods; the spec
  decides which checks a test makes.

## 5. Page objects

- One class per page or distinct component: `pages/<Name>Page.ts`, extending `BasePage`.
- Every page object defines `URL_PATH`, the screen's path relative to the base URL. A page with
  route parameters assigns it in the constructor (``this.URL_PATH = `/item/${itemId}` ``).
- Every page object defines `readyIndicator`: an element only that page shows once it has
  rendered, usually its main heading.
- Every page object has `goto()` and `verifyPageIsOpen()`, inherited from `BasePage`.
  `verifyPageIsOpen()` asserts the URL path against `URL_PATH` and that `readyIndicator` is
  visible. Call it after navigating, including after an action that lands on another page.
- Text the screen shows (headings, labels, button names, messages) goes in a `static readonly
  TEXTS` object on the page object, `as const`. Locators and verifications use it, and specs may
  read it (`HomePage.TEXTS.heading`). No screen text is repeated as a string literal elsewhere.
- Class layout, top to bottom: `TEXTS`, `URL_PATH`, `readyIndicator`, other locators declared
  `readonly`, constructor that assigns the locators, then methods.
- Methods are for multi-step actions and for verifications. No method that wraps a single action:
  specs use the locator directly (`await productPage.addToBagButton.click()`).
- Actions are named after what a user does (`placeOrder()`, `addToBag()`, `checkout()`), verifications start with `verify`.
- Wrap each method's body in `test.step()` named after the user's intent. Include the arguments in
  the step name when there are fewer than three, so the report shows what was used.
- An action that navigates to another page returns that page's object.
- Register each page object as a fixture in `fixtures/test.ts`; specs receive it, never construct it.

```ts
export class CheckoutPage extends BasePage {
  static readonly TEXTS = {
    heading: 'Checkout',
    address: 'Address',
    city: 'City',
    placeOrder: 'Place order',
  } as const;

  readonly URL_PATH = '/checkout';
  protected readonly readyIndicator: Locator;
  readonly addressInput: Locator;
  readonly cityInput: Locator;
  readonly placeOrderButton: Locator;

  constructor(page: Page) {
    super(page);
    this.readyIndicator = page.getByRole('heading', { name: CheckoutPage.TEXTS.heading });
    this.addressInput = page.getByLabel(CheckoutPage.TEXTS.address);
    this.cityInput = page.getByLabel(CheckoutPage.TEXTS.city);
    this.placeOrderButton = page.getByRole('button', { name: CheckoutPage.TEXTS.placeOrder });
  }

  async placeOrder(address: string, city: string): Promise<OrdersPage> {
    return test.step(`Place order shipping to ${address}, ${city}`, async () => {
      await this.addressInput.fill(address);
      await this.cityInput.fill(city);
      await this.placeOrderButton.click();
      const ordersPage = new OrdersPage(this.page);
      await ordersPage.verifyPageIsOpen();
      return ordersPage;
    });
  }

  async verifyShippingAddress(address: string, city: string): Promise<void> {
    await test.step(`Verify shipping address is ${address}, ${city}`, async () => {
      await expect(this.addressInput).toHaveValue(address);
      await expect(this.cityInput).toHaveValue(city);
    });
  }
}
```

## 6. API services

- One service class per eShop API: `api/<Name>ApiService.ts`, built on `APIRequestContext`.
- Types come from `api/generated/`. Never hand-edit generated files; run `pnpm generate:api-types`.
  Why: hand edits are lost on regeneration and hide contract drift the tests should catch.
- Required plumbing such as `api-version` is added inside the service, never by the caller.
- Methods that return data throw on an unexpected status, with method, path and status in the
  message (`GET /api/catalog/items/7 -> 404`).
- When the status is what a test checks (auth, validation), provide a method that returns it
  instead of throwing.

## 7. Database

- Specs reach the database only through `helpers/db`, using the `db` fixture.
- Every value is a parameter (`$1`, `$2`). Names that can't be parameterized go through
  `identifier()` / `table()` in `db/sql.ts`.
- eShop's table names are capitalized and must be quoted (`"Catalog"`). `orderingdb` uses the
  `ordering` schema.
- Change state through the API; use the database to verify it. Write directly only for state the
  API can't create, and only rows the test owns. Why: direct writes skip eShop's own logic and
  integration events, so other services never react to them.
- Group related writes in `transaction()`.

## 8. Test data and isolation

- Every test creates the data it changes, named with `uniqueName('prefix')`. Why: tests run fully
  parallel (`fullyParallel: true`) and in any order, against one shared eShop instance.
- Use descriptive prefixes (`uniqueName('checkout-address')`, not `uniqueName('x')`) and realistic
  values (a real-looking street and city, a sensible price), so failures and leftover rows are
  easy to read.
- Seeded eShop data is read-only: read it freely, never modify or delete it. Why: other tests and
  local use of the app depend on it.
- Clean up what you create, preferably in a fixture's teardown; `afterAll` is the fallback.
- Everything runs fully parallel, lifecycle tests included. Each test creates its own resource
  through a fixture, or covers a multi-step flow in one test. Never chain tests that depend on
  each other.
- Serial mode is only for a conflict that isolated test data can't prevent:
  - a background process that updates many records at once (such as eShop's ordering job that
    moves every order past its grace period)
  - a resource that can't be duplicated per test, such as a user's basket when tests share one of
    the few seeded users
  - assertions on system-wide state (totals, first page of results) that can't be filtered to the
    test's own data
  - a system-wide setting or feature toggle a test has to change
  - external limits: rate limits, quotas, a fixed pool of accounts
  - a fixed value the test must use that the system allows only once

  Every serial `describe` states its conflict in a comment. Why: serial hides failures (one
  failing test skips the rest) and slows the suite, so it must be justified.
- Serial mode only orders tests within one file; other files keep running in other workers. When
  the conflict spans files, move those tests to their own project with `workers: 1` instead.
- Login state is created once and reused through `storageState`.

## 9. Spec structure

- One feature per file, one `test.describe` per feature or endpoint.
- Test names state the behavior and its result: `'filters by name prefix'`,
  `'returns 401 without token'`.
- One behavior per test.
- Arrange, act, assert, separated by blank lines.
- No `test.step()` in specs. Steps live inside page object and helper methods, so a spec stays a
  short list of intent-named calls and the report still shows each step.
- Use `beforeEach` for navigation or setup shared by every test in a `describe`. Data a test
  needs comes from fixtures, not hooks.
- Comments only for logic that isn't obvious from the names.
- Tags go on the `describe` (`{ tag: '@smoke' }`), not in the title. `@smoke` marks the fast checks
  that prove the system is up.
- No `test.only`. `test.skip` and `test.fixme` include a reason.

## 10. Files and naming

| Thing | Convention | Example |
| --- | --- | --- |
| Spec | `tests/<layer>/<feature>.<layer>.spec.ts` | `tests/api/catalog.api.spec.ts` |
| Page object | `pages/<Name>Page.ts`, class `<Name>Page` | `pages/HomePage.ts` |
| API service | `api/<Name>ApiService.ts` | `api/CatalogApiService.ts` |
| Helper | `helpers/<layer>/<area>.ts` | `helpers/db/catalog.ts` |
| Fixture | camelCase noun | `homePage`, `catalog`, `db` |

- Named exports only.
- TypeScript is `strict` with `noUncheckedIndexedAccess`. Avoid `!` and `as`; prefer a check that
  throws with a clear message.

## 11. Configuration

- Every environment variable is read in `config/env.ts`, nowhere else.
- Settings only some projects need (such as the database) are read lazily. Why: UI and API runs
  must work without database credentials.
- No URLs, ports, usernames or passwords outside `config/` and `.env`.
- New variables go in `.env.example` with a placeholder and where to find the value; real values
  stay in `.env`, which is never committed.

## 12. Before committing

```powershell
pnpm typecheck
pnpm test:<layer>                 # each project the change affects
pnpm exec playwright test <spec> --repeat-each=3   # new or changed tests
```

All must pass.
