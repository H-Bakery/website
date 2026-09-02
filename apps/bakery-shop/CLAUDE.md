# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Scope: the `bakery-shop` app — the bakery's **online store** (Next.js SSR → Vercel). The workspace
layout, the `hq/` content source and the monorepo-wide rules live in `../../../CLAUDE.md` and
`../../CLAUDE.md`; read those first. This file covers only what is specific to the shop.

**The shop is not the website.** `apps/bakery-landing` owns all marketing: brand story, news, about,
contact, the map, opening hours, legal pages, and the phone/WhatsApp ordering explainer. The shop
owns transactions only — browse, cart, checkout, order. Do not rebuild marketing content here, and
do not add a WhatsApp or phone ordering path: that was deliberately removed (2026-08-30) in favour
of real order submission.

## Commands

Run from `website/` (not from this directory).

```bash
npm run serve:api:simple              # REQUIRED — the shop is useless without it (port 5000)
npm run serve:shop                    # dev server → http://localhost:4200
npx nx build bakery-shop              # → dist/apps/bakery-shop
npx nx test bakery-shop               # jest, jsdom
npx nx test bakery-shop -- -t "cart"  # single test case
npm run test:e2e:shop                 # Playwright (starts both servers itself)
```

Also run when you touch the shop's libs: `npx nx test feature-catalog`, `npx nx test feature-cart`,
`npx nx test shared-data-access` (note the Nx name is `shared-data-access`, not `data-access`).

`bakery-shop` and its feature libs have **no `lint` target** and no own `.eslintrc.json`. The root
config carries `ignorePatterns: ["**/*"]` (Nx convention — each project un-ignores itself), so
`npx eslint apps/bakery-shop/src` answers _all files ignored_ and `npm run lint:all` never sees
these files. Lint them explicitly:

```bash
npx eslint --no-ignore $(git ls-files 'apps/bakery-shop/src/**/*.ts*' 'libs/bakery-shop/**/*.ts*')
```

That run reports one known error: `@nx/enforce-module-boundaries` flags a **circular dependency
`feature-cart` ↔ `feature-catalog`** (`ShopPrice` lives in catalog; `pickup.ts`/`lead-time.ts` in
cart, and each imports the other). Harmless at runtime and invisible to CI, but real — untangling
it means moving `ShopPrice`, or the pickup/lead-time helpers, into a lib both can import.

## Architecture

The app is a **shell**: chrome + thin routes. All page bodies live in feature libs.

`layout.tsx` nests `ThemeRegistry > RootProvider(cart={{taxRate: 0}}) > ShopHeader > main > ShopFooter`.
Because the layout owns the chrome, **no page component may render a Header or Footer**.

| Route              | Renders             | From                           |
| ------------------ | ------------------- | ------------------------------ |
| `/`                | `StorefrontHome`    | `@bakery/shop/feature-catalog` |
| `/products`        | `CatalogPage`       | `@bakery/shop/feature-catalog` |
| `/products/[pid]`  | `ProductDetailPage` | `@bakery/shop/feature-catalog` |
| `/cart`            | `CartPage`          | `@bakery/shop/feature-cart`    |
| `/kasse`           | `CheckoutPage`      | `@bakery/shop/feature-cart`    |
| `/bestellung/[id]` | `OrderConfirmation` | `@bakery/shop/feature-cart`    |
| `/bestellen`       | 308 → `/kasse`      | —                              |

App-local: `src/theme/` (the brand theme), `src/components/shop-header.tsx`,
`src/components/shop-footer.tsx`. Everything else belongs in `libs/bakery-shop/feature-*`.

### One product source of truth

All product data comes from the API via `@bakery/shared/data-access`:
`fetchShopProducts()`, `fetchShopProduct(idOrNumericId)`, `toCartProduct(p)`, `formatEuro(n)`
(`lib/services/shop-products.ts`), and `submitOrder()`, `buildOrderItems()`, `fetchShopOrder()`
(`lib/services/shop-orders.ts`).

**Never import `bakeryAPI` or `mocks/products.ts` in the shop.** That 10-product mock is what caused
the old split-brain bug where the catalog listed "Bauernbrot" and clicking it opened "Kornbrot 500g".
It still exists for other apps; the shop must not touch it.

`fetchShopProduct` accepts **either** the slug (`kornbrot-500g`) or the numeric id (`1`) because both
appear in URLs. Product cards link by slug. `ShopProduct` keeps `shortDescription` (teaser) and
`description` (long body) as distinct fields — collapsing them previously destroyed product copy.

### Money

Prices in `hq` are **gross** (German retail, inkl. MwSt.). The layout therefore mounts `CartProvider`
with `taxRate: 0`, and `grossTotal()` in `feature-cart/src/lib/order-totals.ts` derives the total from
`subtotal - discount` rather than `summary.total`, so a misconfigured provider can never add 19% on
top of prices that already include it. Never display a separate added-tax line — "inkl. MwSt." is the
correct note. Format every price with `formatEuro`.

The word after „pro" comes from `productUnit({ name, category })` in
`libs/shared/data-access/.../product-unit.ts` — card, detail page and cart (`toCartProduct` sets
`unit`) all ask that one function. In this bakery **„Stück" means a slice**: „Apfelkuchen (1 Stück)"
is 1,80 €, the whole „Apfelkuchen" 18 €. So whole items say „pro Kuchen" / „pro Torte" / „pro Rolle",
and the rules apply only inside `kuchen`/`torten` — a „Butterkuchen" from the Teilchen stays „pro
Stück", as do Zopf, Rosinenbrot, Obstboden and Tortenboden. Do not hardcode „pro Stück" in a
component again.

### Ordering

`CheckoutPage` POSTs through `submitOrder()` to `/api/orders`; the management admin reads the same
list, so a shop order shows up there. Order of operations in the submit handler is deliberate:
**await the API call, then `clearCart()`, then redirect.** Clearing earlier loses the customer's
basket when the request fails. Pickup slots come from `feature-cart/src/lib/pickup.ts` (Monday is
Ruhetag and is rejected; same-day pickup needs 60 min lead time). The checkout **re-reads the clock
on submit** (`readClientNow()`) and validates against _those_ slots — a page left open for an hour
must not be able to book a slot that has meanwhile passed; a passed slot inside the opening window
is reported as „nicht mehr möglich“, not as „nicht geöffnet“.

The mock server does not trust the body. `POST /api/orders` runs it through
`apps/bakery-api/src/services/shop-orders.core.js` (dependency-free CommonJS, same convention as
`partner-stats.core.js`, tests in `apps/bakery-api/tests/unit/shopOrders.test.js`): only the known
fields are kept, every `productId` (slug or numeric id) is resolved against `hq` and **price and
name are taken from there**, `total` is recomputed, unknown or unavailable products and past dates
(today in Europe/Berlin — the server runs in UTC) are rejected, and the answer is `400` with a
German `message`, which `submitOrder()` surfaces in `checkout-error`. Opening hours and the Ruhetag
are deliberately _not_ checked server-side: that would be a third copy of the hours table.

**Der Warenkorb ist eine Momentaufnahme, der Server bepreist neu.** `CartProvider` legt jede
Zeile mit Preis und Name im `localStorage` ab und lässt sie dort, bis die Kundschaft den Korb
leert - eine spätere Preisänderung in `hq` stand dann an der Kasse nicht, wohl aber auf der
Bestätigung, ohne ein Wort dazu. Zwei Dinge fangen das ab; keines davon wegoptimieren:

- `useFreshCartPrices()` (`feature-cart/src/lib/use-fresh-cart-prices.ts`) holt beim Öffnen von
  `/cart` und `/kasse` **einmal** `GET /api/products` und schreibt die Zeilen über
  `CartContext.refreshItems()` nach (Preis, Name, Verfügbarkeit - Menge und Notiz bleiben). Hat sich
  ein Preis geändert, zeigen beide Seiten `cart-prices-updated` / `checkout-prices-updated`.
  Ohne API bleibt es bei der Momentaufnahme.
- Die Kasse vergleicht die vom Server zurückgegebene `total` mit dem Betrag, der auf der Seite
  stand (`confirmationPath()` in `confirmation-link.ts`). Weicht er ab - Preisänderung zwischen
  Öffnen und Absenden, oder die API war beim Abgleich nicht da -, hängt sie `?preis=aktualisiert`
  an den Bestätigungslink, und `OrderConfirmation` sagt es über dem Gesamtbetrag
  (`order-price-updated`). Die Bestätigung zeigt immer den **gebuchten** Betrag.

### data-testid contract

The Playwright suite in `apps/bakery-shop-e2e` drives these; renaming one breaks tests:
`shop-header`, `shop-search-input`, `cart-badge`, `cart-link`; `product-grid`, `product-card`,
`product-card-name`, `product-card-price`, `add-to-cart`, `category-filter`, `category-<key>`,
`category-all`, `catalog-empty`, `catalog-search-input`, `home-search-input`, `category-tiles`,
`home-rail-breakfast`, `home-rail-coffee`, `pickup-status`, `bundle-offers`, `bundle-card`,
`bundle-add`, `social-proof`; `product-detail`,
`product-detail-name`, `product-detail-price`, `detail-add-to-cart`, `quantity-input`,
`quantity-increase`, `quantity-decrease`, `product-not-found`; `cart-page`, `cart-empty`,
`cart-item`, `cart-item-name`, `cart-item-quantity`, `cart-increase`, `cart-decrease`, `cart-remove`,
`cart-total`, `cart-checkout`; `checkout-page`, `customer-name`, `customer-phone`, `customer-email`,
`pickup-date`, `pickup-time`, `order-notes`, `submit-order`, `checkout-error`; `order-confirmation`,
`order-number`. Neu: `product-allergens`, `product-allergen-list`,
`product-allergens-unknown`, `product-unit-price`, `product-card-unit-price`, `product-lead-time`,
`related-products`, `related-product-grid`, `catalog-approximate`, `cart-prices-updated`,
`checkout-prices-updated`, `order-price-updated`.

Der „Passt dazu"-Bereich benutzt bewusst **nicht** `product-grid`: die e2e-Hilfe scopet
`product-card` darin, eine dritte Instanz bräche den Strict Mode.

Three traps:

- `cart-item-quantity` is a **text node**, not an input — assert text, don't `fill()`.
- `product-grid` appears on both `StorefrontHome` and `CatalogPage`, so scope locators. On the home
  page it marks **exactly one** grid (the big cross-section rail); the themed rails carry
  `home-rail-*` instead, precisely so `getByTestId('product-grid')` stays unambiguous there. A new
  home rail must get its own id, never a second `product-grid`.
- `/products?category=…` links appear in the header nav, the category tiles _and_ the themed rails,
  so count tiles inside `category-tiles`, never across `main`. The header strip uses
  `shop-category-nav` and deliberately does _not_ carry `category-<key>` ids — those belong solely to
  the catalog filter, or Playwright strict mode breaks.

## Die Startseite verkauft — mit Belegen

`StorefrontHome` ist nach Konversion sortiert, nicht nach Erzählung:

> Hero (Foto + Abholstatus) → drei Zusagen → **fertige Tüten** → Kategorien →
> Auslage → Themenreihen → Bewertungen → Abholweg

Vier Dinge daran sind absichtlich so und sollten so bleiben:

- **Fotos sind der Hebel, nicht die Headline.** Für Backwaren schlägt Bild jede Copy, deshalb
  liegen echte Aufnahmen der Bäckerei (aus `bakery-landing`, WebP + JPEG in 400/800 px) unter
  `public/assets/images/bakery/` und werden über `BakeryPhoto` mit `sizes` ausgeliefert — ohne
  `sizes` lädt der Browser immer die größte Variante.
  Ein `alt` muss **beschreiben, was wirklich im Bild ist**: die Datei `traditional-pretzels`
  zeigt keine Brezeln, und `homemade-cakes` zeigt eine _Torte_ — sie hängt darum unter „Torten“,
  nicht unter dem größeren „Kuchen“.
- **Nichts wird erfunden, um zu verkaufen.** Kein „nur noch 3 übrig“, kein Countdown, keine
  Rabatt-Behauptung, keine ausgedachten Stimmen. Es gibt keine Bestandsdaten, und § 5 UWG
  (für Bewertungen § 5b Abs. 3) macht so etwas zum Rechtsrisiko. Ein e2e-Test prüft, dass auf
  `/` keine solche Formulierung auftaucht.
- **Der einzige ehrliche Dringlichkeitshebel ist die Zeit.** `pickupStatusAt()` in
  `feature-cart/src/lib/pickup.ts` rechnet „geöffnet / nächste Abholung“ aus demselben
  `WEEKDAY_HOURS`-Raster **und** derselben `pickupTimeSlots()`-Funktion, aus der die Kasse ihre
  Auswahl baut — die Startseite kann also keinen Termin versprechen, den die Kasse ablehnt.
  Ein Test sichert genau das ab. Gelesen wird die Uhrzeit im Effect, nie im Render (Hydration).
- **Die Tüten sind kuratiert, nicht geraten.** Jede Zeile in `bundle-offers.tsx` nennt einen
  `prefer`-Slug _und_ eine Kategorie als Fallback. Ohne `prefer` griff die Auflösung zum ersten
  Produkt der Kategorie — in `kuchen` ist das ein **ganzer** Rahmkuchen für 18 €, und die
  „Kaffeetafel“ kostete 44 €. Lässt sich eine Zeile nicht füllen, entfällt die ganze Tüte;
  eine halbe Zusammenstellung hätte einen Preis, der nicht zum Titel passt.

Belegte Marken- und Bewertungsdaten stehen in `libs/shared/utils/src/lib/brand.ts`, jede Zahl mit
Quelle. **`REVIEW_SUMMARY` (4,5 ★ / 134) ist ein Momentwert von 2025** aus der Strategieakte in
`hq/` — vor einem Livegang neu auszählen und `asOf` mitziehen. Die Rezensionen liegen zusätzlich
noch in `apps/bakery-landing/src/mocks/testimonials`; die Landingpage sollte sie später von hier
beziehen.

## Pflichtangaben: Allergene, Grundpreis, Vorbestellfrist

Drei Dinge, die ein Lebensmittel-Shop rechtlich und moralisch schuldet. Alle drei haben genau eine
Implementierung; wer sie anfasst, muss diesen Abschnitt gelesen haben.

### Allergene — nur positive Aussagen

**Die Regel, von der alles andere abhängt: Der Shop sagt ausschließlich, was _enthalten_ ist.
Niemals, was _nicht_ enthalten ist.** Eine falsche „enthält"-Angabe ist ein Ärgernis. Eine falsche
„frei von"-Angabe bringt jemanden ins Krankenhaus. Deshalb gibt es kein „glutenfrei", kein
„laktosefrei", kein „frei von" — und ein Produkt ohne Angabe wird nie so dargestellt, als sei es
unbedenklich.

- Datenquelle ist `hq/products/*.md` mit `allergens`, `allergens_source` (`rezept` | `geprueft`)
  und `allergen_recipe`. Erzeugt von `tools/allergens/derive-allergens.mjs` aus den echten Rezepten
  in `hq/data/recipes/` plus der Allergen-Zuordnung in
  `hq/data/inventory/ingredients/ingredient-database.yaml`. Idempotent, schreibt nur mit `--write`.
- **52 von 103 Produkten sind deklariert. 51 sind es absichtlich nicht** — alle Kuchen, Teilchen
  und Torten. Für sie gibt es kein Rezept, also wird nichts geraten. Sie zeigen
  `NO_DECLARATION_NOTE` mit der Telefonnummer (LMIDV § 4).
- `ShopProduct.allergens`: **`null` heißt „nicht deklariert", `[]` hieße „enthält keines der 14
  Allergene"**. Die beiden dürfen nie zusammenfallen. `readAllergenDeclaration()` gibt darum `null`
  zurück und nie ein leeres Array.
- `formatAllergens()` nimmt `readonly string[]`, nicht `AllergenKey[]`: ein später in `hq`
  ergänzter, hier unbekannter Schlüssel wird **durchgereicht, nie verschluckt**.
- Nicht wegoptimieren: `Hafermehl (glutenfrei)` ergibt trotzdem Gluten — „glutenfrei" ist ein
  Stoppwort, das ein Allergen nie _entfernen_ kann. `Buchweizen` ergibt nie Weizen, `Muskatnuss`
  nie eine Nuss.
- Warum manche Rezepte bewusst _nicht_ ausgewertet werden: `recipes/cakes/Käsekuchen.md` ist ein
  Bauteil-Blatt (Quark, Ei, Sahne — **ohne Mürbeteig**). Daraus abgeleitet stünde „enthält Ei,
  Milch" auf einem Gebäck, das in Wahrheit ein Glutenprodukt ist. Genau der Fall, den es zu
  verhindern gilt.

### Grundpreis (§ 4 PAngV)

`unitPriceLabel({name, price})` in `libs/shared/data-access/.../unit-price.ts`. 25 Artikel tragen
ihr Gewicht im Namen; ohne Grundpreis sind 2,50 €/500 g und 4,40 €/1000 g nicht vergleichbar — der
Zweck der Norm. Unter 250 g Nennfüllmenge wird auf 100 g bezogen. Kein Gewicht im Namen ⇒ `null`
⇒ es wird nichts angezeigt und nichts erfunden. Der Grundpreis steht überall, wo der Endpreis
steht: Produktkarte (`product-card-unit-price`, an der Stelle von „pro Stück"), Detailseite,
Warenkorbzeile und Tüten.

### Vorbestellfrist

`libs/bakery-shop/feature-cart/src/lib/lead-time.ts`. Ganze Torten 48 h, ganze Kuchen 24 h,
Thekenware nichts. Portionsartikel werden an der ID erkannt (`…-1-stueck`, `…-1-4-stueck`) —
bewusst nicht am Preis, der bei der nächsten Preisänderung still kippen würde. Im Warenkorb gewinnt
der längste Vorlauf.

**Die Stundenwerte sind ein Vorschlag und von der Bäckerei zu bestätigen.** Der Mechanismus ist
richtig — eine 45-€-Torte zur Abholung in 60 Minuten kann keine Backstube liefern —, die Zahlen
sind gesetzt, nicht erhoben. Sie stehen in genau einer Tabelle in `lead-time.ts`.

## Bestellungen sind nicht aufzählbar

Bestell-IDs waren fortlaufend (`1`, `2`, `3`), und `GET /api/orders/:id` ist unauthentifiziert —
wer `/bestellung/2` aufrief, las Name, Telefonnummer und Abholzeit fremder Kundschaft (IDOR,
Art. 32 DSGVO). Die ID ist jetzt ein zufälliger Code aus Crockford-Base32 (`8QMZ-QXS5-HM0W`,
60 Bit, ohne I/L/O/U, damit er am Telefon vorlesbar bleibt). Die fortlaufende Nummer lebt als
`orderNumber` weiter — intern, nie in der URL. `createOrderId()` in `simple-server.js`.

Offen und bewusst nicht angefasst: `GET /api/orders` (die Liste) gibt weiterhin alle Bestellungen
inklusive Telefonnummern ohne Authentifizierung heraus. Daran hängt die Verwaltungs-App; das gehört
in die echte API mit echter Rollenprüfung, nicht in den Mock-Server.

`apps/bakery-shop-e2e/src/shop-safety.spec.ts` sichert die drei Zusagen dieses Abschnitts ab.

## Voice

German, **Sie**-Form (the landing app sets that; don't switch to _du_ in one app). Beyond that the
shop deliberately does _not_ sound like a trade catalogue — a 2026-08-30 pass removed the
wholesale-register nouns. Keep them out:

| Don't                                            | Do                                                  |
| ------------------------------------------------ | --------------------------------------------------- |
| Warengruppe, Sortiment, Auslage, Ware            | Kategorie, Theke, Backstube, or just name the thing |
| "Ihre Kontaktdaten", "Abholung" as form headings | "Wer holt ab?", "Wann passt es Ihnen?"              |
| "Dazu haben wir nichts im Regal"                 | "Dazu ist die Theke leer"                           |

Short sentences, concrete nouns, sensory where it is _true_ — never a claim the data can't back.
Two live examples of that rule: the hero's search placeholder names products that actually exist in
`hq` (it said "Bauernbrot", of which there are zero), and the `QUICK_SEARCHES` chips are checked to
return hits. The rail heading only says "Gerade in der Saison" when a seasonal product is really in
it.

## Theme

`src/theme/theme.ts` exports `shopTheme`; `src/theme/ThemeRegistry.tsx` wraps
`AppRouterCacheProvider > ThemeProvider > CssBaseline`. It mirrors the landing brand palette
(primary `#5A2E2A`, secondary `#d038ba`, cream `#FFF3E6`, warm grey 50–900) with Cinzel headings and
Merriweather body, then diverges toward store density. It is **light-only**, like the landing app.

- **Use palette keys, never hex literals**, in components. Everything you need is defined —
  including `divider`, `action.hover/selected/focus`.
- `palette.grey` is a **warm** scale here, not neutral grey.
- Fonts are **self-hosted** woff2 in `public/fonts/` via `src/app/fonts.css`. Do not add
  `fonts.googleapis.com` links back — that was a DSGVO regression the shop used to carry.
- Do not use `EnhancedProductCard` from `@bakery/shared/ui`: it has `Math.random()` in its default
  parameters (fake ratings and badges, guaranteed hydration mismatch). The shop has its own card in
  `feature-catalog`.

## Known state

- `nx build bakery-shop` passes. `nx test bakery-shop` passes (73 tests); feature-cart 130,
  feature-catalog 95, shared-data-access 74, shared-utils 43; the order validation of the mock
  server has 41 more in `apps/bakery-api/tests/unit/shopOrders.test.js` (run with
  `npx jest -c apps/bakery-api/jest.config.js --rootDir apps/bakery-api tests/unit/shopOrders.test.js`).
- The allergen frontmatter (`allergens`, `allergens_source`, `allergen_recipe`) that the shop
  renders lives in **`hq/products/*.md`** — a different repo. It is produced by
  `tools/allergens/derive-allergens.mjs --write` and must be committed in `hq` separately; without
  it every product shows `NO_DECLARATION_NOTE`.
- **43 of the 103 `hq` products have the junk frontmatter value `image: "images/"`**, so ~40% of
  cards render the warm placeholder instead of a picture. `ProductImage` deliberately never requests
  an unusable path. The real fix is content-side in `hq/products/*.md`, not here.
- The `hq` data currently contains **zero** seasonal and **zero** unavailable products, so the
  "Saisonal" chip, the "Zur Zeit nicht verfügbar" state and the disabled add button are defensive
  paths exercised only by unit tests.
- Orders are stored **in memory** by `simple-server.js` and are lost when the API restarts.
  `OrderConfirmation` therefore degrades to a friendly confirmation with just the order number when
  `GET /api/orders/:id` misses.
- Opening hours: `apps/bakery-landing/src/config/openingHours.ts` is the source of truth, mirrored
  into `libs/shared/ui/.../footer-openings.tsx` and into `feature-cart/src/lib/pickup.ts` because an
  Nx lib may not import from an app. **Inside the shop there is only the `pickup.ts` copy** — the
  footer renders `OPENING_HOURS_ROWS`, which `pickup.ts` _derives_ from the same `WEEKDAY_HOURS`
  table the checkout uses for its slots, so a displayed hour can never disagree with a bookable
  one. The storefront shows the live `pickupStatusAt()` line instead of a week table. Do not
  re-inline an hours literal in a component.
- `libs/shared/utils` `contactConfig` still carries a wrong address (Hauptstraße 123, München). The
  shop footer hardcodes the correct Homburg address instead.
- Only **Chromium** Playwright browsers are installed on this machine; the e2e config is scoped to
  `chromium` + a Pixel 5 `mobile` project for that reason.
