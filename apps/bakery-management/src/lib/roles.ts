/**
 * Rollen und Rechte der Management-App (roadmap D5, Task F1).
 *
 * Es gibt genau EINE Zuordnung Rolle → erlaubte Routen + Startseite:
 * `ROLE_ACCESS`. Navigation (`getNavigationForRole`), Seiten-Sperre
 * (admin/layout.tsx, RouteGuard) und das Ziel nach der Anmeldung
 * (`resolvePostLoginPath`) fragen alle diese Tabelle. Wer einer Rolle eine
 * Seite gibt oder nimmt, ändert nur sie.
 *
 * Das ist Bedienführung, keine Zugriffskontrolle: Daten schützt die API mit
 * `requireRole(...)` (B3). Die Seiten-Sperre verhindert nur, dass jemand im
 * Laden auf einer Seite landet, deren Anfragen ohnehin mit 403 enden.
 *
 * Aufgebaut auf `getNavigation()` aus F2 (admin/navigation.ts), damit
 * Pilotbetrieb und Rollen sich überlagern: was im Pilotbetrieb fehlt, fehlt
 * für jede Rolle.
 */

import {
  PILOT_UPCOMING_NAVIGATION,
  getNavigation,
  type NavItem,
} from '../app/admin/navigation'
import { isPilotMode } from './pilotMode'

export const PILOT_ROLES = [
  'inhaber',
  'verkauf',
  'backstube',
  'fahrer',
] as const
export type PilotRole = (typeof PILOT_ROLES)[number]

export const ROLE_LABELS: Record<PilotRole, string> = {
  inhaber: 'Inhaber',
  verkauf: 'Verkauf',
  backstube: 'Backstube',
  fahrer: 'Fahrer',
}

/**
 * Rolle aus einer API-Antwort. Die echte API (B3) liefert die vier
 * Pilot-Rollen; der Mock-Server (`auth.mock.js`) noch `admin`/`staff` -
 * `admin` ist dort der Inhaber, alles andere Verkauf. Unbekanntes → `null`.
 */
export function normalizeRole(raw: unknown): PilotRole | null {
  if (typeof raw !== 'string') return null
  const role = raw.trim().toLowerCase()
  if ((PILOT_ROLES as readonly string[]).includes(role)) {
    return role as PilotRole
  }
  if (role === 'admin') return 'inhaber'
  if (role === 'staff' || role === 'manager') return 'verkauf'
  return null
}

/**
 * Eine Route einer Rolle: ein Pfad mit allen Unterseiten, oder mit
 * `exact: true` nur genau dieser Pfad (z. B. die Produktliste ohne
 * Bearbeiten/Neu). `/admin` (Dashboard) gilt immer nur exakt.
 */
export type RouteRule = string | { path: string; exact: true }

export interface RoleAccess {
  /** `'all'` = jede Route; sonst die erlaubten Routen. */
  routes: 'all' | readonly RouteRule[]
  /**
   * Startseiten in Reihenfolge der Vorliebe: die erste, die es schon gibt
   * (kommende Pilot-Bildschirme mit `ready: false` zählen nicht), gewinnt.
   */
  start: readonly string[]
}

/** Für jede angemeldete Rolle erreichbar (Design/Dunkelmodus). */
const COMMON_ROUTES: readonly RouteRule[] = ['/admin/settings']

/**
 * DIE Zuordnung Rolle → Routen + Startseite.
 *
 * - inhaber: alles, Start Dashboard.
 * - verkauf: Vorbestellungen (M1, inkl. Abholliste darunter), Sammelstelle
 *   Mörsbach (heute die einzige Vorbestell-Erfassung), Produkte nur lesen
 *   (Liste, ohne Bearbeiten/Neu), Backschrank. Dashboard als Ausweichstart,
 *   solange /admin/preorders nicht gebaut ist.
 * - backstube: Backzettel, Backstube-Tablet; Ausweichstart Dashboard.
 * - fahrer: Abholliste der Sammelstelle Mörsbach (Backliste, Lieferstelle).
 */
export const ROLE_ACCESS: Record<PilotRole, RoleAccess> = {
  inhaber: { routes: 'all', start: ['/admin'] },
  verkauf: {
    routes: [
      '/admin',
      '/admin/preorders',
      '/admin/delivery/preorders',
      { path: '/admin/products', exact: true },
      '/admin/partners',
      ...COMMON_ROUTES,
    ],
    start: ['/admin/preorders', '/admin'],
  },
  backstube: {
    routes: ['/admin', '/admin/backzettel', '/backstube', ...COMMON_ROUTES],
    start: ['/backstube', '/admin'],
  },
  fahrer: {
    routes: ['/admin/delivery/preorders', ...COMMON_ROUTES],
    start: ['/admin/delivery/preorders'],
  },
}

/** Ohne Anmeldung erreichbar; jeder andere Pfad unter diesen Bereichen nicht. */
export const PUBLIC_PATHS: readonly string[] = ['/admin/login']

/** Bereiche, die eine Sitzung brauchen (RouteGuard). `/station` gehört nicht dazu. */
export const PROTECTED_PREFIXES: readonly string[] = ['/admin', '/backstube']

function normalizePath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] || '/'
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

function underPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

/** Ob `pathname` eine Sitzung verlangt. */
export function isProtectedPath(pathname: string): boolean {
  const path = normalizePath(pathname)
  if (PUBLIC_PATHS.includes(path)) return false
  return PROTECTED_PREFIXES.some((prefix) => underPrefix(path, prefix))
}

function matchesRule(path: string, rule: RouteRule): boolean {
  if (typeof rule !== 'string') return path === rule.path
  if (rule === '/admin') return path === '/admin'
  return underPrefix(path, rule)
}

/** Ob die Rolle `pathname` öffnen darf. Öffentliche Pfade darf jede. */
export function isPathAllowedForRole(
  pathname: string,
  role: PilotRole | null | undefined
): boolean {
  const path = normalizePath(pathname)
  if (PUBLIC_PATHS.includes(path)) return true
  if (!role) return false
  const access = ROLE_ACCESS[role]
  if (access.routes === 'all') return true
  return access.routes.some((rule) => matchesRule(path, rule))
}

/** Ob eine Seite schon gebaut ist: nur kommende Pilot-Bildschirme können fehlen. */
export function isRouteReady(href: string): boolean {
  const upcoming = PILOT_UPCOMING_NAVIGATION.find((item) => item.href === href)
  return upcoming ? upcoming.ready : true
}

/** Startseite nach der Anmeldung: die erste gebaute aus `ROLE_ACCESS[role].start`. */
export function startPathForRole(
  role: PilotRole,
  isReady: (href: string) => boolean = isRouteReady
): string {
  const candidates = ROLE_ACCESS[role].start
  return candidates.find((href) => isReady(href)) ?? candidates[0]
}

/**
 * Ziel nach der Anmeldung: `next` (aus `?next=`), wenn es ein App-Pfad ist,
 * den die Rolle öffnen darf - sonst ihre Startseite.
 */
export function resolvePostLoginPath(
  role: PilotRole,
  next: string | null | undefined
): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return startPathForRole(role)
  }
  // Der Inhaber meldet sich an, um ein Tablet als Station einzurichten.
  if (normalizePath(next) === '/station') return '/station'
  if (isProtectedPath(next) && isPathAllowedForRole(next, role)) return next
  return startPathForRole(role)
}

function filterForRole(items: NavItem[], role: PilotRole): NavItem[] {
  return items.flatMap((item): NavItem[] => {
    if (item.submenu) {
      const submenu = filterForRole(item.submenu, role)
      return submenu.length > 0 ? [{ ...item, submenu }] : []
    }
    // Die Anmeldung steht in der Kopfzeile (Name + Abmelden), nicht im Menü.
    if (item.href === '/admin/login') return []
    if (item.external) return role === 'inhaber' ? [item] : []
    if (!item.href) return []
    return isPathAllowedForRole(item.href, role) ? [item] : []
  })
}

/** Navigation für Rolle und Modus: `getNavigation(pilot)`, gefiltert nach `ROLE_ACCESS`. */
export function getNavigationForRole(
  role: PilotRole,
  pilot: boolean = isPilotMode()
): NavItem[] {
  return filterForRole(getNavigation(pilot), role)
}
