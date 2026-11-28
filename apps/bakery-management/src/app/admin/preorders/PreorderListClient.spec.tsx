import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PreorderListClient from './PreorderListClient'
import { fetchPickupPointInfo, listPreorders } from '../../../lib/preordersApi'
import { filtersFromQuery } from '../../../lib/preordersTypes'
import {
  ONLY_DATE,
  POINT,
  pickupDays,
  preorder,
} from '../../../lib/testing/preorderFixtures'
import { WithSession, fakeSession } from '../../../lib/testing/fakeSession'
import type { PilotRole } from '../../../lib/roles'

const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
    back: jest.fn(),
    prefetch: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/admin/preorders',
}))

jest.mock('../../../lib/preordersApi', () => ({
  ...jest.requireActual('../../../lib/preordersApi'),
  fetchPickupPointInfo: jest.fn(),
  listPreorders: jest.fn(),
}))

const mockList = listPreorders as jest.MockedFunction<typeof listPreorders>

function renderAs(role: PilotRole, props = {}) {
  return renderWithTheme(
    <WithSession value={fakeSession({ role })}>
      <PreorderListClient {...props} />
    </WithSession>
  )
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 10, 12, 10), doNotFake: ONLY_DATE })
  jest.clearAllMocks()
  ;(fetchPickupPointInfo as jest.Mock).mockResolvedValue({
    points: [POINT],
    pickupDays: null,
  })
  mockList.mockResolvedValue([
    preorder(),
    preorder({
      id: 8,
      code: 'MO-2026-11-14-01',
      customerName: 'Max Muster',
      pickupDate: '2026-11-14',
      pickupTime: null,
      pickupPointId: POINT.id,
      pickupPoint: { id: POINT.id, name: POINT.name, window: POINT.window },
      channel: 'sammelstelle',
      status: 'storniert',
    }),
  ])
})

afterEach(() => jest.useRealTimers())

describe('PreorderListClient (P3)', () => {
  it('lädt standardmäßig ab heute und zählt Stornierte nicht mit', async () => {
    renderAs('verkauf')
    expect(await screen.findByText('Erika Beispiel')).toBeInTheDocument()
    expect(mockList).toHaveBeenCalledWith({ from: '2026-11-12' })
    expect(
      screen.getByRole('heading', { name: 'Bestellungen (1)' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('preorder-count')).toHaveTextContent(
      'Summe 4,80 € · dazu 1 storniert'
    )
    expect(document.querySelector('[data-status="storniert"]')).not.toBeNull()
    expect(
      screen.getByText(/Kita Teststraße \(09:00-09:30\)/)
    ).toBeInTheDocument()
    expect(mockReplace).toHaveBeenCalledWith(
      '/admin/preorders?from=2026-11-12',
      { scroll: false }
    )
    expect(
      screen.getByRole('link', { name: /Neue Vorbestellung/ })
    ).toHaveAttribute('href', '/admin/preorders/neu')
  })

  it('filtert nach Status, Zeitraum und Suche', async () => {
    const user = userEvent.setup()
    renderAs('verkauf')
    await screen.findByText('Erika Beispiel')

    // Am Handy (jsdom) sind die weiteren Filter zugeklappt.
    expect(screen.queryByRole('button', { name: 'Offen' })).toBeNull()
    const more = screen.getByRole('button', { name: 'Weitere Filter' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    await user.click(more)
    await user.click(screen.getByRole('button', { name: 'Offen' }))
    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith({
        from: '2026-11-12',
        status: ['offen'],
      })
    )
    await user.click(screen.getByRole('button', { name: /Nächster Backtag/ }))
    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: '2026-11-13', to: '2026-11-13' })
      )
    )
    await user.type(screen.getByLabelText('Suche'), 'Erika')
    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'Erika', status: ['offen'] })
      )
    )

    // zugeklappt bleibt sichtbar, welcher Filter wirkt
    await user.click(screen.getByRole('button', { name: 'Weitere Filter (1)' }))
    expect(screen.getByTestId('filter-summary')).toHaveTextContent(
      'Aktiv: Offen'
    )
  })

  it('„Nächster Backtag“ überspringt die Schließtage des Kalenders (Z14)', async () => {
    const user = userEvent.setup()
    // Fr 13. und Sa 14.11. Betriebsferien - der nächste Backtag ist So 15.11.
    ;(fetchPickupPointInfo as jest.Mock).mockResolvedValue({
      points: [POINT],
      pickupDays: pickupDays(),
    })
    renderAs('verkauf')
    const chip = await screen.findByRole('button', {
      name: /Nächster Backtag \(So,\s15\.11\.2026\)/,
    })
    await user.click(chip)
    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: '2026-11-15', to: '2026-11-15' })
      )
    )
  })

  it('übernimmt Filter aus der URL', async () => {
    renderAs('verkauf', {
      initialFilters: { date: '2026-11-14', channel: 'whatsapp' },
    })
    await screen.findByText('Erika Beispiel')
    expect(mockList).toHaveBeenCalledWith({
      date: '2026-11-14',
      channel: 'whatsapp',
    })
  })

  it('„Alle Tage“ steht in der URL und überlebt das Neuladen', async () => {
    const user = userEvent.setup()
    const first = renderAs('verkauf')
    await screen.findByText('Erika Beispiel')
    await user.click(screen.getByRole('button', { name: 'Alle Tage' }))
    await waitFor(() =>
      expect(mockReplace).toHaveBeenLastCalledWith(
        '/admin/preorders?range=alle',
        { scroll: false }
      )
    )
    expect(mockList).toHaveBeenLastCalledWith({})
    first.unmount()

    // neu geladen: die Seite liest dieselbe URL
    mockList.mockClear()
    renderAs('verkauf', {
      initialFilters: filtersFromQuery({ range: 'alle' }),
    })
    await screen.findByText('Erika Beispiel')
    expect(mockList).toHaveBeenCalledWith({})
    expect(screen.getByRole('button', { name: 'Alle Tage' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('Fahrer sehen keine Erfassung', async () => {
    renderAs('fahrer')
    await screen.findByText('Erika Beispiel')
    expect(
      screen.queryByRole('link', { name: /Neue Vorbestellung/ })
    ).toBeNull()
  })

  describe('Tabelle oder Karten nach Breite des Inhalts (Tablet quer)', () => {
    const original = window.matchMedia
    /** `matchMedia` wie ein Fenster mit `width` px (nur `min-width`). */
    function viewport(width: number) {
      window.matchMedia = jest.fn().mockImplementation((query: string) => {
        const min = /min-width:\s*([\d.]+)px/.exec(query)
        return {
          matches: min ? width >= Number(min[1]) : false,
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        }
      }) as unknown as typeof window.matchMedia
    }
    afterEach(() => {
      window.matchMedia = original
    })

    it.each([
      ['am Handy (390 px)', 390],
      // neben der festen Seitenleiste bleiben ~700 px - die Summe lag
      // in der Tabelle seitlich außer Sicht
      ['quer am Tablet (1024 px)', 1024],
      ['quer am Tablet (1180 px)', 1180],
    ])('%s: Karten mit Status und Summe', async (_label, width) => {
      viewport(width)
      renderAs('verkauf')
      const list = await screen.findByRole('list', { name: 'Vorbestellungen' })
      expect(screen.queryByRole('table')).toBeNull()
      const cards = within(list).getAllByRole('listitem')
      expect(cards).toHaveLength(2)
      const first = within(cards[0])
      expect(first.getByText('Erika Beispiel')).toBeInTheDocument()
      expect(first.getByText('Offen')).toBeInTheDocument()
      expect(first.getByText(/4,80\s€/)).toBeInTheDocument()
      expect(first.getByText(/nicht bezahlt/)).toBeInTheDocument()
      expect(within(cards[1]).getByText('Storniert')).toBeInTheDocument()
    })

    it('am PC (1440 px): die Tabelle mit Status und Summe', async () => {
      viewport(1440)
      renderAs('verkauf')
      const table = await screen.findByRole('table', {
        name: 'Vorbestellungen',
      })
      expect(
        within(table)
          .getAllByRole('columnheader')
          .map((th) => th.textContent)
      ).toEqual(['Code', 'Status', 'Abholung', 'Kunde', 'Artikel', 'Summe'])
      expect(screen.queryByRole('list', { name: 'Vorbestellungen' })).toBeNull()
    })
  })

  it('zeigt Fehler mit „Erneut versuchen“', async () => {
    mockList.mockRejectedValueOnce(new Error('Keine Verbindung zur API.'))
    renderAs('verkauf')
    expect(
      await screen.findByText('Keine Verbindung zur API.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Erneut versuchen' })
    ).toBeInTheDocument()
  })
})
