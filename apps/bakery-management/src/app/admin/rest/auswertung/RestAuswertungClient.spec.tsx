import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import RestAuswertungClient from './RestAuswertungClient'
import * as api from '../../../../lib/restApi'
import type { RestSummary } from '../../../../lib/restApi'

jest.mock('../../../../lib/restApi', () => {
  const actual = jest.requireActual('../../../../lib/restApi')
  return {
    ...actual,
    fetchRestSummary: jest.fn(),
    downloadRestCsv: jest.fn(),
  }
})
const mocked = api as jest.Mocked<typeof api>

// Synthetic numbers only.
function summary(overrides: Partial<RestSummary> = {}): RestSummary {
  return {
    from: '2026-11-11',
    to: '2026-12-08',
    today: '2026-12-08',
    configStatus: 'ok',
    reportsAvailable: true,
    rateBasis: 'Restquote = Rest ÷ (gebacken − CAP-Lieferung).',
    counts: {
      days: 28,
      counted: 1,
      partial: 1,
      notCounted: 2,
      noBackzettel: 18,
      ruhetag: 4,
      future: 0,
    },
    totals: [
      {
        unit: 'Stück',
        items: 2,
        baked: 62,
        cap: 12,
        shopBaked: 50,
        rest: 6,
        rate: 0.12,
        restExceedsItems: 1,
      },
      {
        unit: 'Liter',
        items: 1,
        baked: 4,
        cap: 0,
        shopBaked: 4,
        rest: 1,
        rate: 0.25,
      },
    ],
    items: [
      {
        itemId: 'weck',
        name: 'Weck',
        section: 'broetchen',
        sectionLabel: 'Brötchen',
        unit: 'Stück',
        days: 1,
        baked: 52,
        cap: 12,
        shopBaked: 40,
        rest: 6,
        rate: 0.15,
        sold: null,
        soldDays: 0,
        soldConverted: false,
        soldStatus: 'no_plu',
        uncountedDays: 0,
        uncountedDates: [],
        restExceedsDates: ['2026-12-01'],
        variants: [],
        weeks: [
          { week: '2026-W48', days: 0, shopBaked: 0, rest: 0, rate: null },
          { week: '2026-W49', days: 1, shopBaked: 40, rest: 6, rate: 0.15 },
        ],
      },
      {
        itemId: 'plunder',
        name: 'Plunder',
        section: 'kaffeestueckchen',
        sectionLabel: 'Kaffeestückchen',
        unit: 'Stück',
        days: 1,
        baked: 10,
        cap: 0,
        shopBaked: 10,
        rest: 0,
        rate: 0,
        sold: 9,
        soldDays: 1,
        soldConverted: true,
        soldStatus: 'ok',
        uncountedDays: 1,
        uncountedDates: ['2026-12-02'],
        variants: [
          {
            variant: 'nuss',
            label: 'Nuss',
            baked: 10,
            cap: 0,
            rest: 0,
            rate: 0,
          },
        ],
        weeks: [{ week: '2026-W49', days: 1, shopBaked: 10, rest: 0, rate: 0 }],
      },
    ],
    days: [
      {
        date: '2026-12-01',
        weekday: 2,
        weekdayName: 'Dienstag',
        status: 'counted',
        byUnit: { Stück: { shopBaked: 50, rest: 6, rate: 0.12 } },
      },
      {
        date: '2026-12-02',
        weekday: 3,
        weekdayName: 'Mittwoch',
        status: 'partial',
        byUnit: {},
      },
      {
        date: '2026-12-07',
        weekday: 1,
        weekdayName: 'Montag',
        status: 'ruhetag',
        byUnit: {},
      },
    ],
    ...overrides,
  }
}

describe('Rest-Auswertung', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mocked.fetchRestSummary.mockResolvedValue(summary())
    mocked.downloadRestCsv.mockResolvedValue(undefined)
  })

  it('shows totals per unit, the table per item and the gaps', async () => {
    render(<RestAuswertungClient />)
    const weck = await screen.findByTestId('item-weck')
    expect(mocked.fetchRestSummary).toHaveBeenCalledWith({})
    expect(within(weck).getByText('15,0 %')).toBeTruthy()
    expect(within(weck).getByText('keine PLU')).toBeTruthy()
    const plunder = screen.getByTestId('item-plunder')
    expect(within(plunder).getByText('9 St.')).toBeTruthy()
    expect(within(plunder).getByText('Nuss: 0,0 %')).toBeTruthy()
    expect(
      within(plunder).getByText('1 Tag nicht vollständig gezählt')
    ).toBeTruthy()
    expect(screen.getByTestId('rest-exceeds-weck').textContent).toBe(
      'Mehr Rest als für den Laden gebacken am 01.12. - Zählung prüfen'
    )
    expect(screen.queryByTestId('rest-exceeds-plunder')).toBeNull()
    expect(screen.getByText('12,0 %')).toBeTruthy()
    expect(screen.getByText('25,0 %')).toBeTruthy()
    // Die Quote der Kachel enthält den verzählten Tag - die Kachel sagt es
    // (Abschluss-Verifikation next).
    expect(screen.getByTestId('rest-total-exceeds-Stück').textContent).toBe(
      '1 Posten mit mehr Rest als gebacken - Quote enthält vermutlich Zählfehler.'
    )
    expect(screen.queryByTestId('rest-total-exceeds-Liter')).toBeNull()
    expect(screen.getByTestId('day-counts').textContent).toContain(
      '1 Tage ausgewertet'
    )
    const chart = screen.getByTestId('daily-chart')
    expect(chart.querySelector('[data-status="partial"]')).toBeTruthy()
    expect(screen.getByText('Restquote je Tag (Stück)')).toBeTruthy()
  })

  it('loads another period and offers the CSV', async () => {
    render(<RestAuswertungClient />)
    await screen.findByTestId('item-weck')
    fireEvent.change(screen.getByLabelText('Von'), {
      target: { value: '2026-12-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Anzeigen' }))
    await waitFor(() =>
      expect(mocked.fetchRestSummary).toHaveBeenLastCalledWith({
        from: '2026-12-01',
        to: '2026-12-08',
      })
    )
    fireEvent.click(screen.getByRole('button', { name: '7 Tage' }))
    await waitFor(() =>
      expect(mocked.fetchRestSummary).toHaveBeenLastCalledWith({
        from: '2026-12-02',
        to: '2026-12-08',
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }))
    await waitFor(() =>
      expect(mocked.downloadRestCsv).toHaveBeenCalledWith({
        from: '2026-11-11',
        to: '2026-12-08',
      })
    )
  })

  it('shows the API message (e.g. 403 for non-owners)', async () => {
    mocked.fetchRestSummary.mockRejectedValueOnce(
      new Error('Keine Berechtigung für diese Aktion.')
    )
    render(<RestAuswertungClient />)
    expect(
      await screen.findByText('Keine Berechtigung für diese Aktion.')
    ).toBeTruthy()
  })
})
