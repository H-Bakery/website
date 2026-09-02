import React from 'react'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import VisitFormClient from './VisitFormClient'
import type { CatalogueGroup } from './VisitFormClient'
import {
  createVisit,
  fetchTemplates,
  fetchToday,
  fetchVisits,
} from '../../../../../../lib/partnerApi'
import type {
  DayDetail,
  PartnerDeliveryTemplate,
  PartnerVisit,
} from '../../../../../../lib/partnerTypes'

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
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/partners/1/visit/new',
}))

jest.mock('../../../../../../lib/partnerApi', () => ({
  fetchTemplates: jest.fn(),
  fetchToday: jest.fn(),
  fetchVisits: jest.fn(),
  createVisit: jest.fn(),
  updateVisit: jest.fn(),
}))

const mockCreateVisit = createVisit as jest.MockedFunction<typeof createVisit>
const mockFetchTemplates = fetchTemplates as jest.MockedFunction<
  typeof fetchTemplates
>
const mockFetchToday = fetchToday as jest.MockedFunction<typeof fetchToday>
const mockFetchVisits = fetchVisits as jest.MockedFunction<typeof fetchVisits>

/** 25.08.2026 ist ein Dienstag - einer der Liefertage des CAP-Markts. */
const BUSINESS_DATE = '2026-08-25'
const PARTNER_ID = '1'
const DRAFT_KEY = `bakery.partnerVisitDraft.v1.${PARTNER_ID}.${BUSINESS_DATE}`

const GROUPS: CatalogueGroup[] = [
  {
    category: 'brot',
    label: 'Brot',
    products: [
      {
        productId: 1,
        productSlug: 'roggenbrot',
        productName: 'Roggenbrot',
        unitPrice: 4.5,
        category: 'brot',
        categoryLabel: 'Brot',
        available: true,
      },
      {
        productId: 2,
        productSlug: 'bauernbrot',
        productName: 'Bauernbrot',
        unitPrice: 5.2,
        category: 'brot',
        categoryLabel: 'Brot',
        available: true,
      },
    ],
  },
  {
    category: 'broetchen',
    label: 'Brötchen',
    products: [
      {
        productId: 3,
        productSlug: 'kaisersemmel',
        productName: 'Kaisersemmel',
        unitPrice: 0.55,
        category: 'broetchen',
        categoryLabel: 'Brötchen',
        available: true,
      },
    ],
  },
  {
    category: 'teilchen',
    label: 'Teilchen',
    products: [
      {
        productId: 4,
        productSlug: 'apfeltasche',
        productName: 'Apfeltasche',
        unitPrice: 1.8,
        category: 'teilchen',
        categoryLabel: 'Teilchen',
        available: true,
      },
    ],
  },
]

const EMPTY_TOTALS: DayDetail['totals'] = {
  dayCount: 1,
  openDayCount: 1,
  visitCount: 0,
  refillCount: 0,
  deliveredQty: 0,
  soldQty: 0,
  returnedQty: 0,
  discrepancyQty: 0,
  revenue: 0,
  returnValue: 0,
  sellThroughRate: null,
  returnRate: null,
}

const DAY_DETAIL: DayDetail & { visits: PartnerVisit[] } = {
  businessDate: BUSINESS_DATE,
  isOpen: true,
  timeline: [],
  totals: EMPTY_TOTALS,
  byProduct: [],
  visits: [],
}

/** Dienstags-Vorlage: eine Position im offenen, eine im zugeklappten Bereich. */
const TUESDAY_TEMPLATE: PartnerDeliveryTemplate = {
  id: 7,
  partnerId: 1,
  weekday: 2,
  active: true,
  items: [
    { productId: 3, productSlug: 'kaisersemmel', quantity: 40 },
    { productId: 1, productSlug: 'roggenbrot', quantity: 6 },
  ],
}

const SAVED_VISIT: PartnerVisit = {
  id: 99,
  partnerId: 1,
  businessDate: BUSINESS_DATE,
  visitAt: `${BUSINESS_DATE}T06:00:00.000Z`,
  visitType: 'initial',
  sequence: 1,
  staffId: null,
  staffName: null,
  note: null,
  items: [],
}

/**
 * Das globale Test-Setup ersetzt `window.localStorage` durch nicht
 * konfigurierbare `jest.fn()`s - deshalb kein `defineProperty`, sondern eine
 * echte In-Memory-Ablage auf denselben Mocks.
 */
const storage = window.localStorage as unknown as {
  getItem: jest.Mock
  setItem: jest.Mock
  removeItem: jest.Mock
}

/** Hält einen Ladevorgang an, bis der Test ihn ausdrücklich freigibt. */
function createGate() {
  let open!: (value?: unknown) => void
  const opened = new Promise((resolve) => {
    open = resolve
  })
  return { opened, open }
}

async function renderForm(props: { initialDate?: string; visitId?: number }) {
  const view = renderWithTheme(
    <VisitFormClient partnerId={PARTNER_ID} groups={GROUPS} {...props} />
  )
  await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull())
  return view
}

describe('VisitFormClient (admin/partners/[id]/visit/new)', () => {
  let store: Record<string, string>

  beforeEach(() => {
    jest.clearAllMocks()

    store = {}
    storage.getItem.mockImplementation((key: string) => store[key] ?? null)
    storage.setItem.mockImplementation((key: string, value: string) => {
      store[key] = String(value)
    })
    storage.removeItem.mockImplementation((key: string) => {
      delete store[key]
    })

    mockFetchTemplates.mockResolvedValue([])
    mockFetchToday.mockResolvedValue(DAY_DETAIL)
    mockFetchVisits.mockResolvedValue([])
    mockCreateVisit.mockResolvedValue(SAVED_VISIT)
  })

  it('renders the catalogue grouped by category with a Rest and a Neu input per product', async () => {
    const user = userEvent.setup()
    await renderForm({ initialDate: BUSINESS_DATE })

    expect(
      screen.getByRole('heading', { name: 'Besuch erfassen' })
    ).toBeInTheDocument()
    expect(screen.getByText('Dienstag, 25.08.2026')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Erstbestückung' })
    ).toHaveAttribute('aria-pressed', 'true')

    // Alle drei Kategorien haben einen Gruppenkopf, offen ist nur die erste.
    expect(screen.getByRole('button', { name: /Brot/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    const broetchenHeader = screen.getByRole('button', { name: /Brötchen/ })
    expect(broetchenHeader).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /Teilchen/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(screen.getByText('2 Produkte')).toBeInTheDocument()
    expect(screen.getAllByText('1 Produkte')).toHaveLength(2)

    // Offene Gruppe: je Produkt zwei Zahlenfelder und vier Stepper.
    expect(screen.getByLabelText('Rest in Stück: Roggenbrot')).toHaveValue('')
    expect(screen.getByLabelText('Neu in Stück: Roggenbrot')).toHaveValue('')
    expect(
      screen.getByLabelText('Rest in Stück: Bauernbrot')
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Neu in Stück: Bauernbrot')
    ).toBeInTheDocument()
    expect(screen.getAllByText('Rest')).toHaveLength(2)
    expect(screen.getAllByText('Neu')).toHaveLength(2)
    expect(
      screen.getByLabelText('Rest erhöhen: Roggenbrot')
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Neu verringern: Roggenbrot')
    ).toBeInTheDocument()
    // HQ-Preis als Snapshot-Grundlage am Produkt
    expect(screen.getByText(/4,50\s€\s\/\sStück/)).toBeInTheDocument()

    // Eine zugeklappte Gruppe rendert ihre Zeilen erst nach dem Aufklappen.
    expect(screen.queryByLabelText('Rest in Stück: Kaisersemmel')).toBeNull()
    await user.click(broetchenHeader)
    expect(
      await screen.findByLabelText('Rest in Stück: Kaisersemmel')
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Neu in Stück: Kaisersemmel')
    ).toBeInTheDocument()
  })

  it('submits the quantity built up with the plus stepper', async () => {
    const user = userEvent.setup()
    await renderForm({ initialDate: BUSINESS_DATE })

    const plus = screen.getByLabelText('Neu erhöhen: Roggenbrot')
    await user.click(plus)
    await user.click(plus)
    await user.click(plus)
    expect(screen.getByLabelText('Neu in Stück: Roggenbrot')).toHaveValue('3')

    await user.click(screen.getByRole('button', { name: 'Besuch speichern' }))

    await waitFor(() => expect(mockCreateVisit).toHaveBeenCalledTimes(1))
    const [partnerArg, payload] = mockCreateVisit.mock.calls[0]
    expect(partnerArg).toBe(PARTNER_ID)
    expect(payload.visitType).toBe('initial')
    expect(payload.businessDate).toBe(BUSINESS_DATE)
    expect(payload.items).toEqual([
      {
        productId: 1,
        productSlug: 'roggenbrot',
        productName: 'Roggenbrot',
        unitPrice: 4.5,
        countedQty: null,
        deliveredQty: 3,
      },
    ])
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/admin/partners/1')
    )
  })

  it('includes a typed quantity in the payload without leaving the field first', async () => {
    const user = userEvent.setup()
    await renderForm({ initialDate: BUSINESS_DATE })

    await user.type(screen.getByLabelText('Rest in Stück: Bauernbrot'), '7')
    await user.type(screen.getByLabelText('Neu in Stück: Bauernbrot'), '12')
    expect(screen.getByLabelText('Neu in Stück: Bauernbrot')).toHaveValue('12')

    // Direkt aus dem Feld heraus speichern - kein Blur, kein Tab dazwischen.
    await user.click(screen.getByRole('button', { name: 'Besuch speichern' }))

    await waitFor(() => expect(mockCreateVisit).toHaveBeenCalledTimes(1))
    expect(mockCreateVisit.mock.calls[0][1].items).toEqual([
      {
        productId: 2,
        productSlug: 'bauernbrot',
        productName: 'Bauernbrot',
        unitPrice: 5.2,
        countedQty: 7,
        deliveredQty: 12,
      },
    ])
  })

  it('sends countedQty null for an untouched Rest field and 0 for one set to zero', async () => {
    const user = userEvent.setup()
    await renderForm({ initialDate: BUSINESS_DATE })

    // Roggenbrot: nur nachgelegt, Rest gar nicht gezählt.
    await user.type(screen.getByLabelText('Neu in Stück: Roggenbrot'), '10')
    // Bauernbrot: Fach war ausdrücklich leer.
    await user.type(screen.getByLabelText('Rest in Stück: Bauernbrot'), '0')
    await user.type(screen.getByLabelText('Neu in Stück: Bauernbrot'), '5')

    expect(
      screen.getByText('Rest nicht gezählt · Bestand danach 10')
    ).toBeInTheDocument()
    expect(screen.getByText('Bestand danach 5 (0 + 5)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Besuch speichern' }))

    await waitFor(() => expect(mockCreateVisit).toHaveBeenCalledTimes(1))
    const items = mockCreateVisit.mock.calls[0][1].items
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      productSlug: 'roggenbrot',
      countedQty: null,
      deliveredQty: 10,
    })
    expect(items[1]).toMatchObject({
      productSlug: 'bauernbrot',
      countedQty: 0,
      deliveredQty: 5,
    })
  })

  it('blocks a pickup that leaves a product with stock uncounted and offers to set it to 0', async () => {
    const user = userEvent.setup()
    // Erstbestückung am Morgen: 10 Roggenbrot und 6 Bauernbrot liegen im Schrank.
    mockFetchToday.mockResolvedValue({
      ...DAY_DETAIL,
      timeline: [
        {
          visitId: 1,
          visitType: 'initial',
          visitAt: `${BUSINESS_DATE}T06:00:00.000Z`,
          sequence: 1,
          staffName: null,
          note: null,
          countedQty: 0,
          deliveredQty: 16,
          soldSinceLastQty: 0,
          soldSinceLastRevenue: 0,
          stockAfterQty: 16,
          items: [
            {
              productId: 1,
              productSlug: 'roggenbrot',
              productName: 'Roggenbrot',
              unitPrice: 4.5,
              countedQty: null,
              deliveredQty: 10,
              soldSinceLastQty: 0,
              stockAfterQty: 10,
            },
            {
              productId: 2,
              productSlug: 'bauernbrot',
              productName: 'Bauernbrot',
              unitPrice: 5.2,
              countedQty: null,
              deliveredQty: 6,
              soldSinceLastQty: 0,
              stockAfterQty: 6,
            },
          ],
        },
      ],
    })
    await renderForm({ initialDate: BUSINESS_DATE })

    await user.click(screen.getByRole('button', { name: 'Abholung' }))
    await user.type(screen.getByLabelText('Rest in Stück: Roggenbrot'), '2')
    await user.click(screen.getByRole('button', { name: 'Besuch speichern' }))

    // Bauernbrot liegt laut Tagesverlauf noch da, wurde aber nicht gezählt.
    expect(
      await screen.findByText(
        /Bei der Abholung fehlt der Rest für: Bauernbrot \(erwartet 6\)/
      )
    ).toBeInTheDocument()
    expect(mockCreateVisit).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Rest auf 0 setzen' }))
    expect(
      (screen.getByLabelText('Rest in Stück: Bauernbrot') as HTMLInputElement)
        .value
    ).toBe('0')

    await user.click(screen.getByRole('button', { name: 'Besuch speichern' }))
    await waitFor(() => expect(mockCreateVisit).toHaveBeenCalledTimes(1))
    const items = mockCreateVisit.mock.calls[0][1].items
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productSlug: 'roggenbrot', countedQty: 2 }),
        expect.objectContaining({ productSlug: 'bauernbrot', countedQty: 0 }),
      ])
    )
  })

  it('puts the products that are in the cabinet first, opens their groups and names them when switching to Abholung', async () => {
    const user = userEvent.setup()
    // Morgens 6 Bauernbrot und 4 Apfeltaschen eingeräumt; mittags waren die
    // Apfeltaschen ausverkauft (Rest 0, nichts nachgelegt). Roggenbrot und
    // Kaisersemmel lagen heute nie im Schrank.
    mockFetchToday.mockResolvedValue({
      ...DAY_DETAIL,
      timeline: [
        {
          visitId: 1,
          visitType: 'initial',
          visitAt: `${BUSINESS_DATE}T06:00:00.000Z`,
          sequence: 1,
          staffName: null,
          note: null,
          countedQty: 0,
          deliveredQty: 10,
          soldSinceLastQty: 0,
          soldSinceLastRevenue: 0,
          stockAfterQty: 10,
          items: [
            {
              productId: 2,
              productSlug: 'bauernbrot',
              productName: 'Bauernbrot',
              unitPrice: 5.2,
              countedQty: null,
              deliveredQty: 6,
              soldSinceLastQty: 0,
              stockAfterQty: 6,
            },
            {
              productId: 4,
              productSlug: 'apfeltasche',
              productName: 'Apfeltasche',
              unitPrice: 1.8,
              countedQty: null,
              deliveredQty: 4,
              soldSinceLastQty: 0,
              stockAfterQty: 4,
            },
          ],
        },
        {
          visitId: 2,
          visitType: 'refill',
          visitAt: `${BUSINESS_DATE}T10:00:00.000Z`,
          sequence: 2,
          staffName: null,
          note: null,
          countedQty: 0,
          deliveredQty: 0,
          soldSinceLastQty: 4,
          soldSinceLastRevenue: 7.2,
          stockAfterQty: 6,
          items: [
            {
              productId: 4,
              productSlug: 'apfeltasche',
              productName: 'Apfeltasche',
              unitPrice: 1.8,
              countedQty: 0,
              deliveredQty: 0,
              soldSinceLastQty: 4,
              stockAfterQty: 0,
            },
          ],
        },
      ],
    })
    await renderForm({ initialDate: BUSINESS_DATE })

    const rowOrder = () =>
      screen
        .getAllByLabelText(/^Rest erhöhen: /)
        .map((button) => button.getAttribute('aria-label')?.slice(14))

    // Erstbestückung: Katalogreihenfolge, nur die erste Gruppe offen.
    expect(rowOrder()).toEqual(['Roggenbrot', 'Bauernbrot'])
    expect(screen.queryByText(/Im Schrank erwartet/)).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Abholung' }))

    // Bauernbrot (erwartet 6) rückt vor Roggenbrot; die Teilchen klappen auf,
    // weil die Apfeltasche heute im Schrank lag - auch wenn sie schon auf 0
    // gezählt ist. Brötchen bleiben zu: dort lag nie etwas.
    expect(screen.getByRole('button', { name: /Teilchen/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(screen.getByRole('button', { name: /Brötchen/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    await waitFor(() =>
      expect(rowOrder()).toEqual(['Bauernbrot', 'Roggenbrot', 'Apfeltasche'])
    )
    expect(screen.getByText(/erwartet 6/)).toBeInTheDocument()
    expect(screen.getByText(/erwartet 0/)).toBeInTheDocument()
    expect(
      screen.getByText(
        /Im Schrank erwartet: Bauernbrot \(6\), Apfeltasche \(0\) - diese Produkte stehen in jeder Kategorie oben\./
      )
    ).toBeInTheDocument()

    // Zurück zur Erstbestückung: wieder Katalogreihenfolge, Hinweis weg.
    await user.click(screen.getByRole('button', { name: 'Erstbestückung' }))
    await waitFor(() =>
      expect(rowOrder()).toEqual(['Roggenbrot', 'Bauernbrot', 'Apfeltasche'])
    )
    expect(screen.queryByText(/Im Schrank erwartet/)).toBeNull()
  })

  it('applies the weekday template to the Neu fields when switching to Erstbestückung', async () => {
    const user = userEvent.setup()
    const gate = createGate()
    mockFetchTemplates.mockImplementation(async () => {
      await gate.opened
      return [TUESDAY_TEMPLATE]
    })

    renderWithTheme(
      <VisitFormClient
        partnerId={PARTNER_ID}
        groups={GROUPS}
        initialDate={BUSINESS_DATE}
      />
    )

    // Noch während des Ladens auf Nachlieferung wechseln - dann greift die
    // Vorlagen-Automatik beim Laden nicht.
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Nachlieferung' }))

    await act(async () => {
      gate.open()
    })
    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull())

    // Nachlieferung: keine Vorlage, die Felder bleiben leer.
    expect(screen.getByLabelText('Neu in Stück: Roggenbrot')).toHaveValue('')
    expect(screen.queryByText(/Vorlage für Dienstag übernommen/)).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Erstbestückung' }))

    // Die Vorlage füllt "Neu" und klappt die betroffene Kategorie auf.
    expect(
      await screen.findByLabelText('Neu in Stück: Kaisersemmel')
    ).toHaveValue('40')
    expect(screen.getByLabelText('Neu in Stück: Roggenbrot')).toHaveValue('6')
    expect(screen.getByLabelText('Rest in Stück: Roggenbrot')).toHaveValue('')
    expect(
      screen.getByText(/Vorlage für Dienstag übernommen \(2 Positionen\)/)
    ).toBeInTheDocument()
  })

  it('restores a localStorage draft on mount and clears it after a successful save', async () => {
    store[DRAFT_KEY] = JSON.stringify({
      version: 1,
      savedAt: '2026-08-25T09:12:00.000Z',
      visitType: 'refill',
      visitAt: `${BUSINESS_DATE}T09:12`,
      staffName: 'Julia',
      note: 'Brot war um 10 Uhr komplett leer',
      rows: {
        roggenbrot: { rest: '2', neu: '4' },
        gibtsnichtmehr: { rest: '9', neu: '' },
      },
      extras: [],
    })

    const user = userEvent.setup()
    await renderForm({ initialDate: BUSINESS_DATE })

    expect(storage.getItem).toHaveBeenCalledWith(DRAFT_KEY)
    expect(
      screen.getByText(/Nicht gespeicherter Entwurf.*wiederhergestellt\./)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/1 Position\(en\) gehören nicht mehr zum Sortiment/)
    ).toBeInTheDocument()

    expect(screen.getByLabelText('Rest in Stück: Roggenbrot')).toHaveValue('2')
    expect(screen.getByLabelText('Neu in Stück: Roggenbrot')).toHaveValue('4')
    expect(screen.getByLabelText('Erfasst von (optional)')).toHaveValue('Julia')
    expect(screen.getByLabelText('Notiz (optional)')).toHaveValue(
      'Brot war um 10 Uhr komplett leer'
    )
    expect(
      screen.getByRole('button', { name: 'Nachlieferung' })
    ).toHaveAttribute('aria-pressed', 'true')

    storage.removeItem.mockClear()
    await user.click(screen.getByRole('button', { name: 'Besuch speichern' }))

    await waitFor(() => expect(mockCreateVisit).toHaveBeenCalledTimes(1))
    const payload = mockCreateVisit.mock.calls[0][1]
    expect(payload.visitType).toBe('refill')
    expect(payload.staffName).toBe('Julia')
    expect(payload.note).toBe('Brot war um 10 Uhr komplett leer')
    expect(payload.items).toEqual([
      {
        productId: 1,
        productSlug: 'roggenbrot',
        productName: 'Roggenbrot',
        unitPrice: 4.5,
        countedQty: 2,
        deliveredQty: 4,
      },
    ])

    await waitFor(() =>
      expect(storage.removeItem).toHaveBeenCalledWith(DRAFT_KEY)
    )
    expect(store[DRAFT_KEY]).toBeUndefined()
    expect(mockPush).toHaveBeenCalledWith('/admin/partners/1')
  })

  it('shows the German error message and keeps the draft when saving fails', async () => {
    mockCreateVisit.mockRejectedValueOnce(
      new Error('Der Besuch konnte nicht gespeichert werden - Server offline')
    )

    const user = userEvent.setup()
    await renderForm({ initialDate: BUSINESS_DATE })

    await user.click(screen.getByLabelText('Neu erhöhen: Roggenbrot'))
    storage.removeItem.mockClear()

    await user.click(screen.getByRole('button', { name: 'Besuch speichern' }))

    expect(
      await screen.findByText(
        'Der Besuch konnte nicht gespeichert werden - Server offline'
      )
    ).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockRefresh).not.toHaveBeenCalled()
    // Der Entwurf muss den Fehlschlag überleben.
    expect(storage.removeItem).not.toHaveBeenCalledWith(DRAFT_KEY)
    expect(store[DRAFT_KEY]).toBeDefined()
    // Ein zweiter Versuch ist möglich - der Button ist wieder frei.
    expect(
      screen.getByRole('button', { name: 'Besuch speichern' })
    ).toBeEnabled()
  })
})
