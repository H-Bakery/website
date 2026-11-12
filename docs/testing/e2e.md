# E2E-Suiten (Playwright)

Vier Suiten, `apps/bakery-{shop,management,landing,delivery}-e2e`, nur Chromium (Desktop Chrome +
Pixel 5). Shop, Verwaltung und Landing laufen in CI (`test-e2e-*` in `.github/workflows/ci.yml`) ohne
das private `hq` und ohne vorhandene Datenbank.

Seit B12 läuft jede Suite gegen die **echte API** (Bundle über `tools/e2e/real-api.js`, frische
SQLite-Datenbank im Temp-Verzeichnis, Inhaber aus `BOOTSTRAP_ADMIN_*`, erfundene Kassenberichte und
Finanzen aus `prepareE2eHq()`) - die Verwaltung schon seit F4, Shop und Fahrer-App seit B12. Der Shop
bekommt sie mit `PUBLIC_CATALOGUE=1` und seinem Origin in `CORS_ORIGIN`; einen öffentlichen
Bestellweg gibt es nicht, die Kasse prüft ihren Erfolgsweg gegen einen im Browser nachgestellten
Endpunkt (`stubOrderEndpoint()` in `apps/bakery-shop-e2e/src/support/shop.ts`).

**Code:** `tools/e2e/servers.js` (was jede Suite startet - steht **nur dort**), `tools/e2e/real-api.js`,
`tools/e2e/serve-static.js`, Fixture-Katalog `tools/e2e/hq-products/`. Betriebsarten, Ports, welche
API welche Suite bekommt und was der Katalog erfüllen muss: [`tools/e2e/README.md`](../../tools/e2e/README.md).

## Regeln

- **App und API lesen dieselben Produktdateien.** Die Suiten vergleichen die Oberfläche mit
  `GET /api/products`. `productsDir()` in `servers.js` entscheidet das für beide Server auf einmal
  (gebaut immer das Fixture, in Entwicklung `HQ_PRODUCTS_DIR`, sonst `../hq/products`, sonst das
  Fixture). Nicht einem der beiden Server ein eigenes Verzeichnis geben - sähe die API das Fixture und
  die App das echte `hq`, wäre die Suite rot.
- **Die Shop-Suite ist datengetrieben** (liest `GET /api/products` und vergleicht), keine fest
  verdrahteten Produktzahlen.
- **Übersprungene generierte Suiten bleiben übersprungen.** `landing-page.spec.ts` und
  `management-workflows.spec.ts` beschreiben nie gebaute Oberflächen (Schweizer Platzhalter, CHF,
  `data-testid`s ohne Gegenstück) und sind als Ganzes mit Begründung übersprungen
  (`test.skip(true, 'Nicht gebaut - siehe Kopf der Datei.')`). Geprüft wird die echte App in
  `landing-smoke.spec.ts` und `management-smoke.spec.ts`. Wer eine dieser Funktionen baut, zieht den
  Test um und gibt ihm echte Selektoren - nicht die Skip-Markierung entfernen und hoffen.
- **Die Management-Suite speichert nie in hq**; Vorbestellungen (`management-preorders.spec.ts`)
  schreibt sie nur in die Wegwerf-SQLite der Test-API, Rezepte (`management-rezepte.spec.ts`) nur in
  die Wegwerf-Kopie der erfundenen Rezepte (Details im README).
- **Die Delivery-Suite** (`apps/bakery-delivery-e2e`, `npm run test:e2e:delivery`) holt ihre API
  aus `deliveryApiServer()` in `servers.js` (echte API, Origin der App in `CORS_ORIGIN`), startet die
  App selbst mit `nx serve` und läuft nur lokal, nicht in CI - die Fahrer-App ist nicht im Pilot
  (roadmap D11).

## Aufrufe

```bash
npm run test:e2e:shop          # bzw. :management, :landing, :delivery
CI=true BASE_URL=… API_URL=… npx nx e2e bakery-shop-e2e   # wie in CI, auf eigenen Ports (siehe README)
```
