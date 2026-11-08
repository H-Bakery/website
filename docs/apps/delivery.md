# Fahrer-App `bakery-delivery`

Die App `apps/bakery-delivery`, die beiden Libs, die nur sie benutzt
(`libs/bakery-delivery-{routing,tracking}`), und die Liefer-Endpunkte der API. Monorepo-weite Regeln
stehen in `website/CLAUDE.md` und im Workspace-`CLAUDE.md`. Kurzfassung für Agenten:
`apps/bakery-delivery/CLAUDE.md`. Vertrag, Rollen und bewusste Abweichungen der Endpunkte:
[`docs/api/deliveries.md`](../api/deliveries.md).

## Was das ist

Die Samstagsauslieferung der Bäckerei mit **ein bis zwei Fahrern**. Eine _Tour_ gehört einem Tag und
einem Fahrer und besteht aus _Stopps_ in gefahrener Reihenfolge. Der Fahrer hakt unterwegs ab
(`done` / `failed`), die Backstube sieht am selben Datensatz, wie weit die Tour ist.

Das ist bewusst **nicht** dasselbe wie der Backschrank beim CAP-Markt: dort wird ein _Besuch_ mit
Restbestand erfasst und der Verkauf berechnet (siehe
[`docs/domains/verkaufspartner.md`](../domains/verkaufspartner.md)). Hier
wird nur zugestellt. Der CAP-Markt taucht in beiden auf — als Verkaufspartner _und_ als Stopp der
Samstagstour.

### Stand

- **Läuft gegen die echte TypeScript-API** (B8): Touren, Stopps, Fahrer und Depot unter
  `/api/deliveries` (`routes/delivery-tours.routes.ts`), mit Anmeldung und Rollen (siehe
  [Anmeldung und Rollen](#anmeldung-und-rollen-b8)). Den Mock-Server (`simple-server.js`) gibt es
  seit B12 nicht mehr.
- **Die Vorbestellungen der Sammelstelle** kommen aus `/api/preorders` (B7), erfasst in der
  Management-App - der Tour-Payload liest sie dort, nicht aus einer Kopie.
- **Nicht im Pilot** (`docs/roadmap.md`, D11): die Box ist nur im LAN der Bäckerei erreichbar. Wie
  der Fahrer sie unterwegs erreicht (Tailscale oder ein schmaler öffentlicher Endpunkt), entscheidet
  der Inhaber: [`docs/fernzugriff-fahrer.md`](../fernzugriff-fahrer.md) (Q8). Bis dahin wird die
  Mörsbach-Liste gedruckt.
- Kein E2E-Job in CI; die Suite läuft lokal.

## Entwicklung

Alles von `website/` aus:

```bash
npm run serve:delivery                 # Fahrer-App auf Port 4300
npm run serve:api                      # echte API (B8, Anmeldung nötig), Port 5000
npm run test:e2e:delivery              # Playwright (Desktop + Pixel 5), startet beide Server selbst

npx nx build bakery-delivery
npx nx lint bakery-delivery
npx nx test delivery-routing           # inkl. Abgleich mit dem Server-Core
npx nx test delivery-tracking
npx jest -c apps/bakery-api/jest.config.js apps/bakery-api/tests/unit/delivery   # Server-Rechenlogik (Touren, Geo, Vorbestellungen)
npx tsc --noEmit -p apps/bakery-delivery/tsconfig.json   # läuft auch in `npm run type-check`
```

Ports: Landing 3000, Shop 4200, Management 4201, Lieferung 4300. Der Port steht in
`apps/bakery-delivery/project.json`; ohne ihn fiel `@nx/next:server` auf 4200 zurück — den Port des
Shops.

**Die API muss laufen.** Ohne sie zeigt die App „Keine Verbindung zur Bäckerei-API". Konten legt
`npm run api:create-user` an, in der Entwicklung auch `BOOTSTRAP_ADMIN_USER`/`BOOTSTRAP_ADMIN_PASSWORD`.
Fahrer seedet die echte API nicht - `POST /api/deliveries/drivers` (Inhaber) legt sie an.
`NEXT_PUBLIC_API_URL` überschreibt die Adresse (Default `http://localhost:5000`); der Wert wird beim
Build eingebacken, ein Wechsel braucht also einen Neustart des Dev-Servers. Die echte API erlaubt
`http://localhost:4300` ohne weiteres (`DEFAULT_CORS_ORIGINS` in `apps/bakery-api/src/config/env.ts`);
läuft die App auf einem anderen Port, braucht die API `CORS_ORIGIN=http://localhost:<Port>` - sonst
scheitert schon die Anmeldung am Preflight. Das ganze System auf einmal: der `setup-dev`-Skill
([`docs/development.md`](../development.md)).

## Anmeldung und Rollen (B8)

Ohne Anmeldung zeigt die App **nur das Anmeldeformular** (`components/AuthGate.tsx`, im `layout.tsx`
um alle Seiten gelegt): wer die URL hat, sieht keine Adressen der Kundschaft mehr. Angemeldet wird
mit Benutzername und Passwort gegen den B3-Vertrag (`POST /api/auth/login`, persönliche Sitzung,
siehe [`docs/api/auth.md`](../api/auth.md)). Den Zustand hält `src/lib/session.ts` - kein React
Context, ein Modul mit `useSyncExternalStore` (`useDeliverySession()`), weil die App außerhalb des
MUI/Context-Stacks steht.

- **Speicher:** `bakery-delivery-session` (Access- + Refresh-Token, Benutzer),
  `bakery-delivery-last-user` (wer zuletzt angemeldet war). Meldet sich ein **anderer** Benutzer an,
  löscht `clearDeviceData()` vorher Warteschlange, Offline-Kopien und den gewählten Fahrer - sonst
  sähe die nächste Person die Tour des vorigen Fahrers oder schickte dessen Abhaken unter eigenem
  Namen ab. Derselbe Benutzer behält seine Warteschlange. **Steht das Anmeldeformular** (Sitzung
  abgelaufen oder serverseitig beendet), löscht `clearOfflineCopies()` sofort Tour- und
  Fahrer-Kopie (Namen, Adressen, Telefonnummern der Kundschaft) - nur die Warteschlange bleibt bis
  zur nächsten Anmeldung.
- **Jede Anfrage trägt `Authorization: Bearer`** (`request()` in `delivery-api.ts`). Eine 401
  erneuert die Sitzung **einmal** (`refreshSession()`: ein Refresh je Tab, der rotierte
  Refresh-Token steht sofort im Speicher) und wiederholt die Anfrage. 409 `refresh_superseded` heißt,
  ein anderer Tab war schneller: dessen Token wird aus dem Speicher übernommen. Lehnt der Server den
  Refresh ab (4xx), ist die Sitzung vorbei - `SessionExpiredError`, das Formular erscheint. Scheitert
  der Refresh im Funkloch, bleibt die Sitzung.
- **`SessionExpiredError` ist absichtlich keine `ApiError`.** `flushQueue` wirft 4xx aus der
  Warteschlange; ein Abhaken darf aber nicht verloren gehen, nur weil die Sitzung ablief. Es bleibt
  liegen und geht nach der nächsten Anmeldung raus (derselbe Benutzer).
- **Abmelden** (`components/AccountBar.tsx`, unter dem Kopf): beendet die Sitzung auf dem Server
  (Bearer + Refresh-Token; ohne Netz nur lokal) und löscht die Gerätedaten. Liegen noch ungesendete
  Änderungen in der Schlange, fragt die Leiste in der Seite nach („Trotzdem abmelden" / „Angemeldet
  bleiben"), nicht per `window.confirm`.
- **Rollen** (`permissionsFor()` in `session.ts`, Bedienführung - durchgesetzt wird in der API):
  `inhaber` alles; `fahrer` sieht nur **seinen** Fahrer (Auswahl gesperrt, zugeordnet über
  `driver.userId`; ohne Zuordnung ein Hinweis „bitte im Büro melden"), hakt ab, meldet die Position
  und darf „Route berechnen", aber nicht planen (kein „Tour anlegen", „Tour planen", Stopp
  entfernen) und eine **Übergabe nicht zurücknehmen** (`undoHandover`: an einer übergebenen
  Vorbestellung steht statt „Zurücksetzen" „Zurücknehmen kann der Verkauf." - die API sagt sonst 403
  `handover_undo_forbidden`; „Nicht abgeholt" darf er zurücksetzen). `verkauf` liest nur (keine
  Abhak-Knöpfe, kein Standort); `backstube` wird beim Anmelden abgewiesen und gleich wieder
  abgemeldet.
- **Planen (nur Inhaber):** „Tour planen" öffnet „Tour bearbeiten" mit Fahrer-Zuordnung
  (`PATCH /tours/:id { driverId }` - eine unter „Alle" angelegte Tour hat sonst keinen Fahrer),
  „Nach oben"/„Nach unten" je Stopp (`stopOrder`) und „Tour löschen" mit Rückfrage in der Seite.
- **Abgelehnte Änderungen bleiben sichtbar.** Lehnt die API ein Abhaken oder eine Übergabe mit 4xx
  ab, lädt die Seite die Tour neu und zeigt **danach** die `message` - `loadTours()` leert die
  Fehlermeldung, vorher gesetzt verschwand sie sofort.
- **Die Form des früheren Mocks wird weiter gelesen** (`normalizeUser()`), falls eine alte Sitzung im
  Speicher liegt: `email`/`firstName` statt `displayName`, `admin` → `inhaber`, `staff` → `verkauf`.

Tests: `src/lib/session.spec.ts`, `src/lib/delivery-api.spec.ts` („Anmeldung in request()"),
`src/components/AuthGate.spec.tsx` (Formular, Gerätedaten bei Benutzerwechsel, Abmelden mit
Rückfrage), `src/app/page.spec.tsx` („nach Rolle"). Specs legen die Sitzung mit `saveSession()` an
(`signIn()` in `page.spec.tsx`).

## Wo was gerechnet wird

**Alle Formeln des Servers stehen genau einmal**, in `apps/bakery-api/src/services/delivery-tours.core.js`
— dependency-freies CommonJS, gleiche Konvention wie `partner-stats.core.js`. Die API
(`delivery-tours.service.ts`) und die Tests benutzen es; esbuild bündelt es mit ins API-Bundle.

Das Frontend hat in `@bakery/delivery/routing` eine **zweite, TypeScript-Fassung derselben Geometrie**
(Haversine, Umwegfaktor `ROAD_DETOUR_FACTOR` 1.35, Standzeit `STOP_SERVICE_TIME` 180 s). Die Grenze
CommonJS ↔ ESM lässt sich nicht ohne Build-Umbau überbrücken. Wer eine der Konstanten ändert, muss
beide Dateien anfassen — sonst widersprechen sich Server- und Bildschirmzahlen, genau wie früher, als
die Gesamtstrecke euklidisch und die Einzelstrecken per Haversine gerechnet wurden.
`libs/bakery-delivery-routing/src/lib/core-consistency.spec.ts` lädt den Server-Core zur Laufzeit und
vergleicht Konstanten, Etappen, Reihenfolge, Ankunftszeiten, Zeitfenster und `hasCoordinates()` — der
Test fällt um, wenn nur eine Seite geändert wurde.

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
beides steckt in `delivery-geo.core.js`. Treffer landen dauerhaft in `delivery_geocache`, eine
Adresse wird also genau einmal gesucht. `addressCandidates()` probiert absteigend genauer:
volle Adresse → Hausnummernbereich „36-38" auf „36" verkürzt → ohne Hausnummer. Ohne diesen zweiten
Versuch findet Nominatim die hiesigen Adressen teilweise nicht.

**Nominatim antwortet auf „Talstraße 5" ohne Fehler mit der Straßenmitte**, wenn es die Hausnummer
nicht kennt. Deshalb fragt `geocodeAddress()` mit `addressdetails=1` und gibt `precision` zurück:
`'house'`, wenn der Treffer eine Hausnummer trägt, sonst `'street'` — der Kandidat ohne Hausnummer
zählt immer als `'street'`, auch wenn Nominatim dafür irgendein Haus liefert. Ein Straßen-Treffer
wird erst genommen, wenn kein genauerer Kandidat mehr trifft: „Kaiserstraße 60-62" kennt Nominatim
nur als Straße, „Kaiserstraße 60" als Haus. Der Wert wandert über den `geocache` als
`geocodePrecision` auf den Stopp; die Oberfläche sagt bei `'street'` dazu, dass nur die Straße
gefunden wurde. Cache-Einträge ohne `precision` geben dem Stopp `null` (unbekannt) — nicht `'house'`.
Wer sie nachprüfen will, löscht den Eintrag in `delivery_geocache`; von Hand gesetzte Koordinaten
(`geocodeSource: 'manual'`) haben ebenfalls `null`.

**Das Lesen einer Tour hängt nicht an Nominatim.** `GET /tours` und `GET /tours/:id` suchen
fehlende Koordinaten zwar nach, warten darauf aber höchstens `HYDRATE_BUDGET_MS` (2,5 s); dauert es
länger, geht die Antwort ohne die Koordinaten raus, die Suche läuft im Hintergrund weiter und der
nächste Aufruf sieht das Ergebnis. Fehlversuche merkt sich `lookupAddress()` fünf Minuten lang
(`GEOCODE_RETRY_MS`), sonst liefe bei Netzausfall für jeden nicht gefundenen Stopp bei jedem Lesen
ein Timeout. Ausdrückliche Aktionen — Stopp anlegen, Adresse ändern, Route berechnen, Depot ändern,
`/geocode` — suchen mit `force` trotzdem. Gleichzeitige Anfragen nach derselben Adresse teilen sich
eine Suche.

## Datenhaltung

**Die Endpunkte liegen in der echten TypeScript-API** (B8): `routes/delivery-tours.routes.ts`,
Service `delivery-tours.service.ts`, SQLite-Tabellen `delivery_depot` (eine Zeile, die Backstube in
der Eckstraße 3, von der Migration angelegt), `delivery_drivers`, `delivery_tours`, `delivery_stops`,
`delivery_geocache`. Fahrer legt die Migration **nicht** an. Jede Änderung läuft serialisiert in einer
Transaktion und steht im `audit_log` (ohne Namen, Adressen, Telefonnummern). Vertrag, Rollen und
bewusste Abweichungen vom früheren Mock: [`docs/api/deliveries.md`](../api/deliveries.md). Die
Antworten des gelöschten Mock-Servers sind in
`apps/bakery-api/tests/contract/recorded/deliveries.json` festgehalten (Vertragstest). Alte
Mock-Daten (`delivery-store.json`) übernimmt `cli.js import-deliveries` (Touren, Fahrer, Geocache),
die Sammelstellen und Vorbestellungen derselben Datei `import-preorders`.

Das Depot braucht immer Koordinaten. `PUT /depot` sucht eine geänderte Adresse sofort und antwortet
mit **422**, wenn sie nicht gefunden wird — die alte Adresse bleibt dann stehen. Wer die Suche
umgehen will, gibt `lat`/`lon` direkt mit. Der `PUT` übernimmt nur die genannten Felder; hat sich die
Adresse während der Suche geändert, ist das 409 `Depot changed`.

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

Die `pickup-points`- und `preorders*`-Pfade gehören dem Vorbestellungs-Alias (B7,
`preorders.routes.ts`), der vor dem Tour-Router eingehängt ist. Fehlerantworten setzen **`message`
_und_ `error`** (dazu `success: false`) — `ApiClient` wirft `new Error(data.message)`, ein
`error`-only-Body verlöre den deutschen Text. Die Liefer-Endpunkte liefern rohe Objekte wie der
frühere Mock, nicht `{success, data}`.

## Sammelstelle Mörsbach: Vorbestellungen

Seit dem 05.09.2026 fährt die Samstagstour **nach Mörsbach an den Kindergarten**. Das ist keine
gewöhnliche Zustellung, sondern eine **Sammelstelle**: die Kundschaft bestellt vorher, die Ware wird
gesammelt hingebracht und dort in einem Zeitfenster übergeben. Für den Fahrer ist das **ein Stopp mit
einer Übergabeliste**, nicht zwölf Stopps.

Drei Begriffe, die auseinandergehalten werden müssen:

|                                    | wo erfasst             | was festgehalten wird                            |
| ---------------------------------- | ---------------------- | ------------------------------------------------ |
| **Besuch** (Backschrank CAP-Markt) | Management-App         | Restbestand zählen, Verkauf **berechnen**        |
| **Stopp** (Zustellung)             | Fahrer-App             | zugestellt / nicht angetroffen                   |
| **Vorbestellung** (Sammelstelle)   | **nur** Management-App | wer was bestellt hat, übergeben / nicht abgeholt |

**Vorbestellt wird ausschließlich in der Management-App** (`/admin/delivery/preorders`, seit P2 auf
`/api/preorders` der echten API). Der Shop weiß von Mörsbach nichts.

**Alle Formeln stehen genau einmal**, in `apps/bakery-api/src/services/delivery-preorders.core.js`:
Rundung, Referenznummern, Bestellschluss, Statusübergänge, Backlisten-Summierung. Gespeichert sind
Sammelstellen und Vorbestellungen in den Tabellen `pickup_points`, `preorders`, `preorder_items` der
echten API ([`docs/api/preorders.md`](../api/preorders.md)); der Tour-Payload liest sie dort.

Regeln, die man kennen muss, bevor man hier etwas ändert:

- **Die Vorbestellungen hängen im Tour-Payload.** `decorateTour()` hängt an jeden Stopp mit
  `pickupPointId` die Vorbestellungen des Tourtags plus `preorderSummary`. Das ist Absicht: die
  Fahrer-App hält die Tourliste als Offline-Kopie im `localStorage` — läge die Übergabeliste hinter
  einem zweiten Aufruf, wäre sie im Funkloch weg. Stornierte sind nur dabei, wenn Geld
  zurückzugeben ist (`paymentBalance < 0`).
- **Bezahlstand:** jede Bestellung trägt `paid`, `paidAmount` und `paymentBalance`; `HandoverList`
  zeigt je Zeile „Geld" (nichts / X kassieren / Rest X / X zurückgeben), die Kopfzeile kassiert
  Vorkasse nicht ein zweites Mal und nennt „Zurückzugeben". Bei Rest oder Erstattung fragen zwei
  Knöpfe, ob das Geld geflossen ist (`paid: true` mit der Übergabe) - der Alias setzt `paid` nur bei
  einer **unbezahlten** Bestellung selbst.
- **Preise und Namen sind ein Snapshot** aus `hq`, wie bei `PartnerVisitItem`. Der Client schickt nur
  `productId` und `qty`; ein mitgeschickter Preis wird ignoriert. Beim **Bearbeiten** wird der
  Snapshot bereits erfasster Positionen aus der gespeicherten Bestellung übernommen, nicht neu aus
  `hq` geholt — sonst änderte eine Preispflege rückwirkend eine Woche alte Abrechnung.
- **Keine Vorbestellung verschwindet lautlos.** `DELETE` storniert (`cancelled`), es löscht nicht.
  `handed_over → cancelled` und `cancelled → handed_over/not_collected` sind mit **409** gesperrt:
  eine stornierte Bestellung darf nicht durch ein nachgesendetes Abhaken aus dem Funkloch
  wiederbelebt werden, und eine bereits übergebene (das Geld ist geflossen) nicht durch ein Storno
  aus der Abrechnung fallen.
- **Der Sammelstellen-Stopp entsteht beim Anlegen der Tour — aber nur einmal am Tag.** Fällt der
  Tourtag auf den `weekday` einer aktiven Lieferstelle, hängt `POST /tours` deren Stopp gleich mit
  an; trägt an dem Tag schon eine Tour diesen Stopp, bleibt es dabei (`hasPickupStop`). Sonst hätten
  zwei Samstagsfahrer dieselbe Übergabeliste, und dieselbe Tüte ginge zweimal über den Tresen.
- **An der Sammelstelle heißt „erledigt" nicht „geliefert".** Der Stopp trägt dort
  `PICKUP_STOP_STATUS_LABEL` („Abgeschlossen", `src/lib/format.ts`); ausgegeben wurde, nicht
  zugestellt.

Der Bestellschluss (Freitag 12:00) **blockiert nichts** — die Backstube muss nachtragen können.
Später erfasste Bestellungen tragen `afterDeadline: true` und werden in der Oberfläche markiert.

Tests: `apps/bakery-api/tests/unit/deliveryPreorders.test.js`.

## Fallen, die schon einmal zugeschnappt sind

- **`Number(null)` ist `0`.** Ein Stopp ohne gefundene Adresse (`lat: null`) galt damit als Punkt
  (0, 0) — im Atlantik vor Afrika — und zog Reihenfolge und Kilometer der ganzen Tour dorthin.
  Deshalb `isNumber()` / `hasCoordinates()` in `delivery-tours.core.js`, nie `Number.isFinite(Number(x))`.
  Dasselbe gilt für `POST /tours/:id/position` (`lat: null` war eine Position auf dem Nullmeridian)
  und das Depot (ohne Koordinaten wäre es Startpunkt (0, 0) jeder Route); `estimateTour`,
  `estimateArrivals`, `orderStopsNearestNeighbour` und `routeTour` geben ohne Depot-Koordinaten
  `null` bzw. die unveränderte Reihenfolge zurück. Im Frontend heißt die Prüfung ebenfalls
  `hasCoordinates()` (`@bakery/delivery/routing`) — `stop.lat !== null` hätte `undefined`
  durchgelassen, und Leaflet wirft bei `[undefined, undefined]` die ganze Karte weg.
- **`hasCoordinates()` verlangt einen plausiblen Punkt.** `lat: 999` und das Paar `(0, 0)` („Null
  Island", Ergebnis von `Number(null)` oder einem leeren Formular) gingen früher als manuelle Stopp-,
  Depot- und Fahrerkoordinaten durch. In **beiden** Fassungen gilt −90..90 / −180..180, und genau das
  Paar `(0, 0)` wird abgelehnt (ein einzelner Nullwert bleibt erlaubt — Äquator und Nullmeridian
  existieren). `validateCoordinates()` im Core liefert die 400-Antwort mit deutschem Text
  (`POST/PATCH …/stops`, `POST …/position`, `PUT /depot`); ein halbes Paar ist ein Fehler, nur
  `lat: null, lon: null` (oder beide leer) löscht die Koordinaten und stößt die Suche neu an.
  Altwerte aus dem früheren Mock-Store übernimmt `import-deliveries` nur mit `hasCoordinates()`
  (`delivery-import.core.js`), sonst ohne Koordinaten; `hydrate()` im Service sucht sie beim Lesen
  neu. `plannedStart` wird mit `isClockTime()` (`HH:MM`) geprüft.
- **„Route berechnen" auf einer laufenden Tour** schob zugestellte Stopps ans Ende und nummerierte
  alles neu. `applyOpenStopOrder()` im Core sortiert nur die offenen Stopps, und zwar auf den
  Plätzen, die offene Stopps schon belegen; `done`/`failed` bleiben, wo sie sind. Auf einer fertigen
  Tour wird nur nachgerechnet. `PATCH /tours/:id` mit `stopOrder` ist die ausdrückliche
  Handsortierung und ordnet weiterhin alles.
- **Ein langsamer Handler überschrieb fremde Änderungen.** Im Mock las früher jeder Request den
  Store neu und schrieb seine Kopie zurück; wer auf Nominatim oder OSRM wartete, überschrieb danach
  alles, was inzwischen abgehakt oder angelegt worden war. Die API serialisiert jede Änderung in
  einer Transaktion; „Route berechnen" rechnet außerhalb und übernimmt das Ergebnis nur, wenn die
  Stopps (id, Status, Koordinaten) unverändert sind - sonst einmal neu, dann die Offline-Schätzung.
- **`syncTourStatus()` zieht den Status in beide Richtungen nach** — eine abgeschlossene Tour blieb
  früher abgeschlossen, auch wenn ein Stopp zurückgesetzt oder nachgeschoben wurde.
- **`{zahl && <JSX/>}` rendert bei `0` eine nackte `0`.** Optionale _Zahlen_ immer mit `!= null`
  prüfen, nicht auf Truthiness. Ein E2E-Test setzt die Genauigkeit auf 0 und prüft, dass keine
  alleinstehende `0` im Text steht.
- **`position.coords.speed || undefined`** machte aus „steht" (`0`) „unbekannt". `?? undefined`
  benutzen.
- **Der Abholpunkt ist das Depot, nicht der erste Stopp.** `MockMapProvider.calculateRoute` kopierte
  früher Adresse, `orderId` und Hinweise der ersten Lieferung auf die Startposition (drei Aufträge
  wurden zu vier Stopps). `buildEstimatedRoute()` setzt `originAddress`; ein Test prüft, dass keine
  `orderId` auf dem Abholpunkt landet.
- **Karte:** keine feste DOM-ID (`useId()` in `Map.tsx`, sonst nur eine Karte je Seite); keine
  Array-Literale als Default-Parameter in `useEffect`-Dependencies (neue Identität je Render → Karte
  wird jedes Mal neu gebaut); `fitBounds` nur, wenn sich die _Menge_ der Stopps ändert (Fingerprint
  aus den IDs), nicht beim Abhaken — sonst reißt es dem Fahrer die Karte aus der Hand.
- **Ankunftszeiten** (`arrivalBaseline()` im Core): eine geplante Tour rechnet ab
  `date + plannedStart` (Default 06:30), **aber nie früher als jetzt**; eine laufende Tour ab dem zuletzt
  erledigten Stopp oder der jüngeren gemeldeten Fahrerposition, nie ab Depot und `startedAt` (sonst
  stünde am sechsten Stopp um neun Uhr „Ankunft ca. 06:41"). Die TS-Fassung heißt genauso und wird in
  `core-consistency.spec.ts` gegen den Server gerechnet; die App nimmt `estimatedArrival` aus dem
  Tour-Payload.
- **Zeitfenster zählen in der ETA-Kette.** `parseTimeWindow()` liest „09:00-09:30", „9:00 – 9:30",
  „08.00-09.00", „ab 09:00", „bis 09:30"; Freitext wie „vormittags" bleibt erlaubt und wirkungslos.
  Eine **einzelne Uhrzeit zählt nur mit Präfix**: `ab`/`nicht vor`/`frühestens` → Beginn,
  `bis`/`spätestens`/`vor` → Ende; „09:00 Uhr" oder „ca. 12:30" bleiben Freitext — sonst würde
  „spätestens 09:30" als Beginn gelesen und der Fahrer wartete bis 09:30.
  `estimateArrivalDetails()` rechnet je Stopp `ankunft = max(eta, Fensterbeginn)`; die Wartezeit
  steht als `waitSeconds` am Stopp und wandert in die Folge-ETAs, ein verpasstes Fenster als
  `missesTimeWindow` („Zeitfenster … voraussichtlich nicht mehr einhaltbar"). „Route berechnen"
  sortiert bei lesbaren Fenstern mit `orderStopsNearestNeighbour()` (Nearest Neighbour mit
  Zeitfenstern) und lässt OSRM nur Strecke und Verlauf messen — der Trip-Endpunkt kennt keine
  Zeitfenster. TS-Fassung: `parseTimeWindow`, `timeWindowBounds`, `optimizeRouteOrder(…, options)`,
  `withEstimatedArrivals(…, date)`. `tour.duration` enthält die Wartezeit **nicht** (reine Fahr- plus
  Standzeit).
- **Kartenattribution im Dunkelmodus.** `leaflet.css` wird nach `global.css` geladen und gewann bei
  gleicher Spezifität. Die Regel in `global.css` trägt deshalb `.leaflet-control-container` mit
  (drei Klassen, kein `!important`). Die Attribution muss sichtbar bleiben (OSM-Tile-Policy) — nicht
  ausblenden.
- **Ohne Straße keine Adresssuche.** Ein Sammelstellen-Stopp darf ohne Straße angelegt werden;
  Nominatim antwortet auf „Zweibrücken-Mörsbach" aber mit der Ortsmitte und `precision: 'street'`.
  `ensureStopCoordinates()` sucht ohne Straße gar nicht erst.
- **Kein `window.confirm`** — blockiert und sieht auf dem Handy aus wie ein Absturz. Die Rückfrage
  vor dem Abschließen eines Stopps mit offenen Vorbestellungen steht in der Oberfläche.
- **Kein `"type"` in `libs/bakery-delivery-{routing,tracking}/package.json`.** Die Quellen sind ESM;
  ein `"type": "commonjs"` dort ließ Turbopack mit „Specified module format (CommonJs) is not
  matching …" aussteigen (`nx build` scheiterte, `nx serve` lieferte HTTP 500). Nicht „lösen",
  indem man die Libs auf CommonJS umschreibt.

## Namensfallen

- Nx-Projektnamen der Libs sind **`delivery-routing`** und **`delivery-tracking`**, die Verzeichnisse
  heißen `libs/bakery-delivery-*`, die Import-Aliase `@bakery/delivery/*`.
  `nx build bakery-delivery-routing` scheitert.
- `libs/bakery-delivery-tracking/package.json` heißt `@bakery/delivery-libs/tracking` und passt zu
  keinem Alias. Auflösung läuft über `tsconfig.base.json`; nicht über diesen Namen importieren.
- Die früheren Projekte `delivery` (`libs/api/delivery`) und `bakery-management-feature-delivery`
  sind seit B12 gelöscht. Diese App spricht mit `/api/deliveries` der echten API
  (`routes/delivery-tours.routes.ts`).

## Architektur

```
src/app/page.tsx                 Dashboard: Fahrer-/Tagwahl, nächster Stopp, Karte, Stoppliste, Planung
src/components/StopCard.tsx      ein Stopp mit Navigation / Anrufen / Geliefert / Nicht angetroffen
src/components/AddStopForm.tsx   Erfassung inkl. „2x Bauernbrot, 10x Brötchen"-Parser
src/components/HandoverList.tsx  Übergabeliste einer Sammelstelle (Vorbestellungen abhaken)
src/components/FailureForm.tsx   Rückfrage zu „Nicht angetroffen": Grund und Verbleib der Ware
src/components/ThemeToggle.tsx   Farbschema System / Hell / Dunkel
src/components/Map.tsx           Leaflet, dynamisch mit ssr:false
src/lib/delivery-api.ts          Typen, fetch-Client (Bearer + Refresh), Offline-Warteschlange
src/lib/session.ts               Anmeldung, Sitzung, Refresh mit Rotation, Rollenrechte (B8)
src/lib/api-base.ts              NEXT_PUBLIC_API_URL, geteilt von beiden
src/components/AuthGate.tsx      ohne Sitzung nur das Anmeldeformular (im Layout)
src/components/AccountBar.tsx    Name, Rolle, „Abmelden" (mit Rückfrage bei voller Warteschlange)
src/lib/format.ts                de-DE-Formatierung, Datumshilfen, Status-Labels
src/lib/theme.ts                 Farbschema lesen/schreiben + Inline-Skript gegen den Flash

libs/bakery-delivery-tracking    @bakery/delivery/tracking — Location/DeliveryStatus, Geolocation-Wrapper
libs/bakery-delivery-routing     @bakery/delivery/routing — Geometrie, Reihenfolge, Navi-Links, Formatierung
```

Kein Material UI, kein React Context, keine Shared-Lib der anderen Apps — diese App steht bewusst
außerhalb des MUI-Stacks. Die Oberfläche ist mobile-first mit 44-px-Trefferflächen; der Breakpoint bei
768 px ist der Ausnahmefall (Backstube am Rechner). Das gilt auch für die Zoom-Knöpfe der Karte:
Leaflet zeichnet sie 26 bzw. 30 px groß, `global.css` zieht sie auf 44 px und färbt sie über die
Variablen (sonst bleiben sie im Dunkelmodus weiß).

### Offline

Das Handy verliert im Auto das Netz. Ein Abhaken wird deshalb **erst lokal angezeigt** und bei einem
Netzfehler in eine `localStorage`-Warteschlange gelegt (`bakery-delivery-queue`), die beim
`online`-Event und sonst alle 30 s automatisch nachläuft — der Browser meldet „online", sobald
Funk da ist, ob der Server antwortet, weiß er nicht. Pro Stopp bleibt nur der letzte Stand stehen.
Eine Änderung, die der Server **fachlich** ablehnt (4xx), fliegt aus der Schlange — sonst blockierte
sie alle folgenden für immer; Netzfehler (5xx, kein Netz, Timeout) lassen den Eintrag stehen.
`flushQueue` liest die Schlange nach jedem Versand **neu** und streicht nur den gesendeten Eintrag
(per eindeutiger `id`) - früher schrieb es seine Kopie vom Start zurück und verlor ein Abhaken, das
während des Nachsendens dazukam. Ein Stopp-Abhaken trägt `completedAt` = Zeitpunkt des Tippens,
damit ein Nachsenden Stunden später nicht die Sendezeit einträgt (die API nimmt nur Werte vom
Tourtag −1 bis +3 Tage). Eine abgelaufene Sitzung wirft den Eintrag nicht hinaus (siehe
`SessionExpiredError` unter [Anmeldung und Rollen](#anmeldung-und-rollen-b8)).

Jede Anfrage bricht nach 15 s ab (`REQUEST_TIMEOUT_MS`, `AbortSignal.timeout`, wo der Browser es
kann). Ohne das hing `fetch` im Funkloch minutenlang, alle Knöpfe waren gesperrt und die
Warteschlange kam nicht zum Zug. Der Hinweis „… warten noch auf den Server" bleibt sichtbar, solange
etwas in der Schlange liegt, auch wenn das Handy „online" meldet.

**Die Sperre gilt je Stopp, nicht je Seite.** Ein hängender Status-PATCH sperrt nur die Knöpfe des
Stopps (bzw. der Vorbestellung), dessen Änderung unterwegs ist — `busyStops` / `busyPreorders` in
`page.tsx`. Nur „Route berechnen" wartet, bis nichts mehr unterwegs ist: es nummeriert die ganze Tour
um.

Die Kehrseite: zwei PATCHes zugleich, und **jede Server-Antwort ersetzt die ganze Tour**. Antwortet
der PATCH an Stopp B vor dem an Stopp A, stünde A in Bs Tour noch „Offen". Deshalb hält
`inFlightRef` jede laufende Änderung als `LocalUpdate` (Stopp-Body bzw. Vorbestellungsstatus), und
jede Tour vom Server — Antwort eines PATCH, Flush der Warteschlange, `loadTours`, Route/Stopp
anlegen/entfernen — geht durch `withInFlight()` (`mergeTour()`), das dieselbe
`withPendingUpdates()` wie die Offline-Kopie benutzt. Ausgetragen wird ein Eintrag erst mit der
eigenen Antwort, der 4xx-Ablehnung (dann gilt der Server-Stand) oder dem Netzfehler, der ihn in die
Warteschlange legt. Vorbestellungen brauchen das genauso, weil sie im Tour-Payload hängen;
`busyPreorders` sperrt den Stopp nicht. `page.spec.tsx` sichert das ab.

**Die Tour selbst hat eine Offline-Kopie.** Jeder Tipp auf „Navigation" reicht das Handy an die
Navi-App weiter; kommt der Fahrer zurück, lädt der Browser die Seite gern neu — mitten im Funkloch.
Deshalb merkt sich `delivery-api.ts` die zuletzt geladene Fahrerliste (`bakery-delivery-drivers`)
und die zuletzt geladene Tourliste samt Tag und Fahrer (`bakery-delivery-tours`). `loadTours()`
zeigt die Kopie sofort (plus Warteschlange) und ersetzt sie, sobald der Server antwortet; scheitert
der Aufruf, bleibt sie stehen und der Balken sagt „Gespeicherter Stand von HH:MM Uhr". Es ist bewusst
**eine** Tourliste, nicht eine pro Tag (mit Streckenverlauf ist eine Tour einige Dutzend Kilobyte
groß). `loadDrivers()` wendet die gemerkte Fahrerliste **vor** dem `fetch` an, sonst stünde die Kopie
erst nach dem 15-s-Timeout von `GET /drivers` da. Der Tag wird absichtlich nicht gemerkt. Eine
**leere** Kopie zählt wie keine: dann erscheint „Tour konnte nicht geladen werden / Erneut laden",
**nicht** „noch nichts geplant / Tour anlegen" — sonst legte der Fahrer beim nächsten Netz eine
zweite Tour an. Das Nachladen der Kopie (`online`-Event, 30-s-Takt) wartet, solange ein Abhaken
unterwegs ist (`busyRef`) oder die Warteschlange voll ist; ein erfolgreicher `PATCH` ersetzt die
Kopie sofort. Es gibt keinen Service Worker: ein kaltes Neuladen ganz ohne Netz zeigt die
Fehlerseite des Browsers.

### „Nicht angetroffen" hält Grund und Verbleib der Ware fest

Der Knopf öffnet erst eine Rückfrage in der Karte (`FailureForm.tsx`): Grund (Nicht angetroffen /
Adresse nicht gefunden / Annahme verweigert / Sonstiges mit Freitext) und Verbleib der Ware (Ware
mitgenommen / Ware abgestellt). Beides geht **im selben Status-PATCH** mit — `failureReason` (immer
der lesbare Text, kein Schlüssel) und `goodsDisposition` (`taken_back` / `left_at_address`) — und
landet so auch in der Offline-Warteschlange. Der Server prüft beides in `normalizeStopInput()`
(`GOODS_DISPOSITION`, `FAILURE_REASON_MAX_LENGTH` im Core) und räumt es bei `done`/`open` selbst weg;
der Body für diese Stati bleibt `{ status }`. Ohne den Verbleib wusste die Backstube am Montag nicht,
ob die Tüte zurückkam oder vor der Haustür lag.

### Farbschema

Drei Zustände — **System / Hell / Dunkel** —, gespeichert unter `bakery-delivery-theme`. Die Farben
sind CSS-Variablen auf `:root`; dunkel wird zweimal definiert, über
`@media (prefers-color-scheme: dark)` **und** `[data-theme='dark']`, damit die ausdrückliche Wahl in
beide Richtungen gewinnt. Ein Inline-Skript in `layout.tsx` (Quelle in `src/lib/theme.ts`) setzt
`data-theme` **vor dem ersten Paint**. Während des Renderns darf weder `localStorage` noch
`matchMedia` gelesen werden, das bricht die Hydration; beides passiert erst im Effect.

Keine festen Farben in `page.module.css`. Die Leaflet-Kacheln werden im Dunkelmodus per CSS-Filter
abgedunkelt, die Marker bleiben ausgenommen. Status ist nie **nur** Farbe — der Text daneben bleibt.

### Navigation

`buildNavigationUrl()` (`@bakery/delivery/routing`, `navigation.ts`) erkennt iOS am User-Agent und
öffnet Apple bzw. Google Maps. Übergeben werden **Koordinaten**, nicht die Adresse — die ist bereits
geokodiert, ein zweiter Adress-Treffer in der Navi-App könnte woanders landen. „Ganze Tour
navigieren" hängt Zwischenziele an; Google nimmt neun, mehr werden abgeschnitten. Apple Maps kennt
keine Zwischenziele in URLs und fällt auf das nächste Ziel zurück.

**Die Ausnahme:** hat die Suche nur die Straße gefunden (`geocodePrecision: 'street'`) oder gar
nichts (`lat: null`), übergibt `StopCard` den eingegebenen Adresstext (`buildAddressNavigationUrl()`,
bei Koordinaten über `streetOnly` auf dem `NavigationTarget`) und sagt in der Karte, was gefunden
wurde. „Ganze Tour navigieren" gibt Straßen-Treffer ebenfalls als Adresse mit und lässt Stopps ohne
Koordinaten aus.

### Was echt ist und was nicht

**Echt:** Adressen und Koordinaten (Nominatim), Fahrstrecke, Fahrzeit und Streckenverlauf (OSRM),
Reihenfolge, Geolocation des Fahrers, Statuswechsel, Persistenz (SQLite der echten API), das Abhaken
von Vorbestellungen an der Sammelstelle samt Bezahlstand, Anmeldung mit Rollen (B8) - ein Fahrer
sieht nur seine eigenen Touren.

**Noch nicht da:** Fernzugriff von unterwegs (Q8, siehe „Stand"), keine Anbindung an Bestellungen
aus dem Shop (gewöhnliche Stopps werden von Hand erfasst), keine Tourplanung und keine
Fahrerverwaltung in der Management-App (Fahrer anlegen und Konto zuordnen geht heute nur über
`POST/PUT /api/deliveries/drivers`), keine Bestätigung an die Kundschaft. Wer eine übergebene
Vorbestellung doch noch stornieren will, muss sie erst auf „offen" zurücksetzen. `DeliveryTracker` in
der Tracking-Lib ist ein WebSocket-Client ohne Server — die App benutzt ihn nicht, Positionen gehen
per HTTP an `POST /tours/:id/position` (gedrosselt auf alle 30 s).

## E2E

`apps/bakery-delivery-e2e/src/delivery.spec.ts` fährt den Weg des Fahrers ab: Tour öffnen, Stopp
anlegen, Route berechnen, abhaken. `sammelstelle.spec.ts` die Übergabe in Mörsbach: Vorbestellungen
am Stopp, Abhaken samt Neuladen, die Rückfrage vor dem Abschließen, Nichtabholung und Zurücksetzen,
dazu der Dunkelmodus über das Neuladen hinweg. Ein dritter Block „Anmeldung" prüft Formular, falsches
Passwort, Neuladen und Abmelden. Alle anderen Tests starten angemeldet: `src/login.ts` meldet seit B12
den E2E-Inhaber an der **echten API** an (`E2E_ADMIN` aus `tools/e2e/servers.js`,
`deliveryApiServer()`: Bundle, frische SQLite-Datenbank, App-Origin in `CORS_ORIGIN`), legt die
Sitzung per `addInitScript` in den `localStorage` und gibt den Specs einen `request`-Kontext mit
Bearer - die Tests legen ihre Touren weiter direkt an. Den Fahrer „E2E-Fahrer" legt `driverId()` beim
ersten Aufruf an. `playwright.config.ts` startet **beide** Server selbst (API auf `API_PORT`, Default
5000; App auf `DELIVERY_PORT`, Default 4300) und setzt Locale `de-DE` sowie eine Position in
Homburg. Laufende Server auf diesen Ports werden wiederverwendet. Die API-Adresse geht als `NEXT_PUBLIC_API_URL` an die App, und die Tests leiten ihre
eigene aus `API_PORT` ab — sonst redet die App mit Port 5000, während der Test seine Tour woanders
anlegt. `HQ_PRODUCTS_DIR` setzen, wenn `hq/` nicht neben dem Repo liegt. Die beiden Projekte
(Desktop, Pixel 5) laufen **parallel** gegen dieselbe Datenbank.

Regeln, ohne die die Suite an Kleinigkeiten scheitert, die gar nicht kaputt sind:

- **Jeder Test bekommt seinen eigenen Tag, je Projekt verschieden.** Vorbestellungen hängen am
  _Datum_, nicht an der Tour; zwei Tests am selben Tag sähen gegenseitig ihre Bestellungen.
- **Erst aufräumen, dann anlegen** (`resetDay` / `resetTours`). Ein abgebrochener Lauf lässt seine
  Tour stehen, der nächste hängt seinen Stopp an dieselbe Tour. Eine übergebene Vorbestellung muss
  dabei erst auf „offen" zurück — stornieren lässt sie sich sonst nicht, und das ist Absicht.
- **Wer Stopps zählt, nimmt einen Werktag.** An einem Samstag hängt sich die Sammelstelle selbst an
  die Tour.
- **Beträge nie als Regex prüfen.** `Intl` setzt vor das € ein geschütztes Leerzeichen; Playwright
  normalisiert das nur beim Textvergleich, nicht beim regulären Ausdruck.
