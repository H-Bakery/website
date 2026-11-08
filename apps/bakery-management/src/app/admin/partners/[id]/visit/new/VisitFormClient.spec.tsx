import React from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
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
/** Nach dem Speichern: Detailseite auf dem Tag des Besuchs, mit Bestätigung. */
const DETAIL_AFTER_SAVE = `/admin/partners/${PARTNER_ID}?date=${BUSINESS_DATE}&saved=1`
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

/**
 * Ohne die `setTimeout(0)`-Pause zwischen den Eingaben - die Specs hier tippen
 * und klicken viel, und auf dem CI-Runner summiert sich jede Pause.
 */
function setupUser() {
  return userEvent.setup({ delay: null })
}

/**
 * Knopf der Besuchsart, gesucht in seiner Gruppe statt im ganzen Formular:
 * `ByRole` mit Namen berechnet sonst den Namen jedes Mengen-Knopfs - das ist
 * in jsdom teuer, in einem `waitFor` sogar je Durchlauf.
 */
function visitTypeButton(name: string) {
  return within(
    screen.getByRole('group', { name: 'Art des Besuchs' })
  ).getByRole('button', { name })
}

/** Der Speichern-Knopf (aus demselben Grund nicht per `ByRole` mit Namen). */
function saveButton() {
  return screen.getByText('Besuch speichern', { selector: 'button' })
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

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders the catalogue grouped by category with a Rest and a Neu input per product', async () => {
    const user = setupUser()
    await renderForm({ initialDate: BUSINESS_DATE })

    expect(
      screen.getByRole('heading', { name: 'Besuch erfassen' })
    ).toBeInTheDocument()
    expect(screen.getByText('Dienstag, 25.08.2026')).toBeInTheDocument()
    expect(visitTypeButton('Erstbestückung')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

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
    const user = setupUser()
    await renderForm({ initialDate: BUSINESS_DATE })

    const plus = screen.getByLabelText('Neu erhöhen: Roggenbrot')
    await user.click(plus)
    await user.click(plus)
    await user.click(plus)
    expect(screen.getByLabelText('Neu in Stück: Roggenbrot')).toHaveValue('3')

    await user.click(saveButton())

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
      expect(mockPush).toHaveBeenCalledWith(DETAIL_AFTER_SAVE)
    )
  })

  it('leaves the form on the business day of the visit, not on today', async () => {
    await renderForm({ initialDate: BUSINESS_DATE })

    const back = () => screen.getByRole('link', { name: 'Zurück zum Partner' })
    expect(back()).toHaveAttribute(
      'href',
      `/admin/partners/${PARTNER_ID}?date=${BUSINESS_DATE}`
    )

    // Der Tag folgt dem Zeitpunkt des Besuchs, nicht dem Tag beim Öffnen
    fireEvent.change(screen.getByLabelText('Zeitpunkt des Besuchs'), {
      target: { value: '2026-08-24T08:00' },
    })
    expect(back()).toHaveAttribute(
      'href',
      `/admin/partners/${PARTNER_ID}?date=2026-08-24`
    )
  })

  it('includes a typed quantity in the payload without leaving the field first', async () => {
    const user = setupUser()
    await renderForm({ initialDate: BUSINESS_DATE })

    await user.type(screen.getByLabelText('Rest in Stück: Bauernbrot'), '7')
    await user.type(screen.getByLabelText('Neu in Stück: Bauernbrot'), '12')
    expect(screen.getByLabelText('Neu in Stück: Bauernbrot')).toHaveValue('12')

    // Direkt aus dem Feld heraus speichern - kein Blur, kein Tab dazwischen.
    await user.click(saveButton())

    // nothing is in the cabinet yet: the counted Rest needs a second tap (W4-verify r2)
    expect(
      await screen.findByText(/Mehr gezählt, als im Schrank/)
    ).toBeInTheDocument()
    await user.click(saveButton())

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
    const user = setupUser()
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

    await user.click(saveButton())

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
    const user = setupUser()
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

    await user.click(visitTypeButton('Abholung'))
    await user.type(screen.getByLabelText('Rest in Stück: Roggenbrot'), '2')
    await user.click(saveButton())

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

    await user.click(saveButton())
    await waitFor(() => expect(mockCreateVisit).toHaveBeenCalledTimes(1))
    const items = mockCreateVisit.mock.calls[0][1].items
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productSlug: 'roggenbrot', countedQty: 2 }),
        expect.objectContaining({ productSlug: 'bauernbrot', countedQty: 0 }),
      ])
    )
  })

  it('asks before saving a Rest larger than the stock (W4-verify r2: Abweichung, not Retoure)', async () => {
    const user = setupUser()
    await renderForm({ initialDate: BUSINESS_DATE })
    // no visit yet today: nothing can be in the cabinet
    await user.click(visitTypeButton('Abholung'))
    await user.type(screen.getByLabelText('Rest in Stück: Roggenbrot'), '3')
    await user.click(saveButton())
    expect(
      await screen.findByText(
        /Mehr gezählt, als im Schrank sein kann: Roggenbrot 3 \(möglich 0\)\. Das wird als Abweichung gebucht, nicht als Retoure/
      )
    ).toBeInTheDocument()
    expect(mockCreateVisit).not.toHaveBeenCalled()
    // second tap saves
    await user.click(saveButton())
    await waitFor(() => expect(mockCreateVisit).toHaveBeenCalledTimes(1))
  })

  it('puts the products that are in the cabinet first, opens their groups and names them when switching to Abholung', async () => {
    const user = setupUser()
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

    await user.click(visitTypeButton('Abholung'))

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
    await user.click(visitTypeButton('Erstbestückung'))
    await waitFor(() =>
      expect(rowOrder()).toEqual(['Roggenbrot', 'Bauernbrot', 'Apfeltasche'])
    )
    expect(screen.queryByText(/Im Schrank erwartet/)).toBeNull()
  })

  it('applies the weekday template to the Neu fields when switching to Erstbestückung', async () => {
    const user = setupUser()
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
    await user.click(visitTypeButton('Nachlieferung'))

    await act(async () => {
      gate.open()
    })
    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull())

    // Nachlieferung: keine Vorlage, die Felder bleiben leer.
    expect(screen.getByLabelText('Neu in Stück: Roggenbrot')).toHaveValue('')
    expect(screen.queryByText(/Vorlage für Dienstag übernommen/)).toBeNull()

    await user.click(visitTypeButton('Erstbestückung'))

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

  it('removes the template quantities from Neu when switching from Erstbestückung to Abholung (W4-verify)', async () => {
    const user = setupUser()
    mockFetchTemplates.mockResolvedValue([TUESDAY_TEMPLATE])

    await renderForm({ initialDate: BUSINESS_DATE })

    expect(
      await screen.findByLabelText('Neu in Stück: Kaisersemmel')
    ).toHaveValue('40')
    // Eine getippte Abweichung von der Vorlage bleibt stehen.
    const roggenNeu = screen.getByLabelText('Neu in Stück: Roggenbrot')
    await user.clear(roggenNeu)
    await user.type(roggenNeu, '7')

    await user.click(visitTypeButton('Abholung'))

    expect(screen.getByLabelText('Neu in Stück: Kaisersemmel')).toHaveValue('')
    expect(screen.getByLabelText('Neu in Stück: Roggenbrot')).toHaveValue('7')
    expect(
      screen.getByText(
        /Mengen der Standard-Bestückung wurden aus „Neu“ entfernt/
      )
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText('Rest in Stück: Kaisersemmel'), '3')
    await user.click(saveButton())

    // nothing is in the cabinet yet: the counted Rest needs a second tap (W4-verify r2)
    expect(
      await screen.findByText(/Mehr gezählt, als im Schrank/)
    ).toBeInTheDocument()
    await user.click(saveButton())

    await waitFor(() => expect(mockCreateVisit).toHaveBeenCalledTimes(1))
    const payload = mockCreateVisit.mock.calls[0][1]
    expect(payload.visitType).toBe('pickup')
    const semmel = payload.items.find((i) => i.productSlug === 'kaisersemmel')
    expect(semmel).toMatchObject({ countedQty: 3, deliveredQty: 0 })
    const roggen = payload.items.find((i) => i.productSlug === 'roggenbrot')
    expect(roggen).toMatchObject({ deliveredQty: 7 })
  })

  it('starts as Nachlieferung without the template when the day already has an Erstbestückung (W4-verify)', async () => {
    mockFetchTemplates.mockResolvedValue([TUESDAY_TEMPLATE])
    mockFetchToday.mockResolvedValue({
      ...DAY_DETAIL,
      visits: [{ ...SAVED_VISIT, id: 5 }],
    })

    await renderForm({ initialDate: BUSINESS_DATE })

    expect(visitTypeButton('Nachlieferung')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByLabelText('Neu in Stück: Roggenbrot')).toHaveValue('')
    expect(screen.queryByText(/Vorlage für Dienstag übernommen/)).toBeNull()
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

    const user = setupUser()
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
    expect(visitTypeButton('Nachlieferung')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    storage.removeItem.mockClear()
    await user.click(saveButton())

    // nothing is in the cabinet yet: the counted Rest needs a second tap (W4-verify r2)
    expect(
      await screen.findByText(/Mehr gezählt, als im Schrank/)
    ).toBeInTheDocument()
    await user.click(saveButton())

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
    expect(mockPush).toHaveBeenCalledWith(DETAIL_AFTER_SAVE)
  })

  it('behauptet ohne erreichbare API nicht, es gäbe keine Standard-Bestückung', async () => {
    mockFetchTemplates.mockRejectedValue(new TypeError('Failed to fetch'))
    await renderForm({ initialDate: BUSINESS_DATE })

    expect(
      await screen.findByText(
        'Keine Verbindung zum Server – bitte WLAN prüfen.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/Failed to fetch/)).toBeNull()
    expect(
      screen.queryByText(/keine Standard-Bestückung hinterlegt/)
    ).toBeNull()
  })

  it('shows the German error message and keeps the draft when saving fails', async () => {
    mockCreateVisit.mockRejectedValueOnce(
      new Error('Der Besuch konnte nicht gespeichert werden - Server offline')
    )

    const user = setupUser()
    await renderForm({ initialDate: BUSINESS_DATE })

    await user.click(screen.getByLabelText('Neu erhöhen: Roggenbrot'))
    storage.removeItem.mockClear()

    await user.click(saveButton())

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
    expect(saveButton()).toBeEnabled()
  })
  it('shows save errors and the pickup question inside the sticky save bar, next to the button (ui r2)', async () => {
    const user = setupUser()
    await renderForm({ initialDate: BUSINESS_DATE })

    // Leer speichern: die Rückfrage steht in der Leiste, nicht unter der Liste.
    await user.click(saveButton())
    const messages = await screen.findByTestId('visit-save-messages')
    expect(
      within(messages).getByText(/Bitte mindestens ein Produkt erfassen/)
    ).toBeInTheDocument()
    const bar = messages.parentElement as HTMLElement
    expect(
      within(bar).getByRole('button', { name: 'Besuch speichern' })
    ).toBeInTheDocument()

    // Verbindungsfehler beim Speichern: ebenfalls direkt über dem Knopf.
    mockCreateVisit.mockRejectedValueOnce(
      new Error('Keine Verbindung zum Server – bitte WLAN prüfen.')
    )
    await user.click(screen.getByLabelText('Neu erhöhen: Roggenbrot'))
    await user.click(saveButton())
    const saveMessages = await screen.findByTestId('visit-save-messages')
    expect(
      await within(saveMessages).findByText(
        'Keine Verbindung zum Server – bitte WLAN prüfen.'
      )
    ).toBeInTheDocument()
    expect(
      within(saveMessages).queryByText(/Bitte mindestens ein Produkt/)
    ).toBeNull()
  })

  it('switches to Erstbestückung with the template when the time moves to a day without one (ui r2)', async () => {
    // Der Tageswechsel lädt erst nach 300 ms Entprellung nach. Mit echter Uhr
    // fraß das allein ein Drittel der 1 s von `waitFor` - auf dem langsamen
    // CI-Runner lief der Rest (Laden, Rendern) darüber hinaus. Mit falscher
    // Uhr schiebt der Test die Zeit selbst vor, `waitFor` zählt dann nur noch
    // falsche Zeit und hängt nicht mehr am Rechnertempo.
    jest.useFakeTimers({ now: new Date(`${BUSINESS_DATE}T10:00:00`) })
    const WEDNESDAY = '2026-08-26'
    mockFetchTemplates.mockResolvedValue([
      TUESDAY_TEMPLATE,
      { ...TUESDAY_TEMPLATE, id: 8, weekday: 3 },
    ])
    mockFetchToday.mockImplementation(async (_partner, date) =>
      date === BUSINESS_DATE
        ? { ...DAY_DETAIL, visits: [{ ...SAVED_VISIT, id: 5 }] }
        : { ...DAY_DETAIL, businessDate: date ?? null, visits: [] }
    )
    await renderForm({ initialDate: BUSINESS_DATE })
    const pressed = (name: string) =>
      visitTypeButton(name).getAttribute('aria-pressed')
    expect(pressed('Nachlieferung')).toBe('true')

    // Im Büro nacherfassen: Mittwoch hat noch keine Erstbestückung.
    fireEvent.change(screen.getByLabelText('Zeitpunkt des Besuchs'), {
      target: { value: `${WEDNESDAY}T08:00` },
    })
    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    expect(mockFetchToday).toHaveBeenCalledWith(PARTNER_ID, WEDNESDAY)
    await waitFor(() => expect(pressed('Erstbestückung')).toBe('true'))
    expect(
      await screen.findByText(/Vorlage für Mittwoch übernommen/)
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Neu in Stück: Roggenbrot')).toHaveValue('6')

    // Zurück auf Dienstag (mit Erstbestückung): wieder Nachlieferung, die
    // Vorlagenmengen fliegen aus „Neu“.
    fireEvent.change(screen.getByLabelText('Zeitpunkt des Besuchs'), {
      target: { value: `${BUSINESS_DATE}T09:00` },
    })
    await waitFor(() => expect(pressed('Nachlieferung')).toBe('true'))
    expect(screen.getByLabelText('Neu in Stück: Roggenbrot')).toHaveValue('')
  })

  it('keeps a visit type chosen by hand when the time moves to another day (ui r2)', async () => {
    // Falsche Uhr wie oben: die Entprellung wird vorgespult statt abgewartet.
    jest.useFakeTimers({ now: new Date(`${BUSINESS_DATE}T10:00:00`) })
    const user = userEvent.setup({
      delay: null,
      advanceTimers: jest.advanceTimersByTime,
    })
    mockFetchToday.mockImplementation(async (_partner, date) =>
      date === BUSINESS_DATE
        ? { ...DAY_DETAIL, visits: [{ ...SAVED_VISIT, id: 5 }] }
        : { ...DAY_DETAIL, businessDate: date ?? null, visits: [] }
    )
    await renderForm({ initialDate: BUSINESS_DATE })
    await user.click(visitTypeButton('Abholung'))

    fireEvent.change(screen.getByLabelText('Zeitpunkt des Besuchs'), {
      target: { value: '2026-08-26T18:00' },
    })
    // Entprellung vorspulen; das `async act` lässt auch die Antwort für den
    // neuen Tag samt Folge-Render durchlaufen.
    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    expect(mockFetchToday).toHaveBeenCalledWith(PARTNER_ID, '2026-08-26')
    expect(visitTypeButton('Abholung')).toHaveAttribute('aria-pressed', 'true')
  })
})
