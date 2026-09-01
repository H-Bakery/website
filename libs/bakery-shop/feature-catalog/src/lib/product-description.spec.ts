import { parseDescription } from './product-description'

describe('parseDescription', () => {
  it('macht aus einem Absatz genau einen Block', () => {
    expect(parseDescription('Ein Satz.\nUnd noch einer.')).toEqual([
      { kind: 'paragraph', text: 'Ein Satz. Und noch einer.' },
    ])
  })

  it('erkennt Zwischenüberschriften und Aufzählungen', () => {
    const blocks = parseDescription(
      'Vorwort.\n\n## Zutaten\n- Mehl\n- Wasser\n\n**Hinweis:** Enthält Gluten.'
    )

    expect(blocks).toEqual([
      { kind: 'paragraph', text: 'Vorwort.' },
      { kind: 'heading', text: 'Zutaten' },
      { kind: 'list', items: ['Mehl', 'Wasser'] },
      { kind: 'paragraph', text: 'Hinweis: Enthält Gluten.' },
    ])
  })

  it('liefert für leeren Text keine Blöcke', () => {
    expect(parseDescription('')).toEqual([])
    expect(parseDescription('   \n\n  ')).toEqual([])
  })
})
