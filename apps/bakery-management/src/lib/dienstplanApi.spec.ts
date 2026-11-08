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
  groupByArea,
  parseDaysInput,
  parseHoursInput,
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
