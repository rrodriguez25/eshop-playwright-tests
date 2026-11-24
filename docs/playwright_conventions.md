# Playwright Conventions

How tests are written in this repository. Every rule comes with the reason for it, so that when a
case isn't covered you can decide the way the rules would. These conventions apply to people and
to AI agents alike: `CLAUDE.md` imports this file, and project skills point here instead of
repeating it.

When a rule and a real need conflict, follow the rule and raise the conflict, or change the rule
here first. Don't leave a silent exception in a spec.

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
| `pages/` | Page objects: locators and actions for one page. | `Page` only |
| `api/` | One typed service class per eShop API, plus generated types. | `APIRequestContext` only |
| `db/` | Connections, queries, transactions. No eShop table knowledge. | `pg` only |
| `fixtures/test.ts` | The `test` and `expect` every spec imports. | Everything above |
| `config/env.ts` | Every environment variable the suite reads. | `process.env` |

- **Specs never touch raw selectors, URLs, SQL or `process.env`.** Why: a spec should read as a
  description of behavior. When eShop changes, the fix belongs in one page object, service or
  helper, not in every spec that happened to inline it.
- **Only `helpers/db` writes SQL.** Why: table and column names are eShop's internal schema; they
  change with migrations, and keeping them in one folder keeps that blast radius small.
- **Lower layers never import higher ones** (a page object never imports a helper; `db/` never
  imports `helpers/`). Why: it keeps each layer testable and reusable on its own and prevents
  import cycles.

## 2. Imports

- Specs import `test` and `expect` from `fixtures/test`, never from `@playwright/test`.
  Why: the custom fixtures (`homePage`, `catalog`, `ordering`, `db`, ...) only exist on the
  extended `test`; importing the base one compiles but fails at runtime.
- Import types with `import type`. Why: it makes clear the import has no runtime effect.

```ts
import { test, expect } from '../../fixtures/test';
```

## 3. Locators

Use the first option on this list that works:

1. `getByRole(role, { name })`: what a user or screen reader perceives.
2. `getByLabel`, `getByPlaceholder`, `getByText`: visible text a user reads.
3. `getByTestId`: only when the element has no accessible name. eShop's source can't be changed
   from this repo, so this is rarely available.
4. CSS: last resort, scoped as tightly as possible, with a comment saying why nothing above works.

- **No XPath, and no selectors based on layout** (`div > div:nth-child(3)`). Why: they break on
  any markup change that a user would never notice.
- **Use `exact: true` when a name is a prefix of another** (`'Orders'` vs `'Orders history'`).
  Why: substring matching passes today and picks the wrong element tomorrow.
- **Prefer scoping over indexing.** Narrow down with `locator.filter({ hasText })` or a parent
  locator rather than `.first()` or `.nth()`. Use `.first()` only when any match is acceptable,
  and say so in the name (`anyProductCard`). Why: an index silently points at a different element
  when the order changes.
- **Locators live in page objects**, as `readonly` properties or methods that build them.

## 4. Assertions and waiting

- **Use web-first assertions** that wait and retry:

  ```ts
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();   // good
  expect(await page.getByRole('heading', { name: 'Checkout' }).isVisible()).toBe(true); // bad
  ```

  Why: the second form checks once, at whatever moment it happens to run, and is the most common
  source of flaky tests.
- **Never use `page.waitForTimeout`** or any fixed sleep. Wait for the thing you need: a locator
  state, a URL (`toHaveURL`), a response (`page.waitForResponse`), or a value (`expect.poll`).
  Why: a fixed sleep is either too short on a slow run or wasted time on a fast one.
- **For work eShop finishes in the background** (orders move through RabbitMQ between services),
  poll for the outcome with `expect.poll` or `expect(...).toPass()` and an explicit timeout:

  ```ts
  // orderStatus is an illustrative helpers/db function
  await expect.poll(() => orderStatus(db.ordering, orderId), { timeout: 15_000 }).toBe('submitted');
  ```

- **Assert the outcome, not the mechanism.** Check what a user or caller would observe (the cart
  shows 1 item, the API returns 201, the row exists), not internal intermediate steps.
- **Add a message to an assertion when the failure wouldn't be obvious**:
  `expect(count, 'EF migrations applied').toBeGreaterThan(0)`.
- **Page objects don't assert expected outcomes; specs do.** A page object may wait for its own
  page to be ready (a heading visible after navigation) because that's part of its action.
  Why: specs stay the single place that says what "correct" means.

## 5. Page objects

- One class per page or distinct component, in `pages/<Name>Page.ts`, extending `BasePage`
  with the page's path.
- Expose actions named after what a user does (`addToBag()`, `checkout()`), not after what the
  code does (`clickButton2()`).
- An action that navigates to another page returns that page's object.
- Register each page object as a fixture in `fixtures/test.ts`; specs receive it, they don't
  construct it. Why: one place wires dependencies, and specs stay free of setup code.

```ts
export class ProductPage extends BasePage {
  readonly addToBagButton = this.page.getByRole('button', { name: 'Add to shopping bag' });

  constructor(page: Page, itemId: number) {
    super(page, `/item/${itemId}`);
  }

  async addToBag(): Promise<void> {
    await this.addToBagButton.click();
  }
}
```

## 6. API services

- One service class per eShop API in `api/<Name>ApiService.ts`, built on `APIRequestContext`.
- Request and response types come from `api/generated/`. **Never hand-edit generated files**;
  regenerate with `pnpm generate:api-types` when eShop's API changes. Why: hand edits are lost on
  the next regeneration, and they hide contract drift that tests should catch.
- Required plumbing (such as `api-version`) is added inside the service, never by the caller.
- A method that returns data throws on an unexpected status, with the method, path and status
  in the message (`GET /api/catalog/items/7 -> 404`). Why: the failure explains itself without
  opening the trace.
- When the status code is what a test checks (auth contracts, validation), provide a method that
  returns the status or response instead of throwing.

## 7. Database

- Specs reach the database only through `helpers/db`, using the `db` fixture.
- **Every value goes in as a parameter** (`$1`, `$2`). Never build SQL by string concatenation.
  Names that can't be parameterized go through `identifier()` / `table()` in `db/sql.ts`.
  Why: it rules out injection and quoting bugs, including with names generated by `uniqueName`.
- eShop's table names are capitalized; quote them (`"Catalog"`). `orderingdb` uses the `ordering`
  schema.
- **Prefer the API to change state and the database to verify it.** Write to the database only
  for state the API can't create, and only rows the test owns. Why: direct writes skip eShop's
  own logic and integration events, so the system may not react the way it would in production.
- Group related writes in `transaction()` so a failure leaves nothing half-written.

## 8. Test data and isolation

Tests run in parallel (`fullyParallel: true`) and in any order.

- **Every test creates the data it changes**, named with `uniqueName('prefix')`. Why: two
  workers can never collide, and no test depends on another having run first.
- **Seeded eShop data is read-only.** Read seeded products and users freely, never modify or
  delete them. Why: other tests, and anyone using the app locally, rely on them.
- **Clean up what you create**: prefer a fixture that deletes in its teardown, since that runs even
  when the test fails. `afterAll` is the fallback for data shared by a `describe`.
- **Serial mode (`test.describe.configure({ mode: 'serial' })`) is reserved for a lifecycle**
  (create, read, update, delete one resource), with a comment saying so. Never use it to hide
  shared state between unrelated tests.
- **Login state is set up once and reused** through `storageState`, not by logging in inside
  every test.

## 9. Spec structure

- One feature per file, one `test.describe` per feature or endpoint.
- **Test names state the behavior and its result** in plain words: `'filters by name prefix'`,
  `'returns 401 without token'`. Not `'test 1'`, not `'should work'`.
- **One behavior per test.** Several assertions are fine when they describe the same outcome.
- **Arrange, act, assert**, separated by a blank line. In long UI journeys, use `test.step()` so
  the report shows which step failed.
- **Tags**: `@smoke` for the fast checks that prove the system is up. Add tags to the `describe`
  (`{ tag: '@smoke' }`), not to the title text.
- No `test.only` (CI fails on it via `forbidOnly`). `test.skip` and `test.fixme` must include a
  reason.

## 10. Files and naming

| Thing | Convention | Example |
| --- | --- | --- |
| Spec | `tests/<layer>/<feature>.<layer>.spec.ts` | `tests/api/catalog.api.spec.ts` |
| Page object | `pages/<Name>Page.ts`, class `<Name>Page` | `pages/HomePage.ts` |
| API service | `api/<Name>ApiService.ts` | `api/CatalogApiService.ts` |
| Helper | `helpers/<layer>/<area>.ts`, named exports | `helpers/db/catalog.ts` |
| Fixture | camelCase noun | `homePage`, `catalog`, `db` |

- Named exports only, no default exports. Why: names stay consistent across imports, and
  renames are caught by the compiler.
- TypeScript is `strict` with `noUncheckedIndexedAccess`. Avoid `!` and `as` unless the value is
  guaranteed, and prefer a check that throws with a clear message.

## 11. Configuration

- Every environment variable is read in `config/env.ts`, nowhere else. Settings only some tests
  need (like the database) are read lazily so other runs don't require them.
- No URLs, ports, usernames or passwords in specs, page objects or services.
- New variables go in `.env.example` with a placeholder and a comment on where to find the value.
  Real values stay in `.env`, which is never committed.

## 12. Before committing

```powershell
pnpm typecheck
pnpm test:<layer>      # the projects your change affects
```

Both must pass. A test that passes once but fails on a re-run is not done: run new or changed
tests with `--repeat-each=3` before committing them.
