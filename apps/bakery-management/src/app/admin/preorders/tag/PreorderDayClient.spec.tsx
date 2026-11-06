import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PreorderDayClient from './PreorderDayClient'
import { fetchPreorderDay } from '../../../../lib/preordersApi'
import { ONLY_DATE, day } from '../../../../lib/testing/preorderFixtures'

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
