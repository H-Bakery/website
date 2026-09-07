# Bakery Website - Claude Code Project Instructions

## Project Overview

This is a full-stack bakery management system built with Next.js, Material UI, and TypeScript in an Nx monorepo architecture.

**Architecture:**

- Frontend: Next.js 15 with App Router, Material UI, TypeScript
- Backend: TypeScript with domain-driven design (Express + Sequelize)
- Testing: Jest + React Testing Library
- State Management: React Context (Theme, Cart, Authentication)
- API Integration: bakeryAPI service with mock data fallback

**Deployment Targets:**

- Landing Page → GitHub Pages (static export)
- Shop System → Vercel (SSR for performance)
- Management System → Vercel (CSR for interactivity)
- Backend API → Google Cloud Run (containerized)

## Quick Commands

### Development

```bash
npm run dev                 # Start development server
npm run build              # Build for production
npm run test               # Run tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Generate coverage report
npm run lint               # Run ESLint
```

### Nx Commands

```bash
# Development (working services)
npm run dev:landing          # Landing page (port 3000) ✓
npm run serve:shop           # Shop app (port 4200) ✓
npm run serve:management     # Management app (port 4201) ✓
npm run serve:api:simple     # Simple API server with mock data (port 5000) ✓

# API (TypeScript build - has compilation errors, see TASK-001)
npm run serve:api            # Full TS API - currently broken due to migration issues

# Building
nx build bakery-shop       # Build shop app
nx next:build bakery-landing  # Build landing page with Nx dependencies
nx build-static-standalone bakery-landing  # Build landing page standalone (recommended)
nx affected:build          # Build only affected projects

# Static Export (Landing Page)
nx build-static-standalone bakery-landing  # Recommended: standalone static build
npm run build:landing:standalone           # plain `next build` in apps/bakery-landing (no sitemap)
nx build-static bakery-landing             # Full Nx build + export

# Testing & Quality
nx affected:test           # Test only affected projects
nx affected:lint           # Lint affected projects
nx format:write            # Format code
```

## Project Structure (Nx Monorepo)

```
website/
├── apps/                              # Applications (deployable units)
│   ├── bakery-landing/               # Public landing page (GitHub Pages) - port 3000
│   ├── bakery-shop/                  # Customer e-commerce (Vercel SSR)
│   ├── bakery-management/            # Internal management (Vercel CSR)
│   ├── bakery-delivery/              # Delivery tracking app
│   ├── bakery-api/                   # Backend API (Cloud Run) - port 5000
│   └── *-e2e/                        # E2E test apps for each application
├── libs/                             # Shared libraries
│   ├── api/                          # API domain libraries
│   ├── shared/                       # Cross-app shared code (types, utils, UI)
│   ├── bakery-management/            # Management-specific feature libs
│   ├── bakery-shop/                  # Shop-specific feature libs
│   ├── bakery-delivery-routing/      # Delivery routing logic
│   └── bakery-delivery-tracking/     # Delivery tracking logic
├── content/                          # Content files (news, markdown)
├── docs/                             # Documentation
│   ├── architecture.md               # System design
│   ├── development.md                # Dev workflow
│   └── testing-guide.md              # Testing strategies
└── monitoring/                       # Monitoring configuration
```

## Key Features

### Customer Experience

- Product browsing with category filtering
- Shopping cart with persistence
- Real-time inventory checking
- German localization throughout

### Admin Dashboard

- Order management with DataGrid
- Inventory tracking
- Production workflow management
- User authentication with JWT

## Testing Guidelines

- Write tests alongside implementation
- Maintain >80% coverage
- Use React Testing Library best practices
- Run `npm test` before committing

## Development Workflow

1. Check current status: `git status`
2. Run tests: `npm test`
3. Lint code: `npm run lint`
4. Build to verify: `npm run build`

## Service Status (as of 2026-03-01)

| Service       | Command                    | Port | Status                                       |
| ------------- | -------------------------- | ---- | -------------------------------------------- |
| Landing Page  | `npm run dev:landing`      | 3000 | Working                                      |
| Shop          | `npm run serve:shop`       | 4200 | Working                                      |
| Management    | `npm run serve:management` | 4201 | Working                                      |
| Delivery      | `npm run serve:delivery`   | 4300 | Working (braucht die API)                    |
| API (simple)  | `npm run serve:api:simple` | 5000 | Working (mock data)                          |
| API (full TS) | `npm run serve:api`        | 5000 | Broken (TS compilation errors, see TASK-001) |

The full TypeScript API (`bakery-api`) has systemic compilation errors from an incomplete JS→TS migration. Use `serve:api:simple` for a working API with mock endpoints.

## Verkaufspartner (Backschrank CAP-Markt)

Erfasst wird ein **Besuch** am Backschrank, nicht eine Lieferung. Jeder Besuch hält fest, was
noch dalag (`countedQty`) und was neu eingeräumt wurde (`deliveredQty`); Verkaufszahlen werden
daraus **berechnet** und nie eingegeben.

Drei Dinge, die man wissen muss, bevor man hier etwas ändert:

- **Alle Formeln stehen genau einmal**, in `apps/bakery-api/src/services/partner-stats.core.js` -
  dependency-freies CommonJS. Es benutzen sie die echte API (`partner-stats.service.ts`, nur ein
  typisierter Wrapper), der Mock-Server (`simple-server.js`) und die Tests. Keine zweite
  Implementierung anlegen; die beiden Server würden sonst auseinanderlaufen.
  Weil `@nx/js:tsc` ohne `allowJs` läuft, steht die Datei in `project.json` unter `assets` -
  sonst fehlt sie in `dist/` und `require('./partner-stats.core')` greift ins Leere.
- **Ein Geschäftstag ohne `pickup`-Besuch ist offen.** Verkauf und Umsatz sind dann vorläufig
  (`stats.isProvisional`, `openDates`). Ohne diese Kennzeichnung liest sich ein unvollständiger
  Tag im Report als 100 % Abverkauf. Detail-Seite und Report markieren das; nicht wegoptimieren.
- **Eine Abholung, die nicht jedes Produkt mit Bestand zählt, ist unvollständig.** Der Tag
  ist dann zwar nicht mehr offen, aber `day.isComplete` ist `false`, die ungezählten Stücke
  stehen in `uncountedQty`/`uncountedProducts`, und `stats.isProvisional` bleibt gesetzt
  (`incompleteDates`). Sonst verschwinden diese Stücke lautlos aus der Abrechnung - weder
  verkauft noch Retoure. Die Erfassungsmaske lässt so eine Abholung nicht ohne Rückfrage speichern.
- **`countedQty: null` heißt "nicht gezählt", `0` heißt "Schrank war leer".** Der Unterschied
  ändert die Verkaufszahlen. Die Erfassungsmaske hält ihn auseinander, ein Test sichert das ab.
  Serverseitig prüft `validateVisitItems(items, lookup)` im Core jede Position (seit 2026-09-07):
  ein nicht-numerischer Rest wie `"abc"` wird mit 400 abgelehnt statt zu `0` zu werden, Mengen
  sind ganzzahlig und auf 0…10000 begrenzt, negative Preise und Produkte außerhalb des Katalogs
  fliegen raus, Name und Kennungen kommen aus dem Katalog. Beide Server rufen diese eine Funktion;
  `isBusinessDate()` daneben lehnt kalendarisch unmögliche Tage (`2026-02-30`) ab.
- **`csvCell()` maskiert Formelzellen.** Partner- und Produktnamen landen im CSV-Report; eine
  Zelle, die mit `=`, `+`, `-`, `@`, Tab oder CR beginnt, bekommt ein Apostroph voran und wird
  eingefasst, sonst führt Excel sie aus. Schlichte Zahlen (`-5`) bleiben Zahlen.

Die Tagesformel aus der Aufgabe (`Σ Geliefert − Rest bei der Abholung`) stimmt nur, wenn der
letzte Besuch eine Abholung ohne Lieferung ist. Der Core rechnet stattdessen je Produkt einen
Bestands-Automaten (`sold += Bestand − gezählt; Bestand = gezählt + geliefert`) - das ergibt auf
abgeschlossenen Tagen dasselbe und bleibt auf offenen Tagen richtig.

Preise und Produktnamen werden **als Snapshot** auf `PartnerVisitItem` gespeichert, damit eine
spätere HQ-Preisänderung alte Abrechnungen nicht rückwirkend verändert.

Der Mock-Server hält die Besuche in `apps/bakery-api/data/partner-store.json` (gitignored) - beim
`serve:api:simple` ist das die **einzige** Aufzeichnung. Gelesen und geschrieben wird über
`src/services/json-store.core.js`: erst `.tmp`, dann `rename`, und eine Datei, die sich nicht mehr
parsen lässt, wandert nach `partner-store.json.corrupt-<Zeit>` statt vom nächsten Speichern mit dem
Seed überschrieben zu werden (der Server loggt das als Fehler; die Besuche stehen dann in der
verschobenen Datei). Der Liefer-Store benutzt dieselben Helfer. Nicht durch ein bloßes
`writeFileSync` ersetzen - genau so gingen früher nach einem Absturz mitten im Schreiben alle
Besuche verloren.

Tests der Rechenlogik: `apps/bakery-api/tests/unit/partnerStats.test.js`. Achtung -
`apps/bakery-api/jest.config.js` hat `testMatch: ["**/tests/**/*.test.js"]`, führt also **nur**
plain-JS-Tests unter `tests/` aus. Die TypeScript-Specs unter `src/**/__tests__/` laufen nie mit.

## Liefertouren (Samstagsauslieferung)

Die Fahrer-App `bakery-delivery` (Port 4300) fährt die Samstagstour mit ein bis zwei Fahrern. Eine
**Tour** gehört einem Tag und einem Fahrer und besteht aus **Stopps** in gefahrener Reihenfolge; der
Fahrer hakt `done` / `failed` ab. Das ist etwas anderes als der Backschrank-**Besuch** oben: dort
wird der Restbestand gezählt und der Verkauf berechnet, hier wird nur zugestellt.

Seit dem 05.09.2026 hat die Tour einen zweiten Fall: die **Sammelstelle Kindergarten Mörsbach**.
Dort wird nicht zugestellt, sondern **vorbestellte Ware übergeben** — ein Stopp, viele Kunden. Die
Vorbestellungen erfasst **ausschließlich die Management-App** (`/admin/delivery/preorders`), der Shop
weiß davon nichts. Preise sind ein Snapshot aus `hq`, storniert wird statt gelöscht, und
`handed_over ↔ cancelled` ist gesperrt — sonst fiele eine bezahlte Übergabe aus der Abrechnung oder
ein nachgesendetes Abhaken aus dem Funkloch belebte eine stornierte Bestellung wieder. Formeln:
`apps/bakery-api/src/services/delivery-preorders.core.js`. Die Sammelstelle liegt in der
**Höhenstraße 24, 66482 Zweibrücken-Mörsbach** (städt. Kita „Hand in Hand"); Adresse und
Koordinaten stehen im Seed. Der Stopp hängt sich beim Anlegen einer Tour selbst an — aber
**nur an die erste Tour des Tages**, sonst hätten zwei Samstagsfahrer dieselbe Übergabeliste.

Die Fahrer-App hat außerdem einen **Dunkelmodus** (System / Hell / Dunkel, CSS-Variablen, kein MUI).

Details stehen in `apps/bakery-delivery/CLAUDE.md`. Fünf Dinge, die man von außen wissen muss:

- **Alle Server-Formeln stehen genau einmal**, in `apps/bakery-api/src/services/delivery-tours.core.js`
  (dependency-freies CommonJS, gleiche Konvention wie `partner-stats.core.js`, gleiche `*.core.js`-Glob
  unter `assets`). Das Frontend hat in `@bakery/delivery/routing` eine zweite, TypeScript-Fassung
  derselben Geometrie — die CommonJS/ESM-Grenze lässt sich nicht ohne Build-Umbau überbrücken. Wer
  Haversine, Umwegfaktor oder Standzeit ändert, muss **beide** Dateien anfassen;
  `libs/bakery-delivery-routing/src/lib/core-consistency.spec.ts` rechnet beide gegeneinander und
  fällt sonst um.
- **Adresssuche (Nominatim) und Routing (OSRM) sind optional.** Fällt ein Dienst aus, rechnet
  `delivery-geo.core.js` mit Schätzformeln weiter und setzt `isEstimate: true`; die Oberfläche
  schreibt „(geschätzt)" dahinter. Nicht wegoptimieren — sonst liest sich eine Luftlinien-Schätzung
  wie eine gemessene Strecke. Samstags früh muss die Liste auch ohne fremde Server da sein: das
  Lesen einer Tour wartet höchstens 2,5 s auf Nominatim, Fehlversuche werden 5 min lang nicht
  wiederholt.
- **Die Endpunkte liegen in `simple-server.js`** unter `/api/deliveries/*`. Der Store lebt im
  Speicher des Servers und wird nach jeder Änderung atomar nach
  `apps/bakery-api/data/delivery-store.json` geschrieben (gitignored, über `json-store.core.js`,
  siehe Verkaufspartner). Ein Server, der vor diesen
  Routen gestartet wurde, antwortet mit 404 — neu starten.
- **`Number(null)` ist `0`.** Ein Stopp ohne gefundene Adresse galt dadurch als Punkt (0, 0) und zog
  die ganze Tour in den Atlantik. Koordinaten deshalb immer mit `hasCoordinates()` prüfen (Server:
  `delivery-tours.core.js`, Frontend: `@bakery/delivery/routing`), nie mit
  `Number.isFinite(Number(x))` oder `!== null`. Das gilt auch für das Depot und die Fahrerposition.
  `hasCoordinates()` verlangt seit dem 07.09.2026 außerdem −90..90 / −180..180 und lehnt das Paar
  `(0, 0)` ab; Eingaben prüft `validateCoordinates()` (400 mit `message` + `error`), gespeicherte
  Altwerte werden beim Laden des Stores auf `null` gesetzt und neu gesucht.
- **Zeitfenster zählen in der ETA-Kette mit.** `parseTimeWindow()` liest „09:00-09:30", „08.00-09.00",
  „ab 09:00", „bis 09:30"; eine einzelne Uhrzeit nur mit Präfix (`ab`/`nicht vor`/`frühestens` → Beginn,
  `bis`/`spätestens`/`vor` → Ende), sonst Freitext ohne Wirkung; die Ankunft ist `max(eta, Fensterbeginn)`, die Wartezeit
  steht als `waitSeconds` am Stopp, ein verpasstes Fenster als `missesTimeWindow`. „Route berechnen"
  sortiert mit Fenstern im Core (Nearest Neighbour mit Zeitfenstern) und lässt OSRM nur messen.

Tests: `npx nx test delivery-routing` (61), `npx nx test delivery-tracking` (7) und
`apps/bakery-api/tests/unit/deliveryTours.test.js` (83) für die Rechenlogik des Servers.

## Kassenberichte (hq/data/reports)

Die Management-App zeigt unter `/admin/reports` die **Tagesabschlüsse der Kasse** aus
`hq/data/reports/converted/` (ein JSON je Tag und Kasse, `YYYY-MM-DD_<Kasse>[_2].json`; Pfad über
`HQ_REPORTS_DIR` oder `<website>/../hq/data/reports`). Das Dashboard („Kasse · Stand: <Tag>") und
`/admin/analytics/*` rechnen mit denselben Daten. Das frühere `apps/reports` (kein Nx-Projekt,
toter Pfad ins stillgelegte `content/`-Repo) ist seit dem 07.09.2026 gelöscht.

Fünf Dinge, die man wissen muss:

- **Die Formeln stehen genau einmal**, in `apps/bakery-api/src/services/reports.core.js`
  (dependency-freies CommonJS, gleiche Konvention wie `partner-stats.core.js`); die Datei-Lese-Schicht
  daneben in `reports-files.core.js`. Der Mock-Server (`src/routes/reports.mock.js`, eine Zeile in
  `simple-server.js`) und der Loader der Management-App (`apps/bakery-management/src/lib/reports.ts`)
  benutzen beide. Der Loader lädt den Core zur Laufzeit über Nodes `createRequire` aus dem Monorepo,
  weil ein statischer Import einer App vom Modul-Grenzen-Lint verboten ist (`Imports of apps are
forbidden`) - wer die Datei verschiebt, muss `CORE_DIR` in `reports.ts` nachziehen.
- **`payment: 'Unbar'` ist Karte.** Wer auf `'Karte'` filtert, bekommt null. `'Keine'` sind
  Gutscheineinlösungen und 0-Euro-Bons („Ohne Zahlung").
- **Ein Tag ohne Datei ist eine Lücke, kein Umsatz 0** (`status: 'no-data'`). Montag ist Ruhetag,
  dazu Betriebsferien und fehlende Exporte. Liste, Detailseite und Analysen zeigen das als „kein
  Bericht"; nicht wegoptimieren. Fehlt das ganze Verzeichnis (CI), wird einmal
  `HQ reports directory not found` geloggt und leer geantwortet - es gibt **keine** Beispieldaten
  mehr, auch nicht in `analyticsService` (`available: false` statt `Math.random()`).
- **Umsatz = Σ Bon-Total ohne abgebrochene Belege** (`type: 'cancelled'`), Stornos negativ. Genau so
  stimmt die Summe mit dem Kassenabschluss (`daily_summary.total_revenue`) überein. Bons zählen ohne
  Storno-Gegenbuchungen - **überall gleich**: Kachel (`receiptCount`), Zahlungsmix
  (`payments.*.count`) und Kassenabschluss (`closings[].receiptCount`) ergeben dieselbe Zahl; die rohe
  Buchungszahl inkl. Stornos und Abbrüche steht nur in `closings[].transactionCount`. Positionsmengen
  einzelner Tage können durch Storno-Paare über die Tagesgrenze negativ sein - die Detailseite warnt
  dann, statt die Zeile zu verstecken.
- **Ein Zeitraum ist höchstens `MAX_RANGE_DAYS` (400) Tage lang.** Die Zahl steht im Core; der
  Mock-Server lehnt längere Anfragen mit `range_too_large` ab, die Archivseite kürzt
  `?from=&to=` mit `clampRange` (das Ende bleibt, der Anfang rückt nach) und sagt es an. Ohne die
  Kappung liefert `?from=2000-01-01` jede Tagesdatei als HTML - ein Tippfehler im Jahr genügt.

Endpunkte des Mock-Servers: `GET /api/reports/daily?from=&to=`, `/api/reports/daily/:date`,
`/api/reports/monthly/:month` sowie `/api/analytics/{revenue-trends,product-performance,payment-methods,summary}`.
Fehler mit `message` **und** `error`. Die echte TypeScript-API hat unter `/api/reports/daily` einen
älteren, DB-basierten Vertrag - der ist nicht angeglichen.

Tests: `npx jest -c apps/bakery-api/jest.config.js apps/bakery-api/tests/unit/reportsCore.test.js` (25)
und in der Management-App `src/lib/reports.spec.ts`, `admin/reports/**/*.spec.tsx`,
`admin/analytics/**/*.spec.tsx` - alle mit synthetischen Fixtures, nie mit echten Tagesfiles.

## Finanzdaten (`/admin/finance`, TASK-038)

Bankumsätze aus dem privaten `hq`-Repo (`hq/data/finance/finance-summary.json`, `schema_version` 1).
Dieses Repo ist öffentlich, `hq` nicht - deshalb gelten hier vier Regeln:

- **Nur das bereinigte Aggregat verlässt einen Server.** Der Sanitizer in
  `apps/bakery-api/src/services/finance.core.js` ist eine _Whitelist_: `accounts` (IBANs) und
  `top_counterparties` (Klarnamen) fallen komplett weg, `uncategorized` behält nur `count`/`amount`.
  Ein neues Feld im Export ist unsichtbar, bis es dort bewusst freigegeben wird. Der Core trägt auch
  Monatsreihe, Kostenstruktur und die Invariante `Einnahmen + Ausgaben + Neutral = Kontoveränderung`
  (`checkInvariant`) - genau einmal, wie `partner-stats.core.js`. Der Loader der Management-App
  (`src/lib/finance.ts`) lädt denselben Core per `require` mit `// nx-ignore-next-line` und
  `eslint-disable-line`; beide Marker müssen an genau dieser Stelle bleiben, sonst hängt
  `bakery-management` im Nx-Graph an `bakery-api` und `nx build` baut erst die API.
- **Endpunkte nur mit Rolle `admin`.** `GET /api/finance/summary` und `/api/finance/months?from=&to=`
  liegen in `apps/bakery-api/src/routes/finance.mock.js`, geschützt durch `requireRole('admin')` aus
  `src/routes/auth.mock.js` - der Mock-Server hat seit TASK-038 ein echtes JWT-Login
  (`POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/refresh`, `POST /api/auth/logout`;
  Benutzer aus `MOCK_ADMIN_USER`/`MOCK_ADMIN_PASSWORD`, optional `MOCK_STAFF_*`; `JWT_SECRET` sonst
  pro Start zufällig). Ohne Token 401, mit falscher Rolle 403, beides als JSON mit `message` und
  `error`. Die Management-App hat dafür `/admin/login`; das Token wird in `localStorage` gehalten
  (`src/lib/authSession.ts`), weil `ApiClient` und `AuthProvider` es sonst beim Neuladen verlieren.
- **Kein Fallback auf Beispieldaten.** Fehlt `hq` (CI), fehlt die Datei oder stimmt die
  `schema_version` nicht, antwortet der Server mit `status: 'no-data'` und loggt das; die Seite zeigt
  „Keine Finanzdaten vorhanden". `HQ_FINANCE_DIR` überschreibt den Pfad `<website>/../hq/data/finance`.
- **Synthetische Testdaten.** `apps/bakery-api/tests/fixtures/finance-summary.synthetic.js` ist
  erfunden; nie einen echten Auszug in Fixtures, Snapshots, Screenshots oder Commit-Messages kopieren.

Die Seite zeigt eine **Cashflow-Sicht nach Buchungsdatum, keine GuV** - der Hinweis steht bewusst in
der Oberfläche. Nicht zugeordnete Buchungen sind gewollt und ein Info-Hinweis, keine Warnung.

Tests: `npx jest -c apps/bakery-api/jest.config.js apps/bakery-api/tests/unit/finance*.test.js` (Core,
Auth und Routen) und `npx nx test bakery-management` (`src/lib/finance.spec.ts`, `FinanceClient.spec.tsx`).

## E2E-Suiten (Playwright)

Drei Suiten, `apps/bakery-{shop,management,landing}-e2e`, nur Chromium (Desktop + Pixel 5).
Was sie starten, steht **einmal** in `tools/e2e/servers.js`: in Entwicklung `nx serve` plus ein
laufender Server, in CI (`CI=true` oder `E2E_BUILT=1`) `next start` auf dem Build in `dist/apps/`
bzw. der statische Landing-Export hinter `tools/e2e/serve-static.js`, dazu die Mock-API auf dem
**synthetischen Produktkatalog** `tools/e2e/hq-products` (56 Markdown-Produkte im `hq`-Format).
So laufen die Jobs `test-e2e-*` in `.github/workflows/ci.yml` ohne das private `hq` und ohne
Datenbank. Details, Ports und die Bedingungen, die der Katalog erfüllen muss: `tools/e2e/README.md`.

App und Mock-API müssen **dieselben Produktdateien** lesen - die Suiten vergleichen die Oberfläche
mit `GET /api/products`. `productsDir()` in `servers.js` entscheidet das für beide Server auf
einmal: gebaut immer das Fixture, in Entwicklung `HQ_PRODUCTS_DIR`, sonst `../hq/products`, sonst
das Fixture. Nicht einem der beiden Server ein eigenes Verzeichnis geben.

Die Shop-Suite ist datengetrieben (liest `GET /api/products` und vergleicht). Die generierten
Suiten `landing-page.spec.ts` und `management-workflows.spec.ts` beschreiben nie gebaute
Oberflächen (Schweizer Platzhalter, CHF, `data-testid`s ohne Gegenstück) und sind als Ganzes mit
Begründung übersprungen; geprüft wird die echte App in `landing-smoke.spec.ts` und
`management-smoke.spec.ts`. Wer eine dieser Funktionen baut, zieht den Test um und gibt ihm
echte Selektoren - nicht die Skip-Markierung entfernen und hoffen.

## Important Notes

- Always check existing patterns before implementing new features
- Follow existing code conventions and component structure
- German localization throughout customer-facing apps

## Task Management (MissionControl)

Tasks managed via `mc` CLI. Files in `.mc/tasks/` as markdown with YAML frontmatter.

Quick reference:

```bash
mc status              # Dashboard
mc task board          # Kanban board
mc task next           # Next actionable task
mc new task "Title"    # Create task
mc task move TASK-NNN in-progress  # Change status
mc mcp                 # Start MCP server (stdio)
```

## Documentation References

For detailed information, see:

- Architecture: @docs/architecture.md
- Development Guide: @docs/development.md

## Static Landing Page Build & Deployment

### Building for Static Export

The landing page (`apps/bakery-landing/`) is configured for static export to GitHub Pages, Vercel, or any static hosting:

**Recommended Build Commands:**

```bash
# Clean stale cache first (required if dev server was running)
rm -rf apps/bakery-landing/.next

# Standalone build (always works, recommended)
NODE_ENV=production npx nx build-static-standalone bakery-landing

# Or via npm script: same export to apps/bakery-landing/out, but without the sitemap
npm run build:landing:standalone
```

**Output Location:** `apps/bakery-landing/out/` (ready for deployment)

### Deployment Options

- **GitHub Pages**: Upload `out/` contents or use GitHub Actions workflow
- **Traditional Hosting**: Upload `out/` directory to web server

### Troubleshooting Static Builds

**Problem: Build fails with `<Html> should not be imported outside of pages/_document` or `Cannot find module for page`**

```bash
# Cause: Stale .next cache from dev server. Always clean before building.
rm -rf apps/bakery-landing/.next
NODE_ENV=production npx nx build-static-standalone bakery-landing
```

**Problem: Nx build fails with shared library TypeScript errors**

```bash
# Solution: Use standalone build that avoids problematic dependencies
NODE_ENV=production npx nx build-static-standalone bakery-landing
```

**Problem: Module resolution errors for @bakery/\* imports**

```bash
# Solution: Ensure tsconfig extends the base configuration
# File: apps/bakery-landing/tsconfig.json should have:
# "extends": "../../tsconfig.base.json"
```

**Problem: Cannot resolve shared library modules**

```bash
# Solution: Build required shared libraries first
nx build shared-utils
nx build shared-types
# Then try the landing page build again
```
