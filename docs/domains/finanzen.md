# Finanzen, Jahresabschluss und Tagesziel-Ampel

`/admin/finance` zeigt Bankumsätze aus dem privaten `hq`-Repo (`hq/data/finance/finance-summary.json`,
`schema_version` 1) als Monatsreihe und Kostenstruktur; `/admin/finance/jahr` und
`/admin/finance/monat/[JJJJ-MM]` daraus den Jahresabschluss (vorläufig) und die Monatsanalyse;
`/admin/finance/tagesziel` den Break-even als Tagesziel je Wochentag mit Ampel, rückblickend aus den
Kassenberichten ([kassenberichte.md](kassenberichte.md)).

**Code:** Sanitizer/Formeln `apps/bakery-api/src/services/finance.core.js` · Jahr/Monat
`apps/bakery-api/src/services/finance-report.core.js` · Tagesziel
`apps/bakery-api/src/services/targets.core.js` · Routen `src/routes/finance.routes.js`,
`src/routes/targets.routes.js` (bis B12 `*.mock.js`, eingehängt über `hq-data.routes.ts`) ·
Management-App
`src/lib/financeApi.ts`, `src/lib/targetsApi.ts`, `app/admin/finance/FinanceClient.tsx`,
`app/admin/finance/tagesziel/TagesZielClient.tsx`, `components/targets/{TargetsTile,TargetStatusChip}.tsx`,
`app/admin/finance/{jahr,monat}/**`, `components/finance/{FinanceCharts,FinancePrint,FinanceReportParts}.tsx`,
`src/lib/{financeTypes,financeCharts}.ts`.
API-Details: [`docs/api/hq-data.md`](../api/hq-data.md).

**Dieses Repo ist öffentlich, `hq` nicht.** Keine echten Beträge, IBANs oder Namen in Code, Tests,
Fixtures, Snapshots, Screenshots oder Commit-Messages.

## Finanzdaten (`/admin/finance`)

- **Nur das bereinigte Aggregat verlässt einen Server.** Der Sanitizer in `finance.core.js`
  (`sanitizeSummary`, über `parseSummary`) ist eine _Whitelist_: `accounts` (IBANs) und
  `top_counterparties` (Klarnamen) fallen komplett weg, `uncategorized` behält nur `count`/`amount`.
  Ein neues Feld im Export ist unsichtbar, bis es dort bewusst freigegeben wird.
- **Formeln genau einmal:** Der Core trägt auch Monatsreihe, Kostenstruktur und die Invariante
  `Einnahmen + Ausgaben + Neutral = Kontoveränderung` (`checkInvariant`).
- **Kein Fallback auf Beispieldaten.** Fehlt `hq` (CI), fehlt die Datei oder stimmt die
  `schema_version` nicht, antwortet der Server mit `status: 'no-data'` und loggt das; die Seite zeigt
  „Keine Finanzdaten vorhanden“. `HQ_FINANCE_DIR` überschreibt den Pfad `<website>/../hq/data/finance`.
- **Cashflow-Sicht nach Buchungsdatum, keine GuV** - der Hinweis steht bewusst in der Oberfläche.
  Nicht zugeordnete Buchungen sind gewollt und ein Info-Hinweis, keine Warnung.
- **Endpunkte:** `GET /api/finance/summary`, `GET /api/finance/months?from=&to=`. Fehler (401/403)
  als JSON mit `message` und `error`.
- **Rechte:** nur `inhaber` **mit Passwort-Sitzung** (`requireRole('inhaber')` plus
  `requirePersonalSession`, B3-Anmeldung); ohne Token 401, mit falscher Rolle oder an der
  PIN-Station 403 (`personal_session_required`). Die App zeigt dann „An der PIN-Station nicht
  verfügbar – bitte am Büro-PC oder eigenen Gerät mit Passwort anmelden.“
  (`PERSONAL_SESSION_HINT` in `financeApi.ts`, auch in der Dashboard-Kachel) - bewusst ohne
  Anmelde-Link.
- `apps/bakery-management/src/lib/finance.ts` ist ein serverseitiger Loader, der denselben Core per
  `require` mit `// nx-ignore-next-line` und `eslint-disable-line` lädt. **Beide Marker müssen an
  genau dieser Stelle bleiben**, sonst hängt `bakery-management` im Nx-Graph an `bakery-api` und
  `nx build` baut erst die API. (Die Finanzseite selbst liest über `financeApi.ts` die
  rollengeschützte API; den Loader importiert derzeit nur seine Spec.)

## Jahresabschluss (vorläufig) und Monatsanalyse (`/admin/finance/jahr`, `/admin/finance/monat`)

Aus derselben bereinigten `finance-summary.json` plus den Monatssummen der Kasse (Tagesberichte aus
`HQ_REPORTS_DIR`): `GET /api/finance/year[/:year]` (ohne Jahr das jüngste mit Bankdaten) und
`GET /api/finance/month[/:month]` (ohne Monat der jüngste vollständige), Rechte wie
`/api/finance/summary`, ungültige Eingabe 400 `validation`. Gerechnet wird **nur** in
`finance-report.core.js`; die Seiten zeigen an, auch die Hinweistexte (`notes`) kommen vom Server.

- **„Vorläufig“ ist ein Status, kein Etikett:** `final` nur, wenn die Bankdaten das ganze Jahr
  abdecken; `provisional` für ein laufendes Jahr, mit Hochrechnung (Ist + Vorjahresmonat, sonst Ø der
  letzten 12 vollständigen Monate, der laufende Monat anteilig nach Tagen); `incomplete`, wenn die
  Bankdaten erst im Jahr beginnen - dann **keine** Hochrechnung. Es bleibt eine Cashflow-Sicht
  (Zuflussprinzip), kein steuerlicher Abschluss; was fehlt (AfA, Bestand, offene Rechnungen,
  Barausgaben aus der Kasse, Kosten über das Verrechnungskonto), steht in `notes`.
- **Fehlende Daten sind offen, nicht 0:** ein Monat ohne Bankdaten (`coverage: 'missing'`) steht als
  „keine Bankdaten“ da und fehlt im Diagramm; ein Monat ohne Kassenberichte hat kein `kasse`.
- **Nur vollständige Monate zählen in Durchschnitten** (`monthCoverage` gegen `period`). Ein
  angebrochener Monat hat keine Vergleiche (`comparison.*`, `average`, `diff` sind `null`,
  `highlights_reason: 'partial'`). Dieselbe Regel gilt für das Kostenfenster des Tagesziels
  (`lastMonths` in `targets.core.js`).
- **Auffälligkeiten** messen Ausgaben am **Abfluss** (`expense`), nicht am Netto - sonst sähe eine
  Steuererstattung wie eine neue Ausgabe aus. Schwellen (1,5 × Ø und ≥ 300 €, „fehlt“ nur bei
  regelmäßigen Posten) im Kopf von `highlightsOf`; erst ab 6 Vergleichsmonaten.
- **Kassenabgleich** (Kasse bar + Karte gegen Bareinzahlungen + Kartenabrechnungen) nur über
  vollständige Monate. Bekannte Kleinigkeit: die Kasse zählt Bons „ohne Zahlung“ mit Betrag zum
  Umsatz, der Kassenabschluss nicht.
- **Diagramme** (`FinanceCharts.tsx`, Daten nur umgeordnet in `financeCharts.ts`): Jahr im Verlauf,
  Ergebnis seit Jahresbeginn, Einnahmen nach Herkunft, Ausgaben nach Posten (Monat mit Ø-Strich),
  Verlauf der letzten 13 Monate (`trend`). Hochrechnung und aufgelaufenes Ergebnis liefert der
  Server (`projection.basis[]`, `months[].cumulative_result`). Geschätzte Anteile schraffiert, offene
  Monate gestrichelt mit `*`. Klick auf einen Monat öffnet die Monatsanalyse.
- **Druckfassung ist ein eigenes Dokument** (`JahresabschlussPrint.tsx`, `MonatsanalysePrint.tsx`
  aus den Bausteinen in `FinancePrint.tsx`): Seite 1 Übersicht (Stempel „Vorläufig“/„Unvollständig“,
  Kennzahlen, Diagramme), ab Seite 2 nummerierte Tabellen, Fußzeile „Bäckerei Heusser · … · Seite X
  von Y“ über `@page`-Randboxen (Chrome; Safari druckt ohne). Nicht zurückbauen: das Druckdokument
  ist **immer im DOM** (auf dem Bildschirm versteckt - erst in `beforeprint` montiert, hängte Chrome
  eine leere Seite an); Druck-Diagramme mit fester Breite (`PRINT_CHART_WIDTH`); Breiten in `sx`
  als Pixel-String (`px()`), weil MUI Zahlen ≤ 1 als Prozent liest. Prüfen mit `page.pdf()`, echte
  Zahlen nur lokal.

## Tagesziel-Ampel (`/admin/finance/tagesziel`)

Dashboard-Kachel (`components/targets/TargetsTile.tsx`) und Detailseite.

- **Die gesamte Rechnung steht genau einmal**, in `targets.core.js` (dependency-freies CommonJS):
  - Kostenbasis (`computeCostBase`): Fixkosten = Netto aller `ausgabe`/`offen`-Kategorien außerhalb
    `variable_categories`, Kostenquote = variable Kosten / Einnahmen, Umsatz außer Kasse = Einnahmen −
    Unterkategorien `bar`/`karte`/`karte_elv`;
  - Wochentagsfaktoren (`computeWeekdayFactors`): rollierendes Fenster bis zum jüngsten ausgewerteten
    Tag, normiert auf Mittelwert 1 über die geöffneten Wochentage;
  - Zielstufen (`computeTargets`), Ampel (`evaluateDay`), Zeiträume (`aggregatePeriod`,
    `aggregateToDate` mit Hochrechnung).
- **Die Management-App rechnet nichts selbst** - sie zeigt, was `GET /api/finance/targets`,
  `/targets/status` und `/targets/period` liefern (Fehler mit `message` + `error`). Das gilt auch für
  die Wochentagstabelle: `deviation` (Ø Ist − Ziel) kommt je Zeile vom Server, und das Verhältnis
  Ø Ist / Ziel steht **einmal je Stufe** (`average_ratio`). Es ist per Konstruktion an allen
  Wochentagen gleich (Faktoren sind auf die Wochentagsmittel normiert) und steht deshalb als Fußnote
  unter der Tabelle - als Prozent in jeder Zeile läse es sich wie „alle Wochentage gleich gut“.
- **Die Config liegt in `hq`, nicht hier:** `hq/data/finance/config/targets.json` (`HQ_FINANCE_DIR`).
  `mode: 'derived'` leitet aus `finance-summary.json` ab, `mode: 'manual'` überschreibt die Ableitung
  vollständig. Fehlt die Datei oder ist sie unplausibel (Schwellen, Ruhetage, Kostenquote ≥ 1, keine
  Fixkosten), antwortet der Server mit `status: 'no-target'` und einem Grund - **nie** mit einem
  geschätzten Ziel.
- **Annahmen sind markiert.** `non_pos_revenue_monthly` und `private_draw_monthly` sind bewusst
  `null`; die Ableitung daraus ist eine Annahme (`assumed: true` an der Entnahme-Stufe,
  `cost_base.assumptions`), und die Oberfläche sagt das.
- **`open` heißt nicht rot.** Der laufende Tag, die Zukunft, Ruhetage (`closed_weekdays`, ISO 1 =
  Montag) und vergangene Tage ohne Bericht (Ferien, Feiertage, fehlender Export - ohne
  Öffnungskalender nicht unterscheidbar) sind `status: 'open'` mit `reason` und Label. Sie zählen
  weder als Ist noch als Ziel und fließen nicht in die Faktoren ein. Ein Tag mit Umsatz ≤ 0
  (Storno-Tag) ebenso wenig. `last_evaluated_date` ist der jüngste Tag **vor** heute mit Bericht - im
  Regelfall gestern.
- **Farbe ist nie der einzige Träger.** `TargetStatusChip` zeigt immer Label + Verhältnis, trägt
  `data-status` und eine je Modus geprüfte Palette (`useTargetStatusColors`, ≥ 4,5:1 auf `paper` in
  Light und Dark). Keine MUI-`warning.main`-Texte dafür - die fallen in Light auf ~3:1.
- Rechte wie die Finanzdaten (Passwort-Sitzung, Inhaber).

## Tests

- API, Finanzen: `npx jest -c apps/bakery-api/jest.config.js apps/bakery-api/tests/unit/finance`
  (Core und Routen, `financeCore.test.js`, `financeRoutes.test.js`)
- API, Jahr/Monat: `npx jest -c apps/bakery-api/jest.config.js apps/bakery-api/tests/unit/financeReport`
  (`financeReportCore.test.js`, `financeReportRoutes.test.js`)
- API, Tagesziel: `npx jest -c apps/bakery-api/jest.config.js apps/bakery-api/tests/unit/targets`
  (`targetsCore.test.js`, `targetsRoutes.test.js`; synthetische Fixtures in Temp-Verzeichnissen)
- Management-App: `src/lib/finance.spec.ts`, `src/lib/financeApi.spec.ts`,
  `admin/finance/FinanceClient.spec.tsx`, `src/lib/targetsApi.spec.ts`,
  `components/targets/TargetsTile.spec.tsx`, `components/targets/TargetStatusChip.spec.tsx`,
  `admin/finance/tagesziel/TagesZielClient.spec.tsx`, `admin/finance/{jahr,monat}/**/*.spec.tsx`,
  `src/lib/financeCharts.spec.ts`, `components/finance/{FinanceCharts,FinancePrint}.spec.tsx`

Fixtures sind erfunden: `apps/bakery-api/tests/fixtures/finance-summary.synthetic.js`,
`apps/bakery-management/src/lib/targetsFixtures.ts`, `apps/bakery-api/tests/fixtures/finance-report.synthetic.js`,
`apps/bakery-management/src/lib/financeReportFixtures.ts`. Nie einen echten Auszug hineinkopieren.
