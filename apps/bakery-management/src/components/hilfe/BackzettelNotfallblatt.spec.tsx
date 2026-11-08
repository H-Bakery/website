import React from 'react'
import { render } from '@testing-library/react'
import BackzettelNotfallblatt, {
  FALLBACK_SECTIONS,
  NOTFALL_COLS_MM,
  notfallLayout,
  notfallPostenWidthMm,
  notfallSections,
} from './BackzettelNotfallblatt'
import { TEST_CONFIG } from '../../lib/backzettelFixtures'

describe('Backzettel-Notfallblatt (P6)', () => {
  it('ohne Stammdaten: Standard-Abschnitte mit leeren Zeilen', () => {
    const sections = notfallSections(null)
    expect(sections.map((s) => s.id)).toEqual([...FALLBACK_SECTIONS])
    expect(sections.every((s) => s.rows.every((row) => row === ''))).toBe(true)
    expect(sections[0].label).toBe('Brot')
  })

  it('mit Stammdaten: Posten je Abschnitt, Sorten als eigene Zeilen, eine Leerzeile', () => {
    const sections = notfallSections(TEST_CONFIG)
    expect(sections.map((s) => [s.label, s.rows])).toEqual([
      ['Brot', ['Testkornbrot', '']],
      ['Brötchen', ['Testweck', '']],
      [
        'Hefeteig',
        [
          'Testzopf gefüllt – Testnussfüllung',
          'Testzopf gefüllt – Testmohnfüllung',
          '',
        ],
      ],
    ])
  })

  it('lässt „Vorbereitung“ und leere Abschnitte weg', () => {
    const sections = notfallSections({
      ...TEST_CONFIG,
      sections: ['vorbereitung', 'brot', 'kuchen'],
    })
    expect(sections.map((s) => s.id)).toEqual(['brot'])
  })

  const sectionsWith = (rows: number, count = 6) =>
    Array.from({ length: count }, (_, i) => ({
      id: `s${i}`,
      label: `S${i}`,
      rows: Array.from({ length: Math.ceil(rows / count) }, () => 'x'),
    }))

  it('wenige Zeilen: zwei Spalten, höchstens 7 mm hoch', () => {
    expect(notfallLayout(sectionsWith(12))).toEqual({
      columns: 2,
      rowHeightMm: 7,
    })
  })

  it('so viele Zeilen wie die echte YAML (~60): zwei Spalten, 4-7 mm', () => {
    const layout = notfallLayout(sectionsWith(62))
    expect(layout.columns).toBe(2)
    expect(layout.rowHeightMm).toBeGreaterThanOrEqual(4)
    expect(layout.rowHeightMm).toBeLessThanOrEqual(7)
    // passt: Zeilen + Kopf je Abschnitt ≤ 2 Spalten à 190 mm
    expect(66 * layout.rowHeightMm + 6 * 10).toBeLessThanOrEqual(2 * 190)
  })

  it('sehr viele Zeilen: drei Spalten statt einer zweiten Seite', () => {
    const layout = notfallLayout(sectionsWith(100))
    expect(layout.columns).toBe(3)
    expect(layout.rowHeightMm).toBeGreaterThanOrEqual(4)
  })
})

describe('Notfallblatt: Abschnittsname wiederholt sich beim Spaltenumbruch (W4-verify r4)', () => {
  it('steht in der Tabellenkopfzeile jedes Abschnitts', () => {
    const { container } = render(
      <BackzettelNotfallblatt config={TEST_CONFIG} />
    )
    const tables = Array.from(container.querySelectorAll('.nfb-section table'))
    expect(tables.length).toBe(notfallSections(TEST_CONFIG).length)
    tables.forEach((table, i) => {
      const firstHeadRow = table.querySelector('thead tr')
      expect(firstHeadRow?.textContent).toBe(
        notfallSections(TEST_CONFIG)[i].label
      )
    })
  })
})

describe('Notfallblatt: Leerzeile bleibt beim Abschnitt (Z10 Review)', () => {
  it('die Leerzeile nach den Posten bricht nicht allein in die nächste Spalte', () => {
    const { container } = render(
      <BackzettelNotfallblatt config={TEST_CONFIG} />
    )
    const tables = Array.from(container.querySelectorAll('.nfb-section table'))
    tables.forEach((table) => {
      const rows = Array.from(table.querySelectorAll('tbody tr'))
      const last = rows[rows.length - 1]
      expect(last.textContent).toBe('')
      expect(last).toHaveClass('nfb-blank')
      expect(rows[0]).not.toHaveClass('nfb-blank')
    })
    // Ohne Stammdaten sind alle Zeilen leer - dort darf alles umbrechen.
    const { container: empty } = render(
      <BackzettelNotfallblatt config={null} />
    )
    expect(empty.querySelectorAll('tr.nfb-blank')).toHaveLength(0)
  })
})

describe('Notfallblatt: Posten stehen ganz da (W4-verify r5)', () => {
  it('Spaltenbreiten per <colgroup>, nicht über die erste Zeile (die ist die Überschrift)', () => {
    const { container } = render(
      <BackzettelNotfallblatt config={TEST_CONFIG} />
    )
    const table = container.querySelector('.nfb-section table')!
    expect(table.firstElementChild?.tagName).toBe('COLGROUP')
    const widths = Array.from(table.querySelectorAll('col')).map(
      (c) => (c as HTMLElement).style.width
    )
    expect(widths).toEqual([
      '',
      `${NOTFALL_COLS_MM.basis}mm`,
      `${NOTFALL_COLS_MM.vorb}mm`,
      `${NOTFALL_COLS_MM.gesamt}mm`,
      `${NOTFALL_COLS_MM.tick}mm`,
    ])
    const cell = Array.from(container.querySelectorAll('tbody td')).find(
      (td) => td.textContent === 'Testzopf gefüllt – Testnussfüllung'
    )
    expect(cell?.className).toBe('posten')
  })

  it('zwei Spalten: die Postenspalte fasst „Kranz gefüllt – Mohnfüllung“ in 9 pt', () => {
    // 27 Zeichen à ~1,75 mm
    expect(notfallPostenWidthMm(2)).toBeGreaterThanOrEqual(27 * 1.75)
  })

  it('lange Namen zählen in der Zeilenhöhe doppelt, damit alles auf eine Seite passt', () => {
    const long =
      'Sehr langer Postenname – mit einer Sorte, die umbricht'.repeat(2)
    const short = notfallLayout([{ id: 'a', label: 'A', rows: ['x'] }])
    const wrapped = notfallLayout([{ id: 'a', label: 'A', rows: [long] }])
    expect(wrapped.columns).toBe(2)
    expect(short.rowHeightMm).toBe(7)
    const many = (row: string) =>
      notfallLayout([
        { id: 'a', label: 'A', rows: Array.from({ length: 50 }, () => row) },
      ])
    expect(many(long).rowHeightMm).toBeLessThan(many('x').rowHeightMm)
  })
})
