import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import AbgleichClient from './AbgleichClient'
import * as api from '../../../lib/abgleichApi'
import type {
  Abgleich,
  AbgleichDayRow,
  AbgleichItem,
} from '../../../lib/abgleichApi'

jest.mock('../../../lib/abgleichApi', () => {
  const actual = jest.requireActual('../../../lib/abgleichApi')
  return {
    ...actual,
    fetchAbgleich: jest.fn(),
    downloadAbgleichCsv: jest.fn(),
  }
})
const mocked = api as jest.Mocked<typeof api>

// Synthetic numbers only.
function dayRow(overrides: Partial<AbgleichDayRow> = {}): AbgleichDayRow {
  return {
    date: '2026-12-01',
    weekdayName: 'Dienstag',
    basis: 'freigegeben',
    baked: 20,
    cap: 0,
    shopBaked: 20,
    sold: 12,
    soldPieces: null,
    open: 8,
    rest: 2,
    restStatus: 'counted',
    unexplained: 6,
    ampel: 'pruefen',
    ampelBasis: 'mit_rest',
    status: 'ok',
    rate: 0.1,
    overproduction: false,
    restExceedsShop: false,
    lines: [],
    ...overrides,
  }
}

function item(overrides: Partial<AbgleichItem> = {}): AbgleichItem {
  return {
    key: 'testplunder',
    itemId: 'testplunder',
    sizeId: null,
    name: 'Testplunder',
    sizeLabel: null,
    section: 'kaffeestueckchen',
    sectionLabel: 'Kaffeestückchen',
    unit: 'Stück',
    plu: [906],
    converted: true,
    soldBasis: 'umgerechnet',
    tolerance: 1,
    status: 'vergleichbar',
    basis: 'freigegeben',
    days: 1,
    plannedDays: 0,
    comparableDays: 1,
    restDays: 1,
    baked: 20,
    cap: 0,
    shopBaked: 20,
    sold: 12,
    open: 8,
    restShopBaked: 20,
    rest: 2,
    unexplained: 6,
    ampel: 'pruefen',
    ampelBasis: 'mit_rest',
    direction: 'fehlt',
    rate: 0.1,
    overproduction: false,
    restExceedsDates: [],
    gaps: { noReport: [], restMissing: [], restPartial: [] },
    allBaked: 20,
    allCap: 0,
    soldPieces: null,
    variants: [],
    dayRows: [dayRow()],
    ...overrides,
  }
}

function abgleich(overrides: Partial<Abgleich> = {}): Abgleich {
  return {
    from: '2026-12-01',
    to: '2026-12-07',
    today: '2026-12-08',
    configStatus: 'ok',
    reportsAvailable: true,
    basis: 'freigegeben',
    explanation: 'Ungeklärt = gebacken − CAP − verkauft − Rest.',
    thresholds: {
      okShare: 0.05,
      noticeShare: 0.15,
      minTolerancePieces: 1,
      overproductionRate: 0.1,
    },
    counts: {
      days: 7,
      bakeDays: 2,
      confirmed: 2,
      planned: 0,
      noReport: 1,
      restCounted: 1,
      restPartial: 0,
      restNotCounted: 1,
      noBackzettel: 0,
      ruhetag: 1,
      geschlossen: 0,
      future: 0,
    },
    signals: { pruefen: 1, auffaellig: 0, ok: 1, ohneAmpel: 0 },
    items: [
      item(),
      item({
        key: 'testweck',
        itemId: 'testweck',
        name: 'Testweck',
        plu: [907],
        baked: 40,
        cap: 10,
        shopBaked: 30,
        sold: 31,
        open: -1,
        rest: null,
        restDays: 0,
        unexplained: null,
        ampel: 'ok',
        ampelBasis: 'ohne_rest',
        direction: null,
        gaps: {
          noReport: ['2026-12-02'],
          restMissing: ['2026-12-01'],
          restPartial: [],
        },
        dayRows: [
          dayRow({
            baked: 40,
            cap: 10,
            shopBaked: 30,
            sold: 31,
            open: -1,
            rest: null,
            restStatus: 'not_counted',
            unexplained: null,
            ampel: 'ok',
            ampelBasis: 'ohne_rest',
            status: 'ohne_rest',
          }),
          dayRow({
            date: '2026-12-02',
            weekdayName: 'Mittwoch',
            sold: null,
            open: null,
            rest: null,
            restStatus: 'not_counted',
            unexplained: null,
            ampel: null,
            ampelBasis: null,
            status: 'kein_bericht',
          }),
        ],
      }),
    ],
    unmatched: [
      item({
        key: 'testbrot',
        itemId: 'testbrot',
        name: 'Testbrot',
        unit: 'Liter',
        plu: [],
        converted: false,
        status: 'keine_plu',
        allBaked: 4,
        ampel: null,
        ampelBasis: null,
        direction: null,
      }),
      item({
        key: 'testlaib',
        itemId: 'testlaib',
        name: 'Testlaib',
        unit: 'Liter',
        plu: [909],
        converted: false,
        status: 'einheit',
        allBaked: 2,
        soldPieces: 3,
        ampel: null,
        ampelBasis: null,
        direction: null,
      }),
    ],
    days: [
      {
        date: '2026-12-01',
        weekday: 2,
        weekdayName: 'Dienstag',
        status: 'ok',
        basis: 'freigegeben',
        report: true,
        restStatus: 'partial',
        signals: { pruefen: 1, auffaellig: 0 },
      },
      {
        date: '2026-12-02',
        weekday: 3,
        weekdayName: 'Mittwoch',
        status: 'ok',
        basis: 'freigegeben',
        report: false,
        restStatus: 'not_counted',
        signals: { pruefen: 0, auffaellig: 0 },
      },
      {
        date: '2026-12-07',
        weekday: 1,
        weekdayName: 'Montag',
        status: 'ruhetag',
        basis: null,
        report: false,
        restStatus: null,
        signals: { pruefen: 0, auffaellig: 0 },
      },
    ],
    ...overrides,
  }
}

describe('Abgleich Produktion ↔ Kasse', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mocked.fetchAbgleich.mockResolvedValue(abgleich())
    mocked.downloadAbgleichCsv.mockResolvedValue(undefined)
  })

  it('zeigt je Posten Ungeklärt, Ampel und den Hinweis „keine Beweise“', async () => {
    render(<AbgleichClient />)
    const plunder = await screen.findByTestId('item-testplunder')
    expect(mocked.fetchAbgleich).toHaveBeenCalledWith({})
    expect(within(plunder).getByText('+6 St.')).toBeTruthy()
    expect(within(plunder).getByText('prüfen')).toBeTruthy()
    expect(within(plunder).getByText(/Ware fehlt/)).toBeTruthy()
    expect(screen.getByTestId('abgleich-hinweis').textContent).toContain(
      'Hinweise, keine Beweise.'
    )
    // ohne Rest: kein Ungeklärt, Signal „ohne Rest“, Lücken genannt
    const weck = screen.getByTestId('item-testweck')
    expect(within(weck).getByText('ok (ohne Rest)')).toBeTruthy()
    expect(within(weck).getByText('kein Kassenbericht: 02.12.')).toBeTruthy()
    expect(
      within(weck).getByText('Rest nicht (ganz) gezählt: 01.12.')
    ).toBeTruthy()
    // die erste Zeile ist die mit dem größten Signal
    const rows = screen.getAllByTestId(/^item-/)
    expect(rows[0].getAttribute('data-testid')).toBe('item-testplunder')
    // Ruhetag steht nicht in der Tagesliste
    expect(screen.getByTestId('tag-2026-12-01')).toBeTruthy()
    expect(screen.queryByTestId('tag-2026-12-07')).toBeNull()
    expect(screen.getByTestId('tag-2026-12-02').textContent).toContain(
      'kein Kassenbericht'
    )
  })

  it('klappt die Tage eines Postens auf', async () => {
    render(<AbgleichClient />)
    await screen.findByTestId('item-testweck')
    expect(screen.queryByTestId('day-testweck-2026-12-02')).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Testweck: Tage zeigen' })
    )
    const day = await screen.findByTestId('day-testweck-2026-12-02')
    expect(within(day).getByText('kein Bericht')).toBeTruthy()
    expect(within(day).getByText('kein Kassenbericht')).toBeTruthy()
    const first = screen.getByTestId('day-testweck-2026-12-01')
    expect(within(first).getByText('−1 St.')).toBeTruthy()
    expect(within(first).getByText('nicht gezählt')).toBeTruthy()
  })

  it('listet Posten ohne Kassennummer und nicht vergleichbare getrennt', async () => {
    render(<AbgleichClient />)
    const brot = await screen.findByTestId('unmatched-testbrot')
    expect(within(brot).getByText(/config\/backzettel\.yaml/)).toBeTruthy()
    const laib = screen.getByTestId('unmatched-testlaib')
    expect(within(laib).getByText('nicht vergleichbar (Einheit)')).toBeTruthy()
    expect(within(laib).getByText(/3 St\. verkauft/)).toBeTruthy()
    expect(screen.queryByTestId('item-testbrot')).toBeNull()
  })

  it('sagt deutlich, wenn die Grundlage nur geplant ist und kein Rest gezählt wurde', async () => {
    const base = abgleich()
    mocked.fetchAbgleich.mockResolvedValue({
      ...base,
      basis: 'geplant',
      counts: { ...base.counts, confirmed: 0, planned: 2, restCounted: 0 },
    })
    render(<AbgleichClient />)
    expect(
      (await screen.findByTestId('abgleich-geplant')).textContent
    ).toContain('Grundlage: geplant – nicht freigegeben.')
    expect(screen.getByTestId('abgleich-ohne-rest').textContent).toContain(
      'nicht verkauft oder nicht kassiert'
    )
  })

  it('lädt einen anderen Zeitraum und bietet das CSV', async () => {
    render(<AbgleichClient />)
    await screen.findByTestId('item-testplunder')
    fireEvent.click(screen.getByRole('button', { name: '7 Tage' }))
    await waitFor(() =>
      expect(mocked.fetchAbgleich).toHaveBeenLastCalledWith({
        from: '2026-12-01',
        to: '2026-12-07',
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }))
    await waitFor(() =>
      expect(mocked.downloadAbgleichCsv).toHaveBeenCalledWith({
        from: '2026-12-01',
        to: '2026-12-07',
      })
    )
  })

  it('zeigt die Meldung der API (z. B. 403 für andere Rollen)', async () => {
    mocked.fetchAbgleich.mockRejectedValueOnce(
      new Error('Für diese Aktion fehlt die Berechtigung.')
    )
    render(<AbgleichClient />)
    expect(
      await screen.findByText('Für diese Aktion fehlt die Berechtigung.')
    ).toBeTruthy()
  })
})
