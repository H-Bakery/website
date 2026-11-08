# Liefertouren (Samstagsauslieferung)

Die Fahrer-App `bakery-delivery` (Port 4300) fährt die Samstagstour mit ein bis zwei Fahrern. Eine
**Tour** gehört einem Tag und einem Fahrer und besteht aus **Stopps** in gefahrener Reihenfolge; der
Fahrer hakt `done` / `failed` ab. Seit B8 laufen die Touren auf der echten TypeScript-API (SQLite,
Rollen, Audit), seit B12 gibt es keinen Mock-Server mehr. **Im Pilot ist die Fahrer-App trotzdem
nicht** (roadmap D11): die Box ist nur im LAN erreichbar, und wie der Fahrer sie unterwegs erreicht,
ist offen (Q8, Entscheidungsvorlage [`docs/fernzugriff-fahrer.md`](../fernzugriff-fahrer.md)).

**Code:** Server-Formeln `apps/bakery-api/src/services/delivery-tours.core.js` und
`delivery-geo.core.js` · Endpunkte `/api/deliveries/*` in `apps/bakery-api/src/routes/delivery-tours.routes.ts`
(Service `delivery-tours.service.ts`) · Frontend-Geometrie `libs/bakery-delivery-routing` (`@bakery/delivery/routing`) · App
`apps/bakery-delivery`. Alles Weitere zur App: [`docs/apps/delivery.md`](../apps/delivery.md);
API-Details (Endpunkte, Rollen, bewusste Abweichungen vom Mock, Import):
[`docs/api/deliveries.md`](../api/deliveries.md).

## Drei Begriffe, nicht verwechseln

|                                    | was festgehalten wird                            | Doku                                            |
| ---------------------------------- | ------------------------------------------------ | ----------------------------------------------- |
| **Besuch** (Backschrank CAP-Markt) | Restbestand zählen, Verkauf **berechnen**        | [verkaufspartner.md](verkaufspartner.md)        |
| **Stopp** (Zustellung)             | zugestellt / nicht angetroffen                   | diese Seite, [delivery.md](../apps/delivery.md) |
| **Vorbestellung** (Sammelstelle)   | wer was bestellt hat, übergeben / nicht abgeholt | [`docs/api/preorders.md`](../api/preorders.md)  |

Die **Sammelstelle Kindergarten Mörsbach** ist ein Stopp mit vielen Kunden: dort wird vorbestellte
Ware übergeben, nicht zugestellt. Die Vorbestellungen liegen auf der echten API in `/api/preorders`
(B7; Regeln einmal in `delivery-preorders.core.js`, Alias mit dem Mock-Vertrag
`/api/deliveries/preorders*`), erfasst in der Management-App; die Übergabeliste des Stopps kommt
von dort, nicht aus einer Kopie (`GET /tours` zeigt dieselben Vorbestellungen wie `/api/preorders`).
Der Stopp hängt sich beim Anlegen einer Tour selbst an - aber **nur an die erste Tour des Tages**,
sonst hätten zwei Samstagsfahrer dieselbe Übergabeliste.

## Regeln

- **Rollen:** `inhaber` plant (Touren, Stopps, Fahrer, Depot); `fahrer` sieht **nur eigene Touren**
  (Fahrer ↔ Konto über `driver.userId`), hakt ab (nur `status`, Grund, Verbleib, `completedAt`),
  meldet die Position und darf „Route berechnen"; `verkauf` liest; `backstube` 403. Jeder
  Schreibzugriff steht im `audit_log` - ohne Namen, Adressen oder Telefonnummern. Ein Fahrer bekommt
  von `GET /drivers` nur sich selbst; zuordnen lässt sich nur ein Konto mit der Rolle `fahrer`
  (sonst 400 `Driver user not fahrer`). Fahrer legt die API nicht an - `POST /api/deliveries/drivers`
  (Inhaber); eine Fahrerverwaltung in der Management-App gibt es noch nicht.
- **DSGVO wie P4:** 90 Tage nach dem Tourtag verlieren Lieferstopps Name, Telefon, Hinweis,
  Fehlergrund, Straße und Koordinaten (PLZ, Ort, Positionen, Status bleiben; Sammelstellen-Stopps
  nicht betroffen), dazu der Adress-Cache-Eintrag, wenn ihn keine andere Adresse mehr braucht - im
  **selben nächtlichen Lauf** wie die Vorbestellungen (`cli.js anonymize-preorders`, Bericht
  `deliveryStops`) und gleich beim `import-deliveries`. Regel: `src/services/delivery-anonymize.ts`.
- **CORS:** die echte API lässt in der Entwicklung `http://localhost:4300` (Fahrer-App) wie 4200,
  4201 und 3000 ohne `CORS_ORIGIN` zu (`DEFAULT_CORS_ORIGINS`).
- **Fahrer-App:** meldet sich mit Benutzername + Passwort an (Rolle `fahrer`), Bearer auf jeder
  Anfrage, Refresh mit Rotation; Abmelden löscht Warteschlange und Offline-Kopien des Geräts
  ([`docs/apps/delivery.md`](../apps/delivery.md#anmeldung-und-rollen-b8)).
- **Die Geometrie steht zweimal - und muss gleich bleiben.** Server: `delivery-tours.core.js`
  (dependency-freies CommonJS wie `partner-stats.core.js`); Frontend: eine TypeScript-Fassung in
  `@bakery/delivery/routing` - die CommonJS/ESM-Grenze lässt sich nicht ohne Build-Umbau
  überbrücken. Wer Haversine, Umwegfaktor oder Standzeit ändert, muss **beide** Dateien anfassen;
  `libs/bakery-delivery-routing/src/lib/core-consistency.spec.ts` rechnet beide gegeneinander und
  fällt sonst um.
- **Adresssuche (Nominatim) und Routing (OSRM) sind optional.** Fällt ein Dienst aus, rechnet
  `delivery-geo.core.js` mit Schätzformeln weiter und setzt `isEstimate: true`; die Oberfläche
  schreibt „(geschätzt)“ dahinter. Nicht wegoptimieren - sonst liest sich eine Luftlinien-Schätzung
  wie eine gemessene Strecke. Samstags früh muss die Liste auch ohne fremde Server da sein: das Lesen
  einer Tour wartet höchstens 2,5 s auf Nominatim, Fehlversuche werden 5 min lang nicht wiederholt.
- **`Number(null)` ist `0`.** Ein Stopp ohne gefundene Adresse galt dadurch als Punkt (0, 0) und zog
  die ganze Tour in den Atlantik. Koordinaten deshalb immer mit `hasCoordinates()` prüfen (Server:
  `delivery-tours.core.js`, Frontend: `@bakery/delivery/routing`), nie mit
  `Number.isFinite(Number(x))` oder `!== null` - auch Depot und Fahrerposition. `hasCoordinates()`
  verlangt −90..90 / −180..180 und lehnt `(0, 0)` ab; Eingaben prüft `validateCoordinates()` (400 mit
  `message` + `error`); Altwerte aus dem früheren Mock-Store setzt `import-deliveries` auf `null`, die
  Adresse wird beim nächsten Lesen neu gesucht.
- **Zeitfenster zählen in der ETA-Kette mit.** `parseTimeWindow()` liest „09:00-09:30“,
  „08.00-09.00“, „ab 09:00“, „bis 09:30“; eine einzelne Uhrzeit nur mit Präfix
  (`ab`/`nicht vor`/`frühestens` → Beginn, `bis`/`spätestens`/`vor` → Ende), sonst Freitext ohne
  Wirkung. Die Ankunft ist `max(eta, Fensterbeginn)`, die Wartezeit steht als `waitSeconds` am Stopp,
  ein verpasstes Fenster als `missesTimeWindow`. „Route berechnen“ sortiert mit Fenstern im Core
  (Nearest Neighbour mit Zeitfenstern) und lässt OSRM nur messen.
- **Umzug der früheren Mock-Daten:** `npm run api:import-deliveries -- --file <datei> --dry-run`
  (idempotent, `--update-depot` übernimmt das Depot). **Vorher** `import-preorders` laufen
  lassen - sonst gibt es die Sammelstelle noch nicht, und ihr Stopp wird ohne Verknüpfung übernommen
  (Hinweis „zuerst import-preorders"). Eine Tour mit abgelehntem Stopp wird ganz zurückgehalten
  (Exit 2, „zurückgehalten"), damit ein Lauf mit berichtigter Datei sie samt Stopp nachholt.

## Tests

`npx nx test delivery-routing` (61), `npx nx test delivery-tracking` (7) und
`npx jest -c apps/bakery-api/jest.config.js apps/bakery-api/tests/unit/deliveryTours.test.js` für die
Rechenlogik des Servers; die API in `tests/integration/deliveryTours.test.ts`,
`tests/integration/deliveryImport.test.ts` und `tests/contract/deliveries.contract.test.ts`.
