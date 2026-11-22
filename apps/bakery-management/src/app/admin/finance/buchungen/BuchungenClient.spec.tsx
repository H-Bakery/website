import React from 'react'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import BuchungenClient, { buchungenHref } from './BuchungenClient'
import BuchungDetailClient from './[id]/BuchungDetailClient'
import type {
  FinanceTransaction,
  FinanceTransactionDetail,
  FinanceTransactionsList,
} from '../../../../lib/financeTypes'

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
  usePathname: () => '/admin/finance/buchungen',
  useSearchParams: () => new URLSearchParams(),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient, ApiError } = require('@bakery/shared/data-access') as {
  apiClient: { get: jest.Mock }
  ApiError: new (message: string, status: number, code?: string) => Error
}

/** Erfundene Buchungen - keine echten Namen, Beträge oder Konten. */
function tx(over: Partial<FinanceTransaction>): FinanceTransaction {
  return {
    id: 'aaaa000000000001',
    booking_date: '2026-02-03',
    value_date: '2026-02-03',
    amount: -99.99,
    currency: 'EUR',
    status: 'gebucht',
    booking_text: 'FOLGELASTSCHRIFT',
    counterparty: 'Beispiel-Großhandel GmbH',
    counterparty_iban: 'DE•• •••• 4711',
    purpose: 'RE-0002 Zucker',
    direct_debit: true,
    category: 'wareneinsatz',
    category_label: 'Wareneinsatz',
    kind: 'ausgabe',
    subcategory: null,
    subcategory_label: null,
    flow: 'betrieblich',
    note: null,
    ...over,
  }
}

function listFixture(
  over: Partial<FinanceTransactionsList> = {}
): FinanceTransactionsList {
  const transactions = [
    tx({
      id: 'bbbb000000000002',
      booking_date: '2026-02-10',
      amount: 1250,
      counterparty: 'Max Beispielmann',
      purpose: 'Kartenumsätze',
      category: 'umsatz_laden',
      category_label: 'Ladenumsatz',
      kind: 'einnahme',
      direct_debit: false,
    }),
    tx({
      id: 'bbbb000000000003',
      booking_date: '2026-02-10',
      amount: -12.5,
      counterparty: 'Unbekannte Beispiel AG',
      purpose: 'Rechnung 77',
      category: 'unkategorisiert',
      category_label: 'Nicht zugeordnet',
      kind: 'offen',
      counterparty_iban: null,
    }),
    tx({ id: 'bbbb000000000001' }),
  ]
  return {
    month: '2026-02',
    available: true,
    months: ['2026-02', '2026-01'],
    previous_month: '2026-01',
    next_month: null,
    filters: { category: null, kind: null, direction: null, q: null },
    month_totals: { count: 3, income: 1250, expense: -112.49, net: 1137.51 },
    totals: { count: 3, income: 1250, expense: -112.49, net: 1137.51 },
    categories: [
      {
        category: 'wareneinsatz',
        label: 'Wareneinsatz',
        kind: 'ausgabe',
        count: 1,
      },
      {
        category: 'umsatz_laden',
        label: 'Ladenumsatz',
        kind: 'einnahme',
        count: 1,
      },
      {
        category: 'unkategorisiert',
        label: 'Nicht zugeordnet',
        kind: 'offen',
        count: 1,
      },
    ],
    skipped: 0,
    transactions,
    ...over,
  }
}

function respond(data: unknown) {
  apiClient.get.mockResolvedValue({ success: true, status: 'ok', data })
}

describe('buchungenHref', () => {
  it('lässt leere Filter weg', () => {
    expect(buchungenHref({})).toBe('/admin/finance/buchungen')
    expect(
      buchungenHref({ monat: '2026-02', richtung: 'aus', suche: 'a b' })
    ).toBe('/admin/finance/buchungen?monat=2026-02&richtung=aus&suche=a+b')
  })
})

describe('BuchungenClient', () => {
  beforeEach(() => {
    apiClient.get.mockReset()
    mockRouter.replace.mockReset()
  })

  it('zeigt den Monat mit Kennzahlen und einer Zeile je Buchung', async () => {
    respond(listFixture())
    renderWithTheme(<BuchungenClient />)
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Buchungen – Februar 2026',
      })
    ).toBeInTheDocument()
    expect(apiClient.get).toHaveBeenCalledWith('/api/finance/transactions', {})
    expect(screen.getByLabelText('Kennzahlen Februar 2026')).toBeInTheDocument()
    expect(screen.getByText('3 Buchungen')).toBeInTheDocument()
    const row = screen.getByTestId('buchung-bbbb000000000003')
    expect(within(row).getByText('Nicht zugeordnet')).toBeInTheDocument()
    expect(screen.getByTestId('buchung-link-bbbb000000000002')).toHaveAttribute(
      'href',
      '/admin/finance/buchungen/bbbb000000000002'
    )
  })

  it('reicht die Filter aus der Adresse an die API weiter', async () => {
    respond(
      listFixture({
        totals: { count: 1, income: 0, expense: -12.5, net: -12.5 },
      })
    )
    renderWithTheme(
      <BuchungenClient
        query={{
          monat: '2026-02',
          kategorie: 'unkategorisiert',
          richtung: 'aus',
          suche: '77',
        }}
      />
    )
    await screen.findByText('1 Buchung (gefiltert)')
    expect(apiClient.get).toHaveBeenCalledWith('/api/finance/transactions', {
      month: '2026-02',
      category: 'unkategorisiert',
      direction: 'out',
      q: '77',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }))
    expect(mockRouter.replace).toHaveBeenCalledWith(
      '/admin/finance/buchungen?monat=2026-02',
      { scroll: false }
    )
  })

  it('Richtung und Vormonat ändern die Adresse', async () => {
    respond(listFixture())
    renderWithTheme(<BuchungenClient />)
    await screen.findByText('3 Buchungen')
    fireEvent.click(screen.getByRole('button', { name: 'Eingänge' }))
    expect(mockRouter.replace).toHaveBeenLastCalledWith(
      '/admin/finance/buchungen?richtung=ein',
      { scroll: false }
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Vormonat: Januar 2026' })
    )
    expect(mockRouter.replace).toHaveBeenLastCalledWith(
      '/admin/finance/buchungen?monat=2026-01',
      { scroll: false }
    )
  })

  it('schreibt die Suche nach einer Pause in die Adresse', async () => {
    jest.useFakeTimers()
    try {
      respond(listFixture())
      renderWithTheme(<BuchungenClient />)
      await screen.findByText('3 Buchungen')
      fireEvent.change(screen.getByTestId('buchungen-suche'), {
        target: { value: ' zucker ' },
      })
      expect(mockRouter.replace).not.toHaveBeenCalled()
      act(() => {
        jest.advanceTimersByTime(400)
      })
      expect(mockRouter.replace).toHaveBeenCalledWith(
        '/admin/finance/buchungen?suche=zucker',
        { scroll: false }
      )
    } finally {
      jest.useRealTimers()
    }
  })

  it('ungültiger Monat: kein Aufruf, Hinweis', async () => {
    renderWithTheme(<BuchungenClient query={{ monat: '2026-13' }} />)
    expect(
      await screen.findByText('Diesen Monat gibt es nicht')
    ).toBeInTheDocument()
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('ohne Bankdaten: kein Beispielinhalt', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      status: 'no-data',
      data: null,
      message: 'Keine Einzelbuchungen gefunden.',
    })
    renderWithTheme(<BuchungenClient />)
    expect(
      await screen.findByText('Keine Buchungen vorhanden')
    ).toBeInTheDocument()
  })

  it('an der PIN-Station der Passwort-Hinweis', async () => {
    apiClient.get.mockRejectedValue(
      new ApiError('Nur mit Passwort.', 403, 'personal_session_required')
    )
    renderWithTheme(<BuchungenClient />)
    expect(
      await screen.findByTestId('personal-session-notice')
    ).toBeInTheDocument()
  })
})

function detailFixture(): FinanceTransactionDetail {
  return {
    transaction: tx({ note: 'Beispielhinweis' }),
    month: '2026-02',
    related_count: 1,
    related_totals: { count: 1, income: 0, expense: -120.5, net: -120.5 },
    related: [
      {
        id: 'aaaa000000000009',
        booking_date: '2026-01-05',
        amount: -120.5,
        purpose: 'RE-0001 Mehl',
        category_label: 'Wareneinsatz',
      },
    ],
  }
}

describe('BuchungDetailClient', () => {
  beforeEach(() => {
    apiClient.get.mockReset()
  })

  it('zeigt Betrag, Felder, Zuordnung und weitere Buchungen', async () => {
    respond(detailFixture())
    renderWithTheme(<BuchungDetailClient id="aaaa000000000001" />)
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Beispiel-Großhandel GmbH',
      })
    ).toBeInTheDocument()
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/finance/transactions/aaaa000000000001'
    )
    expect(screen.getByTestId('buchung-betrag')).toHaveTextContent('99,99')
    expect(screen.getByText('DE•• •••• 4711')).toBeInTheDocument()
    expect(screen.getByText(/Lastschrift mit Mandat/)).toBeInTheDocument()
    expect(screen.getByText('Beispielhinweis')).toBeInTheDocument()
    expect(screen.getByTestId('verwandt-aaaa000000000009')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Buchungen Februar 2026/ })
    ).toHaveAttribute('href', '/admin/finance/buchungen?monat=2026-02')
  })

  it('404: Hinweis statt Fehler', async () => {
    apiClient.get.mockRejectedValue(new ApiError('Weg.', 404, 'not_found'))
    renderWithTheme(<BuchungDetailClient id="ffff000000000000" />)
    expect(
      await screen.findByText('Diese Buchung gibt es nicht')
    ).toBeInTheDocument()
  })
})
