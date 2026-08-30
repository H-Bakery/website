/**
 * Sidebar navigation model for the management app.
 * Kept outside layout.tsx so it can be imported by tests and other pages
 * (Next.js restricts the exports of layout/page files).
 */

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
    label: 'Berichte',
    href: '/admin/reports',
    icon: 'reports',
    description: 'Berichte & Zeitpläne',
  },
  {
    label: 'Analysen',
    href: '/admin/analytics',
    icon: 'analytics',
    description: 'Umsatz & Produkte',
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
    label: 'Einstellungen',
    href: '/admin/settings',
    icon: 'settings',
    description: 'Systemeinstellungen',
  },
  {
    label: 'Shop',
    href: SHOP_URL,
    icon: 'shop',
    description: 'Zum Online-Shop',
    external: true,
  },
]
