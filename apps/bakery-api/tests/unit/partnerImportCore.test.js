/**
 * B6: rules of the partner-store import (`partner-import.core.js`).
 * Synthetic store only (`tests/fixtures/partner-store.synthetic.json`).
 */
const core = require('../../src/services/partner-import.core')
const fixture = require('../fixtures/partner-store.synthetic.json')

const clone = () => JSON.parse(JSON.stringify(fixture))

describe('slugify / normalizeWeekdays', () => {
  it('slugs like the partner routes (umlauts, separators, trimming)', () => {
    expect(core.slugify('Bäckerei Größe & Söhne!')).toBe(
      'baeckerei-groesse-soehne'
    )
    expect(core.slugify('  --CAP Markt--  ')).toBe('cap-markt')
    expect(core.slugify(null)).toBe('')
  })

  it('keeps ISO weekdays 1-7 only, sorted and unique', () => {
    expect(core.normalizeWeekdays([6, 2, 2, '3', 0, 8, 2.5, 'x'])).toEqual([
      2, 3, 6,
    ])
    expect(core.normalizeWeekdays('[7,1]')).toEqual([1, 7])
    expect(core.normalizeWeekdays('kaputt')).toEqual([])
    expect(core.normalizeWeekdays(undefined)).toEqual([])
  })
})

describe('planImport - the synthetic store', () => {
  const plan = core.planImport(clone())

  it('accepts it without problems', () => {
    expect(plan.ok).toBe(true)
    expect(plan.problems).toEqual([])
  })

  it('maps partners by slug with normalised master data', () => {
    expect(plan.partners.map((p) => [p.sourceId, p.slug])).toEqual([
      [1, 'cap-markt-homburg-kirrberg'],
      [2, 'testmarkt-beispielstadt'],
    ])
    expect(plan.partners[1].attributes).toEqual({
      name: 'Testmarkt Beispielstadt',
      slug: 'testmarkt-beispielstadt',
      street: '',
      zip: '',
      city: 'Beispielstadt',
      contactName: null,
      phone: null,
      email: null,
      deliveryDays: [3, 6],
      settlementModel: 'firm_sale',
      active: false,
      notes: null,
    })
  })

  it('maps templates to partner slug + weekday and drops quantity 0', () => {
    expect(plan.templates).toEqual([
      {
        sourceId: 1,
        partnerSlug: 'cap-markt-homburg-kirrberg',
        weekday: 2,
        items: [{ productId: 1, productSlug: 'kornbrot-500g', quantity: 4 }],
        active: true,
      },
      {
        sourceId: 2,
        partnerSlug: 'cap-markt-homburg-kirrberg',
        weekday: 3,
        items: [],
        active: true,
      },
      {
        sourceId: 3,
        partnerSlug: 'testmarkt-beispielstadt',
        weekday: 6,
        items: [{ productId: 13, productSlug: 'musterweck', quantity: 12 }],
        active: false,
      },
    ])
  })

  it('keeps the price/name snapshot of each item and null vs. 0', () => {
    const first = plan.visits[0]
    expect(first).toMatchObject({
      sourceId: 1,
      partnerSlug: 'cap-markt-homburg-kirrberg',
      businessDate: '2026-03-03',
      visitAt: '2026-03-03T05:30:00.000Z',
      visitType: 'initial',
      sequence: 1,
      staffName: 'Test Fahrer',
    })
    expect(first.items).toEqual([
      {
        productId: 1,
        productSlug: 'kornbrot-500g',
        productName: 'Kornbrot 500g (alter Name)',
        unitPrice: 2.1,
        countedQty: null,
        deliveredQty: 8,
      },
      {
        productId: 9001,
        productSlug: 'altes-testbrot',
        productName: 'Altes Testbrot',
        unitPrice: 1.5,
        countedQty: null,
        deliveredQty: 4,
      },
    ])
    const pickup = plan.visits[1]
    expect(pickup.items.map((i) => i.countedQty)).toEqual([2, 0])
  })

  it('never carries the mock staffId', () => {
    for (const visit of plan.visits) expect(visit).not.toHaveProperty('staffId')
  })

  it('gives every visit its natural key', () => {
    expect(plan.visits[0].key).toBe(
      `cap-markt-homburg-kirrberg|2026-03-03|initial|${Date.parse(
        '2026-03-03T05:30:00.000Z'
      )}`
    )
    expect(new Set(plan.visits.map((v) => v.key)).size).toBe(4)
  })
})

describe('visitKey', () => {
  it('is the same for a Date and its ISO string', () => {
    const base = {
      partnerSlug: 'p',
      businessDate: '2026-03-03',
      visitType: 'refill',
    }
    expect(
      core.visitKey({ ...base, visitAt: new Date('2026-03-03T10:00:00Z') })
    ).toBe(core.visitKey({ ...base, visitAt: '2026-03-03T10:00:00.000Z' }))
  })
})

describe('planImport - problems are reported, never dropped silently', () => {
  it('refuses something that is no store', () => {
    for (const bad of [null, [], 'text', { partners: 'x' }, {}]) {
      const plan = core.planImport(bad)
      expect(plan.ok).toBe(false)
      expect(plan.message).toMatch(/Partner-Store/)
    }
    expect(core.planImport({ partners: [], visits: {} }).ok).toBe(false)
  })

  it('reports bad partners and everything that hangs on them', () => {
    const store = clone()
    store.partners.push(
      { id: 3, name: '   ' },
      { id: 'x', name: 'Ohne Id' },
      { id: 4, name: 'CAP Markt Homburg Kirrberg' }, // same slug
      { id: 1, name: 'Doppelte Id' }
    )
    store.templates.push({ id: 9, partnerId: 3, weekday: 2, items: [] })
    store.visits.push({
      id: 9,
      partnerId: 4,
      businessDate: '2026-03-05',
      visitAt: '2026-03-05T06:00:00Z',
      visitType: 'refill',
      items: [],
    })
    const plan = core.planImport(store)
    expect(plan.ok).toBe(true)
    expect(plan.partners).toHaveLength(2)
    const messages = plan.problems.map((p) => p.message)
    expect(messages).toEqual([
      'Partner 3 hat keinen Namen.',
      'Partner ohne gültige Kennung (id).',
      'Kürzel "cap-markt-homburg-kirrberg" kommt doppelt vor.',
      'Partner-Kennung 1 kommt doppelt vor.',
      'Vorlage für unbekannten Partner 3.',
      'Besuch 9: unbekannter Partner 4.',
    ])
  })

  it('reports bad templates (weekday, duplicates)', () => {
    const store = clone()
    store.templates.push(
      { id: 7, partnerId: 1, weekday: 8, items: [] },
      { id: 8, partnerId: 1, weekday: 2, items: [] }
    )
    const plan = core.planImport(store)
    expect(plan.templates).toHaveLength(3)
    expect(plan.problems.map((p) => [p.entity, p.sourceId])).toEqual([
      ['template', 7],
      ['template', 8],
    ])
  })

  it('reports bad visits with the reason of the capture rules', () => {
    const store = clone()
    const base = {
      partnerId: 1,
      businessDate: '2026-03-06',
      visitAt: '2026-03-06T06:00:00Z',
      visitType: 'refill',
      items: [],
    }
    store.visits.push(
      { ...base, id: 10, visitType: 'besuch' },
      { ...base, id: 11, businessDate: '2026-02-30' },
      { ...base, id: 12, visitAt: 'gestern' },
      { ...base, id: 13, visitAt: null },
      {
        ...base,
        id: 14,
        items: [{ productSlug: 'kornbrot-500g', countedQty: 'abc' }],
      },
      {
        ...base,
        id: 15,
        items: [
          { productSlug: 'kornbrot-500g', unitPrice: -1, deliveredQty: 1 },
        ],
      },
      // Same key as visit 1: listed twice in the file.
      { ...fixture.visits[0], id: 16 },
      // A second initial on a day that already has one.
      {
        ...fixture.visits[0],
        id: 17,
        visitAt: '2026-03-03T06:30:00.000Z',
      }
    )
    const plan = core.planImport(store)
    expect(plan.visits).toHaveLength(4)
    const byId = Object.fromEntries(
      plan.problems.map((p) => [p.sourceId, p.message])
    )
    expect(byId[10]).toMatch(/unbekannter Besuchstyp "besuch"/)
    expect(byId[11]).toMatch(/ungültiger Geschäftstag "2026-02-30"/)
    expect(byId[12]).toMatch(/ungültiger Zeitpunkt/)
    expect(byId[13]).toMatch(/ungültiger Zeitpunkt/)
    expect(byId[14]).toMatch(/Rest muss eine ganze Zahl/)
    expect(byId[15]).toMatch(/Einzelpreis/)
    expect(byId[16]).toMatch(/doppelt in der Datei/)
    expect(byId[17]).toMatch(/zweite Erstbestückung am 2026-03-03/)
    expect(plan.problems.every((p) => p.entity === 'visit')).toBe(true)
  })

  it('reports a non-object visit entry', () => {
    const store = clone()
    store.visits.push(null)
    const plan = core.planImport(store)
    expect(plan.visits).toHaveLength(4)
    expect(plan.problems).toEqual([
      {
        entity: 'visit',
        sourceId: null,
        message: 'Ein Besuchs-Eintrag ist kein Objekt.',
      },
    ])
  })

  it('treats missing templates/visits sections as empty', () => {
    const plan = core.planImport({ partners: fixture.partners })
    expect(plan.ok).toBe(true)
    expect(plan.templates).toEqual([])
    expect(plan.visits).toEqual([])
  })
})

describe('sameAttributes', () => {
  it('compares normalised attributes', () => {
    const a = core.partnerAttributes(fixture.partners[0], 'x')
    const b = core.partnerAttributes({ ...fixture.partners[0] }, 'x')
    expect(core.sameAttributes(a, b)).toBe(true)
    expect(
      core.sameAttributes(
        a,
        core.partnerAttributes({ ...fixture.partners[0], city: 'Y' }, 'x')
      )
    ).toBe(false)
  })
})
