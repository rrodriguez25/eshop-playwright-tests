# eshop-playwright-tests

Playwright and TypeScript test suite for Microsoft's eShop reference app. This is a public
portfolio project. The README covers setup, running eShop, the database and the folder layout;
read it before changing anything.

## Ground rules

- Everything here is written from scratch. Never copy code, skills, prompts or internal
  documentation from an employer's repository, and never cite one as a source.
- This repo contains only tests. Never copy or modify eShop's source; eShop lives in its own
  clone (`C:\GitHub\eShop` on the author's machine).
- No secrets in the repo. `.env` is gitignored; `.env.example` holds only local URLs.

## Toolchain

- Node 26 (`.nvmrc`), pnpm (version pinned in `package.json`). Use pnpm, never npm or yarn.
- `pnpm test`, `pnpm test:ui`, `pnpm test:api`, `pnpm typecheck`, `pnpm report`.
- Run `pnpm typecheck` and the affected tests before every commit.
- eShop must be running for tests to pass: start it with
  `dotnet run --project src/eShop.AppHost/eShop.AppHost.csproj` from the eShop clone.
  Web app `https://localhost:7298`, Catalog API `http://localhost:5222`.
- Playwright MCP (`.mcp.json`, pinned dev dependency `@playwright/mcp`) drives a real browser
  against eShop. Use it to explore a page and read its accessibility snapshot before writing
  page objects. If it reports a missing browser, call its `browser_install` tool.

## Structure

- `pages/`: page objects. `api/`: API clients and generated types. `db/`: PostgreSQL access
  (`DbClient` with one pool per eShop database, `Database` with `query`, `queryOne`, `execute`,
  `transaction`). `fixtures/test.ts`: the `test` and `expect` every spec imports, including the
  worker-scoped `db` fixture. `config/`: environment.
- `helpers/`: `setup/`, `db/`, `api/`, `ui/` and general utilities at the root. Where a new
  helper goes is decided by the Helpers section of the conventions.
- `tests/ui` runs in the `chromium` project, `tests/api` in `api`, `tests/db` in `db`
  (`pnpm test:db`). Database tests need `DB_PORT` and `DB_PASSWORD` in `.env`.
- Specs import `test` and `expect` from `fixtures/test`, never from `@playwright/test`.

## Conventions

Follow `docs/playwright-conventions.md` for every test, page object, service and helper. It is
imported below so it is always in context:

@docs/playwright-conventions.md

## Skills

Project skills live in `.claude/skills/<name>/SKILL.md` and agents in `.claude/agents/<name>.md`.
`docs/ai-workflow.md` describes the plan: which skills and agents exist or are planned, what each
may do, and how page objects are mapped from eShop's source and the live page. Skills are written
one at a time from real work. They describe how to do a task and point to the conventions above;
they never restate or override them.
