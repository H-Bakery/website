import fs from 'fs'
import path from 'path'
import {
  PILOT_ALLOWED_ROUTES,
  isPilotMode,
  isPilotPathAllowed,
  matchesRoute,
} from './pilotMode'
import {
  MANAGEMENT_NAVIGATION,
  PILOT_UPCOMING_NAVIGATION,
  filterNavigationForPilot,
  getNavigation,
  type NavItem,
} from '../app/admin/navigation'

/** Alle Routen einer Navigation, Untermenüs eingeschlossen. */
function hrefs(items: NavItem[]): string[] {
  return items
    .flatMap((item) => [item, ...(item.submenu ?? [])])
    .map((item) => item.href)
    .filter((href): href is string => Boolean(href))
}

// roadmap §3 „Management app, route by route"
const KEEP = [
  '/admin',
  '/admin/products',
  '/admin/products/new',
  '/admin/products/roggenbrot-beispiel',
  '/admin/delivery/preorders',
  '/admin/delivery/preorders/new',
  '/admin/delivery/preorders/backliste',
  '/admin/partners',
  '/admin/partners/1/visit/new',
  '/admin/reports',
  '/admin/reports/2026-01-02',
  '/admin/analytics',
  '/admin/analytics/revenue',
  '/admin/finance',
  '/admin/finance/tagesziel',
  '/admin/social-media',
  '/admin/settings',
  '/admin/hilfe',
  '/admin/login',
]
const HIDE = [
  '/admin/cash',
  '/admin/staff',
  '/admin/bakery/intern-orders',
  '/admin/unsold-products',
  '/admin/inventory',
  '/admin/production',
  '/admin/orders',
  '/admin/delivery',
  '/admin/notifications',
  '/admin/notifications/archive',
  '/admin/notifications/archival',
  '/admin/chat',
  '/admin/bakery/recipes',
  '/admin/bakery/processes',
  '/admin/automat',
]
const REPLACE = [
  '/admin/baking-list',
  '/admin/bakery/daily-prep',
  '/admin/bakery/saturday-production',
]
const UPCOMING = [
  '/admin/preorders',
  '/admin/preorders/abholliste',
  '/admin/backzettel',
  '/backstube',
]

describe('isPilotMode', () => {
  const original = process.env.NEXT_PUBLIC_PILOT_MODE
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_PILOT_MODE
    else process.env.NEXT_PUBLIC_PILOT_MODE = original
  })

  it('ist ohne Variable aus (Entwicklung)', () => {
    delete process.env.NEXT_PUBLIC_PILOT_MODE
    expect(isPilotMode()).toBe(false)
  })

  it('liest die Variable bei jedem Aufruf', () => {
    process.env.NEXT_PUBLIC_PILOT_MODE = '1'
    expect(isPilotMode()).toBe(true)
    process.env.NEXT_PUBLIC_PILOT_MODE = '0'
    expect(isPilotMode()).toBe(false)
  })

  it.each(['1', 'true', 'TRUE', ' on ', 'ja'])('versteht %p als an', (v) => {
    expect(isPilotMode(v)).toBe(true)
  })

  it.each(['', '0', 'false', 'off', 'nein', 'pilot'])(
    'versteht %p als aus',
    (v) => {
      expect(isPilotMode(v)).toBe(false)
    }
  )
})

describe('isPilotPathAllowed', () => {
  it('erlaubt ohne Pilotbetrieb alles', () => {
    ;[...KEEP, ...HIDE, ...REPLACE].forEach((route) => {
      expect(isPilotPathAllowed(route, false)).toBe(true)
    })
  })

  it.each(KEEP)('lässt die echte Seite %s offen', (route) => {
    expect(isPilotPathAllowed(route, true)).toBe(true)
  })

  it.each(HIDE)('sperrt die Demo-Seite %s', (route) => {
    expect(isPilotPathAllowed(route, true)).toBe(false)
  })

  it.each(REPLACE)('sperrt die alte Backliste %s', (route) => {
    expect(isPilotPathAllowed(route, true)).toBe(false)
  })

  it.each(UPCOMING)('hält die kommende Route %s frei', (route) => {
    expect(isPilotPathAllowed(route, true)).toBe(true)
  })

  it('lässt das Dashboard nur exakt zu, nicht jede /admin-Unterseite', () => {
    expect(matchesRoute('/admin')).toBe(true)
    expect(matchesRoute('/admin/')).toBe(true)
    expect(matchesRoute('/admin/cash')).toBe(false)
  })

  it('verwechselt keine Präfixe ohne Schrägstrich', () => {
    expect(isPilotPathAllowed('/admin/productsx', true)).toBe(false)
    expect(isPilotPathAllowed('/admin/delivery/preordersx', true)).toBe(false)
    expect(isPilotPathAllowed('/admin/financial', true)).toBe(false)
  })

  it('ignoriert Query, Hash und abschließenden Schrägstrich', () => {
    expect(isPilotPathAllowed('/admin/products/?q=1', true)).toBe(true)
    expect(isPilotPathAllowed('/admin/cash/#x', true)).toBe(false)
  })

  it('prüft nur den /admin-Bereich (Weiterleitungen bleiben offen)', () => {
    expect(isPilotPathAllowed('/', true)).toBe(true)
    expect(isPilotPathAllowed('/reports', true)).toBe(true)
    expect(isPilotPathAllowed('/analytics', true)).toBe(true)
    expect(isPilotPathAllowed('/administration', true)).toBe(true)
  })

  it('führt jede erlaubte Route genau einmal', () => {
    expect(new Set(PILOT_ALLOWED_ROUTES).size).toBe(PILOT_ALLOWED_ROUTES.length)
  })
})

describe('Pilot-Navigation', () => {
  const pilotHrefs = hrefs(getNavigation(true))

  it('zeigt im Pilotbetrieb nur erlaubte Routen', () => {
    pilotHrefs.forEach((href) => {
      expect(isPilotPathAllowed(href, true)).toBe(true)
    })
  })

  it('behält alle „Keep"-Einträge der Navigation', () => {
    expect(pilotHrefs).toEqual(
      expect.arrayContaining([
        '/admin',
        '/admin/products',
        '/admin/delivery/preorders',
        '/admin/partners',
        '/admin/reports',
        '/admin/analytics',
        '/admin/finance',
        '/admin/finance/tagesziel',
        '/admin/social-media',
        '/admin/settings',
        '/admin/hilfe',
        '/admin/login',
      ])
    )
  })

  it('entfernt Demo-Seiten, alte Backlisten und den Shop-Link', () => {
    ;[...HIDE, ...REPLACE].forEach((route) => {
      expect(pilotHrefs).not.toContain(route)
    })
    expect(getNavigation(true).some((item) => item.external)).toBe(false)
  })

  it('lässt kein leeres Untermenü stehen', () => {
    const labels = getNavigation(true).map((item) => item.label)
    expect(labels).not.toContain('Bäckerei')
    getNavigation(true).forEach((item) => {
      if (item.submenu) expect(item.submenu.length).toBeGreaterThan(0)
    })
  })

  it('filtert Untermenüs, statt sie ganz zu verwerfen', () => {
    const filtered = filterNavigationForPilot([
      {
        label: 'Gruppe',
        description: 'Test',
        submenu: [
          { label: 'Erlaubt', href: '/admin/reports', description: 'x' },
          { label: 'Gesperrt', href: '/admin/cash', description: 'x' },
        ],
      },
    ])
    expect(filtered).toHaveLength(1)
    expect(filtered[0].submenu?.map((s) => s.href)).toEqual(['/admin/reports'])
  })

  it('lässt die Navigation ohne Pilotbetrieb unverändert (bis auf fertige Pilot-Seiten)', () => {
    const ready = PILOT_UPCOMING_NAVIGATION.filter((i) => i.ready).map(
      (i) => i.href
    )
    expect(hrefs(getNavigation(false))).toEqual([
      '/admin',
      ...ready,
      ...hrefs(MANAGEMENT_NAVIGATION).slice(1),
    ])
  })
})

describe('kommende Pilot-Bildschirme', () => {
  const appDir = path.resolve(__dirname, '../app')
  const pageExists = (href: string) =>
    fs.existsSync(path.join(appDir, href, 'page.tsx'))

  it('stehen alle in der Liste erlaubter Routen', () => {
    PILOT_UPCOMING_NAVIGATION.forEach((item) => {
      expect(PILOT_ALLOWED_ROUTES).toContain(item.href)
    })
    expect(PILOT_UPCOMING_NAVIGATION.map((i) => i.href)).toEqual(UPCOMING)
  })

  it.each(PILOT_UPCOMING_NAVIGATION.map((i) => [i.href, i.ready] as const))(
    '%s: `ready` ist genau dann gesetzt, wenn die Seite existiert',
    (href, ready) => {
      // Schlägt fehl, sobald jemand die Seite baut, ohne den Eintrag in
      // PILOT_UPCOMING_NAVIGATION (admin/navigation.ts) freizuschalten.
      expect(ready).toBe(pageExists(href))
    }
  )

  it.each(PILOT_UPCOMING_NAVIGATION.map((i) => [i.href] as const))(
    '%s: wer Unterseiten baut, baut auch die Index-Seite',
    (href) => {
      // M2 plant /admin/backzettel/grundmengen und /admin/backzettel/[datum];
      // ohne admin/backzettel/page.tsx bliebe der Menüeintrag für immer aus
      // (oder führte, von Hand freigeschaltet, auf eine 404).
      const dir = path.join(appDir, href)
      if (fs.existsSync(dir)) expect(pageExists(href)).toBe(true)
    }
  )

  it('erscheinen nur, wenn sie fertig sind', () => {
    PILOT_UPCOMING_NAVIGATION.forEach((item) => {
      const shown = hrefs(getNavigation(true)).includes(item.href)
      expect(shown).toBe(item.ready)
    })
  })
})
