const matter = require('gray-matter')
const { serializeProductFile } = require('../../src/services/product-file.core')

/**
 * Ein Produktdatei-Inhalt so, wie er in hq/products/ wirklich steht -
 * inklusive der Inline-Liste, die eine spaetere Allergen-Erfassung ergaenzt.
 */
const FILE = `---
id: kornbrot-500g
numeric_id: 1
name: Kornbrot 500g
category: brot
price: 2.5
available: true
seasonal: false
image: "/assets/images/products/kornbrot.svg"
short_description: "Kernig & saftig — unser Kornbrot mit vollem Getreidegeschmack."
allergens: [gluten, roggen, sesam, weizen]
allergens_source: rezept
allergen_recipe: Kornbrot
---

# Kornbrot 500g

Ein kraeftiges Mischbrot mit ganzen Koernern.
`

/** Speichern ohne Aenderung: parsen und unveraendert zurueckschreiben. */
function roundTrip(raw) {
  const parsed = matter(raw)
  return serializeProductFile(parsed.data, parsed.content)
}

describe('serializeProductFile', () => {
  it('schreibt eine unveraenderte Datei Byte fuer Byte zurueck', () => {
    expect(roundTrip(FILE)).toBe(FILE)
  })

  it('behaelt Inline-Listen als Inline-Listen', () => {
    // Der eigentliche Regressionsschutz: Block-Syntax (`- gluten` je Zeile)
    // wuerde aus jedem Speichern einen Mehrzeilen-Diff in hq machen.
    const out = roundTrip(FILE)
    expect(out).toContain('allergens: [gluten, roggen, sesam, weizen]')
    expect(out).not.toContain('  - gluten')
  })

  it('haelt die feste Schluesselreihenfolge ein', () => {
    const shuffled = {
      short_description: 'Teaser',
      name: 'Testbrot',
      id: 'testbrot',
      price: 1.5,
      numeric_id: 99,
      category: 'brot',
    }
    const lines = serializeProductFile(shuffled, '# Testbrot').split('\n')
    // Nur der Frontmatter-Block zwischen den beiden `---`-Zeilen.
    const keys = lines
      .slice(1, lines.indexOf('---', 1))
      .map((line) => line.split(':')[0])
    expect(keys).toEqual([
      'id',
      'numeric_id',
      'name',
      'category',
      'price',
      'short_description',
    ])
  })

  it('haengt unbekannte Schluessel hinten an, statt sie zu verlieren', () => {
    // Andere Sessions ergaenzen das Frontmatter (z. B. Allergene). Ein Speichern
    // aus der Verwaltung darf solche Felder nicht stillschweigend loeschen.
    const out = serializeProductFile(
      { id: 'x', name: 'X', allergens: ['gluten'], allergen_recipe: 'X' },
      '# X'
    )
    expect(out).toContain('allergens: [gluten]')
    expect(out).toContain('allergen_recipe: X')
  })

  it('setzt image und short_description immer in Anfuehrungszeichen', () => {
    const out = serializeProductFile(
      { id: 'x', image: '/a/b.svg', short_description: 'Kurz' },
      '# X'
    )
    expect(out).toContain('image: "/a/b.svg"')
    expect(out).toContain('short_description: "Kurz"')
  })

  it('quotet Listenelemente, die ein Komma enthalten', () => {
    const out = serializeProductFile({ id: 'x', tags: ['a,b', 'c'] }, '# X')
    expect(out).toContain('tags: ["a,b", c]')
    expect(matter(out).data.tags).toEqual(['a,b', 'c'])
  })
})
