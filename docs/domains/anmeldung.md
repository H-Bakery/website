# Anmeldung, Stationen und Rollen

Persönliche Konten (Benutzername + Passwort) und PIN-Stationen (gemeinsame Geräte in Laden und
Backstube) in SQLite; die Verwaltung schützt jede Seite unter `/admin` und `/backstube` serverseitig
(Proxy) und im Browser (RouteGuard), die API jede `/api`-Route.

**Code:** API `apps/bakery-api/src/auth/` (`auth.service.ts`, `middleware.ts`, `users.service.ts`,
`audit.ts`), `src/routes/auth.routes.ts`, `src/routes/users.routes.ts`, `src/services/auth-crypto.core.js`;
Verwaltung `apps/bakery-management/src/lib/session.tsx`, `authSession.ts`, `authApi.ts`,
`sessionPolicy.ts`, `sessionCookie.ts`, `serverSession.ts`, `roles.ts`, `safePath.ts`, `src/proxy.ts`,
`src/components/auth/`, `src/app/station/`, `src/app/admin/users/`, `src/app/admin/login/`.
Endpunkte und Fehlercodes: [`docs/api/auth.md`](../api/auth.md).

## API (B3)

- **Endpunkte und Antworthülle wie das frühere `auth.mock.js`** (seit B12 gelöscht; `login`, `me`, `refresh`, `logout`,
  `{ success, data: { user, token, refreshToken, expiresIn } }`) plus `POST /api/auth/pin`,
  `GET /api/auth/station/users`, `/api/auth/stations` und `/api/users` (nur `inhaber`, nur aus einer
  persönlichen Sitzung). Passwort und PIN als scrypt-Hash aus `node:crypto`.
- **Das `user`-Objekt weicht vom Mock ab (bewusst).** Echt:
  `{ id, username, displayName, role, active, isActive, createdAt, updatedAt, sessionKind }`. `email`,
  `firstName`, `lastName` und `lastLogin` gibt es nicht - die Tabelle `users` hat sie nicht, und
  erfunden werden sie nicht. Rollen sind `inhaber | verkauf | backstube | fahrer` statt `admin | staff`.
- **Es gibt kein Standardkonto.** Konten legt die CLI an (nach `npm run build:api`):
  `npm run api:create-user -- --username anna --display-name "Anna" --role verkauf` (Passwort über
  `CREATE_USER_PASSWORD` oder stdin, PIN optional über `CREATE_USER_PIN`; idempotent, setzt ein
  vorhandenes oder deaktiviertes Konto zurück). In der Entwicklung legt
  `BOOTSTRAP_ADMIN_USER`/`BOOTSTRAP_ADMIN_PASSWORD` beim Start einen Inhaber an; in Produktion wird das
  ignoriert.
- **Jede `/api`-Route braucht eine Sitzung** außer login, refresh, pin, logout und station/users. Die
  Wache sitzt in `app.ts` _vor_ allen Fachroutern; neue Domänen werden darunter eingehängt und prüfen
  Rollen mit `requireRole(...)`. `inhaber` darf alles.
- **Refresh-Tokens rotieren** und müssen vom Client gespeichert werden; ein bloßes Access-Token wird an
  `/refresh` (anders als beim Mock) nicht angenommen. Wer ein bereits rotiertes Token erneut schickt,
  beendet die ganze Sitzung - außer innerhalb von 10 s nach der Rotation, solange das Nachfolge-Token
  unbenutzt ist: dann 409 `refresh_superseded` (zweiter Tab, wiederholter Request), die Sitzung bleibt.
  Bis 15 min danach, solange das Nachfolge-Token nie vorgezeigt wurde, gilt die Antwort als verloren
  (WLAN-Aussetzer) und es wird noch einmal rotiert (`refresh_reissued`). Access-Token gilt 1 h.
- **Logout ist öffentlich** und nimmt das Access-Token (Bearer) _oder_ `{ refreshToken }` - ein Tablet,
  dessen Access-Token abgelaufen ist, kann seine Sitzung trotzdem beenden. Ohne gültiges Token
  antwortet es wie der Mock mit 200 `Abgemeldet.`
- **Stationen:** ein Inhaber registriert ein Gerät (`POST /api/auth/stations`), das Token kommt einmal
  zurück und wird als `X-Station-Token` geschickt. PIN-Sitzungen enden 12 h nach der PIN. Eine
  PIN-Sitzung trägt die volle Rolle, darf aber **Benutzer und Stationen nicht verwalten** und keine
  Finanzen sehen (403 `personal_session_required`, auch als `inhaber`; `requirePersonalSession`) - das
  geht nur mit Benutzername und Passwort. `userId` an `/pin` nur als ganze Zahl oder `"7"` (sonst 400).
- **Rate-Limit** (Fehlversuche je 5 min → 429): 5 je IP + Benutzer, 30 je IP über alle Benutzer
  (Passwort-Spraying), bei der PIN zusätzlich 10 je Benutzer über alle IPs. Es zählen **nur
  Fehlversuche** - gleichzeitige erfolgreiche Anmeldungen bekommen nie ein 429; laufende Anfragen, die
  das Limit sprengen könnten, warten kurz (höchstens 5 s, dann 429 mit `Retry-After`). Ein Client, der
  während des Wartens auflegt, gibt seinen Platz sofort frei und zählt nicht; ein abgebrochener, schon
  geprüfter Fehlversuch zählt trotzdem. `req.ip` kommt hinter Caddy aus `X-Forwarded-For`
  (`TRUST_PROXY`, Vorgabe `loopback`).
- Fehler wie `last_inhaber` (letzten Inhaber deaktivieren/herabstufen) kommen als deutsche
  API-`message` zurück.

## Verwaltung (F1)

Ohne Sitzung zeigt kein Bildschirm unter `/admin` oder `/backstube` etwas außer der Anmeldung - weder
im Browser noch im Server-HTML/RSC-Payload.

- **Die Sitzung gehört `src/lib/session.tsx`, nicht dem geteilten `AuthProvider`.** `SessionProvider`
  (in `Providers.tsx`) ersetzt in dieser App den `AuthProvider` aus `@bakery/shared/contexts` - der
  schickte alle 5 min einen leeren Refresh-Token und kannte weder PIN noch Pilot-Rollen. Seiten lesen
  `useSession()` (wirft ohne Provider) oder `useOptionalSession()` (rendert auch ohne). `useAuth()` aus
  den Shared Contexts hat in dieser App **keinen Provider** und würde zur Laufzeit werfen - deshalb
  verbietet `apps/bakery-management/.eslintrc.json` (`no-restricted-imports`) `useAuth`,
  `useCurrentUser`, `useIsAuthenticated`, `AuthProvider` und `RootProvider` aus
  `@bakery/shared/contexts`; ein Zweig, der das Muster mitbringt, fällt im Lint statt im Browser.
- **Speicher: `src/lib/authSession.ts`** - `bakery-management-session` (Access- + Refresh-Token,
  Benutzer, `sessionKind`, Anmeldezeit), `bakery-management-activity` (letzte Bedienung, von allen Tabs
  gemeinsam), `bakery-management-station` (Stations-Token; bleibt beim Abmelden stehen),
  `bakery-management-unattended` (Backstube-Tablet, siehe [`backzettel.md`](backzettel.md)). Der
  Benutzer wird mit `normalizeUser()` gelesen: echte API `displayName`/`username`; die Form des
  gelöschten Mocks (`email`/`firstName`, `admin` → `inhaber`, `staff` → `verkauf`) versteht er
  noch, damit eine alte gespeicherte Sitzung nicht wirft.
- **401 → genau ein Refresh → Wiederholung.** Der `ApiClient` (`libs/shared/data-access`) fragt bei
  einer 401 auf eine Anfrage _mit_ Bearer einmal `setUnauthorizedHandler()`; die App erneuert dann über
  `refreshSession()` (ein Refresh je Tab, gemeinsames Promise), speichert den rotierten Refresh-Token
  sofort und wiederholt die Anfrage einmal. 409 `refresh_superseded` heißt, ein anderer Tab war
  schneller - dessen Token wird aus dem Speicher übernommen. Scheitert der Refresh mit 4xx, ist die
  Sitzung vorbei; bei Netz- oder Serverfehlern bleibt sie (WLAN-Aussetzer im Laden). Login, Refresh,
  PIN und Logout laufen mit `retryOnUnauthorized: false` (`src/lib/authApi.ts`). Zusätzliche Header je
  Anfrage (`X-Station-Token`) gehen über das dritte Argument `RequestOptions` von
  `get/post/put/patch/delete`.
- **Serverseitige Wache: `src/proxy.ts` + Sitzungs-Cookie.** Server-Komponenten lesen hq-Daten
  (Berichtsarchiv, Kassentag, Kassen-Kachel des Dashboards) - ohne Prüfung stünden sie im RSC-Payload
  jeder anonymen Anfrage. Darum spiegelt `authSession.ts` (`saveSession`, `restoreSession`,
  `clearSession`) das **Access-Token** in das Cookie `bakery-management-at` (`src/lib/sessionCookie.ts`,
  `SameSite=Lax`, von JS gesetzt - nicht schwächer als `localStorage`, die API nimmt keine Cookies an).
  Der Proxy fragt damit `GET {API_URL}/api/auth/me` (`src/lib/serverSession.ts`: 30 s Cache je Token,
  abgelaufenes `exp` ohne Anfrage, API weg = ungültig) und lässt `/admin/**` und `/backstube/**` (außer
  `/admin/login`) nur rendern, wenn `ROLE_ACCESS` Rolle **und** Sitzungsart die Seite erlauben. Sonst
  schreibt er auf `/admin/sitzung-pruefen` um (URL bleibt, keine Daten, `no-store`); dort erneuert
  `components/auth/SessionCheckPending.tsx` das Token (`GET /api/auth/me`, 401 → Refresh → neues
  Cookie) und holt die Seite mit `router.refresh()` neu - einmal, danach ein Hinweis mit „Erneut
  versuchen" statt einer Schleife. Geprüfte Rolle/Sitzungsart reicht der Proxy als `x-bakery-role` /
  `x-bakery-session-kind` an die Seite (eingehende Header dieser Namen löscht er immer);
  `admin/page.tsx` liest die Kassenzahlen nur, wenn die Rolle `/admin/reports` öffnen darf
  (`mayLoadCashTile`). **Wer eine neue Server-Komponente mit sensiblen Daten baut, gibt die Route in
  `ROLE_ACCESS` nur den Rollen, die sie sehen dürfen**; der Proxy erledigt den Rest. `API_URL` muss für
  `next start` gesetzt sein (auf der Box über `bakery.env`). Ein widerrufenes Token rendert höchstens
  30 s weiter Seiten; die API lehnt es sofort ab.
- **Client-Wache: `components/auth/RouteGuard.tsx`, in `Providers.tsx`.** Solange `status` `loading` ist
  oder eine Weiterleitung läuft, steht nur `SessionLoading` da - auch im Server-HTML, also kein
  Aufblitzen geschützter Inhalte. Ohne Sitzung: `/admin/login?next=…` (mit Query; `?next=` prüft
  `isSafeInternalPath()` in `src/lib/safePath.ts` - keine `..`-Segmente, kein `//`, kein `%` im Pfad,
  kein Backslash), auf einem Gerät mit Stations-Token `/station`; nach „Abmelden" (`loggedOut`)
  **ohne** `?next=`, damit die nächste Person nicht auf der letzten Seite der vorigen landet. Die Wache
  sitzt nicht im Admin-Layout, weil `/backstube` keins hat. Die Rolle prüft unter `/admin` das
  Admin-Layout („Kein Zugriff" statt Inhalt), außerhalb die Wache. Das ist Bedienführung - Daten
  schützen der Proxy (Server-Komponenten) und die API.
- **Eine Tabelle Rolle → Routen + Startseite: `ROLE_ACCESS` in `src/lib/roles.ts`.** Inhaber alles;
  Verkauf Dashboard, `/admin/preorders`, Sammelstelle Mörsbach, Produkte **nur die Liste** (ohne
  Neu/Bearbeiten), Backschrank, Backzettel nur lesen (ohne Grundmengen); Backstube Dashboard,
  `/admin/backzettel`, `/backstube`; Fahrer `/admin/delivery/preorders` (ohne `/new` und
  `/lieferstelle`) und `/admin/preorders` lesend (ohne `/neu`), dort die Abholliste mit Übergeben; alle
  `/admin/settings` und `/admin/hilfe`. Eine Regel ist ein Pfad (mit Unterseiten), `{ path, exact: true }`
  oder `{ path, except: [...] }`. Startseite = erste _gebaute_ aus `start` (`ready` aus
  `PILOT_UPCOMING_NAVIGATION`): Inhaber `/admin`, Verkauf `/admin/preorders`, Fahrer
  `/admin/preorders/abholliste`, Backstube `/backstube`. `getNavigationForRole()` filtert
  `getNavigation()`; Pilotbetrieb und Rolle überlagern sich. Das Dashboard zeigt Kasse, Tagesziel und
  Schnellzugriffe nur, wenn die Rolle die Seite dahinter darf. **Wer eine Seite für eine Rolle
  freigibt, ändert nur `ROLE_ACCESS`** (Tests: `roles.spec.ts`). `PERSONAL_ONLY_ROUTES`
  (`/admin/users`, `/admin/finance` samt Tagesziel, `/admin/dienstplan` samt Mitarbeiterprofilen) sind an einer Station auch für den Inhaber gesperrt -
  wie `requirePersonalSession` der API; Navigation, Layout („Kein Zugriff" mit Begründung) und Proxy
  fragen `isPathAllowedForRole(path, role, sessionKind)`.
- **Station (`/station`, außerhalb `/admin`, ohne Seitenleiste).** Ohne Token richtet ein mit Passwort
  angemeldeter Inhaber das Gerät ein (`POST /api/auth/stations`); danach wird seine persönliche Sitzung
  auf dem Tablet beendet (sonst hielte eine Passwort-Sitzung dort Finanzen und Benutzerverwaltung 12 h
  statt 10 min offen). Mit Token: Namenskacheln (`GET /api/auth/station/users`) → Ziffernblock
  (`components/auth/PinPad.tsx`, PIN bleibt String, `"0420"`) → `POST /api/auth/pin` → Startseite der
  Rolle. Eine widerrufene Station (403 `station_required`) vergisst ihr Token und zeigt wieder die
  Einrichtung.
- **Leerlauf** (`src/lib/sessionPolicy.ts`): Station nach `NEXT_PUBLIC_STATION_IDLE_MINUTES` (10)
  zurück zu den Kacheln, spätestens 12 h nach der PIN; optional zur Uhrzeit
  `NEXT_PUBLIC_STATION_LOGOUT_AT` (`HH:MM`, Ortszeit, z. B. Ladenschluss - ohne Wert keine feste Uhrzeit,
  weil die Backstube nachmittags vorbereitet); persönlich nach `NEXT_PUBLIC_IDLE_LOGOUT_HOURS` (12 h).
  Ausnahme Backstube-Tablet: jede Rolle auf `/backstube` nach `NEXT_PUBLIC_BACKSTUBE_IDLE_MINUTES`
  (720), siehe [`backzettel.md`](backzettel.md). Alle `NEXT_PUBLIC_*` wirken beim Build.
- **„Abmelden"** (`components/auth/LogoutButton.tsx`) steht in der Kopfzeile, auf Stationen groß;
  `/backstube` (ohne Admin-Layout) bindet ihn selbst ein.
- **`/admin/users`** (nur Inhaber, nur persönliche Sitzung) verwaltet Konten, Rollen, Passwörter, PINs
  und Stationen (Widerrufen); API-Fehler kommen als deutsche Meldung in den Dialog.
- **E2E:** die Management-Suite meldet sich an der echten API an
  (`apps/bakery-management-e2e/src/global-setup.ts` + `login.ts`: Inhaber, Verkauf und Inhaber an einer
  PIN-Station, einmal vor allen Tests), legt die Sitzung in `localStorage` **und** das Sitzungs-Cookie,
  meldet sich einmal über die Oberfläche an und prüft, dass eine anonyme Anfrage weder Berichtsdaten
  noch `/api`-Antworten bekommt.

## Tests

- API: `apps/bakery-api/tests/integration/auth.test.ts`, `stations.test.ts`, `users.test.ts`,
  `cli.test.ts` (`create-user`), `tests/unit/authCrypto.test.js` (`authMiddleware.test.js` gehört
  zur alten JS-Schicht, nicht zu B3).
- Verwaltung: `src/lib/{authSession,roles,sessionPolicy,serverSession,safePath}.spec.ts`,
  `src/proxy.spec.ts` (`proxy.spec.ts` und `serverSession.spec.ts` laufen mit `@jest-environment node` - `test-setup.ts` legt die
  Browser-Attrappen nur mit `window` an), `admin/page.spec.tsx` (Kassen-Kachel nach Rolle),
  `components/auth/SessionCheckPending.spec.tsx`, `src/lib/session.spec.tsx`,
  `src/lib/session.refresh.spec.tsx` (echter `ApiClient`, nachgebautes `fetch`),
  `components/auth/RouteGuard.spec.tsx`, `admin/login/page.spec.tsx`, `station/StationClient.spec.tsx`,
  `admin/users/UsersClient.spec.tsx`, `admin/layout.roles.spec.tsx`,
  `libs/shared/data-access/src/lib/api-client.spec.ts`.
- Specs nutzen `src/lib/testing/fakeSession.tsx` und `memoryStorage.ts`; **nicht
  `jest.resetAllMocks()` in MUI-Specs** - das nimmt `test-setup.ts` die `ResizeObserver`-Attrappe.
