/**
 * hq-products.core.js (B5) - reine Regeln für Lesen und Schreiben der
 * Produktdateien. Synthetische Produkte, keine Werte aus hq.
 */
const core = require('../../src/services/hq-products.core')
const { parsePrice } = require('../../src/services/product-input.core')

const DATA = {
  id: 'testbrot-500g',
  numeric_id: 7,
  name: 'Testbrot 500g',
  category: 'brot',
  price: 2.5,
  available: true,
  seasonal: false,
  image: '/assets/images/products/brot-rund.svg',
  short_description: 'Ein Testbrot.',
  allergens: ['gluten', 'weizen'],
  allergens_source: 'rezept',
  allergen_recipe: 'Testbrot',
}
const CONTENT = '\n# Testbrot 500g\n\nLanger Text über das Testbrot.\n'

describe('isProductFileName', () => {
  it('takes .md files and skips templates and other files', () => {
    expect(core.isProductFileName('7-testbrot-500g.md')).toBe(true)
    expect(core.isProductFileName('_template.md')).toBe(false)
    expect(core.isProductFileName('README.txt')).toBe(false)
    expect(core.isProductFileName('.7-testbrot.md.123.tmp')).toBe(false)
    expect(core.isProductFileName(undefined)).toBe(false)
  })
})

describe('slugify', () => {
  it('transliterates umlauts and collapses separators', () => {
    expect(core.slugify('Käse-Brötchen 500g')).toBe('kaese-broetchen-500g')
    expect(core.slugify('  Süße Straße!  ')).toBe('suesse-strasse')
    expect(core.slugify('***')).toBe('')
  })
})

describe('stripHeading', () => {
  it('drops the first heading line only', () => {
    expect(core.stripHeading('# Titel\n\nText\n\n## Mehr')).toBe(
      'Text\n\n## Mehr'
    )
    expect(core.stripHeading('Nur Text')).toBe('Nur Text')
  })
})

describe('toHqProduct', () => {
  it('maps frontmatter + body to the mock shape', () => {
    expect(core.toHqProduct(DATA, CONTENT)).toEqual({
      id: 'testbrot-500g',
      numeric_id: 7,
      name: 'Testbrot 500g',
      category: 'brot',
      price: 2.5,
      available: true,
      seasonal: false,
      image: '/assets/images/products/brot-rund.svg',
      short_description: 'Ein Testbrot.',
      allergens: ['gluten', 'weizen'],
      allergens_source: 'rezept',
      allergen_recipe: 'Testbrot',
      description: 'Langer Text über das Testbrot.',
    })
  })

  it('applies the mock defaults and never invents allergens', () => {
    const product = core.toHqProduct(
      { id: 'x', name: 'X', allergens: 'gluten' },
      ''
    )
    expect(product).toMatchObject({
      available: true,
      seasonal: false,
      image: null,
      short_description: '',
      allergens: null,
      allergens_source: null,
      allergen_recipe: null,
      description: '',
    })
  })

  it('falls back to short_description when the body is empty', () => {
    expect(
      core.toHqProduct(
        { id: 'x', name: 'X', short_description: 'Kurz' },
        '# X\n'
      ).description
    ).toBe('Kurz')
  })

  it('returns null without id or name', () => {
    expect(core.toHqProduct({ name: 'X' }, '')).toBeNull()
    expect(core.toHqProduct({ id: 'x' }, '')).toBeNull()
    expect(core.toHqProduct(null, '')).toBeNull()
  })
})

describe('sortProducts / filterByCategory / findProduct', () => {
  const list = [
    { id: 'c', numeric_id: 3, category: 'brot' },
    { id: 'a', numeric_id: 1, category: 'kuchen' },
    { id: 'z', category: 'brot' },
  ]

  it('sorts by numeric_id, missing first, without mutating', () => {
    expect(core.sortProducts(list).map((p) => p.id)).toEqual(['z', 'a', 'c'])
    expect(list[0].id).toBe('c')
  })

  it('filters only by a non-empty string', () => {
    expect(core.filterByCategory(list, 'brot').map((p) => p.id)).toEqual([
      'c',
      'z',
    ])
    expect(core.filterByCategory(list, '')).toBe(list)
    expect(core.filterByCategory(list, undefined)).toBe(list)
  })

  it('an array or object category matches nothing, like the mock', () => {
    expect(core.filterByCategory(list, ['brot', 'kuchen'])).toEqual([])
    expect(core.filterByCategory(list, { a: 'brot' })).toEqual([])
  })

  it('finds by slug, numeric id or numeric string', () => {
    expect(core.findProduct(list, 'a').id).toBe('a')
    expect(core.findProduct(list, 3).id).toBe('c')
    expect(core.findProduct(list, '3').id).toBe('c')
    expect(core.findProduct(list, 'nope')).toBeNull()
    expect(core.findProduct(list, '')).toBeNull()
    expect(core.findProduct(list, null)).toBeNull()
  })
})

describe('applyProductUpdate', () => {
  it('changes only the sent fields and leaves the original untouched', () => {
    const original = { ...DATA }
    const { data, body } = core.applyProductUpdate(
      original,
      CONTENT,
      { price: '3.10', available: false },
      parsePrice
    )
    expect(data).toEqual({ ...DATA, price: 3.1, available: false })
    expect(original).toEqual(DATA)
    expect(body).toBe(CONTENT.trim())
  })

  it('description replaces the body under the (new) heading', () => {
    const { body } = core.applyProductUpdate(
      DATA,
      CONTENT,
      { name: ' Neues Brot ', description: '  Neuer Text.  ' },
      parsePrice
    )
    expect(body).toBe('# Neues Brot\n\nNeuer Text.')
  })

  it('a new name without description retitles in place', () => {
    const { data, body } = core.applyProductUpdate(
      DATA,
      CONTENT,
      { name: 'Umbenannt' },
      parsePrice
    )
    expect(data.name).toBe('Umbenannt')
    expect(body).toBe('# Umbenannt\n\nLanger Text über das Testbrot.')
  })
})

describe('buildNewProduct', () => {
  const existing = [
    { id: 'testbrot-500g', numeric_id: 7 },
    { id: 'zweites', numeric_id: 12 },
  ]

  it('derives id, next numeric_id, file name and defaults', () => {
    const result = core.buildNewProduct(
      { name: 'Käsestange', category: 'snacks', price: '1.20' },
      existing,
      parsePrice
    )
    expect(result).toEqual({
      ok: true,
      data: {
        id: 'kaesestange',
        numeric_id: 13,
        name: 'Käsestange',
        category: 'snacks',
        price: 1.2,
        available: true,
        seasonal: false,
        image: '',
        short_description: '',
      },
      body: '# Käsestange\n\n',
      fileName: '13-kaesestange.md',
    })
  })

  it('refuses a duplicate id (409) and a name without slug (400)', () => {
    expect(
      core.buildNewProduct(
        { name: 'Testbrot 500g', category: 'brot', price: 1 },
        existing,
        parsePrice
      )
    ).toMatchObject({ ok: false, status: 409, error: 'product_exists' })
    expect(
      core.buildNewProduct(
        { name: '!!!', category: 'brot', price: 1 },
        existing,
        parsePrice
      )
    ).toMatchObject({ ok: false, status: 400, error: 'invalid_id' })
  })

  it('starts at 1 in an empty catalogue', () => {
    expect(
      core.buildNewProduct(
        { name: 'A', category: 'brot', price: 1 },
        [],
        parsePrice
      ).fileName
    ).toBe('1-a.md')
  })
})

describe('writeResponse', () => {
  it('is frontmatter plus description without heading', () => {
    expect(core.writeResponse({ id: 'x' }, '# X\n\nText')).toEqual({
      id: 'x',
      description: 'Text',
    })
  })
})

describe('commit message and co-author trailer', () => {
  it('names the product and credits the editor', () => {
    expect(
      core.commitMessage(
        'update',
        { id: 'testbrot-500g', name: 'Testbrot 500g' },
        { id: 7, username: 'test.inhaber', displayName: 'Test Inhaber' }
      )
    ).toBe(
      'products: Testbrot 500g (testbrot-500g) geändert\n\n' +
        'Co-authored-by: Test Inhaber <user-7@bakery.local>\n'
    )
    expect(
      core.commitMessage('create', { id: 'a', name: 'A' }, { username: 'x' })
    ).toMatch(
      /^products: A \(a\) angelegt\n\nCo-authored-by: unbekannt <unbekannt@bakery.local>\n$/
    )
  })

  it('cannot be broken by newlines or angle brackets in names', () => {
    const trailer = core.coAuthorTrailer({
      id: 12,
      username: 'Böse User\n',
      displayName: 'Evil <x@y>\nCo-authored-by: Fake <f@f>',
    })
    expect(trailer.split('\n')).toHaveLength(1)
    expect(trailer).toBe(
      'Co-authored-by: Evil x@y Co-authored-by: Fake f@f <user-12@bakery.local>'
    )
    expect(core.coAuthorTrailer({})).toBe(
      'Co-authored-by: unbekannt <unbekannt@bakery.local>'
    )
  })

  it('never writes the login (D13): the mail carries the user id only', () => {
    const trailer = core.coAuthorTrailer({
      id: 3,
      username: 'test.geheimlogin',
      displayName: 'Test Person',
    })
    expect(trailer).toBe('Co-authored-by: Test Person <user-3@bakery.local>')
    expect(trailer).not.toContain('geheimlogin')
    // no display name: never fall back to the login
    expect(core.coAuthorTrailer({ id: 4, username: 'test.login' })).toBe(
      'Co-authored-by: unbekannt <user-4@bakery.local>'
    )
    expect(core.coAuthorTrailer({ id: 'x', username: 'a' })).toContain(
      '<unbekannt@bakery.local>'
    )
  })

  it('uses the fixed app author', () => {
    expect(core.APP_AUTHOR).toEqual({
      name: 'Verwaltung (App)',
      email: 'verwaltung@bakery.local',
    })
  })
})

describe('roundTripsAs / sameValue', () => {
  const data = {
    id: 'testbrot',
    name: 'Testbrot',
    price: 1.5,
    allergens: ['gluten'],
  }

  it('accepts a parse that equals the intended frontmatter and body', () => {
    expect(
      core.roundTripsAs(
        {
          data: {
            allergens: ['gluten'],
            price: 1.5,
            name: 'Testbrot',
            id: 'testbrot',
          },
          content: '\n# Testbrot\n',
        },
        data,
        '# Testbrot'
      )
    ).toBe(true)
  })

  it('rejects a failed parse, changed values, types, body or a non-product', () => {
    expect(core.roundTripsAs(null, data, '# T')).toBe(false)
    expect(
      core.roundTripsAs(
        { data: { ...data, name: 1000 }, content: '' },
        { ...data, name: '1e3' },
        ''
      )
    ).toBe(false)
    expect(
      core.roundTripsAs(
        { data: { ...data, extra: 'x' }, content: '' },
        data,
        ''
      )
    ).toBe(false)
    expect(core.roundTripsAs({ data, content: '# A' }, data, '# B')).toBe(false)
    const noName = { id: 'x' }
    expect(core.roundTripsAs({ data: noName, content: '' }, noName, '')).toBe(
      false
    )
  })

  it('compares dates by time and NaN with NaN', () => {
    expect(core.sameValue(new Date(0), new Date(0))).toBe(true)
    expect(core.sameValue(new Date(0), new Date(0).toString())).toBe(false)
    expect(core.sameValue(NaN, NaN)).toBe(true)
    expect(core.sameValue([1, 2], [1, 2, 3])).toBe(false)
  })
})
