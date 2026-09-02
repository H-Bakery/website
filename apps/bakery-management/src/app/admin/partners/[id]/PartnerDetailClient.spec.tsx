import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PartnerDetailClient from './PartnerDetailClient'
import {
  deleteVisit,
  fetchPartner,
  fetchToday,
} from '../../../../lib/partnerApi'
import {
  DayDetail,
  Partner,
  PartnerStats,
  PartnerVisit,
  TimelineEntry,
  formatDate,
  toBusinessDate,
} from '../../../../lib/partnerTypes'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/partners/1',
}))

jest.mock('../../../../lib/partnerApi', () => ({
  deleteVisit: jest.fn(),
  fetchPartner: jest.fn(),
  fetchToday: jest.fn(),
}))

const mockDeleteVisit = deleteVisit as jest.MockedFunction<typeof deleteVisit>
const mockFetchPartner = fetchPartner as jest.MockedFunction<
  typeof fetchPartner
>
const mockFetchToday = fetchToday as jest.MockedFunction<typeof fetchToday>

const PARTNER_ID = '1'

/** Die Seite startet immer auf dem heutigen Geschäftstag. */
const TODAY = toBusinessDate()

const PARTNER: Partner = {
  id: 1,
  name: 'CAP-Markt Homburg-Kirrberg',
  slug: 'cap-markt-homburg-kirrberg',
  street: '',
  zip: '',
  city: '',
  contactName: null,
  phone: null,
  email: null,
  deliveryDays: [2, 3, 4, 5, 6],
  settlementModel: 'commission',
  active: true,
  notes: null,
}

const UNIT_PRICE = 2.1

/** Ein Besuch mit genau einer Produktzeile - Summen und Zeile sind identisch. */
function entry(
  visitId: number,
  visitType: TimelineEntry['visitType'],
  time: string,
  sequence: number,
  staffName: string,
  qty: {
    counted: number
    delivered: number
    soldSinceLast: number
    stockAfter: number
  },
  note: string | null = null
): TimelineEntry {
  return {
    visitId,
    visitType,
    visitAt: `${TODAY}T${time}:00`,
    sequence,
    staffName,
    note,
    countedQty: qty.counted,
    deliveredQty: qty.delivered,
    soldSinceLastQty: qty.soldSinceLast,
    soldSinceLastRevenue: qty.soldSinceLast * UNIT_PRICE,
    stockAfterQty: qty.stockAfter,
    items: [
      {
        productId: 12,
        productSlug: 'bauernbrot',
        productName: 'Bauernbrot',
        unitPrice: UNIT_PRICE,
        countedQty: qty.counted,
        deliveredQty: qty.delivered,
        soldSinceLastQty: qty.soldSinceLast,
        stockAfterQty: qty.stockAfter,
      },
    ],
  }
}

const INITIAL = entry(11, 'initial', '06:15', 1, 'Julia', {
  counted: 0,
  delivered: 40,
  soldSinceLast: 0,
  stockAfter: 40,
})

const REFILL = entry(
  12,
  'refill',
  '10:30',
  2,
  'Tobias',
  { counted: 10, delivered: 20, soldSinceLast: 30, stockAfter: 30 },
  'Brot war um 10 Uhr komplett leer'
)

const PICKUP = entry(13, 'pickup', '17:45', 3, 'Julia', {
  counted: 15,
  delivered: 0,
  soldSinceLast: 15,
  stockAfter: 15,
})

function visitOf(source: TimelineEntry): PartnerVisit {
  return {
    id: source.visitId,
    partnerId: 1,
    businessDate: TODAY,
    visitAt: source.visitAt,
    visitType: source.visitType,
    sequence: source.sequence,
    staffId: null,
    staffName: source.staffName,
    note: source.note,
    items: source.items.map((item) => ({
      productId: item.productId,
      productSlug: item.productSlug,
      productName: item.productName,
      unitPrice: item.unitPrice,
      countedQty: item.countedQty,
      deliveredQty: item.deliveredQty,
    })),
  }
}

function totalsOf(
  sold: number,
  returned: number,
  visits: number
): PartnerStats['totals'] {
  return {
    dayCount: 1,
    openDayCount: returned === 0 ? 1 : 0,
    visitCount: visits,
    refillCount: 1,
    deliveredQty: 60,
    soldQty: sold,
    returnedQty: returned,
    discrepancyQty: 0,
    revenue: sold * UNIT_PRICE,
    returnValue: returned * UNIT_PRICE,
    sellThroughRate: sold / 60,
    returnRate: returned / 60,
  }
}

type DayView = DayDetail & { visits: PartnerVisit[] }

/** Erstbestückung + Nachlieferung, aber noch keine Abholung - Tag offen. */
const OPEN_DAY: DayView = {
  businessDate: TODAY,
  isOpen: true,
  timeline: [INITIAL, REFILL],
  totals: totalsOf(30, 0, 2),
  byProduct: [
    {
      productId: 12,
      productSlug: 'bauernbrot',
      productName: 'Bauernbrot',
      unitPrice: UNIT_PRICE,
      deliveredQty: 60,
      soldQty: 30,
      returnedQty: 0,
      discrepancyQty: 0,
      revenue: 63,
      returnValue: 0,
      sellThroughRate: 0.5,
    },
  ],
  visits: [INITIAL, REFILL].map(visitOf),
}

/** Derselbe Tag, mit Abholung abgeschlossen. */
const CLOSED_DAY: DayView = {
  businessDate: TODAY,
  isOpen: false,
  timeline: [INITIAL, REFILL, PICKUP],
  totals: totalsOf(45, 15, 3),
  byProduct: [
    {
      productId: 12,
      productSlug: 'bauernbrot',
      productName: 'Bauernbrot',
      unitPrice: UNIT_PRICE,
      deliveredQty: 60,
      soldQty: 45,
      returnedQty: 15,
      discrepancyQty: 0,
      revenue: 94.5,
      returnValue: 31.5,
      sellThroughRate: 0.75,
    },
  ],
  visits: [INITIAL, REFILL, PICKUP].map(visitOf),
}

/** Abholung erfasst, aber ein zweites Produkt mit Bestand nicht gezählt. */
const INCOMPLETE_DAY: DayView = {
  ...CLOSED_DAY,
  isComplete: false,
  uncountedQty: 6,
  uncountedProducts: [
    {
      productId: 13,
      productSlug: 'kaisersemmel',
      productName: 'Kaisersemmel',
      stockQty: 6,
    },
  ],
}

/** Kennzahlen-Kachel über ihr Label greifen. */
function kpi(label: string) {
  const tile = screen.getByText(label).closest('.MuiCard-root')
  if (!tile) throw new Error(`Kennzahlen-Kachel "${label}" nicht gefunden`)
  return within(tile as HTMLElement)
}

async function renderDetail() {
  renderWithTheme(<PartnerDetailClient partnerId={PARTNER_ID} />)
  await screen.findByRole('heading', { name: 'CAP-Markt Homburg-Kirrberg' })
}

describe('PartnerDetailClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchPartner.mockResolvedValue(PARTNER)
    mockFetchToday.mockResolvedValue(OPEN_DAY)
    mockDeleteVisit.mockResolvedValue(undefined)
  })

  it('warns that an open day is provisional and marks the affected KPI tiles', async () => {
    await renderDetail()

    expect(mockFetchToday).toHaveBeenCalledWith(PARTNER_ID, TODAY)
    expect(
      screen.getByText(/Tag noch offen – Verkauf und Umsatz sind vorläufig/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/ist noch keine Abholung erfasst/)
    ).toBeInTheDocument()

    // Verkauft, Umsatz und Abverkaufsquote hängen an der fehlenden Abholung
    expect(screen.getAllByText('vorläufig')).toHaveLength(3)
    expect(kpi('Verkauft').getByText('30')).toBeInTheDocument()
    expect(kpi('Verkauft').getByText('vorläufig')).toBeInTheDocument()
    expect(kpi('Umsatz').getByText('63,00 €')).toBeInTheDocument()
    expect(kpi('Umsatz').getByText('vorläufig')).toBeInTheDocument()
    expect(kpi('Abverkaufsquote').getByText('50 %')).toBeInTheDocument()

    // Geliefert steht fest, die Retoure gibt es erst mit der Abholung
    expect(kpi('Geliefert').getByText('60')).toBeInTheDocument()
    expect(kpi('Geliefert').queryByText('vorläufig')).toBeNull()
    expect(
      kpi('Retoure').getByText('erst mit der Abholung')
    ).toBeInTheDocument()
  })

  it('shows a closed day as final without the provisional marking', async () => {
    mockFetchToday.mockResolvedValue(CLOSED_DAY)
    await renderDetail()

    expect(screen.getByText('Tag abgeschlossen')).toBeInTheDocument()
    expect(screen.queryByText(/Tag noch offen/)).toBeNull()
    expect(screen.queryByText('vorläufig')).toBeNull()

    expect(kpi('Verkauft').getByText('45')).toBeInTheDocument()
    expect(kpi('Umsatz').getByText('94,50 €')).toBeInTheDocument()
    expect(kpi('Abverkaufsquote').getByText('75 %')).toBeInTheDocument()
    // Abgeschlossen: die Retoure ist beziffert statt angekündigt
    expect(kpi('Retoure').getByText('15')).toBeInTheDocument()
    expect(kpi('Retoure').getByText('31,50 €')).toBeInTheDocument()
  })

  it('warns about a pickup that left a product uncounted and keeps the KPIs provisional', async () => {
    mockFetchToday.mockResolvedValue(INCOMPLETE_DAY)
    await renderDetail()

    expect(
      screen.getByText(/Abholung unvollständig – 6 Stück nicht gezählt/)
    ).toBeInTheDocument()
    expect(screen.getByText('Kaisersemmel: 6 erwartet')).toBeInTheDocument()
    expect(screen.queryByText('Tag abgeschlossen')).toBeNull()

    // Ohne die fehlende Zählung sind Verkauf, Umsatz und Quote nicht endgültig
    expect(screen.getAllByText('vorläufig')).toHaveLength(3)
    expect(kpi('Verkauft').getByText('vorläufig')).toBeInTheDocument()
    expect(
      kpi('Retoure').getByText('unvollständig gezählt')
    ).toBeInTheDocument()
  })

  it('renders one timeline entry per visit in chronological order', async () => {
    mockFetchToday.mockResolvedValue(CLOSED_DAY)
    await renderDetail()

    expect(
      screen.getByRole('heading', { name: `Besuche am ${formatDate(TODAY)}` })
    ).toBeInTheDocument()
    expect(
      screen.getByText('3 Besuche · 1 Nachlieferungen')
    ).toBeInTheDocument()

    const entries = screen.getAllByRole('button', {
      name: /^Besuch um .+ löschen$/,
    })
    expect(entries.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Besuch um 06:15 löschen',
      'Besuch um 10:30 löschen',
      'Besuch um 17:45 löschen',
    ])

    // Deutsche Besuchstypen, in der Reihenfolge des Tages
    expect(
      screen
        .getAllByText(/^(Erstbestückung|Nachlieferung|Abholung)$/, {
          selector: '.MuiChip-label',
        })
        .map((chip) => chip.textContent)
    ).toEqual(['Erstbestückung', 'Nachlieferung', 'Abholung'])

    // Julia war bei Erstbestückung und Abholung da, Tobias bei der Nachlieferung
    expect(screen.getAllByText('Julia')).toHaveLength(2)
    expect(screen.getByText('Tobias')).toBeInTheDocument()
    expect(
      screen.getByText('„Brot war um 10 Uhr komplett leer“')
    ).toBeInTheDocument()
  })

  it('asks for confirmation in a dialog before deleting a visit', async () => {
    const user = userEvent.setup()
    await renderDetail()

    await user.click(
      screen.getByRole('button', { name: 'Besuch um 10:30 löschen' })
    )

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Besuch löschen?')).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        new RegExp(
          `Nachlieferung vom ${formatDate(
            TODAY
          )} um 10:30 Uhr wird endgültig gelöscht`
        )
      )
    ).toBeInTheDocument()
    expect(mockDeleteVisit).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mockDeleteVisit).not.toHaveBeenCalled()
    expect(mockFetchToday).toHaveBeenCalledTimes(1)
  })

  it('deletes a visit after confirmation and reloads the day', async () => {
    const user = userEvent.setup()
    await renderDetail()

    await user.click(
      screen.getByRole('button', { name: 'Besuch um 10:30 löschen' })
    )
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Löschen' }))

    await waitFor(() =>
      expect(mockDeleteVisit).toHaveBeenCalledWith(PARTNER_ID, 12)
    )
    expect(await screen.findByText('Besuch gelöscht.')).toBeInTheDocument()
    // Der Tag wird nach dem Löschen neu berechnet
    await waitFor(() => expect(mockFetchToday).toHaveBeenCalledTimes(2))
  })

  it('shows the German error message when the day cannot be loaded', async () => {
    mockFetchToday.mockRejectedValue(
      new Error('Die Besuche konnten nicht geladen werden.')
    )
    renderWithTheme(<PartnerDetailClient partnerId={PARTNER_ID} />)

    expect(
      await screen.findByText('Die Besuche konnten nicht geladen werden.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Erneut versuchen' })
    ).toBeInTheDocument()
    expect(screen.queryByText('Tag abgeschlossen')).toBeNull()
  })
})
