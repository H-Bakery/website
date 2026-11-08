# bakery-shop (Online-Shop)

Transactions only — browse, cart, checkout, order (port 4200). Marketing, opening hours, contact and
phone/WhatsApp ordering belong to `bakery-landing`; do not rebuild them here. Not a pilot screen;
talks to the real API, which serves the catalogue anonymously only with `PUBLIC_CATALOGUE=1`.
Ordering is closed until a public order path is decided (`POST /api/orders` is behind login; the
checkout says so). The app is a shell — page bodies live in `libs/bakery-shop/feature-{catalog,cart}`,
and no page renders its own Header/Footer.

Rules that bite hardest:

- **One product source:** only `fetchShopProducts()` / `fetchShopProduct()` etc. from
  `@bakery/shared/data-access`. Never `bakeryAPI` or `mocks/products.ts` (split-brain catalog bug).
- **Money:** `hq` prices are gross. Cart runs with `taxRate: 0`, totals via `grossTotal()`, every
  price via `formatEuro`, unit after „pro" via `productUnit()` („Stück" = slice). The server re-prices
  orders (`shop-orders.core.js`); keep `useFreshCartPrices()` and the `?preis=aktualisiert` notice.
  Submit order: await API → `clearCart()` → redirect.
- **No promise without a basis:** the confirmation says „Danke" only for a code placed in this tab;
  order ids in URLs are never sequential numbers.
- **Allergens are positive-only:** say what is contained, never „frei von"/„glutenfrei".
  `allergens: null` = not declared, never `[]`.
- **Nothing invented to sell** (no stock counts, countdowns, fake reviews — UWG). Pickup status and
  checkout slots share `pickup.ts`; never inline an hours literal.
- **data-testid contract:** the E2E suite depends on the ids listed in the docs; don't rename, and
  never add a second `product-grid` or `category-<key>` outside the catalog filter.

No `lint` target — lint explicitly (see docs). Details, contract list, commands:
[`docs/apps/shop.md`](../../docs/apps/shop.md).
