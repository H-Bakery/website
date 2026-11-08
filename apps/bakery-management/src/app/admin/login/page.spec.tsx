import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import LoginPage from './page'
import { fakeSession, WithSession } from '../../../lib/testing/fakeSession'
import { useMemoryStorage } from '../../../lib/testing/memoryStorage'
import { saveStation } from '../../../lib/authSession'
import type { SessionContextValue } from '../../../lib/session'

const mockReplace = jest.fn()
let mockNext: string | null = null
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useSearchParams: () => ({ get: () => mockNext }),
}))

function renderLogin(session: SessionContextValue) {
  return render(
    <WithSession value={session}>
      <LoginPage />
    </WithSession>
  )
}

function fill(username: string, password: string) {
  fireEvent.change(screen.getByLabelText(/Benutzername/), {
    target: { value: username },
  })
  fireEvent.change(screen.getByLabelText(/Passwort/), {
    target: { value: password },
  })
}

describe('Anmeldeseite', () => {
  beforeEach(() => {
    mockReplace.mockReset()
    mockNext = null
    useMemoryStorage()
  })

  it('meldet an und führt zur Startseite der Rolle', async () => {
    const login = jest.fn(async () => ({
      id: 4,
      username: 'test.fahrer',
      displayName: 'Test Fahrer',
      role: 'fahrer' as const,
    }))
    renderLogin(fakeSession({ login }))
    fill('  Test.Fahrer ', 'geheim123')
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }))
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/admin/preorders/abholliste')
    )
    expect(login).toHaveBeenCalledWith('Test.Fahrer', 'geheim123')
  })

  it('folgt ?next=, wenn die Rolle die Seite darf', async () => {
    mockNext = '/admin/finance'
    const login = jest.fn(async () => ({
      id: 1,
      username: 'test.inhaber',
      displayName: 'Test Inhaber',
      role: 'inhaber' as const,
    }))
    renderLogin(fakeSession({ login }))
    fill('test.inhaber', 'geheim123')
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }))
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/admin/finance')
    )
  })

  it('zeigt die deutsche Meldung der API und leert das Passwort', async () => {
    const login = jest.fn(async () => {
      throw new Error('Benutzername oder Passwort falsch.')
    })
    renderLogin(fakeSession({ login }))
    fill('test.inhaber', 'falsch123')
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }))
    expect(
      await screen.findByText('Benutzername oder Passwort falsch.')
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Passwort/)).toHaveValue('')
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('ohne Verbindung: WLAN-Hinweis statt „Failed to fetch“', async () => {
    const login = jest.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    renderLogin(fakeSession({ login }))
    fill('test.inhaber', 'geheim123')
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }))
    expect(
      await screen.findByText(
        'Keine Verbindung zum Server – bitte WLAN prüfen.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument()
  })

  it('sagt, warum abgemeldet wurde', () => {
    renderLogin(fakeSession({ endReason: 'Wegen Inaktivität abgemeldet.' }))
    expect(
      screen.getByText('Wegen Inaktivität abgemeldet.')
    ).toBeInTheDocument()
  })

  it('zeigt angemeldet Name und Rolle statt E-Mail', () => {
    renderLogin(fakeSession({ role: 'verkauf' }))
    expect(screen.getByText('Test verkauf')).toBeInTheDocument()
    expect(screen.getByText(/Verkauf/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBeInTheDocument()
  })

  it('bietet auf einer Station die PIN-Anmeldung an', async () => {
    saveStation({ token: 'st_x', name: 'Laden' })
    renderLogin(fakeSession())
    expect(
      await screen.findByRole('link', { name: /Mit PIN an der Station/ })
    ).toHaveAttribute('href', '/station')
  })
})
