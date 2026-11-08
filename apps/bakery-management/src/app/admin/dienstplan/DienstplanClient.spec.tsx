import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import DienstplanClient from './DienstplanClient'
import * as dienstplanApi from '../../../lib/dienstplanApi'
import { touchStyle } from '../../../lib/testing/touchTarget'

const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
    back: jest.fn(),
    prefetch: jest.fn(),
    refresh: jest.fn(),
  }),
}))
jest.mock('../../../lib/dienstplanApi', () => ({
  ...jest.requireActual('../../../lib/dienstplanApi'),
  fetchCalendar: jest.fn(),
  fetchBalances: jest.fn(),
  fetchShiftTemplates: jest.fn(),
  createShiftTemplate: jest.fn(),
  updateShiftTemplate: jest.fn(),
  deleteShiftTemplate: jest.fn(),
  createShift: jest.fn(),
  updateShift: jest.fn(),
  deleteShift: jest.fn(),
  createAbsence: jest.fn(),
  updateAbsence: jest.fn(),
  deleteAbsence: jest.fn(),
}))
const api = dienstplanApi as jest.Mocked<typeof dienstplanApi>

const NOW = '2026-11-05T08:00:00.000Z'

// Erfundene Personen - das Repo ist öffentlich.
function employee(
  overrides: Partial<dienstplanApi.Employee>
): dienstplanApi.Employee {
  return {
    id: 1,
    displayName: 'Person',
    area: 'verkauf',
    color: null,
    employmentType: null,
    weeklyHours: null,
    entryDate: null,
    exitDate: null,
    active: true,
    userId: null,
    note: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

const ERIKA = employee({
  id: 3,
  displayName: 'Erika Beispiel',
  color: '#1E88E5',
  weeklyHours: 30,
})
const LENA = employee({ id: 5, displayName: 'Lena Neu' })
const MAX = employee({ id: 4, displayName: 'Max Muster', area: 'backstube' })

const SHIFT: dienstplanApi.Shift = {
  id: 21,
  employeeId: 3,
  date: '2026-11-10',
  startTime: '06:00',
  endTime: '12:00',
  breakMinutes: 0,
  minutes: 360,
  note: null,
}

const URLAUB: dienstplanApi.Absence = {
  id: 31,
  employeeId: 4,
  type: 'urlaub',
  status: 'geplant',
  startDate: '2026-11-11',
  endDate: '2026-11-13',
  halfDay: false,
  days: 3,
  note: null,
}

const FREI: dienstplanApi.Absence = {
  id: 32,
  employeeId: 5,
  type: 'frei',
  status: 'genehmigt',
  startDate: '2026-11-14',
  endDate: '2026-11-14',
  halfDay: false,
  days: 1,
  note: null,
}

const WEEK = [
  '2026-11-09',
  '2026-11-10',
  '2026-11-11',
  '2026-11-12',
  '2026-11-13',
  '2026-11-14',
  '2026-11-15',
]

/** Öffnungszeiten wie in `opening-hours.core.js` (ISO-Wochentag). */
const OPENING: Record<number, dienstplanApi.OpeningHours | null> = {
  1: null,
  2: { opens: '05:30', closes: '13:30' },
  3: { opens: '05:30', closes: '13:30' },
  4: { opens: '05:30', closes: '13:30' },
  5: { opens: '05:30', closes: '13:30' },
  6: { opens: '05:30', closes: '12:30' },
  7: { opens: '08:00', closes: '11:00' },
}

/**
 * Besetzung, wie die API sie liefert - für die Tests von Hand: höchstens
 * eine Schicht am Tag (die Rechnung selbst prüft `vacationCore.test.js`).
 */
function besetzungFor(
  hours: dienstplanApi.OpeningHours | null,
  shift: dienstplanApi.Shift | undefined
): dienstplanApi.Besetzung | null {
  if (!hours) return null
  const segments: dienstplanApi.BesetzungSegment[] = []
  if (!shift) {
    segments.push({ from: hours.opens, to: hours.closes, employeeIds: [] })
  } else {
    const from = shift.startTime > hours.opens ? shift.startTime : hours.opens
    const to = shift.endTime < hours.closes ? shift.endTime : hours.closes
    if (from > hours.opens) {
      segments.push({ from: hours.opens, to: from, employeeIds: [] })
    }
    segments.push({ from, to, employeeIds: [shift.employeeId] })
    if (to < hours.closes) {
      segments.push({ from: to, to: hours.closes, employeeIds: [] })
    }
  }
  const gaps = segments
    .filter((x) => x.employeeIds.length === 0)
    .map(({ from, to }) => ({ from, to }))
  return {
    opens: hours.opens,
    closes: hours.closes,
    segments,
    gaps,
    covered: gaps.length === 0,
  }
}

/** Stunden einer Person, wie die API sie liefert (erfundene Zahlen). */
function hoursOf(
  employeeId: number,
  overrides: Partial<dienstplanApi.PlannedHours> = {}
): dienstplanApi.PlannedHours {
  return {
    employeeId,
    from: WEEK[0],
    to: WEEK[6],
    weeklyHours: null,
    plannedMinutes: 0,
    shiftCount: 0,
    targetMinutes: null,
    diffMinutes: null,
    targetDays: 6,
    creditedDays: 0,
    status: 'no-target',
    ...overrides,
  }
}

const WEEK_HOURS: dienstplanApi.PlannedHours[] = [
  hoursOf(3, {
    weeklyHours: 30,
    plannedMinutes: 360,
    shiftCount: 1,
    targetMinutes: 1800,
    diffMinutes: -1440,
    status: 'ok',
  }),
  hoursOf(5),
  hoursOf(4, {
    weeklyHours: 40,
    targetMinutes: 1200,
    diffMinutes: -1200,
    targetDays: 3,
    creditedDays: 3,
    status: 'ok',
  }),
]

function calendar(
  overrides: Partial<dienstplanApi.Calendar> = {}
): dienstplanApi.Calendar {
  const shifts = overrides.shifts ?? [SHIFT]
  return {
    from: WEEK[0],
    to: WEEK[6],
    today: '2026-11-10',
    closedWeekdays: { weekdays: [1], source: 'default' },
    // Reihenfolge wie die API: Verkauf zuerst.
    employees: [ERIKA, LENA, MAX],
    shifts,
    absences: [URLAUB, FREI],
    days: WEEK.map((date, i) => ({
      date,
      weekday: i + 1,
      holidayName: null,
      restDay: i === 0,
      closed: i === 0,
      weight: i === 0 ? 0 : 1,
      halfDayName: null,
      openingHours: OPENING[i + 1],
      verkaufBesetzt: shifts.filter((s) => s.date === date).length,
      besetzung: besetzungFor(
        OPENING[i + 1],
        shifts.find((s) => s.date === date && s.employeeId !== 4)
      ),
    })),
    hours: WEEK_HOURS,
    ...overrides,
  }
}

/** Kalender für einen beliebigen Zeitraum (wie die API: `from` = Anfrage). */
function calendarFor(range: {
  from: string
  to: string
}): dienstplanApi.Calendar {
  const start = new Date(`${range.from}T00:00:00Z`)
  const dates = WEEK.map((_, i) =>
    new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10)
  )
  const base = calendar({ shifts: [], absences: [] })
  return {
    ...base,
    from: range.from,
    to: range.to,
    days: base.days.map((d, i) => ({ ...d, date: dates[i] })),
  }
}

const TEMPLATES: dienstplanApi.ShiftTemplate[] = [
  {
    id: 1,
    name: 'Früh',
    startTime: '06:00',
    endTime: '12:00',
    breakMinutes: 0,
  },
  {
    id: 2,
    name: 'Spät',
    startTime: '12:00',
    endTime: '18:30',
    breakMinutes: 30,
  },
]

function renderCalendar(
  props: {
    week?: string
    month?: string
    year?: string
    view?: string
    area?: string
  } = {
    week: '2026-11-12',
  }
) {
  return render(<DienstplanClient {...props} />)
}

function dialog() {
  return within(screen.getByRole('dialog'))
}

async function ready() {
  await screen.findByTestId('row-3')
}

describe('Dienstplan - Kalender (Woche)', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    mockReplace.mockReset()
    api.fetchCalendar.mockReset().mockResolvedValue(calendar())
    api.fetchShiftTemplates.mockReset().mockResolvedValue(TEMPLATES)
    api.createShift.mockReset()
    api.updateShift.mockReset()
    api.deleteShift.mockReset()
    api.createAbsence.mockReset()
    api.updateAbsence.mockReset()
    api.deleteAbsence.mockReset()
  })

  it('zeigt die Woche: Verkauf zuerst, Schichten, Abwesenheiten, Ruhetag, Besetzung', async () => {
    renderCalendar()
    await ready()
    // ?woche= irgendein Tag → Montag bis Sonntag dieser Woche.
    expect(api.fetchCalendar).toHaveBeenCalledWith({
      from: '2026-11-09',
      to: '2026-11-15',
    })
    expect(screen.getByTestId('week-title')).toHaveTextContent(
      'KW 46 · 09.11. – 15.11.2026'
    )

    const rows = screen.getAllByTestId(/^row-/).map((r) => r.dataset.testid)
    expect(rows).toEqual(['row-3', 'row-5', 'row-4'])
    expect(screen.getByText('Verkauf (2)')).toBeInTheDocument()
    expect(screen.getByText('Backstube (1)')).toBeInTheDocument()

    // Geschlossener Tag: nur sein Name, kein zweites „geschlossen“.
    const monday = screen.getByTestId('day-2026-11-09')
    expect(monday).toHaveTextContent('Ruhetag')
    expect(monday).not.toHaveTextContent('geschlossen')
    expect(screen.queryByTestId('staffing-2026-11-09')).not.toBeInTheDocument()
    expect(screen.queryByTestId('opening-2026-11-09')).not.toBeInTheDocument()
    expect(screen.getByTestId('day-2026-11-10')).toHaveTextContent('heute')
    // Öffnungszeit im Kopf jedes offenen Tags, aus der API.
    expect(screen.getByTestId('opening-2026-11-10')).toHaveTextContent(
      '05:30–13:30'
    )
    expect(screen.getByTestId('opening-2026-11-14')).toHaveTextContent(
      '05:30–12:30'
    )
    expect(screen.getByTestId('opening-2026-11-15')).toHaveTextContent(
      '08:00–11:00'
    )

    expect(
      within(screen.getByTestId('cell-3-2026-11-10')).getByTestId('shift-21')
    ).toHaveTextContent('06:00–12:00')

    // Mehrtägige Abwesenheit in jeder ihrer Zellen; geplant gestrichelt.
    for (const date of ['2026-11-11', '2026-11-12', '2026-11-13']) {
      expect(
        within(screen.getByTestId(`cell-4-${date}`)).getByTestId('absence-31')
      ).toHaveTextContent('Urlaub · geplant')
    }
    expect(screen.queryByTestId('cell-4-2026-11-14')).not.toHaveTextContent(
      'Urlaub'
    )
    expect(
      within(screen.getByTestId('cell-4-2026-11-11')).getByTestId('absence-31')
    ).toHaveStyle({ borderStyle: 'dashed' })
    const frei = within(screen.getByTestId('cell-5-2026-11-14')).getByTestId(
      'absence-32'
    )
    expect(frei).toHaveTextContent('Frei')
    expect(frei).not.toHaveTextContent('geplant')
    expect(frei).toHaveStyle({ borderStyle: 'solid' })

    expect(
      screen.getByRole('link', { name: 'Erika Beispiel' })
    ).toHaveAttribute('href', '/admin/dienstplan/mitarbeiter/3')
    expect(screen.getByRole('link', { name: 'Mitarbeiter' })).toHaveAttribute(
      'href',
      '/admin/dienstplan/mitarbeiter'
    )
  })

  it('Besetzung Verkauf: wer welchen Teil abdeckt, Lücken als Text', async () => {
    renderCalendar()
    await ready()
    const row = screen.getByTestId('besetzung-row')
    expect(row).toHaveTextContent('Besetzung Verkauf')
    // Ruhetag: nichts, nur hinterlegt.
    expect(screen.getByTestId('besetzung-2026-11-09').textContent).toBe('')
    // Erika 06:00-12:00 bei 05:30-13:30: Lücke am Anfang und ab 12:00.
    const tue = screen.getByTestId('besetzung-2026-11-10')
    expect(tue).toHaveAttribute('data-covered', 'false')
    const lines = Array.from(tue.querySelectorAll('[data-kind]')).map((el) => [
      el.getAttribute('data-kind'),
      el.textContent,
    ])
    expect(lines).toEqual([
      ['gap', 'unbesetzt 05:30–06:00'],
      ['segment', '06:00–12:00 Erika'],
      ['gap', 'ab 12:00 unbesetzt'],
    ])
    // Tag ohne Schicht im Verkauf: von der Öffnung an unbesetzt.
    expect(screen.getByTestId('besetzung-2026-11-15')).toHaveTextContent(
      'ab 08:00 unbesetzt'
    )
  })

  it('ein durchgehend besetzter Tag sagt es auch in Worten', async () => {
    const base = calendar()
    api.fetchCalendar.mockResolvedValue({
      ...base,
      days: base.days.map((d) =>
        d.date === '2026-11-10' && d.besetzung
          ? {
              ...d,
              besetzung: {
                ...d.besetzung,
                segments: [{ from: '05:30', to: '13:30', employeeIds: [3, 5] }],
                gaps: [],
                covered: true,
              },
            }
          : d
      ),
    })
    renderCalendar()
    await ready()
    expect(screen.getByTestId('staffing-2026-11-10')).toHaveTextContent(
      'durchgehend besetzt'
    )
    expect(screen.getByTestId('besetzung-2026-11-10')).not.toHaveTextContent(
      'unbesetzt'
    )
    expect(screen.getByTestId('besetzung-2026-11-10')).toHaveTextContent(
      '05:30–13:30 Erika, Lena'
    )
  })

  it('die Besetzung zählt nur den Verkauf - bei anderem Bereich fehlt die Zeile', async () => {
    renderCalendar({ week: '2026-11-12', area: 'backstube' })
    await screen.findByTestId('row-4')
    expect(screen.queryByTestId('besetzung-row')).not.toBeInTheDocument()
  })

  it('Stunden je Person: Plan, Soll und Differenz mit Vorzeichen, ohne Wochenstunden „offen“', async () => {
    renderCalendar()
    await ready()
    expect(screen.getByTestId('hours-header')).toHaveTextContent('Stunden')
    const erika = screen.getByTestId('hours-3')
    expect(erika).toHaveTextContent('Plan 6:00 h')
    expect(erika).toHaveTextContent('Soll 30:00 h')
    expect(erika).toHaveTextContent('−24:00 h')
    // ohne Wochenstunden: Soll offen, keine Differenz, nie 0
    const lena = screen.getByTestId('hours-5')
    expect(lena).toHaveTextContent('Plan 0:00 h')
    expect(lena).toHaveTextContent('Soll offen')
    expect(lena).not.toHaveTextContent('Soll 0')
    expect(lena.querySelector('[data-sign]')).toBeNull()
    // Urlaub mindert das Soll und steht dabei
    expect(screen.getByTestId('hours-4')).toHaveTextContent(
      'ohne 3 Tage Urlaub/abwesend'
    )
    // am Handy unter dem Namen
    expect(screen.getByTestId('phone-hours-3')).toHaveTextContent(
      'Plan 6:00 h · −24:00 h'
    )
    expect(screen.getByTestId('phone-hours-5')).toHaveTextContent('Soll offen')
  })

  it('eine Woche ohne Schichten heißt „nichts geplant“, nicht 0', async () => {
    api.fetchCalendar.mockResolvedValue(calendar({ shifts: [] }))
    renderCalendar()
    await ready()
    expect(screen.getByTestId('staffing-2026-11-10')).toHaveTextContent(
      'nichts geplant'
    )
    expect(screen.queryByText(/Verkauf besetzt/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('staffing-2026-11-09')).not.toBeInTheDocument()
  })

  it('Feiertag und halber Tag kommen mit Namen aus der API', async () => {
    const base = calendar()
    api.fetchCalendar.mockResolvedValue({
      ...base,
      days: base.days.map((d) =>
        d.date === '2026-11-11'
          ? { ...d, closed: true, holidayName: 'Testfeiertag', weight: 0 }
          : d.date === '2026-11-12'
          ? { ...d, weight: 0.5, halfDayName: 'Testabend' }
          : d
      ),
    })
    renderCalendar()
    await ready()
    expect(screen.getByTestId('day-2026-11-11')).toHaveTextContent(
      'Testfeiertag'
    )
    expect(screen.queryByTestId('staffing-2026-11-11')).not.toBeInTheDocument()
    expect(screen.getByTestId('day-2026-11-12')).toHaveTextContent(
      'Testabend (halber Tag)'
    )
  })

  it('blättert vor und zurück, „Heute“ springt in die Woche der API, URL folgt', async () => {
    api.fetchCalendar.mockImplementation(async (range) =>
      range.from === WEEK[0] ? calendar() : calendarFor(range)
    )
    renderCalendar({ week: '2026-11-20' })
    await ready()
    expect(api.fetchCalendar).toHaveBeenLastCalledWith({
      from: '2026-11-16',
      to: '2026-11-22',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Nächste Woche' }))
    expect(mockReplace).toHaveBeenLastCalledWith(
      '/admin/dienstplan?woche=2026-11-23',
      { scroll: false }
    )
    await waitFor(() =>
      expect(api.fetchCalendar).toHaveBeenLastCalledWith({
        from: '2026-11-23',
        to: '2026-11-29',
      })
    )

    fireEvent.click(screen.getByRole('button', { name: 'Vorige Woche' }))
    fireEvent.click(screen.getByRole('button', { name: 'Vorige Woche' }))
    expect(mockReplace).toHaveBeenLastCalledWith(
      '/admin/dienstplan?woche=2026-11-09',
      { scroll: false }
    )

    fireEvent.click(screen.getByRole('button', { name: 'Nächste Woche' }))
    fireEvent.click(screen.getByRole('button', { name: 'Heute' }))
    expect(mockReplace).toHaveBeenLastCalledWith(
      '/admin/dienstplan?woche=2026-11-09',
      { scroll: false }
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Heute' })).toBeDisabled()
    )
  })

  it('Seitenkopf aus dem Layout-Kit: eine h1, Datumsfeld springt in die Woche des Tages', async () => {
    api.fetchCalendar.mockImplementation(async (range) =>
      range.from === WEEK[0] ? calendar() : calendarFor(range)
    )
    renderCalendar()
    await ready()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Dienstplan' })
    ).toBeInTheDocument()
    const nav = screen.getByRole('group', { name: 'Woche wechseln' })
    const field = within(nav).getByLabelText('Woche')
    expect(field).toHaveValue('2026-11-09')
    // Ein Donnerstag → Montag seiner Woche.
    fireEvent.change(field, { target: { value: '2026-12-03' } })
    expect(mockReplace).toHaveBeenLastCalledWith(
      '/admin/dienstplan?woche=2026-11-30',
      { scroll: false }
    )
    await waitFor(() =>
      expect(screen.getByTestId('week-title')).toHaveTextContent('30.11.')
    )
  })

  it('beim Blättern nie die alte Woche unter den neuen Tagen; Ladefehler zeigt kein leeres Raster', async () => {
    renderCalendar()
    await ready()
    expect(
      screen.getAllByRole('button', { name: / anlegen$/ }).length
    ).toBeGreaterThan(0)

    let fail: (err: Error) => void = () => undefined
    api.fetchCalendar.mockImplementation(
      () =>
        new Promise((_, reject) => {
          fail = reject
        })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Nächste Woche' }))
    // Während die neue Woche lädt: kein Raster, kein „anlegen“.
    expect(
      screen.getByRole('progressbar', { name: /Dienstplan wird geladen/ })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('row-3')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: / anlegen$/ })).toHaveLength(
      0
    )

    fail(new Error('Der Dienstplan konnte nicht geladen werden.'))
    expect(
      await screen.findByText('Der Dienstplan konnte nicht geladen werden.')
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('progressbar', { name: /Dienstplan wird geladen/ })
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('row-3')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: / anlegen$/ })).toHaveLength(
      0
    )

    // Zurück in die geladene Woche: das Raster kommt wieder.
    api.fetchCalendar.mockResolvedValue(calendar())
    fireEvent.click(screen.getByRole('button', { name: 'Vorige Woche' }))
    await ready()
    expect(
      screen.queryByText('Der Dienstplan konnte nicht geladen werden.')
    ).not.toBeInTheDocument()
  })

  it('folgt neuen Query-Props (weiche Navigation, z. B. Seitenleiste)', async () => {
    api.fetchCalendar.mockImplementation(async (range) =>
      range.from === WEEK[0] ? calendar() : calendarFor(range)
    )
    const { rerender } = renderCalendar({
      week: '2026-11-12',
      area: 'backstube',
    })
    await screen.findByTestId('row-4')
    expect(screen.queryByTestId('row-3')).not.toBeInTheDocument()

    rerender(<DienstplanClient week="2026-11-25" />)
    await waitFor(() =>
      expect(api.fetchCalendar).toHaveBeenLastCalledWith({
        from: '2026-11-23',
        to: '2026-11-29',
      })
    )
    await ready()
    expect(screen.getByTestId('row-4')).toBeInTheDocument()
    expect(screen.getByTestId('week-title')).toHaveTextContent('23.11.')

    // Alter Link mit Woche und Ansicht Monat: der Monat dieser Woche.
    rerender(<DienstplanClient week="2026-11-25" view="monat" />)
    await waitFor(() =>
      expect(api.fetchCalendar).toHaveBeenLastCalledWith({
        from: '2026-11-01',
        to: '2026-11-30',
      })
    )
    expect(await screen.findByTestId('month-title')).toHaveTextContent(
      'November 2026'
    )
  })

  it('filtert nach Bereich (auch aus der URL)', async () => {
    renderCalendar({ week: '2026-11-12', area: 'verkauf' })
    await ready()
    expect(screen.queryByTestId('row-4')).not.toBeInTheDocument()
    expect(screen.getByTestId('row-5')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Backstube' }))
    expect(screen.getByTestId('row-4')).toBeInTheDocument()
    expect(screen.queryByTestId('row-3')).not.toBeInTheDocument()
    expect(mockReplace).toHaveBeenLastCalledWith(
      '/admin/dienstplan?woche=2026-11-09&bereich=backstube',
      { scroll: false }
    )

    fireEvent.click(screen.getByRole('button', { name: 'Büro' }))
    expect(
      screen.getByText('Keine Mitarbeiter in diesem Bereich.')
    ).toBeInTheDocument()
  })

  it('Einträge der Woche sind auf Touch-Geräten 44 px hoch (Layout-Kit)', async () => {
    renderCalendar()
    await ready()
    expect(touchStyle(screen.getByTestId('shift-21'))).toMatchObject({
      'min-height': '44px',
    })
    expect(
      touchStyle(
        within(screen.getByTestId('cell-4-2026-11-11')).getByTestId(
          'absence-31'
        )
      )
    ).toMatchObject({ 'min-height': '44px' })
    // Name als Weg zum Profil (Woche, Monat und Jahr teilen die Zelle).
    expect(
      touchStyle(screen.getByRole('link', { name: 'Erika Beispiel' }))
    ).toMatchObject({ 'min-height': '44px' })

    // Leere Zelle: Touch kennt kein Hover - das Plus steht gedämpft da.
    const empty = within(screen.getByTestId('cell-3-2026-11-11')).getByRole(
      'button',
      { name: /^Eintrag für Erika Beispiel/ }
    )
    expect(touchStyle(empty, ' svg')).toMatchObject({ opacity: '0.5' })

    // Vorlagen-Chips im Schichtdialog: Schnelleingabe am Tablet, 44 px.
    fireEvent.click(empty)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Schicht anlegen' }))
    expect(
      touchStyle(dialog().getByRole('button', { name: 'Früh 06:00–12:00' }))
    ).toMatchObject({ 'min-height': '44px' })
  })

  it('erneuter Versuch nach einem Ladefehler: nur Laden, nicht Fehler und Laden zugleich', async () => {
    api.fetchCalendar.mockRejectedValueOnce(
      new Error('Der Dienstplan konnte nicht geladen werden.')
    )
    renderCalendar()
    expect(
      await screen.findByText('Der Dienstplan konnte nicht geladen werden.')
    ).toBeInTheDocument()

    let finish: (value: dienstplanApi.Calendar) => void = () => undefined
    api.fetchCalendar.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(
      screen.getByRole('progressbar', { name: /Dienstplan wird geladen/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Der Dienstplan konnte nicht geladen werden.')
    ).not.toBeInTheDocument()

    finish(calendar())
    await ready()
    expect(
      screen.queryByText('Der Dienstplan konnte nicht geladen werden.')
    ).not.toBeInTheDocument()
  })

  it('Schichtvorlagen im Kopf pflegen: eine neue Vorlage steht gleich im Schichtdialog', async () => {
    api.fetchShiftTemplates.mockResolvedValue([])
    api.createShiftTemplate.mockReset().mockResolvedValue({
      id: 9,
      name: 'Mittag',
      startTime: '10:00',
      endTime: '14:00',
      breakMinutes: 0,
    })
    renderCalendar()
    await ready()
    const empty = within(screen.getByTestId('cell-3-2026-11-11')).getByRole(
      'button',
      { name: /^Eintrag für Erika Beispiel/ }
    )
    fireEvent.click(empty)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Schicht anlegen' }))
    expect(
      await dialog().findByText(
        'Keine Schichtvorlagen - Zeiten frei eintragen.'
      )
    ).toBeInTheDocument()
    fireEvent.click(dialog().getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: 'Schichtvorlagen' }))
    const d = dialog()
    expect(
      await d.findByText('Noch keine Schichtvorlagen.')
    ).toBeInTheDocument()
    fireEvent.change(d.getByLabelText(/^Name/), { target: { value: 'Mittag' } })
    fireEvent.change(d.getByLabelText(/^Beginn/), {
      target: { value: '10:00' },
    })
    fireEvent.change(d.getByLabelText(/^Ende/), { target: { value: '14:00' } })
    fireEvent.click(d.getByRole('button', { name: 'Vorlage anlegen' }))
    await waitFor(() =>
      expect(api.createShiftTemplate).toHaveBeenCalledWith({
        name: 'Mittag',
        startTime: '10:00',
        endTime: '14:00',
        breakMinutes: 0,
      })
    )
    expect(await d.findByTestId('shift-template-9')).toHaveTextContent('Mittag')
    fireEvent.click(d.getByRole('button', { name: 'Fertig' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )

    fireEvent.click(empty)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Schicht anlegen' }))
    fireEvent.click(
      dialog().getByRole('button', { name: 'Mittag 10:00–14:00' })
    )
    expect(dialog().getByLabelText(/^Beginn/)).toHaveValue('10:00')
  })

  it('legt per Klick auf eine leere Zelle eine Schicht mit Vorlage an und zeigt den Hinweis der API', async () => {
    api.createShift.mockResolvedValue({
      data: { ...SHIFT, id: 22, date: '2026-11-11' },
      warnings: [
        {
          code: 'absence_overlap',
          message: 'Erika Beispiel ist am 11.11.2026 als „Frei“ eingetragen.',
        },
      ],
    })
    renderCalendar()
    await ready()
    fireEvent.click(
      within(screen.getByTestId('cell-3-2026-11-11')).getByRole('button', {
        name: 'Eintrag für Erika Beispiel am Mi, 11.11.2026 anlegen',
      })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Schicht anlegen' }))

    const d = dialog()
    expect(
      d.getByText('Schicht anlegen – Erika Beispiel', { exact: false })
    ).toBeInTheDocument()
    const anlegen = d.getByRole('button', { name: 'Anlegen' })
    expect(anlegen).toBeDisabled()
    fireEvent.click(d.getByRole('button', { name: 'Spät 12:00–18:30' }))
    expect(d.getByLabelText(/^Beginn/)).toHaveValue('12:00')
    expect(d.getByLabelText(/^Pause/)).toHaveValue('30')
    fireEvent.click(d.getByRole('button', { name: 'Früh 06:00–12:00' }))
    expect(anlegen).toBeEnabled()
    fireEvent.click(anlegen)

    await waitFor(() =>
      expect(api.createShift).toHaveBeenCalledWith({
        employeeId: 3,
        date: '2026-11-11',
        startTime: '06:00',
        endTime: '12:00',
        breakMinutes: 0,
        note: null,
      })
    )
    expect(await screen.findByText('Schicht angelegt.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Hinweis: Erika Beispiel ist am 11.11.2026 als „Frei“ eingetragen.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.fetchCalendar).toHaveBeenCalledTimes(2)
  })

  it('freie Zeiten: Ende vor Beginn gesperrt, Fehler der API im Dialog', async () => {
    api.createShift.mockRejectedValue(
      new Error(
        'Erika Beispiel hat am 10.11.2026 schon eine Schicht 06:00-12:00.'
      )
    )
    renderCalendar()
    await ready()
    fireEvent.click(
      within(screen.getByTestId('cell-3-2026-11-10')).getByRole('button', {
        name: /^Eintrag für Erika Beispiel/,
      })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Schicht anlegen' }))
    const d = dialog()
    fireEvent.change(d.getByLabelText(/^Beginn/), {
      target: { value: '14:00' },
    })
    fireEvent.change(d.getByLabelText(/^Ende/), { target: { value: '10:00' } })
    expect(d.getByText('Ende nach Beginn, am selben Tag.')).toBeInTheDocument()
    expect(d.getByRole('button', { name: 'Anlegen' })).toBeDisabled()

    fireEvent.change(d.getByLabelText(/^Beginn/), {
      target: { value: '08:00' },
    })
    fireEvent.click(d.getByRole('button', { name: 'Anlegen' }))
    expect(
      await d.findByText(
        'Erika Beispiel hat am 10.11.2026 schon eine Schicht 06:00-12:00.'
      )
    ).toBeInTheDocument()
    expect(api.createShift).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 3,
        date: '2026-11-10',
        startTime: '08:00',
        endTime: '10:00',
      })
    )
  })

  it('auch die Backstube bekommt Schichten (seit 2026-11-08)', async () => {
    api.createShift.mockResolvedValue({
      data: { ...SHIFT, id: 23, employeeId: 4, date: '2026-11-14' },
      warnings: [],
    })
    renderCalendar()
    await ready()
    fireEvent.click(
      within(screen.getByTestId('cell-4-2026-11-14')).getByRole('button', {
        name: /^Eintrag für Max Muster/,
      })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Schicht anlegen' }))
    const d = dialog()
    expect(
      d.getByText('Schicht anlegen – Max Muster', { exact: false })
    ).toBeInTheDocument()
    fireEvent.click(d.getByRole('button', { name: 'Früh 06:00–12:00' }))
    fireEvent.click(d.getByRole('button', { name: 'Anlegen' }))
    await waitFor(() =>
      expect(api.createShift).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 4, date: '2026-11-14' })
      )
    )
    expect(await screen.findByText('Schicht angelegt.')).toBeInTheDocument()
  })

  it('Backstube: Abwesenheit über das Menü der leeren Zelle', async () => {
    api.createAbsence.mockResolvedValue({
      data: {
        ...URLAUB,
        id: 40,
        startDate: '2026-11-14',
        endDate: '2026-11-14',
      },
      warnings: [],
    })
    renderCalendar()
    await ready()
    fireEvent.click(
      within(screen.getByTestId('cell-4-2026-11-14')).getByRole('button', {
        name: /^Eintrag für Max Muster/,
      })
    )
    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent)
    ).toEqual(['Schicht anlegen', 'Abwesenheit eintragen'])
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Abwesenheit eintragen' })
    )
    const d = dialog()
    expect(
      d.getByText('Abwesenheit eintragen – Max Muster', { exact: false })
    ).toBeInTheDocument()
    expect(d.getByLabelText(/^Von/)).toHaveValue('2026-11-14')
    fireEvent.click(d.getByRole('button', { name: 'Eintragen' }))
    await waitFor(() =>
      expect(api.createAbsence).toHaveBeenCalledWith({
        employeeId: 4,
        type: 'urlaub',
        status: 'geplant',
        startDate: '2026-11-14',
        endDate: '2026-11-14',
        halfDay: false,
        note: null,
      })
    )
    expect(
      await screen.findByText('Abwesenheit eingetragen.')
    ).toBeInTheDocument()
  })

  it('Verkauf: Abwesenheit über das Menü der Zelle', async () => {
    renderCalendar()
    await ready()
    fireEvent.click(
      within(screen.getByTestId('cell-5-2026-11-12')).getByRole('button', {
        name: /^Eintrag für Lena Neu/,
      })
    )
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Abwesenheit eintragen' })
    )
    expect(
      dialog().getByText('Abwesenheit eintragen – Lena Neu', { exact: false })
    ).toBeInTheDocument()
  })

  it('an einem Tag mit Abwesenheit bietet das „+“ keine zweite Abwesenheit an', async () => {
    renderCalendar()
    await ready()
    // Backstube mit Urlaub: nur noch die Schicht - gleich der Dialog.
    fireEvent.click(
      within(screen.getByTestId('cell-4-2026-11-12')).getByRole('button', {
        name: /^Eintrag für Max Muster/,
      })
    )
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
    expect(
      dialog().getByText('Schicht anlegen – Max Muster', { exact: false })
    ).toBeInTheDocument()
    fireEvent.click(dialog().getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    // Verkauf mit „frei“: nur noch die Schicht - gleich der Dialog, wie im Monat.
    fireEvent.click(
      within(screen.getByTestId('cell-5-2026-11-14')).getByRole('button', {
        name: /^Eintrag für Lena Neu/,
      })
    )
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
    expect(
      dialog().getByText('Schicht anlegen – Lena Neu', { exact: false })
    ).toBeInTheDocument()
  })

  it('ändert eine Schicht (nur die Änderung) und löscht sie nach Rückfrage', async () => {
    api.updateShift.mockResolvedValue({
      data: { ...SHIFT, endTime: '13:00' },
      warnings: [],
    })
    renderCalendar()
    await ready()
    fireEvent.click(screen.getByTestId('shift-21'))
    let d = dialog()
    expect(d.getByRole('button', { name: 'Speichern' })).toBeDisabled()
    fireEvent.change(d.getByLabelText(/^Ende/), { target: { value: '13:00' } })
    fireEvent.click(d.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(api.updateShift).toHaveBeenCalledWith(21, { endTime: '13:00' })
    )
    expect(await screen.findByText('Schicht gespeichert.')).toBeInTheDocument()

    jest.spyOn(window, 'confirm').mockReturnValue(true)
    api.deleteShift.mockResolvedValue(undefined)
    fireEvent.click(await screen.findByTestId('shift-21'))
    d = dialog()
    fireEvent.click(d.getByRole('button', { name: 'Löschen' }))
    await waitFor(() => expect(api.deleteShift).toHaveBeenCalledWith(21))
    expect(await screen.findByText('Schicht gelöscht.')).toBeInTheDocument()
  })

  it('ein Fehler ersetzt die alte Erfolgsmeldung - nie drei Hinweise übereinander', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true)
    api.deleteShift.mockResolvedValue(undefined)
    renderCalendar()
    await ready()
    fireEvent.click(screen.getByTestId('shift-21'))
    fireEvent.click(dialog().getByRole('button', { name: 'Löschen' }))
    expect(await screen.findByText('Schicht gelöscht.')).toBeInTheDocument()

    api.deleteAbsence.mockRejectedValue(new Error('kaputt'))
    fireEvent.click(
      within(screen.getByTestId('cell-4-2026-11-12')).getByTestId('absence-31')
    )
    fireEvent.click(dialog().getByRole('button', { name: 'Löschen' }))
    await waitFor(() => expect(api.deleteAbsence).toHaveBeenCalledWith(31))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.queryByText('Schicht gelöscht.')).not.toBeInTheDocument()
  })

  it('bearbeitet und löscht eine Abwesenheit aus dem Kalender', async () => {
    renderCalendar()
    await ready()
    fireEvent.click(
      within(screen.getByTestId('cell-4-2026-11-12')).getByTestId('absence-31')
    )
    const d = dialog()
    expect(
      d.getByText('Abwesenheit bearbeiten – Max Muster', { exact: false })
    ).toBeInTheDocument()
    expect(d.getByLabelText(/^Von/)).toHaveValue('2026-11-11')

    // Abbrechen bei der Rückfrage löscht nichts.
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(d.getByRole('button', { name: 'Löschen' }))
    expect(api.deleteAbsence).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    api.deleteAbsence.mockResolvedValue(undefined)
    fireEvent.click(d.getByRole('button', { name: 'Löschen' }))
    await waitFor(() => expect(api.deleteAbsence).toHaveBeenCalledWith(31))
    expect(await screen.findByText('Abwesenheit gelöscht.')).toBeInTheDocument()
  })

  it('zeigt die deutsche Meldung der API, wenn das Laden scheitert', async () => {
    api.fetchCalendar.mockRejectedValue(
      new Error('Nur mit persönlicher Anmeldung.')
    )
    renderCalendar()
    expect(
      await screen.findByText('Nur mit persönlicher Anmeldung.')
    ).toBeInTheDocument()
  })

  it('Schichtvorlagen nicht geladen: der Dialog sagt das, nicht „keine Vorlagen“', async () => {
    api.fetchShiftTemplates.mockRejectedValue(new Error('Netzwerkfehler'))
    renderCalendar()
    await ready()
    fireEvent.click(
      within(screen.getByTestId('cell-3-2026-11-11')).getByRole('button', {
        name: /^Eintrag für Erika Beispiel/,
      })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Schicht anlegen' }))
    const d = dialog()
    expect(
      await d.findByText(
        'Schichtvorlagen konnten nicht geladen werden - Zeiten frei eintragen.'
      )
    ).toBeInTheDocument()
    expect(
      d.queryByText('Keine Schichtvorlagen - Zeiten frei eintragen.')
    ).not.toBeInTheDocument()
    expect(d.getByLabelText(/^Beginn/)).toBeEnabled()
  })

  it('ohne Mitarbeiter: Hinweis auf die Mitarbeiterliste', async () => {
    api.fetchCalendar.mockResolvedValue(
      calendar({ employees: [], shifts: [], absences: [] })
    )
    renderCalendar()
    expect(
      await screen.findByText(/Noch keine Mitarbeiter/)
    ).toBeInTheDocument()
  })
})

// ------------------------------------------------------------ Monat / Jahr

const NOVEMBER = Array.from({ length: 30 }, (_, i) =>
  new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10)
)

function monthCalendar(
  overrides: Partial<dienstplanApi.Calendar> = {}
): dienstplanApi.Calendar {
  return {
    ...calendar(),
    from: '2026-11-01',
    to: '2026-11-30',
    days: NOVEMBER.map((date) => {
      const weekday = ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1
      return {
        date,
        weekday,
        holidayName: date === '2026-11-01' ? 'Allerheiligen' : null,
        restDay: weekday === 1,
        closed: weekday === 1 || date === '2026-11-01',
        weight: weekday === 1 || date === '2026-11-01' ? 0 : 1,
        halfDayName: null,
        openingHours:
          weekday === 1 || date === '2026-11-01' ? null : OPENING[weekday],
        verkaufBesetzt: 0,
        besetzung: null,
      }
    }),
    hours: [
      hoursOf(3, {
        from: '2026-11-01',
        to: '2026-11-30',
        weeklyHours: 30,
        plannedMinutes: 360,
        shiftCount: 1,
        targetMinutes: 7200,
        diffMinutes: -6840,
        targetDays: 24,
        status: 'ok',
      }),
      hoursOf(5, { from: '2026-11-01', to: '2026-11-30' }),
      hoursOf(4, {
        from: '2026-11-01',
        to: '2026-11-30',
        weeklyHours: 40,
        plannedMinutes: 9900,
        shiftCount: 22,
        targetMinutes: 9600,
        diffMinutes: 300,
        targetDays: 24,
        status: 'ok',
      }),
    ],
    ...overrides,
  }
}

const YEAR_URLAUB: dienstplanApi.Absence = {
  id: 41,
  employeeId: 3,
  type: 'urlaub',
  status: 'genehmigt',
  startDate: '2026-07-27',
  endDate: '2026-08-08',
  halfDay: false,
  days: 11,
  note: null,
}

function yearCalendar(): dienstplanApi.Calendar {
  return {
    ...calendar(),
    from: '2026-01-01',
    to: '2026-12-31',
    shifts: [],
    absences: [YEAR_URLAUB, URLAUB],
    days: [],
  }
}

function balance(
  employeeId: number,
  overrides: Partial<dienstplanApi.BalanceListEntry> = {}
): dienstplanApi.BalanceListEntry {
  return {
    employeeId,
    displayName: 'x',
    area: 'verkauf',
    active: true,
    status: 'ok',
    year: 2026,
    entitlementDays: 24,
    carryoverDays: null,
    carryoverDeadline: '2026-03-31',
    approvedDays: 11,
    plannedDays: 3,
    entitlement: 24,
    months: 12,
    fullYear: true,
    carryoverUsed: null,
    carryoverExpired: null,
    carryoverOpen: null,
    remainingDays: 13,
    remainingAfterPlannedDays: 10,
    ...overrides,
  }
}

describe('Dienstplan - Kalender (Monat und Jahr)', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    mockReplace.mockReset()
    api.fetchShiftTemplates.mockReset().mockResolvedValue(TEMPLATES)
    api.fetchCalendar.mockReset().mockImplementation(async (range) => {
      if (range.from === '2026-11-01') return monthCalendar()
      if (range.from === '2026-01-01') return yearCalendar()
      return range.from === WEEK[0] ? calendar() : calendarFor(range)
    })
    api.fetchBalances.mockReset().mockResolvedValue([
      balance(3),
      balance(5, {
        status: 'no-config',
        entitlementDays: null,
        entitlement: null,
        approvedDays: 0,
        plannedDays: 0,
        remainingDays: null,
        remainingAfterPlannedDays: null,
      }),
      balance(4, {
        approvedDays: 0,
        plannedDays: 3,
        carryoverDays: 4,
        carryoverUsed: 1,
        carryoverExpired: 3,
        carryoverOpen: 0,
        remainingDays: 24,
      }),
    ])
  })

  it('Monat: Tage als Spalten, Abwesenheit mit Kürzel, Schicht als Punkt, Ruhetag hinterlegt', async () => {
    renderCalendar({ view: 'monat', month: '2026-11' })
    await ready()
    expect(api.fetchCalendar).toHaveBeenCalledWith({
      from: '2026-11-01',
      to: '2026-11-30',
    })
    expect(screen.getByTestId('month-title')).toHaveTextContent('November 2026')
    expect(screen.getAllByTestId(/^day-2026-11-/)).toHaveLength(30)
    expect(screen.getByTestId('day-2026-11-09')).toHaveTextContent('Mo')
    expect(screen.getByTestId('day-2026-11-09')).toHaveTextContent('Ruhetag')
    expect(screen.getByTestId('day-2026-11-01')).toHaveTextContent(
      'Allerheiligen'
    )

    const urlaub = within(screen.getByTestId('cell-4-2026-11-12')).getByRole(
      'button'
    )
    expect(urlaub).toHaveTextContent('U')
    expect(urlaub).toHaveAttribute('data-status', 'geplant')
    expect(urlaub).toHaveStyle({ borderStyle: 'dashed' })
    expect(urlaub).toHaveAccessibleName(
      'Max Muster, Do, 12.11.2026: Urlaub (geplant) - bearbeiten'
    )
    // Urlaub 11.-13.11. als ein durchgehender Balken.
    const bar = (date: string) =>
      within(screen.getByTestId(`cell-4-${date}`)).getByRole('button')
    expect(bar('2026-11-11')).toHaveAttribute('data-join', 'right')
    expect(urlaub).toHaveAttribute('data-join', 'both')
    expect(bar('2026-11-13')).toHaveAttribute('data-join', 'left')
    expect(bar('2026-11-14')).not.toHaveAttribute('data-join')
    expect(
      within(screen.getByTestId('cell-5-2026-11-14')).getByRole('button')
    ).toHaveTextContent('F')
    expect(screen.getByTestId('shift-dot-3-2026-11-10')).toBeInTheDocument()
    expect(screen.getByTestId('absence-legend')).toHaveTextContent('U = Urlaub')
    // Tageszellen sind auf Touch-Geräten 44 px groß - auch auf dem Tablet,
    // wo die Namensspalte breiter ist: die Tabelle rechnet mit ihr, und
    // jede Spalte hat 44 px plus Polster und Rand.
    expect(touchStyle(urlaub)).toMatchObject({
      'min-height': '44px',
      'min-width': '44px',
    })
    expect(touchStyle(screen.getByRole('table'))).toMatchObject({
      'min-width': `${170 + 30 * (44 + 2 * 2 + 1) + 112}px`,
    })
    // Stunden des Monats ganz rechts, Differenz mit Vorzeichen.
    expect(screen.getByTestId('hours-header')).toHaveTextContent('Monat')
    expect(screen.getByTestId('hours-3')).toHaveTextContent('Soll 120:00 h')
    expect(screen.getByTestId('hours-3')).toHaveTextContent('−114:00 h')
    expect(screen.getByTestId('hours-4')).toHaveTextContent('+5:00 h')
    expect(screen.getByTestId('hours-5')).toHaveTextContent('Soll offen')
    // Monat ist kein Tag: zwischen den Pfeilen steht der Monat, kein Datum.
    const nav = screen.getByTestId('month-navigator')
    expect(screen.getByTestId('month-navigator-value')).toHaveTextContent(
      'November 2026'
    )
    expect(nav.querySelector('input')).toBeNull()

    // Datum im Kopf antippen → Woche dieses Tages.
    const header = within(screen.getByTestId('day-2026-11-09')).getByRole(
      'button'
    )
    expect(header).toHaveAccessibleName(
      'Mo, 09.11.2026 (Ruhetag): Woche öffnen'
    )
    expect(touchStyle(header)).toMatchObject({ 'min-height': '44px' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Do, 12.11.2026: Woche öffnen' })
    )
    expect(mockReplace).toHaveBeenLastCalledWith(
      '/admin/dienstplan?woche=2026-11-09',
      { scroll: false }
    )
    expect(await screen.findByTestId('week-title')).toHaveTextContent('KW 46')
  })

  it('Monat: Feiertag und halber Tag sind sichtbar markiert und unter der Tabelle benannt', async () => {
    const base = monthCalendar()
    api.fetchCalendar.mockResolvedValue({
      ...base,
      days: base.days.map((d) =>
        d.date === '2026-11-12'
          ? { ...d, weight: 0.5, halfDayName: 'Testabend' }
          : d
      ),
    })
    renderCalendar({ view: 'monat', month: '2026-11' })
    await ready()
    // Touch kennt keinen Tooltip: das Zeichen steht im Kopf, der Name darunter.
    expect(screen.getByTestId('day-2026-11-12')).toHaveTextContent('½')
    expect(screen.getByTestId('day-2026-11-01')).toHaveTextContent('×')
    expect(screen.getByTestId('day-2026-11-13')).not.toHaveTextContent(/[½×]/)
    expect(
      within(screen.getByTestId('day-2026-11-12')).getByRole('button')
    ).toHaveAccessibleName('Do, 12.11.2026 (Testabend): Woche öffnen')
    const notes = screen.getByTestId('month-day-notes')
    expect(notes).toHaveTextContent('½ = zählt als halber Urlaubstag')
    expect(notes).toHaveTextContent('So 01.11. Allerheiligen (×)')
    expect(notes).toHaveTextContent('Do 12.11. Testabend (½, halber Tag)')
    // Der Ruhetag ist jede Woche derselbe - nicht einzeln aufgezählt.
    expect(notes).not.toHaveTextContent('09.11.')
  })

  it('Monat: Zelle öffnet dieselben Dialoge wie die Woche', async () => {
    api.createShift.mockReset().mockResolvedValue({
      data: { ...SHIFT, id: 22, employeeId: 5, date: '2026-11-17' },
      warnings: [],
    })
    renderCalendar({ view: 'monat', month: '2026-11' })
    await ready()
    const cell = (id: number, date: string) =>
      within(screen.getByTestId(`cell-${id}-${date}`)).getByRole('button')

    // Abwesenheit in der Backstube: bearbeiten oder (seit 2026-11-08) Schicht.
    fireEvent.click(cell(4, '2026-11-12'))
    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent)
    ).toEqual([
      'Urlaub (geplant) 11.11.2026 – 13.11.2026 bearbeiten',
      'Schicht anlegen',
    ])
    fireEvent.click(
      screen.getByRole('menuitem', {
        name: 'Urlaub (geplant) 11.11.2026 – 13.11.2026 bearbeiten',
      })
    )
    expect(
      dialog().getByText('Abwesenheit bearbeiten – Max Muster', {
        exact: false,
      })
    ).toBeInTheDocument()
    expect(dialog().getByLabelText(/^Von/)).toHaveValue('2026-11-11')
    fireEvent.click(dialog().getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )

    // Leerer Tag in der Backstube: Schicht oder Abwesenheit.
    fireEvent.click(cell(4, '2026-11-17'))
    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent)
    ).toEqual(['Schicht anlegen', 'Abwesenheit eintragen'])
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Abwesenheit eintragen' })
    )
    expect(
      dialog().getByText('Abwesenheit eintragen – Max Muster', {
        exact: false,
      })
    ).toBeInTheDocument()
    expect(dialog().getByLabelText(/^Von/)).toHaveValue('2026-11-17')
    fireEvent.click(dialog().getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )

    // Tag mit Schicht im Verkauf: Menü mit Bearbeiten und Anlegen.
    fireEvent.click(cell(3, '2026-11-10'))
    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent)
    ).toEqual([
      'Schicht 06:00–12:00 bearbeiten',
      'Schicht anlegen',
      'Abwesenheit eintragen',
    ])
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Schicht 06:00–12:00 bearbeiten' })
    )
    expect(
      dialog().getByText('Schicht bearbeiten – Erika Beispiel', {
        exact: false,
      })
    ).toBeInTheDocument()
    fireEvent.click(dialog().getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )

    // An einem Tag mit Abwesenheit keine zweite Abwesenheit anbieten.
    fireEvent.click(cell(5, '2026-11-14'))
    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent)
    ).toEqual(['Frei (genehmigt) 14.11.2026 bearbeiten', 'Schicht anlegen'])
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    )

    // Leerer Tag im Verkauf: Schicht anlegen, danach lädt der Monat neu.
    const calls = api.fetchCalendar.mock.calls.length
    fireEvent.click(cell(5, '2026-11-17'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Schicht anlegen' }))
    const d = dialog()
    expect(
      d.getByText('Schicht anlegen – Lena Neu', { exact: false })
    ).toBeInTheDocument()
    fireEvent.click(d.getByRole('button', { name: 'Früh 06:00–12:00' }))
    fireEvent.click(d.getByRole('button', { name: 'Anlegen' }))
    await waitFor(() =>
      expect(api.createShift).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 5, date: '2026-11-17' })
      )
    )
    expect(await screen.findByText('Schicht angelegt.')).toBeInTheDocument()
    expect(api.fetchCalendar).toHaveBeenCalledTimes(calls + 1)
    expect(api.fetchCalendar).toHaveBeenLastCalledWith({
      from: '2026-11-01',
      to: '2026-11-30',
    })
    expect(screen.getByTestId('month-title')).toHaveTextContent('November 2026')
  })

  it('Monat blättert monatsweise; Ansichtswechsel nimmt den Zeitraum mit', async () => {
    renderCalendar({ week: '2026-11-12' })
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Monat' }))
    expect(mockReplace).toHaveBeenLastCalledWith(
      '/admin/dienstplan?ansicht=monat&monat=2026-11',
      { scroll: false }
    )
    expect(await screen.findByTestId('month-title')).toHaveTextContent(
      'November 2026'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    expect(mockReplace).toHaveBeenLastCalledWith(
      '/admin/dienstplan?ansicht=monat&monat=2026-12',
      { scroll: false }
    )
    await waitFor(() =>
      expect(api.fetchCalendar).toHaveBeenLastCalledWith({
        from: '2026-12-01',
        to: '2026-12-31',
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Jahr' }))
    expect(mockReplace).toHaveBeenLastCalledWith(
      '/admin/dienstplan?ansicht=jahr&jahr=2026',
      { scroll: false }
    )
    expect(await screen.findByTestId('year-title')).toHaveTextContent(
      'Jahr 2026'
    )
    expect(screen.getByTestId('year-navigator-value')).toHaveTextContent('2026')
    expect(
      screen.getByTestId('year-navigator').querySelector('input')
    ).toBeNull()
    // Zurück zur Woche: heute (laut API 10.11.) liegt im Jahr → diese Woche.
    await screen.findByTestId('phone-balance-3')
    await waitFor(() =>
      expect(screen.getByTestId('balance-3')).toHaveTextContent('Rest 13')
    )
    fireEvent.click(screen.getByRole('button', { name: 'Woche' }))
    expect(mockReplace).toHaveBeenLastCalledWith(
      '/admin/dienstplan?woche=2026-11-09',
      { scroll: false }
    )
    expect(await screen.findByTestId('shift-21')).toBeInTheDocument()
  })

  it('Jahr: zwölf Monate je Person mit Urlaubsbalken, daneben das Konto (offen statt 0)', async () => {
    renderCalendar({ view: 'jahr', year: '2026' })
    await ready()
    expect(api.fetchCalendar).toHaveBeenCalledWith({
      from: '2026-01-01',
      to: '2026-12-31',
    })
    expect(api.fetchBalances).toHaveBeenCalledWith(2026)
    expect(screen.getByTestId('year-title')).toHaveTextContent('Jahr 2026')

    // Urlaub 27.07.-08.08.: ein Balken im Juli (ab Tag 27), einer im August.
    const july = screen.getByTestId('bar-41-2026-07')
    expect(july).toHaveStyle({ left: `${(26 / 31) * 100}%` })
    const julyCell = within(screen.getByTestId('month-3-2026-07')).getByRole(
      'button'
    )
    expect(julyCell).toHaveAccessibleName(
      'Erika Beispiel, Urlaub (genehmigt) 27.07.2026 – 08.08.2026 - bearbeiten'
    )
    // Der ganze Monat ist die Fläche, nicht der schmale Balken.
    expect(touchStyle(julyCell)).toMatchObject({ 'min-height': '44px' })
    expect(screen.getByTestId('bar-41-2026-08')).toHaveStyle({
      left: '0%',
      width: `${(8 / 31) * 100}%`,
    })
    // Leerer Monat: Abwesenheit eintragen, ebenfalls 44 px auf Touch.
    const september = within(screen.getByTestId('month-3-2026-09')).getByRole(
      'button'
    )
    expect(september).toHaveAccessibleName(
      'Erika Beispiel, September 2026: Abwesenheit eintragen'
    )
    expect(touchStyle(september)).toMatchObject({ 'min-height': '44px' })
    expect(screen.getByTestId('bar-31-2026-11')).toHaveAttribute(
      'data-status',
      'geplant'
    )
    // Geplanter einzelner Tag bleibt sichtbar: breiter und kräftiger Rand.
    expect(screen.getByTestId('bar-31-2026-11')).toHaveStyle({
      minWidth: '6px',
      borderStyle: 'dashed',
      borderWidth: '2px',
    })

    await waitFor(() =>
      expect(screen.getByTestId('balance-3')).toHaveTextContent('Rest 13')
    )
    // Am Handy liegt die Kontospalte weit rechts: der Rest steht auch unter
    // dem Namen (nur unter `sm` sichtbar).
    expect(screen.getByTestId('phone-balance-3')).toHaveTextContent('Rest 13')
    expect(screen.getByTestId('phone-balance-5')).toHaveTextContent(
      'Rest offen'
    )
    expect(screen.getByTestId('balance-3')).toHaveTextContent(
      'genehmigt 11 · geplant 3'
    )
    expect(screen.getByTestId('balance-3')).not.toHaveTextContent('verfallen')
    // Übertrag am 31.03. nicht verbraucht: steht als verfallen da.
    expect(screen.getByTestId('balance-4')).toHaveTextContent(
      'Rest 24genehmigt 0 · geplant 3 · verfallen 3'
    )
    // Ohne Anspruch: offen, nie 0.
    expect(screen.getByTestId('balance-5')).toHaveTextContent('Rest offen')
    expect(screen.getByTestId('balance-5')).toHaveTextContent('Anspruch offen')

    // Abwesenheit im Jahr antippen → bearbeiten wie in Woche und Monat.
    fireEvent.click(julyCell)
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
    expect(
      dialog().getByText('Abwesenheit bearbeiten – Erika Beispiel', {
        exact: false,
      })
    ).toBeInTheDocument()
    expect(dialog().getByLabelText(/^Von/)).toHaveValue('2026-07-27')
    fireEvent.click(dialog().getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )

    // Monat im Kopf antippen → Monatsansicht.
    fireEvent.click(
      screen.getByRole('button', { name: 'November 2026 als Monat öffnen' })
    )
    expect(mockReplace).toHaveBeenLastCalledWith(
      '/admin/dienstplan?ansicht=monat&monat=2026-11',
      { scroll: false }
    )
    expect(await screen.findByTestId('month-title')).toHaveTextContent(
      'November 2026'
    )
  })

  it('Jahr: leerer Monat legt eine Abwesenheit ab dem Ersten an', async () => {
    renderCalendar({ view: 'jahr', year: '2026' })
    await ready()
    fireEvent.click(
      within(screen.getByTestId('month-5-2026-09')).getByRole('button')
    )
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
    expect(
      dialog().getByText('Abwesenheit eintragen – Lena Neu', { exact: false })
    ).toBeInTheDocument()
    expect(dialog().getByLabelText(/^Von/)).toHaveValue('2026-09-01')
  })

  it('Jahr: nach dem Speichern einer Abwesenheit lädt das Konto neu', async () => {
    api.updateAbsence.mockReset().mockResolvedValue({
      data: { ...YEAR_URLAUB, note: 'Sommer' },
      warnings: [],
    })
    renderCalendar({ view: 'jahr', year: '2026' })
    await ready()
    await waitFor(() =>
      expect(screen.getByTestId('balance-3')).toHaveTextContent('Rest 13')
    )
    expect(api.fetchBalances).toHaveBeenCalledTimes(1)

    api.fetchBalances.mockResolvedValue([
      balance(3, { approvedDays: 12, remainingDays: 12 }),
    ])
    fireEvent.click(
      within(screen.getByTestId('month-3-2026-07')).getByRole('button')
    )
    fireEvent.change(dialog().getByLabelText('Notiz (optional)'), {
      target: { value: 'Sommer' },
    })
    fireEvent.click(dialog().getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(api.updateAbsence).toHaveBeenCalledWith(41, { note: 'Sommer' })
    )
    expect(
      await screen.findByText('Abwesenheit gespeichert.')
    ).toBeInTheDocument()
    expect(api.fetchBalances).toHaveBeenCalledTimes(2)
    expect(api.fetchBalances).toHaveBeenLastCalledWith(2026)
    await waitFor(() =>
      expect(screen.getByTestId('balance-3')).toHaveTextContent('Rest 12')
    )
    expect(screen.getByTestId('balance-3')).toHaveTextContent('genehmigt 12')
  })

  it('Jahr: Konto nicht geladen heißt „nicht geladen“, nicht 0', async () => {
    api.fetchBalances.mockRejectedValue(new Error('kaputt'))
    renderCalendar({ view: 'jahr', year: '2026' })
    await ready()
    await waitFor(() =>
      expect(screen.getByTestId('balance-3')).toHaveTextContent('nicht geladen')
    )
    // Kein eigener Hinweis über der Seite - es steht an der Spalte.
    expect(screen.getByTestId('balance-error')).toHaveTextContent(
      'Konto konnte nicht geladen werden'
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('eine Meldung gehört zum Zeitraum: beim Wechsel der Ansicht verschwindet sie', async () => {
    api.createShift.mockReset().mockResolvedValue({
      data: { ...SHIFT, id: 22, employeeId: 5, date: '2026-11-17' },
      warnings: [],
    })
    renderCalendar({ view: 'monat', month: '2026-11' })
    await ready()
    fireEvent.click(
      within(screen.getByTestId('cell-5-2026-11-17')).getByRole('button')
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Schicht anlegen' }))
    fireEvent.click(dialog().getByRole('button', { name: 'Früh 06:00–12:00' }))
    fireEvent.click(dialog().getByRole('button', { name: 'Anlegen' }))
    expect(await screen.findByText('Schicht angelegt.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Jahr' }))
    expect(await screen.findByTestId('year-title')).toHaveTextContent(
      'Jahr 2026'
    )
    expect(screen.queryByText('Schicht angelegt.')).not.toBeInTheDocument()
  })
})
