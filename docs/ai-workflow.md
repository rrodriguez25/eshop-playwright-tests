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
  (`writing-ui-tests`: "if the page object doesn't exist, use `mapping-page-objects`").
- Agents differ in what they are allowed to do, not only in their instructions. That is what
  makes delegating safe.

## Skills

| Skill | Does | Status |
| --- | --- | --- |
| `discovering-scenarios` | Reads eShop's source and the running app; produces a list of scenarios to review | Planned |
| `mapping-page-objects` | Maps a page into a page object from its source and the live page | Written; to be checked on a second page |
| `seeding-test-data` | Test data through fixtures and the API, unique names, cleanup | Planned |
| `writing-ui-tests` | Browser scenario tests on top of page objects and seeded data | Planned |
| `writing-api-tests` | API scenario and contract tests | Planned |
| `reviewing-changes` | Checks a change against the conventions | Planned |
| `verifying-tests` | `--repeat-each`, flaky test triage, known-bug markers | Planned |

Each skill is written from real work, not up front: do the task for real, note where an agent
stalled, guessed or needed correcting, write the skill to fix exactly that, then check a fresh
agent gets it right on a second task.

## Agents

| Agent | Uses | May |
| --- | --- | --- |
| Scenario explorer | `discovering-scenarios` | Read eShop's source and the repo; drive the browser (Playwright MCP). No edits. |
| Page mapper | `mapping-page-objects` | Read eShop's source; drive the browser; write in `pages/` and `fixtures/` |
| Data seeder | `seeding-test-data` | Write in `helpers/`, `fixtures/`, `api/` |
| Test writer | `writing-ui-tests`, `writing-api-tests`, `seeding-test-data`, `verifying-tests`; `mapping-page-objects` when a page object is missing | Write in `tests/` and the layers it needs; run tests |
| Reviewer | `reviewing-changes`, `verifying-tests` | Read and run tests. No edits. Starts with a fresh context and never sees how the change was written. |

Agents are built only after the skills they use have been tested.

## Flow

```
discover scenarios ──► human approves the list ──► map pages ──► seed data ──► write tests ──► review ──► verify
```

A coordinating session, and later a workflow, runs the steps in order. The approval step stays
even when everything else is delegated: which scenarios are worth testing is a judgment call.

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
- Page objects: catalog (`HomePage`), item (`ItemPage`) and the header bar component (`HeaderBar`).
- Skills: `mapping-page-objects`, written from mapping the catalog pages, then tested by a fresh
  agent mapping the cart page and revised from that run (login-gated and stream-rendered pages,
  inventory scope, probe checks). Next: check the revised skill on another page.
- Agents: none yet.
