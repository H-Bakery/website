/**
 * Tests für die Prüfung der Produktdaten (`PUT`/`POST /api/hq-products`).
 *
 * Der Core ist dependency-frei - dieser Test braucht keine Mocks. Was hier
 * abgelehnt wird, erreicht `serializeProductFile` nie; die Datei in `hq`
 * bleibt unangetastet.
 */

const {
  MESSAGES,
  PRODUCT_CATEGORIES,
  parsePrice,
  validateProductInput,
} = require('../../src/services/product-input.core')

const partial = (body) => validateProductInput(body, { partial: true })
const full = (body) => validateProductInput(body, { partial: false })

const validProduct = {
  name: 'Kornbrot 500g',
  category: 'brot',
  price: '3.50',
  short_description: 'Kräftiges Roggenmischbrot',
  description: 'Aus dem Holzofen.',
  image: '/assets/images/products/kornbrot.svg',
  available: true,
  seasonal: false,
}

describe('validateProductInput (partial, PUT)', () => {
  it('lässt einen leeren Body und gültige Teiländerungen durch', () => {
    expect(partial({})).toBeNull()
    expect(partial(undefined)).toBeNull()
    expect(
      partial({ price: '2.5', category: 'brot', available: false })
    ).toBeNull()
    expect(partial({ name: 'Neuer Name', seasonal: true })).toBeNull()
    expect(partial({ price: 0 })).toBeNull()
  })

  it.each([['abc'], ['2abc'], [-1], [Infinity], [''], ['  '], [null], [{}]])(
    'lehnt den Preis %p ab',
    (price) => {
      expect(partial({ price })).toBe(MESSAGES.price)
    }
  )

  it.each([[''], ['   '], ['a\nb'], ['a\r\nb'], [42], [null]])(
    'lehnt den Namen %p ab',
    (name) => {
      expect(partial({ name })).toBe(MESSAGES.name)
    }
  )

  it('lehnt unbekannte Kategorien ab und kennt genau die sieben aus hq', () => {
    expect(partial({ category: 'foo' })).toBe(MESSAGES.category)
    expect(partial({ category: 'Brot' })).toBe(MESSAGES.category)
    expect(partial({ category: '' })).toBe(MESSAGES.category)
    expect(PRODUCT_CATEGORIES).toEqual([
      'brot',
      'broetchen',
      'baguette',
      'teilchen',
      'snacks',
      'kuchen',
      'torten',
    ])
    for (const category of PRODUCT_CATEGORIES) {
      expect(partial({ category })).toBeNull()
    }
  })

  it('verlangt echte Booleans für available und seasonal', () => {
    expect(partial({ available: 'yes' })).toBe(MESSAGES.flag)
    expect(partial({ seasonal: 'nein' })).toBe(MESSAGES.flag)
    expect(partial({ available: 1 })).toBe(MESSAGES.flag)
    expect(partial({ available: true, seasonal: false })).toBeNull()
  })

  it('verlangt Strings für Texte und Bildpfad', () => {
    expect(partial({ short_description: 5 })).toBe(MESSAGES.text)
    expect(partial({ image: ['x'] })).toBe(MESSAGES.text)
    expect(partial({ description: {} })).toBe(MESSAGES.text)
  })
})

describe('validateProductInput (full, POST)', () => {
  it('verlangt Name, Kategorie und Preis', () => {
    expect(full({})).toBe(MESSAGES.name)
    expect(full({ name: 'Brezel' })).toBe(MESSAGES.categoryRequired)
    expect(full({ name: 'Brezel', category: 'foo' })).toBe(MESSAGES.category)
    expect(full({ name: 'Brezel', category: 'broetchen' })).toBe(MESSAGES.price)
  })

  it('nimmt ein vollständiges Produkt an', () => {
    expect(full(validProduct)).toBeNull()
    expect(
      full({ name: 'Brezel', category: 'broetchen', price: 0.9 })
    ).toBeNull()
  })
})

describe('parsePrice', () => {
  it('rechnet wie Number, nicht wie parseFloat', () => {
    expect(parsePrice('3.50')).toBe(3.5)
    expect(parsePrice(2)).toBe(2)
    expect(Number.isNaN(parsePrice('2abc'))).toBe(true)
    expect(Number.isNaN(parsePrice(''))).toBe(true)
    expect(Number.isNaN(parsePrice(null))).toBe(true)
  })
})
