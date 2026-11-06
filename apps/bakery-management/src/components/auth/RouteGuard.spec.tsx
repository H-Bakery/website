import React from 'react'
import { render, screen } from '@testing-library/react'
import RouteGuard, { anonymousRedirect } from './RouteGuard'
import { fakeSession, WithSession } from '../../lib/testing/fakeSession'
import { useMemoryStorage } from '../../lib/testing/memoryStorage'
import { saveStation } from '../../lib/authSession'
import type { SessionContextValue } from '../../lib/session'

const mockReplace = jest.fn()
let mockPathname = '/admin/finance'
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}))

function renderGuard(path: string, session: SessionContextValue) {
  mockPathname = path
  return render(
    <WithSession value={session}>
      <RouteGuard>
        <div>Geschützter Inhalt</div>
      </RouteGuard>
    </WithSession>
  )
}

describe('RouteGuard', () => {
  beforeEach(() => {
    mockReplace.mockReset()
    useMemoryStorage()
  })

  it('zeigt während der Prüfung nur den Ladezustand', () => {
    renderGuard('/admin/finance', fakeSession({ status: 'loading' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Anmeldung wird geprüft'
    )
    expect(screen.queryByText('Geschützter Inhalt')).not.toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('leitet ohne Sitzung zur Anmeldung mit ?next= um - ohne den Inhalt zu zeigen', () => {
    renderGuard('/admin/finance', fakeSession())
    expect(screen.queryByText('Geschützter Inhalt')).not.toBeInTheDocument()
    expect(mockReplace).toHaveBeenCalledWith(
      '/admin/login?next=%2Fadmin%2Ffinance'
    )
  })

  it('leitet auf einer Station zu den Namenskacheln', () => {
    saveStation({ token: 'st_x', name: 'Laden' })
    renderGuard('/admin', fakeSession())
    expect(mockReplace).toHaveBeenCalledWith('/station')
  })

  it('zeigt den Inhalt mit Sitzung', () => {
    renderGuard('/admin/finance', fakeSession({ role: 'inhaber' }))
    expect(screen.getByText('Geschützter Inhalt')).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('lässt Anmeldung und Station ohne Sitzung durch', () => {
    renderGuard('/admin/login', fakeSession({ status: 'loading' }))
    expect(screen.getByText('Geschützter Inhalt')).toBeInTheDocument()
    renderGuard('/station', fakeSession())
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('vom unbeaufsichtigten Backstube-Tablet weg: abmelden statt Inhalt (W4-Fixup)', () => {
    const endUnattended = jest.fn()
    renderGuard(
      '/admin/reports',
      fakeSession({
        role: 'inhaber',
        sessionKind: 'station',
        unattendedAtBackstube: true,
        endUnattended,
      })
    )
    expect(screen.queryByText('Geschützter Inhalt')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Inaktivität')
    expect(endUnattended).toHaveBeenCalledTimes(1)
  })

  it('auf /backstube selbst bleibt die unbeaufsichtigte Sitzung nutzbar', () => {
    const endUnattended = jest.fn()
    renderGuard(
      '/backstube',
      fakeSession({
        role: 'inhaber',
        sessionKind: 'station',
        unattendedAtBackstube: true,
        endUnattended,
      })
    )
    expect(screen.getByText('Geschützter Inhalt')).toBeInTheDocument()
    expect(endUnattended).not.toHaveBeenCalled()
  })

  it('prüft außerhalb von /admin die Rolle selbst (/backstube)', () => {
    renderGuard('/backstube', fakeSession({ role: 'fahrer' }))
    expect(screen.getByText('Kein Zugriff')).toBeInTheDocument()
    expect(screen.queryByText('Geschützter Inhalt')).not.toBeInTheDocument()
  })

  it('nach „Abmelden" zur Anmeldung ohne ?next= (kein Rennen mit dem LogoutButton)', () => {
    renderGuard('/admin/finance', fakeSession({ loggedOut: true }))
    expect(mockReplace).toHaveBeenCalledWith('/admin/login')
  })

  it('nach „Abmelden" an der Station zu den Namenskacheln', () => {
    saveStation({ token: 'st_x', name: 'Laden' })
    renderGuard('/admin/partners', fakeSession({ loggedOut: true }))
    expect(mockReplace).toHaveBeenCalledWith('/station')
  })

  it('anonymousRedirect kodiert den Rückweg', () => {
    expect(anonymousRedirect('/admin/users', false)).toBe(
      '/admin/login?next=%2Fadmin%2Fusers'
    )
    expect(anonymousRedirect('/admin/users', true)).toBe('/station')
    expect(anonymousRedirect('/admin/users', false, true)).toBe('/admin/login')
    // W4-verify r2: the query survives (Abholliste day + place)
    expect(
      anonymousRedirect(
        '/admin/preorders/abholliste',
        false,
        false,
        '?date=2026-11-07&point=laden'
      )
    ).toBe(
      `/admin/login?next=${encodeURIComponent(
        '/admin/preorders/abholliste?date=2026-11-07&point=laden'
      )}`
    )
  })
})
