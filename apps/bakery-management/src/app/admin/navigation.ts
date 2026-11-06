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
}

/**
 * Whether `href` should be highlighted for the current `pathname`.
 * The dashboard (`/admin`) only matches exactly, every other item also matches
 * nested routes (e.g. `/admin/products/new` highlights "Produkte").
 */
export function isNavItemActive(pathname: string, href?: string): boolean {
  if (!href) return false
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

// Navigation items with submenu support
export const MANAGEMENT_NAVIGATION: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: 'dashboard',
    description: 'Übersicht',
  },
  {
    label: 'Bestellungen',
    href: '/admin/orders',
    icon: 'orders',
    description: 'Bestellverwaltung',
  },
  {
    label: 'Bäckerei',
    icon: 'bakery',
    description: 'Produktionsprozesse',
    submenu: [
      {
        label: 'Produktion',
        href: '/admin/production',
        icon: 'production',
        description: 'Produktionsplanung',
      },
      {
        label: 'Backliste',
        href: '/admin/baking-list',
        icon: 'baking',
        description: 'Tägliche Backliste',
      },
      {
        label: 'Tägliche Vorbereitung',
        href: '/admin/bakery/daily-prep',
        description: 'Vorbereitungsliste',
      },
      {
        label: 'Samstag Produktion',
        href: '/admin/bakery/saturday-production',
        description: 'Wochenend-Produktion',
      },
      {
        label: 'Interne Bestellungen',
        href: '/admin/bakery/intern-orders',
        description: 'Mitarbeiterbestellungen',
      },
      {
        label: 'Rezepte',
        href: '/admin/bakery/recipes',
        description: 'Rezeptverwaltung',
      },
      {
        label: 'Prozesse',
        href: '/admin/bakery/processes',
        description: 'Arbeitsabläufe',
      },
    ],
  },
  {
    label: 'Lagerbestand',
    href: '/admin/inventory',
    icon: 'inventory',
    description: 'Lagerverwaltung',
  },
  {
    label: 'Produkte',
    href: '/admin/products',
    icon: 'products',
    description: 'Produktverwaltung',
  },
  {
    label: 'Unverkaufte Produkte',
    href: '/admin/unsold-products',
    icon: 'unsold',
    description: 'Rückläufer & Reste',
  },
  {
    label: 'Lieferung',
    href: '/admin/delivery',
    icon: 'delivery',
    description: 'Lieferverwaltung',
  },
  {
    // Nicht „Vorbestellungen": so heißt der kommende allgemeine Bildschirm
    // /admin/preorders (M1) - zwei gleichnamige Einträge wären verwechselbar.
    label: 'Sammelstelle Mörsbach',
    href: '/admin/delivery/preorders',
    // `iconMap` in layout.tsx kennt keinen eigenen Schlüssel dafür - ein
    // unbekannter ließe die Zeile ohne Symbol stehen.
    icon: 'orders',
    description: 'Vorbestellungen Kindergarten',
  },
  {
    label: 'Verkaufspartner',
    href: '/admin/partners',
    icon: 'partners',
    description: 'Backschrank & Lieferpartner',
  },
  {
    label: 'Kasse',
    href: '/admin/cash',
    icon: 'cash',
    description: 'Kassenverwaltung',
  },
  {
    label: 'Personal',
    href: '/admin/staff',
    icon: 'staff',
    description: 'Mitarbeiterverwaltung',
  },
  {
    label: 'Kassenberichte',
    href: '/admin/reports',
    icon: 'reports',
    description: 'Kassenberichte aus dem HQ-Archiv',
  },
  {
    label: 'Analysen',
    href: '/admin/analytics',
    icon: 'analytics',
    description: 'Umsatz & Produkte',
  },
  {
    label: 'Finanzen',
    href: '/admin/finance',
    icon: 'finance',
    description: 'Kontobewegungen (nur Admin)',
  },
  {
    label: 'Tagesziel',
    href: '/admin/finance/tagesziel',
    icon: 'target',
    description: 'Break-even-Ampel (nur Admin)',
  },
  {
    label: 'Benachrichtigungen',
    href: '/admin/notifications',
    icon: 'notifications',
    description: 'Mitteilungen',
  },
  {
    label: 'Team-Chat',
    href: '/admin/chat',
    icon: 'chat',
    description: 'Interne Nachrichten',
  },
  {
    label: 'Social Media',
    href: '/admin/social-media',
    icon: 'socialmedia',
    description: 'Content Creator',
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
    description: 'Systemeinstellungen',
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
 * M1 entscheidet beim Freischalten von `/admin/preorders`, ob „Sammelstelle
 * Mörsbach" (/admin/delivery/preorders) darin aufgeht.
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
    description: 'Telefon, WhatsApp & Shop (M1)',
    ready: false,
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
  ).map(({ label, href, icon, description }) => ({
    label,
    href,
    icon,
    description,
  }))
  const [dashboard, ...rest] = MANAGEMENT_NAVIGATION
  const items = [dashboard, ...ready, ...rest]
  return pilot ? filterNavigationForPilot(items) : items
}
