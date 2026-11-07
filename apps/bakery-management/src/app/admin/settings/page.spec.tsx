import React from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import SettingsPage from './page'
import { fakeSession, WithSession } from '../../../lib/testing/fakeSession'
import type { PilotRole } from '../../../lib/roles'

let mockNotificationsAvailable: boolean | null = true
let mockMode: 'light' | 'dark' | 'system' = 'dark'
const mockSetMode = jest.fn()

jest.mock('@bakery/shared/contexts', () => ({
  useTheme: () => ({
    mode: mockMode,
    setMode: mockSetMode,
    colorScheme: 'dark',
  }),
  useNotifications: () => ({ available: mockNotificationsAvailable }),
}))

jest.mock('@bakery/management/feature-settings', () => ({
  NotificationPreferences: () => <div>Benachrichtigungs-Einstellungen</div>,
}))

const ORIGINAL_PILOT = process.env.NEXT_PUBLIC_PILOT_MODE

function renderAs(
  role: PilotRole,
  sessionKind: 'personal' | 'station' = 'personal'
) {
  return renderWithTheme(
    <WithSession value={fakeSession({ role, sessionKind })}>
      <SettingsPage />
    </WithSession>
  )
}

describe('Einstellungen (F4)', () => {
  afterEach(() => {
    if (ORIGINAL_PILOT === undefined) delete process.env.NEXT_PUBLIC_PILOT_MODE
    else process.env.NEXT_PUBLIC_PILOT_MODE = ORIGINAL_PILOT
    mockNotificationsAvailable = true
    mockMode = 'dark'
    mockSetMode.mockClear()
  })

  it('Darstellung ist ein Schalter mit drei Stellungen (Layout-Kit)', () => {
    renderAs('inhaber')
    const group = screen.getByRole('group', { name: 'Farbschema' })
    expect(
      within(group).getByRole('button', { name: 'Dunkel' })
    ).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(group).getByRole('button', { name: 'System' }))
    expect(mockSetMode).toHaveBeenCalledWith('system')
    // Ein Tipp auf die gewählte Stellung ändert nichts (vorher: ein zweiter
    // Schalter setzte beim Ausschalten von „System“ immer Hell).
    mockSetMode.mockClear()
    fireEvent.click(within(group).getByRole('button', { name: 'Dunkel' }))
    expect(mockSetMode).not.toHaveBeenCalled()
  })

  it('„System“ sagt, was das Gerät gerade liefert', () => {
    mockMode = 'system'
    renderAs('inhaber')
    expect(screen.getByText(/derzeit dunkel/)).toBeInTheDocument()
  })

  it('ohne Pilotbetrieb, aber API ohne /api/notifications (404): Abschnitt fehlt still (W4)', () => {
    process.env.NEXT_PUBLIC_PILOT_MODE = '0'
    mockNotificationsAvailable = false
    renderAs('inhaber')
    expect(screen.queryByText('Benachrichtigungen')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Benachrichtigungs-Einstellungen')
    ).not.toBeInTheDocument()
    expect(screen.getByText('Darstellung')).toBeInTheDocument()
  })

  it('solange die erste Antwort aussteht, bleibt der Abschnitt stehen', () => {
    process.env.NEXT_PUBLIC_PILOT_MODE = '0'
    mockNotificationsAvailable = null
    renderAs('inhaber')
    expect(screen.getByText('Benachrichtigungen')).toBeInTheDocument()
  })

  it('blendet im Pilotbetrieb Benachrichtigungen und E-Mail aus (keine API dafür)', () => {
    process.env.NEXT_PUBLIC_PILOT_MODE = '1'
    renderAs('inhaber')
    expect(screen.queryByText('Benachrichtigungen')).not.toBeInTheDocument()
    expect(screen.queryByText('E-Mail-Versand')).not.toBeInTheDocument()
    expect(screen.getByText('Darstellung')).toBeInTheDocument()
  })

  it('zeigt Benachrichtigungen außerhalb des Pilotbetriebs weiter, E-Mail nie (Review r1)', () => {
    process.env.NEXT_PUBLIC_PILOT_MODE = '0'
    renderAs('inhaber')
    expect(screen.getByText('Benachrichtigungen')).toBeInTheDocument()
    // ohne Schalter und ohne Wirkung - kein Abschnitt, der nur vertröstet
    expect(screen.queryByText('E-Mail-Versand')).not.toBeInTheDocument()
  })

  it('verweist den Inhaber für Passwort und PIN auf „Benutzer“', () => {
    renderAs('inhaber')
    expect(screen.getByRole('link', { name: 'Benutzer' })).toHaveAttribute(
      'href',
      '/admin/users'
    )
  })

  it('zeigt Verkauf und der PIN-Station keinen Link, nur den Hinweis', () => {
    renderAs('verkauf')
    expect(screen.queryByRole('link', { name: 'Benutzer' })).toBeNull()
    expect(
      screen.getByText(/Der Inhaber setzt sie unter „Benutzer“ neu/)
    ).toBeInTheDocument()
  })

  it('auch der Inhaber an der PIN-Station verwaltet keine Benutzer', () => {
    renderAs('inhaber', 'station')
    expect(screen.queryByRole('link', { name: 'Benutzer' })).toBeNull()
  })
})
