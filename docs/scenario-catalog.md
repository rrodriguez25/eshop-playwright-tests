# Scenario Catalog

What eShop does, kept as data: one list of behaviours per module. Tests say which behaviours they
check, and a report shows, per module and per test layer, which are covered and which are still
missing. The catalog is what the human approves in `docs/ai-workflow.md`'s flow. Rules for the
tests themselves stay in [`playwright-conventions.md`](playwright-conventions.md).

```powershell
pnpm check:scenarios               # check catalogs, inventory and claims; fails on any error
pnpm scenarios:report              # one line per module and layer
pnpm scenarios:report catalog      # every row, the tests that claim it, what is missing
pnpm scenarios:report catalog --json
pnpm inventory:generate            # rebuild the screen and endpoint lists from eShop's source
pnpm test:tooling                  # the tooling's own tests
```

## Files

| File | Holds |
| --- | --- |
| `test-tooling/modules.json` | The module list: `id`, `name`, id `prefix`, the eShop pages and endpoint paths each module owns |
| `test-tooling/scenarios/<module>.scenarios.json` | One module's rows. `<module>` is an id in `modules.json` |
| `test-tooling/scenarios/scenario.schema.json` | The shape of a catalog file. Editors check a file against it as you type |
| `test-tooling/scenarios/_template.scenarios.json` | One example row to copy. Files starting with `_` are never read as catalogs |
| `test-tooling/inventory/screens.json`, `endpoints.json` | Every screen and endpoint a row may name. Generated, committed, never edited by hand |
| `test-tooling/inventory/supplement.json` | The few screens and endpoints no router or OpenAPI document lists (Identity's account pages), each with its eShop `file:line` |
| `test-tooling/*.ts` | Loading, scanning specs, obligations, the check and the report. `scripts/` holds the commands |

## A row

```json
{
  "id": "CAT-READ-FILTER-NAME-PREFIX",
  "behaviour": "Listing items filtered by name returns only items whose name starts with it.",
  "screens": [],
  "endpoints": ["GET /api/catalog/items"],
  "kind": "happy",
  "source": "existing-test",
  "sourceNote": "tests/api/catalog.api.spec.ts 'filters by name prefix'",
  "status": "active",
  "added": "2026-11-26",
  "changed": "2026-11-26"
}
```

- **A row describes eShop**, never this suite. A test of the suite's own code (the contract
  validator, a service's request building) claims no row.
- **`behaviour`** is one sentence, present tense, that a reader can check without opening a test:
  not "Name filter" but "Listing items filtered by name returns only items whose name starts with
  it." If it needs an "and" between two unrelated things, it is two rows.
- **`kind`**: `happy` (the normal path), `error` (eShop refuses or reports a problem), `edge` (a
  boundary: empty, the maximum, unusual input) or `regression` (a bug that came back once).
- **`source`**: `screen` (read from a page), `business-rule` (a rule in eShop's code),
  `bug`, `new-feature`, or `existing-test` (written from a test that already checks it).
  `sourceNote` is free text for the next reader: an eShop `file:line`, an issue, the test.
- **`added`** is the day the row is written; **`changed`** starts equal to it and moves to today
  whenever `behaviour`, `screens`, `endpoints`, `kind` or `status` changes.

### Ids are permanent

`<PREFIX>-<GROUP>-<SLUG>` in capitals. The prefix is the module's, from `modules.json`. Group
words keep catalogs sorted alike: `READ` (what is shown or returned), `WRITE` (creating and
changing), `VAL` (input rules and refusals), `AUTH` (logging in and out), `AUTHZ` (who may do it),
`UI` (pages, layout and wording), `ROUTE` (addresses and links), `FX` (effects that arrive later,
through RabbitMQ, such as an order's status changing).

Tests and history refer to ids, so an id is never renamed or reused:

- To reword a row, edit `behaviour` and set `changed`.
- To split a row, retire it and add new rows with new ids.
- When the behaviour leaves eShop, set `status` to `retired` and keep the row. Tests stop
  claiming it.

### Screens and endpoints decide what a row owes

Spell them exactly as `test-tooling/inventory/` does:

- Screen: `<app>:<route>`, with the route's parameters as page objects write them:
  `webapp:/item/:itemId`, `identity:/account/login`.
- Endpoint: `METHOD /path`, as the OpenAPI document spells it: `GET /api/catalog/items/{id}`.

They are not a list of everything the behaviour touches. Each one is a promise to test on a
layer:

- **List a screen** when the behaviour is seen on that page. The row then owes a UI test.
- **List an endpoint** when the behaviour is that endpoint's contract, something a caller of the
  API observes. The row then owes an API test. A page behaviour the web app happens to implement
  by calling an endpoint does not list it.

A row may list both, and then owes both. A row naming another module's screen or endpoint is
allowed, with a warning; usually the row belongs to that module.

## Obligations

For each active row:

| Layer | Owed when |
| --- | --- |
| UI | the row names a screen, or a test under `tests/ui` claims it |
| API | the row names an endpoint, or a test under `tests/api` claims it |

Each owed row and layer is in one of three states:

| State | Means |
| --- | --- |
| covered | a test on that layer claims it, and that test runs and isn't a known eShop bug |
| blocked | the only tests claiming it document a known eShop bug: they call `knownBug('<bug id>', …)` (see `data/bugs.json`) |
| missing | no test on that layer claims it, or only skipped ones do |

Missing is normal: rows are written before their tests, and the report is how the gap shows. A
missing obligation never fails a command. A row with no screen, no endpoint and no claim owes
nothing, and the check warns about it.

The check and the report read spec source, not test results. Covered means a test claims the row;
whether that test passes is the test run's answer.

## Claiming rows from a test

```ts
import { claims, expect, test } from '../../fixtures/test';

test('filters by name prefix', claims('CAT-READ-FILTER-NAME-PREFIX', 'api'), async ({ catalog }) => {
  // ...
});
```

- `claims(ids, layer)` goes in the test's details argument, never in the title. `ids` is one id
  or a list. `layer` is `'ui'` in `tests/ui` and `'api'` in `tests/api`. Specs under `tests/db`
  and `tests/preflight` claim nothing.
- Write the ids and the layer as string literals, directly in the test call: the check reads the
  source, so it cannot follow a variable or a helper.
- Claim a row only when the test's assertions check what the row says. A test asserting only
  that a call fails does not claim a row promising a 404. No tool can check this; a reviewer
  does.
- A test may claim several rows, and several tests may claim one row: a behaviour test and a
  contract test often claim the same one.
- `claims()` adds a tag per row, so `pnpm exec playwright test --grep @CAT-READ-FILTER-NAME-PREFIX`
  runs every test that claims it, and a `scenario` annotation the HTML report shows.

## `pnpm check:scenarios`

Runs without eShop or `.env`, so CI runs it. It prints every problem and exits 1 on any error.

**Fails:**
- A catalog that isn't JSON or doesn't match the schema.
- A JSON file in `scenarios/` that isn't `<module>.scenarios.json` and doesn't start with `_`.
- A file named for no module, a `module` field that differs from the file name, or a `prefix`
  that differs from `modules.json`.
- An id without its module's prefix, or an id used twice.
- A date that isn't real, or `changed` before `added`.
- An active row naming a screen or endpoint the inventory doesn't list.
- A claim of an id no catalog defines, or of a retired row.
- A claim with variables instead of literals, a layer other than `ui` or `api`, a layer that
  doesn't match the spec's folder, a claim under `tests/db` or `tests/preflight`, or a `claims()`
  outside a test call's arguments.
- A duplicate module id or prefix, or a missing or malformed inventory file.

**Warns:** a row naming another module's screen or endpoint; an active row that owes nothing.

**Never fails:** missing obligations. Each module's counts per layer are printed instead.

## The inventory

`pnpm inventory:generate` reads eShop's source and writes `screens.json` and `endpoints.json`:

- Screens from the `@page` routes under `src/WebApp/Components/Pages`, assigned to modules by
  `screenSources` in `modules.json`.
- Endpoints from the OpenAPI documents in `api/generated/`, assigned by `endpointPrefixes`. One
  endpoint appearing in several API versions is one item, listing its versions.
- Plus `supplement.json`.

It needs `ESHOP_SOURCE_DIR` in `.env`, the path of your eShop clone. Run it after
`pnpm generate:api-types`, and whenever eShop's pages change, and commit the result. It fails
when a page or endpoint belongs to no module, or to two: add or fix its module's entry in
`modules.json` and run it again.

The report lists, per module, the inventory items no active row names yet. That list is where
scenario discovery starts looking; it is information, not an obligation.

## Starting a module

1. Check the module is in `test-tooling/modules.json`. A new module gets an `id`, a `name`, a
   `prefix` no other module uses, and the pages and endpoint paths it owns. Then run
   `pnpm inventory:generate`.
2. Copy `_template.scenarios.json` to `<module>.scenarios.json`, and set `module` and `prefix`.
3. Replace the example row with the module's rows, dated today.
4. Run `pnpm check:scenarios`, then `pnpm scenarios:report <module>` to see what is missing.
5. Add `claims()` to the tests that check each row, or write those tests.
