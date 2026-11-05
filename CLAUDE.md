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
- Pilot (docs/roadmap.md D4): API + Management laufen auf der **Bäckerei-Box** im LAN
  (systemd + Caddy), siehe „Box-Betrieb" unten. Vercel/Cloud Run sind für den Pilot nicht im Einsatz.

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

# Real TS API (pilot, roadmap B0): esbuild bundle → node, SQLite at DB_PATH
npm run serve:api            # bundles, migrates, listens on PORT (default 5000) ✓
npm run build:api            # bundle only → dist/apps/bakery-api/bundle/main.js

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

## Service Status (as of 2026-11-05)

| Service       | Command                    | Port | Status                                               |
| ------------- | -------------------------- | ---- | ---------------------------------------------------- |
| Landing Page  | `npm run dev:landing`      | 3000 | Working                                              |
| Shop          | `npm run serve:shop`       | 4200 | Working                                              |
| Management    | `npm run serve:management` | 4201 | Working                                              |
| Delivery      | `npm run serve:delivery`   | 4300 | Working (braucht die API)                            |
| API (simple)  | `npm run serve:api:simple` | 5000 | Working (mock data) - parity reference until cutover |
| API (real TS) | `npm run serve:api`        | 5000 | Starts: health, auth (B3, SQLite), users, partners   |

The real TypeScript API (`bakery-api`, roadmap D2) is built by esbuild into one file,
`dist/apps/bakery-api/bundle/main.js` (`apps/bakery-api/build.mjs`, target `bakery-api:bundle`), and
runs against the root `node_modules`. On start it opens SQLite at `DB_PATH` (default
`./data/bakery.db` relative to the working directory, gitignored; **absolute and required in
production**), switches it to WAL with `busy_timeout`, runs the migrations in-process (Umzug, static
list in `src/db/migrations.ts`), then `initializeModels()`, then listens. Mounted so far: `/health`
(+ `/api/health`), `/api/auth`, `/api/users`, `/api/partners`. Every `/api` path except login,
refresh, PIN and the station user list needs a session (401); with a session an unknown path is a
JSON 404 with `error` + `message`. See "Anmeldung (B3)" below. The other pilot domains (products,
reports, finance, targets, preorders, Backzettel) are added by their roadmap tasks; until then the frontend still talks to `serve:api:simple`. Details in
`apps/bakery-api/CLAUDE.md`.

## Verkaufspartner (Backschrank CAP-Markt)

Erfasst wird ein **Besuch** am Backschrank, nicht eine Lieferung. Jeder Besuch hält fest, was
noch dalag (`countedQty`) und was neu eingeräumt wurde (`deliveredQty`); Verkaufszahlen werden
daraus **berechnet** und nie eingegeben.

Drei Dinge, die man wissen muss, bevor man hier etwas ändert:

- **Alle Formeln stehen genau einmal**, in `apps/bakery-api/src/services/partner-stats.core.js` -
  dependency-freies CommonJS. Es benutzen sie die echte API (`partner-stats.service.ts`, nur ein
  typisierter Wrapper), der Mock-Server (`simple-server.js`) und die Tests. Keine zweite
  Implementierung anlegen; die beiden Server würden sonst auseinanderlaufen.
  Seit B0 bündelt esbuild (`apps/bakery-api/build.mjs`) die `*.core.js`-Dateien mit ins Bundle;
  der alte `assets`-Eintrag des `@nx/js:tsc`-Builds ist weg.
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

Tests der Rechenlogik: `apps/bakery-api/tests/unit/partnerStats.test.js`. Seit B1 hat
`apps/bakery-api/jest.config.js` zwei Projekte: `js` (`tests/**/*.test.js`) und `ts`
(`src/**/*.spec.ts`, `tests/**/*.test.ts`, ts-jest). Die echte API wird über
`tests/helpers/createTestApp.ts` (`createApp()` auf `:memory:` mit der Pilot-Baseline) getestet,
der Abgleich mit `simple-server.js` über `tests/parity/` - Details in `apps/bakery-api/tests/README.md`.

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
  (dependency-freies CommonJS, gleiche Konvention wie `partner-stats.core.js`). Das Frontend hat in `@bakery/delivery/routing` eine zweite, TypeScript-Fassung
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

## Tagesziel-Ampel (`/admin/finance/tagesziel`, TASK-039)

Break-even als Tagesziel je Wochentag, rückblickend aus den Tagesabschlüssen der Kasse; Dashboard-Kachel
(`components/targets/TargetsTile.tsx`) und Detailseite. Vier Dinge, die man wissen muss:

- **Die gesamte Rechnung steht genau einmal**, in `apps/bakery-api/src/services/targets.core.js`
  (dependency-freies CommonJS wie `finance.core.js`): Kostenbasis (`computeCostBase`: Fixkosten =
  Netto aller `ausgabe`/`offen`-Kategorien außerhalb `variable_categories`, Kostenquote = variable
  Kosten / Einnahmen, Umsatz außer Kasse = Einnahmen − Unterkategorien `bar`/`karte`/`karte_elv`),
  Wochentagsfaktoren (`computeWeekdayFactors`: rollierendes Fenster bis zum jüngsten ausgewerteten Tag,
  normiert auf Mittelwert 1 über die geöffneten Wochentage), Zielstufen (`computeTargets`), Ampel
  (`evaluateDay`) und Zeiträume (`aggregatePeriod`, `aggregateToDate` mit Hochrechnung). Die
  Management-App rechnet **nichts** selbst - sie zeigt, was `/api/finance/targets*` liefert
  (`src/routes/targets.mock.js`, Rolle `admin`, Fehler mit `message` + `error`). Das gilt auch für
  die Wochentagstabelle: `deviation` (Ø Ist − Ziel) kommt je Zeile vom Server, und das Verhältnis
  Ø Ist / Ziel steht **einmal je Stufe** (`average_ratio`) - es ist per Konstruktion an allen
  Wochentagen gleich (Faktoren sind auf die Wochentagsmittel normiert) und steht deshalb als Fußnote
  unter der Tabelle, nicht als Prozent in jeder Zeile, wo es wie „alle Wochentage gleich gut" läse.
- **Die Config liegt in `hq`, nicht hier:** `hq/data/finance/config/targets.json` (`HQ_FINANCE_DIR`).
  `mode: 'derived'` leitet aus `finance-summary.json` ab, `mode: 'manual'` überschreibt die Ableitung
  vollständig. Fehlt die Datei oder ist sie unplausibel (Schwellen, Ruhetage, Kostenquote ≥ 1, keine
  Fixkosten), antwortet der Server mit `status: 'no-target'` und einem Grund - **nie** mit einem
  geschätzten Ziel. `non_pos_revenue_monthly` und `private_draw_monthly` sind bewusst `null`; die
  Ableitung daraus ist eine **Annahme** (`assumed: true` an der Entnahme-Stufe, `cost_base.assumptions`),
  und die Oberfläche sagt das.
- **`open` heißt nicht rot.** Der laufende Tag, die Zukunft, Ruhetage (`closed_weekdays`, ISO 1 = Montag)
  und vergangene Tage ohne Bericht (Ferien, Feiertage, fehlender Export - ohne Öffnungskalender nicht
  unterscheidbar) sind `status: 'open'` mit `reason` und Label. Sie zählen weder als Ist noch als Ziel,
  und sie fließen nicht in die Faktoren ein. Ein Tag mit Umsatz ≤ 0 (Storno-Tag) ebenso wenig.
  `last_evaluated_date` ist der jüngste Tag **vor** heute mit Bericht - im Regelfall gestern.
- **Farbe ist nie der einzige Träger.** `TargetStatusChip` zeigt immer Label + Verhältnis, trägt
  `data-status` und eine je Modus geprüfte Palette (`useTargetStatusColors`, ≥ 4,5:1 auf `paper` in
  Light und Dark). Keine MUI-`warning.main`-Texte dafür - die fallen in Light auf ~3:1.

Tests: `npx jest -c apps/bakery-api/jest.config.js apps/bakery-api/tests/unit/targets*.test.js` (Core
und Routen, synthetische Fixtures in Temp-Verzeichnissen) und in der Management-App
`src/lib/targetsApi.spec.ts`, `components/targets/TargetsTile.spec.tsx`,
`admin/finance/tagesziel/TagesZielClient.spec.tsx` (Fixtures: `src/lib/targetsFixtures.ts`, erfunden).
Keine echten Beträge in Code, Tests, Fixtures oder Commit-Messages - das Repo ist öffentlich.

## Pilotbetrieb (`NEXT_PUBLIC_PILOT_MODE`, F2)

Mit `NEXT_PUBLIC_PILOT_MODE=1` zeigt die Management-App nur die Seiten mit echten Daten (Spalte
„Keep" in `docs/roadmap.md` §3) plus Anmeldung und die kommenden Pilot-Bildschirme; alles andere
fehlt in der Navigation und zeigt beim direkten Aufruf „Im Pilotbetrieb nicht verfügbar". Ohne die
Variable (lokal, CI) ändert sich nichts. Fünf Dinge, die man wissen muss:

- **Der Schalter wirkt beim Build, nicht beim Start.** `NEXT_PUBLIC_*` setzt Next.js bei
  `next build` in das Bundle ein. Auf der Box (O1/O3) muss die Variable also beim `next build`
  gesetzt sein; erst bei `next start` gesetzt, bleibt sie wirkungslos. Dokumentiert in
  `apps/bakery-management/.env.example`.
- **Genau eine Liste erlaubter Routen:** `PILOT_ALLOWED_ROUTES` in
  `apps/bakery-management/src/lib/pilotMode.ts`. `/admin` gilt nur exakt, jede andere Route schließt
  ihre Unterseiten ein (`/admin/finance` deckt Tagesziel; `/admin/delivery` ist gesperrt,
  `/admin/delivery/preorders` offen). Navigation (`getNavigation(pilot)` in `admin/navigation.ts`),
  Seiten-Sperre und Dashboard-Schnellzugriffe fragen alle `isPilotPathAllowed()`. Wer eine Seite
  freigibt, ändert nur diese Liste. Die rollengefilterte Navigation aus F1 baut auf
  `getNavigation()` auf, nicht auf `MANAGEMENT_NAVIGATION`.
- **Die Sperre sitzt in `admin/layout.tsx` und ist keine Zugriffskontrolle.** Sie ersetzt im Browser
  `children` durch `PilotUnavailable`; Server-Komponente und RSC-Payload einer gesperrten Seite
  entstehen trotzdem, die API bleibt direkt erreichbar. Sie liegt nicht in `middleware.ts`, weil
  Next.js nur eine Middleware erlaubt und die F1 gehört - F1 kann dort `isPilotPathAllowed()`
  aufrufen und umleiten. Durchgesetzt wird Zugriff von F1 und den Rollen-Guards der API.
- **Kommende Bildschirme schalten sich über `ready` frei.** `PILOT_UPCOMING_NAVIGATION` in
  `admin/navigation.ts` führt `/admin/preorders` (M1), `/admin/backzettel` und `/backstube` (M2) mit
  `ready: false`; ein Eintrag erscheint (direkt unter dem Dashboard) erst mit `ready: true`.
  `src/lib/pilotMode.spec.ts` fällt um, wenn `ready` und die Existenz der `page.tsx` **genau unter
  `href`** auseinanderlaufen, und auch, wenn es Unterseiten ohne diese Index-Seite gibt - M2 braucht
  also neben `backzettel/grundmengen` und `backzettel/[datum]` eine `admin/backzettel/page.tsx`
  (z. B. Weiterleitung auf den nächsten Produktionstag). `/backstube` liegt außerhalb `/admin` und
  bekommt weder Seitenleiste noch Sperre. Der Mörsbach-Eintrag heißt deshalb „Sammelstelle
  Mörsbach", nicht „Vorbestellungen"; ob er in `/admin/preorders` aufgeht, entscheidet M1.
- **Keine Mock-Abfragen im Pilotbetrieb.** Das Dashboard blendet „Offene Bestellungen",
  „Produktionsübersicht" und „Letzte Aktivitäten" aus und fragt `/api/orders` und `/api/production`
  nicht an. Der `NotificationProvider` bleibt (das Dashboard ruft `useNotifications()`), lädt aber
  dank `loadOnMount={false}` nichts, pollt nicht und fragt nicht nach Browser-Mitteilungen - die
  echte API hat kein `/api/notifications`.

Tests: `src/lib/pilotMode.spec.ts`, `src/app/admin/layout.pilot.spec.tsx`,
`src/app/admin/DashboardClient.spec.tsx` (Management-App) und
`libs/shared/contexts/src/lib/notification/notification.loadOnMount.spec.tsx`.

## Backzettel (Kern, Z1/Z2)

Stammdaten in `hq/config/backzettel.yaml` (privat), Tagesrechnung hier. Plan: `docs/roadmap.md` §5.

- **Die Rechnung steht genau einmal**, in `apps/bakery-api/src/services/backzettel.core.js`
  (dependency-freies CommonJS): `computeDay({config, date, preorderItems, capTemplate, corrections,
seasonFactor, recipes, catalog})` liefert Zeilen (Basis | Saison | Vorbestellt | CAP | Korrektur |
  Gesamt) je Posten/Variante, die Hefeteig-Zusammenfassung (Teigstücke, Teig g, Chargen,
  Abwiegeliste), den Füllungsbedarf mit skaliertem Rezept und die Vorbereitungen;
  `computePreorderDeltas({config, date, before, after})` liefert die Deltas **je Vorbestellung**
  (passt 1:1 auf `backzettel_deltas`; Z3 speichert dafür bei der Freigabe die Vorbestellungs-
  positionen des Tages), `computeDeltas` vergleicht zusätzlich die Zeilen. Nie nur Summen
  vergleichen: ein Viertel verschwindet in der Aufrundung, Neu + Storno heben sich auf.
  `variantsForProduct` sagt, welche Varianten ein Produkt annimmt (für B7).
  Schema-Prüfung: `backzettel-config.core.js` (`validateBackzettelConfig`, `normalizeConfig`),
  Rezepte: `backzettel-recipes.core.js`, Datei-Lesen (js-yaml): `backzettel-config.loader.js`.
- **Viertel erst summieren, dann aufrunden** - je Zeile (Posten × Variante). Aufgerundet wird mit
  Toleranz (`roundUp`), sonst wird aus 10 × 1,1 = 11,000…02 eine 12. Stück/Blech ganzzahlig,
  Liter/kg auf 0,01 (Haferbrot 1,24 l).
- **Teigstücke und Füllungsgramm kommen aus der YAML**, nicht aus Code. Der gefüllte Kranz
  (hq: 1 × 1200 g, alter Code: 3 × 600 g) ist offen (Q-B3) und nur dort einzustellen.
- **`null` als Grundmenge heißt „noch nicht festgelegt“, `0` heißt „wird nicht gebacken“.** Eine
  `null`-Zeile erscheint mit `baseUnset: true` (Warnung `base_unset`); nicht zu 0 zusammenlegen.
  Gefüllte Posten (`filling_g`) brauchen die Grundmenge je Variante, sonst fehlt sie im
  Füllungsbedarf (der Validator lehnt eine bloße Zahl ab).
- **Rezeptpfade nur relativ unter `data/recipes/` und `.md`** - Validator und Loader prüfen das
  beide; die YAML schreibt später die App (B5b).
- **Variante = Füllungs-ID.** Gefüllte Ware ohne Variante zählt im Teig, aber nicht in der Füllung
  (`filling_unassigned`); unbekannte Produkte/Varianten werden als Warnung gemeldet, nie verschluckt.
- `formatTrayInfo` ist ein **Duplikat** von `feature-daily-prep/.../utils/trayInfo.ts`; beide
  ändern.
- CLI für das hq-CI (H2): `node apps/bakery-api/scripts/validate-backzettel.js <yaml> [productsDir]
[--json]`, Exit 1 bei Fehlern. Der Loader braucht `js-yaml` ^4 (Root-`dependencies`); das hq-CI
  muss es selbst installieren. Im API-Bundle landen die Dateien, sobald eine gemountete Route sie
  `require`t (esbuild, B0) - `js-yaml` bleibt dann extern.

Tests: `npx jest -c apps/bakery-api/jest.config.js apps/bakery-api/tests/unit/backzettel` (117,
synthetische Fixtures in `tests/fixtures/backzettel.synthetic.js`).

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

## Anmeldung (B3, echte API)

Persönliche Konten plus PIN-Stationen (D5) in SQLite, Passwort und PIN als scrypt-Hash aus
`node:crypto` (D12). Endpunkte und Antworthülle wie `auth.mock.js` (`login`, `me`, `refresh`,
`logout`, `{ success, data: { user, token, refreshToken, expiresIn } }`) plus
`POST /api/auth/pin`, `GET /api/auth/station/users`, `/api/auth/stations` und `/api/users`
(nur `inhaber`, nur aus einer persönlichen Sitzung). Details, Tabelle der Endpunkte und Fehlercodes: `apps/bakery-api/CLAUDE.md`,
Abschnitt „Auth (B3)". Was man von außen wissen muss:

- **Das `user`-Objekt weicht vom Mock ab (bewusste D3-Abweichung).** Echt:
  `{ id, username, displayName, role, active, isActive, createdAt, updatedAt, sessionKind }`.
  `email`, `firstName`, `lastName` und `lastLogin` gibt es nicht - die Pilot-Tabelle `users` hat
  sie nicht, und erfunden werden sie nicht. Rollen sind `inhaber | verkauf | backstube | fahrer`
  statt `admin | staff`. Für F1: `admin/login/page.tsx` („Angemeldet als {user.email}") und
  `admin/chat/page.tsx` lesen heute `user.email` - auf `displayName`/`username` umstellen.
- **Es gibt kein Standardkonto.** `admin`/`admin123` ist entfernt. Konten legt die CLI an
  (nach `npm run build:api`):
  `npm run api:create-user -- --username anna --display-name "Anna" --role verkauf`
  (Passwort über `CREATE_USER_PASSWORD` oder stdin, PIN optional über `CREATE_USER_PIN`; idempotent, setzt ein vorhandenes oder deaktiviertes Konto zurück). In der
  Entwicklung legt `BOOTSTRAP_ADMIN_USER`/`BOOTSTRAP_ADMIN_PASSWORD` beim Start einen Inhaber an;
  in Produktion wird das ignoriert.
- **Jede `/api`-Route braucht eine Sitzung** außer login, refresh, pin und station/users - auch
  `/api/partners`. Die Wache sitzt in `app.ts` _vor_ allen Fachroutern; neue Domänen (B4, B5, B7,
  Z\*) werden darunter eingehängt und prüfen Rollen mit `requireRole(...)`. `inhaber` darf alles.
- **Refresh-Tokens rotieren** und müssen vom Client gespeichert werden; ein bloßes Access-Token
  wird an `/refresh` (anders als beim Mock) nicht angenommen. Wer ein bereits rotiertes Token
  erneut schickt, beendet die ganze Sitzung - außer innerhalb von 10 s nach der Rotation, solange
  das Nachfolge-Token unbenutzt ist: dann 409 `refresh_superseded` (zweiter Tab, wiederholter
  Request), die Sitzung bleibt. Für F1: der `AuthProvider` schickt heute alle 5 min einen leeren
  Refresh-Token und würde gegen die echte API abgemeldet; Refreshes über Tabs hinweg
  serialisieren und bei 409 das neue Token aus dem Speicher nehmen.
- **Logout ist öffentlich** und nimmt das Access-Token (Bearer) _oder_ `{ refreshToken }` - ein
  Tablet, dessen Access-Token (1 h) abgelaufen ist, kann seine Sitzung trotzdem beenden. Ohne
  gültiges Token antwortet es wie der Mock mit 200 `Abgemeldet.`
- **Stationen:** ein Inhaber registriert ein Gerät (`POST /api/auth/stations`), das Token kommt
  einmal zurück und wird als `X-Station-Token` geschickt. PIN-Sitzungen enden 12 h nach der PIN.
  Eine PIN-Sitzung trägt die volle Rolle, darf aber **Benutzer und Stationen nicht verwalten**
  (403 `personal_session_required`, auch als `inhaber`) - das geht nur mit Benutzername und
  Passwort. `userId` an `/pin` nur als ganze Zahl oder `"7"` (sonst 400).
- **Rate-Limit** (Fehlversuche je 5 min → 429): 5 je IP + Benutzer, 30 je IP über alle Benutzer
  (Passwort-Spraying), bei der PIN zusätzlich 10 je Benutzer über alle IPs. `req.ip` kommt hinter Caddy aus
  `X-Forwarded-For` (`TRUST_PROXY`, Vorgabe `loopback`).

## Anmeldung, Stationen und Rollen in der Management-App (F1)

Die Management-App spricht den B3-Vertrag (Abschnitt oben). Ohne Sitzung zeigt kein Bildschirm unter
`/admin` oder `/backstube` etwas außer der Anmeldung - weder im Browser noch im Server-HTML/RSC-Payload.
Sieben Dinge, die man wissen muss:

- **Die Sitzung gehört `src/lib/session.tsx`, nicht dem geteilten `AuthProvider`.** `SessionProvider`
  (in `Providers.tsx`) ersetzt in dieser App den `AuthProvider` aus `@bakery/shared/contexts` - der
  schickte alle 5 min einen leeren Refresh-Token und kannte weder PIN noch Pilot-Rollen. Seiten
  lesen `useSession()` (wirft ohne Provider) oder `useOptionalSession()` (Layout, Chat, Produkte,
  Dashboard - rendern auch ohne). `useAuth()` aus den Shared Contexts hat in dieser App **keinen
  Provider** mehr und würde zur Laufzeit werfen - deshalb verbietet
  `apps/bakery-management/.eslintrc.json` (`no-restricted-imports`) `useAuth`, `useCurrentUser`,
  `useIsAuthenticated`, `AuthProvider` und `RootProvider` aus `@bakery/shared/contexts`; ein
  Zweig, der das Muster mitbringt, fällt im Lint statt im Browser.
- **Speicher: `src/lib/authSession.ts`** - `bakery-management-session` (Access- + Refresh-Token,
  Benutzer, `sessionKind`, Anmeldezeit), `bakery-management-activity` (letzte Bedienung, von allen
  Tabs gemeinsam), `bakery-management-station` (Stations-Token; bleibt beim Abmelden stehen). Der
  Benutzer wird mit `normalizeUser()` gelesen: echte API `displayName`/`username`, der Mock
  (`auth.mock.js`) `email`/`firstName` mit `admin` → `inhaber`, `staff` → `verkauf`.
- **401 → genau ein Refresh → Wiederholung.** Der `ApiClient` (`libs/shared/data-access`) fragt bei
  einer 401 auf eine Anfrage _mit_ Bearer einmal `setUnauthorizedHandler()`; die App erneuert dann
  über `refreshSession()` (ein Refresh je Tab, gemeinsames Promise), speichert den rotierten
  Refresh-Token sofort und wiederholt die Anfrage einmal. 409 `refresh_superseded` heißt, ein
  anderer Tab war schneller - dessen Token wird aus dem Speicher übernommen. Scheitert der Refresh
  mit 4xx, ist die Sitzung vorbei; bei Netz- oder Serverfehlern bleibt sie (WLAN-Aussetzer im
  Laden). Login, Refresh, PIN und Logout laufen mit `retryOnUnauthorized: false` (`src/lib/authApi.ts`).
  Zusätzliche Header je Anfrage (`X-Station-Token`) gehen über das neue dritte Argument
  `RequestOptions` von `get/post/put/patch/delete`.
- **Serverseitige Wache: `src/proxy.ts` + Sitzungs-Cookie.** Server-Komponenten lesen hq-Daten
  (Berichtsarchiv, Kassentag, Kassen-Kachel des Dashboards, Produktliste) - ohne Prüfung stünden
  sie im RSC-Payload jeder anonymen Anfrage. Darum spiegelt `authSession.ts` (`saveSession`,
  `restoreSession`, `clearSession`) das **Access-Token** in das Cookie `bakery-management-at`
  (`src/lib/sessionCookie.ts`, `SameSite=Lax`, von JS gesetzt - nicht schwächer als
  `localStorage`, die API nimmt keine Cookies an). Der Proxy fragt damit
  `GET {API_URL}/api/auth/me` (`src/lib/serverSession.ts`: 30 s Cache je Token, abgelaufenes `exp`
  ohne Anfrage, API weg = ungültig) und lässt `/admin/**` und `/backstube/**` (außer
  `/admin/login`) nur rendern, wenn `ROLE_ACCESS` Rolle **und** Sitzungsart die Seite erlauben.
  Sonst schreibt er auf `/admin/sitzung-pruefen` um (URL bleibt, keine Daten, `no-store`); dort
  erneuert `components/auth/SessionCheckPending.tsx` das Token (`GET /api/auth/me`, 401 → Refresh
  → neues Cookie) und holt die Seite mit `router.refresh()` neu - einmal, danach ein Hinweis mit
  „Erneut versuchen" statt einer Schleife. Geprüfte Rolle/Sitzungsart reicht der Proxy als
  `x-bakery-role` / `x-bakery-session-kind` an die Seite (eingehende Header dieser Namen löscht er
  immer); `admin/page.tsx` liest die Kassenzahlen nur, wenn die Rolle `/admin/reports` öffnen darf
  (`mayLoadCashTile`) - Verkauf/Backstube bekommen das Dashboard ohne Kassen-Payload. Wer eine neue
  Server-Komponente mit sensiblen Daten baut, gibt die Route in `ROLE_ACCESS` nur den Rollen, die
  sie sehen dürfen; der Proxy erledigt den Rest. `API_URL` muss für `next start` gesetzt sein (auf
  der Box über `bakery.env`). Ein widerrufenes Token rendert höchstens 30 s weiter Seiten; die API
  lehnt es sofort ab.
- **Client-Wache: `components/auth/RouteGuard.tsx`, in `Providers.tsx`.** Solange `status`
  `loading` ist (Start, `GET /api/auth/me`) oder eine Weiterleitung läuft, steht nur
  `SessionLoading` da - auch im Server-HTML, also kein Aufblitzen geschützter Inhalte. Ohne
  Sitzung: `/admin/login?next=…`, auf einem Gerät mit Stations-Token `/station`; nach „Abmelden"
  (`loggedOut` im Sitzungskontext) **ohne** `?next=`, damit die nächste Person nicht auf der
  letzten Seite der vorigen landet. Sie sitzt nicht
  im Admin-Layout, weil `/backstube` keins hat (und F2s `pilotMode.spec.ts` ein Verzeichnis
  `app/backstube/` ohne `page.tsx` verbietet). Die Rolle prüft unter `/admin` das Admin-Layout
  („Kein Zugriff" statt Inhalt), außerhalb die Wache. Das ist Bedienführung - Daten schützen der
  Proxy (Server-Komponenten) und die API.
- **Eine Tabelle Rolle → Routen + Startseite: `ROLE_ACCESS` in `src/lib/roles.ts`.** Inhaber alles;
  Verkauf Dashboard, `/admin/preorders` (M1), Sammelstelle Mörsbach, Produkte **nur die Liste**
  (ohne Neu/Bearbeiten), Backschrank; Backstube Dashboard, `/admin/backzettel`, `/backstube`;
  Fahrer nur `/admin/delivery/preorders`; alle `/admin/settings`. Startseite = erste _gebaute_
  aus `start` (`ready` aus `PILOT_UPCOMING_NAVIGATION`): Verkauf `/admin/preorders` → bis M1
  `/admin`, Backstube `/backstube` → bis M2 `/admin`. `getNavigationForRole()` filtert
  `getNavigation()` aus F2, Pilotbetrieb und Rolle überlagern sich. Das Dashboard zeigt Kasse,
  Tagesziel und Schnellzugriffe nur, wenn die Rolle die Seite dahinter darf. Wer eine Seite für
  eine Rolle freigibt, ändert nur `ROLE_ACCESS` (Tests: `roles.spec.ts`). `PERSONAL_ONLY_ROUTES`
  (`/admin/users`) sind an einer Station (PIN-Sitzung) auch für den Inhaber gesperrt - wie
  `requirePersonalSession` der API; Navigation, Layout („Kein Zugriff" mit Begründung) und Proxy
  fragen `isPathAllowedForRole(path, role, sessionKind)`.
- **Station (`/station`, außerhalb `/admin`, ohne Seitenleiste).** Ohne Token richtet ein mit
  Passwort angemeldeter Inhaber das Gerät ein (`POST /api/auth/stations`); danach wird seine
  persönliche Sitzung auf dem Tablet beendet. Mit Token: Namenskacheln
  (`GET /api/auth/station/users`) → Ziffernblock (`components/auth/PinPad.tsx`, PIN bleibt String,
  `"0420"`) → `POST /api/auth/pin` → Startseite der Rolle. Eine widerrufene Station (403
  `station_required`) vergisst ihr Token und zeigt wieder die Einrichtung. Leerlauf
  (`src/lib/sessionPolicy.ts`): Station nach `NEXT_PUBLIC_STATION_IDLE_MINUTES` (10) zurück zu den
  Kacheln, spätestens 12 h nach der PIN; optional zur Uhrzeit `NEXT_PUBLIC_STATION_LOGOUT_AT`
  (`HH:MM`, Ortszeit, z. B. Ladenschluss - ohne Wert keine feste Uhrzeit, weil die Backstube
  nachmittags vorbereitet); persönlich nach `NEXT_PUBLIC_IDLE_LOGOUT_HOURS` (12 h).
  „Abmelden" (`components/auth/LogoutButton.tsx`) steht in der Kopfzeile, auf Stationen groß -
  Z6 (`/backstube`, ohne Admin-Layout) muss ihn selbst einbinden.

Dazu: `/admin/users` (nur Inhaber) verwaltet Konten, Rollen, Passwörter, PINs und Stationen
(Widerrufen); Fehler wie `last_inhaber` kommen als deutsche API-Meldung in den Dialog.
**`src/proxy.ts`** (Next 16, früher `middleware.ts`) schreibt außerdem im Pilotbetrieb gesperrte
`/admin`-Routen auf `/admin/nicht-verfuegbar` um (`src/lib/pilotRewrite.ts`), sodass die
Demo-Seiten serverseitig gar nicht mehr rendern. Die E2E-Smoke-Suite meldet sich an der Mock-API
an (`apps/bakery-management-e2e/src/login.ts`, `admin`/`admin`, Rolle aus der Antwort normalisiert),
legt die Sitzung in `localStorage` **und** das Sitzungs-Cookie, und prüft, dass eine anonyme
`GET /admin/products` keinen Produktnamen enthält.

Tests: `src/lib/{authSession,roles,sessionPolicy,serverSession}.spec.ts`, `src/proxy.spec.ts`
(beide `@jest-environment node` - `test-setup.ts` legt die Browser-Attrappen nur mit `window` an),
`admin/page.spec.tsx` (Kassen-Kachel nach Rolle), `components/auth/SessionCheckPending.spec.tsx`,
`src/lib/session.spec.tsx`,
`src/lib/session.refresh.spec.tsx` (echter `ApiClient`, nachgebautes `fetch`),
`components/auth/RouteGuard.spec.tsx`, `admin/login/page.spec.tsx`, `station/StationClient.spec.tsx`,
`admin/users/UsersClient.spec.tsx`, `admin/layout.roles.spec.tsx`,
`libs/shared/data-access/src/lib/api-client.spec.ts`. Specs nutzen `src/lib/testing/fakeSession.tsx`
und `memoryStorage.ts`; nicht `jest.resetAllMocks()` in MUI-Specs - das nimmt `test-setup.ts` die
`ResizeObserver`-Attrappe.

## Box-Betrieb (`deploy/`, roadmap O1–O4)

Pilot-Betrieb auf einem Rechner in der Bäckerei: systemd-Units, Caddy (LAN-HTTPS über DNS-01),
Umgebungsvorlagen und Skripte (Einrichtung, Pull-Deploy, hq-Sync, Backup/Restore, Health-Check
mit Telegram) in `deploy/`; Bedienung und Störungen in `docs/runbook.md`. Tests:
`deploy/tests/run-tests.sh` (macOS/Linux, ohne root, Ports 5120–5124, nur synthetische Daten).
Was man vor einer Änderung wissen muss:

- **Node 22 LTS** auf der Box (Node 20 ist seit 30.04.2026 ohne Sicherheitsupdates).
- **Zwei Env-Dateien:** `/etc/bakery/bakery.env` (API + Verwaltung, root:bakery 0640) und
  `/etc/bakery/ops.env` (Telegram, restic, Deploy; root:root 0600, liest nur systemd). Neue
  Geheimnisse der Betriebs-Skripte gehören in `ops.env`, nie in `bakery.env`.
- **`NEXT_PUBLIC_*` werden beim Build eingebacken** – Änderung heißt `deploy.sh --rebuild`.
  `npm ci` und Build laufen mit geleerter Umgebung (`env -i` + Whitelist `DEPLOY_BUILD_ENV_KEYS`);
  braucht der Build eine neue Variable, dort freigeben, nicht die Whitelist aushebeln.
- **Was root ausführt, kommt nie aus einem Release** (das gehört `bakery`, npm-Skripte liefen
  darin), sondern aus dem root-eigenen Klon `/opt/bakery/src`.

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
