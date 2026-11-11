import React from 'react'
import { screen, waitFor } from '@testing-library/react'
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
