import React from 'react'
import {
  cleanup,
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
        'Hilfe',
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

  it('Inhaber sieht „Dienstplan“, Verkauf nicht (TASK-042)', () => {
    renderLayout('/admin', fakeSession({ role: 'inhaber' }))
    expect(navLabels()).toContain('Dienstplan')
    cleanup()
    renderLayout('/admin', fakeSession({ role: 'verkauf' }))
    expect(navLabels()).not.toContain('Dienstplan')
    cleanup()
    renderLayout(
      '/admin/dienstplan/mitarbeiter',
      fakeSession({ role: 'verkauf' })
    )
    expect(screen.getByText('Kein Zugriff')).toBeInTheDocument()
    expect(screen.queryByText('Seiteninhalt')).not.toBeInTheDocument()
  })

  it('verbotene Seite: „Kein Zugriff“ statt Inhalt, Link zur Startseite', () => {
    renderLayout('/admin/finance', fakeSession({ role: 'fahrer' }))
    expect(screen.queryByText('Seiteninhalt')).not.toBeInTheDocument()
    expect(screen.getByText('Kein Zugriff')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Zur Startseite' })
    ).toHaveAttribute('href', '/admin/preorders/abholliste')
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

  it('Inhaber an der Station: kein Dienstplan (Personendaten), mit Begründung', () => {
    renderLayout(
      '/admin/dienstplan/mitarbeiter/3',
      fakeSession({ role: 'inhaber', sessionKind: 'station' })
    )
    expect(navLabels()).not.toContain('Dienstplan')
    expect(screen.getByText('Kein Zugriff')).toBeInTheDocument()
    expect(
      screen.getByText(/an einer Station nicht verfügbar/)
    ).toBeInTheDocument()
    expect(screen.queryByText('Seiteninhalt')).not.toBeInTheDocument()
  })

  it('Inhaber an der Station: keine Benutzerverwaltung, mit Begründung', () => {
    renderLayout(
      '/admin/users',
      fakeSession({ role: 'inhaber', sessionKind: 'station' })
    )
    expect(navLabels()).not.toContain('Benutzer')
    expect(screen.getByText('Kein Zugriff')).toBeInTheDocument()
    expect(
      screen.getByText(/an einer Station nicht verfügbar/)
    ).toBeInTheDocument()
    expect(screen.queryByText('Seiteninhalt')).not.toBeInTheDocument()
  })

  it('Fahrer: kein „Erfassen“ im Menü und kein „Dashboard“ im Pfad (Review r1)', () => {
    renderLayout('/admin/preorders/abholliste', fakeSession({ role: 'fahrer' }))
    const item = desktopNav().getByText('Vorbestellungen').closest('a')
    expect(item).toHaveTextContent('Liste und Tagesübersicht')
    expect(item).not.toHaveTextContent('Erfassen')
    expect(screen.getByLabelText('Pfad').textContent).not.toContain('Dashboard')
    expect(screen.getByLabelText('Pfad')).toHaveTextContent(
      'Vorbestellungen › Abholliste'
    )
  })

  it('Verkauf: Produkte heißen „Sortiment nachschlagen“, nicht Verwaltung', () => {
    renderLayout('/admin/products', fakeSession({ role: 'verkauf' }))
    const item = desktopNav().getByText('Produkte').closest('a')
    expect(item).toHaveTextContent('Sortiment nachschlagen')
    expect(screen.getByLabelText('Pfad')).toHaveTextContent(
      'Dashboard › Produkte'
    )
  })
})

describe('AdminLayout mit Rollen im Pilotbetrieb (Dienstplan, Entscheidung 2026-11-08)', () => {
  const original = process.env.NEXT_PUBLIC_PILOT_MODE
  beforeEach(() => {
    mockReplace.mockReset()
    process.env.NEXT_PUBLIC_PILOT_MODE = '1'
  })
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_PILOT_MODE
    else process.env.NEXT_PUBLIC_PILOT_MODE = original
  })

  it('Inhaber sieht „Dienstplan“ im Menü und erreicht die Seiten', () => {
    renderLayout('/admin', fakeSession({ role: 'inhaber' }))
    expect(screen.getByText('Pilotbetrieb')).toBeInTheDocument()
    expect(navLabels()).toContain('Dienstplan')
    for (const path of [
      '/admin/dienstplan',
      '/admin/dienstplan/mitarbeiter',
      '/admin/dienstplan/mitarbeiter/3',
    ]) {
      cleanup()
      renderLayout(path, fakeSession({ role: 'inhaber' }))
      expect(screen.getByText('Seiteninhalt')).toBeInTheDocument()
      expect(
        screen.queryByText('Im Pilotbetrieb nicht verfügbar')
      ).not.toBeInTheDocument()
      expect(screen.queryByText('Kein Zugriff')).not.toBeInTheDocument()
    }
  })

  it.each(['verkauf', 'backstube', 'fahrer'] as const)(
    '%s sieht „Dienstplan“ nicht und kommt nicht hinein',
    (role) => {
      renderLayout('/admin/settings', fakeSession({ role }))
      expect(navLabels()).not.toContain('Dienstplan')
      cleanup()
      renderLayout('/admin/dienstplan', fakeSession({ role }))
      expect(screen.getByText('Kein Zugriff')).toBeInTheDocument()
      expect(screen.queryByText('Seiteninhalt')).not.toBeInTheDocument()
    }
  )

  it('Rest am Abend: Inhaber sieht Zählliste und Auswertung (Entscheidung 2026-11-08)', () => {
    renderLayout('/admin', fakeSession({ role: 'inhaber' }))
    expect(navLabels()).toEqual(
      expect.arrayContaining(['Rest am Abend', 'Rest-Auswertung'])
    )
    for (const path of ['/admin/rest', '/admin/rest/auswertung']) {
      cleanup()
      renderLayout(path, fakeSession({ role: 'inhaber' }))
      expect(screen.getByText('Seiteninhalt')).toBeInTheDocument()
      expect(
        screen.queryByText('Im Pilotbetrieb nicht verfügbar')
      ).not.toBeInTheDocument()
      expect(screen.queryByText('Kein Zugriff')).not.toBeInTheDocument()
    }
  })

  it.each(['verkauf', 'backstube'] as const)(
    '%s zählt den Rest am Abend, die Auswertung bleibt Inhaber',
    (role) => {
      renderLayout('/admin/rest', fakeSession({ role }))
      expect(navLabels()).toContain('Rest am Abend')
      expect(navLabels()).not.toContain('Rest-Auswertung')
      expect(screen.getByText('Seiteninhalt')).toBeInTheDocument()
      cleanup()
      renderLayout('/admin/rest/auswertung', fakeSession({ role }))
      expect(screen.getByText('Kein Zugriff')).toBeInTheDocument()
      expect(screen.queryByText('Seiteninhalt')).not.toBeInTheDocument()
    }
  )

  it('Inhaber an der Station: auch im Pilotbetrieb kein Dienstplan', () => {
    renderLayout(
      '/admin/dienstplan',
      fakeSession({ role: 'inhaber', sessionKind: 'station' })
    )
    expect(navLabels()).not.toContain('Dienstplan')
    expect(screen.getByText('Kein Zugriff')).toBeInTheDocument()
    expect(screen.queryByText('Seiteninhalt')).not.toBeInTheDocument()
  })
})
