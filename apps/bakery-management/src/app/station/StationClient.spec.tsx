import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import StationClient, { stationReturnPath } from './StationClient'
import { rememberLostAction } from '../../lib/lostActions'
import {
  savePreorderDraft,
  savePreorderEditDraft,
} from '../../lib/preorderDraft'
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

    describe('nach abgelaufener Sitzung (W4-verify r4)', () => {
      let session: Map<string, string>
      beforeEach(() => {
        session = new Map()
        const store = window.sessionStorage as unknown as Record<
          string,
          jest.Mock
        >
        store.getItem.mockImplementation((k: string) =>
          session.has(k) ? session.get(k) : null
        )
        store.setItem.mockImplementation((k: string, v: string) => {
          session.set(k, String(v))
        })
        store.removeItem.mockImplementation((k: string) => {
          session.delete(k)
        })
      })
      const verkauf = () =>
        jest.fn(async () => ({
          id: 2,
          username: 'test.verkauf',
          displayName: 'Test Verkauf',
          role: 'verkauf' as const,
        }))

      it('nennt die verlorene Übergabe und führt nach der PIN zur Abholliste zurück', async () => {
        const path =
          '/admin/preorders/abholliste?date=2026-11-07&point=gemeindehaus-oberdorf'
        rememberLostAction(
          'OB-2026-11-07-07 (Testfamilie U.): Übergabe mit Zahlung wurde NICHT gespeichert - die Sitzung war abgelaufen. Bitte wiederholen.',
          new Date(),
          path
        )
        api.fetchStationUsers.mockResolvedValue(USERS)
        const pinLogin = verkauf()
        renderStation(fakeSession({ pinLogin }))
        expect(
          await screen.findByTestId('station-lost-actions')
        ).toHaveTextContent('OB-2026-11-07-07 (Testfamilie U.)')
        fireEvent.click(await screen.findByText('Test Verkauf'))
        pressPin('0420')
        fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }))
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(path))
      })

      it('eine Seite, die die Rolle nicht öffnen darf, zählt nicht', async () => {
        rememberLostAction('x', new Date(), '/admin/finance')
        expect(
          stationReturnPath({ id: 2, role: 'verkauf' }, [
            { text: 'x', at: '', path: '/admin/finance' },
          ])
        ).toBe('/admin/preorders')
      })

      it('ein nicht gespeicherter Vorbestell-Entwurf derselben Person öffnet die Maske', async () => {
        savePreorderDraft(
          2,
          {
            customerName: 'Testkundin Entwurf',
            customerPhone: '',
            channel: 'telefon',
            pickupPointId: '',
            pickupDate: '',
            pickupTime: '',
            paid: false,
            note: '',
            lines: [],
          },
          null
        )
        expect(stationReturnPath({ id: 2, role: 'verkauf' }, [])).toBe(
          '/admin/preorders/neu'
        )
        // eine andere Person landet auf ihrer Startseite
        expect(stationReturnPath({ id: 3, role: 'verkauf' }, [])).toBe(
          '/admin/preorders'
        )
        // tippt sie selbst etwas an, bleibt der Entwurf von 2 (W4-verify r5)
        savePreorderDraft(
          3,
          {
            customerName: 'Testkunde Kollege',
            customerPhone: '',
            channel: 'telefon',
            pickupPointId: '',
            pickupDate: '',
            pickupTime: '',
            paid: false,
            note: '',
            lines: [],
          },
          null
        )
        expect(stationReturnPath({ id: 2, role: 'verkauf' }, [])).toBe(
          '/admin/preorders/neu'
        )
      })

      it('nicht gespeicherte Änderungen an einer Bestellung führen zu ihr zurück (W4-verify r6)', () => {
        savePreorderEditDraft(2, 5, '2026-11-06T09:00:00.000Z', {
          customerName: 'Testkundin Geändert',
          customerPhone: '',
          channel: 'telefon',
          pickupPointId: '',
          pickupDate: '2026-11-07',
          pickupTime: '',
          paid: false,
          note: 'Kunde ruft an: eine mehr',
          lines: [],
        })
        expect(stationReturnPath({ id: 2, role: 'verkauf' }, [])).toBe(
          '/admin/preorders/5'
        )
        expect(stationReturnPath({ id: 3, role: 'verkauf' }, [])).toBe(
          '/admin/preorders'
        )
      })
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

    it('ohne Verbindung: WLAN-Hinweis mit „Erneut versuchen“, kein „Failed to fetch“', async () => {
      api.fetchStationUsers.mockRejectedValue(new TypeError('Failed to fetch'))
      renderStation(fakeSession())
      expect(
        await screen.findByText(
          'Keine Verbindung zum Server – bitte WLAN prüfen.'
        )
      ).toBeInTheDocument()
      expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Erneut versuchen' })
      ).toBeInTheDocument()
      // Die Station bleibt eingerichtet - nur das Netz fehlt.
      expect(loadStation()).not.toBeNull()
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
