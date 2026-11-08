import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import MitarbeiterProfilClient from './MitarbeiterProfilClient'
import {
  fakeSession,
  WithSession,
} from '../../../../../lib/testing/fakeSession'
import * as dienstplanApi from '../../../../../lib/dienstplanApi'
import * as authApi from '../../../../../lib/authApi'

jest.mock('../../../../../lib/dienstplanApi', () => ({
  ...jest.requireActual('../../../../../lib/dienstplanApi'),
  fetchEmployeeProfile: jest.fn(),
  updateEmployee: jest.fn(),
  saveEntitlement: jest.fn(),
  createAbsence: jest.fn(),
  updateAbsence: jest.fn(),
  deleteAbsence: jest.fn(),
}))
jest.mock('../../../../../lib/authApi', () => ({
  fetchUsers: jest.fn(async () => []),
}))
const api = dienstplanApi as jest.Mocked<typeof dienstplanApi>
const auth = authApi as jest.Mocked<typeof authApi>

const NOW = '2026-11-05T08:00:00.000Z'

// Erfundene Person - das Repo ist öffentlich.
const EMPLOYEE: dienstplanApi.Employee = {
  id: 3,
  displayName: 'Erika Beispiel',
  area: 'verkauf',
  color: '#1E88E5',
  employmentType: 'teilzeit',
  weeklyHours: 20,
  entryDate: '2025-03-01',
  exitDate: null,
  active: true,
  userId: null,
  note: null,
  createdAt: NOW,
  updatedAt: NOW,
}

const BALANCE_OK: dienstplanApi.VacationBalance = {
  employeeId: 3,
  status: 'ok',
  year: 2026,
  entitlementDays: 24,
  carryoverDays: 3,
  carryoverDeadline: '2026-03-31',
  approvedDays: 5.5,
  plannedDays: 2,
  entitlement: 24,
  months: 12,
  fullYear: true,
  carryoverUsed: 2,
  carryoverExpired: 1,
  carryoverOpen: 0,
  remainingDays: 20.5,
  remainingAfterPlannedDays: 18.5,
}

const BALANCE_NO_CONFIG: dienstplanApi.VacationBalance = {
  ...BALANCE_OK,
  year: 2027,
  status: 'no-config',
  entitlementDays: null,
  carryoverDays: null,
  carryoverDeadline: '2027-03-31',
  approvedDays: 0,
  plannedDays: 1,
  entitlement: null,
  months: 12,
  fullYear: true,
  carryoverUsed: null,
  carryoverExpired: null,
  carryoverOpen: null,
  remainingDays: null,
  remainingAfterPlannedDays: null,
}

const ABSENCE: dienstplanApi.ProfileAbsence = {
  id: 11,
  employeeId: 3,
  type: 'urlaub',
  status: 'genehmigt',
  startDate: '2026-08-04',
  endDate: '2026-08-08',
  halfDay: false,
  days: 5,
  daysInYear: 5,
  note: null,
}

function profile(
  overrides: Partial<dienstplanApi.EmployeeProfile> = {}
): dienstplanApi.EmployeeProfile {
  return {
    employee: EMPLOYEE,
    year: 2026,
    entitlements: [
      { employeeId: 3, year: 2026, entitlementDays: 24, carryoverDays: 3 },
    ],
    balance: BALANCE_OK,
    absences: [ABSENCE],
    upcomingShifts: [
      {
        id: 21,
        employeeId: 3,
        date: '2026-11-10',
        startTime: '06:00',
        endTime: '12:00',
        breakMinutes: 30,
        minutes: 330,
        note: null,
      },
    ],
    closedWeekdays: { weekdays: [1], source: 'default' },
    ...overrides,
  }
}

function renderProfile() {
  return render(
    <WithSession value={fakeSession({ role: 'inhaber' })}>
      <MitarbeiterProfilClient id={3} />
    </WithSession>
  )
}

function dialog() {
  return within(screen.getByRole('dialog'))
}

describe('Dienstplan - Mitarbeiterprofil', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    api.fetchEmployeeProfile.mockReset().mockResolvedValue(profile())
    api.updateEmployee.mockReset()
    api.saveEntitlement.mockReset()
    api.createAbsence.mockReset()
    api.updateAbsence.mockReset()
    api.deleteAbsence.mockReset()
    auth.fetchUsers.mockResolvedValue([])
  })

  it('zeigt Stammdaten, Urlaubskonto, Abwesenheiten und kommende Schichten', async () => {
    renderProfile()
    expect(
      await screen.findByRole('heading', { name: 'Erika Beispiel' })
    ).toBeInTheDocument()
    expect(api.fetchEmployeeProfile).toHaveBeenCalledWith(3, undefined)
    expect(screen.getByText('Teilzeit')).toBeInTheDocument()
    expect(screen.getByText('01.03.2025')).toBeInTheDocument()

    expect(screen.getByTestId('balance-entitlement')).toHaveTextContent('24')
    expect(screen.getByTestId('balance-carryover')).toHaveTextContent('3')
    expect(screen.getByTestId('balance-approved')).toHaveTextContent('5,5')
    expect(screen.getByTestId('balance-planned')).toHaveTextContent('2')
    expect(screen.getByTestId('balance-expired')).toHaveTextContent('1')
    expect(screen.getByTestId('balance-remaining')).toHaveTextContent('20,5')
    expect(
      screen.getByTestId('balance-remaining-after-planned')
    ).toHaveTextContent('18,5')

    const absence = screen.getByTestId('absence-11')
    expect(absence).toHaveTextContent('04.08.2026 – 08.08.2026')
    expect(absence).toHaveTextContent('Urlaub')
    expect(absence).toHaveTextContent('genehmigt')
    expect(within(absence).getByRole('cell', { name: '5' })).toBeInTheDocument()

    const shift = screen.getByTestId('upcoming-shift-21')
    expect(within(shift).getByText('Di, 10.11.2026')).toBeInTheDocument()
    expect(within(shift).getByText('06:00–12:00')).toBeInTheDocument()
    expect(within(shift).getByText('5:30 h · 30 min Pause')).toBeInTheDocument()

    // Vom Profil in den Kalender, gefiltert auf den Bereich der Person.
    expect(screen.getByRole('link', { name: 'Im Kalender' })).toHaveAttribute(
      'href',
      '/admin/dienstplan?bereich=verkauf'
    )
  })

  it('Urlaub über den Jahreswechsel: Spalte zeigt den Anteil im Jahr, die Summe darunter', async () => {
    api.fetchEmployeeProfile.mockResolvedValue(
      profile({
        absences: [
          {
            ...ABSENCE,
            id: 13,
            startDate: '2026-12-28',
            endDate: '2027-01-08',
            days: 9.5,
            daysInYear: 3.5,
          },
        ],
      })
    )
    renderProfile()
    const row = await screen.findByTestId('absence-13')
    const cell = within(row).getByText('3,5').closest('td')
    expect(cell).toHaveTextContent('3,5von insgesamt 9,5')
  })

  it('Anspruch je Jahr steht zugeklappt unter dem Konto', async () => {
    api.saveEntitlement.mockResolvedValue({
      employeeId: 3,
      year: 2026,
      entitlementDays: 24,
      carryoverDays: 2,
    })
    renderProfile()
    await screen.findByRole('heading', { name: 'Erika Beispiel' })
    expect(
      screen.queryByRole('button', { name: 'Anspruch 2026 bearbeiten' })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Anspruch je Jahr' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Anspruch 2026 bearbeiten' })
    )
    expect(dialog().getByLabelText(/Übertrag aus 2025/)).toHaveValue('3')
  })

  it('ohne Anspruch: „offen“, nie 0 - und blättert ins nächste Jahr', async () => {
    renderProfile()
    await screen.findByRole('heading', { name: 'Erika Beispiel' })
    api.fetchEmployeeProfile.mockResolvedValue(
      profile({ year: 2027, balance: BALANCE_NO_CONFIG, absences: [] })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Nächstes Jahr' }))
    expect(
      await screen.findByRole('heading', { name: 'Urlaubskonto 2027' })
    ).toBeInTheDocument()
    expect(api.fetchEmployeeProfile).toHaveBeenLastCalledWith(3, 2027)
    expect(
      screen.getByText(/Für 2027 ist kein Urlaubsanspruch erfasst/)
    ).toBeInTheDocument()
    expect(screen.getByTestId('balance-entitlement')).toHaveTextContent('offen')
    expect(screen.getByTestId('balance-remaining')).toHaveTextContent('offen')
    expect(
      screen.getByTestId('balance-remaining-after-planned')
    ).toHaveTextContent('offen')
    expect(screen.getByTestId('balance-carryover')).toHaveTextContent('–')
    expect(screen.getByTestId('balance-planned')).toHaveTextContent('1')
    expect(screen.getByText('Keine Abwesenheiten in 2027.')).toBeInTheDocument()
  })

  it('zeigt „nicht beschäftigt“ statt eines Kontos', async () => {
    api.fetchEmployeeProfile.mockResolvedValue(
      profile({
        balance: { ...BALANCE_NO_CONFIG, year: 2026, status: 'not-employed' },
      })
    )
    renderProfile()
    expect(
      await screen.findByText(/In 2026 nicht beschäftigt/)
    ).toBeInTheDocument()
    expect(screen.queryByTestId('balance-remaining')).not.toBeInTheDocument()
  })

  it('speichert den Anspruch des Jahres; leer = offen', async () => {
    api.saveEntitlement.mockResolvedValue({
      employeeId: 3,
      year: 2026,
      entitlementDays: 26,
      carryoverDays: null,
    })
    renderProfile()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Anspruch und Übertrag 2026' })
    )
    const d = dialog()
    expect(d.getByLabelText(/Jahresanspruch/)).toHaveValue('24')
    fireEvent.change(d.getByLabelText(/Jahresanspruch/), {
      target: { value: '400' },
    })
    expect(d.getByRole('button', { name: 'Speichern' })).toBeDisabled()
    fireEvent.change(d.getByLabelText(/Jahresanspruch/), {
      target: { value: '26' },
    })
    fireEvent.change(d.getByLabelText(/Übertrag aus 2025/), {
      target: { value: '' },
    })
    fireEvent.click(d.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(api.saveEntitlement).toHaveBeenCalledWith(3, 2026, {
        entitlementDays: 26,
        carryoverDays: null,
      })
    )
    expect(
      await screen.findByText('Anspruch 2026 gespeichert.')
    ).toBeInTheDocument()
    expect(api.fetchEmployeeProfile).toHaveBeenCalledTimes(2)
  })

  it('trägt eine Abwesenheit ein und zeigt Hinweise der API', async () => {
    api.createAbsence.mockResolvedValue({
      data: { ...ABSENCE, id: 12 },
      warnings: [
        {
          code: 'shift_overlap',
          message: 'An diesen Tagen sind Schichten eingetragen: 10.11.2026.',
        },
      ],
    })
    renderProfile()
    fireEvent.click(await screen.findByRole('button', { name: 'Eintragen' }))
    const d = dialog()
    fireEvent.change(d.getByLabelText(/^Von/), {
      target: { value: '2026-11-10' },
    })
    expect(d.getByLabelText(/^Bis/)).toHaveValue('2026-11-10')
    fireEvent.click(d.getByLabelText(/Halber Tag/))
    fireEvent.change(d.getByLabelText(/Notiz/), {
      target: { value: 'Termin' },
    })
    fireEvent.click(d.getByRole('button', { name: 'Eintragen' }))
    await waitFor(() =>
      expect(api.createAbsence).toHaveBeenCalledWith({
        employeeId: 3,
        type: 'urlaub',
        status: 'geplant',
        startDate: '2026-11-10',
        endDate: '2026-11-10',
        halfDay: true,
        note: 'Termin',
      })
    )
    expect(
      await screen.findByText(/Hinweis: An diesen Tagen sind Schichten/)
    ).toBeInTheDocument()
  })

  it('Halbtag nur für einen Tag, Ende nicht vor Beginn', async () => {
    renderProfile()
    fireEvent.click(await screen.findByRole('button', { name: 'Eintragen' }))
    const d = dialog()
    fireEvent.change(d.getByLabelText(/^Von/), {
      target: { value: '2026-12-21' },
    })
    fireEvent.change(d.getByLabelText(/^Bis/), {
      target: { value: '2026-12-23' },
    })
    expect(d.getByLabelText(/Halber Tag/)).toBeDisabled()
    fireEvent.change(d.getByLabelText(/^Bis/), {
      target: { value: '2026-12-20' },
    })
    expect(d.getByText('Liegt vor dem Beginn.')).toBeInTheDocument()
    expect(d.getByRole('button', { name: 'Eintragen' })).toBeDisabled()
  })

  it('ändert eine Abwesenheit und schickt nur die Änderung', async () => {
    api.updateAbsence.mockResolvedValue({
      data: { ...ABSENCE, status: 'geplant' },
      warnings: [],
    })
    renderProfile()
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Abwesenheit 04.08.2026 – 08.08.2026 bearbeiten',
      })
    )
    const d = dialog()
    expect(d.getByRole('button', { name: 'Speichern' })).toBeDisabled()
    fireEvent.mouseDown(d.getByLabelText('Status'))
    fireEvent.click(screen.getByRole('option', { name: 'geplant' }))
    fireEvent.click(d.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(api.updateAbsence).toHaveBeenCalledWith(11, {
        status: 'geplant',
      })
    )
    expect(
      await screen.findByText('Abwesenheit gespeichert.')
    ).toBeInTheDocument()
  })

  it('löscht eine Abwesenheit nach Rückfrage', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true)
    api.deleteAbsence.mockResolvedValue(undefined)
    renderProfile()
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Abwesenheit 04.08.2026 – 08.08.2026 löschen',
      })
    )
    expect(confirm).toHaveBeenCalled()
    await waitFor(() => expect(api.deleteAbsence).toHaveBeenCalledWith(11))
    expect(await screen.findByText('Abwesenheit gelöscht.')).toBeInTheDocument()
  })

  it('Ausscheiden: Rückfrage, Fehler der API (Schichten ab heute) sichtbar', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true)
    api.updateEmployee.mockRejectedValue(
      new Error('Es gibt noch Schichten ab heute - bitte zuerst löschen.')
    )
    renderProfile()
    fireEvent.click(await screen.findByRole('button', { name: 'Ausscheiden' }))
    await waitFor(() =>
      expect(api.updateEmployee).toHaveBeenCalledWith(3, { active: false })
    )
    expect(
      await screen.findByText(
        'Es gibt noch Schichten ab heute - bitte zuerst löschen.'
      )
    ).toBeInTheDocument()
  })

  it('bearbeitet die Stammdaten und schickt nur Geändertes', async () => {
    api.updateEmployee.mockResolvedValue({ ...EMPLOYEE, weeklyHours: 25 })
    renderProfile()
    fireEvent.click(await screen.findByRole('button', { name: 'Bearbeiten' }))
    const d = dialog()
    expect(d.getByRole('button', { name: 'Speichern' })).toBeDisabled()
    fireEvent.change(d.getByLabelText(/Wochenstunden/), {
      target: { value: '25' },
    })
    fireEvent.click(d.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(api.updateEmployee).toHaveBeenCalledWith(3, { weeklyHours: 25 })
    )
  })

  it('Backstube: keine Schichten, Hinweis statt leerer Liste', async () => {
    api.fetchEmployeeProfile.mockResolvedValue(
      profile({
        employee: { ...EMPLOYEE, area: 'backstube' },
        upcomingShifts: [],
      })
    )
    renderProfile()
    expect(
      await screen.findByText('Schichten gibt es nur im Verkauf.')
    ).toBeInTheDocument()
  })

  it('zeigt die Meldung der API, wenn das Profil fehlt', async () => {
    api.fetchEmployeeProfile.mockRejectedValue(
      new Error('Mitarbeiter nicht gefunden.')
    )
    renderProfile()
    expect(
      await screen.findByText('Mitarbeiter nicht gefunden.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Alle Mitarbeiter' })
    ).toHaveAttribute('href', '/admin/dienstplan/mitarbeiter')
  })
})
