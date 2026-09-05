# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Scope: the `bakery-delivery` app (Fahrer-App), the two libs only it consumes, and the delivery
endpoints of the API. Monorepo-wide rules live in `website/CLAUDE.md` and the workspace root
`CLAUDE.md` — read those for Nx conventions, the `hq/` content source, and the API's known-broken
state. Everything below is specific to the delivery system and verified against the tree on
2026-09-05.

## What this is

Die Samstagsauslieferung der Bäckerei mit **ein bis zwei Fahrern**. Eine _Tour_ gehört einem Tag und
einem Fahrer und besteht aus _Stopps_ in gefahrener Reihenfolge. Der Fahrer hakt unterwegs ab
(`done` / `failed`), die Backstube sieht am selben Datensatz, wie weit die Tour ist.

Das ist bewusst **nicht** dasselbe wie der Backschrank beim CAP-Markt: dort wird ein _Besuch_ mit
Restbestand erfasst und der Verkauf berechnet (siehe „Verkaufspartner" in `website/CLAUDE.md`). Hier
wird nur zugestellt. Der CAP-Markt taucht in beiden auf — als Verkaufspartner _und_ als Stopp der
Samstagstour.

## Commands

Es gibt jetzt npm-Skripte; der Rest läuft über Nx, von `website/` aus:

```bash
npm run serve:delivery                 # Fahrer-App auf Port 4300
npm run serve:api:simple               # die API, die sie braucht (Port 5000)
npm run test:e2e:delivery              # Playwright, startet beide Server selbst

npx nx build bakery-delivery
npx nx lint bakery-delivery
npx nx test delivery-routing           # 32 Tests, darunter der Abgleich mit dem Server-Core
npx nx test delivery-tracking          # 7 Tests
npx jest --config apps/bakery-api/jest.config.js --rootDir apps/bakery-api \
  --testPathPattern deliveryTours      # 46 Tests der Server-Rechenlogik
npx tsc --noEmit -p apps/bakery-delivery/tsconfig.json   # laeuft auch in `npm run type-check`
```

**Der Port steht jetzt in `project.json` (4300).** Ohne ihn fiel `@nx/next:server` auf 4200 zurück —
den Port des Shops. Landing 3000, Shop 4200, Management 4201, Lieferung 4300.

**Die API muss laufen und aktuell sein.** Ohne sie zeigt die App „Keine Verbindung zur Bäckerei-API".
Ein `simple-server.js`, der schon vor den Liefer-Endpunkten gestartet wurde, antwortet auf
`/api/deliveries/*` mit 404 — dann hilft nur ein Neustart des Servers.
`NEXT_PUBLIC_API_URL` überschreibt die Adresse (Default `http://localhost:5000`); der Wert wird beim
Build eingebacken, ein Wechsel braucht also einen Neustart des Dev-Servers.

## Wo was gerechnet wird

**Alle Formeln des Servers stehen genau einmal**, in `apps/bakery-api/src/services/delivery-tours.core.js`
— dependency-freies CommonJS, gleiche Konvention wie `partner-stats.core.js`. Der Mock-Server und die
Tests benutzen es. Weil `@nx/js:tsc` ohne `allowJs` läuft, greift die `*.core.js`-Glob unter `assets`
in `apps/bakery-api/project.json`; neue Core-Dateien landen dadurch automatisch in `dist/`.

Das Frontend hat in `@bakery/delivery/routing` eine **zweite, TypeScript-Fassung derselben Geometrie**
(Haversine, Umwegfaktor 1.35, Standzeit 180 s). Die Grenze CommonJS ↔ ESM lässt sich nicht ohne
Build-Umbau überbrücken. Wer eine der Konstanten ändert, muss beide Dateien anfassen — sonst
widersprechen sich Server- und Bildschirmzahlen, genau wie früher, als die Gesamtstrecke euklidisch
und die Einzelstrecken per Haversine gerechnet wurden. `src/lib/core-consistency.spec.ts` in der
Routing-Lib lädt den Server-Core zur Laufzeit und vergleicht Konstanten, Etappen, Reihenfolge,
Ankunftszeiten und `hasCoordinates()` — der Test fällt um, wenn nur eine Seite geändert wurde.

Die Reihenfolge und die Kilometer kommen vom **Server**, nicht vom Handy: eine Optimierung, ein
Ergebnis, für Fahrer und Backstube identisch, und das Handy braucht dafür kein Netz.

## Zwei fremde Dienste, beide optional

`apps/bakery-api/src/services/delivery-geo.core.js` spricht mit zwei öffentlichen OSM-Diensten, beide
ohne Schlüssel:

| Dienst    | Wofür                                                          | Env-Override                           |
| --------- | -------------------------------------------------------------- | -------------------------------------- |
| Nominatim | Adresse → Koordinaten                                          | `NOMINATIM_URL`, `GEOCODER_USER_AGENT` |
| OSRM      | Reihenfolge (Trip/TSP), Fahrstrecke, Fahrzeit, Streckenverlauf | `OSRM_URL`                             |

**Fällt einer aus, gibt die Funktion `null` zurück und der Aufrufer rechnet mit den Schätzformeln
weiter.** Die Tour darf nie an einem fremden Server hängen — samstags früh um sechs muss die Liste
da sein. Geschätzte Werte tragen `isEstimate: true`, und die Oberfläche schreibt „(geschätzt)"
dahinter. Das nicht wegoptimieren: sonst liest sich eine Luftlinien-Schätzung wie eine gemessene
Strecke.

Nominatim verlangt einen aussagekräftigen User-Agent und höchstens **eine Anfrage pro Sekunde**;
beides steckt in `delivery-geo.core.js`. Treffer landen dauerhaft im `geocache` des Stores, eine
Adresse wird also genau einmal gesucht. `addressCandidates()` probiert absteigend genauer:
volle Adresse → Hausnummernbereich „36-38" auf „36" verkürzt → ohne Hausnummer. Ohne diesen zweiten
Versuch findet Nominatim die hiesigen Adressen teilweise nicht.

**Nominatim antwortet auf „Talstraße 5" ohne Fehler mit der Straßenmitte**, wenn es die Hausnummer
nicht kennt. Deshalb fragt `geocodeAddress()` mit `addressdetails=1` und gibt `precision` zurück:
`'house'`, wenn der Treffer eine Hausnummer trägt, sonst `'street'` — der Kandidat ohne Hausnummer
zählt immer als `'street'`, auch wenn Nominatim dafür irgendein Haus liefert. Ein Straßen-Treffer
wird erst genommen, wenn kein genauerer Kandidat mehr trifft: „Kaiserstraße 60-62" kennt Nominatim
nur als Straße, „Kaiserstraße 60" als Haus. Der Wert wandert über
den `geocache` als `geocodePrecision` auf den Stopp; die Oberfläche sagt bei `'street'` dazu, dass
nur die Straße gefunden wurde. Cache-Einträge von vor dieser Unterscheidung haben kein `precision`,
der Stopp bekommt dann `null` (unbekannt) — nicht `'house'`. Wer sie nachprüfen will, löscht den
`geocache` im Store; von Hand gesetzte Koordinaten (`geocodeSource: 'manual'`) haben ebenfalls `null`.

**Das Lesen einer Tour hängt nicht an Nominatim.** `GET /tours` und `GET /tours/:id` suchen
fehlende Koordinaten zwar nach, warten darauf aber höchstens `HYDRATE_BUDGET_MS` (2,5 s); dauert es
länger, geht die Antwort ohne die Koordinaten raus, die Suche läuft im Hintergrund weiter und der
nächste Aufruf sieht das Ergebnis. Fehlversuche merkt sich `lookupAddress()` fünf Minuten lang
(`geocodeMisses`), sonst liefe bei Netzausfall für jeden nicht gefundenen Stopp bei jedem Lesen ein
Timeout. Ausdrückliche Aktionen — Stopp anlegen, Adresse ändern, Route berechnen, Depot ändern —
suchen mit `force` trotzdem. Gleichzeitige Anfragen nach derselben Adresse teilen sich eine Suche
(`geocodeInFlight`).

## Datenhaltung

Kein Datenbankzugriff — der Mock-Server ist die einzige laufende API (siehe Root-`CLAUDE.md`).
Der Store lebt **im Speicher des Servers** (`getDeliveryStore()`, einmal geladen) und wird nach
jeder Änderung als JSON neben den Server geschrieben: **`apps/bakery-api/data/delivery-store.json`**
(gitignored, überlebt Neustarts). Geschrieben wird atomar — erst `.tmp`, dann `rename` —, damit ein
Absturz mitten im Schreiben nicht eine halbe Datei hinterlässt, die beim nächsten Start den Seed
zurückbrächte. Aufbau: `depot`, `drivers`, `tours[].stops[]`, `pickupPoints`, `preorders`, `geocache`.
Fehlt die Datei, legt `seedDeliveryStore()` sie an: die Backstube in der Eckstraße 3, zwei Fahrer mit
Platzhalternamen und die nächste Samstagstour mit dem CAP-Markt als einzigem Stopp. Namen und
Telefonnummern sind bewusst leer — die trägt das Team mit den echten Daten nach.

Alle Handler laufen durch `deliveryRoute()`: Express 4 fängt abgelehnte Promises nicht, ein Fehler
in einem `async`-Handler ließe den Request sonst hängen, bis das Handy aufgibt. So wird daraus eine
500 mit deutschem Text.

Das Depot braucht immer Koordinaten. `PUT /depot` sucht eine geänderte Adresse sofort und antwortet
mit **422**, wenn sie nicht gefunden wird — die alte Adresse bleibt dann stehen. Wer die Suche
umgehen will, gibt `lat`/`lon` direkt mit.

Der Tourstatus folgt den Stopps (`syncTourStatus()` im Core): der erste abgehakte Stopp startet eine
geplante Tour, der letzte schließt sie ab, ein zurückgesetzter oder nachträglich angelegter Stopp
macht eine abgeschlossene Tour wieder zur laufenden, das Löschen des letzten offenen Stopps schließt
sie. `PATCH /tours/:id` mit `status` setzt den Status trotzdem von Hand.

Endpunkte, alle unter `/api/deliveries`:

```
GET    /depot                        PUT /depot
GET    /drivers                      POST /drivers          PUT /drivers/:id
GET    /tours?date=&driverId=        POST /tours
GET    /tours/:id                    PATCH /tours/:id       DELETE /tours/:id
POST   /tours/:id/stops              PATCH /tours/:id/stops/:stopId
DELETE /tours/:id/stops/:stopId
POST   /tours/:id/optimize           POST /tours/:id/position
POST   /geocode

GET    /pickup-points                PUT /pickup-points/:id
GET    /preorders?date=&pickupPointId=&status=          POST /preorders
GET    /preorders/summary?date=      (VOR /preorders/:id registriert!)
GET    /preorders/:id                PATCH /preorders/:id   DELETE /preorders/:id
```

Fehlerantworten setzen **`message` _und_ `error`** — `ApiClient` wirft `new Error(data.message)`, ein
`error`-only-Body verlöre den deutschen Text. Die Liefer-Endpunkte liefern rohe Objekte (wie die
Partner-Endpunkte), nicht `{success, data}` wie die älteren Order-Routen.

## Sammelstelle Mörsbach: Vorbestellungen

Seit dem 05.09.2026 fährt die Samstagstour **nach Mörsbach an den Kindergarten**. Das ist keine
gewöhnliche Zustellung, sondern eine **Sammelstelle**: die Kundschaft bestellt vorher vor, die Ware
wird gesammelt hingebracht und dort in einem Zeitfenster übergeben. Für den Fahrer ist das **ein
Stopp mit einer Übergabeliste**, nicht zwölf Stopps.

Drei Begriffe, die auseinandergehalten werden müssen:

|                                    | wo erfasst             | was festgehalten wird                            |
| ---------------------------------- | ---------------------- | ------------------------------------------------ |
| **Besuch** (Backschrank CAP-Markt) | Management-App         | Restbestand zählen, Verkauf **berechnen**        |
| **Stopp** (Zustellung)             | Fahrer-App             | zugestellt / nicht angetroffen                   |
| **Vorbestellung** (Sammelstelle)   | **nur** Management-App | wer was bestellt hat, übergeben / nicht abgeholt |

**Vorbestellt wird ausschließlich in der Management-App** (`/admin/delivery/preorders`) — das Team
tippt Telefon- und Thekenbestellungen ein. Der Shop bleibt Abholung-only; er weiß von Mörsbach nichts.

**Alle Formeln stehen genau einmal**, in `apps/bakery-api/src/services/delivery-preorders.core.js`
(dependency-freies CommonJS, gleiche Konvention wie `partner-stats.core.js` und
`delivery-tours.core.js`, gleiche `*.core.js`-Glob unter `assets`). Dort stehen Rundung,
Referenznummern, Bestellschluss, Statusübergänge und die Backlisten-Summierung.

`pickupPoints` und `preorders` liegen im **selben** Store wie die Touren
(`apps/bakery-api/data/delivery-store.json`); ein älterer Store bekommt die beiden Schlüssel beim
Laden ergänzt, ohne dass vorhandene Touren angefasst werden.

Vier Regeln, die man kennen muss, bevor man hier etwas ändert:

- **Die Vorbestellungen hängen im Tour-Payload.** `decorateTour()` hängt an jeden Stopp mit
  `pickupPointId` die Vorbestellungen des Tourtags plus `preorderSummary`. Das ist Absicht und kein
  überflüssiger Ballast: die Fahrer-App hält die Tourliste als Offline-Kopie im `localStorage` — läge
  die Übergabeliste hinter einem zweiten Aufruf, wäre sie im Funkloch weg. Stornierte sind nicht dabei.
- **Preise und Namen sind ein Snapshot** aus `hq`, wie bei `PartnerVisitItem`. Der Client schickt nur
  `productId` und `qty`; ein mitgeschickter Preis wird ignoriert. Beim **Bearbeiten** wird der
  Snapshot bereits erfasster Positionen aus der gespeicherten Bestellung übernommen, nicht neu aus
  `hq` geholt — sonst änderte eine Preispflege rückwirkend eine Woche alte Abrechnung.
- **Keine Vorbestellung verschwindet lautlos.** `DELETE` storniert (`cancelled`), es löscht nicht.
  `handed_over → cancelled` und `cancelled → handed_over/not_collected` sind mit **409** gesperrt:
  eine stornierte Bestellung darf nicht durch ein nachgesendetes Abhaken aus dem Funkloch
  wiederbelebt werden, und eine bereits übergebene (das Geld ist geflossen) nicht durch ein Storno
  aus der Abrechnung fallen. Dieselbe Haltung wie bei `uncountedQty` am Backschrank.
- **Der Sammelstellen-Stopp entsteht beim Anlegen der Tour.** Fällt der Tourtag auf den `weekday`
  einer aktiven Lieferstelle, hängt `POST /tours` deren Stopp gleich mit an. Für Touren aus älteren
  Stores passiert das nicht — dafür warnt die Vorbestellungsliste der Management-App, dass die
  Bestellungen den Fahrer sonst nie erreichen.

Der Bestellschluss (Freitag 12:00) **blockiert nichts** — die Backstube muss nachtragen können.
Später erfasste Bestellungen tragen `afterDeadline: true` und werden in der Oberfläche markiert.

Tests: `apps/bakery-api/tests/unit/deliveryPreorders.test.js` (47).

## Fallen, die schon einmal zugeschnappt sind

- **`Number(null)` ist `0`.** Ein Stopp ohne gefundene Adresse (`lat: null`) galt damit als Punkt
  (0, 0) — im Atlantik vor Afrika — und zog Reihenfolge und Kilometer der ganzen Tour dorthin.
  Deshalb `isNumber()` / `hasCoordinates()` in `delivery-tours.core.js`, nie `Number.isFinite(Number(x))`.
  Dieselbe Falle saß noch zweimal im Code: `POST /tours/:id/position` nahm `lat: null` als Position
  auf dem Nullmeridian, und ein Depot ohne Koordinaten wäre der Startpunkt (0, 0) jeder Route
  gewesen. Beides prüft jetzt `isNumber()`; `estimateTour`, `estimateArrivals`,
  `orderStopsNearestNeighbour` und `routeTour` geben ohne Depot-Koordinaten `null` bzw. die
  unveränderte Reihenfolge zurück. Im Frontend heißt die Prüfung ebenfalls `hasCoordinates()`
  (`@bakery/delivery/routing`) — `stop.lat !== null` hätte `undefined` durchgelassen, und Leaflet
  wirft bei `[undefined, undefined]` die ganze Karte weg.
- **Jeder Request las den Store neu und schrieb seine Kopie zurück.** Ein Handler, der auf Nominatim
  oder OSRM wartete, überschrieb danach alles, was inzwischen abgehakt oder angelegt worden war — so
  verlor die E2E-Suite, die zwei Browser parallel fährt, ihren frisch angelegten Stopp. Der Store ist
  jetzt ein einziges Objekt im Speicher; nur `loadDeliveryStore()` liest die Datei, und zwar einmal.
- **Eine abgeschlossene Tour blieb abgeschlossen**, auch wenn der Fahrer einen Stopp zurücksetzte
  oder die Backstube einen nachschob. `syncTourStatus()` zieht den Status in beide Richtungen nach.
- **`{zahl && <JSX/>}` rendert bei `0` eine nackte `0`.** Genau das stand früher unter den
  Koordinaten. Optionale _Zahlen_ immer mit `!= null` prüfen, nicht auf Truthiness. Ein e2e-Test
  setzt die Genauigkeit auf 0 und prüft, dass keine alleinstehende `0` im Text steht.
- **`position.coords.speed || undefined`** machte aus „steht" (`0`) „unbekannt". `?? undefined`
  benutzen — der Unterschied ist für eine Lieferapp der Normalfall, nicht der Sonderfall.
- **Der Abholpunkt ist das Depot, nicht der erste Stopp.** `MockMapProvider.calculateRoute` baute ihn
  früher als `{...destinations[0], location: origin}` und kopierte damit Adresse, `orderId` und
  Hinweise der ersten Lieferung auf die Startposition: drei Aufträge wurden zu vier Stopps, der
  erste doppelt. `buildEstimatedRoute()` setzt jetzt `originAddress`; ein Test prüft, dass keine
  `orderId` auf dem Abholpunkt landet.
- **`L.map('feste-id')`** band die Karte an eine harte DOM-ID, es konnte also nur eine pro Seite
  geben. Jetzt `useId()`.
- **Array-Literale in `useEffect`-Dependencies.** `center = [47.37, 8.54]` als Default-Parameter ist
  bei jedem Render eine neue Identität — die Karte wurde bei jedem Render abgerissen und neu gebaut.
- **`fitBounds` bei jeder Änderung** riss dem Fahrer die Karte aus der Hand. Es passt jetzt nur neu
  ein, wenn sich die _Menge_ der Stopps ändert (Fingerprint aus den IDs), nicht beim Abhaken.
- **Ankunftszeiten einer geplanten Tour** dürfen nicht ab „jetzt" gerechnet werden, sonst steht an
  der Samstagstour die Uhrzeit von heute Nachmittag. Grundlage ist `date + plannedStart` (Default
  06:30). **Bei einer laufenden Tour** darf umgekehrt nicht ab Depot und `startedAt` gerechnet
  werden — dann stünde am sechsten Stopp um neun Uhr noch „Ankunft ca. 06:41". `arrivalBaseline()`
  im Core rechnet ab dem zuletzt erledigten Stopp oder der jüngeren gemeldeten Fahrerposition, nie
  früher als jetzt.

- **Ohne Straße keine Adresssuche.** Ein Sammelstellen-Stopp darf ohne Straße angelegt werden (die
  Adresse des Kindergartens ist noch nicht bekannt). Nominatim antwortet auf „Zweibrücken-Mörsbach"
  aber bereitwillig mit der Ortsmitte und `precision: 'street'` — auf der Karte sah das aus wie eine
  gefundene Adresse. `ensureStopCoordinates()` sucht deshalb ohne Straße gar nicht erst.
- **`window.confirm` blockiert und sieht auf dem Handy aus wie ein Absturz.** Die Rückfrage vor dem
  Abschließen eines Stopps mit offenen Vorbestellungen steht deshalb in der Oberfläche.

## Der Build war kaputt, und warum

`libs/bakery-delivery-{routing,tracking}/package.json` deklarierten `"type": "commonjs"`, während die
Quellen ESM sind. Next 16 kompiliert die Libs per Turbopack über die `@bakery/delivery/*`-Aliase aus
dem Quelltext und verweigerte den Dienst:

```
Specified module format (CommonJs) is not matching the module format of the source code (EcmaScript Modules)
```

`nx build` scheiterte daran, `nx serve` startete und lieferte auf jede Anfrage **HTTP 500**. Die Zeile
ist entfernt. Sie waren die einzigen _vom Frontend konsumierten_ Libs mit einem `type`-Feld — die
~30 anderen `"type": "commonjs"` liegen unter `libs/api/*` und werden nur von Express kompiliert, nie
von Turbopack. Falls ein `git checkout` die Zeile zurückbringt, ist das die erste Stelle zum Nachsehen.
Nicht „lösen", indem man die Libs auf CommonJS umschreibt — das bricht ihren `@nx/js:tsc`-Build.

## Naming traps

- Nx-Projektnamen der Libs sind **`delivery-routing`** und **`delivery-tracking`**, die Verzeichnisse
  heißen `libs/bakery-delivery-*`, die Import-Aliase `@bakery/delivery/*`. Drei Namen für dieselbe
  Sache; `nx build bakery-delivery-routing` scheitert.
- `libs/bakery-delivery-tracking/package.json` heißt `@bakery/delivery-libs/tracking` und passt zu
  keinem Alias. Auflösung läuft über `tsconfig.base.json`; der Name ist wirkungslos — nicht darüber
  importieren.
- `delivery` ist ein _anderes_ Projekt: `libs/api/delivery` (Express-Domäne mit Model, Controller,
  Service — vollständig getippt, aber **an keine laufende API angeschlossen**, weil `serve:api`
  nicht startet). `bakery-management-feature-delivery` ist die Admin-Ansicht. Diese App spricht mit
  keinem von beiden, sondern mit `simple-server.js`.

## Architektur

```
src/app/page.tsx              Dashboard: Fahrer-/Tagwahl, nächster Stopp, Karte, Stoppliste, Planung
src/components/StopCard.tsx   ein Stopp mit Navigation / Anrufen / Geliefert / Nicht angetroffen
src/components/AddStopForm.tsx  Erfassung inkl. „2x Bauernbrot, 10x Brötchen"-Parser
src/components/HandoverList.tsx  Übergabeliste einer Sammelstelle (Vorbestellungen abhaken)
src/components/ThemeToggle.tsx   Farbschema System / Hell / Dunkel
src/components/Map.tsx        Leaflet, dynamisch mit ssr:false
src/lib/delivery-api.ts       Typen, fetch-Client, Offline-Warteschlange
src/lib/format.ts             de-DE-Formatierung, Datumshilfen
src/lib/theme.ts              Farbschema lesen/schreiben + Inline-Skript gegen den Flash

libs/bakery-delivery-tracking  @bakery/delivery/tracking — Location/DeliveryStatus, Geolocation-Wrapper
libs/bakery-delivery-routing   @bakery/delivery/routing — Geometrie, Reihenfolge, Navi-Links, Formatierung
```

Kein Material UI, kein React Context, keine Shared-Lib der anderen Apps — diese App steht bewusst
außerhalb des MUI-Stacks. Die Oberfläche ist mobile-first mit 44-px-Trefferflächen; der Breakpoint bei
768 px ist der Ausnahmefall (Backstube am Rechner).

### Offline

Das Handy verliert im Auto das Netz. Ein Abhaken wird deshalb **erst lokal angezeigt** und bei einem
Netzfehler in eine `localStorage`-Warteschlange gelegt (`bakery-delivery-queue`), die beim
`online`-Event und sonst alle 30 s automatisch nachläuft — der Browser meldet „online", sobald
Funk da ist, ob der Server antwortet, weiß er nicht. Pro Stopp bleibt nur der letzte Stand stehen.
Eine Änderung, die der Server **fachlich** ablehnt (4xx), fliegt aus der Schlange — sonst blockierte
sie alle folgenden für immer; Netzfehler (5xx, kein Netz, Timeout) lassen den Eintrag stehen.

Jede Anfrage bricht nach 15 s ab (`AbortSignal.timeout`, wo der Browser es kann). Ohne das hing
`fetch` im Funkloch minutenlang — und solange es hing, waren alle Knöpfe gesperrt und die
Warteschlange kam nicht zum Zug. Der Hinweis „… warten noch auf den Server" bleibt sichtbar, solange
etwas in der Schlange liegt, auch wenn das Handy „online" meldet.

**Die Tour selbst hat eine Offline-Kopie.** Jeder Tipp auf „Navigation" reicht das Handy an die
Navi-App weiter; kommt der Fahrer zurück, lädt der Browser die Seite gern neu — mitten im Funkloch.
Deshalb merkt sich `delivery-api.ts` die zuletzt geladene Fahrerliste (`bakery-delivery-drivers`)
und die zuletzt geladene Tourliste samt Tag und Fahrer (`bakery-delivery-tours`). `loadTours()`
zeigt die Kopie sofort (plus Warteschlange, damit ein Abhaken von eben nicht wieder „Offen" ist)
und ersetzt sie, sobald der Server antwortet; scheitert der Aufruf, bleibt sie stehen und der
schwarze Balken sagt „Gespeicherter Stand von HH:MM Uhr". Es ist bewusst **eine** Tourliste, nicht
eine pro Tag — mit Streckenverlauf ist eine Tour schnell einige Dutzend Kilobyte groß. Die
Fahrerliste muss mit, sonst bliebe die Auswahl nach dem Neuladen auf „Alle" stehen und die Kopie
passte nicht zur Auswahl — und `loadDrivers()` wendet die gemerkte Liste **vor** dem `fetch` an,
sonst stünde die Kopie erst nach dem 15-s-Timeout von `GET /drivers` da. Der Tag wird absichtlich
nicht gemerkt (nach dem Neuladen steht wieder der nächste Samstag). Eine **leere** Kopie zählt wie
keine: „zuletzt war nichts geplant" ist ohne Server genauso wenig prüfbar wie gar keine Antwort,
also erscheint dann die Karte „Tour konnte nicht geladen werden / Erneut laden", **nicht** „noch
nichts geplant / Tour anlegen" — sonst legte der Fahrer beim nächsten Netz eine zweite Tour an.
Das Nachladen der Kopie (`online`-Event, 30-s-Takt) wartet, solange ein Abhaken unterwegs ist
(`busyRef`) oder die Warteschlange voll ist: die Änderung steht noch in keiner von beiden, und der
Server-Stand ließe den Stopp bis zum Nachsenden wieder als „Offen" erscheinen. Umgekehrt ersetzt ein
erfolgreicher `PATCH` (direkt oder aus der Warteschlange) die Kopie sofort, statt den Balken bis zum
nächsten Takt stehen zu lassen. Was fehlt: ein Service Worker. Ein kaltes Neuladen ganz ohne Netz
zeigt weiterhin die Fehlerseite des Browsers; die Kopie hilft, sobald die App-Seite selbst da ist
(Tab war noch offen, Dev-Server oder Hosting erreichbar, nur die API nicht).

### Farbschema

Drei Zustände — **System / Hell / Dunkel** —, gespeichert unter `bakery-delivery-theme`. Die Farben
sind CSS-Variablen auf `:root`; dunkel wird zweimal definiert, über
`@media (prefers-color-scheme: dark)` **und** `[data-theme='dark']`, damit die ausdrückliche Wahl in
beide Richtungen gewinnt. Ein Inline-Skript in `layout.tsx` (die Quelle steht in `src/lib/theme.ts`,
damit sie nicht doppelt gepflegt wird) setzt `data-theme` **vor dem ersten Paint** — sonst blitzt
die helle Fassung auf. Während des Renderns darf weder `localStorage` noch `matchMedia` gelesen
werden, das bricht die Hydration; beides passiert erst im Effect.

Keine festen Farben mehr in `page.module.css`. Die Leaflet-Kacheln werden im Dunkelmodus per
CSS-Filter abgedunkelt, die Marker bleiben davon ausgenommen. Status ist nie **nur** Farbe — der
Text daneben bleibt.

### Navigation

Abbiegen lässt sich der Fahrer von Google oder Apple Maps; `buildNavigationUrl()` erkennt iOS am
User-Agent. Übergeben werden **Koordinaten**, nicht die Adresse — die ist bereits geokodiert, ein
zweiter Adress-Treffer in der Navi-App könnte woanders landen. „Ganze Tour navigieren" hängt
Zwischenziele an; Google nimmt neun, mehr werden abgeschnitten statt still kaputtzugehen. Apple Maps
kennt keine Zwischenziele in URLs und fällt auf das nächste Ziel zurück.

**Die Ausnahme:** hat die Suche nur die Straße gefunden (`geocodePrecision: 'street'`) oder gar
nichts (`lat: null`), gibt es keine Hausnummern-Koordinate, die ein zweiter Treffer verfälschen
könnte — die Straßenmitte wäre in jedem Fall das falschere Ziel. `StopCard` übergibt dann den
eingegebenen Adresstext (`buildAddressNavigationUrl()`, bei Koordinaten über `streetOnly` auf dem
`NavigationTarget`) und sagt in der Karte, was gefunden wurde. Ein Stopp ohne Koordinaten hatte
früher gar keinen Navigationsknopf. „Ganze Tour navigieren" gibt Straßen-Treffer ebenfalls als
Adresse mit (Google versteht Adressen und Koordinaten gemischt) und lässt Stopps ohne Koordinaten
aus, wie bisher.

### Was echt ist und was nicht

**Echt:** Adressen und Koordinaten (Nominatim), Fahrstrecke, Fahrzeit und Streckenverlauf (OSRM),
Reihenfolge, Geolocation des Fahrers, Statuswechsel, Persistenz über Neustarts.

**Auch echt:** die Vorbestellungen der Sammelstelle Mörsbach — vom Team in der Management-App
erfasst, mit Preisen aus `hq`, dauerhaft im Liefer-Store, und der Fahrer hakt sie einzeln ab.

**Noch nicht da:** keine Authentifizierung (wer die URL hat, sieht und ändert die Tour), keine
Anbindung an Bestellungen aus dem Shop (gewöhnliche Stopps werden von Hand erfasst; nur die
Vorbestellungen der Sammelstelle kommen aus der Management-App), keine Tourplanung in der
Management-App, kein Push an die Kundschaft. Wer eine übergebene Vorbestellung doch noch stornieren
will, muss sie erst auf „offen" zurücksetzen — protokolliert wird nicht, wer das war. `DeliveryTracker` in der Tracking-Lib ist ein
WebSocket-Client ohne Server — die App benutzt ihn nicht, Positionen gehen per HTTP an
`POST /tours/:id/position` (gedrosselt auf alle 30 s).

## E2E

`apps/bakery-delivery-e2e/src/delivery.spec.ts` fährt den Weg des Fahrers ab: Tour öffnen, Stopp
anlegen, Route berechnen, abhaken. Die Konfiguration startet **beide** Server selbst (API auf 5000,
App auf 4300) und setzt Locale `de-DE` sowie eine Position in Homburg. Der zweite Test legt sich seine
eigene Tour per API an und löscht sie im `finally` wieder, damit er den Store nicht vollmüllt.

Andere Ports: `API_PORT` und `DELIVERY_PORT` (dazu `HQ_PRODUCTS_DIR`, wenn `hq/` nicht neben dem
Repo liegt). Die Konfiguration reicht die API-Adresse als `NEXT_PUBLIC_API_URL` an die App durch und
die Tests leiten ihre eigene aus `API_PORT` ab — sonst redet die App mit Port 5000, während der Test
seine Tour woanders anlegt. Laufende Server auf diesen Ports werden wiederverwendet. Die beiden
Playwright-Projekte (Desktop, Pixel 5) laufen **parallel** gegen denselben Store — genau so kam die
verlorene Änderung ans Licht (siehe Fallen).

## Nächste sinnvolle Schritte

- **Die Adresse des Kindergartens Mörsbach nachtragen** (`/admin/delivery/preorders/lieferstelle`).
  Bis dahin hat der Stopp keinen Kartenpunkt, und die Navigation läuft über den Ortsnamen.
- Stopps aus den Shop-Bestellungen erzeugen, statt sie abzutippen.
- Eine Planungsansicht in der Management-App (die Erfassung gewöhnlicher Stopps steckt weiterhin in
  der Fahrer-App; nur die Vorbestellungen der Sammelstelle werden dort erfasst).
- Authentifizierung, bevor die App aus dem LAN heraus erreichbar gemacht wird.
- Die Liefer-Endpunkte auch in der echten TypeScript-API (`libs/api/delivery`) verdrahten, sobald
  `serve:api` wieder startet.
