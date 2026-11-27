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

When sources disagree, the stronger one states the row and the disagreement goes in `sourceNote`
("OpenAPI documents 400; the handler returns 500").
