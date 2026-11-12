# Verwaltung (Management-App): Pilotbetrieb, PWA, echte API, Hilfe, Dunkelmodus

Querschnitt der Management-App (`apps/bakery-management`, Port 4201): welche Seiten im Pilotbetrieb
sichtbar sind, was beim Umstieg (B12) gelöscht wurde, die installierbare App „Heusser Verwaltung",
wie der Browser die TypeScript-API erreicht, Hilfe/Papierbetrieb und die Regeln für Hell/Dunkel.
Fachseiten: [`backzettel.md`](backzettel.md), [`vorbestellungen.md`](vorbestellungen.md),
[`anmeldung.md`](anmeldung.md), [`produkte.md`](produkte.md), [`verkaufspartner.md`](verkaufspartner.md),
[`kassenberichte.md`](kassenberichte.md), [`finanzen.md`](finanzen.md),
[`rest-am-abend.md`](rest-am-abend.md).

**Code:** `src/lib/pilotMode.ts`, `src/lib/pilotRewrite.ts`, `src/app/admin/navigation.ts`,
`src/app/admin/layout.tsx`, `src/proxy.ts`, `src/lib/apiBase.ts`, `src/lib/pwa.ts`, `public/sw.js`,
`src/app/manifest.ts`, `src/components/pwa/`, `src/lib/muiTheme.ts`, `src/app/Providers.tsx`,
`src/lib/products.ts`, `src/lib/financeApi.ts`, `src/content/hilfe/`, `src/components/hilfe/`,
`libs/shared/data-access/src/lib/api-client.ts`.

## Pilotbetrieb (`NEXT_PUBLIC_PILOT_MODE`, F2)

Mit `NEXT_PUBLIC_PILOT_MODE=1` zeigt die App nur die Seiten mit echten Daten (Spalte „Keep" in
`docs/roadmap.md` §3) plus Anmeldung, die Pilot-Bildschirme und den Dienstplan (im Pilot für den
Inhaber freigegeben, Entscheidung 2026-11-08; Rolle und persönliche Sitzung regelt weiter
`roles.ts`); alles andere fehlt in der Navigation
und zeigt beim direkten Aufruf „Im Pilotbetrieb nicht verfügbar" (seit B12 nur noch vorhandene Seiten
aus `PILOT_HIDDEN_ROUTES`, siehe [Aufräumen nach dem Umstieg](#aufräumen-nach-dem-umstieg-b12)). Ohne
die Variable (lokal, CI) ändert sich nichts.

- **Der Schalter wirkt beim Build, nicht beim Start.** `NEXT_PUBLIC_*` setzt Next.js bei `next build` in
  das Bundle ein; erst bei `next start` gesetzt, bleibt sie wirkungslos. `isPilotMode()` muss
  `process.env.NEXT_PUBLIC_PILOT_MODE` wörtlich im Default-Parameter lesen - nur so ersetzt Next.js den
  Ausdruck im Browser-Bundle. Dokumentiert in `apps/bakery-management/.env.example`.
- **Genau eine Liste erlaubter Routen:** `PILOT_ALLOWED_ROUTES` in `src/lib/pilotMode.ts`. `/admin` gilt
  nur exakt, jede andere Route schließt ihre Unterseiten ein (`/admin/finance` deckt Tagesziel;
  `/admin/delivery` ist gesperrt, `/admin/delivery/preorders` offen). Navigation
  (`getNavigation(pilot)` in `admin/navigation.ts`), Seiten-Sperre, Proxy und Dashboard-Schnellzugriffe
  fragen alle `isPilotPathAllowed()`. **Wer eine Seite freigibt, ändert nur diese Liste.** Die
  rollengefilterte Navigation (`getNavigationForRole()`) baut auf `getNavigation()` auf, nicht auf
  `MANAGEMENT_NAVIGATION`.
- **Sperre an zwei Stellen, keine Zugriffskontrolle.** `src/proxy.ts` schreibt gesperrte, aber
  vorhandene `/admin`-Seiten (`PILOT_HIDDEN_ROUTES` in `pilotMode.ts`) auf `/admin/nicht-verfuegbar`
  um (`src/lib/pilotRewrite.ts`), sodass sie serverseitig gar nicht erst rendern; eine gesperrte
  Adresse ohne Seite geht zur deutschen 404 (`app/not-found.tsx`). `admin/layout.tsx` ersetzt im
  Browser `children` durch `PilotUnavailable`. Durchgesetzt wird Zugriff von Rollen (`ROLE_ACCESS`) und den Rollen-Guards der
  API - die API bleibt direkt erreichbar.
- **Pilot-Bildschirme schalten sich über `ready` frei.** `PILOT_UPCOMING_NAVIGATION` in
  `admin/navigation.ts` führt `/admin/preorders`, `/admin/preorders/abholliste`, `/admin/backzettel`
  und `/backstube` mit einem `ready`-Schalter (alle `true`); ein Eintrag erscheint (direkt unter dem
  Dashboard) erst mit `ready: true`. `src/lib/pilotMode.spec.ts` fällt um, wenn `ready` und die Existenz
  der `page.tsx` **genau unter `href`** auseinanderlaufen, und auch, wenn es Unterseiten ohne diese
  Index-Seite gibt. `/backstube` liegt außerhalb `/admin` und bekommt weder Seitenleiste noch Sperre.
  Der Mörsbach-Eintrag heißt „Sammelstelle Mörsbach", nicht „Vorbestellungen".
- **Rezepte (`/admin/rezepte`) sind im Pilot freigegeben** (Owner-Wunsch 2026-11-11, aus M5
  vorgezogen): Eintrag „Rezepte" direkt unter „Backstube", Schnellzugriff auf dem Dashboard. Lesen
  Inhaber, Backstubenleitung und Backstube; die Formulare (`/admin/rezepte/neu`,
  `/admin/rezepte/bearbeiten/…`) nur Inhaber und Backstubenleitung (`ROLE_ACCESS`,
  `RECIPE_WRITE_PATHS`). Regeln und Bildschirme: [`rezepte.md`](rezepte.md).
- **Keine Mock-Abfragen.** Seit B12 fragt das Dashboard nur `GET /api/products` (zugleich
  API-Statusprüfung); „Offene Bestellungen", „Produktionsübersicht" und „Letzte Aktivitäten" sind mit
  den Demo-Seiten gelöscht. Der `NotificationProvider` bleibt (Einstellungen rufen
  `useNotifications()`), steckt aber in `SessionNotifications` (`Providers.tsx`): im Pilotbetrieb lädt
  er nichts, pollt nicht und fragt nicht nach Browser-Mitteilungen - die echte API hat kein
  `/api/notifications`. **Ohne Pilotbetrieb** fragt er erst mit angemeldeter Sitzung (vorher 401 +
  `console.error`, weil der `ApiClient` noch kein Token hatte), einmal; ein 401/403 bleibt im Kontext
  still, ein 404/501 setzt `available: false`, beendet das Pollen ohne `console.error` und merkt sich
  das im `sessionStorage` des Tabs (`bakery-notifications-unavailable`) - die Einstellungen blenden
  „Benachrichtigungen" dann still aus. Die eine 404-Zeile im Netzwerk-Log des Browsers bleibt. Die
  Browser-Rückfrage nach Mitteilungen kommt nie ungefragt beim Start.
- **Einstellungen im Pilotbetrieb** ohne Benachrichtigungen und E-Mail (keine API dafür);
  Passwort/PIN verweisen auf `/admin/users`.

## Aufräumen nach dem Umstieg (B12)

Gelöscht sind die Demo-Seiten, die nicht auf der „Keep"-Liste standen (`bakery/*`, `baking-list`,
`cash`, `chat`, `inventory`, `notifications`, `orders`, `production`, `staff`, `unsold-products`,
`delivery` (Übersicht)), mit 15 Feature-Libs unter `libs/bakery-management/` - übrig sind
`feature-analytics` und `feature-settings`.

- **Alte Lesezeichen leiten weiter** (`OLD_PAGE_REDIRECTS` in `apps/bakery-management/next.config.js`,
  vorübergehend; `redirects()` läuft vor `src/proxy.ts` und gilt damit auch im Pilotbetrieb):
  Backliste, Tagesvorbereitung, Samstagsproduktion und Produktion → `/admin/backzettel`,
  Bestellungen → `/admin/preorders`, Lieferung → `/admin/delivery/preorders`. Die übrigen gelöschten
  Seiten sind 404 - **auch im Pilotbetrieb**: der Proxy schreibt nur noch vorhandene, gesperrte Seiten
  auf „Im Pilotbetrieb nicht verfügbar" um (`PILOT_HIDDEN_ROUTES`, heute nur
  `/admin/sitzung-pruefen`; Dienstplan (nur Inhaber) und Rest am Abend sind im Pilot freigegeben,
  Entscheidung 2026-11-08, und stehen in `PILOT_ALLOWED_ROUTES`). `pilotMode.spec.ts` fällt um, wenn eine `page.tsx` unter `app/admin`
  weder freigegeben noch dort gesperrt ist; `src/lib/oldPageRedirects.spec.ts` prüft die
  Weiterleitungen (Ziele im Pilotbetrieb erlaubt, keine fängt eine vorhandene Seite).

## PWA „Heusser Verwaltung" (F3)

Installierbar für Handy, Laden-Tablet, Backstube und Büro-PC. Name, Farben, Icon-Pfade und die
Registrierungsregel stehen **einmal** in `src/lib/pwa.ts`; Manifest (`src/app/manifest.ts` →
`/manifest.webmanifest`), Metadaten/Viewport (`src/app/layout.tsx`) und Registrierung lesen von dort.

- **Der Service Worker cacht nur die App-Hülle.** `public/sw.js` (statisch, kein Build-Schritt):
  `/_next/static/*`, `/icons/*`, `/favicon.ico` cache-first; `/offline.html` beim Installieren. **Nie**
  `/api/*` (auch nicht als direkt geöffneter Link) und nie HTML - Seitenaufrufe gehen immer ans Netz und
  werden nicht abgelegt. Antwortet der Server nicht oder meldet Caddy 502-504, kommt die Offline-Seite
  „Keine Verbindung zum Server – bitte WLAN prüfen". RSC-Abrufe, Manifest und fremde Hosts reicht er
  unberührt durch. **Wer dort etwas cachen will, das Daten trägt: nicht.**
- **Registriert wird nur im Produktions-Build** (`shouldRegisterServiceWorker`: `NODE_ENV ===
'production'`, Browser-Support, sicherer Kontext - HTTPS über Caddy oder localhost). In `next dev` und
  jest nie; dort meldet `ServiceWorkerRegistration` einen alten Worker der App sogar ab und löscht seine
  `heusser-verwaltung-*`-Caches (sonst lieferte ein früher `next start` auf 4201 alte Chunks an
  `next dev`). Notschalter auf der Box: `NEXT_PUBLIC_DISABLE_SW=1` beim **Build** - meldet beim nächsten
  Aufruf ab.
- **Je Build eine neue Worker-Version.** `next.config.js` setzt `NEXT_PUBLIC_SW_VERSION` (`SW_VERSION`
  aus der Umgebung, sonst Zeitstempel); registriert wird `/sw.js?v=<Version>`, der neue Worker löscht
  beim Aktivieren die Caches der alten. `/sw.js` geht mit `Cache-Control: no-cache, no-store` raus. Das
  Cache-Präfix steht in `sw.js` und `pwa.ts` - `pwa.spec.ts` prüft, dass beide gleich sind.
- **Ohne Anmeldung erreichbar:** `/sw.js`, `/manifest.webmanifest`, `/offline.html`, `/icons/*` und
  `/favicon.ico` liegen außerhalb des `matcher` von `src/proxy.ts` (`/admin`, `/backstube`, `/api`) und
  müssen dort bleiben - sonst scheitert die Installation des Workers, und die Offline-Seite kommt nie in
  den Cache.
- **Statusleistenfarbe = AppBar-Farbe** (`PWA_THEME_COLORS`). Hell `#1976d2` (`primary.main`), dunkel
  `#272727` (`background.paper` + Elevation-4-Overlay). `pwa.spec.ts` rechnet beides aus `createTheme`
  nach; wer das Theme ändert, zieht `PWA_THEME_COLORS` nach. Die Metadaten liefern je
  `prefers-color-scheme` einen Startwert, `ThemeColorSync` (in `Providers.tsx`) setzt danach den echten
  Modus der App. Das Manifest kennt nur eine Farbe: die dunkle.
- **Icons** aus dem Heusser-Monogramm des Shops (`apps/bakery-shop/public/favicon.svg`):
  `node apps/bakery-management/pwa/render-icons.mjs` schreibt die SVG-Quellen nach `pwa/` und die PNGs
  (192/512 `any`, 192/512 `maskable`, 180er Apple-Touch-Icon) nach `public/icons/`.
- **Layout** geprüft (Playwright, Pilotbetrieb) bei 320, 390, 820, 844×390 und 1440 px in hell und
  dunkel: kein waagrechtes Scrollen der Seite; unter 900 px (`md`) klappt die Seitenleiste zur
  Schublade ein - auch auf dem Tablet hochkant (820 px), quer (1180 px) steht sie fest. Breite Tabellen
  (Kassenberichte, Produktliste) scrollen in ihrem eigenen Container.

## Layout-Kit (einheitliche Seiten)

Jede Seite unter `/admin` baut auf `src/components/layout/` (`PageLayout`, `PageSection`,
`KeyFigures`, `ResponsiveList`, `DayNavigator`, `LoadingState`/`EmptyState`/`ErrorState`); Regeln
und Bausteine stehen in `src/components/layout/README.md`, Referenzseiten sind `/admin/settings` und
`/admin/users`. Kurz: genau ein `PageLayout` je Seite, den Seitenrand setzt `admin/layout.tsx`
(keine eigenen `p`/`Container`/`maxWidth`), höchstens 4 Kennzahlen, eine Hauptaktion je Seite,
Tabellen werden unter 600 px zu Karten, Fehler stehen als deutscher Satz (`ErrorState` übersetzt
„Failed to fetch“/HTTP 502 in den WLAN-Hinweis), Druck ist immer hell. Die Fahrer-App folgt
denselben Regeln in CSS ([`docs/apps/delivery.md`](../apps/delivery.md#oberfläche)).
Tests: `src/components/layout/layoutKit.spec.tsx`, `focusNotObscured.spec.tsx`.

## Theme und Dunkelmodus

- **Standard ist dunkel:** `<ThemeProvider defaultMode="dark" storageKey="bakery-management-theme">` in
  `src/app/Providers.tsx`; eine gespeicherte Wahl oder „Systemeinstellung folgen" (Einstellungen) gewinnt.
  `libs/shared/contexts/src/lib/theme/theme.context.tsx` hält Modus und Speicherung, `MuiThemeBridge` in
  `Providers.tsx` baut daraus `createManagementTheme(mode)`.
- **`createManagementTheme(mode)` in `src/lib/muiTheme.ts`:** `contrastThreshold: 4.5` (Schrift auf
  `*.main` erst ab 4,5:1 weiß, sonst schwarz) und hell `warning.main` #a14a00 / `info.main` #0277bd - das
  MUI-Orange #ed6c02 lag als Text und unter weißer Schrift bei 3,1:1. `primary` und Hintergründe bleiben
  Standard. Gestrichene Zeilen (storniert, Lücken im Kassenarchiv) mit `text.secondary`, nicht
  `text.disabled`/`opacity`. Die AppBar heißt „Verwaltung", der Seitentitel „Bäckerei Heusser -
  Verwaltung".
- **Touch-Ziele:** dasselbe Theme gibt `MuiButton`/`MuiIconButton`/`MuiToggleButton` unter `TOUCH_MEDIA`
  (`pointer: coarse` oder schmaler als 1200 px) mindestens 44 px; Inline-Links (Telefon, Kurzcode)
  bekommen `TOUCH_LINK_STYLE`. Am Büro-PC mit Maus bleibt MUI kompakt.
- **Zwei Muster brechen den Dunkelmodus** - nicht wieder einführen:
  - **`color: 'white'` auf einer `*.main`-Fläche.** Im Dunkelmodus wird `primary.main` ein _helles_
    Blau, weiße Schrift fällt auf ~1,75:1. `primary.contrastText` (bzw. das passende
    `*.contrastText`) nehmen, das mit der Palette umschaltet. Die zweite Zeile von `ListItemText`
    braucht `'& .MuiListItemText-secondary': { color: 'inherit' }` - `color` am Elternelement erreicht
    sie nicht.
  - **`grey.50/100/300` als Hintergrund.** MUIs Grauskala ist fest, nicht modusabhängig; diese Flächen
    bleiben im Dunkelmodus hell und Text darauf fällt auf ~1,09:1. `action.hover` / `action.selected`
    nehmen.
- **`admin/social-media`** hat eine feste `BRAND_COLORS`-Palette. Nur das _Canvas-Rendering_ und die
  _Vorschaukarte_ dürfen sie benutzen - das ist die erzeugte Grafik, immer eine weiße Karte. Die
  Seitenhülle nimmt `text.primary` / `text.secondary` / `divider`.
- **Feste Farbpaare statt `*.main`-Texte** für Statusanzeigen: Tagesziel-Ampel
  (`useTargetStatusColors`, ≥ 4,5:1) und Backstube-Tablet (`backstubeColors.ts`, ≥ 7:1).
- **Prüfen nach einer UI-Änderung:** die Routen in beiden Modi abgehen und Text unter ~2,5:1 gegen
  seinen berechneten Hintergrund melden.

## Verwaltung auf der echten API (F4)

Die Pilot-Bildschirme (Dashboard, Produkte, Backschrank, Kassenberichte, Analysen, Finanzen,
Tagesziel, Vorbestellungen, Sammelstelle Mörsbach, Backzettel, Einstellungen) sprechen die
TypeScript-API.

- **Gleiche Origin, kein CORS.** Der `ApiClient` der App hat die Basis `''` (`resolveBrowserApiBase()`
  in `src/lib/apiBase.ts`, gesetzt in `Providers.tsx` über `setBaseUrl()`) - der Browser fragt `/api/...`
  bei der App selbst. Auf der Box schickt Caddy `/api/*` direkt an die API; ohne Caddy (lokal, Port 4201
  direkt, E2E) reicht **`src/proxy.ts`** es an `API_URL` weiter (`apiProxyTarget()`,
  `NextResponse.rewrite`). **Kein `rewrites()` in `next.config.js`:** Next.js backt Rewrites beim Build
  in das Routes-Manifest, ein bei `next start` gesetztes `API_URL` hätte keine Wirkung; der Proxy liest
  es zur Laufzeit. `NEXT_PUBLIC_API_URL` bleibt leer (setzen nur für eine API auf fremder Origin, dann
  braucht die API `CORS_ORIGIN`); `deploy/scripts/deploy.sh` bricht nur beim `example.`-Platzhalter ab.
- **Produkte** kommen im Browser aus `GET /api/hq-products[/:id]` (`fetchManagementProducts()`,
  `fetchManagementProduct()` in `src/lib/products.ts`, kein `fs`; Seiten `ProductsPageClient.tsx`,
  `[id]/ProductEditLoader.tsx`, dynamisch statt `generateStaticParams`). `pendingApproval` zeigt den Chip
  „wartet auf Freigabe" in Liste und Bearbeiten-Seite, dazu den freigegebenen Stand (`approved`) als
  Hinweis. Neu/Bearbeiten nur für `inhaber` (die API antwortet sonst 403); andere Rollen sehen die Liste
  ohne Stift. Der Partner-Katalog der Backschrank-Erfassung liest serverseitig aus `HQ_PRODUCTS_DIR`
  (`src/lib/hqProductsFs.ts`, dasselbe Verzeichnis wie die API). Vertrag:
  [`docs/api/hq-products.md`](../api/hq-products.md).
- **Beschreibung aus `rawDescription`, nie aus `description`:** die Verwaltungssicht
  `/api/hq-products[/:id]` liefert zusätzlich `rawDescription` - den Body ohne Überschrift, **ohne** den
  Rückgriff auf `short_description`, den `description` für den Shop hat (`hq-products.core.js`).
  `toManagementProduct()` liest das Feld; sonst schriebe ein Speichern ohne Änderung bei einer Datei
  ohne Beschreibung den Kurztext in den Body (Null-Diff-Invariante, Integrationstest in
  `apps/bakery-api/tests/integration/hqProducts.test.ts`). PUT/POST-Antworten (wie früher der Mock)
  haben kein `rawDescription`; dort ist `description` der Body.
- Die Dashboard-Kachel zählt `/api/products` (freigegebener Stand, „Verfügbar" inkl. Saisonware) und
  zeigt „Produkte verwalten" nur Rollen, die `/admin/products` öffnen dürfen.
- **Backschrank:** CSV-Export über `downloadReportCsv()` → `apiClient.getBlob()` (Bearer, 401 →
  Refresh) statt Link; `deleteVisit()` liefert `{ id, deleted, message }` und die Seite zeigt `message`;
  Standard-Bestückung ist für alle außer `inhaber` nur lesbar. Regeln:
  [`docs/api/partners.md`](../api/partners.md).
- **403 hat eine Ursache, und die steht da.** Finanzen/Tagesziel an der PIN-Station (403
  `personal_session_required`): „An der PIN-Station nicht verfügbar – bitte am Büro-PC oder eigenen
  Gerät mit Passwort anmelden." (`PERSONAL_SESSION_HINT` in `src/lib/financeApi.ts`, auch in der
  Dashboard-Kachel) - **bewusst ohne Anmelde-Link**: eine PIN-Sitzung gibt es nur an einem
  Stationsgerät, und eine Passwort-Sitzung dort hielte Finanzen und Benutzerverwaltung 12 h statt
  10 min offen. Analysen für andere Rollen: „Nur für Inhaber" (`components/analytics/OwnerOnlyNotice.tsx`;
  `analyticsService` liefert `forbidden: true`). Kein Export-Knopf in den Analysen -
  `/api/reports/generate` gibt es auf keiner API. Berichte/Finanzen: [`docs/api/hq-data.md`](../api/hq-data.md).
- `ApiClient` (`libs/shared/data-access`) hat dafür `setBaseUrl()`, `getBaseUrl()` und `getBlob()`
  (Dateiname aus `Content-Disposition`, Fehler-JSON → `ApiError` mit `message`).
- **E2E** fährt die Management-Suite gegen das Bundle der echten API (`tools/e2e/real-api.js`, siehe
  `tools/e2e/README.md`).

## Hilfe und Papierbetrieb (`/admin/hilfe`, P6)

Kurzanleitung je Rolle und die Papier-Vordrucke, für **jede** Rolle erreichbar (`COMMON_ROUTES` in
`roles.ts`, `PILOT_ALLOWED_ROUTES`), Menüeintrag „Hilfe" ganz unten. Einweisung und Go-live-Checkliste
fürs Personal: `docs/onboarding.md`; Regel und Vordrucke: `docs/runbook.md` §9.

- **Fünf Kurzanleitungen** (`SPICKZETTEL: Record<PilotRole, …>` - eine neue Rolle ohne Blatt
  kompiliert nicht): Verkauf, Backstube, Backstubenleitung, Fahrer, Inhaber. Das Blatt der
  Backstubenleitung verweist für Zettel und Abhaken auf das der Backstube und erklärt die Rezepte
  (nachschlagen, anlegen, ändern, „wartet auf Freigabe", „offen ≠ 0"); Backstube und Inhaber tragen je
  einen kurzen Abschnitt „Rezepte".
- **Text nur in `src/content/hilfe/`** (`spickzettel.ts` je Rolle, `papierbetrieb.ts` für die Regel) -
  reiner Text, `**fett**` für Beschriftungen der App. Geschrieben nach den echten Bildschirmen: **wer
  dort einen Knopf umbenennt** („Vorbestellung speichern", „Bezahlt und übergeben", „Gesehen", „Jetzt
  freigeben" …), **zieht den Text nach**; `spickzettel.spec.ts` prüft die wichtigsten Begriffe und eine
  Längengrenze je Blatt.
- **Jedes Blatt druckt auf genau EINE A4-Seite.** Mehrere Blätter auf einer Seite: jedes ist ein
  `.hilfe-sheet[data-sheet=<id>]` (`components/hilfe/HilfeSheet.tsx`); „Drucken" setzt
  `data-hilfe-print=<id>` an `<html>`, ruft `window.print()` und nimmt das Attribut bei `afterprint`
  wieder weg (`components/hilfe/hilfePrint.tsx`). Strg+P ohne Knopf druckt den gezeigten Spickzettel
  (`data-print-default`). Vorbestellschein und Notfallblatt sind seitenhoch mit fester Höhe (270 mm) -
  deshalb nimmt das Druckbild jeden Abstand davor weg (Pfadzeile, Ränder). In `GlobalStyles` **einen**
  Schlüssel je Selektor: ein zweiter `'.hilfe-sheet'` im selben Objekt ersetzte den ersten (so fiel
  einmal `display: none` weg). `global.css` blendet jedes `<section>` ein (`sectionFadeIn`) - auf den
  Blättern ist das abgeschaltet, sonst druckt ein gerade gewechselter Reiter halb durchsichtig.
- **Vorbestellschein** (`components/hilfe/Vorbestellschein.tsx`, 2 oder 4 je Seite, Schnittlinien)
  spiegelt die Erfassungsmaske; unten „in App übertragen" + Code. **Backzettel-Notfallblatt**
  (`components/hilfe/BackzettelNotfallblatt.tsx`) holt die Posten (je Sorte eine Zeile) aus
  `GET /api/backzettel/config`, ohne Stammdaten leere Zeilen; `notfallLayout()` wählt die Zeilenhöhe
  (4–7 mm) und zwei bzw., wenn zwei Spalten unter 4 mm fielen, drei Spalten, damit es eine Seite bleibt.
- **Keine Telefonnummern, keine echten Namen** in den Texten - der Aushang hat Leerzeilen für Inhaber
  und Technik, die von Hand ausgefüllt werden.
- Die Ein-Seiten-Prüfung geht nur im Browser: `page.pdf()` je Blatt, Seitenzahl 1. Achtung: nach
  `emulateMedia({ media: 'screen' })` druckt `page.pdf()` das Bildschirm-CSS - mit `media: null`
  zurücksetzen; `page.pdf()` löst `afterprint` aus.

## Tests

- Pilotbetrieb: `src/lib/pilotMode.spec.ts`, `src/app/admin/layout.pilot.spec.tsx`,
  `src/app/admin/DashboardClient.spec.tsx`, `src/lib/oldPageRedirects.spec.ts`,
  `src/app/not-found.spec.tsx`, `src/app/Providers.notifications.spec.tsx`,
  `libs/shared/contexts/src/lib/notification/notification.loadOnMount.spec.tsx`.
- PWA: `src/lib/pwa.spec.ts` (Manifest, Icon-Dateien und -Größen, Farben gegen MUI,
  Registrierungsregel), `src/lib/sw.spec.ts` (führt `public/sw.js` in einer nachgebauten
  Worker-Umgebung aus: kein `/api`, kein HTML im Cache, Netz zuerst, Offline-Seite),
  `src/components/pwa/ServiceWorkerRegistration.spec.tsx`, `src/app/layout.spec.tsx`.
- Theme: `src/lib/muiTheme.spec.ts`, `libs/shared/contexts/src/lib/theme/theme.context.spec.tsx`.
- Echte API: `src/lib/apiBase.spec.ts`, `src/proxy.spec.ts` (Weiterleitung `/api`),
  `admin/products/{page,productsApi}.spec.tsx`, `src/lib/partnerApi.spec.ts`,
  `admin/partners/[id]/**/*.spec.tsx`, `src/lib/financeApi.spec.ts`, `admin/finance/**/*.spec.tsx`,
  `admin/analytics/revenue/page.spec.tsx`, `admin/settings/page.spec.tsx`,
  `libs/shared/data-access/src/lib/{api-client,services/analytics.service}.spec.ts`.
- Rollen: `src/lib/roles.spec.ts` (Matrix Rolle × Seite inkl. `backstubenleiter`, Vergleich mit
  `ROLE_INCLUDES`/`ROLES` der API), `src/lib/serverSession.spec.ts` (Proxy-Entscheidung),
  `admin/users/UsersClient.spec.tsx` (Rollenauswahl).
- Rezepte: siehe [`rezepte.md`](rezepte.md).
- Hilfe: `src/content/hilfe/spickzettel.spec.ts`, `admin/hilfe/HilfeClient.spec.tsx` (je Rolle,
  Drucken, Vordrucke), `components/hilfe/BackzettelNotfallblatt.spec.tsx`.
