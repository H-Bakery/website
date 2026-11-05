import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import StationClient from './StationClient'
import { fakeSession, WithSession } from '../../lib/testing/fakeSession'
import { useMemoryStorage } from '../../lib/testing/memoryStorage'
import { loadStation, saveStation } from '../../lib/authSession'
import type { SessionContextValue } from '../../lib/session'
import * as authApi from '../../lib/authApi'

jest.mock('../../lib/authApi')
const api = authApi as jest.Mocked<typeof authApi>

const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}))

const USERS: authApi.StationUser[] = [
  { id: 2, displayName: 'Test Verkauf', role: 'verkauf' },
  { id: 3, displayName: 'Test Backstube', role: 'backstube' },
]

function apiError(status: number, code: string, message: string) {
  return Object.assign(new Error(message), { status, code })
}

function renderStation(session: SessionContextValue) {
  return render(
    <WithSession value={session}>
      <StationClient />
    </WithSession>
  )
}

function pressPin(pin: string) {
  pin
    .split('')
    .forEach((digit) =>
      fireEvent.click(screen.getByRole('button', { name: digit }))
    )
}

describe('Station', () => {
  beforeEach(() => {
    // Nicht jest.resetAllMocks(): das nähme test-setup.ts die
    // ResizeObserver-Attrappe, die MUI braucht.
    Object.values(api).forEach((fn) => (fn as jest.Mock).mockReset?.())
    mockReplace.mockReset()
    useMemoryStorage()
  })

  describe('Gerät ist noch keine Station', () => {
    it('ohne Anmeldung: Hinweis und Link zur Inhaber-Anmeldung', async () => {
      renderStation(fakeSession())
      expect(
        await screen.findByRole('heading', { name: /Station einrichten/ })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('link', { name: 'Als Inhaber anmelden' })
      ).toHaveAttribute('href', '/admin/login?next=/station')
      expect(api.registerStation).not.toHaveBeenCalled()
    })

    it('Verkauf darf kein Gerät einrichten', async () => {
      renderStation(fakeSession({ role: 'verkauf' }))
      expect(
        await screen.findByText(/Nur ein Inhaber, der mit Benutzername/)
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /Gerät als Station/ })
      ).not.toBeInTheDocument()
    })

    it('Inhaber richtet ein: Token gespeichert, persönliche Sitzung beendet, Kacheln da', async () => {
      const logout = jest.fn(async () => '/admin/login')
      api.registerStation.mockResolvedValue({
        token: 'st_neu',
        station: {
          id: 5,
          name: 'Laden-Tablet',
          createdBy: 1,
          lastUsedAt: null,
          revokedAt: null,
          createdAt: '2026-11-05T08:00:00.000Z',
          updatedAt: '2026-11-05T08:00:00.000Z',
        },
      })
      api.fetchStationUsers.mockResolvedValue(USERS)
      renderStation(fakeSession({ role: 'inhaber', logout }))

      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Gerät als Station einrichten',
        })
      )
      expect(await screen.findByText('Test Verkauf')).toBeInTheDocument()
      expect(api.registerStation).toHaveBeenCalledWith('Laden-Tablet')
      expect(loadStation()).toEqual({
        token: 'st_neu',
        name: 'Laden-Tablet',
        id: 5,
      })
      expect(logout).toHaveBeenCalled()
      expect(api.fetchStationUsers).toHaveBeenCalledWith('st_neu')
      expect(
        screen.getByText(/Station „Laden-Tablet“ ist eingerichtet/)
      ).toBeInTheDocument()
    })
  })

  describe('Gerät ist Station', () => {
    beforeEach(() => {
      saveStation({ token: 'st_x', name: 'Laden-Tablet', id: 5 })
    })

    it('Name antippen → PIN → angemeldet, weiter zur Startseite der Rolle', async () => {
      api.fetchStationUsers.mockResolvedValue(USERS)
      const pinLogin = jest.fn(async () => ({
        id: 2,
        username: 'test.verkauf',
        displayName: 'Test Verkauf',
        role: 'verkauf' as const,
      }))
      renderStation(fakeSession({ pinLogin }))

      fireEvent.click(await screen.findByText('Test Verkauf'))
      expect(
        screen.getByRole('heading', { name: 'PIN für Test Verkauf' })
      ).toBeInTheDocument()
      const submit = screen.getByRole('button', { name: 'Anmelden' })
      pressPin('042')
      expect(submit).toBeDisabled()
      pressPin('0')
      expect(submit).toBeEnabled()
      fireEvent.click(submit)

      // Verkauf startet seit M1 (P3 gebaut) in den Vorbestellungen
      await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith('/admin/preorders')
      )
      // führende Null bleibt: die PIN ist ein String
      expect(pinLogin).toHaveBeenCalledWith('st_x', 2, '0420')
    })

    it('falsche PIN: deutsche Meldung, Eingabe geleert, keine Weiterleitung', async () => {
      api.fetchStationUsers.mockResolvedValue(USERS)
      const pinLogin = jest.fn(async () => {
        throw apiError(
          401,
          'invalid_pin',
          'PIN falsch oder Benutzer an dieser Station nicht verfügbar.'
        )
      })
      renderStation(fakeSession({ pinLogin }))
      fireEvent.click(await screen.findByText('Test Backstube'))
      pressPin('1111')
      fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }))
      expect(await screen.findByText(/PIN falsch/)).toBeInTheDocument()
      expect(screen.getByTestId('pin-dots')).toHaveAttribute(
        'aria-label',
        '0 von höchstens 6 Ziffern eingegeben'
      )
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it('„Andere Person“ führt zurück zu den Kacheln', async () => {
      api.fetchStationUsers.mockResolvedValue(USERS)
      renderStation(fakeSession())
      fireEvent.click(await screen.findByText('Test Verkauf'))
      fireEvent.click(screen.getByRole('button', { name: 'Andere Person' }))
      expect(
        screen.getByRole('heading', { name: 'Wer bist du?' })
      ).toBeInTheDocument()
    })

    it('widerrufene Station: Token vergessen, zurück zur Einrichtung', async () => {
      api.fetchStationUsers.mockRejectedValue(
        apiError(
          403,
          'station_required',
          'Dieses Gerät ist nicht als Station eingerichtet.'
        )
      )
      renderStation(fakeSession())
      expect(
        await screen.findByText(/Diese Station wurde widerrufen/)
      ).toBeInTheDocument()
      expect(loadStation()).toBeNull()
    })

    it('zeigt eine laufende Sitzung mit Abmelden', async () => {
      api.fetchStationUsers.mockResolvedValue(USERS)
      renderStation(fakeSession({ role: 'verkauf', sessionKind: 'station' }))
      expect(await screen.findByText(/Angemeldet:/)).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Abmelden' })
      ).toBeInTheDocument()
    })

    it('ohne Benutzer mit PIN: Hinweis auf die Benutzerverwaltung', async () => {
      api.fetchStationUsers.mockResolvedValue([])
      renderStation(fakeSession())
      expect(
        await screen.findByText(/Noch hat niemand eine PIN/)
      ).toBeInTheDocument()
    })
  })
})
