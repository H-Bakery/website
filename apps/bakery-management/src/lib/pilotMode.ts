/**
 * Pilotbetrieb (roadmap §2 D7, §3 „Management app, route by route“, Task F2).
 *
 * Mit `NEXT_PUBLIC_PILOT_MODE=1` zeigt die Management-App nur die Seiten, die
 * echte Daten tragen, plus die kommenden Pilot-Bildschirme. Alles andere
 * (Demo-Seiten mit erfundenen Zahlen, Stubs, die alten Backlisten) ist aus der
 * Navigation verschwunden und beim direkten Aufruf gesperrt.
 *
 * Es gibt genau EINE Liste erlaubter Routen: `PILOT_ALLOWED_ROUTES`. Navigation,
 * Seiten-Sperre (admin/layout.tsx) und Dashboard-Schnellzugriffe fragen alle
 * `isPilotPathAllowed()` - wer eine Seite freigibt, ändert nur diese Liste.
 *
 * Achtung: `NEXT_PUBLIC_*` wird von Next.js beim **Build** in den Code
 * eingesetzt. Auf der Box muss die Variable also beim `next build` gesetzt sein,
 * nicht erst beim `next start`.
 */

/**
 * Ob der Pilotbetrieb aktiv ist. Standard: aus (Entwicklung).
 *
 * `process.env.NEXT_PUBLIC_PILOT_MODE` steht bewusst wörtlich im
 * Default-Parameter: nur so ersetzt Next.js den Ausdruck im Browser-Bundle.
 * Wird bei jedem Aufruf gelesen, damit Tests die Variable umschalten können.
 */
export function isPilotMode(
  value: string | undefined = process.env.NEXT_PUBLIC_PILOT_MODE
): boolean {
  if (!value) return false
  return ['1', 'true', 'on', 'yes', 'ja'].includes(value.trim().toLowerCase())
}

/**
 * Im Pilotbetrieb erlaubte Routen. `/admin` (Dashboard) gilt nur exakt, jede
 * andere Route schließt ihre Unterseiten ein (`/admin/finance` deckt
 * `/admin/finance/tagesziel`, `/admin/products` deckt `/admin/products/new`).
 *
 * „Keep“-Spalte aus roadmap §3 plus die Anmeldung und die kommenden
 * Pilot-Bildschirme (Vorbestellungen, Backzettel, Backstube), damit diese nicht
 * gesperrt sind, sobald es sie gibt.
 */
export const PILOT_ALLOWED_ROUTES: readonly string[] = [
  '/admin', // Dashboard (Kasse-Kacheln, Produkte, Tagesziel)
  '/admin/login',
  '/admin/products',
  '/admin/delivery/preorders', // Sammelstelle Mörsbach - nicht /admin/delivery
  '/admin/partners', // Backschrank CAP-Markt
  '/admin/reports',
  '/admin/analytics',
  '/admin/finance', // inkl. /admin/finance/tagesziel
  '/admin/social-media', // nur Inhaber
  '/admin/settings', // Design / Dunkelmodus
  '/admin/hilfe', // P6: Kurzanleitungen, Papierbetrieb (alle Rollen)
  '/admin/users', // Benutzer & Stationen (F1, nur Inhaber)
  // Kommende Pilot-Bildschirme (M1/M2):
  '/admin/preorders',
  '/admin/preorders/abholliste', // P2 (liegt unter /admin/preorders)
  '/admin/backzettel',
  '/backstube',
]

/**
 * Seiten, die es gibt, die der Pilotbetrieb aber sperrt (B12). Nur diese
 * schreibt der Proxy auf „Im Pilotbetrieb nicht verfügbar“ um; jede andere
 * gesperrte `/admin`-Adresse hat keine Seite mehr (die Demo-Seiten sind seit
 * B12 gelöscht) und bekommt die deutsche 404 statt eines Pilot-Hinweises.
 * `pilotMode.spec.ts` prüft, dass jede `page.tsx` unter `app/admin` entweder
 * in `PILOT_ALLOWED_ROUTES` oder hier steht.
 */
export const PILOT_HIDDEN_ROUTES: readonly string[] = [
  '/admin/rest', // Rest am Abend (M4, nach dem Pilot)
  '/admin/sitzung-pruefen', // Ziel des Proxys, nicht zum direkten Aufruf
]

/** Ob `pathname` eine vorhandene, im Pilotbetrieb gesperrte Seite ist. */
export function isPilotHiddenPath(pathname: string): boolean {
  return matchesRoute(pathname, PILOT_HIDDEN_ROUTES)
}

/** `pathname` ohne Query, Hash und abschließenden Schrägstrich. */
function normalizePath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] || '/'
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

/** Ob `pathname` unter einer der `routes` liegt (Dashboard nur exakt). */
export function matchesRoute(
  pathname: string,
  routes: readonly string[] = PILOT_ALLOWED_ROUTES
): boolean {
  const path = normalizePath(pathname)
  return routes.some((route) =>
    route === '/admin'
      ? path === '/admin'
      : path === route || path.startsWith(`${route}/`)
  )
}

/**
 * Ob `pathname` im aktuellen Modus erreichbar ist.
 *
 * Ohne Pilotbetrieb ist alles erlaubt. Im Pilotbetrieb wird nur der
 * `/admin`-Bereich geprüft - außerhalb liegen nur Weiterleitungen (`/`,
 * `/reports`, `/analytics`) und `/backstube`, die alle auf Erlaubtes zeigen.
 */
export function isPilotPathAllowed(
  pathname: string,
  pilot: boolean = isPilotMode()
): boolean {
  if (!pilot) return true
  const path = normalizePath(pathname)
  if (path !== '/admin' && !path.startsWith('/admin/')) return true
  return matchesRoute(path)
}
