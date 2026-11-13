/**
 * price-list.core.js - Gruppieren, Sortieren, Formatieren der Preisliste.
 * Synthetische Produkte und Preise, keine Werte aus hq.
 */
const core = require('../../src/services/price-list.core')

const NBSP = '\u00a0'

let nextId = 1
function product(name, category, price, extra = {}) {
  const numeric_id = extra.numeric_id ?? nextId++
  return {
    id: `p-${numeric_id}`,
    numeric_id,
    name,
    category,
    price,
    available: true,
    seasonal: false,
    allergens: null,
    ...extra,
  }
}

const CATALOGUE = [
  product('Testtorte Sahne', 'torten', 32),
  product('Musterbrot 500g', 'brot', 2.5, { allergens: ['weizen', 'gluten'] }),
  product('Musterbrot 1000g', 'brot', 4.4, { allergens: ['gluten', 'weizen'] }),
  product('Probekruste 750g', 'brot', 3.9),
  product('Musterweck', 'broetchen', 0.45),
  product('Musterbaguette klein', 'baguette', 1.5),
  product('Musterbaguette groß', 'baguette', 2.6),
  product('Testkasten klein', 'baguette', 2.8),
  product('Musterkuchen', 'kuchen', 14),
  product('Musterkuchen (1 Stück)', 'kuchen', 1.6),
  product('Probekranz (1/4 Stück)', 'kuchen', 4.5),
  product('Testschnecke', 'teilchen', 1.7, { available: false }),
  product('Probeplunder', 'teilchen', undefined),
  product('Testtasche', 'teilchen', 0),
  product('Saisonstollen', 'kuchen', 9.95, { seasonal: true }),
]

const build = (options = {}) =>
  core.buildPriceList(CATALOGUE, { today: '2026-11-13', ...options })
const category = (doc, key) => doc.categories.find((c) => c.key === key)

describe('formatPrice', () => {
  it('fills up to two decimals and never rounds', () => {
    expect(core.formatPrice(2.5)).toBe(`2,50${NBSP}€`)
    expect(core.formatPrice(45)).toBe(`45,00${NBSP}€`)
    expect(core.formatPrice(1.89)).toBe(`1,89${NBSP}€`)
    expect(core.formatPrice(0.85)).toBe(`0,85${NBSP}€`)
    expect(core.formatPrice(1234.5)).toBe(`1.234,50${NBSP}€`)
    // gespeichert mit drei Stellen: bleibt stehen, wird nicht 1,90
    expect(core.formatPrice(1.895)).toBe(`1,895${NBSP}€`)
  })
})

describe('readPrice', () => {
  it('takes numbers and numeric text, nothing else', () => {
    expect(core.readPrice(3.5)).toBe(3.5)
    expect(core.readPrice('3.5')).toBe(3.5)
    expect(core.readPrice('3,5')).toBe(3.5)
    for (const bad of [undefined, null, '', 'abc', 0, -1, NaN, [], {}]) {
      expect(core.readPrice(bad)).toBeNull()
    }
  })
})

describe('isIsoDate / formatDate', () => {
  it('accepts real calendar days only', () => {
    expect(core.isIsoDate('2026-12-01')).toBe(true)
    expect(core.isIsoDate('2026-02-30')).toBe(false)
    expect(core.isIsoDate('01.12.2026')).toBe(false)
    expect(core.isIsoDate(20261201)).toBe(false)
    expect(core.formatDate('2026-12-01')).toBe('01.12.2026')
    expect(core.formatDate('quatsch')).toBe('')
  })
})

describe('splitName', () => {
  it('splits weight, piece and size from the name', () => {
    expect(core.splitName('Musterbrot 500g')).toMatchObject({
      base: 'Musterbrot',
      weight: `500${NBSP}g`,
      grams: 500,
    })
    expect(core.splitName('Musterbrot 1,5 kg')).toMatchObject({
      base: 'Musterbrot',
      weight: `1,5${NBSP}kg`,
      grams: 1500,
    })
    expect(core.splitName('Musterkuchen (1 Stück)')).toMatchObject({
      base: 'Musterkuchen',
      piece: 'Stück',
    })
    expect(core.splitName('Probekranz groß (1/4 Stück)')).toMatchObject({
      base: 'Probekranz',
      baseWithSize: 'Probekranz groß',
      size: 'groß',
      piece: `¼${NBSP}Stück`,
    })
    expect(core.splitName('Kleine Musterweck')).toMatchObject({
      base: 'Kleine Musterweck',
      size: null,
      weight: null,
      piece: null,
    })
  })
})

describe('buildPriceList', () => {
  it('orders categories like the template and keeps hq order inside', () => {
    const doc = build()
    expect(doc.status).toBe('ok')
    expect(doc.categories.map((c) => c.key)).toEqual([
      'brot',
      'broetchen',
      'baguette',
      'kuchen',
      'torten',
    ])
    expect(category(doc, 'brot').rows.map((r) => r.name)).toEqual([
      'Musterbrot',
      'Probekruste',
    ])
    expect(doc.generatedOnText).toBe('13.11.2026')
    expect(doc.title).toBe('Preisliste')
  })

  it('puts unknown categories after the known ones', () => {
    const doc = core.buildPriceList([
      product('A', 'zzz-neu', 1),
      product('B', 'torten', 1),
      product('C', 'eis', 1),
    ])
    expect(doc.categories.map((c) => c.label)).toEqual([
      'Torten',
      'Eis',
      'Zzz-neu',
    ])
  })

  it('groups weight variants into a matrix, sorted by weight', () => {
    const brot = category(build(), 'brot')
    expect(brot.layout).toBe('matrix')
    expect(brot.columns).toEqual([`500${NBSP}g`, `750${NBSP}g`, `1000${NBSP}g`])
    expect(brot.rows[0].variants.map((v) => [v.label, v.priceText])).toEqual([
      [`500${NBSP}g`, `2,50${NBSP}€`],
      [`1000${NBSP}g`, `4,40${NBSP}€`],
    ])
    expect(brot.count).toBe(3)
  })

  it('treats klein/groß as a variant only with a sibling', () => {
    const baguette = category(build(), 'baguette')
    expect(baguette.layout).toBe('list')
    expect(baguette.rows.map((r) => r.name)).toEqual([
      'Musterbaguette',
      'Testkasten klein',
    ])
    expect(baguette.rows[0].variants.map((v) => v.label)).toEqual([
      'klein',
      'groß',
    ])
    expect(baguette.rows[1].variants[0].label).toBe('')
  })

  it('groups a cake with its piece and invents no unit for the whole one', () => {
    const kuchen = category(build(), 'kuchen')
    const cake = kuchen.rows.find((r) => r.name === 'Musterkuchen')
    expect(cake.variants.map((v) => v.label)).toEqual(['', 'Stück'])
    const kranz = kuchen.rows.find((r) => r.name === 'Probekranz')
    expect(kranz.variants.map((v) => v.label)).toEqual([`¼${NBSP}Stück`])
  })

  it('leaves products without a price out and names them', () => {
    const doc = build({ includeUnavailable: true })
    expect(doc.omitted.noPrice.map((p) => p.name)).toEqual([
      'Probeplunder',
      'Testtasche',
    ])
    expect(doc.counts.noPrice).toBe(2)
    const names = doc.categories.flatMap((c) => c.rows.map((r) => r.name))
    expect(names).not.toContain('Probeplunder')
    expect(names).not.toContain('Testtasche')
    expect(JSON.stringify(doc.categories)).not.toMatch(/auf Anfrage|0,00/)
  })

  it('hides unavailable products unless asked, and counts them', () => {
    const hidden = build()
    expect(category(hidden, 'teilchen')).toBeUndefined()
    expect(hidden.counts.hiddenUnavailable).toBe(1)

    const shown = build({ includeUnavailable: true })
    const row = category(shown, 'teilchen').rows[0]
    expect(row.name).toBe('Testschnecke')
    expect(row.unavailable).toBe(true)
    expect(shown.counts.hiddenUnavailable).toBe(0)
  })

  it('filters by category and still offers every category', () => {
    const doc = build({ categories: ['kuchen', 'brot'] })
    expect(doc.categories.map((c) => c.key)).toEqual(['brot', 'kuchen'])
    expect(doc.options.categories).toEqual(['brot', 'kuchen'])
    expect(doc.availableCategories.map((c) => c.key)).toContain('torten')
  })

  it('reports no-data instead of an empty list', () => {
    expect(build({ categories: ['gibt-es-nicht'] }).status).toBe('no-data')
    expect(core.buildPriceList([]).status).toBe('no-data')
  })

  it('carries valid-from only when it is a date', () => {
    expect(build({ validFrom: '2026-12-01' }).validFromText).toBe('01.12.2026')
    expect(build({ validFrom: 'bald' }).validFrom).toBeNull()
  })

  it('flags prices with more than two decimals instead of rounding', () => {
    const doc = core.buildPriceList([product('Krummpreis', 'brot', 1.895)])
    expect(doc.categories[0].rows[0].variants[0].priceText).toBe(
      `1,895${NBSP}€`
    )
    expect(doc.dataWarnings).toHaveLength(1)
    expect(doc.dataWarnings[0].code).toBe('price_decimals')
  })

  describe('allergens', () => {
    const text = (keys) => `[${[...keys].sort().join('+')}]`

    it('are absent unless asked for', () => {
      expect(category(build(), 'brot').rows[0].allergens).toBeNull()
    })

    it('state once what all variants share', () => {
      const doc = build({ withAllergens: true, allergenText: text })
      expect(category(doc, 'brot').rows[0].allergens).toEqual({
        declared: true,
        text: '[gluten+weizen]',
        partial: false,
      })
    })

    it('never turn a missing declaration into "none"', () => {
      const doc = build({ withAllergens: true, allergenText: text })
      expect(category(doc, 'brot').rows[1].allergens).toEqual({
        declared: false,
        text: null,
        partial: false,
      })
      const empty = core.buildPriceList(
        [product('Leerliste', 'brot', 2, { allergens: [] })],
        { withAllergens: true, allergenText: text }
      )
      expect(empty.categories[0].rows[0].allergens.declared).toBe(false)
    })

    it('list differing variants separately, never as a union', () => {
      const doc = core.buildPriceList(
        [
          product('Zweierlei 500g', 'brot', 2, { allergens: ['weizen'] }),
          product('Zweierlei 750g', 'brot', 3, { allergens: ['roggen'] }),
          product('Halboffen 500g', 'brot', 2, { allergens: ['weizen'] }),
          product('Halboffen 750g', 'brot', 3),
        ],
        { withAllergens: true, allergenText: text }
      )
      const [two, half] = doc.categories[0].rows
      expect(two.allergens.text).toBe(
        `500${NBSP}g: [weizen]; 750${NBSP}g: [roggen]`
      )
      expect(half.allergens.text).toBe(
        `500${NBSP}g: [weizen]; 750${NBSP}g: Angabe offen`
      )
      expect(half.allergens.partial).toBe(true)
    })
  })

  describe('partner list', () => {
    const partner = {
      id: 7,
      name: 'Testmarkt Musterstadt',
      street: 'Musterweg 1',
      zip: '00000',
      city: 'Musterstadt',
      settlementModel: 'commission',
      assortmentSource: 'templates',
    }

    it('shows only the assortment, by slug or numeric id', () => {
      const doc = build({
        audience: 'partner',
        partner,
        assortment: {
          slugs: [CATALOGUE[1].id, 'gibt-es-nicht-mehr'],
          numericIds: [CATALOGUE[4].numeric_id],
        },
      })
      expect(doc.title).toBe('Preisliste für Partner')
      expect(doc.categories.map((c) => c.key)).toEqual(['brot', 'broetchen'])
      expect(category(doc, 'brot').rows[0].variants).toHaveLength(1)
      expect(doc.counts.listed).toBe(2)
      expect(doc.availableCategories.map((c) => c.key)).toEqual([
        'brot',
        'broetchen',
      ])
      expect(doc.partner).toMatchObject({
        name: 'Testmarkt Musterstadt',
        settlementLabel: 'Kommission',
        assortmentSource: 'templates',
      })
    })

    it('keeps the catalogue prices - there is no partner price in the data', () => {
      const doc = build({
        audience: 'partner',
        partner,
        assortment: { slugs: [CATALOGUE[4].id] },
      })
      expect(doc.categories[0].rows[0].variants[0].price).toBe(0.45)
    })

    it('carries no partner block on the shop list', () => {
      expect(build({ partner }).partner).toBeNull()
    })
  })
})

describe('priceListToCsv', () => {
  it('writes one line per product with decimal comma and semicolon', () => {
    const lines = core
      .priceListToCsv(build({ categories: ['brot', 'kuchen'] }))
      .split('\r\n')
    expect(lines[0]).toBe(
      'Kategorie;Artikel;Einheit;Preis (EUR);Hinweis;Artikelnummer'
    )
    expect(lines[1]).toBe('Brot;Musterbrot;500 g;2,50;;2')
    expect(lines[2]).toBe('Brot;Musterbrot;1000 g;4,40;;3')
    expect(lines).toContain('Kuchen;Musterkuchen;Stück;1,60;;10')
    expect(lines).toContain('Kuchen;Saisonstollen;;9,95;saisonal;15')
    expect(lines[lines.length - 1]).toBe('')
  })

  it('adds allergens and marks open declarations', () => {
    const csv = core.priceListToCsv(
      build({
        categories: ['brot'],
        withAllergens: true,
        allergenText: (keys) => keys.join(' und '),
      })
    )
    expect(csv).toContain('Preis (EUR);Allergene;Artikelnummer')
    expect(csv).toContain('Brot;Musterbrot;500 g;2,50;weizen und gluten;2')
    expect(csv).toContain('Brot;Probekruste;750 g;3,90;Angabe offen;4')
  })

  it('defuses formula cells in product names', () => {
    const csv = core.priceListToCsv(
      core.buildPriceList([product('=SUMME(A1)', 'brot', 1)])
    )
    expect(csv).toContain(`"'=SUMME(A1)"`)
  })
})

describe('priceListFileName', () => {
  it('names audience, categories and date', () => {
    expect(core.priceListFileName(build())).toBe('preisliste-laden-2026-11-13')
    expect(core.priceListFileName(build({ categories: ['brot'] }))).toBe(
      'preisliste-laden-brot-2026-11-13'
    )
    expect(
      core.priceListFileName(
        build({ categories: ['brot', 'kuchen', 'torten', 'snacks'] })
      )
    ).toBe('preisliste-laden-auswahl-2026-11-13')
  })
})
