import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MachineStrip, machineHints } from './MachineStrip'
import { OpenMasterDataNote } from './OpenMasterDataNote'
import { BreadTable } from './BreadTable'
import { RollsByBakeDay, linesByKey, v2CoveredKeys } from './RollsByBakeDay'
import {
  SAT,
  SUN,
  TEST_CONFIG_V2,
  V2_TUE,
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
