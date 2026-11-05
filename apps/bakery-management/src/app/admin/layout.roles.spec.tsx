import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import AdminLayout from './layout'
import { fakeSession, WithSession } from '../../lib/testing/fakeSession'
import type { SessionContextValue } from '../../lib/session'

let mockPathname = '/admin'
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}))

function renderLayout(path: string, session: SessionContextValue) {
  mockPathname = path
  return render(
    <WithSession value={session}>
      <AdminLayout>
        <div>Seiteninhalt</div>
      </AdminLayout>
    </WithSession>
  )
}

/** Die Navigation steht doppelt (Handy- und Desktop-Leiste). */
function desktopNav() {
  const drawers = document.querySelectorAll('.MuiDrawer-paper')
  return within(drawers[drawers.length - 1] as HTMLElement)
}

function navLabels(): string[] {
  return desktopNav()
    .getAllByRole('link', { hidden: true })
    .map(
      (link) =>
        link.querySelector('.MuiListItemText-primary')?.textContent ?? ''
    )
}

describe('AdminLayout mit Rollen (F1)', () => {
  beforeEach(() => mockReplace.mockReset())

  it('Verkauf sieht nur seine Seiten und nicht Finanzen/Benutzer', () => {
    renderLayout('/admin/products', fakeSession({ role: 'verkauf' }))
    const labels = navLabels()
    expect(labels).toEqual(
      expect.arrayContaining([
        'Dashboard',
        'Sammelstelle Mörsbach',
        'Produkte',
        'Verkaufspartner',
        'Einstellungen',
      ])
    )
    ;['Finanzen', 'Benutzer', 'Kassenberichte', 'Anmeldung', 'Shop'].forEach(
      (label) => expect(labels).not.toContain(label)
    )
    expect(screen.getByText('Seiteninhalt')).toBeInTheDocument()
  })

  it('Inhaber sieht „Benutzer“', () => {
    renderLayout('/admin', fakeSession({ role: 'inhaber' }))
    expect(navLabels()).toContain('Benutzer')
  })

  it('verbotene Seite: „Kein Zugriff“ statt Inhalt, Link zur Startseite', () => {
    renderLayout('/admin/finance', fakeSession({ role: 'fahrer' }))
    expect(screen.queryByText('Seiteninhalt')).not.toBeInTheDocument()
    expect(screen.getByText('Kein Zugriff')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Zur Startseite' })
    ).toHaveAttribute('href', '/admin/delivery/preorders')
  })

  it('zeigt Name, Rolle und Abmelden; Abmelden führt zum Ziel der Sitzung', async () => {
    const logout = jest.fn(async () => '/station')
    renderLayout(
      '/admin',
      fakeSession({ role: 'verkauf', sessionKind: 'station', logout })
    )
    expect(screen.getByTestId('session-user')).toHaveTextContent('Test verkauf')
    expect(screen.getByText('Verkauf · Station')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/station'))
    expect(logout).toHaveBeenCalled()
  })

  it('die Anmeldeseite steht ohne Navigation da', () => {
    renderLayout('/admin/login', fakeSession())
    expect(screen.getByText('Seiteninhalt')).toBeInTheDocument()
    expect(document.querySelector('.MuiDrawer-paper')).toBeNull()
  })
})
