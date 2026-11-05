import {
  PILOT_ROLES,
  ROLE_ACCESS,
  getNavigationForRole,
  isPathAllowedForRole,
  isPersonalOnlyPath,
  isProtectedPath,
  normalizeRole,
  resolvePostLoginPath,
  startPathForRole,
  type PilotRole,
} from './roles'
import type { NavItem } from '../app/admin/navigation'

function hrefs(items: NavItem[]): string[] {
  return items.flatMap((item) =>
    item.submenu ? hrefs(item.submenu) : item.href ? [item.href] : []
  )
}

describe('ROLE_ACCESS - die eine Rollen-Tabelle', () => {
  it('kennt genau die vier Pilot-Rollen', () => {
    expect(Object.keys(ROLE_ACCESS).sort()).toEqual([...PILOT_ROLES].sort())
  })

  it('Startseiten jeder Rolle sind für die Rolle selbst erlaubt', () => {
    PILOT_ROLES.forEach((role) => {
      ROLE_ACCESS[role].start.forEach((href) =>
        expect(isPathAllowedForRole(href, role)).toBe(true)
      )
    })
  })

  it.each<[PilotRole, string, boolean]>([
    ['inhaber', '/admin/finance/tagesziel', true],
    ['inhaber', '/admin/users', true],
    ['verkauf', '/admin/preorders/abholliste', true],
    ['verkauf', '/admin/delivery/preorders/new', true],
    ['verkauf', '/admin/products', true],
    ['verkauf', '/admin/products/new', false],
    ['verkauf', '/admin/products/roggenbrot', false],
    ['verkauf', '/admin/partners/1/visit/new', true],
    ['verkauf', '/admin/finance', false],
    ['verkauf', '/admin/users', false],
    ['verkauf', '/admin/settings', true],
    ['backstube', '/admin/backzettel/2026-11-24', true],
    ['verkauf', '/admin/backzettel', true],
    ['verkauf', '/admin/backzettel/2026-11-28', true],
    ['fahrer', '/admin/backzettel', false],
    ['backstube', '/backstube', true],
    ['backstube', '/admin/preorders', false],
    ['backstube', '/admin/reports', false],
    ['fahrer', '/admin/delivery/preorders/backliste', true],
    ['fahrer', '/admin', false],
    ['fahrer', '/admin/delivery', false],
    ['fahrer', '/admin/products', false],
  ])('%s → %s: %s', (role, path, allowed) => {
    expect(isPathAllowedForRole(path, role)).toBe(allowed)
  })

  it('die Anmeldung darf jede Rolle und auch niemand', () => {
    expect(isPathAllowedForRole('/admin/login', 'fahrer')).toBe(true)
    expect(isPathAllowedForRole('/admin/login', null)).toBe(true)
    expect(isPathAllowedForRole('/admin', null)).toBe(false)
  })
})

describe('Startseite nach der Anmeldung', () => {
  it('nimmt die erste gebaute Startseite', () => {
    const none = () => false
    const all = () => true
    expect(startPathForRole('inhaber')).toBe('/admin')
    expect(startPathForRole('fahrer')).toBe('/admin/delivery/preorders')
    expect(startPathForRole('verkauf', all)).toBe('/admin/preorders')
    expect(startPathForRole('backstube', all)).toBe('/backstube')
    // solange es /admin/preorders und /backstube nicht gibt: Dashboard
    expect(startPathForRole('verkauf', (h) => h === '/admin')).toBe('/admin')
    expect(startPathForRole('backstube', (h) => h === '/admin')).toBe('/admin')
    // nichts gebaut: die erste Vorliebe
    expect(startPathForRole('verkauf', none)).toBe('/admin/preorders')
  })

  it('folgt ?next=, wenn die Rolle die Seite öffnen darf', () => {
    expect(resolvePostLoginPath('inhaber', '/admin/finance')).toBe(
      '/admin/finance'
    )
    expect(resolvePostLoginPath('fahrer', '/admin/finance')).toBe(
      '/admin/delivery/preorders'
    )
    expect(resolvePostLoginPath('inhaber', '//evil.example')).toBe('/admin')
    expect(resolvePostLoginPath('inhaber', '/admin/login')).toBe('/admin')
    expect(resolvePostLoginPath('inhaber', null)).toBe('/admin')
    // Station einrichten: nach der Anmeldung zurück zu /station
    expect(resolvePostLoginPath('inhaber', '/station')).toBe('/station')
    expect(resolvePostLoginPath('inhaber', '/stationen')).toBe('/admin')
  })
})

describe('isProtectedPath', () => {
  it('schützt /admin und /backstube, nicht die Anmeldung und die Station', () => {
    expect(isProtectedPath('/admin')).toBe(true)
    expect(isProtectedPath('/admin/users?x=1')).toBe(true)
    expect(isProtectedPath('/backstube')).toBe(true)
    expect(isProtectedPath('/admin/login')).toBe(false)
    expect(isProtectedPath('/station')).toBe(false)
    expect(isProtectedPath('/administrator')).toBe(false)
  })
})

describe('normalizeRole', () => {
  it('nimmt Pilot-Rollen und übersetzt die Mock-Rollen', () => {
    expect(normalizeRole('Backstube')).toBe('backstube')
    expect(normalizeRole('admin')).toBe('inhaber')
    expect(normalizeRole('staff')).toBe('verkauf')
    expect(normalizeRole('customer')).toBeNull()
    expect(normalizeRole(42)).toBeNull()
  })
})

describe('getNavigationForRole', () => {
  it('Inhaber sieht alles außer dem Anmelde-Eintrag, inkl. Benutzer', () => {
    const items = hrefs(getNavigationForRole('inhaber', false))
    expect(items).toContain('/admin/users')
    expect(items).toContain('/admin/finance')
    expect(items).not.toContain('/admin/login')
  })

  it('Verkauf: Vorbestellungen/Mörsbach, Produkte, Backschrank, Backzettel (lesen), Einstellungen', () => {
    expect(hrefs(getNavigationForRole('verkauf', true)).sort()).toEqual(
      [
        '/admin',
        '/admin/backzettel',
        '/admin/delivery/preorders',
        '/admin/products',
        '/admin/partners',
        '/admin/settings',
      ].sort()
    )
  })

  it('Fahrer: nur die Sammelstelle Mörsbach und Einstellungen', () => {
    expect(hrefs(getNavigationForRole('fahrer', true))).toEqual([
      '/admin/delivery/preorders',
      '/admin/settings',
    ])
  })

  it('Backstube (vor Z6): Dashboard, Backzettel und Einstellungen', () => {
    expect(hrefs(getNavigationForRole('backstube', true))).toEqual([
      '/admin',
      '/admin/backzettel',
      '/admin/settings',
    ])
  })

  it('außerhalb des Pilotbetriebs bekommt nur der Inhaber den Shop-Link', () => {
    const external = (role: PilotRole) =>
      getNavigationForRole(role, false).some((item) => item.external)
    expect(external('inhaber')).toBe(true)
    expect(external('verkauf')).toBe(false)
  })

  it('Pilotbetrieb und Rolle überlagern sich: gesperrte Seiten fehlen auch dem Inhaber', () => {
    const items = hrefs(getNavigationForRole('inhaber', true))
    expect(items).not.toContain('/admin/cash')
    expect(items).toContain('/admin/users')
  })
})

describe('Station (PIN-Sitzung)', () => {
  it('sperrt die Benutzerverwaltung auch für den Inhaber', () => {
    expect(isPathAllowedForRole('/admin/users', 'inhaber', 'station')).toBe(
      false
    )
    expect(isPathAllowedForRole('/admin/users', 'inhaber', 'personal')).toBe(
      true
    )
    expect(isPathAllowedForRole('/admin/users', 'inhaber')).toBe(true)
    expect(isPersonalOnlyPath('/admin/users/3')).toBe(true)
    expect(isPathAllowedForRole('/admin/reports', 'inhaber', 'station')).toBe(
      true
    )
  })

  it('blendet „Benutzer" an der Station aus der Navigation aus', () => {
    const navHrefs = (kind: 'personal' | 'station' | null) =>
      hrefs(getNavigationForRole('inhaber', true, kind))
    expect(navHrefs('personal')).toContain('/admin/users')
    expect(navHrefs('station')).not.toContain('/admin/users')
  })
})
