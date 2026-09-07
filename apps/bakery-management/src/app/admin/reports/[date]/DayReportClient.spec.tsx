import React from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import DayReportClient from './DayReportClient'
import type { DailyReport } from '../../../../lib/reports'

const report: DailyReport = {
  status: 'ok',
  date: '2026-05-05',
  weekday: 'Dienstag',
  closings: [
    {
      filename: null,
      registerId: '4711',
      reportNumber: 1,
      transactionCount: 3,
    },
  ],
  closingCount: 1,
  revenue: 10,
  receiptCount: 2,
  avgReceipt: 5,
  stornoCount: 1,
  stornoAmount: -4,
  cancelledCount: 0,
  payments: {
    cash: { amount: 7, count: 2 },
    card: { amount: 3, count: 1 },
    other: { amount: 0, count: 0 },
  },
  cashShare: 70,
  cardShare: 30,
  firstReceipt: '06:40',
  lastReceipt: '11:05',
  products: [
    { productId: '1', productName: 'Testbrot', quantity: 2, revenue: 8 },
    { productId: '2', productName: 'Testhörnchen', quantity: 2, revenue: 3 },
    { productId: '3', productName: 'Testkuchen', quantity: -1, revenue: -1 },
  ],
  hours: [
    { hour: '06', revenue: 8, receiptCount: 1 },
    { hour: '11', revenue: 2, receiptCount: 1 },
  ],
}

describe('DayReportClient', () => {
  it('zeigt Kennzahlen, Zahlungsmix und Positionen nach Produkt', async () => {
    renderWithTheme(
      <DayReportClient
        report={report}
        previousDate="2026-05-03"
        nextDate={null}
      />
    )

    expect(
      screen.getByRole('heading', { name: /Dienstag, 05.05.2026/ })
    ).toBeInTheDocument()
    expect(screen.getByText('10,00 €')).toBeInTheDocument()
    expect(screen.getByText(/1 Storno \(-4,00 €\)/)).toBeInTheDocument()
    expect(screen.getByText(/Karte 3,00 €/)).toBeInTheDocument()

    const table = screen.getByRole('table', { name: 'Positionen nach Produkt' })
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(3)
    expect(
      screen.getByText(/Ein Produkt hat eine negative Menge/)
    ).toBeInTheDocument()

    // Vor/Zurück: der frühere Tag ist verlinkt, ein späterer fehlt
    expect(screen.getByRole('link', { name: /03.05.2026/ })).toHaveAttribute(
      'href',
      '/admin/reports/2026-05-03'
    )
    expect(screen.getByText('kein späterer')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Produkt suchen'), 'hörn')
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(1)
    expect(within(table).getByText('Testhörnchen')).toBeInTheDocument()
  })

  it('erklärt einen Tag ohne Bericht als Lücke, nicht als Umsatz 0', () => {
    renderWithTheme(
      <DayReportClient
        report={{ status: 'no-data', date: '2026-05-04', weekday: 'Montag' }}
        previousDate="2026-05-03"
        nextDate="2026-05-05"
      />
    )

    expect(screen.getByText(/liegt kein Kassenbericht vor/)).toBeInTheDocument()
    expect(screen.queryByText('0,00 €')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /05.05.2026/ })).toHaveAttribute(
      'href',
      '/admin/reports/2026-05-05'
    )
  })

  it('weist ein ungültiges Datum ab', () => {
    renderWithTheme(
      <DayReportClient
        report={{ status: 'no-data', date: 'gestern', weekday: null }}
        previousDate={null}
        nextDate={null}
        invalidDate
      />
    )
    expect(screen.getByText(/kein gültiges Datum/)).toBeInTheDocument()
  })
})
