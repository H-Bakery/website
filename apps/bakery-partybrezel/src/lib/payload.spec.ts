import {
  partybrezelConfig as config,
  type PartybrezelConfig,
} from '../config/partybrezel.config'
import {
  API_LIMITS,
  buildPayload,
  buildPayloadA,
  buildPayloadB,
  composeNote,
  describePretzels,
  mergeItems,
} from './payload'
import { draft, pretzel } from './testing'

const VARIANT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function keysDeep(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => keysDeep(v, keys))
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) {
      keys.push(k)
      keysDeep(v, keys)
    }
  return keys
}

const order = () =>
  draft({
    pretzels: [
      pretzel(config, 'klein', 'butter'),
      pretzel(config, 'gross', ['kaese', 'schinken', 'butter']),
      pretzel(config, 'gross', ['kaese', 'kaese', 'frischkaese-kraeuter']),
    ],
    pickupDate: '2026-11-14',
    pickupTime: '10:30',
    name: '  Erika Beispiel ',
    phone: ' 0000 12345 ',
    note: 'Bitte in Scheiben',
  })

describe('payload builders', () => {
  it('mergeItems fasst productId + variant zusammen und lässt 0 weg', () => {
    expect(
      mergeItems([
        { productId: 'x', quantity: 1 },
        { productId: 'x', variant: 'a', quantity: 2 },
        { productId: 'x', quantity: 3 },
        { productId: 'y', quantity: 0 },
        { productId: 'x', variant: 'a', quantity: 1 },
      ])
    ).toEqual([
      { productId: 'x', quantity: 4 },
      { productId: 'x', variant: 'a', quantity: 3 },
    ])
  })

  it('Abbildung A: eine Zeile je Größe, Beläge in der Anmerkung', () => {
    const { payload, warnings } = buildPayloadA(order(), config)
    expect(warnings).toEqual([])
    expect(payload).toEqual({
      channel: 'shop',
      customerName: 'Erika Beispiel',
      customerPhone: '0000 12345',
      pickupDate: '2026-11-14',
      pickupTime: '10:30',
      items: [
        { productId: config.productIds.pretzelBySize.klein, quantity: 1 },
        { productId: config.productIds.pretzelBySize.gross, quantity: 2 },
      ],
      note:
        'Partybrezel – Brezel 1 (klein): 3× Butter; Brezel 2 (groß): Käse, Schinken, Butter; ' +
        'Brezel 3 (groß): Käse, Käse, Frischkäse & Kräuter | Anmerkung: Bitte in Scheiben',
    })
  })

  it('Abbildung B: Teile je Größe und Belag, Belag als Sorte', () => {
    const { payload, warnings } = buildPayloadB(order(), config)
    expect(warnings).toEqual([])
    const klein = config.productIds.partBySize.klein
    const gross = config.productIds.partBySize.gross
    expect(payload.items).toEqual([
      { productId: klein, variant: 'butter', quantity: 3 },
      { productId: gross, variant: 'kaese', quantity: 3 },
      { productId: gross, variant: 'schinken', quantity: 1 },
      { productId: gross, variant: 'butter', quantity: 1 },
      { productId: gross, variant: 'frischkaese-kraeuter', quantity: 1 },
    ])
    // Summe der Teile = 3 Brezeln × 3 Teile
    expect(payload.items.reduce((s, i) => s + i.quantity, 0)).toBe(9)
    for (const item of payload.items) {
      expect(item.variant).toMatch(VARIANT)
      expect((item.variant ?? '').length).toBeLessThanOrEqual(64)
    }
    // Die Zuordnung Teil → Brezel bleibt in der Anmerkung
    expect(payload.note).toContain('Brezel 2 (groß): Käse, Schinken, Butter')
  })

  it.each(['A', 'B'] as const)(
    'Abbildung %s enthält keine Preisfelder und nur Felder des Vertrags',
    (mapping) => {
      const { payload } = buildPayload(mapping, order(), config)
      const keys = keysDeep(payload)
      expect(keys.some((k) => /price|cents|amount|total|paid/i.test(k))).toBe(
        false
      )
      expect(Object.keys(payload).sort()).toEqual(
        [
          'channel',
          'customerName',
          'customerPhone',
          'items',
          'note',
          'pickupDate',
          'pickupTime',
        ].sort()
      )
      for (const item of payload.items) {
        expect(Number.isInteger(item.quantity)).toBe(true)
        expect(item.quantity).toBeGreaterThanOrEqual(1)
        expect(item.quantity).toBeLessThanOrEqual(API_LIMITS.maxQuantity)
      }
    }
  )

  it('lässt leere optionale Felder weg', () => {
    const { payload } = buildPayloadA(
      draft({ pretzels: [pretzel(config, 'klein', 'butter')] }),
      config
    )
    expect(payload).not.toHaveProperty('customerPhone')
    expect(payload).not.toHaveProperty('pickupTime')
    expect(payload.note).toBe('Partybrezel – Brezel 1 (klein): 3× Butter')
  })

  it('beschreibt im Modus "eine Sorte je Brezel" die ganze Brezel', () => {
    expect(
      describePretzels(
        [pretzel(config, 'gross', 'salami')],
        'per-pretzel',
        config
      )
    ).toBe('Brezel 1 (groß): Salami (ganze Brezel)')
  })

  it('zu lange Anmerkung wird gekürzt - mit Warnung, nie still', () => {
    const long = draft({
      pretzels: [pretzel(config, 'klein', 'butter')],
      note: 'x'.repeat(600),
    })
    for (const mapping of ['A', 'B'] as const) {
      const { payload, warnings } = buildPayload(mapping, long, config)
      expect(payload.note).toHaveLength(API_LIMITS.maxNoteLength)
      expect(payload.note?.endsWith('…')).toBe(true)
      expect(warnings.map((w) => w.code)).toContain('note_truncated')
    }
    expect(composeNote('kurz', '', 500)).toEqual({
      note: 'Partybrezel – kurz',
      truncated: false,
      fullLength: 18,
    })
  })

  it('warnt bei Mengen über 99 und mehr als 50 Positionen (ohne zu kappen)', () => {
    const big: PartybrezelConfig = { ...config, maxPretzelsPerOrder: 200 }
    const pretzels = Array.from({ length: 100 }, () =>
      pretzel(big, 'klein', 'butter')
    )
    const a = buildPayloadA(draft({ pretzels }), big)
    expect(a.payload.items).toEqual([
      { productId: big.productIds.pretzelBySize.klein, quantity: 100 },
    ])
    expect(a.warnings.map((w) => w.code)).toContain('quantity_too_large')

    const manyToppings: PartybrezelConfig = {
      ...config,
      maxPretzelsPerOrder: 100,
      toppings: Array.from({ length: 60 }, (_, i) => ({
        id: `belag-${i}`,
        label: `Belag ${i}`,
        surchargePerPartCents: 0,
      })),
    }
    const varied = Array.from({ length: 20 }, (_, i) =>
      pretzel(manyToppings, 'gross', [
        `belag-${i * 3}`,
        `belag-${i * 3 + 1}`,
        `belag-${i * 3 + 2}`,
      ])
    )
    const b = buildPayloadB(draft({ pretzels: varied }), manyToppings)
    expect(b.payload.items).toHaveLength(60)
    expect(b.warnings.map((w) => w.code)).toContain('too_many_items')
  })

  it('meldet ungültige Sorten-Slugs und offene Teile', () => {
    const bad: PartybrezelConfig = {
      ...config,
      toppings: [
        { id: 'Käse Spezial', label: 'Käse Spezial', surchargePerPartCents: 0 },
      ],
    }
    const result = buildPayloadB(
      draft({
        pretzels: [pretzel(bad, 'klein', ['Käse Spezial', null, null])],
      }),
      bad
    )
    const codes = result.warnings.map((w) => w.code)
    expect(codes).toContain('invalid_variant')
    expect(codes).toContain('untopped_parts')
    expect(result.payload.items).toEqual([
      {
        productId: bad.productIds.partBySize.klein,
        variant: 'Käse Spezial',
        quantity: 1,
      },
    ])
  })

  it('meldet fehlenden Abholtag und leere Bestellung', () => {
    const { warnings } = buildPayloadA(draft({ pickupDate: null }), config)
    expect(warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(['missing_pickup_date', 'no_items'])
    )
  })
})
