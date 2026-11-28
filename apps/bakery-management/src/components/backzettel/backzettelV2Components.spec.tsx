import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MachineStrip, machineHints } from './MachineStrip'
import { OpenMasterDataNote } from './OpenMasterDataNote'
import { BreadTable, breadTableMinWidth } from './BreadTable'
import { batchText } from './HefeteigCard'
import { batchesText } from '../../lib/backzettelFormat'
import { RollsByBakeDay, linesByKey, v2CoveredKeys } from './RollsByBakeDay'
import {
  BASE_OPEN_NOTE,
  BackzettelSectionView,
  SECTION_COLS,
  SECTION_TABLE_MIN_WIDTH,
  tableFitSx,
} from './BackzettelSectionView'
import {
  SAT,
  SUN,
  TEST_CONFIG_V2,
  V2_TUE,
  line,
  saturdayV2Draft,
} from '../../lib/backzettelFixtures'

const noop = () => undefined
const day = saturdayV2Draft()
const editProps = {
  config: TEST_CONFIG_V2,
  sheetDate: SAT,
  lineByKey: linesByKey(day.sections),
  editable: false,
  editingKey: null,
  onEdit: noop,
  onSaveCorrection: async () => undefined,
}

describe('Backzettel v2 - Bausteine', () => {
  it('Abschnitt: Zukauf-Hinweis fett an Tabelle und Karte, nur an Zeilen mit Hinweis', () => {
    const zukauf = line({
      itemId: 'test-laugenstange',
      name: 'Testlaugenstange',
      section: 'laugen',
      purchased: true,
      note: 'mit Käse bestreuen',
      hint: 'Zukauf – auflegen · mit Käse bestreuen',
    })
    const plain = line({ itemId: 'test-weck' })
    render(
      <BackzettelSectionView
        section={{ id: 'laugen', label: 'Laugen', lines: [zukauf, plain] }}
        config={null}
        editable={false}
        editingKey={null}
        onEdit={noop}
        onSaveCorrection={async () => undefined}
      />
    )
    const hints = screen.getAllByTestId(`line-hint-${zukauf.key}`)
    // Tabelle (ab md) und Karte (darunter) stehen beide im DOM
    expect(hints).toHaveLength(2)
    for (const h of hints)
      expect(h).toHaveTextContent('Zukauf – auflegen · mit Käse bestreuen')
    expect(screen.queryAllByTestId(`line-hint-${plain.key}`)).toHaveLength(0)
  })

  it('MachineStrip: nichts ohne Kästen, Hinweise je Teig ohne Doppelte', () => {
    const { container } = render(<MachineStrip machine={[]} />)
    expect(container).toBeEmptyDOMElement()
    const flit = (day.machine ?? []).find((m) => m.id === 'test-flit-teig')
    if (!flit) throw new Error('Fixture ohne Testflit')
    const hints = machineHints(flit, day.doughs)
    expect(hints[0]).toMatch(/Teig unvollständig/)
    expect(new Set(hints).size).toBe(hints.length)
    expect(hints).toContain(
      '„Testflitweck“: Bruchgewicht für Dienstag ist noch offen.'
    )
  })

  it('MachineStrip: Hefeteig heißt „Wasser“, Einzel-kg einer Teiggruppe', () => {
    render(<MachineStrip machine={day.machine ?? []} doughs={day.doughs} />)
    expect(
      within(screen.getByTestId('machine-test-hefe')).getByText('Wasser')
    ).toBeInTheDocument()
    // Zahl und „kg“ stehen in einem eigenen, nicht umbrechenden Teil
    // (UI-Runde 2: kein „kg“ allein in der nächsten Zeile).
    const members = within(
      screen.getByTestId('machine-test-korn-teig')
    ).getByText(
      (_, el) =>
        el?.tagName === 'P' &&
        el.textContent === 'Testkorn 7,8 kg · Testholz 3,6 kg'
    )
    expect(within(members).getByText('7,8 kg')).toHaveStyle({
      whiteSpace: 'nowrap',
    })
    expect(
      within(screen.getByTestId('machine-test-korn-teig')).getByText(
        'Chargen: unbekannt'
      )
    ).toBeInTheDocument()
  })

  it('Maschinen-Leiste und Hefeteig-Karte (auch Tablet, Druck) sagen dasselbe: Stammdaten „offen“, Gerechnetes „unbekannt“', () => {
    const dough = {
      id: 'test-hefe',
      name: 'Testhefe',
      pieces: null,
      dough_g: null,
      batches: null,
      weighing: [],
    }
    // Chargengröße fehlt in den Stammdaten
    expect(batchesText({ batches: null, batch_max_kg: null }).hint).toBe(
      'Chargengröße offen'
    )
    expect(batchText({ ...dough, batch_max_kg: null })).toBe(
      'Chargengröße offen'
    )
    // Chargengröße da, das Teiggewicht lässt sich nicht rechnen
    expect(batchesText({ batches: null, batch_max_kg: 40 }).hint).toBe(
      'Teiggewicht unbekannt'
    )
    expect(batchText({ ...dough, batch_max_kg: 40 })).toBe(
      'Chargen: unbekannt (Teiggewicht unbekannt) – je max. 40 kg'
    )
  })

  it('OpenMasterDataNote: leer = nichts, sonst aufklappbar (44 px)', () => {
    const { container, rerender } = render(<OpenMasterDataNote open={[]} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<OpenMasterDataNote open={day.openMasterData} />)
    const button = screen.getByRole('button', {
      name: /Offene Stammdaten \(3\)/,
    })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Chargengröße ist noch offen/)).toBeInTheDocument()
  })

  it('BreadTable: Liter-Posten als eine Zelle, ohne kg-Angabe', () => {
    render(<BreadTable bread={day.bread} {...editProps} />)
    const hafer = within(screen.getByTestId('bread-row-test-hafer'))
    expect(hafer.getByTestId('bread-cell-test-hafer|')).toHaveTextContent(
      '1,5 L'
    )
    expect(screen.getByTestId('bread-kg-test-hafer')).toHaveTextContent('')
    // nur lesen: keine Stifte
    expect(
      screen.queryByRole('button', { name: /Korrektur/ })
    ).not.toBeInTheDocument()
  })

  it('BreadTable (ab md): Liter-Posten in einer eigenen Spalte „Menge“, Zahl und Stift auf einer Linie', () => {
    render(<BreadTable bread={day.bread} {...editProps} editable />)
    const table = within(screen.getByTestId('bread-table'))
    const headers = table.getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers).toEqual([
      'Brot',
      '500 g',
      '1 kg',
      'Kasten',
      'Menge',
      'Teig',
    ])
    // Die Menge steht in der Spalte „Menge“, nicht in der Namensspalte
    // und nicht unter einer Größe.
    const haferCells = within(
      table.getByTestId('bread-row-test-hafer')
    ).getAllByRole('cell')
    expect(haferCells).toHaveLength(4) // Brot | Größen (leer) | Menge | Teig
    expect(haferCells[0]).toHaveTextContent('Testhafer')
    expect(haferCells[0]).not.toHaveTextContent('1,5')
    expect(haferCells[1]).toHaveAttribute('colspan', '3')
    expect(haferCells[1]).toBeEmptyDOMElement()
    expect(haferCells[2]).toBe(table.getByTestId('bread-single-test-hafer'))
    expect(haferCells[2]).toHaveTextContent('1,5 L')
    // Brote mit Größe lassen „Menge“ leer
    const kornCells = within(
      table.getByTestId('bread-row-test-korn')
    ).getAllByRole('cell')
    expect(kornCells).toHaveLength(6)
    expect(kornCells[4]).toBeEmptyDOMElement()
    // Stift (44 px) neben der Zahl, kein Umbruch - auch in der 500-g-Spalte
    for (const key of ['test-korn|g500', 'test-hafer|']) {
      const box = table.getByTestId(`bread-cell-${key}-box`)
      expect(box).toHaveStyle({ flexWrap: 'nowrap' })
      const pencil = within(box).getByRole('button', { name: /Korrektur/ })
      expect(pencil).toHaveStyle({ width: '44px', height: '44px' })
    }
  })

  it('BreadTable: ohne Brot ohne Größe keine Spalte „Menge“', () => {
    const bread = day.bread
    if (!bread) throw new Error('Fixture ohne Brot')
    render(
      <BreadTable
        bread={{ ...bread, rows: bread.rows.filter((r) => !r.single) }}
        {...editProps}
      />
    )
    expect(
      within(screen.getByTestId('bread-table'))
        .getAllByRole('columnheader')
        .map((h) => h.textContent)
    ).toEqual(['Brot', '500 g', '1 kg', 'Kasten', 'Teig'])
  })

  it('Umschalten nach der Breite des Inhalts: Container-Abfrage, Tabelle erst ab der Mindestbreite', () => {
    const fit = tableFitSx(900)
    expect(fit.container).toEqual({
      containerType: 'inline-size',
      containerName: 'bz-fit',
    })
    // Schmaler als die Tabelle braucht: Karten, sonst die Tabelle - egal wie
    // breit das Fenster ist (Tablet quer neben der Seitenleiste).
    expect(fit.table['@container bz-fit (width < 900px)']).toEqual({
      display: 'none',
    })
    expect(fit.table['@container bz-fit (width >= 900px)']).toEqual({
      display: 'block',
    })
    expect(fit.cards['@container bz-fit (width < 900px)']).toEqual({
      display: 'block',
    })
    expect(fit.cards['@container bz-fit (width >= 900px)']).toEqual({
      display: 'none',
    })
    // Ohne Container-Abfragen (alter Browser) die alte Regel nach dem Fenster
    expect(fit.table.display).toEqual({ xs: 'none', md: 'block' })
    expect(fit.cards.display).toEqual({ xs: 'block', md: 'none' })
  })

  it('BreadTable: Mindestbreite aus den Spalten, Tabelle und Karten zeigen dieselben Werte', () => {
    const bread = day.bread
    if (!bread) throw new Error('Fixture ohne Brot')
    // Brot 140 + 3 Größen + „Menge“ je 136 + Teig 96 + Rahmen 2
    expect(breadTableMinWidth(bread)).toBe(140 + 4 * 136 + 96 + 2)
    expect(
      breadTableMinWidth({
        ...bread,
        rows: bread.rows.filter((r) => !r.single),
      })
    ).toBe(140 + 3 * 136 + 96 + 2)
    render(<BreadTable bread={bread} {...editProps} />)
    expect(screen.getByTestId('bread-fit')).toHaveAttribute(
      'data-table-min-width',
      String(breadTableMinWidth(bread))
    )
    const table = within(screen.getByTestId('bread-table'))
    const cards = within(screen.getByTestId('bread-cards'))
    let compared = 0
    for (const row of bread.rows) {
      const keys = row.single
        ? [row.single.key]
        : Object.values(row.cells).flatMap((c) => (c ? [c.key] : []))
      for (const key of keys) {
        expect(cards.getByTestId(`bread-card-cell-${key}`).textContent).toBe(
          table.getByTestId(`bread-cell-${key}`).textContent
        )
        compared++
      }
      if (row.single) {
        expect(
          table.getByTestId(`bread-single-${row.itemId}`)
        ).toHaveTextContent(
          cards.getByTestId(`bread-card-cell-${row.single.key}`).textContent ??
            ''
        )
      }
    }
    expect(compared).toBeGreaterThan(3)
  })

  it('BreadTable: läuft die Tabelle über, gilt die gemessene Breite schon beim ersten Bild (kein Aufblitzen)', () => {
    const bread = day.bread
    if (!bread) throw new Error('Fixture ohne Brot')
    // Rahmen 800 px, die Tabelle braucht 900 px (Abzeichen, Stifte). jsdom
    // hat keinen ResizeObserver - gemessen werden muss trotzdem sofort.
    const clientWidth = jest
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.dataset.testid === 'bread-fit' ||
          this.classList.contains('MuiTableContainer-root')
          ? 800
          : 0
      })
    const scrollWidth = jest
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.tagName === 'TABLE' ? 900 : 0
      })
    try {
      expect(breadTableMinWidth(bread)).toBeLessThan(900)
      render(<BreadTable bread={bread} {...editProps} />)
      expect(screen.getByTestId('bread-fit')).toHaveAttribute(
        'data-table-min-width',
        '900'
      )
    } finally {
      clientWidth.mockRestore()
      scrollWidth.mockRestore()
    }
  })

  it('Abschnitt: „offen“ als Warnschrift ohne Chip, Erklärung sichtbar, feste Spalten, Tabelle und Karten mit denselben Werten', () => {
    const open = line({
      itemId: 'test-zopf',
      name: 'Testzopf',
      section: 'hefeteig',
      baseUnset: true,
      base: 0,
      preorders: 7,
      cap: 2,
      total: 9,
      totalIsMinimum: true,
    })
    const plain = line({
      itemId: 'test-weck',
      preorders: 12,
      cap: 10,
      total: 82,
    })
    render(
      <BackzettelSectionView
        section={{ id: 'hefeteig', label: 'Hefeteig', lines: [open, plain] }}
        config={null}
        editable
        editingKey={null}
        onEdit={noop}
        onSaveCorrection={async () => undefined}
      />
    )
    // „offen“ in Tabelle und Karte, als Text (kein abgeschnittener Chip)
    const bases = screen.getAllByTestId(`base-open-${open.key}`)
    expect(bases).toHaveLength(2)
    for (const b of bases) {
      expect(b).toHaveTextContent('offen')
      expect(b.closest('.MuiChip-root')).toBeNull()
    }
    // Erklärung steht da (ein `title` erreicht am Tablet niemand)
    expect(screen.getByTestId('base-open-note-hefeteig')).toHaveTextContent(
      BASE_OPEN_NOTE
    )
    // Gesamt in Tabelle und Karte gleich
    const table = within(screen.getByTestId('table-hefeteig'))
    const cards = within(screen.getByTestId('cards-hefeteig'))
    for (const [l, total] of [
      [open, '≥ 9'],
      [plain, '82'],
    ] as const) {
      expect(table.getByTestId(`line-total-${l.key}`)).toHaveTextContent(total)
      expect(cards.getByLabelText(`Gesamt ${l.name}`)).toHaveTextContent(total)
    }
    // Spalten in px: „Vorbestellt“ und „CAP“ laufen nicht ineinander, die
    // Tabelle steht erst ab ihrer Mindestbreite.
    const cols = Array.from(
      screen.getByTestId('table-hefeteig').querySelectorAll('col')
    ).map((c) => c.style.width)
    expect(cols).toEqual(['', ...SECTION_COLS.map((w) => `${w}px`)])
    expect(SECTION_COLS[2]).toBeGreaterThanOrEqual(112) // Vorbestellt
    expect(screen.getByTestId('fit-hefeteig')).toHaveAttribute(
      'data-table-min-width',
      String(SECTION_TABLE_MIN_WIDTH)
    )
    // ohne offene Grundmenge keine Erklärung
    expect(screen.queryByTestId('base-open-note-broetchen')).toBeNull()
  })

  it('RollsByBakeDay und v2CoveredKeys decken dieselben Zeilen ab', () => {
    render(<RollsByBakeDay rolls={day.rolls} {...editProps} />)
    expect(screen.getByTestId(`rolls-${SUN}`)).toBeInTheDocument()
    expect(screen.getByTestId(`rolls-${V2_TUE}`)).toBeInTheDocument()
    const covered = v2CoveredKeys(day)
    expect(covered.has(`test-doppel|@${V2_TUE}`)).toBe(true)
    expect(covered.has('test-korn|g500')).toBe(true)
    expect(covered.has('test-plunder|')).toBe(false)
  })

  it('RollsByBakeDay: Einzelstück mit offener Grundmenge zeigt den bekannten Teig als „≥“', () => {
    const rolls = (day.rolls ?? []).map((block) =>
      block.bakeDate === SUN
        ? {
            ...block,
            singles: block.singles.map((s) => ({
              ...s,
              baseUnset: true,
              totalIsMinimum: true,
              kg: null,
              kgKnown: 3,
            })),
          }
        : block
    )
    render(<RollsByBakeDay rolls={rolls} {...editProps} />)
    const sunday = within(screen.getByTestId(`rolls-${SUN}`))
    expect(sunday.getByText(/Teig: ≥ 3 kg/)).toBeInTheDocument()
    // ganz unbekannt (Teigstücke offen) bleibt „–“
    const tuesday = within(screen.getByTestId(`rolls-${V2_TUE}`))
    expect(
      tuesday.getByText(/je 250 g · Teigstücke je Stück offen · Teig: – kg/)
    ).toBeInTheDocument()
  })
})
