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
    bakedIsMinimum: false,
    cap: 0,
    shopBaked: 20,
    report: true,
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
    bakedIsMinimum: false,
    cap: 0,
    shopBaked: 20,
    sold: 12,
    open: 8,
    restShopBaked: 20,
    restSold: 12,
    rest: 2,
    unexplained: 6,
    ampel: 'pruefen',
    ampelBasis: 'mit_rest',
    signal: 6,
    shortWithoutRest: null,
    shortDays: 0,
    signalDays: { pruefen: 1, auffaellig: 0 },
    direction: 'fehlt',
    rate: 0.1,
    overproduction: false,
    restExceedsDates: [],
    gaps: {
      noReport: [],
      restMissing: [],
      restPartial: [],
      baseOpen: [],
      notOnBackzettel: [],
    },
    allBaked: 20,
    allBakedIsMinimum: false,
    allCap: 0,
    soldPieces: null,
    foreignPlu: [],
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
      baseOpen: 0,
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
        signalDays: { pruefen: 0, auffaellig: 0 },
        gaps: {
          noReport: ['2026-12-02'],
          restMissing: ['2026-12-01'],
          restPartial: [],
          baseOpen: [],
          notOnBackzettel: [],
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
            report: false,
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
        baseOpen: 0,
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
        baseOpen: 0,
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
        baseOpen: 0,
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
    // Hinweise in der zweiten Zeile des Postens
    expect(
      within(screen.getByTestId('notes-testplunder')).getByText(/Ware fehlt/)
    ).toBeTruthy()
    expect(screen.getByTestId('abgleich-hinweis').textContent).toContain(
      'Hinweise, keine Beweise.'
    )
    // ohne Rest: kein Ungeklärt, Signal „ohne Rest“, Lücken genannt
    const weck = screen.getByTestId('item-testweck')
    expect(within(weck).getByText('ok (ohne Rest)')).toBeTruthy()
    const weckNotes = screen.getByTestId('notes-testweck')
    expect(
      within(weckNotes).getByText('kein Kassenbericht: 02.12.')
    ).toBeTruthy()
    expect(
      within(weckNotes).getByText('Rest nicht (ganz) gezählt: 01.12.')
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

  describe('Ergebnis vorn - passt aufs Tablet (Spalten)', () => {
    /** Kopfzeilen samt ausgeblendeter (CSS `display: none`). */
    const headers = (table: HTMLElement) =>
      Array.from(table.querySelectorAll('thead th')).map((th) =>
        (th.textContent ?? '').trim()
      )

    /** Zellen genau dieser Zeile (ohne die der aufgeklappten Tage). */
    const cellsOf = (testId: string) =>
      Array.from((screen.getByTestId(testId) as HTMLTableRowElement).cells)

    /**
     * `display` einer Zelle je Mindestbreite, aus den Emotion-Regeln - jsdom
     * wertet `@media` nicht aus. `{ 0: 'none', 1536: 'table-cell' }` = erst
     * ab xl zu sehen; `{}` = immer.
     */
    function displayByWidth(element: Element): Record<number, string> {
      const cls = Array.from(element.classList).find((c) =>
        c.startsWith('css-')
      )
      const out: Record<number, string> = {}
      for (const sheet of Array.from(document.styleSheets)) {
        for (const rule of Array.from(sheet.cssRules)) {
          if (!('media' in rule) || !('cssRules' in rule)) continue
          const media = rule as CSSMediaRule
          const min = /min-width:\s*(\d+)px/.exec(media.media.mediaText)
          for (const inner of Array.from(media.cssRules)) {
            const style = inner as CSSStyleRule
            if (style.selectorText === `.${cls}` && style.style?.display) {
              out[min ? Number(min[1]) : 0] = style.style.display
            }
          }
        }
      }
      return out
    }
    const BELOW_XL = { 0: 'none', 1536: 'table-cell' }
    const PHONE = { 0: 'none', 600: 'table-cell' }

    it('Posten, Ungeklärt, Ampel zuerst - in Kopf, Zeile und aufgeklappten Tagen', async () => {
      render(<AbgleichClient />)
      const table = await screen.findByRole('table', {
        name: 'Abgleich je Posten',
      })
      expect(headers(table)).toEqual([
        '',
        'Posten',
        'Ungeklärt',
        'Ampel',
        'Gebacken',
        'CAP',
        'Verkauft (Kasse)',
        'Nicht verkauft oder nicht kassiert',
        'Rest',
      ])
      const cells = cellsOf('item-testplunder')
      expect(cells).toHaveLength(9)
      expect(cells[1].textContent).toBe('Testplunder')
      expect(cells[2].textContent).toBe('+6 St.')
      expect(cells[3].textContent).toBe('prüfen')

      fireEvent.click(
        screen.getByRole('button', { name: 'Testplunder: Tage zeigen' })
      )
      const days = await screen.findByRole('table', {
        name: 'Testplunder je Tag',
      })
      expect(headers(days)).toEqual([
        'Tag',
        'Ungeklärt',
        'Ampel',
        'Gebacken',
        'CAP',
        'Verkauft',
        'Nicht verk./kass.',
        'Rest',
      ])
      const day = cellsOf('day-testplunder-2026-12-01')
      expect(day[1].textContent).toBe('+6 St.')
      expect(day[2].textContent).toBe('prüfen')
    })

    it('CAP und „Nicht verkauft oder nicht kassiert“ erst ab xl, je Tag immer', async () => {
      render(<AbgleichClient />)
      const table = await screen.findByRole('table', {
        name: 'Abgleich je Posten',
      })
      const th = Array.from(table.querySelectorAll('thead th'))
      const byText = (text: string) =>
        th.find((cell) => cell.textContent === text) as Element
      expect(displayByWidth(byText('CAP'))).toEqual(BELOW_XL)
      expect(
        displayByWidth(byText('Nicht verkauft oder nicht kassiert'))
      ).toEqual(BELOW_XL)
      // Gebacken, Verkauft und Rest nur am Handy weg
      for (const name of ['Gebacken', 'Verkauft (Kasse)', 'Rest']) {
        expect(displayByWidth(byText(name))).toEqual(PHONE)
      }
      // Posten, Ungeklärt und Ampel immer - am Handy neben dem Namen
      for (const name of ['Posten', 'Ungeklärt', 'Ampel']) {
        expect(displayByWidth(byText(name))).toEqual({})
      }
      // In der Zeile dieselben Regeln wie im Kopf
      expect(cellsOf('item-testplunder').map(displayByWidth)).toEqual(
        th.map(displayByWidth)
      )
      expect(cellsOf('item-testplunder').map(displayByWidth)).toEqual([
        {},
        {},
        {},
        {},
        PHONE,
        BELOW_XL,
        PHONE,
        BELOW_XL,
        PHONE,
      ])
      // aufgeklappt stehen CAP und „nicht verk./kass.“ ohne Ausblenden da
      fireEvent.click(
        screen.getByRole('button', { name: 'Testplunder: Tage zeigen' })
      )
      const days = await screen.findByRole('table', {
        name: 'Testplunder je Tag',
      })
      for (const cell of Array.from(days.querySelectorAll('th, td'))) {
        expect(displayByWidth(cell)).toEqual({})
      }
    })

    it('colSpan passt zur Spaltenzahl (Hinweise, aufgeklappte Tage, leer)', async () => {
      render(<AbgleichClient />)
      const table = await screen.findByRole('table', {
        name: 'Abgleich je Posten',
      })
      const columns = table.querySelectorAll('thead th').length
      expect(columns).toBe(9)
      fireEvent.click(
        screen.getByRole('button', { name: 'Testplunder: Tage zeigen' })
      )
      await screen.findByTestId('day-testplunder-2026-12-01')
      // nur die Zeilen dieser Tabelle, nicht die der aufgeklappten Tage
      const rows = Array.from(table.querySelectorAll('tbody > tr')).filter(
        (row) => row.closest('table') === table
      ) as HTMLTableRowElement[]
      // je Posten Zeile + Hinweise + Aufklappen
      expect(rows).toHaveLength(6)
      for (const row of rows) {
        const span = Array.from(row.cells).reduce(
          (sum, cell) => sum + cell.colSpan,
          0
        )
        expect(span).toBe(columns)
      }
      // Hinweise: eine eigene Zeile unter dem Posten, über die ganze Breite
      const notes = screen.getByTestId('notes-testplunder')
      expect(notes.previousElementSibling).toBe(
        screen.getByTestId('item-testplunder')
      )
      expect((notes as HTMLTableRowElement).cells[1].colSpan).toBe(8)
    })

    it('ohne Posten: die Leerzeile spannt alle Spalten', async () => {
      mocked.fetchAbgleich.mockResolvedValue(abgleich({ items: [] }))
      render(<AbgleichClient />)
      const empty = await screen.findByText(
        'Im Zeitraum gibt es nichts abzugleichen.'
      )
      expect((empty as HTMLTableCellElement).colSpan).toBe(9)
    })
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

  it('Grundmenge offen: gebacken nur als „≥“, ohne Ampel, mit Hinweis', async () => {
    const base = abgleich()
    mocked.fetchAbgleich.mockResolvedValue({
      ...base,
      counts: { ...base.counts, baseOpen: 1 },
      items: [
        item({
          key: 'testbreze',
          itemId: 'testbreze',
          name: 'Testbreze',
          comparableDays: 0,
          restDays: 0,
          baked: 4,
          bakedIsMinimum: true,
          sold: null,
          open: null,
          rest: null,
          unexplained: null,
          ampel: null,
          ampelBasis: null,
          signal: null,
          signalDays: { pruefen: 0, auffaellig: 0 },
          direction: null,
          gaps: {
            noReport: [],
            restMissing: [],
            restPartial: [],
            baseOpen: ['2026-12-01'],
            notOnBackzettel: [],
          },
          dayRows: [
            dayRow({
              baked: 4,
              bakedIsMinimum: true,
              sold: 9,
              open: null,
              rest: null,
              restStatus: 'not_counted',
              unexplained: null,
              ampel: null,
              ampelBasis: null,
              status: 'grundmenge_offen',
            }),
          ],
        }),
      ],
    })
    render(<AbgleichClient />)
    const row = await screen.findByTestId('item-testbreze')
    expect(within(row).getByText('≥ 4 St.')).toBeTruthy()
    expect(
      within(screen.getByTestId('notes-testbreze')).getByText(
        /Grundmenge offen – kein Plan, kein Vergleich: 01\.12\./
      )
    ).toBeTruthy()
    expect(
      screen.getByTestId('abgleich-grundmenge-offen').textContent
    ).toContain('Grundmenge offen')
    fireEvent.click(
      screen.getByRole('button', { name: 'Testbreze: Tage zeigen' })
    )
    const day = await screen.findByTestId('day-testbreze-2026-12-01')
    expect(within(day).getByText('Grundmenge offen – kein Plan')).toBeTruthy()
  })

  it('Rest nur an einem Teil der Tage: Ungeklärt nennt seine Grundlage', async () => {
    const base = abgleich()
    mocked.fetchAbgleich.mockResolvedValue({
      ...base,
      items: [
        item({
          comparableDays: 2,
          restDays: 1,
          baked: 40,
          shopBaked: 40,
          sold: 25,
          open: 15,
          restShopBaked: 20,
          restSold: 15,
          rest: 2,
          unexplained: 3,
        }),
      ],
    })
    render(<AbgleichClient />)
    const basis = await screen.findByTestId('ungeklaert-basis-testplunder')
    expect(basis.textContent).toBe(
      'nur 1 von 2 Tagen: 20 − 15 verkauft − 2 Rest'
    )
  })

  it('„prüfen (ohne Rest)“ nennt seine Menge; Gebacken nennt seine Tage', async () => {
    const base = abgleich()
    mocked.fetchAbgleich.mockResolvedValue({
      ...base,
      items: [
        item({
          days: 3,
          comparableDays: 2,
          restDays: 0,
          baked: 40,
          shopBaked: 40,
          sold: 40,
          open: 0,
          rest: null,
          unexplained: null,
          ampel: 'pruefen',
          ampelBasis: 'ohne_rest',
          signal: -10,
          shortWithoutRest: -10,
          shortDays: 1,
          direction: 'mehr_verkauft',
          allBaked: 60,
          gaps: {
            noReport: ['2026-12-03'],
            restMissing: ['2026-12-01'],
            restPartial: [],
            baseOpen: [],
            notOnBackzettel: ['2026-12-02'],
          },
        }),
        item({
          key: 'testzopf',
          itemId: 'testzopf',
          name: 'Testzopf',
          comparableDays: 0,
          restDays: 0,
          sold: null,
          open: null,
          rest: null,
          unexplained: null,
          ampel: null,
          ampelBasis: null,
          signal: null,
          direction: null,
        }),
      ],
    })
    render(<AbgleichClient />)
    const row = await screen.findByTestId('item-testplunder')
    expect(within(row).getByText('prüfen (ohne Rest)')).toBeTruthy()
    expect(screen.getByTestId('mehr-verkauft-testplunder').textContent).toBe(
      '−10 St. an einem Tag ohne Rest'
    )
    expect(screen.getByTestId('gebacken-basis-testplunder').textContent).toBe(
      '2 von 3 Tagen (alle: 60 St.)'
    )
    // nicht auf dem Backzettel ist keine Zähllücke
    const notes = screen.getByTestId('notes-testplunder')
    expect(
      within(notes).getByText('verkauft, aber nicht auf dem Backzettel: 02.12.')
    ).toBeTruthy()
    expect(
      within(notes).getByText('Rest nicht (ganz) gezählt: 01.12.')
    ).toBeTruthy()
    // ohne vergleichbaren Tag kein „*“ (der fehlt nicht wegen des Rests)
    const zopf = screen.getByTestId('item-testzopf')
    expect(zopf.textContent).not.toContain('*')
    expect(screen.queryByTestId('mehr-verkauft-testzopf')).toBeNull()
  })

  it('Zeitraum ohne „prüfen“, aber ein Tag mit „prüfen“: sagt es', async () => {
    const base = abgleich()
    mocked.fetchAbgleich.mockResolvedValue({
      ...base,
      items: [
        item({
          ampel: 'ok',
          direction: null,
          signalDays: { pruefen: 1, auffaellig: 0 },
        }),
      ],
    })
    render(<AbgleichClient />)
    await screen.findByTestId('item-testplunder')
    expect(
      within(screen.getByTestId('notes-testplunder')).getByText(
        'An 1 Tag „prüfen“ - Tage aufklappen'
      )
    ).toBeTruthy()
  })

  it('nicht vergleichbar: nennt Lücken und den Grund (Teil-Produkte, fremde Kassennummer)', async () => {
    const base = abgleich()
    mocked.fetchAbgleich.mockResolvedValue({
      ...base,
      unmatched: [
        item({
          key: 'testkranz',
          itemId: 'testkranz',
          name: 'Testkranz',
          unit: 'Stück',
          plu: [991],
          converted: false,
          status: 'einheit',
          allBaked: 4,
          soldPieces: 3,
          gaps: {
            noReport: ['2026-12-02'],
            restMissing: [],
            restPartial: [],
            baseOpen: [],
            notOnBackzettel: [],
          },
        }),
        item({
          key: 'testschnecke',
          itemId: 'testschnecke',
          name: 'Testschnecke',
          unit: 'Stück',
          plu: [990, 906],
          converted: false,
          status: 'einheit',
          soldPieces: null,
          foreignPlu: [906],
        }),
      ],
    })
    render(<AbgleichClient />)
    const kranz = await screen.findByTestId('unmatched-testkranz')
    expect(within(kranz).getByText(/Teile \(Faktor ≠ 1/)).toBeTruthy()
    expect(within(kranz).getByText('kein Kassenbericht: 02.12.')).toBeTruthy()
    expect(within(kranz).queryByText(/rechnet in Stück/)).toBeNull()
    const schnecke = screen.getByTestId('unmatched-testschnecke')
    expect(
      within(schnecke).getByText(
        /Kassennummer 906 gehört zu einem Produkt eines anderen Postens/
      )
    ).toBeTruthy()
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
