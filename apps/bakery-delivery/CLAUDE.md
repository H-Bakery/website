# bakery-delivery (Fahrer-App)

Samstagstour mit ein bis zwei Fahrern: Tour = Tag + Fahrer + Stopps, abgehakt `done`/`failed`;
Sammelstelle Mörsbach = ein Stopp mit Übergabeliste. Mobile-first, kein MUI. Läuft gegen die echte
API (`/api/deliveries`, B8) mit persönlicher Anmeldung; ein Fahrer sieht nur seine eigenen Touren.
Die Vorbestellungen der Sammelstelle kommen aus `/api/preorders` (Management-App). **Nicht im
Pilot** (roadmap D11) - wie der Fahrer die Box unterwegs erreicht, ist offen (Q8).

Regeln, die am härtesten beißen:

- **Geometrie steht zweimal**: `apps/bakery-api/src/services/delivery-tours.core.js` (CommonJS) und
  `@bakery/delivery/routing` (TS). Haversine, Umwegfaktor, Standzeit, ETA, Zeitfenster in **beiden**
  ändern; `libs/bakery-delivery-routing/src/lib/core-consistency.spec.ts` rechnet sie gegeneinander.
- **Koordinaten nur mit `hasCoordinates()` prüfen**, nie `Number(x)`/`!== null` — `Number(null)` ist
  `0` und zog Touren nach (0, 0). Eingaben über `validateCoordinates()`.
- **Nominatim/OSRM sind optional**: Ausfall → Schätzformel mit `isEstimate: true`, UI zeigt
  „(geschätzt)". Lesen einer Tour wartet höchstens 2,5 s auf Nominatim. Nicht wegoptimieren.
- **Offline**: Abhaken erst lokal, dann Warteschlange; jede Server-Tour geht durch `withInFlight()`,
  sonst springt ein laufendes Abhaken zurück auf „Offen". Vorbestellungen hängen bewusst im
  Tour-Payload (Offline-Kopie).
- **Nichts verschwindet**: Vorbestellungen werden storniert, nicht gelöscht;
  `handed_over ↔ cancelled` ist 409. Fehlerantworten mit `message` **und** `error`.
- **Kein zweiter Server:** Den Mock `simple-server.js` gibt es seit B12 nicht mehr - neue
  Endpunkte gehören in die echte API, Regeln in `*.core.js`.

Details, Fallen, Endpunkte, Befehle: [`docs/apps/delivery.md`](../../docs/apps/delivery.md),
API-Vertrag: [`docs/api/deliveries.md`](../../docs/api/deliveries.md).
