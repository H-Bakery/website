# E2E-Werkzeug (Playwright)

Gemeinsame Teile der drei Playwright-Suiten `apps/bakery-shop-e2e`,
`apps/bakery-management-e2e` und `apps/bakery-landing-e2e`.

| Datei             | Zweck                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `servers.js`      | Die `webServer`-Einträge der Suiten: echte API, Mock-API, `next start` bzw. `nx serve`, Export     |
| `real-api.js`     | Startet das API-Bundle mit frischer SQLite-Datenbank im Temp-Verzeichnis (Management-Suite, F4)    |
| `serve-static.js` | Liefert `apps/bakery-landing/out` aus wie GitHub Pages (`/about` → `about.html`, 404 → `404.html`) |
| `hq-products/`    | Synthetischer Produktkatalog im Format von `hq/products/*.md` (56 Produkte, 7 Kategorien)          |

## Welche API

- **Management** (seit F4): die **echte API** - das esbuild-Bundle
  `dist/apps/bakery-api/bundle/main.js`, gestartet von `real-api.js` mit einer
  frischen SQLite-Datenbank (`mkdtemp`, beim Beenden gelöscht),
  `NODE_ENV=development` und dem Inhaber `E2E_ADMIN` aus `servers.js`
  (`BOOTSTRAP_ADMIN_*`, synthetisch). App und API lesen dasselbe synthetische
  `hq` aus `prepareE2eHq()`: eine Kopie des Fixture-Katalogs plus erfundene
  Kassenberichte und Finanzdaten aus
  `apps/bakery-api/tests/fixtures/hq-data.synthetic.js`, im Temp-Verzeichnis je
  API-Port. Die App läuft im Pilotbetrieb und reicht `/api/*` über ihren
  `src/proxy.ts` an `API_URL` weiter - der Browser spricht nur die eigene Origin.
  `src/global-setup.ts` meldet einmal vor allen Tests drei Sitzungen an
  (Inhaber, Verkauf, Inhaber an einer PIN-Station) und gibt sie über
  `E2E_SESSIONS` an die Worker; je Worker anzumelden ließe das Login-Limit der
  API (zählt gleichzeitige Anfragen mit) mit 429 zuschlagen.
- **Shop**: weiter die Mock-API `apps/bakery-api/simple-server.js` - die echte
  API verlangt für jede `/api`-Route eine Sitzung, ein öffentlicher Bestellweg
  ist noch nicht entschieden.

## Zwei Betriebsarten

**Entwicklung** (Standard): `npx nx e2e bakery-shop-e2e` startet `nx serve` und
übernimmt laufende Server (`reuseExistingServer`). Wer die Mock-API schon auf 5000
laufen hat, testet gegen deren Daten - in der Regel das echte `hq`. Startet
Playwright die Server selbst, bekommen Dev-Server und Mock-API **dasselbe**
Produktverzeichnis (`productsDir()` in `servers.js`): `HQ_PRODUCTS_DIR` aus der
Umgebung, sonst `../hq/products`, und nur wenn es das nicht gibt, das Fixture.
Die Suiten vergleichen die Oberfläche mit `GET /api/products`; sähe die API
das Fixture (56) und die App das echte `hq` (103), wäre die Suite rot. Die
Management-Suite baut in Entwicklung das API-Bundle vor dem Start neu
(`E2E_API_BUILD=1`), damit nicht gegen ein altes getestet wird. Läuft auf ihrem
API-Port schon ein anderer Server, übernimmt Playwright ihn ebenfalls; ist es
der Mock (`serve:api:simple`), bricht `global-setup.ts` mit einer deutschen
Meldung ab (`/health` ohne `database: 'ok'`) - den Mock dann beenden.

**Gebaut** (`CI=true`, alternativ `E2E_BUILT=1`): die Suite startet ihre Server
selbst - `next start dist/apps/<app>` (Landing: der statische Export hinter
`serve-static.js`) und die API auf `tools/e2e/hq-products` (Shop: Mock-API,
Management: echte API, deren Bundle vorher gebaut sein muss - `real-api.js`
baut es sonst selbst). So läuft `.github/workflows/ci.yml`: ohne das private
`hq`-Repo, ohne vorhandene Datenbank, nur Chromium.

Ports kommen aus `BASE_URL` und `API_URL`, damit mehrere Läufe nebeneinander
Platz haben. Ein Lauf wie in CI, aber auf eigenen Ports:

```bash
# Shop: Build kennt die API-Adresse (NEXT_PUBLIC_API_URL wird eingebacken)
NX_ISOLATE_PLUGINS=false NODE_ENV=production NEXT_PUBLIC_API_URL=http://localhost:5280 \
  npx nx build bakery-shop --configuration=production
CI=true BASE_URL=http://localhost:4381 API_URL=http://localhost:5280 npx nx e2e bakery-shop-e2e

# Management: Pilotbetrieb wird eingebacken; die API-Adresse liest src/proxy.ts
# erst beim Start (API_URL) - der Build braucht sie nicht.
NX_ISOLATE_PLUGINS=false NODE_ENV=production NEXT_PUBLIC_PILOT_MODE=1 \
  npx nx build bakery-management --configuration=production
npx nx run bakery-api:bundle
CI=true BASE_URL=http://localhost:4382 API_URL=http://localhost:5281 npx nx e2e bakery-management-e2e

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

Die Management-Suite **speichert nie**. Sie liest ohnehin nur eine Kopie
(`prepareE2eHq()`), sodass ein Speichern das Fixture im Repo nicht ändern
würde - geprüft wird das Speichern in den Unit-Specs und in der Parity-Suite
der API (`apps/bakery-api/tests/parity/hqProducts.parity.test.ts`).
