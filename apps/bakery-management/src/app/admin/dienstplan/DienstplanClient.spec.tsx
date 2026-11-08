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
  fetchShiftTemplates: jest.fn(),
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
      verkaufBesetzt: shifts.filter((s) => s.date === date).length,
    })),
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
  props: { week?: string; view?: string; area?: string } = {
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

    const monday = screen.getByTestId('day-2026-11-09')
    expect(monday).toHaveTextContent('Ruhetag')
    expect(monday).toHaveTextContent('geschlossen')
    expect(screen.getByTestId('day-2026-11-10')).toHaveTextContent(
      'Verkauf besetzt: 1'
    )
    expect(screen.getByTestId('day-2026-11-10')).toHaveTextContent('heute')
    expect(screen.getByTestId('staffing-2026-11-11')).toHaveTextContent(
      'Verkauf besetzt: 0'
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

  it('eine Woche ohne Schichten heißt „nichts geplant“, nicht 0', async () => {
    api.fetchCalendar.mockResolvedValue(calendar({ shifts: [] }))
    renderCalendar()
    await ready()
    expect(screen.getByTestId('staffing-2026-11-10')).toHaveTextContent(
      'nichts geplant'
    )
    expect(screen.queryByText(/Verkauf besetzt/)).not.toBeInTheDocument()
    expect(screen.getByTestId('staffing-2026-11-09')).toHaveTextContent(
      'geschlossen'
    )
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
    expect(screen.getByTestId('staffing-2026-11-11')).toHaveTextContent(
      'geschlossen'
    )
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
      screen.getByRole('progressbar', { name: 'Dienstplan wird geladen' })
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
      screen.queryByRole('progressbar', { name: 'Dienstplan wird geladen' })
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

    rerender(<DienstplanClient week="2026-11-25" view="monat" />)
    expect(screen.getByText(/Die Monatsansicht folgt/)).toBeInTheDocument()
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

  it('Monat und Jahr sind noch Platzhalter (Ansicht in der URL)', async () => {
    renderCalendar()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Monat' }))
    expect(screen.getByText(/Die Monatsansicht folgt/)).toBeInTheDocument()
    expect(mockReplace).toHaveBeenLastCalledWith(
      '/admin/dienstplan?woche=2026-11-09&ansicht=monat',
      { scroll: false }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Jahr' }))
    expect(screen.getByText(/Die Jahresansicht folgt/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Woche' }))
    expect(await screen.findByTestId('row-3')).toBeInTheDocument()
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

  it('außerhalb des Verkaufs öffnet die leere Zelle gleich die Abwesenheit', async () => {
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
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
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
