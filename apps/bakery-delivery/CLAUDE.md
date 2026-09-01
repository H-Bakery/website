# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Scope: the `bakery-delivery` app (Fahrer-App), the two libs only it consumes, and the delivery
endpoints of the API. Monorepo-wide rules live in `website/CLAUDE.md` and the workspace root
`CLAUDE.md` — read those for Nx conventions, the `hq/` content source, and the API's known-broken
state. Everything below is specific to the delivery system and verified against the tree on
2026-08-30.

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
npx nx test delivery-routing           # 25 Tests
npx nx test delivery-tracking          # 7 Tests
npx jest --config apps/bakery-api/jest.config.js --rootDir apps/bakery-api \
  --testPathPattern deliveryTours      # 32 Tests der Server-Rechenlogik
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
und die Einzelstrecken per Haversine gerechnet wurden.

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

## Datenhaltung

Kein Datenbankzugriff — der Mock-Server ist die einzige laufende API (siehe Root-`CLAUDE.md`).
Der Store liegt als JSON neben dem Server: **`apps/bakery-api/data/delivery-store.json`**
(gitignored, überlebt Neustarts). Aufbau: `depot`, `drivers`, `tours[].stops[]`, `geocache`.
Fehlt die Datei, legt `seedDeliveryStore()` sie an: die Backstube in der Eckstraße 3, zwei Fahrer mit
Platzhalternamen und die nächste Samstagstour mit dem CAP-Markt als einzigem Stopp. Namen und
Telefonnummern sind bewusst leer — die trägt das Team mit den echten Daten nach.

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
```

Fehlerantworten setzen **`message` _und_ `error`** — `ApiClient` wirft `new Error(data.message)`, ein
`error`-only-Body verlöre den deutschen Text. Die Liefer-Endpunkte liefern rohe Objekte (wie die
Partner-Endpunkte), nicht `{success, data}` wie die älteren Order-Routen.

## Fallen, die schon einmal zugeschnappt sind

- **`Number(null)` ist `0`.** Ein Stopp ohne gefundene Adresse (`lat: null`) galt damit als Punkt
  (0, 0) — im Atlantik vor Afrika — und zog Reihenfolge und Kilometer der ganzen Tour dorthin.
  Deshalb `isNumber()` / `hasCoordinates()` in `delivery-tours.core.js`, nie `Number.isFinite(Number(x))`.
  Zwei Tests sichern das ab.
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
  der Samstagstour die Uhrzeit von heute Nachmittag. Grundlage ist `startedAt`, sonst
  `date + plannedStart` (Default 06:30).

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
src/components/Map.tsx        Leaflet, dynamisch mit ssr:false
src/lib/delivery-api.ts       Typen, fetch-Client, Offline-Warteschlange
src/lib/format.ts             de-DE-Formatierung, Datumshilfen

libs/bakery-delivery-tracking  @bakery/delivery/tracking — Location/DeliveryStatus, Geolocation-Wrapper
libs/bakery-delivery-routing   @bakery/delivery/routing — Geometrie, Reihenfolge, Navi-Links, Formatierung
```

Kein Material UI, kein React Context, keine Shared-Lib der anderen Apps — diese App steht bewusst
außerhalb des MUI-Stacks. Die Oberfläche ist mobile-first mit 44-px-Trefferflächen; der Breakpoint bei
768 px ist der Ausnahmefall (Backstube am Rechner).

### Offline

Das Handy verliert im Auto das Netz. Ein Abhaken wird deshalb **erst lokal angezeigt** und bei einem
Netzfehler in eine `localStorage`-Warteschlange gelegt (`bakery-delivery-queue`), die beim
`online`-Event automatisch nachläuft. Pro Stopp bleibt nur der letzte Stand stehen. Eine Änderung,
die der Server **fachlich** ablehnt (4xx), fliegt aus der Schlange — sonst blockierte sie alle
folgenden für immer; Netzfehler (5xx, kein Netz) lassen den Eintrag stehen.

### Navigation

Abbiegen lässt sich der Fahrer von Google oder Apple Maps; `buildNavigationUrl()` erkennt iOS am
User-Agent. Übergeben werden **Koordinaten**, nicht die Adresse — die ist bereits geokodiert, ein
zweiter Adress-Treffer in der Navi-App könnte woanders landen. „Ganze Tour navigieren" hängt
Zwischenziele an; Google nimmt neun, mehr werden abgeschnitten statt still kaputtzugehen. Apple Maps
kennt keine Zwischenziele in URLs und fällt auf das nächste Ziel zurück.

### Was echt ist und was nicht

**Echt:** Adressen und Koordinaten (Nominatim), Fahrstrecke, Fahrzeit und Streckenverlauf (OSRM),
Reihenfolge, Geolocation des Fahrers, Statuswechsel, Persistenz über Neustarts.

**Noch nicht da:** keine Authentifizierung (wer die URL hat, sieht und ändert die Tour), keine
Anbindung an Bestellungen aus dem Shop (Stopps werden von Hand erfasst), keine Ansicht in der
Management-App, kein Push an die Kundschaft. `DeliveryTracker` in der Tracking-Lib ist ein
WebSocket-Client ohne Server — die App benutzt ihn nicht, Positionen gehen per HTTP an
`POST /tours/:id/position` (gedrosselt auf alle 30 s).

## E2E

`apps/bakery-delivery-e2e/src/delivery.spec.ts` fährt den Weg des Fahrers ab: Tour öffnen, Stopp
anlegen, Route berechnen, abhaken. Die Konfiguration startet **beide** Server selbst (API auf 5000,
App auf 4300) und setzt Locale `de-DE` sowie eine Position in Homburg. Der zweite Test legt sich seine
eigene Tour per API an und löscht sie im `finally` wieder, damit er den Store nicht vollmüllt.

## Nächste sinnvolle Schritte

- Stopps aus den Shop-Bestellungen erzeugen, statt sie abzutippen.
- Eine Planungsansicht in der Management-App (die Erfassung steckt derzeit in der Fahrer-App).
- Authentifizierung, bevor die App aus dem LAN heraus erreichbar gemacht wird.
- Die Liefer-Endpunkte auch in der echten TypeScript-API (`libs/api/delivery`) verdrahten, sobald
  `serve:api` wieder startet.
