import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PreorderDayClient from './PreorderDayClient'
import { fetchPreorderDay } from '../../../../lib/preordersApi'
import {
  ONLY_DATE,
  day,
  preorder,
} from '../../../../lib/testing/preorderFixtures'

jest.mock('../../../../lib/preordersApi', () => ({
  ...jest.requireActual('../../../../lib/preordersApi'),
  fetchPreorderDay: jest.fn(),
}))

const mockDay = fetchPreorderDay as jest.MockedFunction<typeof fetchPreorderDay>

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 10, 12, 10), doNotFake: ONLY_DATE })
  jest.clearAllMocks()
  mockDay.mockResolvedValue(day())
})

afterEach(() => jest.useRealTimers())

describe('PreorderDayClient (P3)', () => {
  it('zeigt Summen je Produkt und Sorte vom Server', async () => {
    renderWithTheme(<PreorderDayClient initialDate="2026-11-14" />)
    const sums = await screen.findByRole('table', {
      name: 'Summen je Produkt und Sorte',
    })
    expect(mockDay).toHaveBeenCalledWith('2026-11-14')
    const rows = within(sums).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Kornbrot 500g–42')
    expect(rows[2]).toHaveTextContent('MustersemmelNuss61')
    expect(
      screen.getByRole('heading', { name: /Sa, 14\.11\.2026/ })
    ).toBeInTheDocument()
    expect(screen.getByText('Noch zu kassieren')).toBeInTheDocument()
    expect(
      screen.getByText(/Kita Teststraße: 1 Bestellung/)
    ).toBeInTheDocument()
    // Bestellweg und Abholort stehen getrennt - "Laden" im Bestellweg ist
    // keine Abholzahl (W4-verify r5).
    expect(screen.getByTestId('preorder-day-places')).toHaveTextContent(
      /^Abholung: Laden: 1 Bestellung · Kita Teststraße: 1 Bestellung/
    )
    expect(screen.getByText(/Bestellweg:/)).toBeInTheDocument()
  })

  it('startet ohne Datum am nächsten Backtag und überspringt den Montag', async () => {
    const user = userEvent.setup()
    renderWithTheme(<PreorderDayClient />)
    await waitFor(() => expect(mockDay).toHaveBeenCalledWith('2026-11-13'))
    // Fr → Sa → So → (Mo übersprungen) → Di
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: 'Nächster Backtag' }))
    }
    await waitFor(() => expect(mockDay).toHaveBeenLastCalledWith('2026-11-17'))
  })

  it('streicht eine stornierte Bestellung durch, aber nicht die Erstattung (W4-verify r4)', async () => {
    mockDay.mockResolvedValue(
      day({
        preorders: [
          preorder({
            id: 9,
            code: 'LA-2026-11-14-03',
            customerName: 'Stefan Storno',
            pickupDate: '2026-11-14',
            status: 'storniert',
            paid: true,
            paymentBalance: -4.8,
          } as Partial<ReturnType<typeof preorder>>),
        ],
      })
    )
    renderWithTheme(<PreorderDayClient initialDate="2026-11-14" />)
    const note = await screen.findByText(/4,80\s€ erstatten/)
    const struck = (el: Element | null) =>
      el ? getComputedStyle(el).textDecoration.includes('line-through') : false
    const moneyCell = note.closest('td')
    expect(struck(moneyCell)).toBe(false)
    expect(struck(note)).toBe(false)
    expect(struck(moneyCell?.querySelector('.preorder-total') ?? null)).toBe(
      true
    )
    expect(struck(screen.getByText('Stefan Storno').closest('td'))).toBe(true)
  })

  it('druckt', async () => {
    const user = userEvent.setup()
    const print = jest.fn()
    window.print = print
    renderWithTheme(<PreorderDayClient initialDate="2026-11-14" />)
    await screen.findByRole('table', { name: 'Summen je Produkt und Sorte' })
    await user.click(screen.getByRole('button', { name: 'Drucken' }))
    expect(print).toHaveBeenCalled()
  })
})
