import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import UsersClient from './UsersClient'
import { fakeSession, WithSession } from '../../../lib/testing/fakeSession'
import * as authApi from '../../../lib/authApi'

jest.mock('../../../lib/authApi')
const api = authApi as jest.Mocked<typeof authApi>

const NOW = '2026-11-05T08:00:00.000Z'
const USERS: authApi.AdminUser[] = [
  {
    id: 1,
    username: 'test.inhaber',
    displayName: 'Test Inhaber',
    role: 'inhaber',
    active: true,
    hasPin: false,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 2,
    username: 'test.verkauf',
    displayName: 'Test Verkauf',
    role: 'verkauf',
    active: true,
    hasPin: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
]
const STATIONS: authApi.Station[] = [
  {
    id: 5,
    name: 'Laden-Tablet',
    createdBy: 1,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
]

function renderUsers() {
  return render(
    <WithSession value={fakeSession({ role: 'inhaber' })}>
      <UsersClient />
    </WithSession>
  )
}

function dialog() {
  return within(screen.getByRole('dialog'))
}

describe('Benutzerverwaltung', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => (fn as jest.Mock).mockReset?.())
    api.fetchUsers.mockResolvedValue(USERS)
    api.fetchStations.mockResolvedValue(STATIONS)
  })

  it('listet Benutzer mit Rolle, Status und PIN sowie die Stationen', async () => {
    renderUsers()
    const row = await screen.findByTestId('user-row-test.verkauf')
    expect(within(row).getByText('Test Verkauf')).toBeInTheDocument()
    expect(within(row).getByText('Verkauf')).toBeInTheDocument()
    expect(within(row).getByText('aktiv')).toBeInTheDocument()
    expect(within(row).getByText('gesetzt')).toBeInTheDocument()
    expect(screen.getByText('Laden-Tablet')).toBeInTheDocument()
  })

  it('legt einen Benutzer an (Benutzername klein, PIN optional)', async () => {
    api.createUser.mockResolvedValue({ ...USERS[1], id: 3 })
    renderUsers()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Neuer Benutzer' })
    )
    const d = dialog()
    const anlegen = d.getByRole('button', { name: 'Anlegen' })
    fireEvent.change(d.getByLabelText(/Benutzername/), {
      target: { value: ' Test.Neu ' },
    })
    fireEvent.change(d.getByLabelText(/Anzeigename/), {
      target: { value: 'Test Neu' },
    })
    fireEvent.change(d.getByLabelText(/^Passwort/), {
      target: { value: 'kurz' },
    })
    expect(d.getByText('Mindestens 8 Zeichen.')).toBeInTheDocument()
    expect(anlegen).toBeDisabled()
    fireEvent.change(d.getByLabelText(/^Passwort/), {
      target: { value: 'geheim123' },
    })
    fireEvent.change(d.getByLabelText(/PIN/), { target: { value: '12a' } })
    expect(d.getByLabelText(/PIN/)).toHaveValue('12')
    expect(anlegen).toBeDisabled()
    fireEvent.change(d.getByLabelText(/PIN/), { target: { value: '0420' } })
    expect(anlegen).toBeEnabled()
    fireEvent.click(anlegen)

    await waitFor(() =>
      expect(api.createUser).toHaveBeenCalledWith({
        username: 'test.neu',
        displayName: 'Test Neu',
        role: 'verkauf',
        password: 'geheim123',
        pin: '0420',
      })
    )
    expect(
      await screen.findByText('Test Verkauf angelegt.')
    ).toBeInTheDocument()
    expect(api.fetchUsers).toHaveBeenCalledTimes(2)
  })

  it('ändert nur, was geändert wurde, und zeigt die Meldung der API', async () => {
    api.updateUser.mockRejectedValue(
      Object.assign(
        new Error(
          'Es muss mindestens ein aktives Konto mit der Rolle Inhaber bleiben.'
        ),
        { status: 409, code: 'last_inhaber' }
      )
    )
    renderUsers()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Test Inhaber bearbeiten' })
    )
    const d = dialog()
    expect(d.getByRole('button', { name: 'Speichern' })).toBeDisabled()
    fireEvent.mouseDown(d.getByRole('combobox'))
    // alle fünf Rollen stehen zur Wahl - auch die Backstubenleitung
    expect(
      screen.getAllByRole('option').map((option) => option.textContent)
    ).toEqual([
      'Inhaber',
      'Verkauf',
      'Backstube',
      'Backstubenleitung',
      'Fahrer',
    ])
    fireEvent.click(screen.getByRole('option', { name: 'Backstube' }))
    fireEvent.click(d.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(api.updateUser).toHaveBeenCalledWith(1, { role: 'backstube' })
    )
    expect(
      await screen.findByText(/mindestens ein aktives Konto/)
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('deaktiviert einen Benutzer', async () => {
    api.updateUser.mockResolvedValue({ ...USERS[1], active: false })
    renderUsers()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Test Verkauf bearbeiten' })
    )
    fireEvent.click(dialog().getByRole('checkbox'))
    fireEvent.click(dialog().getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(api.updateUser).toHaveBeenCalledWith(2, { active: false })
    )
  })

  it('setzt ein Passwort', async () => {
    api.setUserPassword.mockResolvedValue(USERS[1])
    renderUsers()
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Passwort für Test Verkauf setzen',
      })
    )
    fireEvent.change(dialog().getByLabelText(/Neues Passwort/), {
      target: { value: 'neuespasswort' },
    })
    fireEvent.click(dialog().getByRole('button', { name: 'Passwort setzen' }))
    await waitFor(() =>
      expect(api.setUserPassword).toHaveBeenCalledWith(2, 'neuespasswort')
    )
  })

  it('setzt und entfernt eine PIN', async () => {
    api.setUserPin.mockResolvedValue(USERS[1])
    renderUsers()
    fireEvent.click(
      await screen.findByRole('button', { name: 'PIN für Test Verkauf setzen' })
    )
    fireEvent.change(dialog().getByLabelText(/Neue PIN/), {
      target: { value: '987654' },
    })
    fireEvent.click(dialog().getByRole('button', { name: 'PIN setzen' }))
    await waitFor(() =>
      expect(api.setUserPin).toHaveBeenCalledWith(2, '987654')
    )
    expect(
      await screen.findByText('Neue PIN für Test Verkauf.')
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'PIN für Test Verkauf setzen' })
    )
    fireEvent.click(dialog().getByRole('button', { name: 'PIN entfernen' }))
    await waitFor(() => expect(api.setUserPin).toHaveBeenCalledWith(2, null))
  })

  it('widerruft eine Station nach Rückfrage', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true)
    api.revokeStation.mockResolvedValue({ ...STATIONS[0], revokedAt: NOW })
    renderUsers()
    fireEvent.click(await screen.findByRole('button', { name: 'Widerrufen' }))
    await waitFor(() => expect(api.revokeStation).toHaveBeenCalledWith(5))
    confirm.mockRestore()
  })

  it('zeigt bei einem Ladefehler keine leeren Listen, sondern „Erneut versuchen“ (Review r1)', async () => {
    api.fetchUsers.mockRejectedValueOnce(new Error('Interner Testfehler.'))
    renderUsers()
    expect(await screen.findByText('Interner Testfehler.')).toBeInTheDocument()
    // Nie behaupten, es gäbe keine Konten oder Stationen
    expect(screen.queryByText(/Konten \(0\)/)).toBeNull()
    expect(screen.queryByText('Noch keine Benutzer.')).toBeNull()
    expect(screen.queryByText(/Stationen \(0 aktiv\)/)).toBeNull()
    expect(screen.queryByText('Noch keine Station.')).toBeNull()
    // Kopf bleibt gleich
    expect(
      screen.getByRole('button', { name: 'Neuer Benutzer' })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByText('Konten (2)')).toBeInTheDocument()
    expect(screen.queryByText('Interner Testfehler.')).toBeNull()
  })

  it('zeigt einen Ladefehler (z. B. PIN-Sitzung) als Meldung', async () => {
    api.fetchUsers.mockRejectedValue(
      new Error('Nur mit persönlicher Anmeldung (Benutzername und Passwort).')
    )
    renderUsers()
    expect(
      await screen.findByText(/Nur mit persönlicher Anmeldung/)
    ).toBeInTheDocument()
  })
})
