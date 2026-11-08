import { partybrezelConfig as config } from '../config/partybrezel.config'
import { checkConfig } from './configLookup'
import { doughSummary, toppingCounts } from './summary'
import {
  countBySize,
  createOrderReducer,
  initialOrderState,
  sanitizeOrderState,
  type OrderState,
} from './orderState'
import { pretzel } from './testing'

const reduce = createOrderReducer(config)

function withCounts(klein: number, gross: number): OrderState {
  let s = initialOrderState(config)
  s = reduce(s, { type: 'setCount', size: 'gross', count: gross })
  s = reduce(s, { type: 'setCount', size: 'klein', count: klein })
  return s
}

describe('config', () => {
  it('hat keine inneren Widersprüche', () => {
    expect(checkConfig(config)).toEqual([])
  })

  it('Gewichte sind die festen Werte, Teile je Brezel 3', () => {
    const sizes = Object.fromEntries(config.sizes.map((s) => [s.id, s]))
    expect(sizes.klein.gramsPerPart).toBe(300)
    expect(sizes.gross.gramsPerPart).toBe(400)
    expect(sizes.klein.partsPerPretzel).toBe(3)
    expect(sizes.gross.partsPerPretzel).toBe(3)
  })

  it('meldet einen Montag und kaputte Slugs', () => {
    const issues = checkConfig({
      ...config,
      availableWeekdays: [1, 2],
      toppings: [
        { id: 'Kaese', label: 'Käse', surchargePerPartCents: 0 },
        { id: 'Kaese', label: 'Käse', surchargePerPartCents: -1 },
      ],
    })
    expect(issues.join('\n')).toMatch(/Montag/)
    expect(issues.join('\n')).toMatch(/Slug/)
    expect(issues.join('\n')).toMatch(/doppelt/)
  })
})

describe('order reducer', () => {
  it('legt Brezeln an, klein vor groß, mit offenen Teilen', () => {
    const s = withCounts(1, 2)
    expect(s.pretzels.map((p) => p.size)).toEqual(['klein', 'gross', 'gross'])
    expect(s.pretzels.every((p) => p.toppings.length === 3)).toBe(true)
    expect(s.pretzels.every((p) => p.toppings.every((t) => t === null))).toBe(
      true
    )
    expect(new Set(s.pretzels.map((p) => p.id)).size).toBe(3)
  })

  it('begrenzt auf maxPretzelsPerOrder über alle Größen', () => {
    const s = withCounts(50, 4)
    expect(countBySize(s.pretzels, 'gross')).toBe(4)
    expect(countBySize(s.pretzels, 'klein')).toBe(
      config.maxPretzelsPerOrder - 4
    )
    expect(
      reduce(s, { type: 'setCount', size: 'gross', count: -3 }).pretzels
    ).toHaveLength(config.maxPretzelsPerOrder - 4)
  })

  it('verringern nimmt die zuletzt hinzugefügte Brezel der Größe weg', () => {
    let s = withCounts(0, 2)
    const [first] = s.pretzels
    s = reduce(s, {
      type: 'setPartTopping',
      pretzelId: first.id,
      part: 0,
      toppingId: 'kaese',
    })
    s = reduce(s, { type: 'setCount', size: 'gross', count: 1 })
    expect(s.pretzels).toHaveLength(1)
    expect(s.pretzels[0].toppings[0]).toBe('kaese')
  })

  it('setzt Beläge je Teil oder für die ganze Brezel, ignoriert Unbekanntes', () => {
    let s = withCounts(1, 0)
    const id = s.pretzels[0].id
    s = reduce(s, {
      type: 'setPartTopping',
      pretzelId: id,
      part: 2,
      toppingId: 'salami',
    })
    expect(s.pretzels[0].toppings).toEqual([null, null, 'salami'])
    expect(
      reduce(s, {
        type: 'setPartTopping',
        pretzelId: id,
        part: 3,
        toppingId: 'kaese',
      })
    ).toEqual(s)
    expect(
      reduce(s, {
        type: 'setPartTopping',
        pretzelId: id,
        part: 0,
        toppingId: 'gibts-nicht',
      })
    ).toBe(s)
    s = reduce(s, {
      type: 'setPretzelTopping',
      pretzelId: id,
      toppingId: 'butter',
    })
    expect(s.pretzels[0].toppings).toEqual(['butter', 'butter', 'butter'])
  })

  it('"Für alle übernehmen" kopiert die Teile auf alle Brezeln', () => {
    let s = withCounts(1, 2)
    const source = s.pretzels[1]
    s = reduce(s, {
      type: 'setPartTopping',
      pretzelId: source.id,
      part: 0,
      toppingId: 'kaese',
    })
    s = reduce(s, {
      type: 'setPartTopping',
      pretzelId: source.id,
      part: 1,
      toppingId: 'schinken',
    })
    s = reduce(s, { type: 'copyToAll', pretzelId: source.id })
    for (const p of s.pretzels)
      expect(p.toppings).toEqual(['kaese', 'schinken', null])
  })

  it('Modus, Abholtag, Felder und Zurücksetzen', () => {
    let s = withCounts(1, 0)
    s = reduce(s, { type: 'setMode', mode: 'per-pretzel' })
    s = reduce(s, { type: 'setPickupDate', date: '2026-11-14' })
    s = reduce(s, { type: 'setField', field: 'name', value: 'Max' })
    expect(s).toMatchObject({
      toppingMode: 'per-pretzel',
      pickupDate: '2026-11-14',
      name: 'Max',
    })
    expect(reduce(s, { type: 'reset' })).toEqual(initialOrderState(config))
  })
})

describe('sanitizeOrderState', () => {
  it('nimmt nur Bekanntes aus einem gespeicherten Entwurf', () => {
    const state = sanitizeOrderState(
      {
        pretzels: [
          { size: 'gross', toppings: ['kaese', 'gibts-nicht', 7] },
          { size: 'riesig', toppings: [] },
          'Unsinn',
        ],
        toppingMode: 'quer',
        pickupDate: '2026-02-30',
        name: 'Erika',
        phone: 12345,
      },
      config
    )
    expect(state).toMatchObject({
      pretzels: [{ id: 'p1', size: 'gross', toppings: ['kaese', null, null] }],
      toppingMode: config.defaultToppingMode,
      pickupDate: null,
      name: 'Erika',
      phone: '',
      nextId: 2,
    })
    expect(sanitizeOrderState(null, config)).toBeNull()
    expect(sanitizeOrderState('x', config)).toBeNull()
  })

  it('schneidet zu viele Brezeln ab', () => {
    const state = sanitizeOrderState(
      { pretzels: Array.from({ length: 40 }, () => ({ size: 'klein' })) },
      config
    )
    expect(state?.pretzels).toHaveLength(config.maxPretzelsPerOrder)
  })
})

describe('summary', () => {
  it('Teile und Teig je Größe', () => {
    const pretzels = [
      pretzel(config, 'klein', 'butter'),
      pretzel(config, 'gross', ['kaese', 'kaese', null]),
      pretzel(config, 'gross', 'kaese'),
    ]
    expect(doughSummary(pretzels, config)).toEqual({
      bySize: [
        {
          sizeId: 'klein',
          label: 'klein',
          pretzels: 1,
          parts: 3,
          gramsPerPart: 300,
          grams: 900,
        },
        {
          sizeId: 'gross',
          label: 'groß',
          pretzels: 2,
          parts: 6,
          gramsPerPart: 400,
          grams: 2400,
        },
      ],
      totalParts: 9,
      totalGrams: 3300,
    })
    expect(toppingCounts(pretzels, config)).toEqual([
      { toppingId: 'butter', label: 'Butter', parts: 3 },
      { toppingId: 'kaese', label: 'Käse', parts: 5 },
    ])
  })
})
