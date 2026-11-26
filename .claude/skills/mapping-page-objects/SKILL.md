---
name: mapping-page-objects
description: Use when creating or updating a page object or component in pages/ for an eShop screen, when a test needs a page or state that isn't mapped yet, when eShop's markup or text changed, or when confirming locators marked `// Unverified:`.
---

# Mapping page objects

## Overview

A page object is mapped from two sources: eShop's `.razor` source says **what exists** and when it
renders; the live page (Playwright MCP) says **how to locate it**. A single snapshot shows one
state, so mapping from the live page alone misses whole parts of a screen.

The rules for the result are in `docs/playwright-conventions.md` (§3 Locators, §5 Page objects
and Components) and the background in `docs/ai-workflow.md` ("Mapping a page object from both").
This skill is the procedure; it doesn't repeat those rules.

Use absolute paths in shell commands: the eShop clone (`C:\GitHub\eShop`) and this repo are both
open, and a `cd` moves the working directory between them.

## Procedure

1. **Collect every source file the screen uses.** Start from the route's `.razor` file, then
   follow what it pulls in. [eshop-sources.md](eshop-sources.md) says where each kind of file
   lives. Take screen text from source and the live page only, never from docs or memory: the
   docs have been wrong.

2. **Write the inventory before opening the browser.** One row per element a test would assert
   on or act on:

   | Element | Renders when | Source file |
   | --- | --- | --- |
   | "Add to shopping bag" button | logged in | `Pages/Item/ItemPage.razor` |

   Include the route and its parameters, every `@if` / `else` branch, `<AuthorizeView>` branches,
   empty, error and loading states, query-parameter states, and states only a script creates
   (open listbox, dialog, hover menu). Leave out purely decorative elements and script-internal
   ones (a hidden submit button only a script clicks), and note them in one line in the report.

3. **Decide the classes.** For each distinct part, ask which other screens show it.
   - Two or more screens, or a self-contained widget (dialog, drawer): a component in
     `pages/components/`. Check whether it is already mapped there; the header is (`HeaderBar`).
   - Only this screen: its locators go in the page object, however separate the part looks.
   - Route parameters: a template and types on `BasePage<{ ... }>`.

4. **Visit every reachable state live** with Playwright MCP, and read each snapshot against
   [snapshot-traps.md](snapshot-traps.md).
   - Reach states by URL when you can (`?brand=9&type=8`, `?page=12`); it is faster than clicking
     and easy to repeat.
   - **Login-gated pages** (`@attribute [Authorize]`): log in as a static user, as conventions §8
     "Logged-in users" describes. Take the username from `data/users.json` and type the password,
     `USER_PASSWORD` from `.env`, into Identity's login form. Never write the password into any
     file, the probe spec included.
   - **Never change shared state to reach a state.** A changed basket, orders or profile needs a
     test-owned user, never a static one (§8), and seeded catalog data is never edited. Until the
     suite can create test-owned users, leave those elements Unverified and list them in the
     report under "needs a test-owned user".
   - Snapshots are saved under `test-results/playwright-mcp/`; grep the region you need instead
     of reading the whole file.
   - When a state the source says should render can't be reached, find out what the server
     actually returns (`curl -sk -w "%{http_code}"`). A mismatch may be an eShop bug: report it,
     don't work around it.

5. **Write the page object** following the conventions. Every element from the inventory is
   mapped. Those not seen live get `// Unverified:` with the source file and the condition: one
   marker per locator or method. A group with the same condition may say "same condition as
   <name>".
   - **Stream-rendered pages** (`@attribute [StreamRendering]`): the ready indicator (often the
     hero h1) can appear before the content. Say in the class comment which locator marks each
     loaded state (empty, with data), so tests wait for it after `verifyPageIsOpen()`.

6. **Run every locator before calling it verified.** Seeing an element in a snapshot is not the
   same as the locator matching it. Write a throwaway spec, `tests/ui/zz-locator-probe.spec.ts`,
   that puts each locator not marked Unverified in the state where it renders and asserts on it
   (`toBeVisible`, `toHaveAccessibleName`, `toHaveCount(1)`). For a login-gated page it logs in
   with `test.use({ user: '<key>' })`. Include `// @ts-expect-error` checks for what the types
   should reject: `goto()` without route parameters, or `goto({ ... })` on a page without them.
   Put those lines inside a function that is never called: `goto` ignores extra arguments at
   runtime and would navigate. Run the probe, fix what fails, then delete it. It is never
   committed.

7. **Clean up the browser.** Log out, and remove `localStorage` keys you set (the catalog sort is
   `aw.catalog.sort.v1`), so the next exploration starts logged out with defaults.

8. **Register and smoke-check.** Add a fixture with `pageFixture()` for each new page (components
   have none), plus one `verifyPageIsOpen()` check in `tests/ui/smoke.spec.ts`, logged in with
   `test.use({ user: '<key>' })` for a login-gated page. Prefer data the test creates
   (`catalogItem`) over seeded data's position on a page. Then run the checks in conventions §12.

9. **Report** what was mapped, every Unverified element with the reason it wasn't reached (those
   needing a changed basket, orders or profile under "needs a test-owned user"), what was left
   out of the inventory, suspected eShop bugs, and any convention gap you had to decide on.
   Propose a rule for each gap rather than leaving a silent exception. Add the pages mapped to
   "Where things stand" in `docs/ai-workflow.md`.

## Common mistakes

| Mistake | Instead |
| --- | --- |
| Mapping only what the first snapshot shows | Inventory from source first (step 2) |
| Reading only the route's `.razor` file | Follow components, layout, `wwwroot/js`, `.razor.css` (step 1) |
| Copying button text from a doc or example | Text from source and live page only |
| A new class for a part only one screen shows | Keep it in the page object (step 3) |
| Leaving out the header and other layout parts | Reuse or map them as components on `BasePage` |
| Building a page object per item id, or skipping its fixture | Route template; constructor takes only `page` |
| Changing a static user's basket to see a state | Leave it Unverified; report it under "needs a test-owned user" |
| Calling a locator verified because the snapshot looked right | Run it in the probe spec (step 6) |
| A component method returning a page object | Circular import through `BasePage`; put the action in the page or `helpers/ui/` |
