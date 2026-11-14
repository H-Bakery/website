import {
  ABSENCE_TYPES,
  ABSENCE_TYPE_LABELS,
  AREAS,
  AREA_LABELS,
  EMPLOYMENT_TYPES,
  createAbsence,
  createEmployee,
  deleteAbsence,
  employeeChanges,
  fetchBalance,
  fetchEmployeeProfile,
  filterEmployees,
  formatAbsenceRange,
  formatDateWithWeekday,
  formatDays,
  formatMinutes,
  formatOpenDays,
  fetchHoursOverview,
  formatCents,
  formatWage,
  groupByArea,
  minijobText,
  monthBasisText,
  parseDaysInput,
  parseHoursInput,
  parseWageInput,
  payFormula,
  payText,
  totalPayText,
  totalWageCostText,
  wageCostFormula,
  wageCostText,
  wageToInput,
  type HoursTotals,
  saveEntitlement,
  updateEmployee,
  type Employee,
} from './dienstplanApi'

jest.mock('@bakery/shared/data-access', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient } = require('@bakery/shared/data-access') as {
  apiClient: Record<'get' | 'post' | 'put' | 'patch' | 'delete', jest.Mock>
}

// Die Regeln selbst stehen nur in der API; hier wird nur verglichen, dass
// Listen und Beschriftungen nicht auseinanderlaufen.
// eslint-disable-next-line @typescript-eslint/no-var-requires, @nx/enforce-module-boundaries
const core = require('../../../bakery-api/src/services/vacation.core')

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 1,
    displayName: 'Erika Beispiel',
    area: 'verkauf',
    color: null,
    employmentType: 'teilzeit',
    weeklyHours: 20,
    hourlyWageCents: null,
    entryDate: null,
    exitDate: null,
    active: true,
    userId: null,
    note: null,
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-01T08:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  Object.values(apiClient).forEach((fn) => fn.mockReset())
})

describe('dienstplanApi - Aufrufe', () => {
  it('lädt das Profil mit Jahr', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: { year: 2027 } })
    await fetchEmployeeProfile(4, 2027)
    expect(apiClient.get).toHaveBeenCalledWith('/api/dienstplan/employees/4', {
      year: 2027,
    })
    await fetchEmployeeProfile(4)
    expect(apiClient.get).toHaveBeenLastCalledWith(
      '/api/dienstplan/employees/4',
      undefined
    )
  })

  it('legt an und ändert mit POST/PATCH', async () => {
    apiClient.post.mockResolvedValue({ success: true, data: employee() })
    apiClient.patch.mockResolvedValue({ success: true, data: employee() })
    await createEmployee({ displayName: 'Erika Beispiel', area: 'verkauf' })
    expect(apiClient.post).toHaveBeenCalledWith('/api/dienstplan/employees', {
      displayName: 'Erika Beispiel',
      area: 'verkauf',
    })
    await updateEmployee(1, { active: false })
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/api/dienstplan/employees/1',
      { active: false }
    )
  })

  it('speichert den Anspruch je Jahr, null = offen', async () => {
    apiClient.put.mockResolvedValue({ success: true, data: {} })
    await saveEntitlement(1, 2027, { entitlementDays: 24, carryoverDays: null })
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/dienstplan/employees/1/entitlements/2027',
      { entitlementDays: 24, carryoverDays: null }
    )
  })

  it('reicht Hinweise (warnings) der API weiter', async () => {
    apiClient.post.mockResolvedValue({
      success: true,
      data: { id: 9 },
      warnings: [
        { code: 'shift_overlap', message: 'Schichten am 01.12.2026.' },
        null,
      ],
    })
    const answer = await createAbsence({
      employeeId: 1,
      type: 'urlaub',
      startDate: '2026-12-01',
    })
    expect(answer.data).toEqual({ id: 9 })
    expect(answer.warnings).toEqual([
      { code: 'shift_overlap', message: 'Schichten am 01.12.2026.' },
    ])
    apiClient.post.mockResolvedValue({ success: true, data: { id: 10 } })
    expect((await createAbsence({ employeeId: 1 })).warnings).toEqual([])
  })

  it('löscht eine Abwesenheit und fragt ein Konto je Person ab', async () => {
    apiClient.delete.mockResolvedValue({ success: true, data: {} })
    await deleteAbsence(7)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/dienstplan/absences/7')
    apiClient.get.mockResolvedValue({ success: true, data: {} })
    await fetchBalance(3, 2026)
    expect(apiClient.get).toHaveBeenCalledWith('/api/dienstplan/balance', {
      employeeId: 3,
      year: 2026,
    })
  })

  it('wirft bei leerer Antwort eine deutsche Meldung', async () => {
    apiClient.get.mockResolvedValue({ success: true })
    await expect(fetchEmployeeProfile(1)).rejects.toThrow(
      'Leere Antwort vom Server.'
    )
  })
})

describe('dienstplanApi - gleiche Listen wie vacation.core.js', () => {
  it('Bereiche, Beschäftigungsarten und Abwesenheitsarten', () => {
    expect([...AREAS]).toEqual(core.AREAS)
    expect(AREA_LABELS).toEqual(core.AREA_LABELS)
    expect([...EMPLOYMENT_TYPES]).toEqual(core.EMPLOYMENT_TYPES)
    expect([...ABSENCE_TYPES]).toEqual(core.ABSENCE_TYPES)
    expect(ABSENCE_TYPE_LABELS).toEqual(core.ABSENCE_TYPE_LABELS)
  })
})

describe('dienstplanApi - Helfer', () => {
  const list = [
    employee({ id: 1, displayName: 'Max Muster', area: 'backstube' }),
    employee({ id: 2, displayName: 'Erika Beispiel', area: 'verkauf' }),
    employee({ id: 3, displayName: 'Anna Probe', area: 'verkauf' }),
    employee({ id: 4, displayName: 'Otto Test', area: 'buero', active: false }),
  ]

  it('gruppiert nach Bereich (Verkauf zuerst) und sortiert nach Name', () => {
    const groups = groupByArea(list)
    expect(groups.map((g) => g.label)).toEqual(['Verkauf', 'Backstube', 'Büro'])
    expect(groups[0].employees.map((e) => e.displayName)).toEqual([
      'Anna Probe',
      'Erika Beispiel',
    ])
  })

  it('filtert aktiv, ausgeschieden, alle', () => {
    expect(filterEmployees(list, 'aktiv').map((e) => e.id)).toEqual([1, 2, 3])
    expect(filterEmployees(list, 'ausgeschieden').map((e) => e.id)).toEqual([4])
    expect(filterEmployees(list, 'alle')).toHaveLength(4)
  })

  it('schickt nur geänderte Felder', () => {
    const e = employee()
    expect(
      employeeChanges(e, {
        displayName: 'Erika Beispiel',
        weeklyHours: 20,
        note: null,
      })
    ).toEqual({})
    expect(
      employeeChanges(e, { weeklyHours: 25, entryDate: '2026-01-01' })
    ).toEqual({ weeklyHours: 25, entryDate: '2026-01-01' })
  })

  it('formatiert Tage deutsch, null als „offen“', () => {
    expect(formatDays(1.5)).toBe('1,5')
    expect(formatDays(24)).toBe('24')
    expect(formatDays(null)).toBe('–')
    expect(formatOpenDays(null)).toBe('offen')
    expect(formatOpenDays(0)).toBe('0')
  })

  it('formatiert Datum, Zeitraum und Minuten', () => {
    expect(formatDateWithWeekday('2026-12-24')).toBe('Do, 24.12.2026')
    expect(
      formatAbsenceRange({
        startDate: '2026-12-21',
        endDate: '2026-12-23',
        halfDay: false,
      })
    ).toBe('21.12.2026 – 23.12.2026')
    expect(
      formatAbsenceRange({
        startDate: '2026-12-24',
        endDate: '2026-12-24',
        halfDay: true,
      })
    ).toBe('24.12.2026 (halber Tag)')
    expect(formatMinutes(330)).toBe('5:30 h')
  })

  it('liest Tage und Stunden; leer = null, Unsinn = NaN', () => {
    expect(parseDaysInput('')).toBeNull()
    expect(parseDaysInput('24')).toBe(24)
    expect(parseDaysInput('2,5')).toBe(2.5)
    expect(parseDaysInput('-1')).toBeNaN()
    expect(parseDaysInput('400')).toBeNaN()
    expect(parseDaysInput('abc')).toBeNaN()
    expect(parseHoursInput('38,5')).toBe(38.5)
    expect(parseHoursInput('61')).toBeNaN()
    expect(parseHoursInput(' ')).toBeNull()
  })
})

describe('Stundenlohn und geschätzte Überstundenbezahlung', () => {
  it('fetchHoursOverview fragt Woche oder Monat, optional mit Bereich', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: { rows: [] } })
    await fetchHoursOverview({ week: '2026-11-09' })
    expect(apiClient.get).toHaveBeenLastCalledWith('/api/dienstplan/hours', {
      week: '2026-11-09',
    })
    await fetchHoursOverview({ month: '2026-11' }, 'verkauf')
    expect(apiClient.get).toHaveBeenLastCalledWith('/api/dienstplan/hours', {
      month: '2026-11',
      area: 'verkauf',
    })
  })

  it('liest den Stundenlohn in Euro als Cent; leer = offen, Unsinn = NaN', () => {
    expect(parseWageInput('13,90')).toBe(1390)
    expect(parseWageInput(' 13.9 ')).toBe(1390)
    expect(parseWageInput('14')).toBe(1400)
    expect(parseWageInput('0,01')).toBe(1)
    expect(parseWageInput('999,99')).toBe(99999)
    expect(parseWageInput('12,50 €')).toBe(1250)
    expect(parseWageInput('')).toBeNull()
    for (const bad of ['0', '0,00', '1000', '13,999', '-5', 'abc', '13,9,0']) {
      expect(parseWageInput(bad)).toBeNaN()
    }
    expect(wageToInput(1390)).toBe('13,90')
    expect(wageToInput(1205)).toBe('12,05')
    expect(wageToInput(null)).toBe('')
    expect(parseWageInput(wageToInput(1205))).toBe(1205)
  })

  // Intl setzt ein geschütztes Leerzeichen vor das €.
  const plain = (text: string | null) => text?.replace(/\u00a0/g, ' ')

  it('formatiert Cent und Stundenlohn; ohne Lohn „offen“', () => {
    expect(plain(formatCents(3475))).toBe('34,75 €')
    expect(plain(formatWage(1390))).toBe('13,90 €/h')
    expect(formatWage(null)).toBe('offen')
  })

  it('Bezahlung als Text: geschätzt, Stundenlohn offen (nie 0 €), keine Überstunden, Soll offen', () => {
    const ok = {
      status: 'ok' as const,
      overtimeMinutes: 150,
      hourlyWageCents: 1390,
      amountCents: 3475,
    }
    expect(plain(payText(ok))).toBe('≈ 34,75 €')
    expect(plain(payFormula(ok))).toBe('2:30 h × 13,90 €/h')
    const noWage = {
      status: 'no-wage' as const,
      overtimeMinutes: 60,
      hourlyWageCents: null,
      amountCents: null,
    }
    expect(payText(noWage)).toBe('Stundenlohn offen')
    expect(payFormula(noWage)).toBeNull()
    expect(
      payText({
        status: 'no-overtime',
        overtimeMinutes: 0,
        hourlyWageCents: 1390,
        amountCents: 0,
      })
    ).toBe('keine Überstunden')
    expect(
      payText({
        status: 'no-target',
        overtimeMinutes: null,
        hourlyWageCents: null,
        amountCents: null,
      })
    ).toBe('Soll offen')
  })

  it('Summe: „mind.“, wenn Löhne fehlen; offen ohne Betrag; 0 € ohne Überstunden', () => {
    const totals = (extra: Partial<HoursTotals>): HoursTotals => ({
      plannedMinutes: 0,
      targetMinutes: 0,
      overtimeMinutes: 0,
      amountCents: 0,
      estimatedCount: 0,
      missingWageCount: 0,
      noTargetCount: 0,
      ...extra,
    })
    expect(plain(totalPayText(totals({ amountCents: 9530 })))).toBe('≈ 95,30 €')
    expect(
      plain(totalPayText(totals({ amountCents: 9530, missingWageCount: 2 })))
    ).toBe('mind. 95,30 €')
    expect(
      totalPayText(totals({ amountCents: null, missingWageCount: 1 }))
    ).toBe('offen')
    expect(plain(totalPayText(totals({})))).toBe('0,00 €')
  })

  it('Monat: bis heute, ganzer Monat oder geplant; künftig noch keine Überstunden', () => {
    expect(monthBasisText({ phase: 'current', asOf: '2026-11-14' })).toBe(
      'bis heute (14.11.)'
    )
    expect(monthBasisText({ phase: 'past', asOf: null })).toBe('ganzer Monat')
    expect(monthBasisText({ phase: 'future', asOf: null })).toBe('geplant')
    expect(
      payText({
        status: 'future',
        overtimeMinutes: null,
        hourlyWageCents: 1390,
        amountCents: null,
      })
    ).toBe('Monat noch nicht begonnen')
  })

  it('Lohnkosten: Plan × Lohn mit Rechenweg; ohne Lohn offen (nie 0 €); Summe „mind.“', () => {
    const ok = {
      status: 'ok' as const,
      plannedMinutes: 720,
      hourlyWageCents: 1390,
      amountCents: 16680,
    }
    expect(plain(wageCostText(ok))).toBe('≈ 166,80 €')
    expect(plain(wageCostFormula(ok))).toBe('12:00 h × 13,90 €/h')
    const open = {
      status: 'no-wage' as const,
      plannedMinutes: 720,
      hourlyWageCents: null,
      amountCents: null,
    }
    expect(wageCostText(open)).toBe('Stundenlohn offen')
    expect(wageCostFormula(open)).toBeNull()
    expect(
      plain(totalWageCostText({ amountCents: 16680, missingWageCount: 0 }))
    ).toBe('≈ 166,80 €')
    expect(
      plain(totalWageCostText({ amountCents: 16680, missingWageCount: 2 }))
    ).toBe('mind. 166,80 €')
    expect(totalWageCostText({ amountCents: null, missingWageCount: 1 })).toBe(
      'offen'
    )
  })

  it('Minijob-Grenze als Text: über, innerhalb, offen', () => {
    const base = { limitCents: 60300, plannedCostCents: 61500, overCents: null }
    expect(
      plain(minijobText({ ...base, status: 'over', overCents: 1200 }))
    ).toBe('über der Minijob-Grenze (603,00 €) um 12,00 €')
    expect(plain(minijobText({ ...base, status: 'ok' }))).toBe(
      'innerhalb der Minijob-Grenze (603,00 €)'
    )
    expect(
      minijobText({ ...base, status: 'no-wage', plannedCostCents: null })
    ).toBe('Minijob-Grenze offen: Stundenlohn fehlt')
    expect(
      minijobText(
        {
          status: 'no-limit',
          limitCents: null,
          plannedCostCents: 1,
          overCents: null,
        },
        '2031'
      )
    ).toBe('Minijob-Grenze 2031 nicht hinterlegt')
  })
})
