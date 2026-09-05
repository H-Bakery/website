import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PreorderFormClient from './PreorderFormClient'
import {
  createPreorder,
  fetchAvailableProducts,
  fetchPickupPoints,
  fetchPreorder,
  fetchPreorderSummary,
  updatePreorder,
} from './preorderApi'
import type {
  PickupPoint,
  Preorder,
  PreorderProduct,
  PreorderSummary,
} from './preorderTypes'

const mockPush = jest.fn()
const mockRefresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    refresh: mockRefresh,
  }),
  usePathname: () => '/admin/delivery/preorders/new',
}))

jest.mock('./preorderApi', () => ({
  fetchPickupPoints: jest.fn(),
  fetchAvailableProducts: jest.fn(),
  fetchPreorder: jest.fn(),
  fetchPreorderSummary: jest.fn(),
  createPreorder: jest.fn(),
  updatePreorder: jest.fn(),
}))

const mockFetchPickupPoints = fetchPickupPoints as jest.MockedFunction<
  typeof fetchPickupPoints
>
const mockFetchProducts = fetchAvailableProducts as jest.MockedFunction<
  typeof fetchAvailableProducts
>
const mockFetchPreorder = fetchPreorder as jest.MockedFunction<
  typeof fetchPreorder
>
const mockFetchSummary = fetchPreorderSummary as jest.MockedFunction<
  typeof fetchPreorderSummary
>
const mockCreate = createPreorder as jest.MockedFunction<typeof createPreorder>
const mockUpdate = updatePreorder as jest.MockedFunction<typeof updatePreorder>

/** Der 12.09.2026 ist ein Samstag. */
const DATE = '2026-09-12'

const POINT: PickupPoint = {
  id: 'kindergarten-moersbach',
  name: 'Kindergarten Mörsbach',
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

const PRODUCTS: PreorderProduct[] = [
  { productId: 'bauernbrot', name: 'Bauernbrot', price: 4.1, category: 'brot' },
  {
    productId: 'kaisersemmel',
    name: 'Kaisersemmel',
    // 3 × 4,10 € ergibt ohne Rundung 12.299999999999999.
    price: 0.55,
    category: 'broetchen',
  },
]

const EXISTING: Preorder = {
  id: 7,
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

/** Der Bestellschluss des Liefertags, so wie ihn der Server rechnet. */
const SUMMARY: PreorderSummary = {
  date: DATE,
  pickupPointId: POINT.id,
  deadline: '2026-09-11T10:00:00.000Z',
  hasPickupStop: true,
  count: 0,
  total: 0,
  open: 0,
  handedOver: 0,
  notCollected: 0,
  cancelled: 0,
  byProduct: [],
}

/** Ein Produkt über die Suche in die Positionsliste holen. */
async function addProduct(
  user: ReturnType<typeof userEvent.setup>,
  name: string
) {
  const input = screen.getByLabelText('Artikel suchen und hinzufügen')
  await user.click(input)
  await user.type(input, name.slice(0, 5))
  await user.click(await screen.findByRole('option', { name }))
}

describe('PreorderFormClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchPickupPoints.mockResolvedValue([POINT])
    mockFetchProducts.mockResolvedValue(PRODUCTS)
    mockFetchSummary.mockResolvedValue(SUMMARY)
    mockCreate.mockResolvedValue(EXISTING)
    mockUpdate.mockResolvedValue(EXISTING)
  })

  it('legt eine Vorbestellung an und schickt je Position nur productId und qty', async () => {
    const user = userEvent.setup()
    renderWithTheme(<PreorderFormClient initialDate={DATE} />)

    await screen.findByLabelText('Artikel suchen und hinzufügen')
    await user.type(screen.getByLabelText(/Name/), 'Testkundschaft A')
    await addProduct(user, 'Bauernbrot')
    await user.click(
      screen.getByRole('button', { name: 'Menge erhöhen: Bauernbrot' })
    )

    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        date: DATE,
        customer: 'Testkundschaft A',
        phone: null,
        note: null,
        items: [{ productId: 'bauernbrot', qty: 2 }],
        pickupPointId: POINT.id,
      })
    )
    // Zurück auf den Liefertag der Bestellung, nicht auf heute.
    expect(mockPush).toHaveBeenCalledWith(
      `/admin/delivery/preorders?date=${DATE}&saved=1`
    )
  })

  it('rechnet die Summe live und rundet auf Cent', async () => {
    const user = userEvent.setup()
    renderWithTheme(<PreorderFormClient initialDate={DATE} />)

    await screen.findByLabelText('Artikel suchen und hinzufügen')
    await addProduct(user, 'Bauernbrot')
    const qty = screen.getByLabelText('Menge in Stück: Bauernbrot')
    await user.clear(qty)
    await user.type(qty, '3')

    // 3 × 4,10 € - ohne Rundung stünde hier 12.299999999999999.
    expect(screen.getByTestId('preorder-total')).toHaveTextContent('12,30 €')
  })

  it('besteht auf Kundenname und mindestens einer Position', async () => {
    const user = userEvent.setup()
    renderWithTheme(<PreorderFormClient initialDate={DATE} />)

    await screen.findByLabelText('Artikel suchen und hinzufügen')
    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    expect(
      await screen.findByText('Der Name des Kunden ist erforderlich.')
    ).toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/Name/), 'Testkundschaft A')
    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    expect(
      await screen.findByText(
        'Eine Vorbestellung braucht mindestens eine Position.'
      )
    ).toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('zeigt die deutsche Fehlermeldung des Servers an', async () => {
    const user = userEvent.setup()
    mockCreate.mockRejectedValue(
      new Error(
        'Der 14.09.2026 ist kein Samstag — an diesem Tag wird nicht nach Zweibrücken-Mörsbach geliefert.'
      )
    )
    renderWithTheme(<PreorderFormClient initialDate={DATE} />)

    await screen.findByLabelText('Artikel suchen und hinzufügen')
    await user.type(screen.getByLabelText(/Name/), 'Testkundschaft A')
    await addProduct(user, 'Bauernbrot')
    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )

    expect(await screen.findByText(/ist kein Samstag/)).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  // Der Status stammt vom Seitenaufruf. Schickt die Maske ihn ungefragt mit,
  // überschreibt ein Speichern um 09:05 das „Übergeben", das der Fahrer um
  // 09:03 abgehakt hat.
  it('lädt eine bestehende Bestellung und schickt den unveränderten Status nicht mit', async () => {
    const user = userEvent.setup()
    mockFetchPreorder.mockResolvedValue(EXISTING)
    renderWithTheme(<PreorderFormClient preorderId={7} />)

    expect(await screen.findByText(/MO-2026-09-12-01/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Name/)).toHaveValue('Testkundschaft A')
    expect(screen.getByLabelText('Menge in Stück: Bauernbrot')).toHaveValue('2')

    await user.click(
      screen.getByRole('button', { name: 'Änderungen speichern' })
    )
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(7, {
        date: DATE,
        customer: 'Testkundschaft A',
        phone: '+4900000000',
        note: null,
        items: [{ productId: 'bauernbrot', qty: 2 }],
      })
    )
  })

  it('schickt den Status mit, sobald er in der Maske geändert wurde', async () => {
    const user = userEvent.setup()
    mockFetchPreorder.mockResolvedValue(EXISTING)
    renderWithTheme(<PreorderFormClient preorderId={7} />)

    await screen.findByText(/MO-2026-09-12-01/)
    await user.click(screen.getByRole('combobox', { name: /Status/ }))
    await user.click(await screen.findByRole('option', { name: 'Übergeben' }))
    await user.click(
      screen.getByRole('button', { name: 'Änderungen speichern' })
    )

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ status: 'handed_over' })
      )
    )
  })

  // Samstagmorgen, Telefonbestellung für heute: der Bestellschluss war
  // gestern um 12 Uhr, und das muss vor dem Speichern dastehen.
  it('warnt schon beim Neuanlegen vor dem abgelaufenen Bestellschluss', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 8, 12, 9, 0, 0))
    try {
      renderWithTheme(<PreorderFormClient initialDate={DATE} />)

      expect(
        await screen.findByText(/^Bestellschluss war Freitag, 11\.09\.2026/)
      ).toBeInTheDocument()
      expect(mockFetchSummary).toHaveBeenCalledWith(DATE, POINT.id)
      expect(screen.getByText(/sind trotzdem gültig/)).toBeInTheDocument()
    } finally {
      jest.useRealTimers()
    }
  })

  it('weist auf die fehlende Adresse der Sammelstelle hin', async () => {
    renderWithTheme(<PreorderFormClient initialDate={DATE} />)
    expect(
      await screen.findByText(/noch keine Straße hinterlegt/)
    ).toBeInTheDocument()
  })
})
