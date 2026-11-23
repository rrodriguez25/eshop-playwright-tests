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
| `pages/` | Page objects. Each page owns its locators and actions; tests never touch raw selectors. |
| `api/` | Typed API service classes and generated OpenAPI types (`api/generated/`). Run `pnpm generate:api-types` to regenerate from live specs. |
| `db/` | PostgreSQL access: `DbClient` opens a connection pool per eShop database on first use; each `Database` runs parameterized queries and transactions. |
| `fixtures/` | Custom Playwright fixtures that hand page objects, API services and the `db` client to tests. |
| `helpers/setup` | Test data utilities (e.g. `uniqueName`). Every test creates its own uniquely named data so tests run in parallel safely. |
| `helpers/api`, `helpers/ui`, `helpers/db` | Reusable steps built on the API services, page objects and database layer. Only `helpers/db` contains SQL. |
| `config/` | Environment configuration, read from `.env` locally and from variables in CI. |
| `tests/ui` | Browser tests (Chromium project). |
| `tests/api` | API tests (no browser). |
| `tests/db` | Database tests, including a sanity check that each eShop database is reachable and readable. |

## Getting started

### Prerequisites

- Node.js 26 LTS (see `.nvmrc`)
- pnpm (`npm install -g pnpm`)
- .NET 11 SDK (eShop's `global.json` requires 11.0.100 or later)
- Docker Desktop, running

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

### Stop eShop

The AppHost runs eShop's .NET services as local processes and its infrastructure (PostgreSQL,
Redis, RabbitMQ) as containers. Press `Ctrl+C` in its terminal to stop everything it started.
PostgreSQL and RabbitMQ are persistent containers and keep running so the next start is faster;
stop them in Docker Desktop to free memory. Stop them, don't delete them: deleting the PostgreSQL
container or its volume removes the data. To start again, run the AppHost; it starts the
containers itself.

### Database

eShop stores its data in PostgreSQL, in the databases `catalogdb`, `identitydb`, `orderingdb`
and `webhooksdb`. Table names are capitalized, so quote them in SQL (`select * from "Catalog"`).

```bash
# Container name, host port and password
docker ps --filter name=postgres --format "{{.Names}}"
docker port <container> 5432
docker exec <container> printenv POSTGRES_PASSWORD

# SQL prompt inside the container
docker exec -it <container> sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -d catalogdb'
```

From a GUI client (for example Microsoft's PostgreSQL extension for VS Code), connect to
`127.0.0.1` on the host port above as user `postgres`, with SSL disabled.

The database tests read the same values from `.env`: set `DB_PORT` to the host port and
`DB_PASSWORD` to the password. Both change if the PostgreSQL container is recreated.

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
pnpm test:db         # database tests
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
