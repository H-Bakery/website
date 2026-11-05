import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PreorderListClient from './PreorderListClient'
import { fetchPickupPoints, listPreorders } from '../../../lib/preordersApi'
import {
  ONLY_DATE,
  POINT,
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
  fetchPickupPoints: jest.fn(),
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
  ;(fetchPickupPoints as jest.Mock).mockResolvedValue([POINT])
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
    expect(screen.getByTestId('preorder-count')).toHaveTextContent(
      '1 Vorbestellung · 4,80 € · 1 storniert'
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

  it('Fahrer sehen keine Erfassung', async () => {
    renderAs('fahrer')
    await screen.findByText('Erika Beispiel')
    expect(
      screen.queryByRole('link', { name: /Neue Vorbestellung/ })
    ).toBeNull()
  })

  it('zeigt Fehler mit „Erneut versuchen"', async () => {
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
