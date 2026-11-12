# E2E-Werkzeug (Playwright)

Gemeinsame Teile der Playwright-Suiten `apps/bakery-shop-e2e`,
`apps/bakery-management-e2e`, `apps/bakery-landing-e2e` (alle drei in CI) und
`apps/bakery-delivery-e2e` (nur lokal). Die Suite `apps/bakery-digitale-baeckerei-e2e` (in CI) nutzt
von hier nur ihren `webServer`-Eintrag (`digitaleBaeckereiApp()`) und `serve-static.js`; sie hat keine
API und ein eigenes Fixture in der App (`apps/bakery-digitale-baeckerei/src/test/fixtures/`).

| Datei             | Zweck                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `servers.js`      | Die `webServer`-Einträge der Suiten: echte API, `next start` bzw. `nx serve`, statischer Export    |
| `real-api.js`     | Startet das API-Bundle mit frischer SQLite-Datenbank im Temp-Verzeichnis (alle API-Suiten)         |
| `serve-static.js` | Liefert `apps/bakery-landing/out` aus wie GitHub Pages (`/about` → `about.html`, 404 → `404.html`) |
| `hq-products/`    | Synthetischer Produktkatalog im Format von `hq/products/*.md` (56 Produkte, 7 Kategorien)          |
| `hq-recipes/`     | Erfundene Rezepte im Format von `hq/data/recipes/**` (je Formatvariante eine Datei, 8 Kategorien)  |

## Welche API

Immer die **echte API** - den Mock-Server `simple-server.js` gibt es seit B12
nicht mehr.

- **Management** (seit F4): die **echte API** - das esbuild-Bundle
  `dist/apps/bakery-api/bundle/main.js`, gestartet von `real-api.js` mit einer
  frischen SQLite-Datenbank (`mkdtemp`, beim Beenden gelöscht),
  `NODE_ENV=development` und dem Inhaber `E2E_ADMIN` aus `servers.js`
  (`BOOTSTRAP_ADMIN_*`, synthetisch). App und API lesen dasselbe synthetische
  `hq` aus `prepareE2eHq()`: eine Kopie des Fixture-Katalogs plus erfundene
  Kassenberichte und Finanzdaten aus
  `apps/bakery-api/tests/fixtures/hq-data.synthetic.js` und die erfundenen
  Rezepte aus `hq-recipes/` (`HQ_RECIPES_DIR`; ohne `HQ_WRITE_DIR` schreibt die
  API beim Speichern direkt in diese Kopie), im Temp-Verzeichnis je
  API-Port. Die App läuft im Pilotbetrieb und reicht `/api/*` über ihren
  `src/proxy.ts` an `API_URL` weiter - der Browser spricht nur die eigene Origin.
  `src/global-setup.ts` meldet einmal vor allen Tests fünf Sitzungen an
  (Inhaber, Verkauf, Backstube, Backstubenleitung, Inhaber an einer PIN-Station) und gibt sie über
  `E2E_SESSIONS` an die Worker; je Worker eine eigene PIN zu setzen, meldete
  die Stations-Sitzungen der anderen ab. (Das Login-Limit zählt seit W4 nur
  Fehlversuche, gleichzeitige erfolgreiche Anmeldungen sind kein Problem
  mehr.)
- **Shop** (seit B12, `shopApiServer()`): dieselbe API mit
  `PUBLIC_CATALOGUE=1` - `GET /api/products` antwortet ohne Sitzung, jede
  andere `/api`-Route weiter mit 401 - und dem Shop-Origin in `CORS_ORIGIN`,
  weil der Browser die API direkt fragt. Produkte wie bei der Verwaltung aus
  `prepareE2eHq()`. **Einen öffentlichen Bestellweg gibt es nicht**
  (`POST /api/orders` braucht eine Sitzung, Owner-Entscheidung offen):
  `shop-checkout.spec.ts` prüft den Erfolgsweg der Kasse gegen einen im
  Browser nachgestellten Endpunkt (`stubOrderEndpoint()` in
  `apps/bakery-shop-e2e/src/support/shop.ts`), `shop-safety.spec.ts`, dass
  Bestellungen, hq-Verwaltung, Vorbestellungen und Partner ohne Sitzung 401
  bleiben.
- **Fahrer-App** (B12, `deliveryApiServer()`): die echte API mit dem
  App-Origin in `CORS_ORIGIN`. `apps/bakery-delivery-e2e/src/login.ts` meldet
  den E2E-Inhaber an und gibt den Specs einen `request`-Kontext mit Bearer;
  den Fahrer „E2E-Fahrer“ legt `global-setup.ts` einmal vor allen Workern an
  (die echte API seedet keine Fahrer; je Worker entstanden sonst zwei
  gleichnamige). Die App startet wie die anderen über `nextApp()`, mit
  `E2E_BUILT=1` also `next start` auf `dist/apps/bakery-delivery` (oder
  `E2E_APP_DIR`) - dort muss `NEXT_PUBLIC_API_URL` beim Build auf `API_URL`
  gezeigt haben.

## Zwei Betriebsarten

**Entwicklung** (Standard): `npx nx e2e bakery-shop-e2e` startet `nx serve` und
übernimmt laufende Server (`reuseExistingServer`). Wer die API schon auf 5000
laufen hat, testet gegen deren Daten - in der Regel das echte `hq`. Startet
Playwright die Server selbst, bekommen Dev-Server und API **dasselbe**
Produktverzeichnis (`productsDir()` in `servers.js`): `HQ_PRODUCTS_DIR` aus der
Umgebung, sonst `../hq/products`, und nur wenn es das nicht gibt, das Fixture.
Die Suiten vergleichen die Oberfläche mit `GET /api/products`; sähe die API
das Fixture (56) und die App das echte `hq` (103), wäre die Suite rot. In
Entwicklung wird das API-Bundle vor dem Start neu gebaut (`E2E_API_BUILD=1`),
damit nicht gegen ein altes getestet wird. Läuft auf dem API-Port schon ein
anderer Server, übernimmt Playwright ihn ebenfalls; meldet er in `/health`
keine Datenbank, bricht `global-setup.ts` der Verwaltung mit einer deutschen
Meldung ab. Eine übernommene API ohne `PUBLIC_CATALOGUE=1` lässt die
Shop-Suite rot (401 auf den Katalog).

**Gebaut** (`CI=true`, alternativ `E2E_BUILT=1`): die Suite startet ihre Server
selbst - `next start dist/apps/<app>` (Landing: der statische Export hinter
`serve-static.js`) und die echte API auf `tools/e2e/hq-products` (deren
Bundle vorher gebaut sein sollte - `real-api.js` baut es sonst selbst). So läuft `.github/workflows/ci.yml`: ohne das private
`hq`-Repo, ohne vorhandene Datenbank, nur Chromium.

Ports kommen aus `BASE_URL` und `API_URL`, damit mehrere Läufe nebeneinander
Platz haben. Ein Lauf wie in CI, aber auf eigenen Ports:

```bash
# Shop: Build kennt die API-Adresse (NEXT_PUBLIC_API_URL wird eingebacken)
NX_ISOLATE_PLUGINS=false NODE_ENV=production NEXT_PUBLIC_API_URL=http://localhost:5280 \
  npx nx build bakery-shop --configuration=production
npx nx run bakery-api:bundle
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

Die Management-Suite **speichert nie in hq** (Produkte, Grundmengen). Sie
liest ohnehin nur eine Kopie (`prepareE2eHq()`), sodass ein Speichern das
Fixture im Repo nicht ändern würde - geprüft wird das Speichern in den
Unit-Specs und in der Vertrags-Suite der API
(`apps/bakery-api/tests/contract/hqProducts.contract.test.ts`).

**Ausnahme Rezepte:** `management-rezepte.spec.ts` legt als Backstubenleitung ein Rezept an,
ändert und löscht es - in der Wegwerf-Kopie `HQ_RECIPES_DIR` aus `prepareE2eHq()` (kein
Schreib-Worktree, kein git). Der Name trägt das Playwright-Projekt (Desktop und Handy laufen
gegen dieselbe API); ein Rest aus einem abgebrochenen Lauf wird vorher gelöscht.

**Ausnahme seit W4:** `management-preorders.spec.ts` schreibt
**Vorbestellungen** - aber nur in die Wegwerf-SQLite der Test-API
(`real-api.js`, `mkdtemp`). Sie legt über `POST /api/preorders` zwei
Bestellungen an der Sammelstelle `kindergarten-moersbach` an (Produkt
`kornbrot-500g` aus dem Fixture), findet sie in Mörsbach-Liste und
Abholliste, stellt sie per Sammelaktion auf „bereit" und übergibt eine.
Jedes Playwright-Projekt nimmt einen eigenen Samstag (Desktop: in einer
Woche, Pixel 5: in zwei), damit die Sammelaktion des einen Projekts nicht die
Bestellungen des anderen anfasst. Gegen eine wiederverwendete API (Entwicklung,
`reuseExistingServer`) bleiben die Testbestellungen in deren Datenbank liegen.
