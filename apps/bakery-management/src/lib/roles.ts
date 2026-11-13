/**
 * Rollen und Rechte der Management-App (roadmap D5, Task F1).
 *
 * Es gibt genau EINE Zuordnung Rolle → erlaubte Routen + Startseite:
 * `ROLE_ACCESS`. Navigation (`getNavigationForRole`), Seiten-Sperre
 * (admin/layout.tsx, RouteGuard) und das Ziel nach der Anmeldung
 * (`resolvePostLoginPath`) fragen alle diese Tabelle. Wer einer Rolle eine
 * Seite gibt oder nimmt, ändert nur sie.
 *
 * Im Browser ist das Bedienführung. Durchgesetzt wird dieselbe Tabelle
 * serverseitig von `src/proxy.ts` (Server-Komponenten rendern nur für
 * erlaubte Rollen, `lib/serverSession.ts`) und an der API mit
 * `requireRole(...)` (B3).
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
import { isSafeInternalPath } from './safePath'

export const PILOT_ROLES = [
  'inhaber',
  'verkauf',
  'backstube',
  'backstubenleiter',
  'fahrer',
] as const
export type PilotRole = (typeof PILOT_ROLES)[number]

export const ROLE_LABELS: Record<PilotRole, string> = {
  inhaber: 'Inhaber',
  verkauf: 'Verkauf',
  backstube: 'Backstube',
  backstubenleiter: 'Backstubenleitung',
  fahrer: 'Fahrer',
}

/**
 * Rollen, die eine andere einschließen - wie `ROLE_INCLUDES` der API
 * (`apps/bakery-api/src/services/auth-crypto.core.js`; `roles.spec.ts` hält
 * beide gleich). Die Backstubenleitung darf alles, was die Backstube darf,
 * und zusätzlich Rezepte anlegen und ändern.
 */
export const ROLE_INCLUDES: Partial<Record<PilotRole, readonly PilotRole[]>> = {
  backstubenleiter: ['backstube'],
}

/**
 * Ist `role` die Rolle `base` oder eine, die sie einschließt? Der Inhaber
 * wird hier nicht behandelt - wer ihn meint, fragt ihn eigens ab.
 */
export function roleIncludes(
  role: string | null | undefined,
  base: PilotRole
): boolean {
  if (!role) return false
  if (role === base) return true
  return (ROLE_INCLUDES[role as PilotRole] ?? []).includes(base)
}

/**
 * Wer am Backzettel plant, freigibt und abhakt und die Grundmengen pflegt:
 * Inhaber, Backstube und Backstubenleitung (API: `requireRole('backstube')`).
 */
export function hasBackstubeRights(role: string | null | undefined): boolean {
  return role === 'inhaber' || roleIncludes(role, 'backstube')
}

/**
 * Wer Rezepte anlegt, ändert und löscht: Inhaber und Backstubenleitung
 * (API: `RECIPE_WRITE_ROLES`). Die Backstube liest nur.
 */
export function canWriteRecipes(role: string | null | undefined): boolean {
  return role === 'inhaber' || roleIncludes(role, 'backstubenleiter')
}

/**
 * Rolle aus einer API-Antwort. Die API (B3) liefert die fünf Pilot-Rollen.
 * `admin`/`staff` stammen vom früheren Mock-Server (B12 gelöscht) und stehen
 * höchstens noch in einer alten gespeicherten Sitzung: `admin` → Inhaber,
 * sonst Verkauf. Unbekanntes → `null`.
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
 * Eine Route einer Rolle: ein Pfad mit allen Unterseiten, mit
 * `exact: true` nur genau dieser Pfad (z. B. die Produktliste ohne
 * Bearbeiten/Neu), oder mit `except` ein Pfad mit Unterseiten außer den
 * genannten (samt deren Unterseiten). `/admin` (Dashboard) gilt immer nur
 * exakt.
 */
export type RouteRule =
  | string
  | { path: string; exact: true }
  /** Pfad mit Unterseiten, außer den genannten (und deren Unterseiten). */
  | { path: string; except: readonly string[] }

export interface RoleAccess {
  /** `'all'` = jede Route; sonst die erlaubten Routen. */
  routes: 'all' | readonly RouteRule[]
  /**
   * Startseiten in Reihenfolge der Vorliebe: die erste, die es schon gibt
   * (kommende Pilot-Bildschirme mit `ready: false` zählen nicht), gewinnt.
   */
  start: readonly string[]
}

/**
 * Für jede angemeldete Rolle erreichbar: Design/Dunkelmodus und die Hilfe
 * (P6: Kurzanleitung je Rolle, Papierbetrieb).
 */
const COMMON_ROUTES: readonly RouteRule[] = ['/admin/settings', '/admin/hilfe']

/**
 * M4 „Rest am Abend“: die Zählliste, ohne die Auswertung (`GET
 * /api/rest/summary` ist nur Inhaber). Im Pilot freigegeben (Entscheidung
 * 2026-11-08, `PILOT_ALLOWED_ROUTES`).
 */
const REST_COUNT_ROUTE: RouteRule = {
  path: '/admin/rest',
  except: ['/admin/rest/auswertung'],
}

/** Rezepte: Formulare zum Anlegen und Ändern (nur Inhaber und Backstubenleitung). */
export const RECIPE_WRITE_PATHS: readonly string[] = [
  '/admin/rezepte/neu',
  '/admin/rezepte/bearbeiten',
]

/** Rezepte nur lesen: Liste und Rezeptansicht, ohne die Formulare. */
const RECIPES_READ_ROUTE: RouteRule = {
  path: '/admin/rezepte',
  except: RECIPE_WRITE_PATHS,
}

/** Was Backstube und Backstubenleitung gemeinsam haben (ohne die Rezepte). */
const BACKSTUBE_ROUTES: readonly RouteRule[] = [
  '/admin',
  '/admin/backzettel',
  '/backstube',
  // M4: die Zählung nur lesen (die API lässt die Backstube nicht zählen).
  REST_COUNT_ROUTE,
  ...COMMON_ROUTES,
]

/**
 * DIE Zuordnung Rolle → Routen + Startseite.
 *
 * - inhaber: alles, Start Dashboard. Nur er: u. a. Benutzer, Finanzen,
 *   Dienstplan und Rechnungen (`/admin/rechnungen`, API `/api/invoices`).
 * - verkauf: Vorbestellungen (M1, inkl. Abholliste darunter), Sammelstelle
 *   Mörsbach (heute die einzige Vorbestell-Erfassung), Produkte nur lesen
 *   (Liste und Preisliste, ohne Bearbeiten/Neu), Backschrank, Backzettel nur lesen (Z5, ohne
 *   Grundmengen). Start: /admin/preorders (P3); das Dashboard bleibt
 *   Ausweichstart.
 * - backstube: Backzettel, Backstube-Tablet, Rezepte nur lesen (ohne
 *   Anlegen/Bearbeiten); Ausweichstart Dashboard.
 * - backstubenleiter: wie backstube, dazu Rezepte anlegen und ändern.
 * - fahrer: Abholliste (P2, Start: übergeben, bezahlt, „nicht abgeholt“);
 *   Sammelstelle Mörsbach lesen (Liste, Bestellung, Backliste - ohne Erfassen
 *   und Lieferstelle); Vorbestellungen nur lesen (ohne die Erfassung
 *   `/admin/preorders/neu`; die API lässt Fahrer nur übergeben).
 */
export const ROLE_ACCESS: Record<PilotRole, RoleAccess> = {
  inhaber: { routes: 'all', start: ['/admin'] },
  verkauf: {
    routes: [
      '/admin',
      '/admin/preorders',
      '/admin/delivery/preorders',
      { path: '/admin/products', exact: true },
      // Preisliste (Laden) ansehen, drucken, als CSV - ohne Bearbeiten/Neu.
      '/admin/products/preisliste',
      '/admin/partners',
      // Z5: nur lesen (die API erlaubt jeder Sitzung GET /api/backzettel) -
      // im Laden sieht man, was gebacken wird. Planen/Freigeben verweigert
      // die Seite (und die API) außer Inhaber und Backstube. Die Grundmengen
      // (Z4, roadmap §5.5: nur Inhaber/Backstube) bleiben gesperrt.
      { path: '/admin/backzettel', except: ['/admin/backzettel/grundmengen'] },
      // M4: Rest am Abend zählen (ohne die Auswertung - die ist Inhaber-Sache).
      REST_COUNT_ROUTE,
      ...COMMON_ROUTES,
    ],
    start: ['/admin/preorders', '/admin'],
  },
  backstube: {
    routes: [...BACKSTUBE_ROUTES, RECIPES_READ_ROUTE],
    start: ['/backstube', '/admin'],
  },
  backstubenleiter: {
    routes: [...BACKSTUBE_ROUTES, '/admin/rezepte'],
    start: ['/backstube', '/admin'],
  },
  fahrer: {
    routes: [
      {
        path: '/admin/delivery/preorders',
        except: [
          '/admin/delivery/preorders/new',
          '/admin/delivery/preorders/lieferstelle',
        ],
      },
      { path: '/admin/preorders', except: ['/admin/preorders/neu'] },
      ...COMMON_ROUTES,
    ],
    start: ['/admin/preorders/abholliste', '/admin/delivery/preorders'],
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
  if (typeof rule !== 'string') {
    if ('except' in rule) {
      return (
        underPrefix(path, rule.path) &&
        !rule.except.some((excluded) => underPrefix(path, excluded))
      )
    }
    return path === rule.path
  }
  if (rule === '/admin') return path === '/admin'
  return underPrefix(path, rule)
}

/**
 * Seiten, die nur eine persönliche Anmeldung (Benutzername + Passwort) öffnet,
 * nie eine PIN-Sitzung an einer Station - auch nicht für den Inhaber. Die API
 * verweigert sie dort mit 403 `personal_session_required` (B3,
 * `requirePersonalSession`); hier wird daraus Bedienführung statt
 * Fehlermeldung.
 */
export const PERSONAL_ONLY_ROUTES: readonly string[] = [
  '/admin/users',
  // Finanzen und Tagesziel (B4: `inhaber` mit Passwort-Sitzung) - vorher
  // standen sie an der Station im Menü und antworteten dann mit 403
  // (W4-verify r2). `/admin/finance` schließt `/admin/finance/tagesziel` ein.
  '/admin/finance',
  // Dienstplan samt Mitarbeiterprofilen und Urlaub (TASK-042): Personendaten,
  // die API verlangt `requirePersonalSession` auf dem ganzen Router.
  '/admin/dienstplan',
  // Rechnungen: Kundenanschriften und rechtsverbindliche Belege; die API
  // verlangt `requirePersonalSession` auf dem ganzen Router.
  '/admin/rechnungen',
]

/** Sitzungsart, wie sie `authSession.ts` speichert (hier ohne Import-Zyklus). */
export type AccessSessionKind = 'personal' | 'station'

/** Ob `pathname` an einer Station (PIN-Sitzung) gesperrt ist. */
export function isPersonalOnlyPath(pathname: string): boolean {
  const path = normalizePath(pathname)
  return PERSONAL_ONLY_ROUTES.some((prefix) => underPrefix(path, prefix))
}

/** Begründung für „Kein Zugriff“ an einer Station (deutsch). */
export const STATION_NO_ACCESS_REASON =
  'Diese Seite ist an einer Station nicht verfügbar. Bitte an einem eigenen Gerät mit Benutzername und Passwort anmelden.'

/**
 * Ob die Rolle `pathname` öffnen darf. Öffentliche Pfade darf jede. Mit
 * `sessionKind: 'station'` sind zusätzlich `PERSONAL_ONLY_ROUTES` gesperrt.
 */
export function isPathAllowedForRole(
  pathname: string,
  role: PilotRole | null | undefined,
  sessionKind?: AccessSessionKind | null
): boolean {
  const path = normalizePath(pathname)
  if (PUBLIC_PATHS.includes(path)) return true
  if (!role) return false
  if (sessionKind === 'station' && isPersonalOnlyPath(path)) return false
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
  if (!isSafeInternalPath(next)) {
    return startPathForRole(role)
  }
  // Der Inhaber meldet sich an, um ein Tablet als Station einzurichten.
  if (normalizePath(next) === '/station') return '/station'
  if (isProtectedPath(next) && isPathAllowedForRole(next, role)) return next
  return startPathForRole(role)
}

function filterForRole(
  items: NavItem[],
  role: PilotRole,
  sessionKind: AccessSessionKind | null
): NavItem[] {
  return items.flatMap((item): NavItem[] => {
    if (item.submenu) {
      const submenu = filterForRole(item.submenu, role, sessionKind)
      return submenu.length > 0 ? [{ ...item, submenu }] : []
    }
    // Die Anmeldung steht in der Kopfzeile (Name + Abmelden), nicht im Menü.
    if (item.href === '/admin/login') return []
    if (item.external) return role === 'inhaber' ? [item] : []
    if (!item.href) return []
    if (!isPathAllowedForRole(item.href, role, sessionKind)) return []
    // Nur lesen: Beschreibung ohne das, was die Rolle nicht darf.
    if (
      item.readOnly &&
      !isPathAllowedForRole(item.readOnly.path, role, sessionKind)
    ) {
      return [{ ...item, description: item.readOnly.description }]
    }
    return [item]
  })
}

/**
 * Navigation für Rolle, Modus und Sitzungsart: `getNavigation(pilot)`,
 * gefiltert nach `ROLE_ACCESS` (an einer Station ohne `PERSONAL_ONLY_ROUTES`).
 */
export function getNavigationForRole(
  role: PilotRole,
  pilot: boolean = isPilotMode(),
  sessionKind: AccessSessionKind | null = null
): NavItem[] {
  return filterForRole(getNavigation(pilot), role, sessionKind)
}
