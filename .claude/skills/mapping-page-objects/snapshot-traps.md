# Snapshot traps

What eShop's accessibility snapshot hides or shows misleadingly, and how to locate the element
anyway. Check each state's snapshot against this list. Each entry is a case seen in eShop.

| Trap | Example in eShop | Locate with |
| --- | --- | --- |
| **`aria-*` on an element with no role is dropped.** `aria-current`, `aria-disabled` on a `<span>` don't appear. | Current page number in the catalog pagination: `generic "5"`, no `[current]` | Scoped attribute selector (`pagination.locator('[aria-current="page"]')`) with a comment |
| **Accessible names include live data.** | Filter options "AirStrider 2" (count changes with selection); sort combobox "Sort Name: A to Z" (changes with the choice) | Anchored regex from the escaped label: `^AirStrider \d+$`, `^Sort ` |
| **Composite names on cards.** A link's name joins image alt, brand, name and price. | "Adventurer GPS Watch Solstix Adventurer GPS Watch $199.99" | `links.filter({ has: page.getByText(name, { exact: true }) })` |
| **Names that aren't unique in the data.** | "Apex Climbing Harness" from two brands | Add a second filter (brand) as an optional argument |
| **The same name in two regions with no role.** | "All" in both filter groups; "Clear all filters" in the panel and the empty state | Scope by the nearest landmark, else a class plus `filter({ has: heading })`, with a comment |
| **State shown only by a CSS class.** | Active filter option (`active` class) | Assert something observable instead: the URL query or a count badge ("Filters 2") |
| **Disabled as `aria-disabled` on a link.** | Filter options with count 0 show `[disabled]` | `toBeDisabled()` works on these |
| **A disabled control replaced by plain text.** | "Prev" on page 1 and "Next" on the last page are spans, not links | Assert the link is hidden |
| **Closed `<dialog>` is absent.** | Item image lightbox | Open it first, then read its name ("Enlarged image of …") |
| **Menus revealed by CSS `:hover` / `:focus-within`.** No script, no `aria-expanded`. | Account menu in the header | Click (focus) the trigger, then use the items; check the component's `.razor.css` |
| **`<summary>` has no role.** It shows as `generic "Filters"`. | Filters panel toggle | `group.locator('summary')` with a comment |
| **Transient states.** Streaming placeholders render before data arrives. | Catalog loading skeleton, `role="status"` "Loading products" | Map from source, mark Unverified |
| **Navigation errors instead of a page.** A 4xx with an empty body fails in Chromium with `net::ERR_HTTP_RESPONSE_CODE_FAILURE`. | `/item/999999` returns 404 with no body, so the not-found branch never renders | Confirm with `curl`, mark Unverified, report as a suspected eShop bug |
