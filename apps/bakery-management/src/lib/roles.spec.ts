import {
  PILOT_ROLES,
  RECIPE_WRITE_PATHS,
  ROLE_ACCESS,
  ROLE_INCLUDES,
  ROLE_LABELS,
  canWriteRecipes,
  getNavigationForRole,
  hasBackstubeRights,
  isPathAllowedForRole,
  isPersonalOnlyPath,
  isProtectedPath,
  normalizeRole,
  resolvePostLoginPath,
  roleIncludes,
  startPathForRole,
  type PilotRole,
} from './roles'

// Die Rollen-Tabelle der API - `ROLE_INCLUDES` muss hier dasselbe sagen.
// eslint-disable-next-line @typescript-eslint/no-var-requires, @nx/enforce-module-boundaries
const authCore =
  require('../../../bakery-api/src/services/auth-crypto.core') as {
    ROLE_INCLUDES: Record<string, readonly string[]>
    ROLES: readonly string[]
    roleAllows: (role: string, allowed: string[]) => boolean
  }
import type { NavItem } from '../app/admin/navigation'

function hrefs(items: NavItem[]): string[] {
  return items.flatMap((item) =>
    item.submenu ? hrefs(item.submenu) : item.href ? [item.href] : []
  )
}

describe('ROLE_ACCESS - die eine Rollen-Tabelle', () => {
  it('kennt genau die fünf Pilot-Rollen', () => {
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
    ['inhaber', '/admin/finance/jahr', true],
    ['inhaber', '/admin/finance/monat/2026-01', true],
    ['verkauf', '/admin/finance/jahr', false],
    ['backstube', '/admin/finance/monat', false],
    ['inhaber', '/admin/users', true],
    ['verkauf', '/admin/preorders/abholliste', true],
    ['verkauf', '/admin/delivery/preorders/new', true],
    ['verkauf', '/admin/products', true],
    ['verkauf', '/admin/products/new', false],
    ['verkauf', '/admin/products/roggenbrot', false],
    ['verkauf', '/admin/products/preisliste', true],
    ['backstube', '/admin/products/preisliste', false],
    ['verkauf', '/admin/partners/1/visit/new', true],
    ['verkauf', '/admin/finance', false],
    ['verkauf', '/admin/users', false],
    ['verkauf', '/admin/settings', true],
    ['backstube', '/admin/backzettel/2026-11-24', true],
    ['verkauf', '/admin/backzettel', true],
    ['verkauf', '/admin/backzettel/2026-11-28', true],
    ['verkauf', '/admin/backzettel/grundmengen', false],
    ['verkauf', '/admin/backzettel/grundmengen/brot', false],
    ['verkauf', '/admin/backzettel/grundmengenx', true],
    ['backstube', '/admin/backzettel/grundmengen', true],
    // Z10: Backliste eines Backtags - wer den Zettel lesen darf
    ['backstube', '/admin/backzettel/2026-11-29/backen', true],
    ['verkauf', '/admin/backzettel/2026-11-29/backen', true],
    ['fahrer', '/admin/backzettel/2026-11-29/backen', false],
    ['fahrer', '/admin/backzettel', false],
    ['backstube', '/backstube', true],
    // M4 Rest am Abend: Verkauf zählt, Backstube liest, Auswertung nur Inhaber
    ['verkauf', '/admin/rest', true],
    ['verkauf', '/admin/rest/auswertung', false],
    ['backstube', '/admin/rest', true],
    ['backstube', '/admin/rest/auswertung', false],
    ['fahrer', '/admin/rest', false],
    // Rechnungen (ZUGFeRD): nur Inhaber
    ['inhaber', '/admin/rechnungen', true],
    ['inhaber', '/admin/rechnungen/12', true],
    ['verkauf', '/admin/rechnungen', false],
    ['verkauf', '/admin/rechnungen/12', false],
    ['backstube', '/admin/rechnungen', false],
    ['fahrer', '/admin/rechnungen/12', false],
    // TASK-042 Dienstplan: nur Inhaber
    ['inhaber', '/admin/dienstplan', true],
    ['inhaber', '/admin/dienstplan/mitarbeiter/3', true],
    ['verkauf', '/admin/dienstplan', false],
    ['verkauf', '/admin/dienstplan/mitarbeiter', false],
    ['backstube', '/admin/dienstplan/mitarbeiter/3', false],
    ['fahrer', '/admin/dienstplan', false],
    ['inhaber', '/admin/rest/auswertung', true],
    ['backstube', '/admin/preorders', false],
    ['backstube', '/admin/reports', false],
    ['fahrer', '/admin/delivery/preorders/backliste', true],
    ['fahrer', '/admin/delivery/preorders/7', true],
    // P2: Fahrer erfassen nicht und ändern keine Lieferstelle (API: 403)
    ['fahrer', '/admin/delivery/preorders/new', false],
    ['fahrer', '/admin/delivery/preorders/lieferstelle', false],
    ['fahrer', '/admin', false],
    ['fahrer', '/admin/delivery', false],
    ['fahrer', '/admin/products', false],
    // P1/P3: Fahrer lesen Vorbestellungen, erfassen aber keine
    ['fahrer', '/admin/preorders', true],
    ['fahrer', '/admin/preorders/12', true],
    ['fahrer', '/admin/preorders/tag', true],
    ['fahrer', '/admin/preorders/abholliste', true],
    ['fahrer', '/admin/preorders/neu', false],
    ['fahrer', '/admin/preorders/neu/x', false],
    ['fahrer', '/admin/preordersx', false],
    ['verkauf', '/admin/preorders/neu', true],
    ['verkauf', '/admin/preorders/7', true],
    ['backstube', '/admin/preorders/tag', false],
    // Rezepte: lesen Inhaber, Backstubenleitung und Backstube; anlegen und
    // ändern nur Inhaber und Backstubenleitung
    ['inhaber', '/admin/rezepte', true],
    ['inhaber', '/admin/rezepte/neu', true],
    ['inhaber', '/admin/rezepte/bearbeiten/breads/musterkruste', true],
    ['backstubenleiter', '/admin/rezepte', true],
    ['backstubenleiter', '/admin/rezepte/breads/musterkruste', true],
    ['backstubenleiter', '/admin/rezepte/neu', true],
    ['backstubenleiter', '/admin/rezepte/bearbeiten/breads/musterkruste', true],
    ['backstube', '/admin/rezepte', true],
    ['backstube', '/admin/rezepte/breads/musterkruste', true],
    ['backstube', '/admin/rezepte/neu', false],
    ['backstube', '/admin/rezepte/bearbeiten', false],
    ['backstube', '/admin/rezepte/bearbeiten/breads/musterkruste', false],
    ['backstube', '/admin/rezeptex', false],
    ['verkauf', '/admin/rezepte', false],
    ['verkauf', '/admin/rezepte/breads/musterkruste', false],
    ['fahrer', '/admin/rezepte', false],
    // Backstubenleitung: alles, was die Backstube darf - und nicht mehr
    ['backstubenleiter', '/admin', true],
    ['backstubenleiter', '/backstube', true],
    ['backstubenleiter', '/admin/backzettel/2026-11-24', true],
    ['backstubenleiter', '/admin/backzettel/grundmengen', true],
    ['backstubenleiter', '/admin/backzettel/2026-11-29/backen', true],
    ['backstubenleiter', '/admin/rest', true],
    ['backstubenleiter', '/admin/rest/auswertung', false],
    ['backstubenleiter', '/admin/settings', true],
    ['backstubenleiter', '/admin/hilfe', true],
    ['backstubenleiter', '/admin/preorders', false],
    ['backstubenleiter', '/admin/products', false],
    ['backstubenleiter', '/admin/reports', false],
    ['backstubenleiter', '/admin/finance', false],
    ['backstubenleiter', '/admin/users', false],
    ['backstubenleiter', '/admin/dienstplan', false],
  ])('%s → %s: %s', (role, path, allowed) => {
    expect(isPathAllowedForRole(path, role)).toBe(allowed)
  })

  it('die Anmeldung darf jede Rolle und auch niemand', () => {
    expect(isPathAllowedForRole('/admin/login', 'fahrer')).toBe(true)
    expect(isPathAllowedForRole('/admin/login', null)).toBe(true)
    expect(isPathAllowedForRole('/admin', null)).toBe(false)
  })
})

describe('Backstubenleitung (backstubenleiter) = Backstube plus Rezepte', () => {
  it('trägt das Etikett „Backstubenleitung“', () => {
    expect(ROLE_LABELS.backstubenleiter).toBe('Backstubenleitung')
    expect(normalizeRole('backstubenleiter')).toBe('backstubenleiter')
    expect(normalizeRole(' Backstubenleiter ')).toBe('backstubenleiter')
  })

  it('schließt dieselben Rollen ein wie die API (ROLE_INCLUDES)', () => {
    expect(ROLE_INCLUDES).toEqual(authCore.ROLE_INCLUDES)
    // Verwaltung und API kennen dieselben Rollen
    expect([...PILOT_ROLES].sort()).toEqual([...authCore.ROLES].sort())
    for (const role of PILOT_ROLES) {
      for (const base of PILOT_ROLES) {
        if (role === 'inhaber') continue
        expect(roleIncludes(role, base)).toBe(authCore.roleAllows(role, [base]))
      }
    }
  })

  it('darf jede Seite, die die Backstube darf', () => {
    const backstube = ROLE_ACCESS.backstube.routes
    if (backstube === 'all') throw new Error('unerwartet')
    const paths = [
      ...backstube.map((rule) => (typeof rule === 'string' ? rule : rule.path)),
      '/admin/rezepte/breads/musterkruste',
      '/admin/backzettel/grundmengen',
      '/admin/backzettel/2026-11-24',
      '/backstube',
    ]
    for (const path of paths) {
      expect(isPathAllowedForRole(path, 'backstube')).toBe(true)
      expect(isPathAllowedForRole(path, 'backstubenleiter')).toBe(true)
    }
    expect(ROLE_ACCESS.backstubenleiter.start).toEqual(
      ROLE_ACCESS.backstube.start
    )
    expect(startPathForRole('backstubenleiter')).toBe('/backstube')
  })

  it('der einzige Unterschied zur Backstube sind die Rezept-Formulare', () => {
    for (const path of RECIPE_WRITE_PATHS) {
      expect(isPathAllowedForRole(path, 'backstubenleiter')).toBe(true)
      expect(isPathAllowedForRole(path, 'backstube')).toBe(false)
    }
    expect(hrefs(getNavigationForRole('backstubenleiter', true))).toEqual(
      hrefs(getNavigationForRole('backstube', true))
    )
  })

  it('hasBackstubeRights und canWriteRecipes je Rolle', () => {
    const rights = (check: (role: string | null) => boolean) =>
      PILOT_ROLES.filter((role) => check(role))
    expect(rights(hasBackstubeRights)).toEqual([
      'inhaber',
      'backstube',
      'backstubenleiter',
    ])
    expect(rights(canWriteRecipes)).toEqual(['inhaber', 'backstubenleiter'])
    expect(hasBackstubeRights(null)).toBe(false)
    expect(canWriteRecipes(undefined)).toBe(false)
    expect(roleIncludes('backstubenleiter', 'backstube')).toBe(true)
    expect(roleIncludes('backstube', 'backstubenleiter')).toBe(false)
    expect(roleIncludes('inhaber', 'backstube')).toBe(false)
  })

  it('Rezepte im Menü: für die Backstube „Nachschlagen und drucken“', () => {
    const entry = (role: PilotRole) =>
      getNavigationForRole(role, true).find(
        (item) => item.href === '/admin/rezepte'
      )
    expect(entry('inhaber')?.description).toBe('Nachschlagen, anlegen, ändern')
    expect(entry('backstubenleiter')?.description).toBe(
      'Nachschlagen, anlegen, ändern'
    )
    expect(entry('backstube')?.description).toBe('Nachschlagen und drucken')
    expect(entry('verkauf')).toBeUndefined()
    expect(entry('fahrer')).toBeUndefined()
  })

  it('an der Station (PIN) bleiben die Rezepte erreichbar', () => {
    expect(isPersonalOnlyPath('/admin/rezepte')).toBe(false)
    expect(
      isPathAllowedForRole('/admin/rezepte/neu', 'backstubenleiter', 'station')
    ).toBe(true)
    expect(isPathAllowedForRole('/admin/rezepte', 'backstube', 'station')).toBe(
      true
    )
  })
})

describe('Startseite nach der Anmeldung', () => {
  it('nimmt die erste gebaute Startseite', () => {
    const none = () => false
    const all = () => true
    expect(startPathForRole('inhaber')).toBe('/admin')
    // P2: Fahrer starten in der Abholliste (die Seite ist gebaut)
    expect(startPathForRole('fahrer')).toBe('/admin/preorders/abholliste')
    expect(
      startPathForRole('fahrer', (h) => h !== '/admin/preorders/abholliste')
    ).toBe('/admin/delivery/preorders')
    // Z6: das Tablet ist gebaut - die Backstube startet dort
    expect(startPathForRole('backstube')).toBe('/backstube')
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
      '/admin/preorders/abholliste'
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

  it('Verkauf: Vorbestellungen/Mörsbach, Produkte, Backschrank, Backzettel (lesen), Einstellungen, Hilfe', () => {
    expect(hrefs(getNavigationForRole('verkauf', true)).sort()).toEqual(
      [
        '/admin',
        '/admin/preorders',
        '/admin/preorders/abholliste',
        '/admin/backzettel',
        '/admin/delivery/preorders',
        '/admin/rest',
        '/admin/products',
        '/admin/partners',
        '/admin/settings',
        '/admin/hilfe',
      ].sort()
    )
  })

  it('Fahrer: Vorbestellungen (lesen), Sammelstelle Mörsbach, Einstellungen, Hilfe', () => {
    expect(hrefs(getNavigationForRole('fahrer', true))).toEqual([
      '/admin/preorders',
      '/admin/preorders/abholliste',
      '/admin/delivery/preorders',
      '/admin/settings',
      '/admin/hilfe',
    ])
  })

  it('Backstube: Dashboard, Backzettel, Tablet, Rezepte, Rest am Abend, Einstellungen und Hilfe', () => {
    expect(hrefs(getNavigationForRole('backstube', true))).toEqual([
      '/admin',
      '/admin/backzettel',
      '/backstube',
      '/admin/rezepte',
      '/admin/rest',
      '/admin/settings',
      '/admin/hilfe',
    ])
  })

  it('Rest am Abend (M4) steht mit und ohne Pilotbetrieb im Menü (Entscheidung 2026-11-08)', () => {
    expect(hrefs(getNavigationForRole('verkauf', false))).toContain(
      '/admin/rest'
    )
    expect(hrefs(getNavigationForRole('verkauf', false))).not.toContain(
      '/admin/rest/auswertung'
    )
    expect(hrefs(getNavigationForRole('backstube', false))).toContain(
      '/admin/rest'
    )
    expect(hrefs(getNavigationForRole('inhaber', false))).toEqual(
      expect.arrayContaining(['/admin/rest', '/admin/rest/auswertung'])
    )
    for (const role of ['inhaber', 'verkauf', 'backstube'] as PilotRole[]) {
      expect(hrefs(getNavigationForRole(role, true))).toContain('/admin/rest')
    }
    expect(hrefs(getNavigationForRole('inhaber', true))).toContain(
      '/admin/rest/auswertung'
    )
    for (const role of ['verkauf', 'backstube', 'fahrer'] as PilotRole[]) {
      expect(hrefs(getNavigationForRole(role, true))).not.toContain(
        '/admin/rest/auswertung'
      )
    }
    expect(hrefs(getNavigationForRole('fahrer', true))).not.toContain(
      '/admin/rest'
    )
  })

  it('außerhalb des Pilotbetriebs bekommt nur der Inhaber den Shop-Link', () => {
    const external = (role: PilotRole) =>
      getNavigationForRole(role, false).some((item) => item.external)
    expect(external('inhaber')).toBe(true)
    expect(external('verkauf')).toBe(false)
  })

  it('Dienstplan im Pilotbetrieb: nur der Inhaber sieht ihn (Entscheidung 2026-11-08)', () => {
    expect(hrefs(getNavigationForRole('inhaber', true))).toContain(
      '/admin/dienstplan'
    )
    expect(hrefs(getNavigationForRole('inhaber', true, 'personal'))).toContain(
      '/admin/dienstplan'
    )
    for (const role of ['verkauf', 'backstube', 'fahrer'] as PilotRole[]) {
      expect(hrefs(getNavigationForRole(role, true))).not.toContain(
        '/admin/dienstplan'
      )
      expect(isPathAllowedForRole('/admin/dienstplan', role)).toBe(false)
    }
  })

  it('Rechnungen: im Pilotbetrieb und außerhalb nur im Menü des Inhabers', () => {
    for (const pilot of [true, false]) {
      expect(hrefs(getNavigationForRole('inhaber', pilot))).toContain(
        '/admin/rechnungen'
      )
      for (const role of [
        'verkauf',
        'backstube',
        'backstubenleiter',
        'fahrer',
      ] as PilotRole[]) {
        expect(hrefs(getNavigationForRole(role, pilot))).not.toContain(
          '/admin/rechnungen'
        )
        expect(isPathAllowedForRole('/admin/rechnungen', role)).toBe(false)
      }
    }
  })

  it('Rechnungen: an einer PIN-Station auch für den Inhaber gesperrt', () => {
    expect(isPersonalOnlyPath('/admin/rechnungen')).toBe(true)
    expect(isPersonalOnlyPath('/admin/rechnungen/12')).toBe(true)
    expect(
      isPathAllowedForRole('/admin/rechnungen/12', 'inhaber', 'station')
    ).toBe(false)
    expect(
      isPathAllowedForRole('/admin/rechnungen/12', 'inhaber', 'personal')
    ).toBe(true)
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

  it('blendet „Benutzer“ an der Station aus der Navigation aus', () => {
    const navHrefs = (kind: 'personal' | 'station' | null) =>
      hrefs(getNavigationForRole('inhaber', true, kind))
    expect(navHrefs('personal')).toContain('/admin/users')
    expect(navHrefs('station')).not.toContain('/admin/users')
  })

  it('Dienstplan und Mitarbeiterprofile wie die API nur mit persönlicher Sitzung (TASK-042)', () => {
    for (const path of [
      '/admin/dienstplan',
      '/admin/dienstplan/mitarbeiter',
      '/admin/dienstplan/mitarbeiter/3',
    ]) {
      expect(isPersonalOnlyPath(path)).toBe(true)
      expect(isPathAllowedForRole(path, 'inhaber', 'station')).toBe(false)
      expect(isPathAllowedForRole(path, 'inhaber', 'personal')).toBe(true)
    }
    expect(isPersonalOnlyPath('/admin/dienstplanx')).toBe(false)
    expect(hrefs(getNavigationForRole('inhaber', false, 'personal'))).toContain(
      '/admin/dienstplan'
    )
    expect(
      hrefs(getNavigationForRole('inhaber', false, 'station'))
    ).not.toContain('/admin/dienstplan')
    // Auch im Pilotbetrieb (dort für den Inhaber freigegeben) nicht an der Station.
    expect(
      hrefs(getNavigationForRole('inhaber', true, 'station'))
    ).not.toContain('/admin/dienstplan')
  })

  it('Finanzen und Tagesziel wie die API nur mit persönlicher Sitzung (W4-verify r2)', () => {
    for (const path of [
      '/admin/finance',
      '/admin/finance/tagesziel',
      '/admin/finance/jahr',
      '/admin/finance/monat/2026-01',
    ]) {
      expect(isPathAllowedForRole(path, 'inhaber', 'station')).toBe(false)
      expect(isPathAllowedForRole(path, 'inhaber', 'personal')).toBe(true)
    }
    const station = hrefs(getNavigationForRole('inhaber', true, 'station'))
    expect(station.some((h) => h.startsWith('/admin/finance'))).toBe(false)
    expect(
      hrefs(getNavigationForRole('inhaber', true, 'personal')).some((h) =>
        h.startsWith('/admin/finance')
      )
    ).toBe(true)
  })
})
