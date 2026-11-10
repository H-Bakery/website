import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MachineStrip, machineHints } from './MachineStrip'
import { OpenMasterDataNote } from './OpenMasterDataNote'
import { BreadTable } from './BreadTable'
import { batchText } from './HefeteigCard'
import { batchesText } from '../../lib/backzettelFormat'
import { RollsByBakeDay, linesByKey, v2CoveredKeys } from './RollsByBakeDay'
import { BackzettelSectionView } from './BackzettelSectionView'
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
    expect(
      within(screen.getByTestId('machine-test-korn-teig')).getByText(
        'Testkorn 7,8 kg · Testholz 3,6 kg'
      )
    ).toBeInTheDocument()
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
