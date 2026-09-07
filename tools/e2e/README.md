# E2E-Werkzeug (Playwright)

Gemeinsame Teile der drei Playwright-Suiten `apps/bakery-shop-e2e`,
`apps/bakery-management-e2e` und `apps/bakery-landing-e2e`.

| Datei             | Zweck                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `servers.js`      | Die `webServer`-Einträge der Suiten: Mock-API, `next start` bzw. `nx serve`, statischer Export     |
| `serve-static.js` | Liefert `apps/bakery-landing/out` aus wie GitHub Pages (`/about` → `about.html`, 404 → `404.html`) |
| `hq-products/`    | Synthetischer Produktkatalog im Format von `hq/products/*.md` (56 Produkte, 7 Kategorien)          |

## Zwei Betriebsarten

**Entwicklung** (Standard): `npx nx e2e bakery-shop-e2e` startet `nx serve` und
übernimmt laufende Server (`reuseExistingServer`). Wer die Mock-API schon auf 5000
laufen hat, testet gegen deren Daten - in der Regel das echte `hq`.

**Gebaut** (`CI=true`, alternativ `E2E_BUILT=1`): die Suite startet ihre Server
selbst - `next start dist/apps/<app>` (Landing: der statische Export hinter
`serve-static.js`) und die Mock-API `apps/bakery-api/simple-server.js` mit
`HQ_PRODUCTS_DIR=tools/e2e/hq-products`. So läuft `.github/workflows/ci.yml`:
ohne das private `hq`-Repo, ohne Datenbank, nur Chromium.

Ports kommen aus `BASE_URL` und `API_URL`, damit mehrere Läufe nebeneinander
Platz haben. Ein Lauf wie in CI, aber auf eigenen Ports:

```bash
# Shop: Build kennt die API-Adresse (NEXT_PUBLIC_API_URL wird eingebacken)
NX_ISOLATE_PLUGINS=false NODE_ENV=production NEXT_PUBLIC_API_URL=http://localhost:5280 \
  npx nx build bakery-shop --configuration=production
CI=true BASE_URL=http://localhost:4381 API_URL=http://localhost:5280 npx nx e2e bakery-shop-e2e

# Management: Produktliste wird beim Bauen gelesen, API-Adresse ebenfalls
NX_ISOLATE_PLUGINS=false NODE_ENV=production HQ_PRODUCTS_DIR=$PWD/tools/e2e/hq-products \
  API_URL=http://localhost:5280 NEXT_PUBLIC_API_URL=http://localhost:5280 \
  npx nx build bakery-management --configuration=production
CI=true BASE_URL=http://localhost:4382 API_URL=http://localhost:5280 npx nx e2e bakery-management-e2e

# Landing: statischer Export mit dem gebündelten Produkt-Fallback (wie auf GitHub Pages)
NX_ISOLATE_PLUGINS=false NODE_ENV=production npx nx build bakery-landing --configuration=production
CI=true BASE_URL=http://localhost:4380 npx nx e2e bakery-landing-e2e
```

`CI=true` schaltet außerdem die Playwright-Voreinstellungen von Nx um: ein Worker,
zwei Wiederholungen, `test.only` verboten.

## Der Fixture-Katalog `hq-products/`

Synthetische Produkte, die von Hand pflegbar sind wie `hq/products/*.md`:
gleiche Frontmatter-Felder (`id`, `numeric_id`, `name`, `category`, `price`,
`available`, `seasonal`, `image`, `short_description`, optional `allergens`,
`allergens_source`, `allergen_recipe`), gleicher Dateiname `{numeric_id}-{id}.md`.
Namen und Preise sind erfunden (`Musterbrot`, `Probekruste`, `Testtorte` …) - mit
drei Ausnahmen, die die Shop-Suite beim Namen nennt: `kornbrot-500g`,
`kaesekuchen-1-stueck` und `schwarzwaelder-kirsch-torte`.

Was die Suiten voraussetzen, wenn jemand den Katalog ändert:

- **Mehr als 50 Produkte** (`fetchProducts()` im Shop) und **mindestens 48**, damit
  „Mehr anzeigen“ eine zweite Seite à 24 Karten hat.
- **Alle sieben Kategorien** (`brot`, `broetchen`, `baguette`, `teilchen`, `snacks`,
  `kuchen`, `torten`), sonst fehlen Kacheln und Tüten auf der Shop-Startseite.
- `numeric_id` 1 und 2 sind Brote: die Kasse legt `products[0]` und `products[1]`
  in den Korb und bestellt für morgen - eine Torte hätte zwei Tage Vorlauf.
- `kornbrot-500g` mit `allergens` und `allergens_source: rezept`; die Torte ohne
  Allergene (undeklariert), `kaesekuchen-1-stueck` als Theken-Stück ohne Frist.
- Bildpfade zeigen auf SVGs, die in `apps/bakery-shop/public/assets/images/products`
  liegen.

Die Management-Suite **speichert nie** (`PUT /api/hq-products/:id` schriebe in
diese Dateien). Wer ein Speichern testen will, kopiert den Katalog vorher nach
`tmp/` und zeigt `HQ_PRODUCTS_DIR` dorthin.
