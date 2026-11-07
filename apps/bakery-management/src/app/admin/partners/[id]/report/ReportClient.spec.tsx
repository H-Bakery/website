import React from 'react'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import ReportClient from './ReportClient'
import {
  fetchPartner,
  fetchStats,
  downloadReportCsv,
} from '../../../../../lib/partnerApi'
import {
  Partner,
  PartnerStats,
  shiftDate,
  toBusinessDate,
  weekdayOf,
} from '../../../../../lib/partnerTypes'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/partners/1/report',
}))

/**
 * recharts misst seinen Container - in jsdom hat der keine Größe, das Chart
 * bliebe leer und würde nur Warnungen produzieren. Ersetzt durch schlichte
 * Divs; `BarChart` reicht die Zahl der Datenpunkte als Attribut weiter, damit
 * sich prüfen lässt, dass je Geschäftstag ein Balken entsteht.
 */
jest.mock('recharts', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const react = require('react')
  const stub = (testId: string) => {
    const Stub = (props: { children?: unknown }) =>
      react.createElement('div', { 'data-testid': testId }, props.children)
    return Stub
  }
  return {
    ResponsiveContainer: stub('responsive-container'),
    BarChart: (props: { data?: unknown[] }) =>
      react.createElement('div', {
        'data-testid': 'bar-chart',
        'data-point-count': String(props.data ? props.data.length : 0),
      }),
    Bar: stub('bar'),
    Cell: stub('cell'),
    CartesianGrid: stub('cartesian-grid'),
    Legend: stub('legend'),
    Tooltip: stub('tooltip'),
    XAxis: stub('x-axis'),
    YAxis: stub('y-axis'),
  }
})

jest.mock('../../../../../lib/partnerApi', () => ({
  fetchPartner: jest.fn(),
  fetchStats: jest.fn(),
  downloadReportCsv: jest.fn(),
}))

const mockFetchPartner = fetchPartner as jest.MockedFunction<
  typeof fetchPartner
>
const mockFetchStats = fetchStats as jest.MockedFunction<typeof fetchStats>
const mockDownloadCsv = downloadReportCsv as jest.MockedFunction<
  typeof downloadReportCsv
>

const PARTNER_ID = '1'

/**
 * Die Seite rechnet ihre Schnellfilter aus dem heutigen Datum. Statt die Zeit
 * einzufrieren wird hier mit denselben Bausteinen gerechnet wie in der Seite -
 * die erwarteten Zeiträume bleiben damit unabhängig vom Testtag exakt.
 */
const TODAY = toBusinessDate()
const MONDAY = shiftDate(TODAY, -((weekdayOf(TODAY) ?? 1) - 1))
const THIS_WEEK = { from: MONDAY, to: TODAY }
const LAST_WEEK = { from: shiftDate(MONDAY, -7), to: shiftDate(MONDAY, -1) }

const PARTNER: Partner = {
  id: 1,
  name: 'CAP-Markt Homburg-Kirrberg',
  slug: 'cap-markt-homburg-kirrberg',
  street: '',
  zip: '',
  city: '',
  contactName: null,
  phone: null,
  email: null,
  deliveryDays: [2, 3, 4, 5, 6],
  settlementModel: 'commission',
  active: true,
  notes: null,
}

/** Zwei offene Geschäftstage (02./03.09.) - Verkauf und Umsatz sind vorläufig. */
const STATS_PROVISIONAL: PartnerStats = {
  range: { from: '2026-09-01', to: '2026-09-03' },
  totals: {
    dayCount: 3,
    openDayCount: 2,
    visitCount: 8,
    refillCount: 3,
    deliveredQty: 80,
    soldQty: 62,
    returnedQty: 18,
    discrepancyQty: 0,
    revenue: 90.8,
    returnValue: 31.2,
    sellThroughRate: 0.775,
    returnRate: 0.225,
  },
  isProvisional: true,
  openDates: ['2026-09-02', '2026-09-03'],
  byProduct: [
    {
      productId: 12,
      productSlug: 'bauernbrot',
      productName: 'Bauernbrot',
      unitPrice: 3.4,
      deliveredQty: 20,
      soldQty: 14,
      returnedQty: 6,
      discrepancyQty: 0,
      revenue: 47.6,
      returnValue: 20.4,
      sellThroughRate: 0.7,
    },
    {
      productId: 34,
      productSlug: 'laugenbroetchen',
      productName: 'Laugenbrötchen',
      unitPrice: 0.9,
      deliveredQty: 60,
      soldQty: 48,
      returnedQty: 12,
      discrepancyQty: 0,
      revenue: 43.2,
      returnValue: 10.8,
      sellThroughRate: 0.8,
    },
  ],
  byDay: [
    {
      businessDate: '2026-09-01',
      weekday: 2,
      isOpen: false,
      visitCount: 3,
      refillCount: 1,
      deliveredQty: 30,
      soldQty: 24,
      returnedQty: 6,
      discrepancyQty: 0,
      revenue: 34.2,
      returnValue: 12.6,
      sellThroughRate: 0.8,
    },
    {
      businessDate: '2026-09-02',
      weekday: 3,
      isOpen: true,
      visitCount: 3,
      refillCount: 1,
      deliveredQty: 25,
      soldQty: 20,
      returnedQty: 5,
      discrepancyQty: 0,
      revenue: 28.3,
      returnValue: 9.3,
      sellThroughRate: 0.8,
    },
    {
      businessDate: '2026-09-03',
      weekday: 4,
      isOpen: true,
      visitCount: 2,
      refillCount: 1,
      deliveredQty: 25,
      soldQty: 18,
      returnedQty: 7,
      discrepancyQty: 0,
      revenue: 28.3,
      returnValue: 9.3,
      sellThroughRate: 0.72,
    },
  ],
  byWeekday: [
    {
      weekday: 2,
      weekdayLabel: 'Dienstag',
      dayCount: 1,
      openDayCount: 0,
      avgDeliveredQty: 30,
      avgSoldQty: 24,
      avgReturnedQty: 6,
      avgRevenue: 34.2,
      sellThroughRate: 0.8,
    },
    {
      weekday: 3,
      weekdayLabel: 'Mittwoch',
      dayCount: 1,
      openDayCount: 1,
      avgDeliveredQty: 25,
      avgSoldQty: 20,
      avgReturnedQty: 5,
      avgRevenue: 28.3,
      sellThroughRate: 0.8,
    },
    {
      weekday: 4,
      weekdayLabel: 'Donnerstag',
      dayCount: 1,
      openDayCount: 1,
      avgDeliveredQty: 25,
      avgSoldQty: 18,
      avgReturnedQty: 7,
      avgRevenue: 28.3,
      sellThroughRate: 0.72,
    },
  ],
}

/** Derselbe Zeitraum, aber jeder Tag mit Abholung abgeschlossen. */
const STATS_COMPLETE: PartnerStats = {
  ...STATS_PROVISIONAL,
  totals: { ...STATS_PROVISIONAL.totals, openDayCount: 0 },
  isProvisional: false,
  openDates: [],
  byDay: STATS_PROVISIONAL.byDay.map((day) => ({ ...day, isOpen: false })),
  byWeekday: STATS_PROVISIONAL.byWeekday.map((day) => ({
    ...day,
    openDayCount: 0,
  })),
}

/** Jeder Tag abgeschlossen, aber am 01.09. wurde ein Produkt nicht gezählt. */
const STATS_INCOMPLETE: PartnerStats = {
  ...STATS_COMPLETE,
  isProvisional: true,
  incompleteDates: ['2026-09-01'],
  totals: {
    ...STATS_COMPLETE.totals,
    uncountedQty: 6,
    incompleteDayCount: 1,
  },
  byDay: STATS_COMPLETE.byDay.map((day, index) =>
    index === 0 ? { ...day, isComplete: false, uncountedQty: 6 } : day
  ),
  byProduct: STATS_COMPLETE.byProduct.map((product, index) =>
    index === 0 ? { ...product, uncountedQty: 6 } : product
  ),
}

function row(name: RegExp) {
  return within(screen.getByRole('row', { name }))
}

async function renderReport() {
  renderWithTheme(<ReportClient partnerId={PARTNER_ID} />)
  await screen.findByRole('heading', { name: 'Abrechnung je Produkt' })
}

describe('ReportClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchPartner.mockResolvedValue(PARTNER)
    mockFetchStats.mockResolvedValue(STATS_PROVISIONAL)
    mockDownloadCsv.mockResolvedValue(undefined)
  })

  it('renders the per-product settlement table with German figures', async () => {
    await renderReport()

    expect(mockFetchStats).toHaveBeenCalledWith(PARTNER_ID, THIS_WEEK)
    // Partner und Zeitraum stehen im Seitenkopf unter „Partner-Report“.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Partner-Report' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/^CAP-Markt Homburg-Kirrberg · \d{2}\.\d{2}\.\d{4} bis /)
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Abrechnung: Kommission - vergütet wird die verkaufte Ware'
      )
    ).toBeInTheDocument()

    const bread = row(/Bauernbrot/)
    expect(bread.getByText('3,40 €')).toBeInTheDocument()
    expect(bread.getByText('20')).toBeInTheDocument()
    expect(bread.getByText('14')).toBeInTheDocument()
    expect(bread.getByText('6')).toBeInTheDocument()
    expect(bread.getByText('70 %')).toBeInTheDocument()
    expect(bread.getByText('47,60 €')).toBeInTheDocument()

    const rolls = row(/Laugenbrötchen/)
    expect(rolls.getByText('0,90 €')).toBeInTheDocument()
    expect(rolls.getByText('60')).toBeInTheDocument()
    expect(rolls.getByText('48')).toBeInTheDocument()
    expect(rolls.getByText('43,20 €')).toBeInTheDocument()

    const total = row(/Gesamt/)
    expect(total.getByText('80')).toBeInTheDocument()
    expect(total.getByText('62')).toBeInTheDocument()
    expect(total.getByText('77,5 %')).toBeInTheDocument()
    expect(total.getByText('90,80 €')).toBeInTheDocument()

    // Tagesverlauf: ein Balkenpaar je Geschäftstag
    expect(screen.getByTestId('bar-chart')).toHaveAttribute(
      'data-point-count',
      '3'
    )
  })

  it('marks a provisional period and names the open business days', async () => {
    await renderReport()

    expect(screen.getByText('Vorläufige Zahlen')).toBeInTheDocument()
    expect(
      screen.getByText(/2 Geschäftstage in diesem Zeitraum sind noch offen/)
    ).toBeInTheDocument()
    expect(screen.getByText('02.09.2026, 03.09.2026')).toBeInTheDocument()
  })

  it('zeigt die Liefermenge offener Tage als „Offen“, die Quote nur über Tage mit Abholung (W4-verify r5)', async () => {
    mockFetchStats.mockResolvedValue({
      ...STATS_PROVISIONAL,
      totals: { ...STATS_PROVISIONAL.totals, openQty: 24 },
      byProduct: STATS_PROVISIONAL.byProduct.map((p, i) =>
        i === 0 ? { ...p, openQty: 4 } : p
      ),
    })
    await renderReport()

    // Geliefert = Verkauft + Retoure + Offen: der offene Teil steht als
    // Hinweis an „Geliefert“, damit höchstens vier Kennzahlen dastehen.
    expect(screen.getByTestId('report-kpi-geliefert')).toHaveTextContent(
      'davon 24 Stück offen (ohne Abholung)'
    )
    // r1: Einschränkung als Hinweis, die Bezeichnung bleibt einzeilig - die
    // umbrochene Bezeichnung schob den Wert aus der Reihe.
    const quote = screen.getByTestId('report-kpi-quote')
    expect(quote).toHaveTextContent('nur Tage mit Abholung')
    expect(screen.queryByText('Abverkaufsquote (Tage mit Abholung)')).toBeNull()
    // Die Eckdaten stehen im Abschnitt „Zeitraum“, nicht lose dazwischen.
    expect(
      within(screen.getByRole('region', { name: 'Zeitraum' })).getByTestId(
        'report-counts'
      )
    ).toHaveTextContent(/Geschäftstage · .* · davon/)
    expect(
      screen.getByText('4 Stück noch offen (Tag ohne Abholung)')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Die Abverkaufsquote rechnet nur Tage mit Abholung/)
    ).toBeInTheDocument()
  })

  it('does not warn about provisional figures for a completed period', async () => {
    mockFetchStats.mockResolvedValue(STATS_COMPLETE)
    await renderReport()

    expect(screen.queryByText('Vorläufige Zahlen')).toBeNull()
    expect(screen.queryByText(/noch offen/)).toBeNull()
    // Die Zahlen selbst stehen weiterhin da
    expect(
      within(screen.getByRole('row', { name: /Gesamt/ })).getByText('90,80 €')
    ).toBeInTheDocument()
  })

  it('marks a period provisional when a pickup left products uncounted', async () => {
    mockFetchStats.mockResolvedValue(STATS_INCOMPLETE)
    await renderReport()

    expect(screen.getByText('Vorläufige Zahlen')).toBeInTheDocument()
    expect(screen.queryByText(/noch offen/)).toBeNull()
    expect(screen.getByText(/An einem Geschäftstag/)).toBeInTheDocument()
    expect(
      screen.getByText(
        /6 Stück sind weder als verkauft noch als Retoure erfasst/
      )
    ).toBeInTheDocument()
    expect(screen.getByText('01.09.2026')).toBeInTheDocument()
    expect(row(/Bauernbrot/).getByText('6 Stück ungezählt')).toBeInTheDocument()
  })

  it('shows a price range after a price change and flags a miscount (W4-verify r2)', async () => {
    mockFetchStats.mockResolvedValue({
      ...STATS_COMPLETE,
      totals: { ...STATS_COMPLETE.totals, discrepancyQty: 3, visitCount: 1 },
      byDay: STATS_COMPLETE.byDay.map((day, index) =>
        index === 0 ? { ...day, discrepancyQty: 3 } : day
      ),
      byProduct: STATS_COMPLETE.byProduct.map((product, index) =>
        index === 0
          ? {
              ...product,
              unitPriceMin: 3.2,
              unitPriceMax: 3.4,
              discrepancyQty: 3,
            }
          : product
      ),
    })
    await renderReport()

    const bread = row(/Bauernbrot/)
    expect(bread.getByText('3,20–3,40 €')).toBeInTheDocument()
    expect(bread.getByText(/3 Stück Abweichung/)).toBeInTheDocument()
    expect(screen.getByTestId('report-discrepancy')).toHaveTextContent(
      'Abweichung: 3 Stück mehr gezählt, als im Schrank sein konnten'
    )
    expect(screen.getByText(/1 Besuch ·/)).toBeInTheDocument()
  })

  it('zeigt beim schnellen Umschalten nie den Zeitraum einer älteren Antwort', async () => {
    const user = userEvent.setup()
    await renderReport()

    // „Letzter Monat“ antwortet langsam, „Letzte Woche“ danach sofort.
    let resolveSlow: (value: typeof STATS_PROVISIONAL) => void = () => undefined
    mockFetchStats.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSlow = resolve
        })
    )
    mockFetchStats.mockResolvedValueOnce(STATS_COMPLETE)
    await user.click(screen.getByRole('button', { name: 'Letzter Monat' }))
    await user.click(screen.getByRole('button', { name: 'Letzte Woche' }))
    await waitFor(() =>
      expect(screen.queryByText('Vorläufige Zahlen')).toBeNull()
    )

    // Die veraltete Antwort kommt zuletzt - sie darf nichts mehr ändern.
    await act(async () => {
      resolveSlow(STATS_PROVISIONAL)
    })
    expect(screen.queryByText('Vorläufige Zahlen')).toBeNull()
  })

  it('reloads the report for a different range when a quick filter is used', async () => {
    const user = userEvent.setup()
    await renderReport()
    expect(mockFetchStats).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Letzte Woche' }))

    await waitFor(() =>
      expect(mockFetchStats).toHaveBeenLastCalledWith(PARTNER_ID, LAST_WEEK)
    )
    expect(mockFetchStats).toHaveBeenCalledTimes(2)
    expect(mockFetchStats).toHaveBeenNthCalledWith(1, PARTNER_ID, THIS_WEEK)
    expect(mockFetchStats).toHaveBeenNthCalledWith(2, PARTNER_ID, LAST_WEEK)

    // Der Export folgt dem neuen Zeitraum
    await user.click(screen.getByRole('button', { name: 'CSV exportieren' }))
    await waitFor(() =>
      expect(mockDownloadCsv).toHaveBeenCalledWith(PARTNER_ID, LAST_WEEK)
    )
  })

  it('lädt den CSV-Export per fetch mit Token statt über einen Link (F4)', async () => {
    const user = userEvent.setup()
    await renderReport()

    // Ein Link trüge kein Authorization - die echte API antwortete 401.
    expect(screen.queryByRole('link', { name: 'CSV exportieren' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'CSV exportieren' }))
    await waitFor(() =>
      expect(mockDownloadCsv).toHaveBeenCalledWith(PARTNER_ID, THIS_WEEK)
    )
    expect(screen.queryByText(/CSV-Export fehlgeschlagen/)).toBeNull()
  })

  it('zeigt die deutsche Meldung, wenn der CSV-Export scheitert', async () => {
    const user = userEvent.setup()
    mockDownloadCsv.mockRejectedValue(new Error('Nicht angemeldet.'))
    await renderReport()

    await user.click(screen.getByRole('button', { name: 'CSV exportieren' }))
    expect(
      await screen.findByText('CSV-Export fehlgeschlagen: Nicht angemeldet.')
    ).toBeInTheDocument()
  })

  it('shows the German error message when the report cannot be loaded', async () => {
    mockFetchStats.mockRejectedValue(
      new Error('Der Zeitraum konnte nicht geladen werden.')
    )
    renderWithTheme(<ReportClient partnerId={PARTNER_ID} />)

    expect(
      await screen.findByText('Der Zeitraum konnte nicht geladen werden.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Erneut versuchen' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Abrechnung je Produkt' })
    ).toBeNull()
  })
})
