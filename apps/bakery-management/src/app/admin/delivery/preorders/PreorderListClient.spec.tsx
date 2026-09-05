import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PreorderListClient from './PreorderListClient'
import {
  cancelPreorder,
  fetchPickupPoints,
  fetchPreorderSummary,
  fetchPreorders,
} from './preorderApi'
import type { PickupPoint, Preorder, PreorderSummary } from './preorderTypes'

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

jest.mock('./preorderApi', () => ({
  fetchPickupPoints: jest.fn(),
  fetchPreorders: jest.fn(),
  fetchPreorderSummary: jest.fn(),
  cancelPreorder: jest.fn(),
}))

const mockFetchPickupPoints = fetchPickupPoints as jest.MockedFunction<
  typeof fetchPickupPoints
>
const mockFetchPreorders = fetchPreorders as jest.MockedFunction<
  typeof fetchPreorders
>
const mockFetchSummary = fetchPreorderSummary as jest.MockedFunction<
  typeof fetchPreorderSummary
>
const mockCancel = cancelPreorder as jest.MockedFunction<typeof cancelPreorder>

/** Der 12.09.2026 ist ein Samstag - der Liefertag nach Mörsbach. */
const DATE = '2026-09-12'

const POINT: PickupPoint = {
  id: 'kindergarten-moersbach',
  name: 'Kindergarten Mörsbach',
  // Die Adresse ist bewusst leer - sie ist noch nicht bekannt.
  street: '',
  zip: '',
  city: 'Zweibrücken-Mörsbach',
  weekday: 6,
  window: '09:00-09:30',
  orderDeadline: { weekday: 5, time: '12:00' },
  notes: null,
  active: true,
  lat: null,
  lon: null,
  geocodeSource: null,
  geocodePrecision: null,
}

const OPEN_PREORDER: Preorder = {
  id: 1,
  reference: 'MO-2026-09-12-01',
  pickupPointId: POINT.id,
  date: DATE,
  customer: 'Testkundschaft A',
  phone: '+4900000000',
  items: [
    {
      productId: 'bauernbrot',
      name: 'Bauernbrot',
      qty: 2,
      unit: 'Stück',
      unitPrice: 4.1,
      lineTotal: 8.2,
    },
  ],
  total: 8.2,
  note: null,
  status: 'open',
  handedOverAt: null,
  createdAt: '2026-09-10T08:00:00.000Z',
  updatedAt: '2026-09-10T08:00:00.000Z',
  deadline: '2026-09-11T10:00:00.000Z',
  afterDeadline: false,
}

const LATE_PREORDER: Preorder = {
  ...OPEN_PREORDER,
  id: 2,
  reference: 'MO-2026-09-12-02',
  customer: 'Testkundschaft B',
  phone: null,
  afterDeadline: true,
}

const HANDED_OVER_PREORDER: Preorder = {
  ...OPEN_PREORDER,
  id: 4,
  reference: 'MO-2026-09-12-04',
  customer: 'Testkundschaft D',
  status: 'handed_over',
  handedOverAt: '2026-09-12T07:12:00.000Z',
}

const CANCELLED_PREORDER: Preorder = {
  ...OPEN_PREORDER,
  id: 3,
  reference: 'MO-2026-09-12-03',
  customer: 'Testkundschaft C',
  status: 'cancelled',
}

const SUMMARY: PreorderSummary = {
  date: DATE,
  pickupPointId: POINT.id,
  // Freitag, 11.09.2026, 12:00 Uhr - vom Server gerechnet.
  deadline: '2026-09-11T10:00:00.000Z',
  hasPickupStop: true,
  count: 2,
  total: 16.4,
  open: 2,
  handedOver: 0,
  notCollected: 0,
  cancelled: 1,
  byProduct: [
    { productId: 'bauernbrot', name: 'Bauernbrot', unit: 'Stück', qty: 4 },
  ],
}

describe('PreorderListClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchPickupPoints.mockResolvedValue([POINT])
    mockFetchPreorders.mockResolvedValue([
      OPEN_PREORDER,
      LATE_PREORDER,
      CANCELLED_PREORDER,
    ])
    mockFetchSummary.mockResolvedValue(SUMMARY)
  })

  it('lädt den Liefertag aus der URL und zeigt Bestellungen samt Summe', async () => {
    renderWithTheme(<PreorderListClient initialDate={DATE} />)

    expect(
      screen.getByRole('heading', { name: /Vorbestellungen/ })
    ).toBeInTheDocument()

    expect(await screen.findByText('MO-2026-09-12-01')).toBeInTheDocument()
    expect(mockFetchPreorders).toHaveBeenCalledWith({
      date: DATE,
      pickupPointId: POINT.id,
    })
    expect(mockFetchSummary).toHaveBeenCalledWith(DATE, POINT.id)

    expect(screen.getByText('Testkundschaft A')).toBeInTheDocument()
    expect(screen.getAllByText('2× Bauernbrot')).toHaveLength(3)
    // Gesamtsumme des Tages aus der Summary.
    expect(screen.getByText('16,40 €')).toBeInTheDocument()
  })

  it('warnt sichtbar, solange die Adresse der Sammelstelle fehlt', async () => {
    renderWithTheme(<PreorderListClient initialDate={DATE} />)

    expect(
      await screen.findByText(/noch keine Straße hinterlegt/)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Adresse nachtragen' })
    ).toHaveAttribute('href', '/admin/delivery/preorders/lieferstelle')
  })

  it('nennt den Bestellschluss und markiert danach erfasste Bestellungen', async () => {
    renderWithTheme(<PreorderListClient initialDate={DATE} />)

    expect(
      await screen.findByText(/^Bestellschluss(:| war)/)
    ).toBeInTheDocument()
    expect(screen.getByText('Nach Bestellschluss')).toBeInTheDocument()
  })

  // Der Bestellschluss kommt aus der Tagesauswertung, nicht aus einer
  // vorhandenen Bestellung - sonst fehlte er an genau den Tagen, an denen er
  // gebraucht wird: solange noch nichts erfasst ist.
  it('nennt den Bestellschluss auch an einem Tag ohne Vorbestellung', async () => {
    jest.useFakeTimers()
    // Samstagmorgen: der Bestellschluss war am Freitag um 12 Uhr.
    jest.setSystemTime(new Date(2026, 8, 12, 9, 0, 0))
    try {
      mockFetchPreorders.mockResolvedValue([])
      mockFetchSummary.mockResolvedValue({
        ...SUMMARY,
        count: 0,
        total: 0,
        open: 0,
        cancelled: 0,
        byProduct: [],
      })
      renderWithTheme(<PreorderListClient initialDate={DATE} />)

      expect(
        await screen.findByText(/^Bestellschluss war Freitag, 11\.09\.2026/)
      ).toBeInTheDocument()
    } finally {
      jest.useRealTimers()
    }
  })

  // Ohne Sammelstellen-Stopp hängt die Übergabeliste an nichts.
  it('warnt, wenn für den Liefertag kein Sammelstellen-Stopp existiert', async () => {
    mockFetchSummary.mockResolvedValue({ ...SUMMARY, hasPickupStop: false })
    renderWithTheme(<PreorderListClient initialDate={DATE} />)

    expect(
      await screen.findByText(/erreichen den Fahrer nicht/)
    ).toBeInTheDocument()
  })

  it('meldet den fehlenden Stopp nicht, wenn die Tour ihn hat', async () => {
    renderWithTheme(<PreorderListClient initialDate={DATE} />)

    await screen.findByText('MO-2026-09-12-01')
    expect(
      screen.queryByText(/erreichen den Fahrer nicht/)
    ).not.toBeInTheDocument()
  })

  // Die Ware ist raus und das Geld kassiert: ein Storno löschte den Beleg.
  it('bietet für eine übergebene Bestellung kein Stornieren an', async () => {
    mockFetchPreorders.mockResolvedValue([OPEN_PREORDER, HANDED_OVER_PREORDER])
    renderWithTheme(<PreorderListClient initialDate={DATE} />)

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
    renderWithTheme(<PreorderListClient initialDate={DATE} />)

    expect(await screen.findByText('Testkundschaft C')).toBeInTheDocument()
    expect(screen.getByText('Storniert')).toBeInTheDocument()
    // Für eine bereits stornierte Bestellung gibt es keinen Storno-Knopf mehr.
    expect(
      screen.queryByRole('button', {
        name: 'Vorbestellung MO-2026-09-12-03 stornieren',
      })
    ).not.toBeInTheDocument()
  })

  it('storniert erst nach Rückfrage und lädt danach neu', async () => {
    const user = userEvent.setup()
    mockCancel.mockResolvedValue({ ...OPEN_PREORDER, status: 'cancelled' })
    renderWithTheme(<PreorderListClient initialDate={DATE} />)

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
    await waitFor(() => expect(mockCancel).toHaveBeenCalledWith(1))
    // Nach dem Stornieren wird der Tag frisch geladen.
    await waitFor(() => expect(mockFetchPreorders).toHaveBeenCalledTimes(2))
  })

  it('warnt, wenn der gewählte Tag kein Liefertag der Sammelstelle ist', async () => {
    // Der 14.09.2026 ist ein Montag.
    mockFetchPreorders.mockResolvedValue([])
    mockFetchSummary.mockResolvedValue({
      ...SUMMARY,
      date: '2026-09-14',
      count: 0,
      total: 0,
      open: 0,
      cancelled: 0,
      byProduct: [],
    })
    renderWithTheme(<PreorderListClient initialDate="2026-09-14" />)

    expect(
      await screen.findByText(/ist kein Samstag - an diesem Tag wird nicht zu/)
    ).toBeInTheDocument()
  })

  it('zeigt eine Fehlermeldung des Servers statt einer leeren Liste', async () => {
    mockFetchPreorders.mockRejectedValue(
      new Error('Die Vorbestellungen sind unerreichbar.')
    )
    renderWithTheme(<PreorderListClient initialDate={DATE} />)

    expect(
      await screen.findByText('Die Vorbestellungen sind unerreichbar.')
    ).toBeInTheDocument()
  })

  it('wählt ohne Datum in der URL den nächsten Liefertag der Sammelstelle', async () => {
    jest.useFakeTimers()
    // 09.09.2026 ist ein Mittwoch - der nächste Samstag ist der 12.09.
    jest.setSystemTime(new Date(2026, 8, 9, 10, 0, 0))
    try {
      renderWithTheme(<PreorderListClient />)
      await waitFor(() =>
        expect(mockFetchPreorders).toHaveBeenCalledWith({
          date: DATE,
          pickupPointId: POINT.id,
        })
      )
    } finally {
      jest.useRealTimers()
    }
  })
})
