import React from 'react'
import { render, screen, within } from '@testing-library/react'
import RecipeText, { parseRecipeText } from './RecipeText'

describe('RecipeText - Markdown-Text eines Rezepts', () => {
  it('Stichpunkte mit **fett**', () => {
    render(
      <RecipeText
        text={'- **Haltbarkeit:** 5 Tage\n- **Lagerung:** Im Leinenbeutel'}
      />
    )
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Haltbarkeit: 5 Tage')
    expect(within(items[0]).getByText('Haltbarkeit:').tagName).toBe('STRONG')
  })

  it('ein Schritt mit eingerückten Unterpunkten', () => {
    render(
      <RecipeText
        text={
          'Laibe formen:\n   - straff aufrollen\n   - Naht nach unten legen'
        }
      />
    )
    expect(screen.getByText('Laibe formen:').tagName).toBe('P')
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      ['straff aufrollen', 'Naht nach unten legen']
    )
  })

  it('verschachtelte und nummerierte Listen, Kästchen ohne „[ ]“', () => {
    const blocks = parseRecipeText(
      '1. Erstens\n2. Zweitens\n   - darunter\n\n- [ ] 100 g Probemehl\n- [x] erledigt'
    )
    expect(blocks).toEqual([
      {
        kind: 'list',
        ordered: true,
        items: [
          { text: 'Erstens', children: [] },
          {
            text: 'Zweitens',
            children: [
              {
                kind: 'list',
                ordered: false,
                items: [{ text: 'darunter', children: [] }],
              },
            ],
          },
        ],
      },
      {
        kind: 'list',
        ordered: false,
        items: [
          { text: '100 g Probemehl', children: [] },
          { text: 'erledigt', children: [] },
        ],
      },
    ])
  })

  it('Tabelle mit Kopf, Ausrichtung und Summenzeile', () => {
    render(
      <RecipeText
        text={
          '| Zutat | Original (g) |\n| --- | ---: |\n| Wasser | 3 000 |\n| **Summe** | **8 242,5** |\n\n- Erfundene Abweichung. OFFEN.\n\nAblauf: fehlt noch.'
        }
      />
    )
    const table = screen.getByRole('table')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((c) => c.textContent)
    ).toEqual(['Zutat', 'Original (g)'])
    const cells = within(table).getAllByRole('cell')
    expect(cells.map((c) => c.textContent)).toEqual([
      'Wasser',
      '3 000',
      'Summe',
      '8 242,5',
    ])
    expect(cells[1]).toHaveStyle({ textAlign: 'right' })
    expect(screen.getByText('Erfundene Abweichung. OFFEN.')).toBeInTheDocument()
    expect(screen.getByText('Ablauf: fehlt noch.')).toBeInTheDocument()
  })

  it('Zwischenüberschriften und Absätze bleiben als Text - nichts fällt weg', () => {
    render(
      <RecipeText
        text={'### Hinweis\nErste Zeile\nzweite Zeile\n\nNeuer Absatz'}
      />
    )
    expect(screen.getByText('Hinweis').tagName).toBe('STRONG')
    expect(screen.getByText(/Erste Zeile/)).toHaveTextContent(
      'Erste Zeilezweite Zeile'
    )
    expect(screen.getByText('Neuer Absatz')).toBeInTheDocument()
  })

  it('führt kein HTML aus dem Text aus', () => {
    const { container } = render(
      <RecipeText text={'<img src=x onerror="alert(1)"> <b>fett</b>'} />
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container).toHaveTextContent(
      '<img src=x onerror="alert(1)"> <b>fett</b>'
    )
  })
})
