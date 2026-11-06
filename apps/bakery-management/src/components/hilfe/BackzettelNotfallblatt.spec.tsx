import React from 'react'
import { render } from '@testing-library/react'
import BackzettelNotfallblatt, {
  FALLBACK_SECTIONS,
  notfallLayout,
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
