# Produkte (hq/products)

Produkte sind die Markdown-Dateien in `hq/products/*.md` (YAML-Frontmatter + Body). Die Verwaltung
liest und schreibt sie über die API, der Shop liest den freigegebenen Stand, Partner und
Vorbestellungen holen daraus ihre Preis-Snapshots.

**Code:** Regeln `apps/bakery-api/src/services/hq-products.core.js` · Eingabegrenzen
`product-input.core.js` · Serialisierung `product-file.core.js` (`serializeProductFile`) · Katalog-Cache
`hq-catalogue.ts` · Datei-I/O + git `hq-products.service.ts` · Routen `src/routes/hq-products.routes.ts`
· Management-App `apps/bakery-management/src/lib/products.ts` (`fetchManagementProducts`,
`toManagementProduct`), `src/lib/hqProductsFs.ts` (Partner-Katalog, serverseitig).
API-Details (Endpunkte, 503-Codes, Write-back B5b, Snapshots Z9): [`docs/api/hq-products.md`](../api/hq-products.md).

## Endpunkte (Vertrag des früheren Mocks, D3)

`GET /api/products`, `GET /api/hq-products[/:id]`, `PUT /api/hq-products/:id`,
`POST /api/hq-products`. Lesen darf jede Sitzung, Schreiben nur `inhaber`. `GET /api/hq-products`
(Liste) ist neu gegenüber dem Mock. Eine Vertrags-Suite
(`apps/bakery-api/tests/contract/hqProducts.contract.test.ts`) vergleicht Antworten **und** die
geschriebenen Bytes mit den aufgezeichneten Antworten des Mocks.

**Öffentlicher Katalog für den Shop (B12):** mit `PUBLIC_CATALOGUE=1` antwortet `GET /api/products`
auch ohne Sitzung (vor der globalen Wache eingehängt); alles andere bleibt hinter der Anmeldung.
Vorgabe aus - ob die Box ihn einschaltet, entscheidet der Inhaber zusammen mit einem öffentlichen
Bestellweg (siehe [`docs/apps/shop.md`](../apps/shop.md)).

**Kein DELETE** - ein Produkt entfernen heißt, eine git-verwaltete Datei in `hq` zu löschen.

`POST` vergibt die id (Slug mit umgeschriebenen Umlauten, `slugify`) und die nächste `numeric_id` und
schreibt `{numeric_id}-{id}.md`.

## Invarianten

- **Null-Diff beim Speichern ohne Änderung.** Ein Speichern ohne Änderung schreibt und committet
  nichts. Dafür serialisiert die API mit `serializeProductFile()` (`product-file.core.js`), nie
  mit `matter.stringify()` - so bleiben Schlüssel-Reihenfolge und die Quoting-Konvention von
  `image`/`short_description` erhalten. Nach jeder Änderung an diesem Code prüfen, dass ein No-op-Save
  einen leeren `git diff` ergibt.
- **Kurztext und Beschreibung nie zusammenlegen.** `short_description` (Frontmatter) und der Body sind
  zwei Felder; in der Management-App `shortDescription` und `description` von `ManagementProduct`.
  Genau das Zusammenlegen war der ursprüngliche Datenverlust: ein Speichern überschrieb den ganzen
  Absatz jedes Produkts mit seinem Einzeiler.
- **Beschreibung aus `rawDescription`, nie aus `description`.** Die Verwaltungssicht
  `/api/hq-products[/:id]` liefert zusätzlich `rawDescription` - den Body ohne Überschrift, **ohne**
  den Rückgriff auf `short_description`, den `description` für den Shop hat (`managedFields()` in
  `hq-products.core.js`). `toManagementProduct()` liest dieses Feld; sonst schriebe ein Speichern
  ohne Änderung bei einer Datei ohne Beschreibung den Kurztext in den Body. PUT/POST-Antworten (wie
  früher der Mock) haben kein `rawDescription`; dort ist `description` der Body.
- **Fehler mit `message` und `error`.** `ApiClient` wirft bei Nicht-2xx `new Error(data.message)`; ein
  Body nur mit `error` verliert den deutschen Text. Die echte API antwortet über `sendError()`
  (`src/utils/http-error.ts`) immer mit beidem.
- **Namen werden vor dem Schreiben gegengelesen.** `serializeProductFile` quotet alles, was YAML
  umdeuten würde (`Brot:`, `'s Weck`, `1e3`, `0x1F`, ...); die API parst die fertige Datei noch
  einmal (`roundTripsAs`) und antwortet 400 `invalid_product_file`, statt eine unlesbare Datei nach hq
  zu committen.
- **Grenzen vor jedem Schreiben** (`PRODUCT_LIMITS` in `product-input.core.js`): Name ≤ 120 Zeichen ohne Steuerzeichen, Preis 0…10000 € mit höchstens zwei
  Nachkommastellen, `short_description`/`image` ≤ 500, Body ≤ 20000 - sonst 400 `validation` mit
  deutscher `message` statt 500.

## Schreibwege und Freigabe

- **Zwei Schreibwege.** Mit `HQ_WRITE_DIR` (Box) landet die Datei im Schreib-Worktree (`app/edits`)
  und wird dort committet - Autor `Verwaltung (App)`, Bearbeiter als `Co-authored-by`; Push und
  rollende PR nach hq macht B5b. Ohne `HQ_WRITE_DIR` (Entwicklung) wird direkt nach
  `HQ_PRODUCTS_DIR` geschrieben. Den Lese-Klon fasst die API mit `HQ_WRITE_DIR` nie an.
- **Produktion verlangt beide Verzeichnisse** (`HQ_PRODUCTS_DIR` oder `HQ_DIR`, und `HQ_WRITE_DIR`,
  absolut, nicht ineinander) - sonst startet die API nicht. Geschrieben wird nur, wenn der
  Schreib-Worktree auf `app/edits` steht (`HQ_WRITE_BRANCH`), sonst 503.
- **„Wartet auf Freigabe“ (`pendingApproval`)** steht an jedem Produkt: die Datei im Schreib-Worktree
  weicht vom freigegebenen Stand ab. Die Verwaltung zeigt das als Chip in Produktliste und
  Bearbeiten-Seite, mit dem freigegebenen Stand (`approved`) als Hinweis.
- **Zwei Sichten, bewusst:** `/api/products` (Shop, und `getCatalogue()`) liefert bis zum Merge den
  **freigegebenen** Stand; `/api/hq-products[/:id]` (Verwaltung) liefert den Stand im
  Schreib-Worktree - den, auf dem ein `PUT` aufbaut - und bei wartenden Produkten daneben `approved`
  (`null` bei neuen). Die Verwaltungs-GETs nicht auf den Lese-Klon zurückdrehen: das
  Bearbeiten-Formular schickt immer alle Felder, sonst überschriebe das zweite Speichern die wartende
  Änderung mit den alten Werten. `PUT`/`POST` antworten zusätzlich mit `pending`. Die Liste
  `/api/hq-products` zeigt auch neu angelegte, noch nicht gemergte Produkte, `/api/products` nicht.
- **Katalog für andere Domänen:** Partner (B6) und Vorbestellungen (B7) holen Name und Preis für ihre
  Snapshots aus `getCatalogue()` / `getProduct()` in `hq-catalogue.ts` - freigegebener Stand,
  gecacht, nie eigene Dateizugriffe.

## Management-App

Die Produktseiten holen ihre Daten im Browser über `fetchManagementProducts()` /
`fetchManagementProduct()` (kein `fs`). Neu/Bearbeiten nur für `inhaber` (die API antwortet sonst
403); andere Rollen sehen die Liste ohne Stift. Der Partner-Katalog der Erfassungsmaske liest weiter
serverseitig aus `HQ_PRODUCTS_DIR` (`hqProductsFs.ts`, dasselbe Verzeichnis wie die API). Die
Dashboard-Kachel zählt `/api/products` (freigegebener Stand).

## Preisliste (Export)

Auf der Produktseite öffnet „Preisliste“ einen Dialog: ganzes Sortiment oder Kategorien, Laden oder
Verkaufspartner, „gültig ab“, mit/ohne Allergene, mit/ohne nicht verfügbare Produkte. Daraus entsteht
die Druckansicht `/admin/products/preisliste` (A4 hoch, zweispaltig, immer hell; „Drucken / als PDF
speichern“) und ein CSV für Excel (Semikolon, Dezimalkomma, BOM).

**Code:** Regeln `apps/bakery-api/src/services/price-list.core.js` (`buildPriceList`,
`priceListToCsv`) · Routen `src/routes/price-list.routes.ts` · Management-App
`src/lib/priceListApi.ts`, `src/app/admin/products/preisliste/**` (`PriceListDialog`,
`PriceListSheet`) · Absender `src/lib/seller.ts` (aus `LEGAL` in `@bakery/shared/utils`,
`lib/legal.ts` - dieselben Angaben wie im Impressum, nicht abtippen).

- **Ein Dokument, zwei Ausgaben.** `GET /api/price-list` liefert Kategorien, Zeilen, Varianten und
  fertig formatierte Preise; `GET /api/price-list/export.csv` dieselbe Liste als CSV. Die App
  gruppiert, sortiert und formatiert nichts selbst. Query: `audience=laden|partner`, `partnerId`,
  `categories=brot,kuchen`, `validFrom=JJJJ-MM-TT`, `includeUnavailable=1`, `allergens=1`.
- **Rollen:** Ladenliste `inhaber` und `verkauf`, Partnerliste nur `inhaber` (sonst 403). Die Seite
  steht für `verkauf` in `ROLE_ACCESS`.
- **Freigegebener Stand** (`hq-catalogue.ts`, wie `/api/products`): eine Liste, die das Haus
  verlässt, zeigt keine Änderung, die noch auf Freigabe wartet. Der Dialog weist darauf hin.
- **Preise wie gespeichert**, nur auf zwei Nachkommastellen aufgefüllt („2,50 €“). Gerundet wird
  nie; ein Preis mit mehr als zwei Nachkommastellen bleibt stehen und kommt als `dataWarnings`.
- **Kein Preis ist kein Preis.** Ein Produkt ohne Preis (fehlt, kein Zahlwert, 0) steht nicht auf
  dem Blatt und nicht im CSV, sondern in `omitted.noPrice` - die Seite nennt es über dem Blatt als
  „Preis offen“ (nur am Bildschirm). Nie „auf Anfrage“, nie „0,00 €“.
- **Einheiten nur aus dem Namen.** hq hat kein Feld für Einheit oder Gewicht. Der Core liest
  „500g“, „(1 Stück)“, „(1/4 Stück)“ und - bei Geschwistern - „klein“/„groß“ aus dem Namen und
  fasst gleiche Grundnamen zu einer Zeile zusammen (Brot als Tabelle 500 g | 750 g | 1000 g). Der
  ganze Kuchen neben seinem Stück bekommt **keine** erfundene Einheit („ganz“ steht nicht in hq).
- **Reihenfolge:** Kategorien fest (Brot, Brötchen, Baguette, Snacks, Teilchen, Kuchen, Torten,
  Unbekanntes danach), darin wie in hq (`numeric_id`).
- **Allergene nur positiv** (Texte und Reihenfolge aus `@bakery/shared/utils`): ohne Eintrag in hq
  steht „bitte nachfragen“ mit dem Hinweis aus `NO_DECLARATION_NOTE`, nie „keine“. Weichen
  Varianten einer Zeile ab, steht die Angabe je Variante da, nie die Vereinigung.
- **Druck:** Fußzeile mit „Stand“ und Seitenzahl über `@page`-Randfelder (Chrome); „Stand“ steht
  auch im Kopf. Eine Kategorie-Überschrift bleibt mit ihren ersten drei Zeilen zusammen
  (`ROWS_KEPT_WITH_HEADING`), eine Zeile wird nie getrennt. Geprüft wird das echte Blatt mit
  `page.pdf()`.
- **Kein PDF vom Server.** Auf `main` gibt es noch keine PDF-Bibliothek; das PDF entsteht über den
  Druckdialog des Browsers. Kommt mit den Rechnungen eine PDF-Bibliothek, kann
  `GET /api/price-list/export.pdf` dasselbe Dokument rendern.
- **Partnerliste:** siehe [`verkaufspartner.md`](verkaufspartner.md#preisliste-für-partner).

## Tests

`apps/bakery-api/tests/unit/{hqProductsCore,productFileSerializer,productInputValidation}.test.js`,
`tests/integration/hqProducts.test.ts` (u. a. Null-Diff mit `rawDescription`),
`tests/contract/hqProducts.contract.test.ts`; Management-App `admin/products/{page,productsApi}.spec.tsx`.
Preisliste: `tests/unit/priceListCore.test.js`, `tests/integration/priceList.test.ts`; Management-App
`lib/priceListApi.spec.ts`, `admin/products/preisliste/*.spec.tsx` (Dokument aus dem echten Core,
`lib/priceListFixtures.ts`).
