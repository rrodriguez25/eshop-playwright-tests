# Requirement evidence in eShop

There's no ticket tracker connected, so requirements come from eShop itself. Use the strongest
source a behaviour has, cite it in `sourceNote`, and pick `source` to match. Paths are relative to
`C:\GitHub\eShop`.

| Evidence | Where | Use it for | `source` |
| --- | --- | --- | --- |
| eShop's own tests | `tests/<Service>.UnitTests`, `tests/<Service>.FunctionalTests` (Basket, Catalog, Ordering, Webhooks) | The behaviour eShop's authors pinned down: refusals, events, persistence | `business-rule` |
| OpenAPI documents | `api/generated/*.openapi.json` in this repo (saved by `pnpm generate:api-types`) | An endpoint's documented statuses and bodies; a documented 400 that comes back 500 is a suspect | `business-rule` |
| Validation rules | Models with `IValidatableObject` or data annotations (`src/Basket.API/Model`); command validators (`src/Ordering.API/Application/Validations`) | What input is refused, and with what limits | `business-rule` |
| Domain model | `src/Ordering.Domain/AggregatesModel` (`Order.cs`, `OrderStatus.cs`) | Allowed state transitions; a transition the model forbids is an error row | `business-rule` |
| Web app services | `src/WebApp/Services` (`BasketState.cs`, …) | Rules the pages rely on: what is stored, what is read live, what clears what | `business-rule` |
| Pages and scripts | `src/WebApp/Components/Pages`, `src/WebApp/wwwroot/js` | What is shown, when (`@if`, `[Authorize]`), and input handling in the browser | `screen` |
| Integration events | `src/<Service>/IntegrationEvents` | Effects that arrive later through RabbitMQ (`FX` rows) | `business-rule` |
| Known bugs | `data/bugs.json` (this repo), `status: "fixed"` | Regression rows | `bug` |
| Upstream history | `dotnet/eShop` issues and fix commits on GitHub | Regression rows and intent; only with the user's OK, since it fetches from GitHub | `bug` |

Not available: a ticket tracker, and the clone's own history (it is one squashed commit).

When sources disagree, the one that states **intent** sets the row, and the disagreement goes in
`sourceNote` ("OpenAPI documents 400; the handler returns 500").
- Validators, the domain model and OpenAPI state intent. Code states what happens.
- An eShop test is strong evidence of intent when it asserts an outcome (the bag is gone, the order
  is cancelled). A test that only asserts a status code is weak: eShop's own `AddNewOrder` posts
  an order its validator refuses and expects 200, and `CancelNonExistentOrderFails` pins an
  undocumented 500. Don't let such a test turn a buggy status into a row.

## Finding a service's parts

| Service | Where |
| --- | --- |
| Web app pages, services, scripts | `src/WebApp/Components/Pages`, `src/WebApp/Services`, `src/WebApp/wwwroot/js` |
| An API's endpoints and handlers | `src/<Service>.API/Apis/*.cs`; commands, queries and validators under `src/<Service>.API/Application` |
| Ordering's rules | `src/Ordering.Domain/AggregatesModel` |
| Background processes | `src/OrderProcessor` (grace period: `GracePeriodTime` and `CheckUpdateTime` in its `appsettings.json`), `src/PaymentProcessor` (`PaymentSucceeded` in its `appsettings.json`) |
| Who reacts to an integration event | grep `AddSubscription<` across `src/` |
| Where a page or component's source lives | `.claude/skills/mapping-page-objects/eshop-sources.md` |
