---
id: TASK-040
title: Review-Backlog - offene Findings aus dem App-Review vom 2026-09-02
slug: review-backlog-offene-findings
status: todo
priority: 3
owner: ''
projects: []
customers: []
tags:
  - review
  - api
  - shop
  - management
  - delivery
  - quality
sprint: ''
depends_on: []
due_date: ''
created: 2026-09-02
updated: 2026-09-02
---

# Review-Backlog - offene Findings aus dem App-Review vom 2026-09-02

## Kontext

Am 2026-09-02 wurden alle fünf Apps (Landing, Shop, Management, Delivery, Mock-API) gegen die
laufenden Dienste mit Playwright und curl durchgesehen. Das Review fand 49 Findings; jedes wurde
von einem unabhängigen Skeptiker gegengeprüft, bevor daran gearbeitet wurde.

Erledigt und gemerged (je ein PR pro Finding, jeder PR unabhängig reviewt):

- Landing: alle 10 Findings (#56-#61, #63, #64, #66, #67).
- Hohe und mittlere Findings in Shop, Management, Delivery und API: #70-#74 und #76-#86
  (Grundpreis auf Produktkarten, ganze Kuchen nicht „pro Stück", Warenkorb sofort speichern,
  Preisabgleich in der Kasse, Umsatzanalyse als Beispieldaten gekennzeichnet, Besuch springt
  auf seinen Geschäftstag zurück, Abholmaske zeigt Schrankbestand zuoberst, unvollständige
  Abholung markieren, Produktdaten validieren, Partner-Store atomar schreiben, Straßen-Treffer
  beim Geocoding kennzeichnen, „Erneut laden" ohne API, Offline-Kopie der Tourliste).
- Drumherum: Unit-Test-Plumbing (#62, #65, #68, #69), Legacy-Deploy-Workflow nur manuell (#75).

Übrig bleiben die niedrig eingestuften Findings unten. Sie sind bewusst **nicht** in dieser
Session gefixt worden: keines blockiert den Betrieb, und jedes verdient einen eigenen kleinen PR.
Fünf davon hat der Skeptiker bestätigt (mit Fix-Vorschlag), die anderen sind ungeprüft - vor
dem Fix zuerst gegen die laufende App reproduzieren.

## Bestätigt (mit Fix-Vorschlag im Review)

### Mock-API (`apps/bakery-api/simple-server.js`)

- **Lieferzeiten und Koordinaten werden nicht auf Wertebereiche geprüft.** `plannedStart: '99:99'`
  und `lat: 999` werden angenommen, die ETAs fallen dann auf „jetzt" zusammen. Betroffen:
  `POST/PATCH /api/deliveries/tours/:id`, `.../stops`, `.../position`, `PUT /api/deliveries/depot`.
  Fix serverseitig in `delivery-tours.core.js` (Uhrzeit `HH:MM` mit 0-23/0-59, Koordinaten
  -90..90 / -180..180); die Routing-Lib nicht anfassen.
- **Besuchspositionen werden kaum validiert** (`normalizeVisitItems`, ~Zeile 1210): nicht-numerisches
  `countedQty` wird zu `0` („Schrank war leer" statt „nicht gezählt"), Mengen unbegrenzt, unbekannte
  Produkte und negative Preise akzeptiert. Fix einmal im Core: `validateVisitItems(items, lookup)`
  in `partner-stats.core.js`, von beiden Servern benutzt. Die `null`-vs-`0`-Regel aus
  `website/CLAUDE.md` gilt weiter.
- **Fehlerhaftes JSON, zu große Bodies und unbekannte Routen antworten mit Express-HTML-Seiten**
  (Stacktrace mit absoluten Pfaden). Fix: `app.disable('x-powered-by')`, vor `app.listen` ein
  404-Handler und ein Error-Handler, die `{ error, message }` als JSON liefern (deutscher `message`,
  weil `ApiClient` daraus die Fehlermeldung baut).
- **Mutierende Mock-Routen übernehmen beliebige Bodies** (`...req.body` in `PUT /api/orders/:id`,
  `POST /api/staff`, `/api/cash`, `/api/inventory/:id/adjust`, `/api/production`,
  `/api/notifications`). Sichtbar im Admin: eine Bestellung zeigt „1999" als Datum. Fix: explizite
  Feldauswahl und Status-Whitelist je Route.

### Delivery

- **Geplante Tour am Tourtag zeigt ETAs in der Vergangenheit** („Ankunft ca. 06:38" um 10:48).
  `arrivalBaseline()` in `delivery-tours.core.js` (~Zeile 193) muss für eine noch nicht gestartete
  Tour `max(plannedStart, now)` als Basis nehmen. Beide Fassungen anfassen (Core und
  `@bakery/delivery/routing`), sonst fällt `core-consistency.spec.ts` um.

## Ungeprüft (zuerst reproduzieren)

### Mock-API

- CSV-Formel-Injection im Partner-Report: Zellen, die mit `=`, `+`, `-`, `@` beginnen, werden in
  `csvCell()` (`partner-stats.core.js`) nicht maskiert.
- Partner-Stammdaten: leerer Name, `'false'` wird zu `active: true` (`Boolean(body.active)`),
  kalendarisch ungültiger `businessDate` wird akzeptiert.

### Shop

- Wiederhergestelltes Kassenformular behält eine bereits vergangene Abholzeit; das Select wirkt
  leer, beim Absenden kommt ein Fehler (`checkout-page.tsx`, Restore ~Zeile 178).
- Unbekannte Bestellnummer rendert eine Erfolgsseite („Ihre Bestellung ist trotzdem bei uns")
  (`order-confirmation.tsx`, ~Zeile 100 und 199).
- Suchfeld im Header zeigt nach clientseitiger Navigation nicht die aktive Suche
  (`apps/bakery-shop/src/components/shop-header.tsx`, ~Zeile 50).
- Sporadischer Hydration-Mismatch der Katalog-Toolbar (`useId`-Attribute weichen ab),
  `catalog-page.tsx` ~Zeile 603 und 633.

### Management

- Team-Chat pollt alle 5 s dauerhaft einen Endpunkt, den es nicht gibt (`admin/chat/page.tsx`,
  ~Zeile 137); entweder abschalten oder nach dem ersten 404 aufhören.
- Berichte-Seite loggt bei jedem Laden einen Fehler und öffnet das Dev-Overlay, obwohl das Feature
  absichtlich nicht angebunden ist (`admin/reports/page.tsx`, ~Zeile 142).
- Social-Media: Vorschau-Platzhalter im Dark Mode unsichtbar, überlappt auf Mobil die Karte;
  Legenden-Chip verfehlt im Light Mode den Kontrast (`admin/social-media/page.tsx`, ~Zeile 1002).
  Regeln dazu stehen in `/Users/sebastian/develop/bakery/CLAUDE.md` unter „Dark mode".
- Next.js warnt bei jeder clientseitigen Navigation wegen `scroll-behavior: smooth`
  (`apps/bakery-management/src/app/layout.tsx`, Zeile 18).

### Delivery

- „Route berechnen" auf einer laufenden Tour schiebt zugestellte Stopps ans Ende und nummeriert
  alles neu (`POST /api/deliveries/tours/:id/optimize`, `simple-server.js` ~Zeile 2119).
- API akzeptiert `(0, 0)` als manuelle Stopp- oder Depot-Koordinate (`delivery-tours.core.js`
  ~Zeile 386) - `hasCoordinates()` ist hier zu großzügig.
- Ein hängender Status-Request sperrt 15 s lang alle „Geliefert"/„Nicht angetroffen"-Buttons
  (`page.tsx` ~Zeile 244); die Sperre sollte je Stopp gelten.
- „Nicht angetroffen" hält keinen Grund fest; die Bäckerei kann nicht nachvollziehen, was mit der
  Ware passiert ist (`StopCard.tsx` ~Zeile 135).
- Zoom-Buttons der Karte sind 30 x 30 px, unter der 44-px-Touch-Regel der App (`global.css`
  Zeile 67).

## Vorgehen

- Pro Finding ein Branch `fix/<app>-<kurz>` und ein PR mit Problem / Änderung / Verifikation /
  Hinweise auf Deutsch; jeder PR wird unabhängig reviewt, bevor er gemerged wird.
- Vor dem Fix gegen die laufende App reproduzieren (`npm run serve:api:simple` plus die jeweilige
  App); nach dem Fix denselben Ablauf gegen den eigenen Dev-Server fahren.
- Server-Formeln stehen genau einmal in `apps/bakery-api/src/services/*.core.js`; keine zweite
  Implementierung anlegen (siehe `website/CLAUDE.md`).
- Bekannte rote Test-Tasks (7 von 46, siehe `/Users/sebastian/develop/bakery/CLAUDE.md`) sind
  keine Regression und dürfen nicht als Vorwand dienen, Checks abzuschwächen.

## Akzeptanzkriterien

- Jedes Finding oben ist entweder gemerged oder mit Begründung als „nicht fixen" markiert.
- `npm run lint:all`, `npm run type-check` und die betroffenen `nx test`-Projekte sind grün.
- Die Zahl der roten Test-Tasks sinkt oder bleibt gleich.

## Notes

- Die Review-Daten (Findings, Skeptiker-Urteile, Playwright-Skripte) lagen im Session-Scratchpad
  und sind nicht im Repo; diese Datei ist die dauerhafte Fassung.
