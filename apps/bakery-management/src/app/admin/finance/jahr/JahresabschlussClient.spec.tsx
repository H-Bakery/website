import React from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import JahresabschlussClient from './JahresabschlussClient'
import { formatEuro } from '../../../../lib/reportFormat'
import {
  finalYearFixture,
  provisionalYearFixture,
} from '../../../../lib/financeReportFixtures'

jest.mock('@bakery/shared/data-access', () => {
  class ApiError extends Error {
    status: number
    code?: string
    constructor(message: string, status: number, code?: string) {
      super(message)
      this.name = 'ApiError'
      this.status = status
      this.code = code
    }
  }
  return { ApiError, apiClient: { get: jest.fn() } }
})

const authState = { isAuthenticated: true, isLoading: false }
jest.mock('../../../../lib/session', () => ({
  useSession: () => authState,
}))

const mockRouter = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() }
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/admin/finance/jahr',
  useSearchParams: () => new URLSearchParams(),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient, ApiError } = require('@bakery/shared/data-access') as {
  apiClient: { get: jest.Mock }
  ApiError: new (message: string, status: number, code?: string) => Error
}

/** Intl setzt vor das € ein geschütztes Leerzeichen - daher ein Muster. */
function euro(value: number, anchored = true): RegExp {
  const text = formatEuro(value)
    .replace(/[\s\u00a0\u202f]+/g, '\\s*')
    .replace(/\./g, '\\.')
  return new RegExp(anchored ? `^${text}$` : text)
}

function respondWith(byPath: Record<string, unknown>) {
  apiClient.get.mockImplementation(async (path: string) => {
    const data = byPath[path]
    if (!data) throw new Error(`unerwarteter Pfad ${path}`)
    return { success: true, status: 'ok', data }
  })
}

describe('JahresabschlussClient', () => {
  beforeEach(() => {
    apiClient.get.mockReset()
    mockRouter.replace.mockReset()
    mockRouter.push.mockReset()
  })

  it('zeigt einen vorläufigen Abschluss mit Kacheln, Gliederung, Monaten und Hinweisen', async () => {
    respondWith({ '/api/finance/year': provisionalYearFixture() })
    renderWithTheme(<JahresabschlussClient />)

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Jahresabschluss 2026',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Einnahmen und Ausgaben über das Geschäftskonto – kein steuerlicher Abschluss'
      )
    ).toBeInTheDocument()
    expect(screen.getByTestId('year-status')).toHaveTextContent(
      'Vorläufig · Stand 15.10.2026'
    )

    // Kacheln, Hochrechnung mit Rechenweg
    const tiles = screen.getByLabelText('Kennzahlen 2026')
    expect(within(tiles).getByText(euro(96000))).toBeInTheDocument()
    expect(within(tiles).getByText(euro(-80000))).toBeInTheDocument()
    expect(within(tiles).getByText(euro(16000))).toBeInTheDocument()
    expect(screen.getByTestId('projection-tile')).toHaveTextContent(
      'Hochrechnung Jahresergebnis'
    )
    expect(
      within(screen.getByTestId('projection-tile')).getByText(euro(20000))
    ).toBeInTheDocument()
    expect(screen.getByTestId('projection-method')).toHaveTextContent(
      /derselbe Monat im Vorjahr/
    )

    // Gliederung
    const statement = screen.getByTestId('statement')
    expect(within(statement).getByText('Umsatz')).toBeInTheDocument()
    expect(within(statement).getByText('Wareneinkauf')).toBeInTheDocument()
    expect(within(statement).getByText('50 %')).toBeInTheDocument()
    expect(within(statement).getByText('Privat')).toBeInTheDocument()
    expect(
      within(screen.getByTestId('sum-result')).getByText(euro(16000))
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('sum-net-change')).getByText(euro(7000))
    ).toBeInTheDocument()
    expect(
      within(statement).getByText('Unter dem Strich (neutral)')
    ).toBeInTheDocument()

    // Monate: Link, laufender Monat, fehlende Monate, fehlende Kasse
    const september = screen.getByTestId('month-2026-09')
    expect(
      within(september).getByRole('link', { name: /September 2026/ })
    ).toHaveAttribute('href', '/admin/finance/monat/2026-09')
    expect(screen.getByTestId('partial-2026-10')).toHaveTextContent(
      'bis 15.10.'
    )
    const november = screen.getByTestId('month-2026-11')
    expect(november).toHaveAttribute('data-coverage', 'missing')
    expect(within(november).getByText('keine Bankdaten')).toBeInTheDocument()
    expect(within(november).queryByRole('link')).toBeNull()
    expect(
      within(screen.getByTestId('month-2026-03')).getByText('–')
    ).toBeInTheDocument()

    // Kasse und Konto
    expect(screen.getByTestId('reconciliation-kasse-total')).toHaveTextContent(
      /^76\.000,00\s*€$/
    )
    expect(screen.getByTestId('reconciliation-bank-total')).toHaveTextContent(
      /^75\.000,00\s*€$/
    )
    expect(screen.getByTestId('reconciliation-total')).toHaveTextContent(
      /^−1\.000,00\s*€$/
    )
    expect(screen.getByText(/8 volle Monate/)).toBeInTheDocument()

    // Hinweise: Warnung sichtbar abgesetzt
    const notes = screen.getByTestId('year-notes')
    expect(
      within(notes).getByRole('heading', {
        name: 'Was dieser Abschluss nicht enthält',
      })
    ).toBeInTheDocument()
    const warning = notes.querySelector('[data-severity="warning"]')
    expect(warning).toHaveTextContent(/Bitte beachten:.*keiner Kategorie/)
    expect(notes.querySelectorAll('[data-severity="info"]')).toHaveLength(2)

    expect(apiClient.get).toHaveBeenCalledWith('/api/finance/year')
  })

  it('klappt Unterkategorien auf und zu', async () => {
    respondWith({ '/api/finance/year': provisionalYearFixture() })
    renderWithTheme(<JahresabschlussClient />)
    const toggle = await screen.findByRole('button', {
      name: 'Umsatz: Aufschlüsselung anzeigen',
    })
    expect(screen.queryByTestId('sub-umsatz-bar')).toBeNull()
    fireEvent.click(toggle)
    expect(screen.getByTestId('sub-umsatz-bar')).toHaveTextContent(
      'Bareinzahlungen'
    )
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(
      screen.getByRole('button', { name: 'Umsatz: Aufschlüsselung ausblenden' })
    )
    expect(screen.queryByTestId('sub-umsatz-bar')).toBeNull()
  })

  it('wechselt das Jahr über die Auswahl und schreibt es in die Adresse', async () => {
    respondWith({
      '/api/finance/year': provisionalYearFixture(),
      '/api/finance/year/2025': finalYearFixture(),
    })
    renderWithTheme(<JahresabschlussClient />)
    await screen.findByRole('heading', {
      level: 1,
      name: 'Jahresabschluss 2026',
    })

    fireEvent.mouseDown(screen.getByLabelText('Jahr'))
    fireEvent.click(await screen.findByRole('option', { name: '2025' }))

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Jahresabschluss 2025',
      })
    ).toBeInTheDocument()
    expect(apiClient.get).toHaveBeenLastCalledWith('/api/finance/year/2025')
    expect(mockRouter.replace).toHaveBeenCalledWith(
      '/admin/finance/jahr?jahr=2025',
      {
        scroll: false,
      }
    )
    expect(screen.getByTestId('year-status')).toHaveTextContent('Abgeschlossen')
    // Abgeschlossenes Jahr: keine Hochrechnung, dafür die Kontoveränderung
    expect(screen.queryByTestId('projection-tile')).toBeNull()
    expect(screen.queryByTestId('projection-method')).toBeNull()
    expect(screen.getAllByText('Kontoveränderung').length).toBeGreaterThan(0)
    // Pfeile: kein Vorjahr mehr, aber ein Folgejahr
    expect(screen.getByRole('button', { name: 'Vorjahr' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Folgejahr' })).toBeEnabled()
  })

  it('lädt das Jahr aus der Adresse', async () => {
    respondWith({ '/api/finance/year/2025': finalYearFixture() })
    renderWithTheme(<JahresabschlussClient initialYear="2025" />)
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Jahresabschluss 2025',
      })
    ).toBeInTheDocument()
    expect(apiClient.get).toHaveBeenCalledWith('/api/finance/year/2025')
  })

  it('zeigt Verlauf, aufgelaufenes Ergebnis und Herkunft/Posten als Diagramme', async () => {
    respondWith({ '/api/finance/year': provisionalYearFixture() })
    renderWithTheme(<JahresabschlussClient />)
    const flow = await screen.findByTestId('year-flow-chart')
    expect(flow).toHaveAttribute(
      'aria-label',
      'Einnahmen, Ausgaben und Ergebnis je Monat 2026'
    )
    // Legende mit offenem Monat und Schätzung, Satz zum Ablesen darunter.
    const legend = within(flow).getByRole('list', { name: 'Legende' })
    expect(legend).toHaveTextContent('Monat läuft noch')
    expect(legend).toHaveTextContent('geschätzt (Hochrechnung)')
    expect(flow).toHaveTextContent(
      '* Oktober läuft noch (Bankdaten bis 15.10.).'
    )
    expect(flow).toHaveTextContent('Schraffiert: geschätzt')

    expect(screen.getByTestId('year-cumulative-chart')).toHaveTextContent(
      'Hochrechnung'
    )
    expect(
      screen.getByRole('img', { name: /^Einnahmen 2026 nach Herkunft:/ })
    ).toBeInTheDocument()
    const bars = screen.getByRole('list', { name: 'Ausgaben 2026 nach Posten' })
    expect(within(bars).getAllByRole('listitem')).toHaveLength(4)
  })

  it('ein unvollständiges Jahr hat keine Kurve seit Jahresbeginn', async () => {
    respondWith({
      '/api/finance/year': {
        ...finalYearFixture(),
        status: 'incomplete',
        coverage: {
          ...finalYearFixture().coverage,
          missing_before: ['2025-01', '2025-02', '2025-03'],
        },
      },
    })
    renderWithTheme(<JahresabschlussClient />)
    expect(await screen.findByTestId('year-flow-chart')).toHaveTextContent(
      'Für Januar bis März gibt es noch keine Bankdaten.'
    )
    expect(screen.queryByTestId('year-cumulative-chart')).toBeNull()
    // Nichts geschätzt, nichts offen - die Legende sagt es auch nicht.
    expect(
      within(screen.getByTestId('year-flow-chart')).getByRole('list', {
        name: 'Legende',
      })
    ).not.toHaveTextContent('geschätzt')
  })

  it('nennt den Grund, wenn keine Hochrechnung möglich ist', async () => {
    respondWith({
      '/api/finance/year': {
        ...provisionalYearFixture(),
        projection: null,
        projection_reason:
          'Zu wenig vollständige Monate für eine Hochrechnung.',
      },
    })
    renderWithTheme(<JahresabschlussClient />)
    expect(await screen.findByTestId('projection-method')).toHaveTextContent(
      'Keine Hochrechnung: Zu wenig vollständige Monate'
    )
    expect(screen.getByTestId('projection-tile')).toHaveTextContent('–')
  })

  it('zeigt ohne Anmeldung den Weg zur Anmeldung zurück auf diese Seite', async () => {
    apiClient.get.mockRejectedValue(new ApiError('Bitte anmelden.', 401))
    renderWithTheme(<JahresabschlussClient initialYear="2026" />)
    expect(
      await screen.findByText('Anmeldung erforderlich')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Zur Anmeldung/ })).toHaveAttribute(
      'href',
      `/admin/login?next=${encodeURIComponent('/admin/finance/jahr?jahr=2026')}`
    )
  })

  it('zeigt an der PIN-Station den Passwort-Hinweis ohne Anmelde-Link', async () => {
    apiClient.get.mockRejectedValue(
      new ApiError('Nur mit Passwort.', 403, 'personal_session_required')
    )
    renderWithTheme(<JahresabschlussClient />)
    expect(
      await screen.findByTestId('personal-session-notice')
    ).toHaveTextContent('An der PIN-Station nicht verfügbar')
    expect(screen.queryByRole('link', { name: /anmeld/i })).toBeNull()
  })

  it('zeigt bei falscher Rolle „Keine Berechtigung“', async () => {
    apiClient.get.mockRejectedValue(new ApiError('Nicht erlaubt.', 403))
    renderWithTheme(<JahresabschlussClient />)
    expect(await screen.findByText('Keine Berechtigung')).toBeInTheDocument()
  })

  it('zeigt einen Serverfehler mit „Erneut versuchen“', async () => {
    apiClient.get.mockRejectedValueOnce(new ApiError('Interner Fehler', 500))
    renderWithTheme(<JahresabschlussClient />)
    expect(
      await screen.findByText('Der Jahresabschluss konnte nicht geladen werden')
    ).toBeInTheDocument()
    respondWith({ '/api/finance/year': provisionalYearFixture() })
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Jahresabschluss 2026',
      })
    ).toBeInTheDocument()
  })

  it('zeigt „keine Daten“ mit dem Grund des Servers', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      status: 'no-data',
      data: null,
      message: 'Für 2019 gibt es keine Bankdaten.',
    })
    renderWithTheme(<JahresabschlussClient initialYear="2019" />)
    expect(
      await screen.findByText('Kein Jahresabschluss möglich')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Für 2019 gibt es keine Bankdaten/)
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Zum jüngsten Jahr' }))
    expect(mockRouter.replace).toHaveBeenCalledWith('/admin/finance/jahr', {
      scroll: false,
    })
    // lädt ohne Jahr neu (die Vorgabe der API)
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenLastCalledWith('/api/finance/year')
    )
    expect(
      await screen.findByText('Kein Jahresabschluss möglich')
    ).toBeInTheDocument()
  })

  it('hat eine Druckansicht: Kopfzeile, Drucken-Knopf und alle Unterkategorien', async () => {
    respondWith({ '/api/finance/year': provisionalYearFixture() })
    const print = jest.fn()
    const original = window.print
    window.print = print
    try {
      renderWithTheme(<JahresabschlussClient />)
      await screen.findByRole('heading', {
        level: 1,
        name: 'Jahresabschluss 2026',
      })
      expect(screen.getByTestId('jahresabschluss')).toHaveClass('fin-report')
      expect(screen.getByTestId('print-head')).toHaveTextContent(
        'Bäckerei Heusser · Vorläufig · Stand 15.10.2026'
      )
      fireEvent.click(screen.getByRole('button', { name: 'Drucken' }))
      expect(print).toHaveBeenCalled()
      // Papier kann nicht aufklappen: beim Drucken stehen alle Unterkategorien da.
      expect(screen.queryByTestId('sub-umsatz-bar')).toBeNull()
      act(() => {
        window.dispatchEvent(new Event('beforeprint'))
      })
      expect(screen.getByTestId('sub-umsatz-bar')).toBeInTheDocument()
      expect(screen.getByTestId('sub-wareneinkauf-mehl')).toBeInTheDocument()
      act(() => {
        window.dispatchEvent(new Event('afterprint'))
      })
      expect(screen.queryByTestId('sub-umsatz-bar')).toBeNull()
    } finally {
      window.print = original
    }
  })
})
