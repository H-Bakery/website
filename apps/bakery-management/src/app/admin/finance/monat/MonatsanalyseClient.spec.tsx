import React from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import MonatsanalyseClient from './MonatsanalyseClient'
import { formatEuro } from '../../../../lib/reportFormat'
import {
  completeMonthFixture,
  partialMonthFixture,
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
  usePathname: () => '/admin/finance/monat/2026-09',
  useSearchParams: () => new URLSearchParams(),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient, ApiError } = require('@bakery/shared/data-access') as {
  apiClient: { get: jest.Mock }
  ApiError: new (message: string, status: number, code?: string) => Error
}

/** Intl setzt vor das € ein geschütztes Leerzeichen - daher ein Muster. */
function euro(value: number): RegExp {
  const text = formatEuro(value)
    .replace(/[\s\u00a0\u202f]+/g, '\\s*')
    .replace(/\./g, '\\.')
  return new RegExp(`^${text}$`)
}

function respond(data: unknown) {
  apiClient.get.mockResolvedValue({ success: true, status: 'ok', data })
}

describe('MonatsanalyseClient', () => {
  beforeEach(() => {
    apiClient.get.mockReset()
    mockRouter.push.mockReset()
  })

  it('zeigt einen vollen Monat mit Auffälligkeiten, Ø-Vergleich, Kasse und Hinweisen', async () => {
    respond(completeMonthFixture())
    renderWithTheme(<MonatsanalyseClient month="2026-09" />)

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Monatsanalyse – September 2026',
      })
    ).toBeInTheDocument()
    expect(apiClient.get).toHaveBeenCalledWith('/api/finance/month/2026-09')
    expect(screen.queryByTestId('month-status')).toBeNull()

    // Kacheln
    const tiles = screen.getByLabelText('Kennzahlen September 2026')
    expect(within(tiles).getByText(euro(10000))).toBeInTheDocument()
    expect(within(tiles).getByText(euro(-8400))).toBeInTheDocument()
    expect(within(tiles).getByText(euro(1600))).toBeInTheDocument()
    expect(screen.getByTestId('kasse-tile')).toHaveTextContent(
      'Kasse Ø je Öffnungstag'
    )
    expect(screen.getByTestId('kasse-tile')).toHaveTextContent(
      /22 Öffnungstage/
    )

    // Auffälligkeiten: Texte kommen vom Server
    const highlights = screen.getByTestId('highlights')
    expect(within(highlights).getAllByRole('listitem')).toHaveLength(2)
    expect(highlights).toHaveTextContent(/Reparaturen: 1\.000,00 €/)
    expect(highlights).toHaveTextContent(/Miete: diesen Monat keine Zahlung/)

    // Woher / Wohin mit Ø und Abweichung
    const income = screen.getByTestId('income-table')
    expect(
      within(income).getByRole('columnheader', { name: 'Ø 12 Monate' })
    ).toBeInTheDocument()
    expect(
      within(within(income).getByTestId('row-umsatz')).getByText(
        /^400,00\s*€ mehr$/
      )
    ).toBeInTheDocument()
    expect(
      within(within(income).getByTestId('row-partner')).getByText(
        /^50,00\s*€ weniger$/
      )
    ).toBeInTheDocument()
    const expense = screen.getByTestId('expense-table')
    // Ausgaben: negativer Unterschied heißt „mehr ausgegeben“
    expect(
      within(within(expense).getByTestId('row-reparatur')).getByText(
        /^950,00\s*€ mehr$/
      )
    ).toBeInTheDocument()
    expect(
      within(within(expense).getByTestId('row-personal')).getByText(
        'wie üblich'
      )
    ).toBeInTheDocument()
    expect(
      within(within(expense).getByTestId('row-wareneinkauf')).getByText(
        /51,2\s*%/
      )
    ).toBeInTheDocument()

    // Vergleich
    expect(screen.getByTestId('comparison-previous_month')).toHaveTextContent(
      'Vormonat (August 2026)'
    )
    expect(screen.getByTestId('comparison-previous_year')).toHaveTextContent(
      /Vorjahresmonat \(September 2025\).*\+100,00/
    )
    expect(screen.getByTestId('comparison-average')).toHaveTextContent(
      /Ø 12 volle Monate davor.*\+100,00/
    )

    // Kasse und Konto
    expect(screen.getByTestId('reconciliation-kasse-total')).toHaveTextContent(
      /^9\.600,00\s*€$/
    )
    expect(screen.getByTestId('reconciliation-bank-total')).toHaveTextContent(
      /^9\.300,00\s*€$/
    )
    expect(screen.getByTestId('reconciliation-total')).toHaveTextContent(
      /^−300,00\s*€$/
    )
    expect(screen.getByTestId('kasse-previous-year')).toHaveTextContent(
      /21 Öffnungstagen/
    )

    // Neutral und Hinweise
    expect(
      within(screen.getByTestId('neutral')).getByText('Privat')
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('neutral')).getByText('Kontoveränderung')
    ).toBeInTheDocument()
    const notes = screen.getByTestId('month-notes')
    expect(notes.querySelector('[data-severity="warning"]')).toHaveTextContent(
      '2 Buchungen ohne Kategorie'
    )

    // Rücklink auf den Jahresabschluss des Jahres
    expect(
      screen.getByRole('link', { name: /Jahresabschluss 2026/ })
    ).toHaveAttribute('href', '/admin/finance/jahr?jahr=2026')
  })

  it('zeigt bei einem laufenden Monat den Hinweis des Servers statt Vergleichen', async () => {
    respond(partialMonthFixture())
    renderWithTheme(<MonatsanalyseClient month="2026-10" />)

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Monatsanalyse – Oktober 2026',
      })
    ).toBeInTheDocument()
    expect(screen.getByTestId('month-status')).toHaveTextContent(
      'Unvollständig · bis 15.10.'
    )
    expect(screen.getByTestId('highlights-empty')).toHaveAttribute(
      'data-reason',
      'partial'
    )
    expect(screen.getByTestId('highlights-empty')).toHaveTextContent(
      'Vergleiche und Auffälligkeiten gibt es erst, wenn er abgeschlossen ist.'
    )
    // Kein Ø und keine Abweichung gegen ganze Monate
    expect(
      screen.queryByRole('columnheader', { name: 'Abweichung' })
    ).toBeNull()
    expect(screen.getByTestId('comparison-empty')).toHaveTextContent(
      'Der Vergleich folgt, wenn der Monat vollständig ist.'
    )
    expect(screen.queryByTestId('comparison')).toBeNull()
    expect(screen.getByTestId('no-reconciliation')).toHaveTextContent(
      'Der Abgleich folgt'
    )
    // Der Teilmonat-Hinweis steht bei den Auffälligkeiten, nicht doppelt unten.
    expect(screen.queryByTestId('month-notes')).toBeNull()
    expect(screen.getByLabelText('Kennzahlen Oktober 2026')).toHaveTextContent(
      '15 von 31 Tagen'
    )
    expect(
      screen.getByRole('button', { name: 'Nächster Monat' })
    ).toBeDisabled()
  })

  it('sagt es, wenn ein voller Monat nichts Auffälliges hat', async () => {
    respond({ ...completeMonthFixture(), highlights: [] })
    renderWithTheme(<MonatsanalyseClient month="2026-09" />)
    expect(await screen.findByTestId('highlights-empty')).toHaveTextContent(
      'Nichts Auffälliges in diesem Monat.'
    )
  })

  it('nennt zu wenige Vergleichsmonate als Grund', async () => {
    const report = completeMonthFixture()
    respond({
      ...report,
      highlights: [],
      highlights_reason: 'too_few_months',
      comparison: {
        ...report.comparison,
        average: report.comparison.average && {
          ...report.comparison.average,
          months: 4,
        },
      },
    })
    renderWithTheme(<MonatsanalyseClient month="2026-09" />)
    expect(await screen.findByTestId('highlights-empty')).toHaveTextContent(
      'Für Auffälligkeiten braucht es mindestens 6 abgeschlossene Vergleichsmonate (bisher 4).'
    )
  })

  it('zeigt „–“ für einen Posten ohne Durchschnitt', async () => {
    const report = completeMonthFixture()
    report.statement.income.rows[1] = {
      ...report.statement.income.rows[1],
      average: null,
      diff: null,
    }
    respond(report)
    renderWithTheme(<MonatsanalyseClient month="2026-09" />)
    const row = await screen.findByTestId('row-partner')
    expect(within(row).getAllByText('–')).toHaveLength(2)
  })

  it('blättert mit Pfeilen und Auswahl zwischen Monaten', async () => {
    respond(completeMonthFixture())
    renderWithTheme(<MonatsanalyseClient month="2026-09" />)
    await screen.findByRole('heading', {
      level: 1,
      name: 'Monatsanalyse – September 2026',
    })

    expect(
      screen.getByRole('link', { name: 'Vormonat: August 2026' })
    ).toHaveAttribute('href', '/admin/finance/monat/2026-08')
    expect(
      screen.getByRole('link', { name: 'Nächster Monat: Oktober 2026' })
    ).toHaveAttribute('href', '/admin/finance/monat/2026-10')

    fireEvent.mouseDown(screen.getByLabelText('Monat'))
    fireEvent.click(await screen.findByRole('option', { name: 'Juli 2026' }))
    expect(mockRouter.push).toHaveBeenCalledWith('/admin/finance/monat/2026-07')
  })

  it('lädt ohne Monat die Vorgabe der API', async () => {
    respond(completeMonthFixture())
    renderWithTheme(<MonatsanalyseClient />)
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Monatsanalyse – September 2026',
      })
    ).toBeInTheDocument()
    expect(apiClient.get).toHaveBeenCalledWith('/api/finance/month')
  })

  it('fragt bei einem ungültigen Monat gar nicht erst', async () => {
    renderWithTheme(<MonatsanalyseClient month="2026-13" />)
    expect(
      await screen.findByText('Diesen Monat gibt es nicht')
    ).toBeInTheDocument()
    expect(apiClient.get).not.toHaveBeenCalled()
    expect(
      screen.getByRole('link', { name: 'Zum jüngsten Monat' })
    ).toHaveAttribute('href', '/admin/finance/monat')
  })

  it('zeigt „keine Daten“ mit dem Grund des Servers', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      status: 'no-data',
      data: null,
      message: 'Für Januar 2019 gibt es keine Bankdaten.',
    })
    renderWithTheme(<MonatsanalyseClient month="2019-01" />)
    expect(
      await screen.findByText('Keine Monatsanalyse möglich')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Januar 2019 gibt es keine Bankdaten/)
    ).toBeInTheDocument()
  })

  it('zeigt ohne Anmeldung den Weg zur Anmeldung zurück auf diesen Monat', async () => {
    apiClient.get.mockRejectedValue(new ApiError('Bitte anmelden.', 401))
    renderWithTheme(<MonatsanalyseClient month="2026-09" />)
    expect(
      await screen.findByText('Anmeldung erforderlich')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Zur Anmeldung/ })).toHaveAttribute(
      'href',
      `/admin/login?next=${encodeURIComponent('/admin/finance/monat/2026-09')}`
    )
  })

  it('zeigt an der PIN-Station den Passwort-Hinweis', async () => {
    apiClient.get.mockRejectedValue(
      new ApiError('Nur mit Passwort.', 403, 'personal_session_required')
    )
    renderWithTheme(<MonatsanalyseClient month="2026-09" />)
    expect(
      await screen.findByTestId('personal-session-notice')
    ).toHaveTextContent('An der PIN-Station nicht verfügbar')
  })

  it('übersetzt einen Netzfehler in den WLAN-Hinweis', async () => {
    apiClient.get.mockRejectedValue(new TypeError('Failed to fetch'))
    renderWithTheme(<MonatsanalyseClient month="2026-09" />)
    expect(
      await screen.findByText(
        'Keine Verbindung zum Server – bitte WLAN prüfen.'
      )
    ).toBeInTheDocument()
  })

  it('ist druckbar', async () => {
    respond(completeMonthFixture())
    const print = jest.fn()
    const original = window.print
    window.print = print
    try {
      renderWithTheme(<MonatsanalyseClient month="2026-09" />)
      await screen.findByRole('heading', {
        level: 1,
        name: 'Monatsanalyse – September 2026',
      })
      expect(screen.getByTestId('monatsanalyse')).toHaveClass('fin-report')
      fireEvent.click(screen.getByRole('button', { name: 'Drucken' }))
      expect(print).toHaveBeenCalled()
    } finally {
      window.print = original
    }
  })
})
