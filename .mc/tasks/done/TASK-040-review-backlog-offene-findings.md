---
id: TASK-040
title: Review-Backlog - offene Findings aus dem App-Review vom 2026-09-02
slug: review-backlog-offene-findings
status: done
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
updated: 2026-09-07
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

Die niedrig eingestuften Findings unten blieben zunächst offen: keines blockierte den Betrieb, und
jedes verdiente einen eigenen kleinen PR. Am 2026-09-07 sind sie in einer zweiten Runde abgearbeitet
worden (PR #91-#99, dazu #97 für die CI); die Einträge unten sind durchgestrichen und tragen den PR.
Was bleibt, steht unter „Ergebnis".

## Bestätigt (mit Fix-Vorschlag im Review)

### Mock-API (`apps/bakery-api/simple-server.js`)

- ~~**Lieferzeiten und Koordinaten werden nicht auf Wertebereiche geprüft.** `plannedStart: '99:99'`
  und `lat: 999` werden angenommen, die ETAs fallen dann auf „jetzt" zusammen. Betroffen:
  `POST/PATCH /api/deliveries/tours/:id`, `.../stops`, `.../position`, `PUT /api/deliveries/depot`.
  Fix serverseitig in `delivery-tours.core.js` (Uhrzeit `HH:MM` mit 0-23/0-59, Koordinaten
  -90..90 / -180..180); die Routing-Lib nicht anfassen.~~ **Erledigt** in PR #93: `isClockTime()`
  und `validateCoordinates()` in `delivery-tours.core.js`, die Routen antworten mit 400 und
  deutschem `message`.
- ~~**Besuchspositionen werden kaum validiert** (`normalizeVisitItems`, ~Zeile 1210): nicht-numerisches
  `countedQty` wird zu `0` („Schrank war leer" statt „nicht gezählt"), Mengen unbegrenzt, unbekannte
  Produkte und negative Preise akzeptiert. Fix einmal im Core: `validateVisitItems(items, lookup)`
  in `partner-stats.core.js`, von beiden Servern benutzt. Die `null`-vs-`0`-Regel aus
  `website/CLAUDE.md` gilt weiter.~~ **Erledigt** in PR #92: `validateVisitItems(items, lookup)`
  mit `snapshotLookup()` im Core; nicht-numerisches `countedQty` bleibt `null`, Mengen sind
  begrenzt, unbekannte Produkte und negative Preise werden abgewiesen.
- ~~**Fehlerhaftes JSON, zu große Bodies und unbekannte Routen antworten mit Express-HTML-Seiten**
  (Stacktrace mit absoluten Pfaden). Fix: `app.disable('x-powered-by')`, vor `app.listen` ein
  404-Handler und ein Error-Handler, die `{ error, message }` als JSON liefern (deutscher `message`,
  weil `ApiClient` daraus die Fehlermeldung baut).~~ **Erledigt** in PR #91: JSON-404- und
  Error-Handler, `x-powered-by` aus, Body-Limit 200 kB; `simple-server.js` exportiert die App und
  ruft `listen` nur bei `require.main === module`, damit supertest sie in-process testen kann.
- ~~**Mutierende Mock-Routen übernehmen beliebige Bodies** (`...req.body` in `PUT /api/orders/:id`,
  `POST /api/staff`, `/api/cash`, `/api/inventory/:id/adjust`, `/api/production`,
  `/api/notifications`). Sichtbar im Admin: eine Bestellung zeigt „1999" als Datum. Fix: explizite
  Feldauswahl und Status-Whitelist je Route.~~ **Erledigt** in PR #91: Feldauswahl und
  Status-Whitelists je Route in `apps/bakery-api/src/services/mock-input.core.js`.

### Delivery

- ~~**Geplante Tour am Tourtag zeigt ETAs in der Vergangenheit** („Ankunft ca. 06:38" um 10:48).
  `arrivalBaseline()` in `delivery-tours.core.js` (~Zeile 193) muss für eine noch nicht gestartete
  Tour `max(plannedStart, now)` als Basis nehmen. Beide Fassungen anfassen (Core und
  `@bakery/delivery/routing`), sonst fällt `core-consistency.spec.ts` um.~~ **Erledigt** in PR #93:
  `arrivalBaseline()` = `max(plannedStart, jetzt)` in beiden Fassungen, `core-consistency.spec.ts`
  rechnet sie gegeneinander.

## Ungeprüft (zuerst reproduzieren)

### Mock-API

- ~~CSV-Formel-Injection im Partner-Report: Zellen, die mit `=`, `+`, `-`, `@` beginnen, werden in
  `csvCell()` (`partner-stats.core.js`) nicht maskiert.~~ **Erledigt** in PR #92: `csvCell()`
  maskiert führende Formelzeichen.
- ~~Partner-Stammdaten: leerer Name, `'false'` wird zu `active: true` (`Boolean(body.active)`),
  kalendarisch ungültiger `businessDate` wird akzeptiert.~~ **Erledigt** in PR #92:
  `isBusinessDate()` im Core prüft kalendarisch, `active` nur aus einem echten Boolean
  (`parseActive`), leerer Name wird abgewiesen (`partnerName`).

### Shop

- ~~Wiederhergestelltes Kassenformular behält eine bereits vergangene Abholzeit; das Select wirkt
  leer, beim Absenden kommt ein Fehler (`checkout-page.tsx`, Restore ~Zeile 178).~~ **Erledigt** in
  PR #95: die wiederhergestellte Abholzeit wird gegen `availablePickupSlots()` geprüft und sonst
  verworfen.
- ~~Unbekannte Bestellnummer rendert eine Erfolgsseite („Ihre Bestellung ist trotzdem bei uns")
  (`order-confirmation.tsx`, ~Zeile 100 und 199).~~ **Erledigt** in PR #95: Bestellbestätigung mit
  den Zuständen loading / not-found / unavailable statt einer Erfolgsseite.
- ~~Suchfeld im Header zeigt nach clientseitiger Navigation nicht die aktive Suche
  (`apps/bakery-shop/src/components/shop-header.tsx`, ~Zeile 50).~~ **Erledigt** in PR #95: das
  Suchfeld liest `useSearchParams()` statt einmalig `window.location`.
- **Nicht reproduzierbar, Prüfung unter Turbopack steht aus:** Sporadischer Hydration-Mismatch der
  Katalog-Toolbar (`useId`-Attribute weichen ab), `catalog-page.tsx` ~Zeile 603 und 633.

  **Befund 2026-09-07 (PR #95):** die ersten drei Shop-Findings sind
  reproduziert und gefixt (Abholzeit beim Wiederherstellen gegen die Slots geprüft, ehrliche
  „Bestellung nicht gefunden"-Ansicht, Suchfeld liest `useSearchParams()` statt einmalig
  `window.location`). Der Hydration-Mismatch ließ sich **nicht reproduzieren**: 38 Aufrufe von
  `/products` (mit/ohne `q`, `category`, `sort`), Kaltstart mit frischem `.next`, gefülltem
  Warenkorb, CPU-Drossel 4x/6x und Netzdrossel, dev (webpack) und `next build`/`next start` -
  null Hydration-Meldungen. Was sich nachweisen lässt: in dev suspendieren beide
  Suspense-Grenzen auf dem Server (`B:0` in `products/page.tsx`, `B:1` in `CatalogPage`) und
  streamen nacheinander nach; der `useId`-Pfad hängt damit an der Reihenfolge, in der React die
  dehydrierten Grenzen hydriert. Nicht geprüft werden konnte Turbopack (Standard von
  `npm run serve:shop`; im Worktree mit symlinktem `node_modules` nicht lauffähig) - der nächste
  Versuch sollte dort ansetzen. Kein `suppressHydrationWarning` eingebaut.

### CI

- ~~Die drei `test-e2e-*`-Jobs in `.github/workflows/ci.yml` sind auf `main` seit mindestens
  2026-09-01 bei jedem Lauf rot (Shop 9, Management 36, Landing 52 Fehlschläge).~~ **Erledigt
  2026-09-07 in PR #97** (alle drei `test-e2e-*`-Jobs und `ci-status` im ersten CI-Lauf grün). Ursachen waren drei: die Suiten starteten `nx serve`
  statt des gebauten Artefakts und hatten keine Produktdaten (kein `hq`, keine API in CI); Landing
  und Management listeten Firefox/WebKit/Mobile Safari, obwohl nur Chromium installiert wird; die
  Landing- und Management-Specs beschrieben eine nie gebaute Oberfläche (Schweizer Platzhalter, CHF,
  `data-testid`s ohne Gegenstück, Login ohne Login-Seite). Jetzt: `tools/e2e/servers.js` startet in
  CI `next start` auf dem Build plus die Mock-API auf dem synthetischen Katalog
  `tools/e2e/hq-products`; die Landing läuft gegen ihren statischen Export; die generierten Specs
  sind mit Begründung übersprungen, echte Smoke-Suiten prüfen die tatsächliche App.

### Management

- **Nicht fixen (Dev-only-Framework-Verhalten), beim nächsten Next/React-Update erneut prüfen:**
  `/admin/orders` meldet im Dev-Modus sporadisch einen Hydration-Mismatch: MUI-`Select` bekommt auf
  Server und Client verschiedene `aria-controls`-IDs (`useId`). Gleiche Klasse wie die
  Katalog-Toolbar im Shop unten; in zwei von vier Aufrufen reproduziert.
  Befund vom 2026-09-07 (PR #96, Next 16.1.6, MUI 5.18):
  - Diagnose aus der Bearbeitung: reproduzierbar nur unter **Turbopack-Dev** (`next dev`), und dort
    nur in einem warmen Browser-Kontext (~35 % der Aufrufe); unter `next dev --webpack` 0 von 57
    Aufrufen. Sobald man den Baum instrumentiert, verschwindet der Fehler (Heisenbug); ohne
    `AppRouterCacheProvider` (Emotion) trat er nicht auf. Ein passendes Upstream-Issue ist nicht
    belegt - die Einordnung als Turbopack/React-Canary-Race ist deshalb plausibel, nicht bewiesen.
  - Im Orders-Baum, im Admin-Layout und in den Providern gibt es keine render-zeitige Verzweigung,
    die Server- und Client-Baum auseinanderziehen würde: Theme und Auth lesen `localStorage` nur in
    Effekten. Einzige Ausnahme ist `useState(getSystemColorScheme())` im Theme-Kontext
    (`matchMedia` beim ersten Render) - sie ist hier inert, weil die Management-App mit
    `defaultMode="dark"` startet und `systemPrefersDark` nur bei `mode === 'system'` in den Baum
    eingeht; sie würde auch nur die Palette ändern, nicht die Baumform, an der `useId` hängt.
  - **Produktionsbuild geprüft** (`next build --webpack` + `next start`, Mock-API dahinter, 30 Aufrufe
    mit Playwright, je zur Hälfte frische und warme Kontexte): das `aria-controls` des Status-Selects
    ist im Server-HTML, nach der Hydration und nach dem Öffnen identisch und zeigt auf die `id` der
    tatsächlich gerenderten Listbox (7 Optionen); keine Konsolenmeldung. Der befürchtete stille
    A11y-Defekt (Client behält ein Server-`aria-controls`, das ins Leere zeigt) tritt in Produktion
    also nicht auf.
  - Prüfrezept: Seite laden, `aria-controls` des `[role="combobox"]` mit dem Wert im rohen
    Server-HTML vergleichen, Select öffnen, `id` der `[role="listbox"]` gegen `aria-controls`
    halten; dazu Konsole auf Hydration-Warnungen beobachten. Die Skripte lagen im Session-Scratchpad.
- ~~Team-Chat pollt alle 5 s dauerhaft einen Endpunkt, den es nicht gibt (`admin/chat/page.tsx`,
  ~Zeile 137); entweder abschalten oder nach dem ersten 404 aufhören.~~ **Erledigt** in
  PR #96: Erreichbarkeit als Zustand, Polling nur bei „online", nach dem
  ersten Fehlschlag ruhiger Hinweis mit „Erneut versuchen"; drei Tests.
- ~~Berichte-Seite loggt bei jedem Laden einen Fehler und öffnet das Dev-Overlay, obwohl das Feature
  absichtlich nicht angebunden ist (`admin/reports/page.tsx`, ~Zeile 142).~~ **Erledigt** in
  PR #98 (TASK-038): der Stub ist durch das Berichtsarchiv aus `hq/data/reports` ersetzt; ohne
  `hq` antwortet die Seite mit „keine Daten" statt mit einem Fehler.
- ~~Social-Media: Vorschau-Platzhalter im Dark Mode unsichtbar, überlappt auf Mobil die Karte;
  Legenden-Chip verfehlt im Light Mode den Kontrast (`admin/social-media/page.tsx`, ~Zeile 1002).
  Regeln dazu stehen in `/Users/sebastian/develop/bakery/CLAUDE.md` unter „Dark mode".~~ **Erledigt**
  in PR #96: Platzhalter im Textfluss der (immer weißen) Karte in
  Kartenfarbe (7,2:1), Chips folgen der Palette (16:1 / 18,7:1), Vorschau skaliert per `cqw`;
  Kontraste mit Playwright in beiden Modi bei 1280 und 375 px gemessen, drei Tests.
- ~~Next.js warnt bei jeder clientseitigen Navigation wegen `scroll-behavior: smooth`
  (`apps/bakery-management/src/app/layout.tsx`, Zeile 18).~~ **Erledigt** in
  PR #96: `data-scroll-behavior="smooth"` auf `<html>` (so sieht es
  Next 16 vor); ein Test sichert das Attribut ab.

### Delivery

- ~~„Route berechnen" auf einer laufenden Tour schiebt zugestellte Stopps ans Ende und nummeriert
  alles neu (`POST /api/deliveries/tours/:id/optimize`, `simple-server.js` ~Zeile 2119).~~
  **Erledigt** in PR #93: `applyOpenStopOrder()` ordnet nur die offenen Stopps neu, erledigte
  behalten Platz und Nummer.
- ~~API akzeptiert `(0, 0)` als manuelle Stopp- oder Depot-Koordinate (`delivery-tours.core.js`
  ~Zeile 386) - `hasCoordinates()` ist hier zu großzügig.~~ **Erledigt** in PR #93:
  `hasCoordinates()` lehnt `(0, 0)` in beiden Fassungen ab.
- ~~Ein hängender Status-Request sperrt 15 s lang alle „Geliefert"/„Nicht angetroffen"-Buttons
  (`page.tsx` ~Zeile 244); die Sperre sollte je Stopp gelten.~~ **Erledigt** in PR #94: Sperre je
  Stopp (`busyStops`, `inFlightRef`).
- ~~„Nicht angetroffen" hält keinen Grund fest; die Bäckerei kann nicht nachvollziehen, was mit der
  Ware passiert ist (`StopCard.tsx` ~Zeile 135).~~ **Erledigt** in PR #94: `FailureForm` erfasst
  `failureReason` und `goodsDisposition`.
- ~~Zoom-Buttons der Karte sind 30 x 30 px, unter der 44-px-Touch-Regel der App (`global.css`
  Zeile 67).~~ **Erledigt** in PR #94: Zoom-Knöpfe 44 px.

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

## Ergebnis

Stand 2026-09-07: alle Findings sind gemerged (PR #91-#96, #98) oder mit Begründung eingeordnet.
Übrig bleiben genau zwei Befunde, die keinen Fix bekommen:

- **Management, `/admin/orders`:** Hydration-Mismatch der MUI-`Select`-IDs - Dev-only-Verhalten
  unter Turbopack, im Produktionsbuild nachweislich nicht vorhanden. **Nicht fixen**, beim nächsten
  Next/React-Update erneut prüfen (Rezept oben).
- **Shop, Katalog-Toolbar:** derselbe Befund-Typ, in 38 Versuchen (webpack-dev und Produktionsbuild)
  **nicht reproduzierbar**; die Prüfung unter Turbopack steht aus. Ohne Reproduktion kein Fix.

Die CI-E2E-Jobs sind nicht Teil dieses Backlogs geblieben: PR #97 stellt sie auf gebaute Apps plus
Mock-API mit synthetischem Katalog um; seit dem Merge am 2026-09-07 sind alle drei Jobs und
`ci-status` auf `main` grün.

Von den Akzeptanzkriterien: jedes Finding ist gemerged oder als „nicht fixen" markiert; Lint,
Type-Check und die betroffenen `nx test`-Projekte waren in jedem PR grün; die Zahl der roten
Test-Tasks ist mit 7 von 46 unverändert (siehe `/Users/sebastian/develop/bakery/CLAUDE.md`).

## Notes

- Die Review-Daten (Findings, Skeptiker-Urteile, Playwright-Skripte) lagen im Session-Scratchpad
  und sind nicht im Repo; diese Datei ist die dauerhafte Fassung.
