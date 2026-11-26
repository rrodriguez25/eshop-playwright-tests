# Where a screen's source lives in eShop

Paths are relative to `C:\GitHub\eShop\src`. The clone is read-only.

| Looking for | Where | How to find it |
| --- | --- | --- |
| The screen for a route | `WebApp/Components/Pages/<Area>/*.razor` | `grep -rn '@page' WebApp/Components/Pages` |
| Components a page uses | `WebApp/Components/` and `WebAppComponents/` | Tags in the page (`<CatalogSearch>`) → `find -name 'CatalogSearch.razor'` |
| The page heading and subtitle | `WebApp/Components/Layout/HeaderBar.razor` | Pages fill them with `<SectionContent SectionName="page-header-title">` |
| Header, footer, layout | `WebApp/Components/Layout/` (`MainLayout`, `HeaderBar`, `UserMenu`, `CartMenu`, `FooterBar`) | Already mapped: `pages/components/header-bar.ts` |
| Behavior added by scripts (sorting, zoom, quantity steppers, chat) | `WebApp/wwwroot/js/*.js` | Grep the page's `data-*` attributes in `wwwroot/js` |
| How a panel or menu opens without a script | `<Component>.razor.css` next to the component | Look for `:hover`, `:focus-within`, `[open]` |
| Auth-dependent markup | `<AuthorizeView>` in the component; `HttpContext.User` checks in `@code` | |
| Login page | `Identity.API` (a separate app on its own port, not the web app) | `Identity.API/Views/Account/` |
| Seeded users | `Identity.API/UsersSeed.cs` | |
| Seeded catalog | `Catalog.API/Setup/catalog.json` | The live API is quicker: `GET /api/catalog/items` |
| Route parameters and query parameters | `@page "/item/{itemId:int}"`; `[SupplyParameterFromQuery]` properties in `@code` | |
