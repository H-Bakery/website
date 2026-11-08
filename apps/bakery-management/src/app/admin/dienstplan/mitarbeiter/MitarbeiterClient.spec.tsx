import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import MitarbeiterClient from './MitarbeiterClient'
import { fakeSession, WithSession } from '../../../../lib/testing/fakeSession'
import * as dienstplanApi from '../../../../lib/dienstplanApi'
import * as authApi from '../../../../lib/authApi'

jest.mock('../../../../lib/dienstplanApi', () => ({
  ...jest.requireActual('../../../../lib/dienstplanApi'),
  fetchEmployees: jest.fn(),
  createEmployee: jest.fn(),
  updateEmployee: jest.fn(),
}))
jest.mock('../../../../lib/authApi', () => ({
  fetchUsers: jest.fn(),
}))
const api = dienstplanApi as jest.Mocked<typeof dienstplanApi>
const auth = authApi as jest.Mocked<typeof authApi>

const NOW = '2026-11-05T08:00:00.000Z'

function employee(
  overrides: Partial<dienstplanApi.Employee>
): dienstplanApi.Employee {
  return {
    id: 1,
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
    ...overrides,
  }
}

// Erfundene Personen - das Repo ist öffentlich.
const EMPLOYEES: dienstplanApi.Employee[] = [
  employee({ id: 1 }),
  employee({
    id: 2,
    displayName: 'Max Muster',
    area: 'backstube',
    employmentType: 'vollzeit',
    weeklyHours: 40,
    entryDate: null,
    color: null,
  }),
  employee({
    id: 3,
    displayName: 'Anna Probe',
    area: 'verkauf',
    employmentType: 'minijob',
    weeklyHours: null,
  }),
  employee({
    id: 4,
    displayName: 'Otto Test',
    area: 'fahrer',
    active: false,
    exitDate: '2026-06-30',
  }),
]

function renderList() {
  return render(
    <WithSession value={fakeSession({ role: 'inhaber' })}>
      <MitarbeiterClient />
    </WithSession>
  )
}

function dialog() {
  return within(screen.getByRole('dialog'))
}

describe('Dienstplan - Mitarbeiterliste', () => {
  beforeEach(() => {
    api.fetchEmployees.mockReset().mockResolvedValue(EMPLOYEES)
    api.createEmployee.mockReset()
    auth.fetchUsers.mockReset().mockResolvedValue([
      {
        id: 7,
        username: 'test.verkauf',
        displayName: 'Test Verkauf',
        role: 'verkauf',
        active: true,
        hasPin: false,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ])
  })

  it('gruppiert die aktiven nach Bereich, Verkauf zuerst, mit Link zum Profil', async () => {
    renderList()
    const verkauf = await screen.findByRole('region', { name: /Verkauf/ })
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
    expect(headings).toEqual(['Verkauf (2)', 'Backstube (1)'])
    const names = within(verkauf)
      .getAllByRole('link')
      .map((l) => l.textContent)
    expect(names[0]).toContain('Anna Probe')
    expect(names[1]).toContain('Erika Beispiel')
    expect(screen.getByTestId('employee-1')).toHaveAttribute(
      'href',
      '/admin/dienstplan/mitarbeiter/1'
    )
    expect(screen.getByTestId('employee-1')).toHaveTextContent(
      'Teilzeit · 20 Std./Woche · seit 01.03.2025'
    )
    expect(screen.queryByText('Otto Test')).not.toBeInTheDocument()
  })

  it('filtert nach ausgeschieden und alle', async () => {
    renderList()
    await screen.findByText('Erika Beispiel')
    fireEvent.click(screen.getByRole('button', { name: 'Ausgeschieden' }))
    expect(screen.getByText('Otto Test')).toBeInTheDocument()
    expect(screen.queryByText('Erika Beispiel')).not.toBeInTheDocument()
    expect(
      within(screen.getByTestId('employee-4')).getByText('ausgeschieden')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }))
    expect(screen.getByText('Erika Beispiel')).toBeInTheDocument()
    expect(screen.getByText('Otto Test')).toBeInTheDocument()
  })

  it('zeigt eine leere Liste mit Hinweis', async () => {
    api.fetchEmployees.mockResolvedValue([])
    renderList()
    expect(
      await screen.findByText(/Noch keine Mitarbeiter/)
    ).toBeInTheDocument()
  })

  it('zeigt die deutsche Meldung der API, wenn das Laden scheitert', async () => {
    api.fetchEmployees.mockRejectedValue(
      new Error('Nur mit persönlicher Anmeldung.')
    )
    renderList()
    expect(
      await screen.findByText('Nur mit persönlicher Anmeldung.')
    ).toBeInTheDocument()
  })

  it('führt zum Kalender', async () => {
    renderList()
    expect(
      await screen.findByRole('link', { name: 'Kalender' })
    ).toHaveAttribute('href', '/admin/dienstplan')
  })

  it('legt einen Mitarbeiter an (Name Pflicht, Stunden geprüft, Login optional)', async () => {
    api.createEmployee.mockResolvedValue(
      employee({ id: 9, displayName: 'Lena Neu' })
    )
    renderList()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Neuer Mitarbeiter' })
    )
    const d = dialog()
    const anlegen = d.getByRole('button', { name: 'Anlegen' })
    expect(anlegen).toBeDisabled()
    fireEvent.change(d.getByLabelText(/^Name/), {
      target: { value: '  Lena Neu ' },
    })
    expect(anlegen).toBeEnabled()
    fireEvent.change(d.getByLabelText(/Wochenstunden/), {
      target: { value: '80' },
    })
    expect(d.getByText('Eine Zahl von 0 bis 60.')).toBeInTheDocument()
    expect(anlegen).toBeDisabled()
    fireEvent.change(d.getByLabelText(/Wochenstunden/), {
      target: { value: '12,5' },
    })
    fireEvent.change(d.getByLabelText(/Eintritt/), {
      target: { value: '2026-12-01' },
    })
    fireEvent.click(d.getByRole('radio', { name: 'Farbe #43A047' }))
    await waitFor(() => expect(auth.fetchUsers).toHaveBeenCalled())
    fireEvent.click(anlegen)

    await waitFor(() =>
      expect(api.createEmployee).toHaveBeenCalledWith({
        displayName: 'Lena Neu',
        area: 'verkauf',
        employmentType: null,
        weeklyHours: 12.5,
        entryDate: '2026-12-01',
        exitDate: null,
        color: '#43A047',
        userId: null,
        note: null,
      })
    )
    expect(await screen.findByText(/Lena Neu angelegt/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profil öffnen' })).toHaveAttribute(
      'href',
      '/admin/dienstplan/mitarbeiter/9'
    )
    expect(api.fetchEmployees).toHaveBeenCalledTimes(2)
  })

  it('zeigt einen Fehler der API im Dialog', async () => {
    api.createEmployee.mockRejectedValue(
      new Error('Das Austrittsdatum liegt vor dem Eintrittsdatum.')
    )
    renderList()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Neuer Mitarbeiter' })
    )
    fireEvent.change(dialog().getByLabelText(/^Name/), {
      target: { value: 'Lena Neu' },
    })
    fireEvent.click(dialog().getByRole('button', { name: 'Anlegen' }))
    expect(
      await dialog().findByText(
        'Das Austrittsdatum liegt vor dem Eintrittsdatum.'
      )
    ).toBeInTheDocument()
  })
})
