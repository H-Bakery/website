import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PreorderListClient from './PreorderListClient'
import {
  cancelPreorder,
  fetchPickupPoints,
  fetchPreorderDay,
} from '../../../../lib/preordersApi'
import { preorder } from '../../../../lib/testing/preorderFixtures'
import { WithSession, fakeSession } from '../../../../lib/testing/fakeSession'
import type { PilotRole } from '../../../../lib/roles'
import type {
  PickupPoint,
  Preorder,
  PreorderDay,
} from '../../../../lib/preordersTypes'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/admin/delivery/preorders',
}))

jest.mock('../../../../lib/preordersApi', () => ({
  ...jest.requireActual('../../../../lib/preordersApi'),
  fetchPickupPoints: jest.fn(),
  fetchPreorderDay: jest.fn(),
  cancelPreorder: jest.fn(),
}))

const mockFetchPickupPoints = fetchPickupPoints as jest.MockedFunction<
  typeof fetchPickupPoints
>
const mockDay = fetchPreorderDay as jest.MockedFunction<typeof fetchPreorderDay>
const mockCancel = cancelPreorder as jest.MockedFunction<typeof cancelPreorder>

/** Der 12.09.2026 ist ein Samstag - der Liefertag nach Mörsbach. */
const DATE = '2026-09-12'

const POINT: PickupPoint = {
  id: 'kindergarten-moersbach',
  name: 'Kindergarten Mörsbach',
  // Die Adresse ist hier bewusst leer.
  street: '',
  zip: '',
  city: 'Zweibrücken-Mörsbach',
  weekday: 6,
  window: '09:00-09:30',
  orderDeadline: { weekday: 5, time: '12:00' },
  notes: null,
  active: true,
}

const kita = (overrides: Partial<Preorder>): Preorder =>
  preorder({
    channel: 'sammelstelle',
    pickupDate: DATE,
    pickupTime: null,
    pickupPointId: POINT.id,
    pickupPoint: { id: POINT.id, name: POINT.name, window: POINT.window },
    items: [
      {
        productId: 'mustersemmel',
        name: 'Mustersemmel',
        variant: 'nuss',
        unit: 'Stück',
        unitPrice: 0.6,
        quantity: 2,
        lineTotal: 1.2,
      },
    ],
    total: 1.2,
    ...overrides,
  })

const OPEN = kita({
  id: 1,
  code: 'MO-2026-09-12-01',
  customerName: 'Testkundschaft A',
  updatedAt: '2026-09-10T08:00:00.000Z',
})
const LATE = kita({
  id: 2,
  code: 'MO-2026-09-12-02',
  customerName: 'Testkundschaft B',
  customerPhone: null,
  afterDeadline: true,
})
const CANCELLED = kita({
  id: 3,
  code: 'MO-2026-09-12-03',
  customerName: 'Testkundschaft C',
  status: 'storniert',
})
const HANDED_OVER = kita({
  id: 4,
  code: 'MO-2026-09-12-04',
  customerName: 'Testkundschaft D',
  status: 'abgeholt',
  paid: true,
})

function dayWith(
  preorders: Preorder[],
  overrides: Partial<PreorderDay> = {}
): PreorderDay {
  return {
    date: DATE,
    pickupPointId: POINT.id,
    summary: {
      count: 2,
      total: 16.4,
      byStatus: { offen: 2, bereit: 0, abgeholt: 0, storniert: 1 },
      notCollected: 0,
      paid: 0,
      unpaidTotal: 16.4,
      byChannel: { sammelstelle: 2 },
    },
    sums: [],
    // Freitag, 11.09.2026, 12:00 Uhr - vom Server gerechnet.
    pickupPoints: [
      { ...POINT, deadline: '2026-09-11T10:00:00.000Z', preorderCount: 2 },
    ],
    preorders,
    ...overrides,
  }
}

function renderAs(
  role: PilotRole = 'verkauf',
  props: { initialDate?: string } = { initialDate: DATE }
) {
  return renderWithTheme(
    <WithSession value={fakeSession({ role })}>
      <PreorderListClient {...props} />
    </WithSession>
  )
}

describe('PreorderListClient (Mörsbach, P2 auf /api/preorders)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchPickupPoints.mockResolvedValue([POINT])
    mockDay.mockResolvedValue(dayWith([OPEN, LATE, CANCELLED]))
  })

  it('lädt den Liefertag der Sammelstelle mit einer Anfrage und zeigt Sorten', async () => {
    renderAs()

    expect(
      screen.getByRole('heading', { name: /Vorbestellungen/ })
    ).toBeInTheDocument()
    expect(await screen.findByText('MO-2026-09-12-01')).toBeInTheDocument()
    expect(mockDay).toHaveBeenCalledWith(DATE, POINT.id)
    expect(screen.getByText('Testkundschaft A')).toBeInTheDocument()
    expect(screen.getAllByText('2 × Mustersemmel (Nuss)')).toHaveLength(3)
    // Gesamtsumme des Tages vom Server.
    expect(screen.getAllByText('16,40 €').length).toBeGreaterThan(0)
    // Offen + Bereit heißt wie in der Abholliste „Warten noch“ (W4-verify r4).
    expect(screen.getByText('Warten noch')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abholliste' })).toHaveAttribute(
      'href',
      `/admin/preorders/abholliste?date=${DATE}&point=${POINT.id}`
    )
    expect(
      screen.getByRole('link', { name: 'Vorbestellung erfassen' })
    ).toHaveAttribute(
      'href',
      `/admin/delivery/preorders/new?date=${DATE}&pickupPointId=${POINT.id}`
    )
  })

  it('warnt sichtbar, solange die Adresse der Sammelstelle fehlt', async () => {
    renderAs()
    expect(
      await screen.findByText(/noch keine Straße hinterlegt/)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Adresse nachtragen' })
    ).toHaveAttribute('href', '/admin/delivery/preorders/lieferstelle')
  })

  it('nennt den Bestellschluss und markiert danach erfasste Bestellungen', async () => {
    renderAs()
    expect(
      await screen.findByText(/^Bestellschluss(:| war)/)
    ).toBeInTheDocument()
    expect(screen.getByText('Nach Bestellschluss')).toBeInTheDocument()
  })

  // Der Bestellschluss kommt mit dem Tag, nicht aus einer vorhandenen
  // Bestellung - sonst fehlte er, solange noch nichts erfasst ist.
  it('nennt den Bestellschluss auch an einem Tag ohne Vorbestellung', async () => {
    jest.useFakeTimers()
    // Samstagmorgen: der Bestellschluss war am Freitag um 12 Uhr.
    jest.setSystemTime(new Date(2026, 8, 12, 9, 0, 0))
    try {
      mockDay.mockResolvedValue(dayWith([]))
      renderAs()
      expect(
        await screen.findByText(/^Bestellschluss war Freitag, 11\.09\.2026/)
      ).toBeInTheDocument()
    } finally {
      jest.useRealTimers()
    }
  })

  // Die Ware ist raus und das Geld kassiert: ein Storno löschte den Beleg.
  it('bietet für eine übergebene Bestellung kein Stornieren an', async () => {
    mockDay.mockResolvedValue(dayWith([OPEN, HANDED_OVER]))
    renderAs()
    expect(await screen.findByText('Testkundschaft D')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Vorbestellung MO-2026-09-12-04 stornieren',
      })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', {
        name: 'Vorbestellung MO-2026-09-12-01 stornieren',
      })
    ).toBeEnabled()
  })

  it('zeigt stornierte Bestellungen weiterhin an - durchgestrichen', async () => {
    renderAs()
    expect(await screen.findByText('Testkundschaft C')).toBeInTheDocument()
    expect(screen.getByText('Storniert')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Vorbestellung MO-2026-09-12-03 stornieren',
      })
    ).not.toBeInTheDocument()
  })

  it('storniert erst nach Rückfrage, mit der geladenen Fassung, und lädt neu', async () => {
    const user = userEvent.setup()
    mockCancel.mockResolvedValue({ ...OPEN, status: 'storniert' })
    renderAs()

    await user.click(
      await screen.findByRole('button', {
        name: 'Vorbestellung MO-2026-09-12-01 stornieren',
      })
    )
    expect(
      await screen.findByRole('heading', { name: 'Vorbestellung stornieren?' })
    ).toBeInTheDocument()
    expect(mockCancel).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Stornieren' }))
    await waitFor(() =>
      expect(mockCancel).toHaveBeenCalledWith(1, '2026-09-10T08:00:00.000Z')
    )
    await waitFor(() => expect(mockDay).toHaveBeenCalledTimes(2))
  })

  it('anderes Gerät war schneller: storniert nichts und sagt es', async () => {
    const user = userEvent.setup()
    mockCancel.mockRejectedValue(
      Object.assign(new Error('Inzwischen übergeben.'), {
        code: 'stale_preorder',
      })
    )
    renderAs()
    await user.click(
      await screen.findByRole('button', {
        name: 'Vorbestellung MO-2026-09-12-01 stornieren',
      })
    )
    await user.click(screen.getByRole('button', { name: 'Stornieren' }))
    expect(
      await screen.findByText(/MO-2026-09-12-01: Inzwischen übergeben\./)
    ).toBeInTheDocument()
  })

  it('Fahrer sehen die Liste, erfassen und stornieren aber nicht', async () => {
    renderAs('fahrer')
    expect(await screen.findByText('Testkundschaft A')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Vorbestellung erfassen' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /stornieren$/ })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: 'Vorbestellung MO-2026-09-12-01 ansehen',
      })
    ).toHaveAttribute('href', '/admin/delivery/preorders/1')
  })

  it('warnt, wenn der gewählte Tag kein Liefertag der Sammelstelle ist', async () => {
    // Der 14.09.2026 ist ein Montag.
    mockDay.mockResolvedValue(
      dayWith([], { date: '2026-09-14', pickupPoints: [] })
    )
    renderAs('verkauf', { initialDate: '2026-09-14' })
    expect(
      await screen.findByText(/ist kein Samstag - an diesem Tag wird nicht zu/)
    ).toBeInTheDocument()
  })

  it('zeigt eine Fehlermeldung des Servers statt einer leeren Liste', async () => {
    mockDay.mockRejectedValue(
      new Error('Die Vorbestellungen sind unerreichbar.')
    )
    renderAs()
    expect(
      await screen.findByText('Die Vorbestellungen sind unerreichbar.')
    ).toBeInTheDocument()
  })

  it('wählt ohne Datum in der URL den nächsten Liefertag der Sammelstelle', async () => {
    jest.useFakeTimers()
    // 09.09.2026 ist ein Mittwoch - der nächste Samstag ist der 12.09.
    jest.setSystemTime(new Date(2026, 8, 9, 10, 0, 0))
    try {
      renderAs('verkauf', {})
      await waitFor(() => expect(mockDay).toHaveBeenCalledWith(DATE, POINT.id))
    } finally {
      jest.useRealTimers()
    }
  })

  describe('Layout nach Breite (W4-verify r3)', () => {
    const original = window.matchMedia
    function setWide(wide: boolean) {
      window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        // theme.breakpoints.up('md') -> "(min-width:900px)"
        matches: wide && /min-width/.test(query),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })) as unknown as typeof window.matchMedia
    }
    afterEach(() => {
      window.matchMedia = original
    })

    it('zeigt am Handy Karten mit Summe, Status und Aktion statt einer seitlich scrollenden Tabelle', async () => {
      setWide(false)
      renderAs()
      expect(await screen.findByText('Testkundschaft A')).toBeInTheDocument()
      expect(screen.queryByRole('table')).toBeNull()
      const cards = screen.getAllByTestId('preorder-card')
      expect(cards).toHaveLength(3)
      const first = within(cards[0])
      expect(first.getByText('MO-2026-09-12-01')).toBeInTheDocument()
      expect(first.getByText('2 × Mustersemmel (Nuss)')).toBeInTheDocument()
      expect(first.getByText('Offen')).toBeInTheDocument()
      expect(
        first.getByRole('link', { name: /MO-2026-09-12-01 bearbeiten/ })
      ).toHaveAttribute('href', `/admin/delivery/preorders/${OPEN.id}`)
      expect(
        first.getByRole('button', { name: /MO-2026-09-12-01 stornieren/ })
      ).toBeInTheDocument()
    })

    it('bleibt ab md bei der Tabelle', async () => {
      setWide(true)
      renderAs()
      expect(await screen.findByText('Testkundschaft A')).toBeInTheDocument()
      expect(
        screen.getByRole('table', { name: 'Vorbestellungen des Liefertags' })
      ).toBeInTheDocument()
      expect(screen.queryAllByTestId('preorder-card')).toHaveLength(0)
    })
  })
})
