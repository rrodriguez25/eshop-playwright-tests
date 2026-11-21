# eShop Playwright Tests

A Playwright and TypeScript test suite for [eShop](https://github.com/dotnet/eShop), Microsoft's
.NET reference application. It covers the web UI and the HTTP APIs, and is built to run in parallel
and in CI.

## Stack

- Playwright Test, TypeScript
- eShop (.NET Aspire, PostgreSQL, Redis, RabbitMQ), run locally in Docker
- GitHub Actions

## Architecture

| Folder | Purpose |
| --- | --- |
| `src/pages` | Page objects. Each page owns its locators and actions; tests never touch raw selectors. |
| `src/api` | Typed API clients, used for API tests and for setting up test data without the UI. |
| `src/fixtures` | Custom Playwright fixtures that hand page objects and API clients to tests. |
| `src/data` | Test data helpers. Every test creates its own uniquely named data, so tests run in parallel safely. |
| `src/config` | Environment configuration, read from `.env` locally and from variables in CI. |
| `tests/ui` | Browser tests (Chromium project). |
| `tests/api` | API tests (no browser). |

## Getting started

### Prerequisites

- Node.js 26 LTS (see `.nvmrc`)
- pnpm (`npm install -g pnpm`)
- .NET SDK (the version eShop's README requires)
- Docker Desktop

### Run eShop

```powershell
git clone https://github.com/dotnet/eShop.git
cd eShop
dotnet run --project src/eShop.AppHost/eShop.AppHost.csproj
```

The first run builds the solution and pulls the PostgreSQL, Redis and RabbitMQ containers, so it
takes a few minutes. When it is up, the console prints an Aspire dashboard link, and the services
listen on:

| Service | URL |
| --- | --- |
| Web app | `https://localhost:7298` |
| Catalog API | `http://localhost:5222` |

### Run the tests

```powershell
pnpm install
pnpm exec playwright install chromium
Copy-Item .env.example .env
```

The defaults in `.env.example` match the URLs above. Then:

```powershell
pnpm test            # everything
pnpm test:ui         # browser tests
pnpm test:api        # API tests
pnpm report          # open the HTML report
```

## Roadmap

- [x] Project structure, fixtures, smoke tests
- [ ] Catalog, basket and checkout UI flows
- [ ] Catalog and ordering API tests
- [ ] Test data set up through the API
- [ ] eShop started in GitHub Actions, with sharded runs and a merged HTML report
- [ ] AI-assisted failure triage

## Credits

eShop is © Microsoft and the .NET Foundation, released under the MIT license. This repository
contains only tests; it does not include or modify eShop's source.
