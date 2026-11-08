# Kassenberichte (hq/data/reports)

Die Management-App zeigt unter `/admin/reports` die **Tagesabschlüsse der Kasse** aus
`hq/data/reports/converted/` (ein JSON je Tag und Kasse, `YYYY-MM-DD_<Kasse>[_2].json`). Das
Dashboard („Kasse · Stand: <Tag>“) und `/admin/analytics/*` rechnen mit denselben Daten.

**Code:** Formeln `apps/bakery-api/src/services/reports.core.js` · Datei-Lese-Schicht
`reports-files.core.js` · Routen `apps/bakery-api/src/routes/reports.routes.js` (bis B12
`reports.mock.js`) · Einhängen in die echte API `src/routes/hq-data.routes.ts` · Loader der Management-App
`apps/bakery-management/src/lib/reports.ts` · Analysen-Client
`libs/shared/data-access/src/lib/services/analytics.service.ts`.
API-Details: [`docs/api/hq-data.md`](../api/hq-data.md).

Pfad: `HQ_REPORTS_DIR`, sonst `<website>/../hq/data/reports`.

## Regeln

- **Die Formeln stehen genau einmal**, in `reports.core.js` (dependency-freies CommonJS, gleiche
  Konvention wie `partner-stats.core.js`); die Datei-Lese-Schicht daneben in `reports-files.core.js`.
  Die Routen (`reports.routes.js`) und der Loader der Management-App benutzen beide.
- **Der Loader lädt den Core zur Laufzeit** über Nodes `createRequire` aus dem Monorepo, weil ein
  statischer Import einer App vom Modul-Grenzen-Lint verboten ist (`Imports of apps are forbidden`) -
  wer die Datei verschiebt, muss `CORE_DIR` in `reports.ts` nachziehen. Das Berichtsarchiv, der
  Kassentag und die Kassen-Kachel des Dashboards sind Server-Komponenten auf diesem Loader; die
  Wache davor ist `src/proxy.ts` (nur Rollen, die `/admin/reports` öffnen dürfen). Die Analysen
  holen ihre Daten über die API.
- **`payment: 'Unbar'` ist Karte.** Wer auf `'Karte'` filtert, bekommt null. `'Keine'` sind
  Gutscheineinlösungen und 0-Euro-Bons („Ohne Zahlung“).
- **Ein Tag ohne Datei ist eine Lücke, kein Umsatz 0** (`status: 'no-data'`). Montag ist Ruhetag,
  dazu Betriebsferien und fehlende Exporte. Liste, Detailseite und Analysen zeigen das als „kein
  Bericht“; nicht wegoptimieren.
- **Keine Beispieldaten.** Fehlt das ganze Verzeichnis (CI), wird einmal
  `HQ reports directory not found` geloggt und leer geantwortet - auch `analyticsService` liefert
  dann `available: false` statt erfundener Zahlen.
- **Umsatz = Σ Bon-Total ohne abgebrochene Belege** (`type: 'cancelled'`), Stornos negativ. Genau so
  stimmt die Summe mit dem Kassenabschluss (`daily_summary.total_revenue`) überein.
- **Bons zählen ohne Storno-Gegenbuchungen - überall gleich:** Kachel (`receiptCount`), Zahlungsmix
  (`payments.*.count`) und Kassenabschluss (`closings[].receiptCount`) ergeben dieselbe Zahl; die rohe
  Buchungszahl inkl. Stornos und Abbrüche steht nur in `closings[].transactionCount`.
- Positionsmengen einzelner Tage können durch Storno-Paare über die Tagesgrenze **negativ** sein -
  die Detailseite warnt dann, statt die Zeile zu verstecken.
- **Ein Zeitraum ist höchstens `MAX_RANGE_DAYS` (400) Tage lang.** Die Zahl steht im Core; die
  Routen lehnen längere Anfragen mit `range_too_large` ab, die Archivseite kürzt `?from=&to=` mit
  `clampRange` (das Ende bleibt, der Anfang rückt nach) und sagt es an. Ohne die Kappung liefert
  `?from=2000-01-01` jede Tagesdatei aus - ein Tippfehler im Jahr genügt.
- Kategorie-Aufschlüsselungen sind leer, weil `convert_reports.js` in `hq` `group_name` verwirft.

## Endpunkte

`GET /api/reports/daily?from=&to=`, `/api/reports/daily/:date`, `/api/reports/monthly/:month` sowie
`/api/analytics/{revenue-trends,product-performance,payment-methods,summary}`. Fehler mit `message`
**und** `error`.

## Echte API (B4)

Die echte API (`createApp()`) hängt `reports.routes.js`, `finance.routes.js` und
`targets.routes.js` ein (`hq-data.routes.ts`) - bis B12 hießen sie `*.mock.js` und dienten auch dem
Mock-Server; nicht kopieren.

- **Rechte im Pilot:** Berichte und Analysen nur `inhaber` (auch an der PIN-Station); Finanzen und
  Tagesziel siehe [finanzen.md](finanzen.md). Die Module fragen `requireRole('inhaber')`;
  `createRoleGuards()` lehnt beim Einhängen jede Rolle außerhalb der Pilot-Rollen ab.
- Pfade aus `HQ_REPORTS_DIR` / `HQ_FINANCE_DIR` (`config/env.ts`).
- **Vertrag:** `apps/bakery-api/tests/contract/hq-data.contract.test.ts` vergleicht die
  aufgezeichneten Mock-Antworten mit der echten API auf einem synthetischen hq-Baum
  (`tests/fixtures/hq-data.synthetic.js`) bis aufs Byte.

## Tests

- Core: `npx jest -c apps/bakery-api/jest.config.js apps/bakery-api/tests/unit/reportsCore.test.js` (26)
- Echte API: `tests/integration/hqData.test.ts`, Vertrag siehe oben
- Management-App: `src/lib/reports.spec.ts`, `admin/reports/**/*.spec.tsx`,
  `admin/analytics/**/*.spec.tsx`

Alle mit synthetischen Fixtures, nie mit echten Tagesfiles - das Repo ist öffentlich.
