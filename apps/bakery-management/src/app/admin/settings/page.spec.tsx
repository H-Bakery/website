import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import SettingsPage from './page'
import { fakeSession, WithSession } from '../../../lib/testing/fakeSession'
import type { PilotRole } from '../../../lib/roles'

jest.mock('@bakery/shared/contexts', () => ({
  useTheme: () => ({
    mode: 'dark',
    setMode: jest.fn(),
    colorScheme: 'dark',
  }),
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
  })

  it('blendet im Pilotbetrieb Benachrichtigungen und E-Mail aus (keine API dafür)', () => {
    process.env.NEXT_PUBLIC_PILOT_MODE = '1'
    renderAs('inhaber')
    expect(screen.queryByText('Benachrichtigungen')).not.toBeInTheDocument()
    expect(screen.queryByText('E-Mail-Versand')).not.toBeInTheDocument()
    expect(screen.getByText('Darstellung')).toBeInTheDocument()
  })

  it('zeigt sie außerhalb des Pilotbetriebs weiter', () => {
    process.env.NEXT_PUBLIC_PILOT_MODE = '0'
    renderAs('inhaber')
    expect(screen.getByText('Benachrichtigungen')).toBeInTheDocument()
    expect(screen.getByText('E-Mail-Versand')).toBeInTheDocument()
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
