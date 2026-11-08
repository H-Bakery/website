# Rest am Abend (M4, nach dem Pilot)

Der Verkauf zählt bei Ladenschluss am Laden-Tablet (PIN-Station), was übrig ist; der Inhaber sieht
unter `/admin/rest/auswertung` gebacken / verkauft / Rest / Restquote je Posten.

**Code:** Rechnung `apps/bakery-api/src/services/rest-am-abend.core.js` · DB, Transaktion, Audit
`rest-am-abend.service.ts` · Routen `src/routes/rest.routes.ts` (`/api/rest`) · Management-App
`src/lib/restApi.ts`, `src/app/admin/rest/RestClient.tsx`,
`src/app/admin/rest/auswertung/RestAuswertungClient.tsx`.
API-Details (Endpunkte, Fehlercodes, Tabelle `rest_counts`): [`docs/api/rest.md`](../api/rest.md).

## Regeln

- **Die Rechnung steht genau einmal**, in `rest-am-abend.core.js` (dependency-frei). Die
  Verkaufszahlen nehmen die Z4-Helfer aus `backzettel-reference.core.js` (`itemSoldInfo`,
  `soldOnDay`, `soldResolver`) und `reports-files.core.js`, das CSV `csvCell` aus
  `partner-stats.core.js`. Die Management-App rechnet nichts (`src/lib/restApi.ts` verwaltet nur
  den Entwurf am Tablet).
- **Gezählt wird je Backzettel-Posten × Sorte × hq-Produkt**, nicht je Produkt allein: der
  Backzettel rechnet in Liter/Blech, im Laden liegen Stücke. Ein Posten mit `products` wird je
  Produkt in Stück gezählt und mit dessen `factor` umgerechnet (Marmorkuchen ganz = 1 Blech,
  1 Stück = ¼), ein Liter-Posten ohne Produkte mit `pieces_per_liter` in Stück (Faktor 1/ppl),
  sonst in seiner eigenen Einheit. Der Faktor wird beim Zählen mitgespeichert. Ein Posten mit Sorten
  wird je Sorte gezählt (400 `variant_required`, wie bei Vorbestellungen).
- **Restquote = Rest ÷ (gebacken − CAP).** Gebacken = Gesamt des **freigegebenen** Backzettels plus
  quittierte Nachträge; CAP-Ware verlässt den Laden und kann dort nicht übrig sein. Ohne Freigabe
  zeigt die Zählliste „geplant" und die Auswertung zählt den Tag nicht.
- **Ein Tag ohne vollständige Zählung ist eine Lücke, keine 0** (`partial` / `not_counted`,
  gestrichelt im Verlauf, `uncountedDates` je Posten) - nicht wegoptimieren, sonst liest sich eine
  vergessene Zählung wie „alles verkauft".
- **Mehr Rest als für den Laden gebacken** (`restExceedsShop`) steht an der Zeile als „bitte
  nachzählen", in der Auswertung je Posten mit den Tagen (`restExceedsDates`), an der
  Einheiten-Kachel als Zahl der Posten (`restExceedsItems`), im CSV als Spalte „Zählung prüfen"; in
  den Rest Ø der Grundmengen gehen solche Tage nicht ein (`excludedDates`).
- **Zählzeilen von damals:** jede gespeicherte Zählung hält in `rest_counts.line_rows` fest, welche
  Produkte die Zeile da hatte - ein später in `backzettel.yaml` ergänztes Produkt macht alte Tage
  nicht „teilweise gezählt".
- **Zwei Tablets, ein Tag:** `PUT /api/rest/:date` nimmt je Zeile `expected` (was der Bildschirm
  kannte); weicht der Server ab, kommt 409 `rest_changed` mit `current` und **nichts** wird
  gespeichert. Die Seite zeigt, wer was gezählt hat, lädt neu und behält die Eingaben.
  **`expected` ist die Grundlage der Eingabe, nicht der gerade geladene Stand:** jeder
  Entwurfs-Eintrag hält `{ qty, base }` (`base` = Server-Wert beim ersten Tipp, `setDraftEntry`).
  Findet ein Neuladen oder Tageswechsel einen anderen Server-Wert (`draftConflicts`), zeigt die
  Seite den Konflikt wie bei einer 409 und setzt die Grundlage erst dann neu (`rebaseDraft`) - sonst
  überschriebe ein aufgehobener Entwurf still die Zählung eines anderen Tablets.
- Korrekturen stehen mit altem und neuem Wert im `audit_log` (`rest_count`), `revision` zählt mit.
  Gezählt und korrigiert wird nur heute bis 7 Tage zurück (Berlin), nie am Ruhetag.
- **Nicht im Pilotbetrieb.** `/admin/rest` steht in `ROLE_ACCESS` (Verkauf zählt, Backstube liest,
  Auswertung nur Inhaber; `REST_COUNT_ROUTE` in `src/lib/roles.ts`), aber **bewusst nicht** in
  `PILOT_ALLOWED_ROUTES`, sondern in `PILOT_HIDDEN_ROUTES` - mit `NEXT_PUBLIC_PILOT_MODE=1` fehlt die
  Seite, bis der Inhaber sie freigibt (Eintrag in `PILOT_ALLOWED_ROUTES` ergänzen;
  `pilotMode.spec.ts` und `roles.spec.ts` prüfen den heutigen Stand).

## Bedienung am Tablet

- Große −/+ (56 px), Zahl antippen öffnet einen Ziffernblock (Komma nur bei Liter/kg), „Nichts
  übrig" je Zeile setzt alle Produkte der Zeile auf 0, eine feste Leiste unten speichert alle
  Änderungen auf einmal. 28 Posten = 61 Fingertipps im Smoke (≈ 1,5 min).
- **Entwürfe je Benutzer:** ungespeicherte Eingaben liegen je **Benutzer** und Tag im
  `localStorage` (`bakery-rest-draft:<userId>:<datum>`, nur Komfort) - an der PIN-Station erbt die
  nächste Person weder die Zahlen der vorigen noch speichert sie sie unter eigenem Namen; wer nur
  lesen darf (Backstube), sieht immer den Server-Stand. Entwürfe anderer Tage nennt ein Hinweis mit
  Sprung dorthin (`listDraftDates`), und „Abmelden" fragt bei ungespeicherter Zählung nach.
- **Fehler deutsch** (`describeBackstubeError`: kein Server → „Keine Verbindung zum Server – bitte
  WLAN prüfen."), Meldungen zusätzlich in der festen Leiste unten. Nach einer 409 steht an der Zeile
  „Inzwischen gespeichert: X von Y · deine Eingabe: Z", und der Knopf heißt „Meine Zahlen
  speichern". An einem Tag, der nicht mehr speicherbar ist, bietet die Leiste nur „Verwerfen".

## Querverbindungen

- **Grundmengen (Z4):** „Rest am Abend Ø" steht zusätzlich im Hinweis der Referenz
  (`GET /api/rest/averages`, nur Information, siehe [backzettel.md](backzettel.md)).
- **Snapshot nach hq (Z9):** nach jeder Zählung schreibt die API (falls `HQ_SNAPSHOT_DIR` gesetzt)
  `hq/data/production/rest/<datum>.json` - ohne Namen und Uhrzeiten.

## Tests

- API: `apps/bakery-api/tests/unit/restAmAbend.test.js` und
  `apps/bakery-api/tests/integration/rest.test.ts` (`npx jest -c apps/bakery-api/jest.config.js …`)
- Management-App: `src/lib/restApi.spec.ts`, `admin/rest/RestClient.spec.tsx`,
  `admin/rest/auswertung/RestAuswertungClient.spec.tsx`
