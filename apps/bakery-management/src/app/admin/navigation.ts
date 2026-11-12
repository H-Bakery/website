/**
 * Sidebar navigation model for the management app.
 * Kept outside layout.tsx so it can be imported by tests and other pages
 * (Next.js restricts the exports of layout/page files).
 */

import { isPilotMode, isPilotPathAllowed } from '../../lib/pilotMode'

/** Public URL of the customer shop (linked from the sidebar). */
const SHOP_URL = process.env.NEXT_PUBLIC_SHOP_URL || 'http://localhost:4200'

export interface NavItem {
  label: string
  href?: string
  icon?: string
  description?: string
  external?: boolean
  submenu?: NavItem[]
  /**
   * Für Rollen, die `path` nicht öffnen dürfen, steht `description` statt der
   * normalen Beschreibung da (der Fahrer liest Vorbestellungen nur - kein
   * „Erfassen“ im Menü, wenn „Neue Vorbestellung“ für ihn gesperrt ist).
   */
  readOnly?: { path: string; description: string }
}

/**
 * Whether `href` should be highlighted for the current `pathname`.
 * The dashboard (`/admin`) only matches exactly, every other item also matches
 * nested routes (e.g. `/admin/products/new` highlights "Produkte").
 */
export function isNavItemActive(
  pathname: string,
  href?: string,
  siblings: readonly (string | undefined)[] = []
): boolean {
  if (!href) return false
  if (href === '/admin') return pathname === '/admin'
  const matches = (candidate: string) =>
    pathname === candidate || pathname.startsWith(`${candidate}/`)
  if (!matches(href)) return false
  // Ein genauerer Eintrag gewinnt: auf /admin/preorders/abholliste ist
  // „Abholliste“ markiert, nicht zusätzlich „Vorbestellungen“.
  return !siblings.some(
    (other) =>
      !!other &&
      other !== href &&
      other.length > href.length &&
      other.startsWith(`${href}/`) &&
      matches(other)
  )
}

/** Alle `href` einer Navigation (inkl. Untermenüs) - für `isNavItemActive`. */
export function navHrefs(items: readonly NavItem[]): string[] {
  return items.flatMap((item) => [
    ...(item.href ? [item.href] : []),
    ...navHrefs(item.submenu ?? []),
  ])
}

// Reihenfolge: Tagesgeschäft (Verkauf, Laden) → Auswertungen (Inhaber) →
// Verwaltung. Die fertigen Pilot-Bildschirme setzt `getNavigation()` direkt
// unter das Dashboard.
export const MANAGEMENT_NAVIGATION: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: 'dashboard',
    description: 'Übersicht',
  },
  {
    // Rezepte aus hq (Owner-Wunsch 2026-11-11): direkt unter den
    // Backstube-Bildschirmen. Lesen: Inhaber, Backstubenleitung, Backstube;
    // anlegen und ändern: Inhaber und Backstubenleitung (ROLE_ACCESS).
    label: 'Rezepte',
    href: '/admin/rezepte',
    icon: 'recipes',
    description: 'Nachschlagen, anlegen, ändern',
    readOnly: {
      path: '/admin/rezepte/neu',
      description: 'Nachschlagen und drucken',
    },
  },
  {
    // Nicht „Vorbestellungen“: so heißt der kommende allgemeine Bildschirm
    // /admin/preorders (M1) - zwei gleichnamige Einträge wären verwechselbar.
    label: 'Sammelstelle Mörsbach',
    href: '/admin/delivery/preorders',
    // Eigenes Symbol (Ort) - der Warenkorb gehört „Vorbestellungen“. Der
    // Schlüssel muss in `iconMap` (layout.tsx) stehen, sonst fehlt das Symbol.
    icon: 'pickuppoint',
    description: 'Vorbestellungen Kindergarten',
  },
  {
    // M4: Zählung bei Ladenschluss (Verkauf, Laden-Tablet). Im Pilot
    // freigegeben (Entscheidung 2026-11-08).
    label: 'Rest am Abend',
    href: '/admin/rest',
    icon: 'unsold',
    // kurz genug für die 280-px-Seitenleiste (sonst „…“)
    description: 'Zählen bei Ladenschluss',
  },
  {
    label: 'Verkaufspartner',
    href: '/admin/partners',
    icon: 'partners',
    description: 'Backschrank & Lieferpartner',
  },
  {
    label: 'Produkte',
    href: '/admin/products',
    icon: 'products',
    description: 'Produktverwaltung',
    readOnly: {
      path: '/admin/products/new',
      description: 'Sortiment nachschlagen',
    },
  },
  {
    label: 'Kassenberichte',
    href: '/admin/reports',
    icon: 'reports',
    description: 'Tagesabschlüsse der Kasse',
  },
  {
    label: 'Analysen',
    href: '/admin/analytics',
    icon: 'analytics',
    description: 'Umsatz & Produkte',
  },
  {
    // M4: nur Inhaber (ROLE_ACCESS; API: GET /api/rest/summary).
    label: 'Rest-Auswertung',
    href: '/admin/rest/auswertung',
    icon: 'restsummary',
    description: 'Gebacken, verkauft, übrig',
  },
  {
    label: 'Finanzen',
    href: '/admin/finance',
    icon: 'finance',
    description: 'Einnahmen und Ausgaben',
  },
  {
    label: 'Tagesziel',
    href: '/admin/finance/tagesziel',
    icon: 'target',
    description: 'Break-even-Ampel',
  },
  {
    label: 'Jahresabschluss',
    href: '/admin/finance/jahr',
    icon: 'yearreport',
    description: 'Einnahmen und Ausgaben im Jahr',
  },
  {
    label: 'Monatsanalyse',
    href: '/admin/finance/monat',
    icon: 'monthreport',
    description: 'Auffälligkeiten im Monat',
  },
  {
    // TASK-042: Schichten (Verkauf), Abwesenheiten und Urlaubskonten - nur
    // Inhaber mit persönlicher Sitzung (PERSONAL_ONLY_ROUTES). Im Pilot für
    // den Inhaber freigegeben (Entscheidung 2026-11-08, PILOT_ALLOWED_ROUTES).
    label: 'Dienstplan',
    href: '/admin/dienstplan',
    icon: 'dienstplan',
    description: 'Schichten, Urlaub & Mitarbeiter',
  },
  {
    label: 'Social Media',
    href: '/admin/social-media',
    icon: 'socialmedia',
    description: 'Beiträge gestalten',
  },
  {
    // F1: Konten, Rollen, Passwörter, PINs und Stationen - nur Inhaber
    // (ROLE_ACCESS in src/lib/roles.ts, API: /api/users nur `inhaber`).
    label: 'Benutzer',
    href: '/admin/users',
    icon: 'users',
    description: 'Konten, Rollen & PINs',
  },
  {
    label: 'Einstellungen',
    href: '/admin/settings',
    icon: 'settings',
    description: 'Darstellung, Passwort & PIN',
  },
  {
    label: 'Anmeldung',
    href: '/admin/login',
    icon: 'login',
    description: 'An- und Abmelden',
  },
  {
    label: 'Shop',
    href: SHOP_URL,
    icon: 'shop',
    description: 'Zum Online-Shop',
    external: true,
  },
  {
    // P6: ganz unten, für jede Rolle (ROLE_ACCESS: COMMON_ROUTES).
    label: 'Hilfe',
    href: '/admin/hilfe',
    icon: 'help',
    description: 'Kurzanleitung & Papierbetrieb',
  },
]

/**
 * Kommende Pilot-Bildschirme (roadmap §5.5, §6 M1/M2). Ein Eintrag erscheint in
 * der Navigation erst, wenn `ready: true` ist - in beiden Modi, direkt unter dem
 * Dashboard. Wer die Seite baut, setzt `ready` auf `true`;
 * `pilotMode.spec.ts` prüft, dass `ready` genau dann gesetzt ist, wenn die
 * zugehörige `page.tsx` existiert. Die Routen selbst stehen bereits in
 * `PILOT_ALLOWED_ROUTES` (src/lib/pilotMode.ts).
 *
 * Geprüft wird die Index-Seite genau unter `href`: M2 plant für den Backzettel
 * nur `/admin/backzettel/grundmengen` und `/admin/backzettel/[datum]` - es
 * braucht zusätzlich `admin/backzettel/page.tsx` (z. B. Weiterleitung auf den
 * nächsten Produktionstag), sonst führte der Menüeintrag ins Leere.
 * `/admin/preorders` (P1/P3) und `/admin/preorders/abholliste` (P2) sind seit
 * M1 gebaut. „Sammelstelle Mörsbach“ (/admin/delivery/preorders) bleibt
 * daneben stehen: die Seiten laufen seit P2 auf `/api/preorders` (Liste,
 * Backliste, Lieferstelle); erfasst und bearbeitet wird mit der allgemeinen
 * Maske, übergeben in der Abholliste.
 */
export interface UpcomingNavItem extends NavItem {
  href: string
  /** Seite gebaut? Erst dann taucht der Eintrag in der Navigation auf. */
  ready: boolean
}

export const PILOT_UPCOMING_NAVIGATION: UpcomingNavItem[] = [
  {
    label: 'Vorbestellungen',
    href: '/admin/preorders',
    icon: 'orders',
    // kurz genug für die 280-px-Seitenleiste (sonst „Tagesübersi…“)
    description: 'Erfassen, Liste, Übersicht',
    readOnly: {
      path: '/admin/preorders/neu',
      description: 'Liste und Tagesübersicht',
    },
    ready: true,
  },
  {
    label: 'Abholliste',
    href: '/admin/preorders/abholliste',
    icon: 'pickup',
    description: 'Übergabe abhaken, drucken',
    ready: true,
  },
  {
    label: 'Backzettel',
    href: '/admin/backzettel',
    icon: 'baking',
    description: 'Tagesplan der Backstube',
    ready: true,
  },
  {
    label: 'Backstube',
    href: '/backstube',
    icon: 'production',
    description: 'Tablet-Ansicht der Backstube',
    ready: true,
  },
]

/** Entfernt alles, was im Pilotbetrieb gesperrt ist (auch externe Links). */
export function filterNavigationForPilot(items: NavItem[]): NavItem[] {
  return items.flatMap((item): NavItem[] => {
    if (item.submenu) {
      const submenu = filterNavigationForPilot(item.submenu)
      return submenu.length > 0 ? [{ ...item, submenu }] : []
    }
    // Der Shop läuft nicht auf der Bäckerei-Box.
    if (item.external || !item.href) return []
    return isPilotPathAllowed(item.href, true) ? [item] : []
  })
}

/**
 * Die Navigation für den aktuellen Modus: fertige Pilot-Bildschirme direkt
 * unter dem Dashboard, im Pilotbetrieb ohne die gesperrten Routen.
 */
export function getNavigation(pilot: boolean = isPilotMode()): NavItem[] {
  const ready: NavItem[] = PILOT_UPCOMING_NAVIGATION.filter(
    (item) => item.ready
  ).map(({ label, href, icon, description, readOnly }) => ({
    label,
    href,
    icon,
    description,
    readOnly,
  }))
  const [dashboard, ...rest] = MANAGEMENT_NAVIGATION
  const items = [dashboard, ...ready, ...rest]
  return pilot ? filterNavigationForPilot(items) : items
}
