---
id: TASK-038
title: HQ-Reports und Finanzdaten in der Management-App anbinden
slug: hq-reports-und-finanzdaten-anbinden
status: done
priority: 2
owner: ''
projects: []
customers: []
tags:
  - management
  - reports
  - finance
  - data
  - analytics
sprint: ''
depends_on: []
due_date: ''
created: 2026-08-31
updated: 2026-09-07
---

# HQ-Reports und Finanzdaten in der Management-App anbinden

## Kontext

Im `hq`-Repo liegen inzwischen zwei ausgewertete Datenbestände, die in der App noch
nirgends ankommen:

1. **Kassenberichte** (`hq/data/reports/`) — Tages-, Wochen- und Monatsberichte, erzeugt
   aus den Taxonomie-Exporten der Registrierkasse. Roh → `raw/`, kompakt → `converted/`,
   ausgewertet → `daily-reports/`, `weekly-reports/`, `monthly-reports/`.
2. **Bankumsätze** (`hq/data/finance/`) — kategorisierte Kontobewegungen des
   Geschäftskontos mit Monats-JSON und einem Aggregat `finance-summary.json`.

Beide sind bereits normalisiert und maschinenlesbar. Was fehlt, ist der Weg in die App.

Der Ist-Zustand ist schlechter als er aussieht:

- **`apps/reports`** liest `<workspace>/content/reports/converted` — ein Pfad, der nie
  existiert hat, und das `content/`-Repo ist stillgelegt. Der Fallback-Zweig ist
  ebenfalls wirkungslos (`Object.assign` auf einen String). Die App hat keine
  `project.json`, wird also von Nx gar nicht gebaut.
- **`/admin/reports`** in der Management-App ist ein ehrlicher „noch nicht gebaut"-Stub.
- **`/admin/analytics/*`** ist teilweise kaputt: `/api/analytics/revenue-trends` liefert
  404 (die Übersichtsseite sagt das immerhin in einem Banner), aber
  `/admin/analytics/revenue` zeigt **erfundene Zahlen ohne jeden Hinweis**. Das ist der
  gefährlichste Punkt — eine Seite, die aussieht, als wäre sie echt.

Ziel: echte Zahlen aus `hq`, und dort wo etwas nicht angebunden ist, ein sichtbarer
Hinweis statt Platzhalterwerten.

## Datenschutz — bitte vorab lesen

Dieses Repo ist **öffentlich**, `hq` ist **privat**. Das ist kein Zufall, sondern die
Trennlinie für diesen Task.

`hq/data/finance/transactions/*.json` enthält **Klarnamen und Nettogehälter von
Beschäftigten sowie vollständige IBANs** von Mitarbeitenden, Lieferanten und Kunden.

Daraus folgt:

- Einzelbuchungen gehören **nicht** in einen öffentlich erreichbaren Endpunkt und **nicht**
  in Fixtures, Snapshots, Mocks oder Testdaten in diesem Repo.
- Für Tests **synthetische** Daten erzeugen, niemals echte Auszüge kopieren.
- Nur das Aggregat `finance-summary.json` wird ausgeliefert — und auch das nur hinter
  Authentifizierung mit Rollenprüfung.
- In Commit-Messages, Screenshots und Issue-Texten keine echten Beträge, Namen oder
  Kontonummern.

Wenn ein Feature Einzelbuchungen wirklich braucht, wird das ein eigener Task mit eigener
Rechteentscheidung — nicht nebenbei hier.

## Datenquellen

### Kassenberichte

```
hq/data/reports/
├── converted/YYYY-MM-DD_<register>.json   Tagesdaten (Transaktionen, Positionen)
├── daily-reports/                          ausgewertete Tagesberichte
├── weekly-reports/YYYY-Www-report.md       Wochenberichte (ISO-Wochen)
├── monthly-reports/YYYY-MM-report.md       Monatsberichte
└── scripts/                                Python-Analyse + convert_reports.js
```

Ein `converted`-Tagesfile hat grob diese Form:

```ts
type ConvertedDay = {
  date: string // YYYY-MM-DD
  register_id: string
  report_number: number
  company: string
  transactions: Array<{
    id: string
    timestamp: string // ISO mit Zeitzone
    type: 'sale' | string
    user: string // Bedienername
    items: Array<{
      product: string
      product_id: string
      quantity: number
      price: number
      total: number
    }>
    total: number
    payment: 'Bar' | 'Unbar' | 'Keine'
  }>
}
```

Zwei Eigenheiten, die man kennen muss, bevor man darauf rechnet:

- **`payment: 'Unbar'` heißt Karte.** Wer auf `'Karte'` filtert, bekommt null.
- **Der Konverter verliert `group_name`.** Die Kategorie einer Position steht im Rohexport,
  nicht mehr im `converted`-JSON — deshalb ist die Kategorien-Auswertung in allen
  generierten Berichten leer. Wer Umsatz nach Kategorie braucht, muss zuerst den Konverter
  reparieren und neu konvertieren (eigener Task, siehe Offene Punkte).

Weiter zu beachten:

- **Lücken sind normal.** Betriebsferien und einzelne fehlende Exporte führen zu Tagen
  ohne Bericht. Die UI muss „kein Bericht" von „Umsatz 0" unterscheiden.
- **Storno-Paare.** Fehleingaben an der Kasse werden durch eine negative Gegenbuchung
  ausgeglichen. Tagessummen stimmen dadurch, **Positionsmengen einzelner Tage aber nicht**.
  Wer Mengen auswertet, braucht eine Ausreißerprüfung.
- Vereinzelt gibt es einen zweiten Abschluss am selben Tag (`..._2.json`).

### Finanzdaten

`hq/data/finance/finance-summary.json` ist der stabile Vertrag und trägt `schema_version`.
Vollständige Beschreibung in `hq/data/finance/README.md`.

```ts
type FinanceSummary = {
  generated_at: string
  schema_version: 1
  period: { from: string; to: string }
  accounts: string[]                                  // IBANs — NICHT ausliefern
  transaction_count: number
  category_labels: Record<string, string>             // slug → deutscher Anzeigename
  category_kinds: Record<string, 'einnahme' | 'ausgabe' | 'neutral' | 'offen'>
  subcategory_labels: Record<string, string>
  totals: Record<string, {
    amount: number      // netto
    count: number
    income: number      // Zuflüsse
    expense: number     // Abflüsse (negativ)
  }>
  months: Array<{
    month: string       // 'YYYY-MM'
    transactions: number
    operating_income: number
    operating_expense: number    // negativ
    operating_result: number
    neutral: number              // Geldtransit, Darlehen, Privat
    net_change: number
    categories: Record<string, {
      amount: number; count: number; income: number; expense: number
      subcategories: Record<string, number>
    }>
  }>
  top_counterparties: Array<{ name: string; amount: number; count: number; category: string }>
  uncategorized: { count: number; amount: number; transactions: Array<{...}> }
}
```

Regeln für die Verarbeitung:

- Beträge sind Euro als `number`, **Abflüsse negativ**. Vorzeichen nie im Frontend drehen.
- `category_kinds` bestimmt den Topf. Einnahmen + Ausgaben + Neutral ergeben exakt die
  Kontoveränderung — diese Identität ist eine gute Invariante für Tests.
- `accounts` und `top_counterparties` enthalten Kontonummern bzw. Klarnamen von
  Privatpersonen. **Beim Ausliefern herausfiltern**, siehe Datenschutz-Abschnitt.
- `uncategorized` ist gewollt und kein Fehler: nicht eindeutig zuordenbare Buchungen
  werden lieber sichtbar gelassen als geraten. Die UI sollte den Betrag als Hinweis
  zeigen, nicht als Warnung.

## Pfadauflösung

Die bestehenden funktionierenden Loader lösen `hq` über `<website>/../hq` auf und
akzeptieren eine Env-Überschreibung. Muster übernehmen:

| Env              | Default                        |
| ---------------- | ------------------------------ |
| `HQ_REPORTS_DIR` | `<website>/../hq/data/reports` |
| `HQ_FINANCE_DIR` | `<website>/../hq/data/finance` |

In CI fehlt `hq` — die Loader müssen das **erkennen, protokollieren und leer
zurückgeben**, nicht werfen. Vorbild ist der Produkt-Loader, der in dem Fall
`HQ products directory not found` loggt und auf gebündelte Daten zurückfällt. Für
Finanzdaten gibt es bewusst **keinen** Fallback auf Beispieldaten: lieber „keine Daten"
anzeigen als Zahlen erfinden.

## Umsetzung

### Phase 1 — Loader

1. `apps/bakery-management/src/lib/reports.ts`
   - `getDailyReport(date)`, `listDailyReports(from, to)`, `getMonthlyReport(month)`
   - liest `converted/`, aggregiert Umsatz, Bons, Ø Bon, Zahlungsmix (`Bar` / `Unbar`)
   - Rückgabe unterscheidet `{ status: 'ok' }` von `{ status: 'no-data' }`
2. `apps/bakery-management/src/lib/finance.ts`
   - `getFinanceSummary()` mit Prüfung auf `schema_version`
   - **Sanitizer**, der `accounts` und personenbezogene `top_counterparties` entfernt,
     bevor irgendetwas den Server verlässt
3. Unit-Tests mit synthetischen Fixtures — inklusive der Fälle „Verzeichnis fehlt",
   „Tag ohne Bericht", „Storno-Paar", „falsche `schema_version`"

### Phase 2 — API

4. Endpunkte in `apps/bakery-api` unter `/api/reports` und `/api/finance`:

```
GET /api/reports/daily?from=&to=      Tagesumsätze im Zeitraum
GET /api/reports/daily/:date          ein Tag im Detail
GET /api/reports/monthly/:month       Monatsaggregat
GET /api/finance/summary              bereinigtes finance-summary.json
GET /api/finance/months?from=&to=     Monatsreihe (Einnahmen/Ausgaben/Ergebnis)
```

5. Rollenprüfung: Finanzdaten nur für Inhaber-/Admin-Rolle. Kassenberichte dürfen weiter
   gefasst sein.
6. Fehlerantworten setzen **`message` zusätzlich zu `error`** — der `ApiClient` wirft
   `new Error(data.message)`, ein `error`-only-Body verschluckt den deutschen Text.

### Phase 3 — Oberfläche

7. `/admin/reports` vom Stub zum Archiv: Liste der Tage mit Umsatz, Bons, Ø Bon,
   Zahlungsmix; Filter nach Zeitraum; Detailansicht eines Tages. Fehlende Tage als Lücke
   darstellen, nicht als Null.
8. Neue Seite `/admin/finance` — Monatsverlauf Einnahmen/Ausgaben/Ergebnis,
   Kostenstruktur nach Kategorie, Hinweis auf nicht zugeordnete Buchungen.
9. `/admin/analytics/revenue` **auf echte Daten umstellen oder die Zahlen entfernen.**
   Der jetzige Zustand — plausibel aussehende Fantasiewerte ohne Warnung — muss in jedem
   Fall weg, notfalls durch denselben ehrlichen Hinweis wie auf der Übersichtsseite.
10. Dashboard-Kacheln auf echte Werte umstellen.

### Phase 4 — Aufräumen

11. `apps/reports` entscheiden: entweder auf `hq/data/reports/converted` zeigen lassen und
    als echtes Nx-Projekt aufnehmen, **oder** löschen. Der aktuelle Zwischenzustand — kein
    `project.json`, toter Pfad, wirkungsloser Fallback — hilft niemandem.
12. Stale Verweise auf das stillgelegte `content/`-Repo im Code entfernen.

## Akzeptanzkriterien

Stand 2026-09-07, geprüft gegen `main` nach den Merges von PR #98 (Kassenberichte) und PR #99
(Finanzdaten):

- [x] Tagesberichte aus `hq/data/reports/converted` sind in `/admin/reports` sichtbar
      (`admin/reports/ReportsArchiveClient.tsx`, Loader `src/lib/reports.ts`)
- [x] Zeitraumfilter und Tagesdetail funktionieren (`admin/reports/[date]`)
- [x] Tage ohne Bericht werden als Lücke gekennzeichnet, nicht als Umsatz 0
      (`status: 'no-data'`, Chip „kein Bericht", Schalter „Tage ohne Bericht ausblenden")
- [x] Zahlungsmix rechnet `Unbar` korrekt als Karte (`reports.core.js`, `PAYMENT_LABELS`)
- [x] `/admin/finance` zeigt Monatsverlauf und Kostenstruktur aus `finance-summary.json`
      (`admin/finance/FinanceClient.tsx`)
- [x] Finanz-Endpunkte sind auth- und rollengeschützt (`/api/finance/*` hinter
      `requireRole('admin')` aus `src/routes/auth.mock.js`; Login unter `/admin/login`)
- [x] Ausgelieferte Finanzdaten enthalten **keine** IBANs und keine Namen von Privatpersonen
      (`finance.core.js` streicht `accounts` und `top_counterparties` komplett, Whitelist-Sanitizer)
- [x] Kein Fixture, Mock oder Snapshot in diesem Repo enthält echte Kontodaten
      (`tests/fixtures/finance-summary.synthetic.js`, synthetische Tage in `reports.spec.ts`)
- [x] Fehlendes `hq`-Verzeichnis führt zu geloggtem Hinweis und leerem Ergebnis, nicht zum Absturz
      (`{ status: 'no-data', reason }` in Loader und Route)
- [x] `/admin/analytics/revenue` zeigt entweder echte Zahlen oder gar keine
      (`analyticsService.getRevenueTrendsWithSource()` liefert `{ data, available }` von
      `/api/analytics/revenue-trends` aus `reports.mock.js`; das `Math.random()`-Sample ist weg)
- [x] Einnahmen + Ausgaben + Neutral = Kontoveränderung wird als Test geprüft
      (`tests/unit/financeCore.test.js`)
- [x] Alle Texte auf Deutsch
- [x] `npm test` und `npm run lint` laufen durch - die neuen Suites (`reportsCore`, `financeCore`,
      `financeRoutes`, `reports.spec`, `finance.spec`, `financeApi.spec`, Client-Specs) sind grün;
      die sieben vorbestehenden roten Test-Tasks (siehe `/Users/sebastian/develop/bakery/CLAUDE.md`)
      sind unverändert und gehören nicht zu diesem Task

Phase 4 ist ebenfalls erledigt: `apps/reports` wurde in PR #98 gelöscht, die stale Verweise auf das
stillgelegte `content/`-Repo sind aus dem Code entfernt.

## Offene Punkte

### Stand nach Umsetzung (2026-09-07)

Was von den ursprünglichen Fragen wie entschieden wurde, und was bewusst offen bleibt:

- **Kategorien in den Kassenberichten - weiterhin leer.** `convert_reports.js` verwirft nach wie
  vor `group_name`; die App zeigt deshalb keinen Umsatz nach Kategorie. Reparatur bleibt ein
  eigener Task im `hq`-Repo (Neukonvertierung aller Tage), vorher abstimmen.
- **Auslieferungsweg - Dateisystem zur Laufzeit, mit einer Falle.** Beide Management-Loader
  (`src/lib/reports.ts`, `src/lib/finance.ts`) lesen `hq` zur Laufzeit wie der Produkt-Loader
  (`HQ_REPORTS_DIR` / `HQ_FINANCE_DIR`, sonst `<website>/../hq/data/...`). Die Formeln liegen aber
  in `apps/bakery-api/src/services/{reports,reports-files,finance}.core.js`, und die Loader laden
  diese Dateien **zur Laufzeit per `require`** aus dem Quellbaum (ein statischer Import über die
  App-Grenze ist vom Modul-Grenzen-Lint verboten). Wird nur das Build-Artefakt der Management-App
  deployt (Vercel, ohne `apps/bakery-api/src`), fehlt der Core und die Seiten antworten mit
  „keine Daten". Ein Deployment braucht entweder den ganzen Monorepo-Checkout oder eine Verlagerung
  der Cores in eine Lib.
- **Auth gilt nur für `/api/finance/*`.** `auth.mock.js` bringt dem Mock-Server erstmals ein
  JWT-Login (admin/admin, überschreibbar mit `MOCK_ADMIN_USER` / `MOCK_ADMIN_PASSWORD`), aber
  `requireAuth`/`requireRole` sind nur an die Finanz-Routen gehängt. Kassenberichte
  (`/api/reports/*`, `/api/analytics/*`) und alle älteren Mock-Routen sind weiter offen - für den
  Mock-Server so beabsichtigt, für die echte API nicht.
- **`POST /api/auth/refresh` akzeptiert auch ein Access-Token.** Der `AuthContext` speichert das
  Refresh-Token nie ab und schickt einen leeren String; damit die Sitzung trotzdem verlängert
  werden kann, gilt ersatzweise ein noch gültiges Access-Token im Bearer-Header. Unauthentifiziert
  geht nichts, aber die Trennung Access/Refresh ist damit aufgeweicht - beim Umzug auf die echte
  API nicht übernehmen.
- **Aktualität.** Entschieden: Dashboard-Kacheln, Berichte und Finanzseite zeigen „Stand: …"
  (`generated_at` bzw. jüngster Berichtstag).
- **Historie.** Zeiträume, in denen nur Kassen- oder nur Bankdaten existieren, sind in der UI
  nicht als solche markiert; der Kassen/Bank-Abgleich aus den Notes ist nicht gebaut.
- **Mehrere Konten.** Unverändert: ein Konto; `accounts` wird beim Ausliefern ohnehin gestrichen.

## Notes

- `hq/data/finance/README.md` beschreibt Format, Regelwerk und die Grenzen der Auswertung.
  Wichtigste Grenze: es ist eine **Cashflow-Sicht nach Buchungsdatum, keine GuV** — keine
  Abschreibungen, keine Rückstellungen, Zuordnung nach Zahlungs- statt Leistungsdatum.
  Das gehört als Hinweis auch in die UI, sonst werden die Zahlen überinterpretiert.
- Die Kassen- und Bankdaten bestätigen sich gegenseitig: Bareinzahlungen plus
  Kartenabrechnungen laut Bank stimmen über zwölf Monate im niedrigen Promillebereich mit
  dem Kassenumsatz überein. Ein solcher Abgleich eignet sich gut als Integritätsanzeige in
  der UI — und als Test.
- Bestehende Muster ansehen, bevor es losgeht: `src/lib/products.ts` (HQ-Loader mit
  Env-Override und Fallback), `admin/analytics` (Charts), `admin/delivery` (Tabellen,
  Status-Chips, `apiClient`).
