import React from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import ReportsArchiveClient from './ReportsArchiveClient'
import type {
  DailyReportList,
  DailyReportSummary,
  RangeReport,
} from '../../../lib/reports'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}))

function day(
  date: string,
  weekday: string,
  overrides: Partial<DailyReportSummary> = {}
): DailyReportSummary {
  return {
    status: 'ok',
    date,
    weekday,
    closings: [
      {
        filename: null,
        registerId: '4711',
        reportNumber: 1,
        transactionCount: 2,
      },
    ],
    closingCount: 1,
    revenue: 100,
    receiptCount: 20,
    avgReceipt: 5,
    stornoCount: 0,
    stornoAmount: 0,
    cancelledCount: 0,
    payments: {
      cash: { amount: 60, count: 12 },
      card: { amount: 40, count: 8 },
      other: { amount: 0, count: 0 },
    },
    cashShare: 60,
    cardShare: 40,
    firstReceipt: '06:30',
    lastReceipt: '12:10',
    ...overrides,
  }
}

const summary: RangeReport = {
  status: 'ok',
  from: '2026-05-04',
  to: '2026-05-06',
  dayCount: 2,
  missingDays: ['2026-05-04'],
  revenue: 300,
  receiptCount: 50,
  avgReceipt: 6,
  avgDayRevenue: 150,
  stornoCount: 1,
  cancelledCount: 0,
  payments: {
    cash: { amount: 180, count: 30 },
    card: { amount: 120, count: 20 },
    other: { amount: 0, count: 0 },
  },
  cashShare: 60,
  cardShare: 40,
  bestDay: {
    date: '2026-05-06',
    weekday: 'Mittwoch',
    revenue: 200,
    receiptCount: 30,
  },
  weakestDay: {
    date: '2026-05-05',
    weekday: 'Dienstag',
    revenue: 100,
    receiptCount: 20,
  },
  weekdays: [],
  products: [],
}

const list: DailyReportList = {
  from: '2026-05-04',
  to: '2026-05-06',
  available: true,
  days: [
    { status: 'no-data', date: '2026-05-04', weekday: 'Montag' },
    day('2026-05-05', 'Dienstag', { stornoCount: 1, stornoAmount: -3 }),
    day('2026-05-06', 'Mittwoch', {
      revenue: 200,
      receiptCount: 30,
      closingCount: 2,
    }),
  ],
  summary,
}

describe('ReportsArchiveClient', () => {
  beforeEach(() => mockPush.mockClear())

  it('zeigt Kennzahlen des Zeitraums und markiert Tage ohne Bericht als Lücke', () => {
    renderWithTheme(
      <ReportsArchiveClient
        list={list}
        latestDate="2026-05-06"
        earliestDate="2026-01-02"
      />
    )

    expect(screen.getByText('300,00 €')).toBeInTheDocument()
    expect(screen.getByText('60,0 % bar')).toBeInTheDocument()

    const table = screen.getByRole('table', { name: 'Kassenberichte je Tag' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByText('kein Bericht')).toBeInTheDocument()
    expect(within(rows[0]).queryByText('0,00 €')).not.toBeInTheDocument()
    expect(within(rows[1]).getByText('100,00 €')).toBeInTheDocument()
    expect(within(rows[1]).getByText('1 Storno')).toBeInTheDocument()
    expect(within(rows[2]).getByText('2 Abschlüsse')).toBeInTheDocument()
    expect(
      within(rows[2]).getByRole('link', { name: '06.05.2026' })
    ).toHaveAttribute('href', '/admin/reports/2026-05-06')
  })

  it('blendet Lücken auf Wunsch aus', async () => {
    const user = userEvent.setup()
    renderWithTheme(
      <ReportsArchiveClient
        list={list}
        latestDate="2026-05-06"
        earliestDate="2026-01-02"
      />
    )

    await user.click(screen.getByLabelText(/Tage ohne Bericht ausblenden/))

    const table = screen.getByRole('table', { name: 'Kassenberichte je Tag' })
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(2)
    expect(screen.queryByText('kein Bericht')).not.toBeInTheDocument()
  })

  it('schreibt den gewählten Zeitraum in die URL', async () => {
    const user = userEvent.setup()
    renderWithTheme(
      <ReportsArchiveClient
        list={list}
        latestDate="2026-05-06"
        earliestDate="2026-01-02"
      />
    )

    const from = screen.getByLabelText('Von')
    await user.clear(from)
    await user.type(from, '2026-04-01')
    await user.click(screen.getByRole('button', { name: 'Anzeigen' }))

    expect(mockPush).toHaveBeenCalledWith(
      '/admin/reports?from=2026-04-01&to=2026-05-06'
    )

    await user.click(screen.getByText('7 Tage'))
    expect(mockPush).toHaveBeenLastCalledWith(
      '/admin/reports?from=2026-04-30&to=2026-05-06'
    )
  })

  it('warnt, wenn das Berichtsverzeichnis fehlt, und zeigt keine Zahlen', () => {
    renderWithTheme(
      <ReportsArchiveClient
        list={{
          from: '2026-05-04',
          to: '2026-05-05',
          available: false,
          days: [
            { status: 'no-data', date: '2026-05-04', weekday: 'Montag' },
            { status: 'no-data', date: '2026-05-05', weekday: 'Dienstag' },
          ],
          summary: {
            status: 'no-data',
            from: '2026-05-04',
            to: '2026-05-05',
            dayCount: 0,
            missingDays: ['2026-05-04', '2026-05-05'],
          },
        }}
        latestDate={null}
        earliestDate={null}
      />
    )

    expect(
      screen.getByText(/ist auf diesem Rechner nicht erreichbar/)
    ).toBeInTheDocument()
    expect(screen.queryByText(/€/)).not.toBeInTheDocument()
    expect(screen.getAllByText('kein Bericht')).toHaveLength(2)
  })
})
