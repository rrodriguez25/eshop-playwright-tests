---
name: test-scenario-discovery
description: Use when filling, extending or reviewing a module's scenario catalog (test-tooling/scenarios/<module>.scenarios.json), mining eShop's source and running app for the behaviours a module should be tested for, or finding which scenarios a module is missing.
---

# Test scenario discovery

## Overview

Mining turns eShop's source and the running app into catalog rows: one checkable sentence each
about what eShop **should** do, with the evidence behind it. The output is a catalog change in a
pull request, which is where a person approves the scenarios. Mining writes no tests and logs no
bugs: tests confirm behaviour later, and bugs are logged only when a correct test fails.

The rules for a row (ids, what listing a screen or endpoint promises, kinds, sources) are in
`docs/scenario-catalog.md`. This skill is the procedure; it doesn't repeat them.

## Before you start

- **Work in this repo only.** Read eShop (`C:\GitHub\eShop`, read-only) with absolute paths;
  never `cd` into it. Before creating a worktree, check `git rev-parse --show-toplevel` is this
  repo: a worktree tool uses the current directory's repo, and this one once landed inside
  eShop's.
- **Read `docs/scenario-catalog.md` whole.** Then the module's entry in
  `test-tooling/modules.json`, its existing catalog if there is one (extend it; ids are never
  renamed or reused), and `pnpm scenarios:report <module>`, which lists the inventory items no
  row names yet.

## Procedure

1. **List the module's surface** from `test-tooling/inventory/screens.json` and
   `endpoints.json`. That is where obligations come from, not the limit of the search.

2. **Follow the data past the module's screens.** A module's behaviour also happens on other
   modules' pages (the bag is filled on the item page), in the layout (the header's bag count),
   and in other services (checkout empties the bag). Trace from each screen and endpoint into:
   the web app's services (`src/WebApp/Services`), the API's handlers and models, scripts in
   `wwwroot/js`, and integration events. Rules live in services more often than in pages.
   Where each kind of file lives: [requirement-evidence.md](requirement-evidence.md), "Finding a
   service's parts". Before writing an effect that crosses into another module (checkout empties
   the bag), read that module's catalog: if a row there already states it, don't repeat it.

3. **Collect requirement evidence for each behaviour,** best source first:
   [requirement-evidence.md](requirement-evidence.md). A row says what that evidence requires,
   not only what the code happens to do.

4. **Write candidates by kind.** For each behaviour, ask in turn:
   - **happy:** the normal path a user or caller takes.
   - **error:** invalid input; no login or the wrong user; an action in the wrong state (a step
     out of order, an order already shipped).
   - **edge:** boundaries (0, 1, the maximum, one past it), empty and full, duplicates, data that
     changed or disappeared since it was used, two users at once.
   - **regression:** a bug that was fixed and could return. Sources:
     `data/bugs.json` entries with `status: "fixed"`, eShop's commit history if the clone has
     any, and the upstream `dotnet/eShop` issues and fix commits only with the user's OK
     (fetching from GitHub). When there are none, write none and say so in the report.

5. **Treat a suspected defect as a row, never as a bug.** When the behaviour seems to break its
   requirement, write the row as the **correct** behaviour, and start its `sourceNote` with
   "Suspected eShop bug." followed by the evidence and what was seen. Never run `pnpm bugs:add`
   or edit `data/bugs.json`; the test writer logs it once a test fails.
   - Check a suspect live only when it's cheap and needs no shared state: read-only states in
     the Playwright MCP browser; anything that changes data through a throwaway spec
     (`tests/ui/zz-mining-probe.spec.ts`) using the `testUser` and API fixtures, which prints what
     it sees, asserts nothing, and is deleted after the run. Pages that stream can hang rather
     than fail: give the probe a long timeout and sample the page over time.
   - Flows driven by background processes take minutes. Read their timing first (OrderProcessor's
     grace period and poll interval, in requirement-evidence.md), set the probe's timeout past
     it, and sample more often than the fastest step, or intermediate states slip by unseen.
   - When a layer can't be reached (an API that needs a bearer token the suite can't get), don't
     stop: write the row and add "Not checked live: <why>." to `sourceNote`.
   - Record what you saw as "Seen live <YYYY-MM-DD>: <what>." in `sourceNote`.
   - A probe may leave data behind only when a test-owned user owns it (an order placed as
     `testUser` stays in orderingdb after the user is deleted). Say so in the report.
   - Never change static users (`data/users.json`) or seeded data to reach a state.

6. **Write the rows.** One checkable sentence each; split a sentence that needs "and" between
   unrelated things. Choose screens and endpoints by what the row should owe:
   - A screen when the behaviour is seen on that page. Behaviour in the header shows on every
     page: list the module's own screen.
   - An endpoint only when the behaviour is that endpoint's contract. A page behaviour is not an
     endpoint's even when the page calls one, and the web app's own form posts (Blazor's
     `POST /cart` with `_handler`) are the screen, not an API.
   - Another module's screen or endpoint is allowed when the behaviour is this module's and that is
     the only place it can be seen (stock drops in the Catalog API after an order is paid); the
     check warns.
   - A UI action whose result only an API shows (the address entered at checkout) lists the screen
     only; the UI test may read the API to check it.
   - **Refusals:** name the status when the contract documents it ("returns 400"). When eShop's
     sources disagree on it, or the contract documents none, write "is refused" plus what stays
     unchanged ("…, and the order keeps its status"), and put the disagreement in `sourceNote`.
     Every Ordering and Catalog call goes through the suite's `ContractValidator`, which throws on
     an undocumented status; the writer decides how to handle that, not the row.
   - A row that needs a system-wide setting to reach (payment failure needs PaymentProcessor's
     `PaymentSucceeded: false`) is still written; name the setting in `sourceNote`.
   - `sourceNote` names the eShop `file:line` (or eShop's test) the row stands on.
   - `lastUpdated` is today.

7. **Leave out** what no user or caller can observe: decorative elements, framework internals
   (antiforgery fields, form handler names), how something is implemented, and transient states
   no one acts on ("Loading your orders...").

8. **Check:** `pnpm check:scenarios` (0 errors; every warning explained in the report), then
   `pnpm scenarios:report <module>`. Keep the file's formatting as the other catalogs have it
   (2-space indent, `screens` and `endpoints` on one line): edit it as text, since a
   `JSON.stringify` rewrite expands every array and buries the real change in the diff.

9. **Open the pull request; it is the approval step.** When the brief says not to push, write the
   description to `docs/superpowers/<module>-pr-description.md` instead. The description has:
   - rows per kind, with what each kind covers
   - every suspected defect, with its evidence and what was seen
   - gaps: kinds with no source (regression), layers the inventory can't hold (gRPC, for one),
     and the rows behind each warning
   - existing tests that already check a row, for the writer to claim; mining adds no `claims()`

## Common mistakes

| Mistake | Instead |
| --- | --- |
| Rows only from the module's own page | Follow the data into services, other pages, the header and events (step 2) |
| Rows that restate the code ("calls UpdateBasket") | What a user or caller observes, backed by a requirement (steps 3, 6) |
| Only happy paths | Ask every kind for every behaviour (step 4) |
| Inventing regression rows | Write them only from a fixed bug or a known fix; otherwise report none |
| Logging a suspected bug | Write the correct behaviour as a row, evidence in `sourceNote` (step 5) |
| Writing the row as the buggy behaviour ("returns 500") | Write what eShop should do; the failing test proves the bug |
| Listing every endpoint a page calls | Only the endpoint whose contract the row is (step 6) |
| Changing a static user's bag to check something | A throwaway probe with `testUser` (step 5) |
| Adding `claims()` to tests | Report them; claiming is the test writer's job |
