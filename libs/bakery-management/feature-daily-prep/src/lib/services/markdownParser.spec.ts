import { MarkdownParser } from './markdownParser'
import { PrepSection } from '../types/prepTask'

const table = (rows: string[]): string =>
  [
    '# Daily Preparation Checklist',
    '',
    '## 1. Teigwaren',
    '',
    '### Wagen bestücken',
    '',
    '| Item | Quantity | Tray # |',
    '|------|----------|--------|',
    ...rows,
    '',
  ].join('\n')

describe('MarkdownParser.parseMarkdownPrepFile', () => {
  it('liest eine einzelne Blechnummer', () => {
    const [section] = MarkdownParser.parseMarkdownPrepFile(
      table(['| Testcroissant | 8 | 1 |'])
    )
    expect(section.items).toEqual([
      { name: 'Testcroissant', quantity: 8, completed: false, tray_number: 1 },
    ])
  })

  it('löst einen Bereich wie 11-13 in Blechnummern auf', () => {
    const [section] = MarkdownParser.parseMarkdownPrepFile(
      table(['| Testgebäck | 15 | 11-13 |'])
    )
    expect(section.items?.[0].tray_numbers).toEqual([11, 12, 13])
    expect(section.items?.[0].tray_number).toBeUndefined()
  })

  it('setzt keine Blechfelder, wenn die dritte Spalte fehlt', () => {
    const [section] = MarkdownParser.parseMarkdownPrepFile(
      table(['| Testbrötchen | 6 |', '| Testschnecke | 4 | |'])
    )
    expect(section.items).toHaveLength(2)
    for (const item of section.items ?? []) {
      expect(item).not.toHaveProperty('tray_number')
      expect(item).not.toHaveProperty('tray_numbers')
    }
  })

  it('setzt keine Blechfelder bei unlesbarer dritter Spalte', () => {
    const [section] = MarkdownParser.parseMarkdownPrepFile(
      table(['| Testtasche | 6 | Wagen |', '| Testplunder | 6 | 9-7 |'])
    )
    for (const item of section.items ?? []) {
      expect(item).not.toHaveProperty('tray_number')
      expect(item).not.toHaveProperty('tray_numbers')
    }
  })
})

describe('MarkdownParser.parseTrayCell', () => {
  it.each([
    ['5', [5]],
    [' 12 ', [12]],
    ['11-13', [11, 12, 13]],
    ['11 - 12', [11, 12]],
    ['11–13', [11, 12, 13]],
    ['', []],
    [undefined, []],
    ['abc', []],
    ['13-11', []],
  ])('%p → %p', (cell, expected) => {
    expect(MarkdownParser.parseTrayCell(cell as string | undefined)).toEqual(
      expected
    )
  })
})

describe('MarkdownParser.convertToMarkdown', () => {
  it('lässt die Blechspalte leer, wenn keine Nummer bekannt ist', () => {
    const sections: PrepSection[] = [
      {
        name: 'Teigwaren',
        completed: false,
        items: [
          { name: 'Ohne Blech', quantity: 3, completed: false },
          { name: 'Leer', quantity: 3, completed: false, tray_numbers: [] },
          { name: 'Eins', quantity: 3, completed: false, tray_number: 4 },
          {
            name: 'Bereich',
            quantity: 3,
            completed: false,
            tray_numbers: [11, 12, 13],
          },
        ],
      },
    ]
    const markdown = MarkdownParser.convertToMarkdown(sections)
    expect(markdown).toContain('| Ohne Blech | 3 |  |')
    expect(markdown).toContain('| Leer | 3 |  |')
    expect(markdown).toContain('| Eins | 3 | 4 |')
    expect(markdown).toContain('| Bereich | 3 | 11-13 |')
    expect(markdown).not.toMatch(/undefined|NaN/)
  })

  it('überlebt eine Rundreise durch Parser und Serialisierer', () => {
    const source = table([
      '| Testcroissant | 8 | 1 |',
      '| Testgebäck | 15 | 11-13 |',
      '| Testbrötchen | 6 |',
    ])
    const sections = MarkdownParser.parseMarkdownPrepFile(source)
    const again = MarkdownParser.parseMarkdownPrepFile(
      MarkdownParser.convertToMarkdown(sections)
    )
    expect(again[0].items).toEqual(sections[0].items)
  })
})
