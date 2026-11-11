import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PreorderDayClient from './PreorderDayClient'
import { WithSession, fakeSession } from '../../../../lib/testing/fakeSession'
import {
  fetchPickupPointInfo,
  fetchPreorderDay,
} from '../../../../lib/preordersApi'
import {
  ONLY_DATE,
  day,
  pickupDays,
  preorder,
} from '../../../../lib/testing/preorderFixtures'

jest.mock('../../../../lib/preordersApi', () => ({
  ...jest.requireActual('../../../../lib/preordersApi'),
  fetchPickupPointInfo: jest.fn(),
  fetchPreorderDay: jest.fn(),
}))

const mockDay = fetchPreorderDay as jest.MockedFunction<typeof fetchPreorderDay>

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 10, 12, 10), doNotFake: ONLY_DATE })
  jest.clearAllMocks()
  mockDay.mockResolvedValue(day())
  ;(fetchPickupPointInfo as jest.Mock).mockResolvedValue({
    points: [],
    pickupDays: null,
  })
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
      screen.getByRole('heading', { name: /Sa,\s14\.11\.2026/ })
    ).toBeInTheDocument()
    expect(screen.getByText('Noch zu kassieren')).toBeInTheDocument()
    // Bestellweg und Abholort stehen getrennt - "Laden" im Bestellweg ist
    // keine Abholzahl (W4-verify r5).
    // Seit UI-Runde 1 ein eigener Abschnitt statt eines losen Textblocks.
    const section = screen.getByRole('region', { name: 'Abholorte' })
    const places = within(
      within(section).getByRole('list', { name: 'Abholorte' })
    ).getAllByRole('listitem')
    expect(places[0]).toHaveTextContent(/^Laden1 Bestellung$/)
    expect(places[1]).toHaveTextContent(
      /^Kita Teststraße · Übergabe 09:00-09:30 Uhr1 Bestellung$/
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

  describe('Schließtage laut Kalender (Z14)', () => {
    const emptyDay = (date: string) =>
      day({
        date,
        summary: {
          count: 0,
          total: 0,
          byStatus: { offen: 0, bereit: 0, abgeholt: 0, storniert: 0 },
          notCollected: 0,
          paid: 0,
          unpaidTotal: 0,
          byChannel: {},
        },
        sums: [],
        pickupPoints: [],
        preorders: [],
      })

    beforeEach(() => {
      // Fr 13. und Sa 14.11. Betriebsferien
      ;(fetchPickupPointInfo as jest.Mock).mockResolvedValue({
        points: [],
        pickupDays: pickupDays(),
      })
    })

    it('startet ohne Datum am nächsten offenen Tag, nicht am Schließtag', async () => {
      renderWithTheme(<PreorderDayClient />)
      await waitFor(() => expect(mockDay).toHaveBeenCalledWith('2026-11-15'))
      expect(mockDay).not.toHaveBeenCalledWith('2026-11-13')
    })

    it('Server antwortet nicht: es gilt nur der Montag', async () => {
      ;(fetchPickupPointInfo as jest.Mock).mockRejectedValue(new Error('aus'))
      renderWithTheme(<PreorderDayClient />)
      await waitFor(() => expect(mockDay).toHaveBeenCalledWith('2026-11-13'))
    })

    it('ein leerer Schließtag bietet keine Erfassung an und nennt den Grund', async () => {
      mockDay.mockResolvedValue(emptyDay('2026-11-13'))
      renderWithTheme(
        <WithSession value={fakeSession({ role: 'verkauf' })}>
          <PreorderDayClient initialDate="2026-11-13" />
        </WithSession>
      )
      const empty = await screen.findByTestId('preorder-day-empty')
      expect(
        await screen.findByTestId('preorder-day-closed')
      ).toHaveTextContent(
        'An diesem Tag ist die Bäckerei geschlossen (Betriebsferien) - neue Vorbestellungen sind für diesen Tag nicht möglich.'
      )
      expect(
        within(empty).queryByRole('link', { name: /Vorbestellung erfassen/ })
      ).toBeNull()
    })

    it('ein leerer offener Tag bietet die Erfassung weiter an', async () => {
      mockDay.mockResolvedValue(emptyDay('2026-11-15'))
      renderWithTheme(
        <WithSession value={fakeSession({ role: 'verkauf' })}>
          <PreorderDayClient initialDate="2026-11-15" />
        </WithSession>
      )
      const empty = await screen.findByTestId('preorder-day-empty')
      expect(
        within(empty).getByRole('link', { name: /Vorbestellung erfassen/ })
      ).toHaveAttribute('href', '/admin/preorders/neu?date=2026-11-15')
      expect(screen.queryByTestId('preorder-day-closed')).toBeNull()
    })
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

  it('ein leerer Tag ist ein Leerzustand, keine Flächen voller Nullen (UI-Runde 2)', async () => {
    mockDay.mockResolvedValue(
      day({
        date: '2026-11-18',
        summary: {
          count: 0,
          total: 0,
          byStatus: { offen: 0, bereit: 0, abgeholt: 0, storniert: 0 },
          notCollected: 0,
          paid: 0,
          unpaidTotal: 0,
          byChannel: {},
        },
        sums: [],
        pickupPoints: [],
        preorders: [],
      })
    )
    renderWithTheme(
      <WithSession value={fakeSession({ role: 'verkauf' })}>
        <PreorderDayClient initialDate="2026-11-18" />
      </WithSession>
    )
    const empty = await screen.findByTestId('preorder-day-empty')
    expect(empty).toHaveTextContent('Für diesen Tag ist nichts vorbestellt.')
    expect(
      within(empty).getByRole('link', { name: /Vorbestellung erfassen/ })
    ).toHaveAttribute('href', '/admin/preorders/neu?date=2026-11-18')
    expect(screen.queryByText('Noch zu kassieren')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Summen je Produkt' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drucken' })).toBeDisabled()
    // Datum bleibt im Titel zusammen (geschütztes Leerzeichen).
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Vorbestellungen Mi,\u00a018.11.2026'
    )
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
