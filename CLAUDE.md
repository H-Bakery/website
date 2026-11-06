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
reports, finance, targets, preorders, Backzettel) are added by their roadmap tasks. Since F4 the
management app's pilot screens run against this API (see „Verwaltung auf der echten API (F4)");
shop and delivery still talk to `serve:api:simple`. Details in `apps/bakery-api/CLAUDE.md`.

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
- **Die Wochentags-Vorlage füllt „Neu“ nur bei der Erstbestückung.** Die Erfassungsmaske merkt
  sich, welche Mengen aus der Vorlage stammen, und nimmt die unveränderten wieder heraus, sobald
  die Art auf Nachlieferung oder Abholung wechselt; hat der Tag schon eine Erstbestückung, startet
  die Maske als Nachlieferung. Sonst bucht eine Abholung die Vorlage ein zweites Mal als geliefert
  (W4-Verifikation: Geliefert 160 statt 80).
- **`csvCell()` maskiert Formelzellen.** Partner- und Produktnamen landen im CSV-Report; eine
  Zelle, die mit `=`, `+`, `-`, `@`, Tab oder CR beginnt, bekommt ein Apostroph voran und wird
  eingefasst, sonst führt Excel sie aus. Schlichte Zahlen (`-5`) bleiben Zahlen.
- **Mehr gezählt als möglich ist Abweichung, nie Retoure** (seit W4-Verifikation Runde 2). Liegt
  ein gezählter Rest über dem errechneten Bestand, bucht der Core den Überschuss als
  `discrepancyQty`; die Retoure einer Abholung ist höchstens der Bestand. Tageskarte und Report
  zeigen die Abweichung, die Erfassungsmaske fragt vorher nach, das CSV hat eine Spalte
  `Abweichung`. Ändert sich ein Preis im Zeitraum, trägt `byProduct` `unitPriceMin`/`unitPriceMax`
  und der Report zeigt die Spanne (`1,60–1,80 €`) - sonst ergäbe Einzelpreis × Verkauft nicht den
  Umsatz.

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

### Verkaufspartner auf der echten API (B6)

Die 14 Partner-Routen der TypeScript-API (`apps/bakery-api/src/routes/partner.routes.ts`,
`createPartnerRouter()`) sind gehärtet; Details in `apps/bakery-api/CLAUDE.md`, Abschnitt
„Partners (B6)". Von außen wichtig:

- **Rollen.** Lesen: jede Sitzung. Besuche erfassen, korrigieren, löschen: `inhaber`, `verkauf`,
  `fahrer` (`backstube` → 403). Partner-Stammdaten (`POST`/`PUT /api/partners[/:id]`) und
  Standard-Bestückung (`PUT …/templates/:weekday`): nur `inhaber`. Jeder Schreibzugriff steht mit
  Benutzer im `audit_log`; `staffId` eines Besuchs kommt aus der Sitzung, nie aus dem Body,
  `staffName` ist ohne Angabe der Anzeigename.
- **Produkte aus dem hq-Katalog** (B5, `hq-catalogue.ts`, freigegebener Stand, dasselbe
  Verzeichnis wie `/api/products`): `validateVisitItems` bekommt jetzt auch auf der echten API den
  Katalog - Name und Kennungen aus hq, Preis aus hq, wenn der Request keinen schickt, ein Produkt
  außerhalb des Katalogs 400 `INVALID_ITEMS`. Beim Korrigieren gilt der gespeicherte Snapshot
  zusätzlich (ein inzwischen gelöschtes Produkt bleibt korrigierbar). Fehlt das hq-Verzeichnis
  ganz, antwortet die API 503 `hq_unavailable` statt „Unbekanntes Produkt".
- **Eine Erstbestückung je Tag - geprüft in der Transaktion.** Die Doppelprüfung (POST und PATCH)
  läuft in der serialisierten Schreib-Transaktion; zwei gleichzeitige Erfassungen ergeben genau
  ein 201 und ein 409 `DUPLICATE_INITIAL_VISIT`. Wandert ein Besuch per PATCH auf einen anderen
  Tag, bekommt er dort die nächste laufende Nummer.
- **Mock-Vertrag (D3) angeglichen:** `GET /api/partners?active=true|false`, neuer Partner ohne
  `deliveryDays` = Di-Sa, Vorlagen-`PUT` antwortet 200 (auch beim Anlegen), ergänzt Kennungen aus
  hq, lässt Menge 0 weg und lässt `active` stehen, wenn der Request es nicht nennt (vorher setzte
  jedes Speichern die Vorlage wieder aktiv); `DELETE` eines Besuchs antwortet 200
  `{ id, deleted: true, message }` statt 204. **Bewusst anders als der Mock:** eigene
  Fehlercodes (`INVALID_ITEMS` statt `Invalid items`, plus `success: false` - das Frontend liest
  nur `message`), `GET …/templates` legt beim Lesen keine leeren Vorlagen an, `from > to` ist 400,
  ein PATCH nur mit `visitAt` verschiebt den Geschäftstag nicht (ein ausdrücklicher `visitAt` muss
  aber höchstens einen Tag neben dem Geschäftstag liegen, sonst 400 `INVALID_VISIT_AT`; Steuer- und
  Bidi-Zeichen in Stammdaten, `staffName` und Notiz sind 400 `INVALID_TEXT` - Regel einmal in
  `src/services/control-chars.core.js`, auch für Vorbestellungen, Sammelstellen, Stationsnamen,
  Backzettel-Gründe, hq-Produkte und Anzeigenamen; seit W4-Verifikation Runde 3 zählen auch BOM und
  U+2028/U+2029) (die Erfassungsmaske schickt
  `businessDate` immer mit), ungültiges `settlementModel` ist 400 statt stillschweigend
  `commission`; seit der W4-Verifikation prüft die Vorlage ihre Positionen wie ein Besuch (Menge
  ganzzahlig 0…10000, Produkt im Katalog oder schon in der Vorlage, sonst 400 `INVALID_ITEMS`),
  Freitexte haben Längengrenzen (400 `TEXT_TOO_LONG`) und der Geschäftstag eines Besuchs liegt
  zwischen 2020-01-01 und heute + 7 Tage. Die Vorlagen-Seite sperrt die Felder für alle außer dem
  Inhaber und lehnt mehr als 10.000 Stück je Position schon vor dem Speichern ab.
- **Parity:** `apps/bakery-api/tests/parity/partners.parity.test.ts` spielt dasselbe Szenario
  (Partner, Vorlage, Besuche, Korrektur, Tageswechsel, Löschen, Kennzahlen, Report, CSV) auf
  Mock und echter API durch und vergleicht Status, Form und - wo beide dieselben Daten halten -
  die Werte; das CSV byte-genau. Die Abweichungen oben sind dort als Erwartung festgeschrieben.
- **CSV-Export (F4):** `downloadReportCsv()` in `partnerApi.ts` holt den Report über
  `apiClient.getBlob()` (Bearer, 401 → Refresh) und speichert ihn als Blob; der frühere
  schlichte Link (`reportCsvUrl()`, ohne Token → 401) ist entfernt.

**Import des Mock-Stores** (`partner-store.json` → SQLite), idempotent, in einer Transaktion:

```bash
npm run build:api
DB_PATH=/var/lib/bakery/bakery.db npm run api:import-partners -- \
  --file apps/bakery-api/data/partner-store.json --dry-run      # erst durchrechnen
DB_PATH=/var/lib/bakery/bakery.db npm run api:import-partners -- \
  --file apps/bakery-api/data/partner-store.json                # dann übernehmen
# = node dist/apps/bakery-api/bundle/cli.js import-partners --file … [--dry-run] [--update-partners]
```

Partner werden über den Slug wiedererkannt (der geseedete CAP-Markt bleibt, wie er ist; mit
`--update-partners` bekommen vorhandene Partner und Vorlagen die Stammdaten aus der Datei),
Vorlagen über Partner + Wochentag, Besuche über Partner + Geschäftstag + Typ + Zeitpunkt - ein
zweiter Lauf legt nichts doppelt an. Positionen behalten ihren **Preis- und Namens-Snapshot** aus
der Datei (kein Nachschlagen in hq). `staffId` des Mocks wird nicht übernommen (zeigt auf keinen
Benutzer), `staffName` schon. Geprüft wird mit den Regeln der Erfassung; was nicht passt
(ungültiger Tag, zweite Erstbestückung, auch gegen schon erfasste Besuche in der Datenbank),
wird übersprungen und aufgelistet - Exit-Code 2, sonst 0, bei unbrauchbarer Datei 1 (dann wird
die Datenbank gar nicht geöffnet). `--dry-run` rechnet den ganzen Import in der Transaktion durch
und rollt zurück. Regeln: `src/services/partner-import.core.js` (Tests
`tests/unit/partnerImportCore.test.js`), Schreibseite `partner-import.service.ts`
(`tests/integration/partnerImport.test.ts`, CLI `partnerImportCli.test.ts`), synthetische
Vorlage `tests/fixtures/partner-store.synthetic.json`.

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
Fehler mit `message` **und** `error`. Die echte TypeScript-API hängt seit B4 dieselben Module ein
(siehe „Berichte und Finanzen auf der echten API (B4)"); der alte DB-basierte Vertrag ist gelöscht.

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
  `admin/navigation.ts` führt `/admin/preorders` (M1), `/admin/preorders/abholliste`, `/admin/backzettel`
  und `/backstube` (M2) mit einem `ready`-Schalter - seit Welle 3 sind alle vier `ready: true` (P1/P3,
  P2, Z4/Z5, Z6); ein Eintrag erscheint (direkt unter dem Dashboard) erst mit `ready: true`.
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
  echte API hat kein `/api/notifications`. **Ohne Pilotbetrieb gegen die echte API** (W4) fragt er
  einmal; ein 404/501 setzt `available: false` im Kontext, beendet das Pollen ohne
  `console.error` und merkt sich das im `sessionStorage` des Tabs
  (`bakery-notifications-unavailable`) - die Einstellungen blenden „Benachrichtigungen" dann
  still aus. Die eine 404-Zeile im Netzwerk-Log des Browsers bleibt.

Tests: `src/lib/pilotMode.spec.ts`, `src/app/admin/layout.pilot.spec.tsx`,
`src/app/admin/DashboardClient.spec.tsx` (Management-App) und
`libs/shared/contexts/src/lib/notification/notification.loadOnMount.spec.tsx`.

## PWA der Management-App (F3)

Eine installierbare App „Heusser Verwaltung" für Handy, Laden-Tablet, Backstube und Büro-PC (D7).
Name, Farben, Icon-Pfade und die Registrierungsregel stehen **einmal** in
`apps/bakery-management/src/lib/pwa.ts`; Manifest (`src/app/manifest.ts` → `/manifest.webmanifest`),
Metadaten/Viewport (`src/app/layout.tsx`) und Registrierung lesen von dort. Fünf Dinge:

- **Der Service Worker cacht nur die App-Hülle.** `public/sw.js` (statisch, kein Build-Schritt):
  `/_next/static/*`, `/icons/*`, `/favicon.ico` cache-first; `/offline.html` beim Installieren.
  **Nie** `/api/*` (auch nicht als direkt geöffneter Link) und nie HTML - Seitenaufrufe gehen immer
  ans Netz und werden nicht abgelegt. Antwortet der Server nicht oder meldet Caddy 502-504, kommt die
  Offline-Seite „Keine Verbindung zum Server – bitte WLAN prüfen". RSC-Abrufe, Manifest und fremde
  Hosts reicht er unberührt durch. Wer dort etwas cachen will, das Daten trägt: nicht.
- **Registriert wird nur im Produktions-Build** (`shouldRegisterServiceWorker`: `NODE_ENV ===
'production'`, Browser-Support, sicherer Kontext - HTTPS über Caddy oder localhost). In
  `next dev` und jest nie; dort meldet `ServiceWorkerRegistration` einen alten Worker der App sogar
  ab und löscht seine `heusser-verwaltung-*`-Caches (sonst lieferte ein früher `next start` auf
  4201 alte Chunks an `next dev`). Notschalter auf der Box: `NEXT_PUBLIC_DISABLE_SW=1` beim
  **Build** - meldet beim nächsten Aufruf ab.
- **Je Build eine neue Worker-Version.** `next.config.js` setzt `NEXT_PUBLIC_SW_VERSION`
  (`SW_VERSION` aus der Umgebung, sonst Zeitstempel); registriert wird `/sw.js?v=<Version>`, der neue
  Worker löscht beim Aktivieren die Caches der alten. `/sw.js` geht mit `Cache-Control: no-cache,
no-store` raus. Das Cache-Präfix steht in `sw.js` und `pwa.ts` - `pwa.spec.ts` prüft, dass beide
  gleich sind.
- **Theme: `createManagementTheme(mode)` in `src/lib/muiTheme.ts`** (W4-Verifikation, Kontrast):
  `contrastThreshold: 4.5` (Schrift auf `*.main` erst ab 4,5:1 weiß, sonst schwarz) und hell
  `warning.main` #a14a00 / `info.main` #0277bd - das MUI-Orange #ed6c02 lag als Text und unter
  weißer Schrift bei 3,1:1. `primary` und Hintergründe bleiben Standard. Gestrichene Zeilen
  (storniert, Lücken im Kassenarchiv) mit `text.secondary`, nicht `text.disabled`/`opacity`.
  Die AppBar heißt „Verwaltung", der Seitentitel „Bäckerei Heusser - Verwaltung".
  **Touch-Ziele:** dasselbe Theme gibt `MuiButton`/`MuiIconButton`/`MuiToggleButton` unter
  `TOUCH_MEDIA` (`pointer: coarse` oder schmaler als 1200 px) mindestens 44 px; Inline-Links
  (Telefon, Kurzcode) bekommen `TOUCH_LINK_STYLE`. Am Büro-PC mit Maus bleibt MUI kompakt.
- **Statusleistenfarbe = AppBar-Farbe.** Hell `#1976d2` (`primary.main`), dunkel `#272727`
  (`background.paper` + Elevation-4-Overlay). `pwa.spec.ts` rechnet beides aus `createTheme` nach;
  wer das Theme ändert, zieht `PWA_THEME_COLORS` nach. Die Metadaten liefern je
  `prefers-color-scheme` einen Startwert, `ThemeColorSync` (in `Providers.tsx`) setzt danach den
  echten Modus der App (Standard dunkel). Das Manifest kennt nur eine Farbe: die dunkle.
- **Icons** aus dem Heusser-Monogramm des Shops (`apps/bakery-shop/public/favicon.svg`):
  `node apps/bakery-management/pwa/render-icons.mjs` schreibt die SVG-Quellen nach `pwa/` und die
  PNGs (192/512 `any`, 192/512 `maskable`, 180er Apple-Touch-Icon) nach `public/icons/`.

Für F1 (`middleware.ts`): `/sw.js`, `/manifest.webmanifest`, `/offline.html`, `/icons/*` und
`/favicon.ico` müssen ohne Anmeldung erreichbar bleiben - sonst scheitert die Installation des
Workers, und die Offline-Seite kommt nie in den Cache.

Layout geprüft (Playwright, `next dev`, Pilotbetrieb, ohne API) bei 320, 390, 820, 844×390 und
1440 px in hell und dunkel: kein waagrechtes Scrollen der Seite; unter 900 px (`md`) klappt die
Seitenleiste zur Schublade ein - auch auf dem Tablet hochkant (820 px), quer (1180 px) steht sie
fest. Breite Tabellen (Kassenberichte, Produktliste) scrollen in ihrem eigenen Container.

Tests: `src/lib/pwa.spec.ts` (Manifest, Icon-Dateien und -Größen, Farben gegen MUI, Registrierungsregel),
`src/lib/sw.spec.ts` (führt `public/sw.js` in einer nachgebauten Worker-Umgebung aus: kein `/api`,
kein HTML im Cache, Netz zuerst, Offline-Seite), `src/components/pwa/ServiceWorkerRegistration.spec.tsx`,
`src/app/layout.spec.tsx` (Metadaten, Viewport).

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
- **Vorbereitungen mit Variante** (`by_weekday: { 6: gross }`) zeigen die ID nur als Notbehelf
  („Gross"); den deutschen Namen trägt `variant_labels: { gross: groß }` an der Aufgabe, die API
  liefert ihn als `variantLabel`.
- **Rezeptpfade nur relativ unter `data/recipes/` und `.md`** - Validator und Loader prüfen das
  beide; die YAML schreibt später die App (B5b).
- **Ein unvollständiges Rezept wird nicht hochgerechnet** (W4-Verifikation Runde 2): hat eine
  Zutat keine Grammangabe (`1 Dose (ca. 2 kg)`, `2–4 g`), liefert `scaleRecipe` `factor: null`,
  `batch_g: null` und keine skalierten Mengen; Tablet, Planung und Druck zeigen das Grundrezept
  mit Hinweis. Sonst entstand aus der Summe der lesbaren Zutaten ein falscher Faktor.
- **Nachträge und Chargen:** `deltaExtras.doughs[]` trägt `batchesBefore` und `batch_max_kg`,
  `deltaExtras.fillings[].recipe` das Rezept für die Zusatzmenge; der Hinweis nennt „jetzt 4
  Chargen statt 3“ und, wenn der Zusatzteig größer als eine Charge ist, wie viele Chargen er braucht.
- **Eine Korrektur darf die Zeile nicht unter 0 drücken** (400 `correction_exceeds_line`). Wird
  eine Zeile später kleiner (Grundmenge, Storno), steht sie mit `correctionClamped` und der
  Warnung `correction_exceeds_line` da - nie still auf 0.
- **Variante = Füllungs-ID.** Gefüllte Ware ohne Variante zählt im Teig, aber nicht in der Füllung
  (`filling_unassigned`); unbekannte Produkte/Varianten werden als Warnung gemeldet, nie verschluckt.
- `formatTrayInfo` ist ein **Duplikat** von `feature-daily-prep/.../utils/trayInfo.ts`; beide
  ändern.
- **Bleche zählen nach der Menge der Zeile** (`trayText(tray, total, unit)`, W4-Verifikation
  Runde 3): `per_tray` ist Stück je Blech, die Angabe heißt also bei 40 Croissants à 12
  „4 Bleche à 12 (Bleche 1, 2 + 2 weitere)“, nicht „2 Bleche à 12“. Ohne `per_tray`, ohne
  Menge oder bei Litern bleibt die reine Blechliste aus der YAML.
- CLI für das hq-CI (H2): `node apps/bakery-api/scripts/validate-backzettel.js <yaml> [productsDir]
[--json]`, Exit 1 bei Fehlern. Der Loader braucht `js-yaml` ^4 (Root-`dependencies`); das hq-CI
  muss es selbst installieren. Im API-Bundle landen die Dateien, sobald eine gemountete Route sie
  `require`t (esbuild, B0) - `js-yaml` bleibt dann extern.

Tests: `npx jest -c apps/bakery-api/jest.config.js apps/bakery-api/tests/unit/backzettel` (117,
synthetische Fixtures in `tests/fixtures/backzettel.synthetic.js`).

## Berichte und Finanzen auf der echten API (B4)

Die echte API (`createApp()`) hängt `reports.mock.js`, `finance.mock.js` und `targets.mock.js`
**unverändert** ein (`apps/bakery-api/src/routes/hq-data.routes.ts`) - dieselben Dateien wie
`simple-server.js`, nicht kopieren; umbenannt wird in B12. Rechte im Pilot: Berichte und Analysen
nur `inhaber` (auch an der PIN-Station), Finanzen und Tagesziel nur `inhaber` **mit Passwort-
Sitzung** (an der Station 403 `personal_session_required`). Die Rolle `admin` der Mock-Module wird
über einen Adapter auf `inhaber` abgebildet. Pfade aus `HQ_REPORTS_DIR` / `HQ_FINANCE_DIR`. Die
Parity-Suite `apps/bakery-api/tests/parity/hq-data.parity.test.ts` vergleicht beide Server auf
einem synthetischen hq-Baum (`tests/fixtures/hq-data.synthetic.js`) bis aufs Byte. Details:
`apps/bakery-api/CLAUDE.md`, Abschnitt „hq data (B4)".

## Backzettel-API (Z3, echte API)

`/api/backzettel` auf der TypeScript-API; Endpunkte, Rollen und Antwortform in
`apps/bakery-api/CLAUDE.md`, Abschnitt „Backzettel API (Z3)". Was man von außen wissen muss:

- **Stammdaten:** `HQ_BACKZETTEL_CONFIG`, sonst `${HQ_DIR}/config/backzettel.yaml`. Fehlen sie oder
  sind sie ungültig, antwortet `GET /api/backzettel/:datum` mit `status: 'no-config'` und `reasons`,
  Schreibversuche mit 409 `no_config` - **nie** mit geschätzten Mengen. Ein schon freigegebener Tag
  bleibt lesbar.
- **Entwurf wird live gerechnet** (Grundmenge × Saison + Vorbestellungen ohne `storniert` + CAP-Vorlage
  des Wochentags + Korrektur). Gespeichert werden nur Saisonfaktor und Korrekturen; eine Korrektur
  ≠ 0 braucht einen Grund. Montag (allgemein: Wochentag nicht in `days`) ist 409 `ruhetag`.
- **Freigeben friert ein**: Zeilen, Vorbestellungs-Schnappschuss und - in `computed_snapshot` -
  Hefeteig, Füllungen, Vorbereitung und Hinweise. Eine spätere Änderung an YAML oder Rezepten
  ändert einen freigegebenen Zettel nicht; `configChangedSinceConfirm: true` sagt nur, dass die
  aktuellen Stammdaten jetzt etwas anderes ergäben. Danach kommen spätere
  Vorbestellungen als **Deltas** dazu - je Vorbestellung und Änderung eine Zeile, hervorgehoben,
  von der Backstube quittiert (`ack`), nie still in die Zeilen gemischt. **Seit W4 schreibt sie
  der Schreibweg der Vorbestellung** (Anlegen, Ändern, Status, Storno, Sammelaktion - in derselben
  Transaktion), nicht mehr das Lesen: `GET /api/backzettel/:datum` schreibt in der Anfrage nichts und sagt
  mit `deltasPending`, ob noch etwas nachzutragen ist. Was geschrieben wurde, während die
  Stammdaten fehlten (oder per CLI-Import), trägt ein Abgleich nach (Serverstart, Freigabe,
  Wiederöffnen, nächste Änderung des Tages - und **im Hintergrund, sobald ein Lesen
  `deltasPending: true` findet**; Details in `apps/bakery-api/CLAUDE.md`). Tablet und
  Planungsseite zeigen `deltasPending` als Hinweis und laden nach 5 s nach (höchstens 6-mal);
  fehlen die Stammdaten an einem freigegebenen Tag, sagt das Tablet, dass Nachträge fehlen können
  - nie still. Nur der Inhaber kann
    wieder öffnen; Abhaken (`done`/`undone`) geht nur an freigegebenen Tagen. **Braucht eine erneute
    Freigabe mehr von einer Zeile, fällt ihr Haken weg** (steht als `clearedTicks` im Audit) - sonst
    sähe die Backstube eine erledigte Zeile und übersähe die zusätzlichen Stücke. Wird sie kleiner,
    bleibt der Haken (`tickStillValid`, W4-Verifikation Runde 3: 14 gebacken, 12 nötig = fertig). Was damals schon
    gebacken war, steht danach als `previouslyDone: { qty, at, by }` an der offenen Zeile (aus dem
    `confirm`-Audit, bis sie wieder abgehakt ist); Tablet, Planung und Druck zeigen „bereits 30
    erledigt … - noch +10".
- `prepDate` ist der Kalender-Vortag; ist der selbst Ruhetag (Dienstag), steht
  `prepDateProvisional: true` - wer dann vorbereitet, ist offen (Q-B2).
- **Was Nachträge für Ofen, Teig und Füllung heißen** (W4-Verifikation): je Zeile
  `delta.bake` = `roundUp(exakt + Nachtrag) − roundUp(exakt)` (`deltaBakeExtras` in
  `backzettel-day.core.js`; `exakt` = Vorbestellungen vor dem Aufrunden, seit dieser Änderung im
  `computed_snapshot` als `preordersExact`; ältere Freigaben rechnen mit der gerundeten Menge - eher
  eine Einheit zu viel als zu wenig). Abzeichen sagen das mit Einheit („Nachtrag +1 l",
  „Nachtrag +0,25 · 1 mehr backen"). `deltaExtras` am Tag nennt, was Hefeteig und Füllungen
  dadurch zusätzlich brauchen; Hefeteig-Karte, Backstube-Tablet und Druckseite 2 zeigen es über
  dem freigegebenen Stand (der bleibt eingefroren). Druckseite 1 ist knapper gesetzt und bricht
  nur zwischen Abschnitten um (`.bz-section`).
- Rollen: lesen jede Sitzung; planen, freigeben, abhaken, quittieren `inhaber` + `backstube`.
  Jede Änderung steht im `audit_log`.
- **Planen und Freigeben nur von heute − 7 bis heute + 90 Tage** (400 `date_out_of_range`,
  W4-Verifikation) - ein Tippfehler in der URL committete sonst einen Backzettel für 9999-12-31
  nach hq `main`.

## Grundmengen (Z4, `/admin/backzettel/grundmengen`)

Tabelle Posten × Di–So (nach Abschnitt, Hefeteig-Posten mit Sorten-Zeilen) zum Pflegen der
Grundmengen in `hq/config/backzettel.yaml`; PC zuerst, Inhaber und Backstube schreiben, alle
anderen sehen nur Werte. API: `PUT /api/backzettel/config/base`, `GET /api/backzettel/reference`,
erweitertes `GET /api/backzettel/config` - Details in `apps/bakery-api/CLAUDE.md`, Abschnitt
„Grundmengen (Z4)". Was man von außen wissen muss:

- **Geschrieben wird wie bei den Produkten (B5/B5b):** Schreib-Worktree `app/edits`, ein Commit je
  Zelle, Push + rollende PR. Bis zum Merge rechnet der Backzettel mit dem **freigegebenen** Stand;
  die Seite zeigt den Arbeitsstand, ein Banner „Wartet auf Freigabe" und je geänderter Zelle den
  freigegebenen Wert im Tooltip. Ohne Schreibziel (`writable: false`, Grund in `writeIssue` -
  auch ein Worktree, der nicht auf `app/edits` steht oder kein git-Repo ist) ist die Seite nur
  lesbar; ebenso nach einer 503 `hq_write_*` beim Speichern.
- **Kommentare und Reihenfolge der YAML bleiben**; die API ändert nur die eine Stelle
  (`backzettel-config.editor.js`), ein Speichern ohne Änderung ist ein Null-Diff. Geprüft wird vor
  dem Commit mit `validateBackzettelConfig`; nur Fehler, die die Änderung **neu** einführt, lehnen
  ab (400 mit `errors`, die Seite zeigt sie an der Zelle). Deshalb liefert `working.config` die
  normalisierte Config auch bei `status: 'no-config'`, solange die YAML lesbar ist: ein fremder
  Fehler (z. B. ein in hq gelöschtes Produkt) zeigt eine Warnung über der Tabelle, sperrt sie aber
  nicht.
- **Zellen:** leer = `null` („noch nicht festgelegt"), `0` = wird nicht gebacken, kein Eintrag
  zeigt „0". Komma geht. Gespeichert wird bei Enter/Verlassen nur, wenn sich der Wert geändert
  hat; Escape verwirft.
- **Referenzwert grau neben jeder Zelle:** Median der verkauften Stück an den letzten 6 gleichen
  Wochentagen **mit Kassenbericht** (Tooltip „Median verkauft, letzte 6 gleiche Wochentage"),
  über die `plu`-Liste des Postens. Tage ohne Bericht sind Lücken, nicht 0. Er wird **nie**
  übernommen - nur Information. Bei Liter-/Blech-Posten steht „St." dahinter (Kasse zählt Stück);
  mehrere PLUs (Größen) werden ohne Umrechnung zusammengezählt, der Tooltip sagt das.
- **Drucken:** eigenes Druckbild (`GrundmengenPrint.tsx`, A4 quer, schwarz auf weiß, alle Tage
  Di–So, geänderte Werte mit `*` und dem freigegebenen in Klammern); das Bildschirm-Raster
  (`grundmengen-screen-only`) und die App-Hülle fallen im Druck weg. Mit `page.pdf()` prüfen, nicht
  mit einem Screenshot.
- **Client:** `src/lib/grundmengenApi.ts` (getrennt von `backzettelApi.ts`, das gehört Z5),
  Fixtures `grundmengenFixtures.ts` (erfunden). `admin/backzettel/page.tsx` ist die Übersicht aus Z5;
  sie verlinkt „Grundmengen" für Rollen, die die Seite öffnen dürfen (Inhaber, Backstube).
- `yaml` wird ins API-Bundle gepackt (nur transitive Dev-Abhängigkeit im Root); `build.mjs`
  bricht ab, wenn im Root nicht `yaml@2` liegt.

Tests: `src/lib/grundmengenApi.spec.ts`, `admin/backzettel/grundmengen/GrundmengenClient.spec.tsx`
und die API-Suites (`backzettelBaseEdit`, `backzettelReference`, `backzettelGrundmengen`).

## Backzettel-Tagesplanung und Druck (Z5/Z7, Management-App)

`/admin/backzettel` (kommende Produktionstage) und `/admin/backzettel/[datum]` (ein Tag) gegen
`/api/backzettel` der echten API. Der Navigationseintrag „Backzettel" ist `ready: true`. Was man
wissen muss:

- **Ein Client, kein Rechnen:** `src/lib/backzettelApi.ts` (Typen + alle Endpunkte, auch Abhaken für
  Z6) und `src/lib/backzettelFormat.ts` (Kalender, deutsche Zahlen, Sortennamen aus
  `config.fillings`). Jede Menge auf dem Bildschirm und im Druck kommt so vom Server; die Seite rechnet
  nichts nach. Die 409 `ruhetag` liefert `fetchBackzettelDay` als Zustand `status: 'ruhetag'`, nicht
  als Fehler; `no-config` zeigt eine Erklärung **ohne Zahlen**. Entwurfszeilen haben `id: null` -
  Korrekturen gehen über `itemId`/`variant` (`correctionPath`), Zeilen werden über `key` gefunden.
- **Rollen:** planen (Saisonfaktor, Korrektur mit Pflichtgrund ≠ 0, Freigeben mit Rückfrage)
  `inhaber` + `backstube`; „Wieder öffnen" nur `inhaber`; alle anderen sehen „Nur Ansicht". Verkauf
  darf die Seiten jetzt öffnen (`ROLE_ACCESS`, lesen) - im Laden sieht man, was gebacken wird -
  **außer** `/admin/backzettel/grundmengen` (Z4, nur Inhaber/Backstube): die Regel ist
  `{ path: '/admin/backzettel', except: ['/admin/backzettel/grundmengen'] }` (`RouteRule` kennt dafür
  `except`, `roles.spec.ts` prüft es).
- **Ein anderes Gerät war schneller:** antwortet Freigeben, Wieder öffnen, Saisonfaktor oder eine
  Korrektur mit 409 `confirmed`/`not_confirmed`/`no_config`/`ruhetag`, lädt die Seite den Tag neu und
  hängt „Der Backzettel wurde neu geladen." an die Meldung - kein Entwurf mit aktiven Knöpfen über
  einem schon freigegebenen Tag. Freigegeben wird, was der Server **jetzt** rechnet; weicht ein Gesamt
  von der Anzeige vor dem Klick ab (z. B. Vorbestellung inzwischen), nennt ein Hinweis die Zeilen
  (`changedTotals`, vergleicht nur Server-Zahlen).
- **Negative Korrekturen am iPhone:** die Ziffernblöcke (`inputMode` numeric/decimal) haben auf iOS
  kein Minus. Darum hat das Feld einen ±-Knopf (44 px, `toggleSign`); `parseDecimal` nimmt auch das
  typografische Minus (U+2212). Nicht auf `inputMode: 'text'` „vereinfachen" und den Knopf nicht
  entfernen.
- **Übersicht:** heute bis heute + 6 Tage, nur `config.days` (ohne Stammdaten Di–So); oben groß der
  **nächste Produktionstag = der erste nach heute** (heute wird schon gebacken). Je Tag ein
  `GET /api/backzettel/:datum` - seit W4 ohne Nebenwirkung (Deltas schreibt der Schreibweg der
  Vorbestellungen).
- **Bildschirm:** ab `md` eine Tabelle je Abschnitt (feste Spaltenbreiten), darunter Karten; beide
  stehen im DOM und werden per CSS umgeschaltet (Specs greifen über `table-<abschnitt>` /
  `line-card-<key>`). Offene Nachträge: Zeile mit Warnrand + Chip, Karte „Nachträge seit der
  Freigabe" mit „Gesehen". `configChangedSinceConfirm` und `prepDateProvisional` stehen als Hinweise
  da. Bedienelemente ≥ 44 px.
- **Druck (Z7):** `components/backzettel/BackzettelPrint.tsx`, eigenes schlichtes HTML, auf dem
  Bildschirm unsichtbar; im Druck verschwinden `.bz-screen` und die App-Hülle. S. 1 Backzettel (alle
  Abschnitte, Gesamt groß, Kästchen, Nachträge, Hinweise; Entwurf mit Banner), S. 2 nur mit
  Hefeteig/Füllungen (Abwiegeliste + skalierte Rezepte), S. 3 nur mit Vorbereitungen. **Die
  Druckregeln schalten Animationen ab** - `global.css` blendet `body` und jedes `<section>` ein;
  ohne `animation: none` startete die beim Umschalten auf `display: block` neu und das Blatt kam
  blass aus dem Drucker. Abgehakte Zeilen (`doneAt`) stehen im Druck mit ✓ im Kästchen und Namen.
- **Offene Grundmenge bleibt offen nach der Freigabe:** `computed_snapshot.unsetKeys` (Z3-Core,
  `computedSnapshot`) hält die Zeilen mit `baseUnset`, `frozenSections(rows, config, unsetKeys)`
  setzt sie wieder - sonst stünde auf dem freigegebenen Zettel „Basis 0" statt „offen". Ältere
  Freigaben ohne das Feld zeigen wie bisher 0.
- **Übersicht:** Untertitel aus `config.days` (`describeProductionDays`); je Tag „Vorbestellungen in
  N Zeilen" statt einer Stücksumme (Zeilen stehen in Produktionseinheiten, Viertel aufgerundet).

Tests: `src/lib/backzettel{Api,Format}.spec.ts`, `admin/backzettel/BackzettelOverviewClient.spec.tsx`,
`admin/backzettel/[datum]/BackzettelDayClient.spec.tsx` (Fixtures erfunden:
`src/lib/backzettelFixtures.ts`).

## Backstube-Tablet (`/backstube`, Z6, Management-App)

Die Stationsansicht der Backstube: Startseite der Rolle `backstube` nach der PIN (der Eintrag in
`PILOT_UPCOMING_NAVIGATION` ist `ready: true`). Liegt außerhalb `/admin` - keine Seitenleiste,
deshalb mit eigenem „Abmelden" (`LogoutButton`, auf der Station zurück zu den Namenskacheln).
Rolle prüfen Proxy und RouteGuard (`ROLE_ACCESS`: Inhaber, Backstube). Was man wissen muss:

- **Welcher Tag:** `src/lib/backstubeDay.ts` (rein, getestet). Vor **12 Uhr** (Ortszeit des Tablets,
  `BACKSTUBE_SWITCH_HOUR`) heute - die Schicht ab 2 Uhr läuft -, ab 12 Uhr der nächste
  Produktionstag; ist heute kein Produktionstag (`config.days`), immer der nächste. Der Umschalter
  „Heute"/„Morgen" zeigt den anderen; liegt der nächste Backtag nicht auf morgen (So → Di), heißt
  der Knopf wie der Tag. Springt die Regel um (12 Uhr, Mitternacht), folgt die Ansicht ihr wieder:
  eine Wahl gilt nur für die Regel-Lage (`today|auto`), in der sie getroffen wurde - abgeleitet im
  Render, nicht per Effekt, damit nicht erst der alte Tag (am Montag der Ruhetag) geladen wird.
- **Leerlauf: das Tablet bleibt angemeldet.** Eine Stationssitzung auf `/backstube` endet nicht
  nach den 10 min der Station (mit Teig an den Händen tippt niemand), sondern nach
  `NEXT_PUBLIC_BACKSTUBE_IDLE_MINUTES` (Vorgabe 720 = 12 h, `idleLimitMs(kind, env, { role,
path })` in `sessionPolicy.ts`, gelesen bei jeder Prüfung aus `window.location.pathname`) -
  praktisch also mit der 12-h-Grenze nach der PIN oder `NEXT_PUBLIC_STATION_LOGOUT_AT`. **Seit W4
  für jede Rolle**, auch für den **Inhaber per PIN** (er backt dort genauso; `/backstube` kann
  nichts verwalten). Jede andere Seite an der Station behält die 10 min, sobald sie offen ist; die
  12-h-Grenze nach der PIN gilt immer. **Damit niemand die Inhaber-Rechte eines liegen
  gelassenen Tablets erbt:** lag `/backstube` in einer Stationssitzung, die nicht der Rolle
  `backstube` gehört, länger als die Stations-Grenze unberührt, markiert die nächste Berührung die
  Sitzung (`unattendedAtBackstube` in `session.tsx`); auf `/backstube` geht es weiter, beim
  Verlassen meldet der `RouteGuard` wegen Inaktivität ab (`endUnattended`), statt die nächste Seite
  zu zeigen. **Ein Neuladen ist keine Bedienung** (W4-Verifikation): der Leerlauf-Effekt übernimmt
  die gespeicherte letzte Bedienung, statt sie auf „jetzt" zu setzen, ein Neuladen nach langer Ruhe
  markiert selbst, und die Markierung steht in `localStorage` (`bakery-management-unattended`,
  Wert = `startedAt` der Sitzung; `clearSession()`/neue Anmeldung löschen sie) - sonst setzte ein
  Wischen zum Aktualisieren alles zurück. Ob der Inhaber am Tablet überhaupt die lange Grenze
  bekommt, bleibt Owner-Entscheidung.
- **Abhaken** nur an freigegebenen Tagen und nur `inhaber`/`backstube` (sonst kein Haken; die API
  sagt dasselbe): ein 72-px-Haken je Zeile, sofort gesetzt (`POST …/lines/:id/done|undone`), bei
  einem Fehler zurückgenommen mit „Nicht gespeichert: …"; 409 `not_confirmed`/`confirmed`/… lädt
  den Tag neu. Ein Neuladen, das während eines laufenden Hakens zurückkommt, wird verworfen
  (`mutationSeq`) - sonst spränge der Haken kurz zurück.
- **Entwurf:** großes Banner „Noch nicht freigegeben", Zahlen grau, gestrichelte Zeilen, keine Haken.
- **Nachträge:** Karte oben mit je einem großen „Gesehen" (`POST …/deltas/:id/ack`), an der Zeile ein
  Badge „Nachtrag +N" (offen farbig, quittiert „· gesehen"). Nachträge stehen nie im Gesamt.
- **Samstag:** Hefeteig & Füllungen (`components/backstube/BackstubeHefeteig.tsx`) **vor** den Zeilen,
  sonst danach. Dieselben Server-Zahlen wie die Tagesplanung, nur groß.
- **„Vorbereitung heute":** `GET /api/backzettel/:datum/prep` für den nächsten Produktionstag nach heute
  (vorbereitet am Kalender-Vortag ab 14 Uhr); ist der Vortag Ruhetag, steht der Hinweis aus
  `prepDateProvisional` da. Dort kein Umschalter - die Vorbereitung gilt immer dem nächsten Backtag.
- **Neu geladen** wird alle 60 s (`BACKSTUBE_REFRESH_MS`), bei `focus` und `visibilitychange`.
  Scheitert ein Neuladen, bleibt der letzte Stand stehen mit Hinweis und „Stand von HH:MM".
  **Fehlertexte** über `src/lib/backstubeErrors.ts` (`describeBackstubeError`): kein Server erreicht
  (fetch-Fehler, Zeitüberschreitung, 502-504 ohne JSON-Kennung von Caddy) → „Keine Verbindung zum
  Server – bitte WLAN prüfen."; 4xx mit deutscher API-`message` → diese („Neu laden fehlgeschlagen: …"
  bzw. „Nicht gespeichert: …"); sonst ein deutscher Text mit Statuscode. `Failed to fetch` oder
  `HTTP 502: Bad Gateway` erscheinen nie. Das Neuladen schreibt nichts (seit W4 entstehen Deltas
  beim Speichern der Vorbestellung).
- **Kontrast:** feste Farbpaare je Modus in `components/backstube/backstubeColors.ts` (Banner,
  Nachtrag, Haken ≥ 7:1, geprüft in `backstubeColors.spec.ts`), keine MUI-`*.main`-Texte. Die Seite
  schaltet das `section`-Einblenden aus `global.css` ab, sonst stünde der Zettel nach jedem
  Tageswechsel 0,8 s blass da.
- **Kein eigener Druck:** gedruckt wird über „Planung & Druck" (`/admin/backzettel/[datum]`, Z7).
  Strg+P blendet Umschalter, Knöpfe und Reiter (`data-print="hide"`) aus und druckt schwarz auf weiß.
- **„Zur Verwaltung"** (→ `/admin`) nur mit persönlicher Sitzung (Inhaber über die Seitenleiste);
  das Tablet an der Station braucht ihn nicht.

Tests: `src/lib/backstubeDay.spec.ts`, `src/lib/backstubeErrors.spec.ts`,
`src/lib/sessionPolicy.spec.ts` + `src/lib/session.spec.tsx` (Leerlauf am Tablet),
`src/app/backstube/BackstubeClient.spec.tsx`,
`src/components/backstube/backstubeColors.spec.ts`. Die Fixtures in `backzettelFixtures.ts` haben
seit Z6 eindeutige Zeilen-IDs (vorher teilten sich zwei Zeilen eine).

## E2E-Suiten (Playwright)

Drei Suiten, `apps/bakery-{shop,management,landing}-e2e`, nur Chromium (Desktop + Pixel 5).
Was sie starten, steht **einmal** in `tools/e2e/servers.js`: in Entwicklung `nx serve` plus ein
laufender Server, in CI (`CI=true` oder `E2E_BUILT=1`) `next start` auf dem Build in `dist/apps/`
bzw. der statische Landing-Export hinter `tools/e2e/serve-static.js`, dazu eine API auf dem
**synthetischen Produktkatalog** `tools/e2e/hq-products` (56 Markdown-Produkte im `hq`-Format):
für den Shop die Mock-API, für die **Verwaltung seit F4 die echte API** (Bundle über
`tools/e2e/real-api.js`, frische SQLite-Datenbank im Temp-Verzeichnis, Inhaber aus
`BOOTSTRAP_ADMIN_*`, dazu erfundene Kassenberichte und Finanzen aus `prepareE2eHq()`).
So laufen die Jobs `test-e2e-*` in `.github/workflows/ci.yml` ohne das private `hq` und ohne
vorhandene Datenbank. Details, Ports und die Bedingungen, die der Katalog erfüllen muss:
`tools/e2e/README.md`.

App und API müssen **dieselben Produktdateien** lesen - die Suiten vergleichen die Oberfläche
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
  (Passwort-Spraying), bei der PIN zusätzlich 10 je Benutzer über alle IPs. Seit W4 zählen **nur
  Fehlversuche** - gleichzeitige erfolgreiche Anmeldungen bekommen nie ein 429; laufende Anfragen,
  die das Limit sprengen könnten, warten kurz (höchstens 5 s, dann 429 mit `Retry-After`). Ein
  Client, der während des Wartens auflegt, gibt seinen Platz sofort frei und zählt nicht; ein
  abgebrochener, schon geprüfter Fehlversuch zählt trotzdem. `req.ip` kommt hinter Caddy aus
  `X-Forwarded-For` (`TRUST_PROXY`, Vorgabe `loopback`).

## hq-Produkte auf der echten API (B5)

`GET /api/products`, `GET /api/hq-products[/:id]`, `PUT /api/hq-products/:id` und
`POST /api/hq-products` gibt es jetzt auch in der TypeScript-API, mit dem Vertrag des Mock-Servers
(D3; eine Parity-Suite vergleicht Antworten **und** die geschriebenen Bytes). Lesen darf jede
Sitzung, Schreiben nur `inhaber`; kein DELETE. Details: `apps/bakery-api/CLAUDE.md`, Abschnitt
„hq products (B5)". Von außen wichtig:

- **Zwei Schreibwege.** Mit `HQ_WRITE_DIR` (Box) landet die Datei im Schreib-Worktree
  (`app/edits`) und wird dort committet - Autor `Verwaltung (App)`, Bearbeiter als
  `Co-authored-by`; Push + PR folgt mit B5b. Ohne `HQ_WRITE_DIR` (Entwicklung) wird wie beim Mock
  direkt nach `HQ_PRODUCTS_DIR` geschrieben. Den Lese-Klon fasst die API mit `HQ_WRITE_DIR` nie an.
- **`pendingApproval`** steht zusätzlich an jedem Produkt: die Datei im Schreib-Worktree weicht vom
  Lese-Klon ab („wartet auf Freigabe" - seit F4 als Chip in Produktliste und Bearbeiten-Seite). **Zwei Sichten:**
  `/api/products` (Shop) liefert bis zum Merge den **freigegebenen** Stand; `/api/hq-products[/:id]`
  (Verwaltung) liefert den Stand im Schreib-Worktree - den, auf dem ein `PUT` aufbaut - und bei
  wartenden Produkten daneben `approved` (freigegebener Stand, `null` bei neuen). Sonst überschriebe
  das Bearbeiten-Formular, das immer alle Felder schickt, beim zweiten Speichern die wartende
  Änderung mit den alten Werten. `PUT`/`POST` antworten zusätzlich mit `pending`.
  `GET /api/hq-products` (Liste) gibt es nur in der echten API; sie zeigt auch neu angelegte,
  noch nicht gemergte Produkte, `/api/products` nicht.
- **Produktion verlangt beide Verzeichnisse** (`HQ_PRODUCTS_DIR` oder `HQ_DIR`, und `HQ_WRITE_DIR`,
  absolut, nicht ineinander) - sonst startet die API nicht. Geschrieben wird nur, wenn der
  Schreib-Worktree auf `app/edits` steht (`HQ_WRITE_BRANCH`), sonst 503.
- **Namen werden vor dem Schreiben gegengelesen.** `product-file.core.js` quotet alles, was YAML
  umdeuten würde (`Brot:`, `'s Weck`, `1e3`, `0x1F`, ...); die API parst die fertige Datei noch einmal
  und antwortet 400 `invalid_product_file`, statt eine unlesbare Datei nach hq zu committen.
  Davor prüft `product-input.core.js` Grenzen (Name ≤ 120 Zeichen ohne Steuerzeichen, Preis
  0…10000 € mit höchstens zwei Nachkommastellen, Texte begrenzt) - 400 `validation` statt 500.
- **Katalog für andere Domänen:** Partner (B6) und Vorbestellungen (B7) holen Name und Preis für
  ihre Snapshots aus `getCatalogue()` / `getProduct()` in
  `apps/bakery-api/src/services/hq-catalogue.ts` - freigegebener Stand, gecacht, nie eigene
  Dateizugriffe.
- Ein Speichern ohne Änderung schreibt und committet nichts (Null-Diff-Invariante bleibt).

## Vorbestellungen auf der echten API (B7) und Anonymisierung (P4)

Alle Vorbestellungen - Laden, Telefon, WhatsApp, Shop, Sammelstelle - liegen in der
TypeScript-API in **einer** Tabelle (`preorders` + `preorder_items`) unter `/api/preorders`
(Liste mit Filtern, Einzelabruf, Anlegen, Ändern, Status, Stornieren, `/sums?date=` für die
Backstube, `/day?date=[&pickupPointId=]` für die Abholliste). Die Mörsbach-Seiten der Verwaltung
laufen seit P2 direkt auf `/api/preorders`; der Alias `/api/deliveries/preorders*` mit dem Vertrag
des Mock-Servers bleibt für alte Clients stehen (eine Parity-Suite vergleicht). Details: `apps/bakery-api/CLAUDE.md`, Abschnitt „Preorders (B7) and
anonymisation (P4)". Von außen wichtig:

- **Die Regeln stehen weiter genau einmal** in `apps/bakery-api/src/services/delivery-preorders.core.js`;
  Mock und echte API benutzen dieselbe Datei. Keine zweite Implementierung anlegen.
- **Status** `offen → bereit → abgeholt | storniert`, `abgeholt ↔ storniert` gesperrt, storniert
  wird statt gelöscht. Eine abgeholte Bestellung behält Positionen, Abholtag und -ort (409
  `already_picked_up`, erst auf „Offen" zurücksetzen). Mengen sind ganze Zahlen; `"abc"` oder
  `2.7` sind 400 `invalid_quantity`, nur eine ausdrückliche `0` streicht eine Zeile. Ein neuer
  Abholtag muss bei `/api/preorders` zwischen 30 Tagen zurück und 366 Tagen voraus liegen und im
  Laden kein Montag sein (400 `date_out_of_range` / `ruhetag`); Steuerzeichen im Namen und eine
  Telefonnummer mit weniger als 5 Ziffern sind 400, statt still gespeichert oder verworfen zu werden. „Nicht abgeholt" ist **kein eigener Status**, sondern `bereit` +
  `notCollectedAt`; so übersetzt der Alias das `not_collected` des Mocks verlustfrei.
- **Sorten:** `variant` ist `''` für „keine Sorte", nie `null`. Gibt es
  `hq/config/backzettel.yaml`, muss bei Produkten mit Sorten eine davon gewählt werden; ohne
  Config wird jede Sorte angenommen. Die alte Mörsbach-Maske kennt keine Sorten - ein Speichern
  der Positionen einer Bestellung mit Sorten über den Alias ist deshalb 409 `has_variants`
  (P2 stellt die Maske auf `/api/preorders` um).
- **Kurzcode** für die Abholliste: `MO-2027-01-09-01` (Sammelstelle) bzw. `LA-…` (Laden). Jeder
  Code wird **nur einmal** vergeben - auch nicht nach Storno oder wenn die Bestellung auf einen
  anderen Tag/Ort umzieht (Register `preorder_codes`); ein alter Abholzettel zeigt nie auf eine
  fremde Bestellung.
- **Rollen:** `verkauf` (und `inhaber`) alles, `fahrer` lesen und nur übergeben bzw. „nicht
  abgeholt", `backstube` nur `/sums` (und dort ohne `summary`, also ohne Beträge und
  Bezahlstand). Der Fahrer darf „bezahlt" setzen, aber nie zurücknehmen (403
  `paid_undo_forbidden`, auch über `bulk-status`), und eine **Übergabe nicht zurücknehmen**:
  eine `abgeholt`e Bestellung auf `offen`/`bereit`/„nicht abgeholt" setzen ist für ihn 403
  `handover_undo_forbidden` (Status-Endpunkt, `bulk-status` und Mörsbach-Alias; W4-Verifikation
  Runde 3). Das kann nur der Verkauf.
- **Suche `?q=`** über Name und Code ist ein `GLOB` mit Groß/klein-Klassen je Buchstabe
  (`caseInsensitiveGlob()` in `preorders.service.ts`) - SQLites `LIKE` faltet nur ASCII, „öztürk"
  fand „Öztürk" nicht. `%`, `_`, `*`, `?`, `[` sind wörtliche Zeichen.
- **Bezahlter Betrag** (`paid_amount`, Migration 20261114, W4-Verifikation Runde 2): wird beim
  Erfassen der Zahlung auf die Summe gesetzt (Anlegen mit `paid`, `paid` false → true, ein
  ausdrückliches `paid: true` am Status-Endpunkt = „Rest kassiert"), bleibt beim Bearbeiten stehen
  und fällt mit `paid: false` weg. DTO: `paidAmount`, `paymentBalance` (> 0 noch kassieren, < 0
  erstatten; storniert + bezahlt = −bezahlt). `/day`-Summary: `unpaidTotal` enthält Nachzahlungen
  (`topUpTotal`), dazu `refundCount`/`refundTotal` - auch über stornierte. `NULL` bei `paid` heißt
  „voll bezahlt" (Altbestand, Importe).
- **Shop:** `POST /api/orders` legt eine Vorbestellung mit Kanal `shop` an, **bleibt aber hinter
  der Anmeldung** - ein öffentlicher Bestellweg ist noch nicht entschieden. Die E-Mail wird nicht
  gespeichert.
- **DSGVO (P4):** 90 Tage nach dem Abholtag werden Name, Telefon **und Anmerkung** jeder
  Vorbestellung gelöscht, **egal in welchem Status** (Name `anonymisiert`) - nachts um 23:45 über
  `deploy/systemd/bakery-anonymize.timer` (`cli.js anonymize-preorders`). Der Lauf migriert nie;
  stehen Migrationen aus, bricht er ab. Das Audit-Log enthält nie Namen oder Telefonnummern.
- **Mörsbach-Alias:** übergeben heißt bezahlt (wie beim Import); reines Abhaken (`{ status }`)
  prüft den Liefertag nicht erneut.
- **Umzug der Mock-Daten:** `cli.js import-preorders --file apps/bakery-api/data/delivery-store.json --dry-run`,
  idempotent (Runbook §3.9).

## Vorbestellungen in der Management-App (P1/P3)

Bildschirme auf dem B7-Vertrag (Abschnitt oben): `/admin/preorders` (Liste mit Suche `q`, Zeitraum,
Status, Bestellweg, Abholort - alles in der URL), `/admin/preorders/neu` (Erfassung, P1),
`/admin/preorders/[id]` (Ansicht, Bearbeiten, Status, Stornieren) und `/admin/preorders/tag?date=`
(Summen je Produkt **und Sorte**, Abholliste, A4-Druck). Was man wissen muss:

- **Ein Client für alle:** `src/lib/preordersApi.ts` (jeder `/api/preorders`-Endpunkt) und
  `src/lib/preordersTypes.ts` (Typen, Labels, Produktionstage, `isEditable`/`isCancellable`,
  `canWritePreorders`). P2 baut die Mörsbach-Maske darauf um - keinen zweiten Client anlegen.
  Gerechnet wird auf dem Server (`/day`, `/sums`, Preise); die App zeigt nur an.
- **Sorten** kommen aus `GET /api/preorders/variants` → `{ data: { [productId]: string[] }, configured }`
  (aus `hq/config/backzettel.yaml`, `backzettel.core.js#variantsByProduct`). Hat ein Produkt
  Sorten, ist die Wahl Pflicht; das Label ist der großgeschriebene Slug (`nuss` → „Nuss").
- **Abholtag:** Vorschlag ist der nächste Produktionstag ab morgen; Montag ist Ruhetag und wird
  abgelehnt. Eine Sammelstelle erzwingt ihren Wochentag (`weekday` wie `Date.getDay()`, 6 = Sa)
  und hat keine Uhrzeit; der Kanal springt dann auf „Sammelstelle".
- **Tastatur:** Die Maske ist kein `<form>` - Enter springt weiter (Name → Telefon → Suche →
  Menge → Hinzufügen → Suche), **Strg/Cmd+Enter speichert**. Die Ziffernblock-Tasten haben
  `tabIndex -1` und nehmen dem Mengenfeld den Fokus nicht.
- **Preis-Snapshot:** Die Summe in der Maske ist eine Vorschau; beim Bearbeiten behalten
  vorhandene Positionen ihren damaligen Preis (Server). Ändert sich Tag oder Ort, vergibt der
  Server einen neuen Code - die Oberfläche sagt das an.
- **Nie löschen:** Stornieren nur über die Rückfrage, `offen`/`bereit` sind bearbeitbar,
  abgeholt nur zurück auf „Offen". Auch „Storno aufheben" fragt nach - die Bestellung zählt
  danach wieder für die Backstube.
- **Keine verlorenen Änderungen (zweites Gerät).** Bearbeiten schickt nur die geänderten Felder
  (`preorderPatch()` in `preordersTypes.ts`), und jede Schreibaktion der Ansicht (Bearbeiten,
  Status, bezahlt, Stornieren, Storno aufheben) schickt den geladenen `updatedAt` als
  `expectedUpdatedAt`. Hat inzwischen jemand anderes übergeben, kassiert oder storniert, antwortet
  die API 409 `stale_preorder`; die Seite schließt dann die Maske, lädt neu und sagt per Hinweis,
  dass nichts überschrieben wurde (`isPreorderConflict()` zählt auch `already_picked_up` und
  `cancelled` dazu). Sonst setzte eine offene Maske, in der nur eine Notiz ergänzt wird, `paid`
  einer schon bezahlt übergebenen Bestellung wieder auf `false`. Neue Schreibaktionen: genauso.
- **„Alle Tage" steht als `range=alle` in der URL** (`preorderPageQuery()`); eine URL ganz ohne
  Zeitraum heißt „Vorgabe ab heute". Die API kennt den Parameter nicht.
- **Sorten-Chips:** Fokus ist ein abgesetzter Ring, keine Flächenfarbe (sonst sieht die erste
  Sorte im Dunkelmodus gewählt aus); solange die Sorte fehlt, heißt der Knopf „Erst Sorte wählen".
- **Rollen:** `verkauf` und `inhaber` schreiben; `fahrer` sieht Liste, Ansicht und Tag nur lesend
  (`/admin/preorders/neu` ist für ihn gesperrt - `RouteRule` mit `except` in `src/lib/roles.ts`).
  Verkauf startet nach der Anmeldung in `/admin/preorders`.
- **Gerätespeicher** (nur Bequemlichkeit): `bakery-management-preorder-channel` (zuletzt
  gewählter Kanal), `bakery-management-preorder-recent` (zuletzt erfasste Produkte); „Häufig"
  rechnet zusätzlich über die Vorbestellungen der letzten 28 Tage.
- Der Navigationspunkt „Sammelstelle Mörsbach" bleibt auch nach P2 (eigene Liste mit
  Bestellschluss, Backliste und Lieferstelle); siehe nächster Abschnitt.

Tests: `src/lib/preorders.spec.ts` (Formatierung, Produktionstage, Suche, Ziffernblock) und RTL-Specs
neben den Seiten (`admin/preorders/**/*.spec.tsx`, Fixtures `src/lib/testing/preorderFixtures.ts`,
erfunden); API: `tests/integration/preorders.test.ts` (`GET /variants`, veraltete Schreibzugriffe,
Storno-Sperre), `tests/unit/preordersModel.test.js` (`lockCancelled`) und
`tests/unit/backzettelCore.test.js`.

## Abholliste und Mörsbach auf `/api/preorders` (P2)

`/admin/preorders/abholliste?date=&point=` ist die Übergabeliste je Tag und Abholort (`point` =
`laden` oder die id einer Sammelstelle) - am Tablet an der Theke, am Handy des Fahrers an der
Sammelstelle, auf Papier, wenn beides ausfällt. Logik ohne React in `src/lib/abholliste.ts`.
Was man wissen muss:

- **Eine Anfrage je Liste:** `GET /api/preorders/day?date=&pickupPointId=` (neu in P2;
  `laden` = ohne Sammelstelle). Kacheln und Summen rechnet der Server für genau diesen Ort;
  `pickupPoints[].preorderCount` zählt weiter den ganzen Tag. Ohne `pickupPointId` bleibt `/day`
  wie in B7.
- **Gruppiert** nach Uhrzeit (Laden-Vorgabe; ohne Uhrzeit ans Ende, an der Sammelstelle als
  „Übergabe {Fenster} Uhr") oder nach Name (Sammelstelle-Vorgabe; Anfangsbuchstabe, Umlaute
  auf den Grundbuchstaben). Stornierte stehen immer zuletzt, durchgestrichen, und fehlen im Druck.
- **Suche** im Client: ein- bis zweistellige Zahl = laufende Nummer am Ende des Codes (sonst
  träfe „4" jedes Datum), sonst Name oder Code, ab drei Ziffern auch die Telefonnummer.
- **Übergeben** setzt `abgeholt` über `POST /:id/status` mit `expectedUpdatedAt` (409 → Liste neu
  laden, Hinweis, nichts überschrieben). Bezahlt + Verkauf/Inhaber: ein Tipp mit „Rückgängig"
  (stellt Status, `paid` und `notCollected` von vorher wieder her). Sonst ein Dialog:
  „Bezahlt und übergeben" / „Ohne Zahlung übergeben". Fahrer bekommen immer den Dialog und kein
  Rückgängig - die API lässt sie nur `abgeholt`/`nicht_abgeholt` setzen; Zurücknehmen kann der
  Verkauf. Welche Aktion wer sieht, steht einmal in `abholActions(preorder, role, today)` und
  spiegelt die Rollenregeln der API - auch „Nicht abgeholt" je Zeile erst ab dem Abholtag (die API
  sagt davor 409 `not_collected_too_early`, W4).
- **Tagesabschluss** („Rest nicht abgeholt") erst ab dem Abholtag (`isDayEndAllowed`), „Alle
  offenen als bereit" nur für Verkauf/Inhaber; beide mit Rückfrage. **Seit W4 ein Aufruf für alle**
  (`POST /api/preorders/bulk-status`, eine Transaktion, Ergebnis je Bestellung). Meldungen je Art
  getrennt (`describeBulkResults`): inzwischen geändert (Konflikt), anonymisiert, nicht mehr da,
  abgelehnt (mit API-Text). Scheitert der Aufruf als Ganzes, ist nichts gespeichert - „Keine
  Verbindung …" bzw. „Der Server hat einen Fehler gemeldet …" im offenen Dialog
  (`requestFailureKind`: keine Antwort / 5xx / 4xx).
- **Einzelne Tipps (Übergeben, bereit, …) melden Fehler auch unten** als Snackbar, die stehen
  bleibt (W4-Verifikation: die Meldung über der Liste lag am Handy außer Sicht). Bleibt die
  Antwort aus oder kommt 5xx, ist **unklar**, ob gespeichert wurde - die Seite lädt sofort neu
  und vergleicht (`changeAlreadyApplied`): schon so am Server → „Die Antwort ging verloren,
  gespeichert ist es trotzdem."; frisch geladen und nicht so → „nichts gespeichert"; Neuladen
  scheitert → „ob das gespeichert wurde, ist unklar" (`singleRequestFailedMessage`), und das
  Ereignis `online` lädt nach. Ein 409 auf einen zweiten Versuch, der schon so gespeichert ist,
  heißt „Das ist bereits gespeichert - nichts zu tun."
  **Mehrere unklare Tipps** (Funkloch, mehrere Übergaben hintereinander) werden je Bestellung
  gemerkt und nach dem Neuladen einzeln aufgelöst (`data-testid="open-actions"`); ein späterer
  erfolgreicher Tipp auf dieselbe Bestellung streicht ihren Eintrag. Die Snackbar bekommt einen
  Platzhalter unter der Liste, damit sie die letzten Knöpfe nicht verdeckt.
- **Rest und Erstattung** (`paymentState()` in `preordersTypes.ts`, aus `paymentBalance`:
  `unpaid`, `paid`, `rest`, `refund`): Chip „Rest X offen" bzw. „Erstattung X offen" - auch an
  stornierten, schon bezahlten Bestellungen. Ein Tipp-Übergeben gibt es nur bei `paid`; sonst
  nennt der Dialog den Rest bzw. „X an die Kundschaft zurückgeben" und bietet „Erstattet und
  übergeben" / „Ohne Erstattung übergeben". „Erstattet" je Zeile schickt `paid: true` (offen,
  abgeholt: Betrag = Summe) bzw. an einer stornierten `paid: false`; der Fahrer darf das an
  stornierten nicht (`paid_undo_forbidden`) und sieht stattdessen „Erfassen kann das der
  Verkauf.". Kachel „Zu erstatten"; der Druck hat eine Gruppe „Storniert - Geld zurückgeben"
  und schreibt „☐ Rest X" / „☐ X zurück". Listen, Tagesansicht und Sammelstelle zeigen dasselbe
  über `components/preorders/PaymentNote.tsx`; Sammelstelle und Backliste nennen
  `handedOverUnpaidTotal` neben der Summe.
- **Stilles Nachladen** alle 60 s und beim Zurückkehren ins Fenster (`focus`,
  `visibilitychange`) - aber nie, solange ein Dialog, ein Menü oder eine Aktion offen ist. Dabei
  wird auch **„heute" neu bestimmt** (ein Tablet, das über Nacht offen bleibt). Scheitert es,
  bleibt die letzte Liste mit Hinweis „… Angezeigt wird der Stand von HH:MM." stehen; „Die Liste ist
  neu geladen" steht nur da, wenn das Neuladen wirklich geklappt hat.
- **Telefonnummern** sind `tel:`-Links mit mindestens 44 × 44 px.
- **Druck (A4 hoch):** gedruckt wird eine eigene Tabelle `.abholliste-print`, nicht die Karten -
  immer der ganze Tag ohne Stornierte, unabhängig von Suche und Filter, mit ☐/☑, Code, Name
  (+ Telefon), Artikel mit Sorte, Summe, Bezahlt ja/nein, Unterschrift; Kopf mit „Stand … Uhr".
  `border-collapse` + `width: 100%` schnitt rechts die Außenlinie ab - deshalb `calc(100% - 1pt)`.
- **Navigation:** „Abholliste" steht direkt unter „Vorbestellungen"; `isNavItemActive()` bekommt
  die Geschwister-Pfade und lässt den spezifischeren Eintrag gewinnen, sonst wären beide markiert.

**Mörsbach-Seiten seit P2** (`/admin/delivery/preorders*`, Navigationspunkt „Sammelstelle
Mörsbach" bleibt): Liste, Backliste und Lieferstelle lesen und schreiben über
`src/lib/preordersApi.ts` (`fetchPreorderDay(date, pointId)`, `cancelPreorder`,
`savePickupPoint`); der eigene `preorderApi.ts`-Client ist gelöscht. Erfassen und Bearbeiten
sind die P1-Maske bzw. die P3-Ansicht mit vorbelegter Sammelstelle und Rückweg auf den Liefertag
(`MoersbachPreorderClients.tsx`) - die alte Maske kannte keine Sorten. Die Liste zeigt Sorten,
Code und bezahlt, verlinkt auf die Abholliste und storniert mit `expectedUpdatedAt`. Unter
`md` (Handy, Tablet hochkant) steht je Bestellung eine Karte statt der Tabelle (W4-Verifikation
Runde 3: Summe, Status und Aktion lagen sonst seitlich außer Sicht). Die Warnung
„kein Tourstopp angelegt" ist weg (die Fahrer-App ist nicht im Pilot, D11).
`PUT /api/preorders/pickup-points/:id` (neu in P2, nur `inhaber`) ändert die Sammelstelle; die
Seite zeigt allen anderen die Felder **schreibgeschützt** (W4: `readOnly`, Schalter gesperrt, kein
„Speichern"), schickt `expectedUpdatedAt` mit (409 `stale_pickup_point` → Hinweis mit „Neu
laden") und begrenzt die Texte wie der Core (Notizen 2000 Zeichen). Die **Backliste** liest seit W4
`GET /api/preorders/sums?date=&pickupPointId=` (Summen + Kopfzahlen, ohne Namen und Telefon),
nicht mehr `/day`.

Tests: `src/lib/abholliste.spec.ts`, `admin/preorders/abholliste/AbholListeClient.spec.tsx`,
`admin/delivery/preorders/**/*.spec.tsx`, `admin/layout.navigation.spec.tsx`; API:
`tests/integration/preorders.test.ts` („narrows the day to one place", „PUT
/api/preorders/pickup-points/:id").

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
  Sitzung: `/admin/login?next=…` (mit Query, z. B. Tag und Ort der Abholliste; `?next=` prüft
  `isSafeInternalPath()` in `src/lib/safePath.ts` - keine `..`-Segmente, kein `//`, kein `%` im
  Pfad, kein Backslash), auf einem Gerät mit Stations-Token `/station`; nach „Abmelden"
  (`loggedOut` im Sitzungskontext) **ohne** `?next=`, damit die nächste Person nicht auf der
  letzten Seite der vorigen landet. Sie sitzt nicht
  im Admin-Layout, weil `/backstube` keins hat (und F2s `pilotMode.spec.ts` ein Verzeichnis
  `app/backstube/` ohne `page.tsx` verbietet). Die Rolle prüft unter `/admin` das Admin-Layout
  („Kein Zugriff" statt Inhalt), außerhalb die Wache. Das ist Bedienführung - Daten schützen der
  Proxy (Server-Komponenten) und die API.
- **Eine Tabelle Rolle → Routen + Startseite: `ROLE_ACCESS` in `src/lib/roles.ts`.** Inhaber alles;
  Verkauf Dashboard, `/admin/preorders` (M1), Sammelstelle Mörsbach, Produkte **nur die Liste**
  (ohne Neu/Bearbeiten), Backschrank, Backzettel nur lesen (Z5, ohne `/admin/backzettel/grundmengen`);
  Backstube Dashboard, `/admin/backzettel`, `/backstube`; Fahrer `/admin/delivery/preorders` (ohne
  `/new` und `/lieferstelle`) und `/admin/preorders` lesend (ohne `/neu`), dort die Abholliste mit
  Übergeben; alle `/admin/settings` und `/admin/hilfe` (P6). Startseite = erste _gebaute_ aus `start` (`ready` aus
  `PILOT_UPCOMING_NAVIGATION`): Verkauf `/admin/preorders` (seit P1/P3), Fahrer
  `/admin/preorders/abholliste` (seit P2), Backstube `/backstube` (seit Z6, also Start nach der PIN).
  `getNavigationForRole()` filtert
  `getNavigation()` aus F2, Pilotbetrieb und Rolle überlagern sich. Das Dashboard zeigt Kasse,
  Tagesziel und Schnellzugriffe nur, wenn die Rolle die Seite dahinter darf. Wer eine Seite für
  eine Rolle freigibt, ändert nur `ROLE_ACCESS` (Tests: `roles.spec.ts`). `PERSONAL_ONLY_ROUTES`
  (`/admin/users`, `/admin/finance` samt Tagesziel) sind an einer Station (PIN-Sitzung) auch für den Inhaber gesperrt - wie
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
  nachmittags vorbereitet); persönlich nach `NEXT_PUBLIC_IDLE_LOGOUT_HOURS` (12 h). Ausnahme
  Backstube-Tablet (Z6): jede Rolle auf `/backstube` (seit W4, vorher nur `backstube`) nach
  `NEXT_PUBLIC_BACKSTUBE_IDLE_MINUTES` (720), siehe dort.
  „Abmelden" (`components/auth/LogoutButton.tsx`) steht in der Kopfzeile, auf Stationen groß -
  Z6 (`/backstube`, ohne Admin-Layout) muss ihn selbst einbinden.

Dazu: `/admin/users` (nur Inhaber) verwaltet Konten, Rollen, Passwörter, PINs und Stationen
(Widerrufen); Fehler wie `last_inhaber` kommen als deutsche API-Meldung in den Dialog.
**`src/proxy.ts`** (Next 16, früher `middleware.ts`) schreibt außerdem im Pilotbetrieb gesperrte
`/admin`-Routen auf `/admin/nicht-verfuegbar` um (`src/lib/pilotRewrite.ts`), sodass die
Demo-Seiten serverseitig gar nicht mehr rendern. Die E2E-Smoke-Suite meldet sich seit F4 an der
**echten API** an (`apps/bakery-management-e2e/src/global-setup.ts` + `login.ts`: Inhaber,
Verkauf und Inhaber an einer PIN-Station, einmal vor allen Tests), legt die Sitzung in
`localStorage` **und** das Sitzungs-Cookie, meldet sich einmal über die Oberfläche an und prüft,
dass eine anonyme Anfrage weder Berichtsdaten noch `/api`-Antworten bekommt.

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

## Verwaltung auf der echten API (F4)

Seit F4 sprechen die Pilot-Bildschirme der Management-App (Dashboard, Produkte, Backschrank,
Kassenberichte, Analysen, Finanzen, Tagesziel, Sammelstelle Mörsbach, Einstellungen) die
TypeScript-API. Was man wissen muss:

- **Gleiche Origin, kein CORS.** Der `ApiClient` der App hat die Basis `''`
  (`resolveBrowserApiBase()` in `src/lib/apiBase.ts`, gesetzt in `Providers.tsx`) - der Browser
  fragt `/api/...` bei der App selbst. Auf der Box schickt Caddy `/api/*` direkt an die API; ohne
  Caddy (lokal, Port 4201 direkt) reicht **`src/proxy.ts`** es an `API_URL` weiter
  (`apiProxyTarget()`, `NextResponse.rewrite`). Das frühere `rewrites()` in `next.config.js` ist
  weg: Next.js backt Rewrites beim **Build** in das Routes-Manifest, `API_URL` beim `next start`
  hatte also keine Wirkung. `API_URL` wird jetzt zur Laufzeit gelesen. `NEXT_PUBLIC_API_URL`
  bleibt leer (setzen nur für eine API auf fremder Origin, dann braucht die API `CORS_ORIGIN`);
  `deploy.sh` bricht bei leerem Wert nicht mehr ab, nur noch beim `example.`-Platzhalter.
- **Produkte** kommen im Browser aus `GET /api/hq-products[/:id]` (`fetchManagementProducts()`,
  `fetchManagementProduct()` in `src/lib/products.ts`, kein `fs` mehr; Seiten
  `ProductsPageClient.tsx`, `[id]/ProductEditLoader.tsx`, dynamisch statt `generateStaticParams`).
  `pendingApproval` zeigt den Chip „wartet auf Freigabe" in Liste und Bearbeiten-Seite, dazu den
  freigegebenen Stand (`approved`) als Hinweis. Neu/Bearbeiten nur für `inhaber` (die API
  antwortet sonst 403); andere Rollen sehen die Liste ohne Stift. Der Partner-Katalog der
  Erfassungsmaske liest weiter serverseitig aus `HQ_PRODUCTS_DIR` (`src/lib/hqProductsFs.ts`,
  dasselbe Verzeichnis wie die API).
  **Beschreibung aus `rawDescription`, nie aus `description`:** die Verwaltungssicht
  `/api/hq-products[/:id]` liefert zusätzlich `rawDescription` - den Body ohne Überschrift,
  **ohne** den Rückgriff auf `short_description`, den `description` für den Shop hat
  (`managedFields()` in `hq-products.core.js`). `toManagementProduct()` liest das Feld; sonst
  schriebe ein Speichern ohne Änderung bei einer Datei ohne Beschreibung den Kurztext in den
  Body (Null-Diff-Invariante, Integrationstest in `tests/integration/hqProducts.test.ts`).
  PUT/POST-Antworten und der Mock haben kein `rawDescription`; dort ist `description` der Body.
  Die Dashboard-Kachel zählt `/api/products` (freigegebener Stand, „Verfügbar" inkl. Saisonware)
  und zeigt „Produkte verwalten" nur Rollen, die `/admin/products` öffnen dürfen.
- **Backschrank:** CSV-Export über `apiClient.getBlob()` (Bearer) statt Link; `deleteVisit()`
  liefert `{ id, deleted, message }` und die Seite zeigt `message`; Standard-Bestückung ist für
  alle außer `inhaber` nur lesbar.
- **403 hat eine Ursache, und die steht da.** Finanzen/Tagesziel an der PIN-Station (403
  `personal_session_required`): „An der PIN-Station nicht verfügbar – bitte am Büro-PC oder
  eigenen Gerät mit Passwort anmelden." (`PERSONAL_SESSION_HINT` in `financeApi.ts`, auch in der
  Dashboard-Kachel) - **bewusst ohne Anmelde-Link**: eine PIN-Sitzung gibt es nur an einem
  Stationsgerät, und eine Passwort-Sitzung dort hielte Finanzen und Benutzerverwaltung 12 h statt
  10 min offen (F1 beendet die persönliche Sitzung beim Einrichten der Station). Analysen für andere Rollen: „Nur für Inhaber"
  (`components/analytics/OwnerOnlyNotice.tsx`; `analyticsService` liefert `forbidden: true`). Der
  Export-Knopf der Analysen ist entfernt - `/api/reports/generate` gibt es auf keiner API.
- **Einstellungen im Pilotbetrieb** ohne Benachrichtigungen und E-Mail (keine API dafür);
  Passwort/PIN verweisen auf `/admin/users`.
- `ApiClient` (`libs/shared/data-access`) hat dafür `setBaseUrl()`, `getBaseUrl()` und
  `getBlob()` (Dateiname aus `Content-Disposition`, Fehler-JSON → `ApiError` mit `message`).

E2E: siehe „E2E-Suiten" - die Management-Suite fährt gegen das Bundle der echten API.
Tests: `src/lib/apiBase.spec.ts`, `src/proxy.spec.ts` (Weiterleitung `/api`),
`admin/products/{page,productsApi}.spec.tsx`, `src/lib/partnerApi.spec.ts`,
`admin/partners/**/{Report,PartnerDetail,Templates}Client.spec.tsx`, `src/lib/financeApi.spec.ts`,
`admin/finance/**/*.spec.tsx`, `admin/analytics/revenue/page.spec.tsx`, `admin/settings/page.spec.tsx`,
`libs/shared/data-access/src/lib/{api-client,services/analytics.service}.spec.ts`.

## Hilfe und Papierbetrieb (`/admin/hilfe`, P6)

Kurzanleitung je Rolle und die Papier-Vordrucke, für **jede** Rolle erreichbar (`ROLE_ACCESS`:
`COMMON_ROUTES`, `PILOT_ALLOWED_ROUTES`), Menüeintrag „Hilfe" ganz unten. Einweisung und
Go-live-Checkliste fürs Personal: `docs/onboarding.md`; Regel und Vordrucke im Runbook §9.
Vier Dinge, die man wissen muss:

- **Text nur in `src/content/hilfe/`** (`spickzettel.ts` je Rolle, `papierbetrieb.ts` für die
  Regel) - reiner Text, `**fett**` für Beschriftungen der App. Geschrieben nach den echten
  Bildschirmen: wer dort einen Knopf umbenennt („Vorbestellung speichern", „Bezahlt und
  übergeben", „Gesehen", „Jetzt freigeben" …), zieht den Text nach; `spickzettel.spec.ts` prüft
  die wichtigsten Begriffe und eine Längengrenze je Blatt.
- **Jedes Blatt druckt auf genau EINE A4-Seite.** Mehrere Blätter auf einer Seite: jedes ist ein
  `.hilfe-sheet[data-sheet=<id>]`; „Drucken" setzt `data-hilfe-print=<id>` an `<html>`, ruft
  `window.print()` und nimmt das Attribut bei `afterprint` wieder weg (`components/hilfe/hilfePrint.tsx`).
  Strg+P ohne Knopf druckt den gezeigten Spickzettel (`data-print-default`). Vorbestellschein und
  Notfallblatt sind seitenhoch mit fester Höhe in mm (270) - deshalb nimmt das Druckbild jeden
  Abstand davor weg (Pfadzeile, Ränder). In GlobalStyles **einen** Schlüssel je Selektor: ein
  zweiter `'.hilfe-sheet'` im selben Objekt ersetzte den ersten (so fiel einmal `display: none`
  weg). `global.css` blendet jedes `<section>` ein (`sectionFadeIn`) - auf den Blättern ist das
  abgeschaltet, sonst druckt ein gerade gewechselter Reiter halb durchsichtig.
- **Vorbestellschein** (2 oder 4 je Seite, Schnittlinien) spiegelt die Erfassungsmaske; unten
  „in App übertragen" + Code. **Backzettel-Notfallblatt** holt die Posten (je Sorte eine Zeile)
  aus `GET /api/backzettel/config`, ohne Stammdaten leere Zeilen; `notfallLayout()` wählt
  Zeilenhöhe (4–7 mm) und zwei bzw. ab ~80 Zeilen drei Spalten, damit es eine Seite bleibt.
- **Keine Telefonnummern, keine echten Namen** in den Texten - der Aushang hat Leerzeilen für
  Inhaber und Technik, die von Hand ausgefüllt werden.

Tests: `src/content/hilfe/spickzettel.spec.ts`, `admin/hilfe/HilfeClient.spec.tsx` (je Rolle,
Drucken, Vordrucke), `components/hilfe/BackzettelNotfallblatt.spec.tsx`. Die Ein-Seiten-Prüfung
geht nur im Browser: `page.pdf()` je Blatt, Seitenzahl 1 (Achtung: nach
`emulateMedia({ media: 'screen' })` druckt `page.pdf()` das Bildschirm-CSS - mit `media: null`
zurücksetzen; `page.pdf()` löst `afterprint` aus).

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
