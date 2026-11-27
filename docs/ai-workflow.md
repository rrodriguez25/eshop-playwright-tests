# AI Workflow

How AI agents write and maintain this suite. The goal is to delegate the work end to end, with
one human checkpoint: approving which scenarios get tested.

## Three layers

| Layer | Holds | Loaded | Example |
| --- | --- | --- | --- |
| [Conventions](playwright-conventions.md) | What good looks like: rules and standards | Always, through `CLAUDE.md` | "locators via `getByRole` first" |
| Skills (`.claude/skills/<name>/SKILL.md`) | How to do one task, step by step | When the task needs it | "map a page into a page object" |
| Agents (`.claude/agents/<name>.md`) | Who does it: a role with its own tools, permissions and context | When delegated to | a reviewer that can read but not edit |

- Skills follow the conventions and never restate or override them.
- Each skill does one job. A larger skill refers to a smaller one instead of copying it
  (`test-writer`: "if the page object doesn't have what the test needs, use `mapping-page-objects`").
- Agents differ in what they are allowed to do, not only in their instructions. That is what
  makes delegating safe.

## Skills

| Skill | Does | Status |
| --- | --- | --- |
| `test-scenario-discovery` | Mines eShop's source and the running app into rows for a module's scenario catalog (`test-tooling/scenarios/<module>.scenarios.json`, rules in [`scenario-catalog.md`](scenario-catalog.md)), for review. Flags suspected defects in the rows; never logs bugs | Written from mining basket; tested by a fresh agent mining ordering, revised |
| `mapping-page-objects` | Maps the parts of a page the current test needs, from its source and the live page | Written, tested on the cart, revised; to be rescoped to "map what the test needs" with the first test-writing work |
| `test-writer` | UI and API scenario tests from approved catalog rows, with `claims()`; logs a bug (`pnpm bugs:add`) only when a correct test fails | Planned |
| `test-data-seeder` | Test data through fixtures and the API, unique names, cleanup | Planned |
| `test-reviewer` | Checks a change against the conventions and the rows it claims; runs the tests (`--repeat-each`, flaky triage, known-bug markers) | Planned |

Each skill is written from real work, not up front: do the task for real, note where an agent
stalled, guessed or needed correcting, write the skill to fix exactly that, then check a fresh
agent gets it right on a second task.

## Agents

| Agent | Uses | May |
| --- | --- | --- |
| Scenario miner | `test-scenario-discovery` | Read eShop's source and the repo; drive the browser (Playwright MCP); write only `test-tooling/scenarios/<module>.scenarios.json` and throwaway probes |
| Test writer | `test-writer`, `mapping-page-objects`, `test-data-seeder` | Write in `tests/` and the layers it needs (`pages/`, `fixtures/`, `helpers/`, `api/`); log bugs with `pnpm bugs:add`; run tests |
| Data seeder | `test-data-seeder` | Write in `helpers/`, `fixtures/`, `api/` |
| Reviewer | `test-reviewer` | Read and run tests. No edits. Starts with a fresh context and never sees how the change was written. |
| `playwright-suite` | Test writer, data seeder and reviewer together | Works from approved catalog rows a module's tests don't claim yet; one batch at a time, each passing review before it's pushed to the module's pull request |

Agents are built only after the skills they use have been tested.

## Flow

```
discover scenarios ──► human approves the list ──► map pages ──► seed data ──► write tests ──► review ──► verify
```

A coordinating session, and later a workflow, runs the steps in order. The approval step stays
even when everything else is delegated: which scenarios are worth testing is a judgment call.

The list that gets approved is a module's scenario catalog: approving it means approving its rows.
Discovery starts from what the catalog doesn't name yet: `pnpm scenarios:report <module>` lists the
module's screens and endpoints no row names. Tests written later claim the rows with `claims()`, and
the same report shows which rows each layer still misses.

## Sources of truth

Agents work from two sources and need both:

| Source | Shows | Misses |
| --- | --- | --- |
| eShop's source (`C:\GitHub\eShop`, read-only) | Everything a page or endpoint can do: every branch, state and rule | How it actually renders and behaves at runtime |
| The running app (Playwright MCP, the APIs, the database) | The real rendered page, accessible names, live data | Anything the current user, data or moment doesn't trigger |

### Mapping a page object from both

The live page only shows one state at a time. eShop's item page
(`src/WebApp/Components/Pages/Item/ItemPage.razor`, route `/item/{itemId:int}`) renders an
"Add to shopping bag" button when logged in, "Log in to purchase" when not, an extra block when the
item is already in the basket, and a not-found state. A single snapshot shows one of these.

1. **Source first, for the inventory.** Read the page's `.razor` file and the components it uses
   (`src/WebApp/Components/`, `src/WebAppComponents/`). List every element a test could need,
   with the condition under which it renders (`@if`, `<AuthorizeView>`, empty and error states,
   feature flags), plus the route and its parameters.
2. **Live page second, to confirm.** Open the page with Playwright MCP in each state that can be
   reached (logged out, logged in, with and without data) and take locators and accessible names
   from the snapshot.
3. **Map both.** Elements seen live are mapped from the snapshot. Elements only seen in the
   source are still mapped, from the markup, and marked so they are confirmed later:

   ```ts
   // Unverified: from ItemPage.razor, renders only when the item is already in the basket.
   readonly inBasketNotice: Locator;
   ```

4. **Correct later.** When a test first reaches that state, confirm the locator against the live
   page and remove the marker, or fix it.

Source code wins on *what exists*; the live page wins on *how to locate it*.

## Where things stand

- Conventions: written (`docs/playwright-conventions.md`).
- Tools: Playwright MCP in `.mcp.json`; eShop's source readable through
  `permissions.additionalDirectories` in `.claude/settings.local.json`.
- Page objects: catalog (`HomePage`), item (`ItemPage`), cart (`CartPage`, mostly Unverified
  until re-mapped with a test user) and the header bar component (`HeaderBar`).
- Test data: static users (`data/users.json`) for logged-in reads; the `testUser` fixture for
  tests that change a basket, orders or profile.
- Skills:
  - `mapping-page-objects`, written from mapping the catalog pages, tested on the cart and
    revised. Next: rescope it to "map what the test needs" with the first test-writing work.
  - `test-scenario-discovery`, written from mining the basket module, tested by a fresh agent
    mining ordering, and revised from that run (evidence when eShop's tests pin a buggy status,
    wording refusals, unreachable layers, background-process timing).
- Scenario catalog: format, inventory, `claims()`, check and report in place
  (`docs/scenario-catalog.md`). Catalogs: `catalog` (pilot, written from the existing tests),
  `basket` (27 rows, mined) and `ordering` (59 rows, mined by a fresh agent with the skill).
- Known bugs: `data/bugs.json`, `knownBug()`, the known-bugs reporter, `pnpm bugs:add` and
  `pnpm bugs:sync`.
- Not yet: an API layer for basket. Basket's API is gRPC, which the inventory doesn't list; it
  needs gRPC methods in `supplement.json` and a gRPC client with a bearer token.
- Agents: none yet.
