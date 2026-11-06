/**
 * B7: das allgemeine Vorbestell-Modell in `delivery-preorders.core.js`
 * (Kanal, Laden oder Sammelstelle, Sorten, Status offen/bereit/abgeholt/
 * storniert, Alias auf den Mock-Vertrag, Import, P4-Anonymisierung).
 * Nur synthetische Daten.
 */
const core = require('../../src/services/delivery-preorders.core')

const PRODUCTS = {
  'kornbrot-500g': { id: 'kornbrot-500g', name: 'Kornbrot 500g', price: 2.5 },
  1: { id: 'kornbrot-500g', name: 'Kornbrot 500g', price: 2.5 },
  musterweck: { id: 'musterweck', name: 'Musterweck', price: 0.45 },
  'zopf-test': { id: 'zopf-test', name: 'Testzopf gefüllt', price: 4.1 },
  'ohne-preis': { id: 'ohne-preis', name: 'Ohne Preis', price: null },
}
const lookupProduct = (id) => PRODUCTS[id] || null

const POINT = {
  id: 'kindergarten-musterdorf',
  name: 'Kindergarten Musterdorf',
  city: 'Teststadt-Musterdorf',
  weekday: 6,
  window: '09:00-09:30',
  orderDeadline: { weekday: 5, time: '12:00' },
  active: true,
}
const findPickupPoint = (id) =>
  id === POINT.id
    ? POINT
    : id === 'alt'
    ? { ...POINT, id: 'alt', active: false }
    : null

const variantsForProduct = (id) =>
  id === 'zopf-test'
    ? { itemId: 'zopf', variants: ['nuss', 'schoko'] }
    : id === 'musterweck'
    ? { itemId: 'weck', variants: [] }
    : null

const NOW = '2026-11-10T10:00:00.000Z'
const opts = (extra = {}) => ({
  lookupProduct,
  findPickupPoint,
  variantsForProduct,
  now: NOW,
  ...extra,
})

// Samstag 2026-11-21, Dienstag 2026-11-17
const LADEN = {
  channel: 'telefon',
  customerName: 'Erika Beispiel',
  customerPhone: '0170 000 0001',
  pickupDate: '2026-11-17',
  pickupTime: '08:30',
  items: [{ productId: 'kornbrot-500g', quantity: 2 }],
}

function ok(result) {
  if (result.error) throw new Error(`${result.error}: ${result.message}`)
  return result.preorder
}

describe('normalizeOrderInput - Laden', () => {
  it('takes price and name from hq and computes the total', () => {
    const p = ok(core.normalizeOrderInput(LADEN, null, opts()))
    expect(p).toMatchObject({
      channel: 'telefon',
      customerName: 'Erika Beispiel',
      customerPhone: '01700000001',
      pickupDate: '2026-11-17',
      pickupTime: '08:30',
      pickupPointId: null,
      status: 'offen',
      paid: false,
      pickedUpAt: null,
      notCollectedAt: null,
      total: 5,
    })
    expect(p.items).toEqual([
      {
        productId: 'kornbrot-500g',
        name: 'Kornbrot 500g',
        variant: '',
        unit: 'Stück',
        unitPrice: 2.5,
        quantity: 2,
        lineTotal: 5,
      },
    ])
  })

  it('ignores a price in the body and resolves a numeric id to the slug', () => {
    const p = ok(
      core.normalizeOrderInput(
        { ...LADEN, items: [{ productId: 1, qty: 1, unitPrice: 0.01 }] },
        null,
        opts()
      )
    )
    expect(p.items[0]).toMatchObject({
      productId: 'kornbrot-500g',
      unitPrice: 2.5,
    })
  })

  it('accepts a Laden pickup without time', () => {
    const p = ok(
      core.normalizeOrderInput({ ...LADEN, pickupTime: null }, null, opts())
    )
    expect(p.pickupTime).toBeNull()
  })

  it.each([
    [{ channel: 'fax' }, 'invalid_channel'],
    [{ channel: undefined }, 'invalid_channel'],
    [{ customerName: '  ' }, 'customer_required'],
    [{ customerName: 42 }, 'invalid_customer'],
    [{ customerPhone: 170 }, 'invalid_phone'],
    [{ pickupDate: '2026-02-30' }, 'invalid_date'],
    [{ pickupTime: '25:00' }, 'invalid_time'],
    [{ pickupTime: 830 }, 'invalid_time'],
    [{ paid: 'ja' }, 'invalid_paid'],
    [{ note: 5 }, 'invalid_note'],
    [{ note: 'x'.repeat(501) }, 'note_too_long'],
    [{ items: [] }, 'items_required'],
    [{ items: 'brot' }, 'invalid_items'],
    [
      { items: [{ productId: 'gibt-es-nicht', quantity: 1 }] },
      'unknown_product',
    ],
    [{ items: [{ productId: 'ohne-preis', quantity: 1 }] }, 'invalid_price'],
    [
      { items: [{ productId: 'kornbrot-500g', quantity: 100 }] },
      'invalid_quantity',
    ],
    [{ status: 'fertig' }, 'invalid_status'],
    [{ channel: 'sammelstelle' }, 'pickup_point_required'],
    [
      { pickupPointId: 'nirgendwo', pickupTime: undefined },
      'unknown_pickup_point',
    ],
  ])('rejects %j with %s (German message)', (patch, code) => {
    const result = core.normalizeOrderInput(
      { ...LADEN, ...patch },
      null,
      opts()
    )
    expect(result.error).toBe(code)
    expect(result.status).toBe(400)
    expect(result.message).toMatch(/[a-zäöüß]/)
  })

  it('merges two lines of the same product and variant and checks the sum', () => {
    const p = ok(
      core.normalizeOrderInput(
        {
          ...LADEN,
          items: [
            { productId: 'kornbrot-500g', quantity: 2 },
            { productId: 1, quantity: 3 },
          ],
        },
        null,
        opts()
      )
    )
    expect(p.items).toHaveLength(1)
    expect(p.items[0].quantity).toBe(5)
    const tooMany = core.normalizeOrderInput(
      {
        ...LADEN,
        items: [
          { productId: 'kornbrot-500g', quantity: 60 },
          { productId: 'kornbrot-500g', quantity: 40 },
        ],
      },
      null,
      opts()
    )
    expect(tooMany.error).toBe('invalid_quantity')
  })

  it('drops lines with quantity 0', () => {
    const p = ok(
      core.normalizeOrderInput(
        {
          ...LADEN,
          items: [
            { productId: 'kornbrot-500g', quantity: 1 },
            { productId: 'musterweck', quantity: 0 },
          ],
        },
        null,
        opts()
      )
    )
    expect(p.items.map((i) => i.productId)).toEqual(['kornbrot-500g'])
  })
})

describe('normalizeOrderInput - Sammelstelle', () => {
  const AT_POINT = {
    ...LADEN,
    channel: 'sammelstelle',
    pickupDate: '2026-11-21',
    pickupTime: undefined,
    pickupPointId: POINT.id,
  }

  it('takes the point and no time', () => {
    const p = ok(core.normalizeOrderInput(AT_POINT, null, opts()))
    expect(p).toMatchObject({ pickupPointId: POINT.id, pickupTime: null })
  })

  it('accepts a point for other channels too (phone order for the Kita)', () => {
    const p = ok(
      core.normalizeOrderInput(
        { ...AT_POINT, channel: 'whatsapp' },
        null,
        opts()
      )
    )
    expect(p.channel).toBe('whatsapp')
  })

  it('rejects a day the point is not served, with the mock text', () => {
    const result = core.normalizeOrderInput(
      { ...AT_POINT, pickupDate: '2026-11-20' },
      null,
      opts()
    )
    expect(result.error).toBe('invalid_delivery_day')
    expect(result.message).toBe(
      'Der 20.11.2026 ist kein Samstag — an diesem Tag wird nicht nach Musterdorf geliefert.'
    )
  })

  it('rejects a pickup time at a point', () => {
    const result = core.normalizeOrderInput(
      { ...AT_POINT, pickupTime: '09:00' },
      null,
      opts()
    )
    expect(result.error).toBe('pickup_time_not_allowed')
  })

  it('rejects a newly chosen inactive point but keeps an existing one', () => {
    expect(
      core.normalizeOrderInput(
        { ...AT_POINT, pickupPointId: 'alt' },
        null,
        opts()
      ).error
    ).toBe('inactive_pickup_point')
    const existing = ok(
      core.normalizeOrderInput({ ...AT_POINT, pickupPointId: 'alt' }, null, {
        ...opts(),
        findPickupPoint: () => ({ ...POINT, id: 'alt' }),
      })
    )
    const kept = core.normalizeOrderInput({ note: 'neu' }, existing, opts())
    expect(kept.preorder.pickupPointId).toBe('alt')
  })

  it('moving from the point to the Laden needs no time; from the Laden to a point clears it', () => {
    const atPoint = ok(core.normalizeOrderInput(AT_POINT, null, opts()))
    const toLaden = ok(
      core.normalizeOrderInput(
        { pickupPointId: null, channel: 'telefon', pickupTime: '10:00' },
        atPoint,
        opts()
      )
    )
    expect(toLaden).toMatchObject({ pickupPointId: null, pickupTime: '10:00' })
    const back = ok(
      core.normalizeOrderInput(
        { pickupPointId: POINT.id, pickupDate: '2026-11-21' },
        toLaden,
        opts()
      )
    )
    expect(back.pickupTime).toBeNull()
  })
})

describe('variants', () => {
  const zopf = (variant, extra = {}) =>
    core.normalizeOrderInput(
      { ...LADEN, items: [{ productId: 'zopf-test', quantity: 1, variant }] },
      null,
      opts(extra)
    )

  it('requires one of the item variants when the Backzettel lists some', () => {
    expect(zopf('nuss').preorder.items[0].variant).toBe('nuss')
    expect(zopf(' Schoko ').preorder.items[0].variant).toBe('schoko')
    expect(zopf('').error).toBe('variant_required')
    expect(zopf('').message).toBe(
      'Bitte für „Testzopf gefüllt“ eine Sorte wählen: nuss, schoko.'
    )
    expect(zopf('mohn').error).toBe('invalid_variant')
  })

  it('accepts no variant when requireVariant is off (old Mörsbach form, shop)', () => {
    expect(
      zopf(undefined, { requireVariant: false }).preorder.items[0].variant
    ).toBe('')
    expect(zopf('mohn', { requireVariant: false }).error).toBe(
      'invalid_variant'
    )
  })

  it('rejects a variant for an item without variants', () => {
    const result = core.normalizeOrderInput(
      {
        ...LADEN,
        items: [{ productId: 'musterweck', quantity: 1, variant: 'nuss' }],
      },
      null,
      opts()
    )
    expect(result.error).toBe('invalid_variant')
  })

  it('accepts any slug when there is no config for the product', () => {
    const p = ok(
      core.normalizeOrderInput(
        {
          ...LADEN,
          items: [
            {
              productId: 'kornbrot-500g',
              quantity: 1,
              variant: 'dinkel-extra',
            },
          ],
        },
        null,
        opts({ variantsForProduct: () => null })
      )
    )
    expect(p.items[0].variant).toBe('dinkel-extra')
    const bad = core.normalizeOrderInput(
      {
        ...LADEN,
        items: [
          { productId: 'kornbrot-500g', quantity: 1, variant: 'Nuss & Mohn' },
        ],
      },
      null,
      opts()
    )
    expect(bad.error).toBe('invalid_variant')
  })

  it('keeps two lines of one product with different variants apart', () => {
    const p = ok(
      core.normalizeOrderInput(
        {
          ...LADEN,
          items: [
            { productId: 'zopf-test', quantity: 2, variant: 'nuss' },
            { productId: 'zopf-test', quantity: 1, variant: 'schoko' },
          ],
        },
        null,
        opts()
      )
    )
    expect(p.items.map((i) => [i.variant, i.quantity])).toEqual([
      ['nuss', 2],
      ['schoko', 1],
    ])
    expect(p.total).toBe(12.3)
  })
})

describe('price snapshots on update', () => {
  it('keeps name and price of existing lines (per product and variant) when hq changes', () => {
    const created = ok(
      core.normalizeOrderInput(
        {
          ...LADEN,
          items: [{ productId: 'zopf-test', quantity: 1, variant: 'nuss' }],
        },
        null,
        opts()
      )
    )
    const pricier = (id) =>
      id === 'zopf-test'
        ? { ...PRODUCTS['zopf-test'], price: 9.99 }
        : lookupProduct(id)
    const updated = ok(
      core.normalizeOrderInput(
        {
          items: [
            { productId: 'zopf-test', quantity: 3, variant: 'nuss' },
            { productId: 'zopf-test', quantity: 1, variant: 'schoko' },
          ],
        },
        created,
        opts({ lookupProduct: pricier })
      )
    )
    expect(updated.items.map((i) => [i.variant, i.unitPrice])).toEqual([
      ['nuss', 4.1],
      ['schoko', 9.99],
    ])
  })

  it('keeps all items when the body has none (pure status change)', () => {
    const created = ok(core.normalizeOrderInput(LADEN, null, opts()))
    const updated = ok(
      core.normalizeOrderInput({ paid: true }, created, opts())
    )
    expect(updated.items).toEqual(created.items)
    expect(updated.paid).toBe(true)
  })
})

describe('storniert is locked with lockCancelled (P1/P3, /api/preorders only)', () => {
  const cancelled = () =>
    ok(
      core.normalizeOrderInput({ ...LADEN, status: 'storniert' }, null, opts())
    )
  const locked = () => ({ ...opts(), lockCancelled: true })

  it.each([
    [{ pickupDate: '2026-11-18' }],
    [{ pickupTime: '11:00' }],
    [{ channel: 'whatsapp' }],
    [{ items: [{ productId: 'kornbrot-500g', quantity: 3 }] }],
  ])('refuses %j with 409 cancelled', (change) => {
    const result = core.normalizeOrderInput(change, cancelled(), locked())
    expect(result).toMatchObject({ error: 'cancelled', status: 409 })
    expect(result.message).toContain('Offen')
  })

  it('allows name, note, paid, the same items and a change together with a reopen', () => {
    const base = cancelled()
    expect(
      ok(
        core.normalizeOrderInput(
          { note: 'abgesagt', paid: true, customerName: 'Erika B.' },
          base,
          locked()
        )
      )
    ).toMatchObject({ note: 'abgesagt', paid: true, status: 'storniert' })
    expect(
      ok(
        core.normalizeOrderInput(
          { status: 'offen', pickupDate: '2026-11-18' },
          base,
          locked()
        )
      )
    ).toMatchObject({ status: 'offen', pickupDate: '2026-11-18' })
  })

  it('stays unlocked without the option (Mörsbach alias, mock contract)', () => {
    expect(
      ok(
        core.normalizeOrderInput(
          { pickupDate: '2026-11-18' },
          cancelled(),
          opts()
        )
      )
    ).toMatchObject({ status: 'storniert', pickupDate: '2026-11-18' })
  })
})

describe('abgeholt is history', () => {
  const picked = () => ({
    ...ok(
      core.normalizeOrderInput({ ...LADEN, status: 'abgeholt' }, null, opts())
    ),
    pickedUpAt: NOW,
  })

  it.each([
    [{ pickupDate: '2026-11-18' }],
    [{ items: [{ productId: 'kornbrot-500g', quantity: 3 }] }],
    [
      {
        items: [
          { productId: 'kornbrot-500g', quantity: 2 },
          { productId: 'musterweck', quantity: 1 },
        ],
      },
    ],
    [
      {
        channel: 'sammelstelle',
        pickupDate: '2026-11-21',
        pickupTime: null,
        pickupPointId: POINT.id,
      },
    ],
  ])('refuses %j with 409 already_picked_up', (change) => {
    const result = core.normalizeOrderInput(change, picked(), opts())
    expect(result).toMatchObject({ error: 'already_picked_up', status: 409 })
    expect(result.message).toContain('Offen')
  })

  it('allows plain fields, the same items and a change together with a reset', () => {
    const base = picked()
    expect(
      ok(core.normalizeOrderInput({ note: 'Beleg', paid: true }, base, opts()))
    ).toMatchObject({ note: 'Beleg', paid: true, status: 'abgeholt' })
    expect(
      ok(
        core.normalizeOrderInput(
          { items: [{ productId: 'kornbrot-500g', quantity: 2 }] },
          base,
          opts()
        )
      ).status
    ).toBe('abgeholt')
    expect(
      ok(
        core.normalizeOrderInput(
          { status: 'offen', pickupDate: '2026-11-18' },
          base,
          opts()
        )
      )
    ).toMatchObject({
      status: 'offen',
      pickupDate: '2026-11-18',
      pickedUpAt: null,
    })
  })
})

describe('quantities are not coerced', () => {
  it.each([['abc'], [2.7], [-2], [null], [{}]])(
    'quantity %j is 400 invalid_quantity',
    (quantity) => {
      expect(
        core.normalizeOrderInput(
          { ...LADEN, items: [{ productId: 'kornbrot-500g', quantity }] },
          null,
          opts()
        )
      ).toMatchObject({ error: 'invalid_quantity', status: 400 })
    }
  )

  it('drops a line only on an explicit 0', () => {
    const p = ok(
      core.normalizeOrderInput(
        {
          ...LADEN,
          items: [
            { productId: 'kornbrot-500g', quantity: '2' },
            { productId: 'musterweck', qty: 0 },
          ],
        },
        null,
        opts()
      )
    )
    expect(p.items.map((i) => [i.productId, i.quantity])).toEqual([
      ['kornbrot-500g', 2],
    ])
  })
})

describe('status transitions', () => {
  it.each([
    ['offen', 'bereit'],
    ['offen', 'abgeholt'],
    ['offen', 'storniert'],
    ['bereit', 'offen'],
    ['bereit', 'abgeholt'],
    ['bereit', 'storniert'],
    ['abgeholt', 'offen'],
    ['abgeholt', 'bereit'],
    ['storniert', 'offen'],
  ])('%s -> %s is allowed', (from, to) => {
    expect(core.checkTransition(from, to)).toBeNull()
  })

  it.each([
    ['abgeholt', 'storniert', 'already_picked_up'],
    ['storniert', 'abgeholt', 'cancelled'],
    ['storniert', 'bereit', 'cancelled'],
  ])('%s -> %s is locked (409 %s)', (from, to, code) => {
    expect(core.checkTransition(from, to)).toMatchObject({
      error: code,
      status: 409,
    })
  })

  it('sets pickedUpAt only while abgeholt and keeps the first handover time', () => {
    const base = { status: 'offen' }
    const handed = core.normalizeStatusChange(
      base,
      { status: 'abgeholt' },
      { now: NOW }
    )
    expect(handed.changes).toEqual({
      status: 'abgeholt',
      pickedUpAt: NOW,
      notCollectedAt: null,
    })
    const again = core.normalizeStatusChange(
      { status: 'abgeholt', pickedUpAt: '2026-11-01T08:00:00.000Z' },
      { status: 'abgeholt', paid: true },
      { now: NOW }
    )
    expect(again.changes).toMatchObject({
      pickedUpAt: '2026-11-01T08:00:00.000Z',
      paid: true,
    })
    const reset = core.normalizeStatusChange(
      { status: 'abgeholt', pickedUpAt: NOW },
      { status: 'offen' },
      { now: NOW }
    )
    expect(reset.changes.pickedUpAt).toBeNull()
  })

  it('"nicht abgeholt" is bereit + notCollectedAt; it needs bereit and goes with any other status', () => {
    const marked = core.normalizeStatusChange(
      { status: 'offen' },
      { notCollected: true },
      { now: NOW }
    )
    expect(marked.changes).toMatchObject({
      status: 'bereit',
      notCollectedAt: NOW,
    })
    expect(
      core.normalizeStatusChange(
        { status: 'offen' },
        { status: 'abgeholt', notCollected: true }
      ).error
    ).toBe('invalid_not_collected')
    expect(
      core.normalizeStatusChange({ status: 'offen' }, { notCollected: 'ja' })
        .error
    ).toBe('invalid_not_collected')
    // stays while bereit, disappears on the way to abgeholt
    const kept = core.normalizeStatusChange(
      { status: 'bereit', notCollectedAt: NOW },
      { paid: true },
      { now: NOW }
    )
    expect(kept.changes.notCollectedAt).toBe(NOW)
    const picked = core.normalizeStatusChange(
      { status: 'bereit', notCollectedAt: NOW },
      { status: 'abgeholt' },
      { now: NOW }
    )
    expect(picked.changes.notCollectedAt).toBeNull()
    // cancelled -> not collected is the mock lock (cancelled -> not_collected)
    expect(
      core.normalizeStatusChange(
        { status: 'storniert' },
        { notCollected: true }
      ).error
    ).toBe('cancelled')
  })

  it('limits the driver to the handover', () => {
    const fahrer = { allowedTargets: ['abgeholt', 'nicht_abgeholt'] }
    expect(
      core.normalizeStatusChange(
        { status: 'bereit' },
        { status: 'abgeholt', paid: true },
        fahrer
      ).changes.status
    ).toBe('abgeholt')
    expect(
      core.normalizeStatusChange(
        { status: 'bereit' },
        { notCollected: true },
        fahrer
      ).changes.notCollectedAt
    ).toBeTruthy()
    expect(
      core.normalizeStatusChange(
        { status: 'bereit' },
        { status: 'storniert' },
        fahrer
      )
    ).toMatchObject({ error: 'forbidden', status: 403 })
    expect(
      core.normalizeStatusChange(
        { status: 'abgeholt' },
        { status: 'offen' },
        fahrer
      ).status
    ).toBe(403)
  })

  it('refuses every change of an anonymised preorder', () => {
    const anonymised = { status: 'abgeholt', anonymizedAt: NOW, items: [] }
    expect(
      core.normalizeStatusChange(anonymised, { status: 'offen' })
    ).toMatchObject({
      error: 'anonymized',
      status: 409,
    })
    expect(
      core.normalizeOrderInput({ note: 'x' }, anonymised, opts()).error
    ).toBe('anonymized')
  })
})

describe('„nicht abgeholt" not before the pickup day (W4)', () => {
  const ready = { status: 'bereit', pickupDate: '2026-11-21', items: [] }

  it('409 before the pickup day when notCollectedFrom is given', () => {
    const early = core.normalizeStatusChange(
      ready,
      { notCollected: true },
      { notCollectedFrom: '2026-11-20' }
    )
    expect(early).toMatchObject({
      error: 'not_collected_too_early',
      status: 409,
    })
    expect(early.message).toBe(
      '„Nicht abgeholt" geht erst ab dem Abholtag (21.11.2026) - bis dahin kann noch jemand kommen.'
    )
  })

  it('allowed on and after the pickup day', () => {
    for (const today of ['2026-11-21', '2026-11-22']) {
      expect(
        core.normalizeStatusChange(
          ready,
          { notCollected: true },
          { notCollectedFrom: today }
        ).changes
      ).toMatchObject({ status: 'bereit', notCollectedAt: expect.any(String) })
    }
  })

  it('without the option (mock alias) there is no check; clearing is always allowed', () => {
    expect(
      core.normalizeStatusChange(ready, { notCollected: true }).changes
    ).toBeDefined()
    const marked = { ...ready, notCollectedAt: NOW }
    expect(
      core.normalizeStatusChange(
        marked,
        { status: 'bereit', notCollected: false },
        { notCollectedFrom: '2026-11-01' }
      ).changes
    ).toMatchObject({ notCollectedAt: null })
    // already marked: re-sending stays idempotent
    expect(
      core.normalizeStatusChange(
        marked,
        { notCollected: true },
        { notCollectedFrom: '2026-11-01' }
      ).changes
    ).toBeDefined()
  })
})

describe('pickup point text limits (W4)', () => {
  const base = {
    id: 'p',
    name: 'Stelle',
    street: '',
    zip: '',
    city: '',
    weekday: 6,
    window: null,
    orderDeadline: null,
    notes: null,
    active: true,
  }

  it.each([
    ['name', 100, 'Der Name darf höchstens 100 Zeichen lang sein.'],
    ['street', 200, 'Die Straße darf höchstens 200 Zeichen lang sein.'],
    ['zip', 10, 'Die PLZ darf höchstens 10 Zeichen lang sein.'],
    ['city', 100, 'Der Ort darf höchstens 100 Zeichen lang sein.'],
    ['notes', 2000, 'Die Notizen dürfen höchstens 2000 Zeichen lang sein.'],
  ])('%s: %i chars ok, one more is 400', (field, max, message) => {
    expect(
      core.normalizePickupPointInput({ [field]: 'a'.repeat(max) }, base)
        .pickupPoint
    ).toBeDefined()
    expect(
      core.normalizePickupPointInput({ [field]: 'a'.repeat(max + 1) }, base)
    ).toEqual({ error: 'Text too long', message, status: 400 })
  })

  it('measures after trimming and only fields the caller sends', () => {
    expect(
      core.normalizePickupPointInput({ notes: `  ${'a'.repeat(2000)}  ` }, base)
        .pickupPoint.notes
    ).toHaveLength(2000)
    const legacy = { ...base, notes: 'a'.repeat(3000) }
    expect(
      core.normalizePickupPointInput({ window: '09:00-09:30' }, legacy)
        .pickupPoint
    ).toBeDefined()
  })
})

describe('codes', () => {
  it('uses the point prefix or LA for the Laden and counts per prefix and day', () => {
    expect(core.codePrefixFor(null)).toBe('LA')
    expect(core.codePrefixFor('kindergarten-musterdorf')).toBe('MU')
    expect(
      core.nextCode(
        [
          'LA-2026-11-17-01',
          'LA-2026-11-17-07',
          'LA-2026-11-18-09',
          'MU-2026-11-17-12',
        ],
        'LA',
        '2026-11-17'
      )
    ).toBe('LA-2026-11-17-08')
    expect(core.nextCode([], 'LA', '2026-11-17')).toBe('LA-2026-11-17-01')
  })

  it('renews the code only when the day or the place changes', () => {
    expect(core.codeNeedsRenewal('LA-2026-11-17-01', null, '2026-11-17')).toBe(
      false
    )
    expect(core.codeNeedsRenewal('LA-2026-11-17-01', null, '2026-11-18')).toBe(
      true
    )
    expect(
      core.codeNeedsRenewal(
        'LA-2026-11-21-01',
        'kindergarten-musterdorf',
        '2026-11-21'
      )
    ).toBe(true)
  })
})

describe('sums and day summary', () => {
  const list = [
    {
      status: 'offen',
      channel: 'telefon',
      paid: false,
      total: 9.1,
      items: [
        {
          productId: 'zopf-test',
          variant: 'nuss',
          name: 'Testzopf gefüllt',
          quantity: 2,
        },
        {
          productId: 'musterweck',
          variant: '',
          name: 'Musterweck',
          quantity: 2,
        },
      ],
    },
    {
      status: 'bereit',
      notCollectedAt: NOW,
      channel: 'sammelstelle',
      paid: true,
      total: 4.1,
      items: [
        {
          productId: 'zopf-test',
          variant: 'nuss',
          name: 'Testzopf gefüllt',
          quantity: 1,
        },
      ],
    },
    {
      status: 'abgeholt',
      channel: 'laden',
      paid: true,
      total: 4.1,
      items: [
        {
          productId: 'zopf-test',
          variant: 'schoko',
          name: 'Testzopf gefüllt',
          quantity: 1,
        },
      ],
    },
    {
      status: 'storniert',
      channel: 'telefon',
      paid: false,
      total: 41,
      items: [
        {
          productId: 'zopf-test',
          variant: 'nuss',
          name: 'Testzopf gefüllt',
          quantity: 10,
        },
      ],
    },
  ]

  it('sums per product and variant without cancelled preorders', () => {
    expect(core.sumByProductVariant(list)).toEqual([
      {
        productId: 'musterweck',
        variant: '',
        name: 'Musterweck',
        unit: 'Stück',
        quantity: 2,
        preorders: 1,
      },
      {
        productId: 'zopf-test',
        variant: 'nuss',
        name: 'Testzopf gefüllt',
        unit: 'Stück',
        quantity: 3,
        preorders: 2,
      },
      {
        productId: 'zopf-test',
        variant: 'schoko',
        name: 'Testzopf gefüllt',
        unit: 'Stück',
        quantity: 1,
        preorders: 1,
      },
    ])
  })

  it('summarises the day', () => {
    expect(core.summarizeDay(list)).toEqual({
      count: 3,
      total: 17.3,
      byStatus: { offen: 1, bereit: 1, abgeholt: 1, storniert: 1 },
      notCollected: 1,
      paid: 2,
      unpaidTotal: 9.1,
      byChannel: { telefon: 1, sammelstelle: 1, laden: 1 },
    })
  })

  it('sorts the Abholliste by day, place, time (none last) and code', () => {
    const rows = [
      {
        pickupDate: '2026-11-17',
        pickupPointId: null,
        pickupTime: null,
        code: 'LA-2026-11-17-01',
      },
      {
        pickupDate: '2026-11-17',
        pickupPointId: null,
        pickupTime: '08:00',
        code: 'LA-2026-11-17-02',
      },
      {
        pickupDate: '2026-11-16',
        pickupPointId: null,
        pickupTime: '11:00',
        code: 'LA-2026-11-16-01',
      },
    ]
    expect(rows.sort(core.comparePickup).map((r) => r.code)).toEqual([
      'LA-2026-11-16-01',
      'LA-2026-11-17-02',
      'LA-2026-11-17-01',
    ])
  })
})

describe('mock status mapping (alias)', () => {
  it.each([
    [{ status: 'offen' }, 'open'],
    [{ status: 'bereit' }, 'open'],
    [{ status: 'bereit', notCollectedAt: NOW }, 'not_collected'],
    [{ status: 'abgeholt' }, 'handed_over'],
    [{ status: 'storniert' }, 'cancelled'],
  ])('%j -> %s', (record, legacy) => {
    expect(core.toLegacyStatus(record)).toBe(legacy)
  })

  it('maps mock statuses in, keeping bereit on "open"', () => {
    expect(core.fromLegacyStatus('handed_over', { status: 'offen' })).toEqual({
      status: 'abgeholt',
      notCollected: undefined,
    })
    expect(core.fromLegacyStatus('not_collected', {})).toEqual({
      status: 'bereit',
      notCollected: true,
    })
    expect(
      core.fromLegacyStatus('open', { status: 'bereit', notCollectedAt: NOW })
    ).toEqual({
      status: 'bereit',
      notCollected: false,
    })
    expect(core.fromLegacyStatus('open', { status: 'abgeholt' })).toEqual({
      status: 'offen',
      notCollected: undefined,
    })
    expect(core.fromLegacyStatus('cancelled').status).toBe('storniert')
  })

  it('translates the old form body', () => {
    expect(
      core.fromLegacyInput(
        {
          customer: 'Erika Beispiel',
          phone: '0170',
          date: '2026-11-21',
          note: null,
          status: 'open',
          items: [{ productId: 'musterweck', qty: 3 }],
        },
        null
      )
    ).toEqual({
      channel: 'sammelstelle',
      customerName: 'Erika Beispiel',
      customerPhone: '0170',
      pickupDate: '2026-11-21',
      note: null,
      status: 'offen',
      items: [
        {
          productId: 'musterweck',
          quantity: 3,
          variant: undefined,
          name: undefined,
        },
      ],
    })
    // handover means paid (Mörsbach collects at the handover), like the import
    expect(
      core.fromLegacyInput({ status: 'handed_over' }, { status: 'bereit' })
    ).toEqual({
      status: 'abgeholt',
      paid: true,
    })
    // already handed over: paid is left as it is
    expect(
      core.fromLegacyInput({ status: 'handed_over' }, { status: 'abgeholt' })
    ).toEqual({ status: 'abgeholt' })
  })

  it('renders a record in the mock shape, variant in the name', () => {
    const legacy = core.toLegacyPreorder(
      {
        id: 7,
        code: 'MU-2026-11-21-01',
        channel: 'sammelstelle',
        customerName: 'Erika Beispiel',
        customerPhone: null,
        pickupDate: '2026-11-21',
        pickupPointId: POINT.id,
        status: 'abgeholt',
        paid: true,
        note: null,
        pickedUpAt: new Date(NOW),
        createdAt: new Date(NOW),
        updatedAt: new Date(NOW),
        items: [
          {
            productId: 'zopf-test',
            name: 'Testzopf gefüllt',
            variant: 'nuss',
            quantity: 3,
            unit: 'Stück',
            unitPrice: 4.1,
          },
        ],
        total: 12.3,
      },
      POINT,
      '2026-11-10T00:00:00.000Z'
    )
    expect(legacy).toMatchObject({
      id: 7,
      reference: 'MU-2026-11-21-01',
      pickupPointId: POINT.id,
      date: '2026-11-21',
      customer: 'Erika Beispiel',
      status: 'handed_over',
      handedOverAt: NOW,
      total: 12.3,
      afterDeadline: false,
      items: [
        {
          productId: 'zopf-test',
          name: 'Testzopf gefüllt (nuss)',
          qty: 3,
          unitPrice: 4.1,
          lineTotal: 12.3,
          variant: 'nuss',
        },
      ],
    })
    expect(typeof legacy.deadline).toBe('string')
  })

  it('refuses old-form item lists that would drop variants', () => {
    const current = [
      { productId: 'zopf-test', variant: 'nuss' },
      { productId: 'musterweck', variant: '' },
    ]
    expect(
      core.legacyItemsLoseVariants(current, [
        { productId: 'zopf-test', qty: 1 },
      ])
    ).toBe(true)
    expect(
      core.legacyItemsLoseVariants(current, [
        { productId: 'musterweck', qty: 1 },
      ])
    ).toBe(false)
    expect(
      core.legacyItemsLoseVariants(current, [
        { productId: 'zopf-test', qty: 1, variant: 'nuss' },
      ])
    ).toBe(false)
    expect(core.legacyItemsLoseVariants(current, undefined)).toBe(false)
    expect(
      core.legacyItemsLoseVariants(
        [{ productId: 'musterweck', variant: '' }],
        [{ productId: 'musterweck' }]
      )
    ).toBe(false)
  })
})

describe('import mapping', () => {
  const legacy = {
    id: 3,
    reference: 'MU-2026-09-12-03',
    pickupPointId: POINT.id,
    date: '2026-09-12',
    customer: 'Erika Beispiel',
    phone: '0170 1234567',
    items: [
      {
        productId: 'musterweck',
        name: 'Musterweck',
        qty: 4,
        unit: 'Stück',
        unitPrice: 0.45,
        lineTotal: 1.8,
      },
    ],
    total: 1.8,
    note: 'vor dem Eingang',
    status: 'handed_over',
    handedOverAt: '2026-09-12T07:10:00.000Z',
    createdAt: '2026-09-10T10:00:00.000Z',
    updatedAt: '2026-09-12T07:10:00.000Z',
  }

  it('maps a mock preorder to a record: sammelstelle, handed over = paid, snapshot prices', () => {
    expect(core.legacyPreorderToRecord(legacy).record).toEqual({
      code: 'MU-2026-09-12-03',
      channel: 'sammelstelle',
      customerName: 'Erika Beispiel',
      customerPhone: '01701234567',
      pickupDate: '2026-09-12',
      pickupTime: null,
      pickupPointId: POINT.id,
      status: 'abgeholt',
      paid: true,
      note: 'vor dem Eingang',
      pickedUpAt: '2026-09-12T07:10:00.000Z',
      notCollectedAt: null,
      createdAt: '2026-09-10T10:00:00.000Z',
      updatedAt: '2026-09-12T07:10:00.000Z',
      items: [
        {
          productId: 'musterweck',
          name: 'Musterweck',
          variant: '',
          unit: 'Stück',
          unitPrice: 0.45,
          quantity: 4,
        },
      ],
    })
  })

  it('maps not_collected and cancelled', () => {
    const nc = core.legacyPreorderToRecord({
      ...legacy,
      status: 'not_collected',
    }).record
    expect(nc).toMatchObject({
      status: 'bereit',
      paid: false,
      pickedUpAt: null,
      notCollectedAt: legacy.updatedAt,
    })
    expect(
      core.legacyPreorderToRecord({ ...legacy, status: 'cancelled' }).record
        .status
    ).toBe('storniert')
  })

  it.each([
    [{ reference: '' }, 'ohne gültige Referenz'],
    [{ date: '2026-13-01' }, 'ohne gültiges Datum'],
    [{ pickupPointId: null }, 'ohne Sammelstelle'],
    [{ status: 'lost' }, 'unbekannter Status „lost“'],
    [
      { items: [{ productId: 'musterweck', qty: 0, unitPrice: 1 }] },
      'ohne Positionen',
    ],
  ])('skips %j (%s)', (patch, reason) => {
    expect(core.legacyPreorderToRecord({ ...legacy, ...patch })).toEqual({
      skip: reason,
    })
  })
})

describe('P4 anonymisation', () => {
  it('computes the cutoff 90 days back', () => {
    expect(core.anonymizeCutoff('2026-11-05')).toBe('2026-08-07')
    expect(core.anonymizeCutoff('2026-03-01', 1)).toBe('2026-02-28')
    expect(core.anonymizeCutoff('2026-02-30')).toBeNull()
    expect(core.anonymizeCutoff('2026-11-05', 0)).toBeNull()
  })

  it.each([
    [{ status: 'abgeholt', pickupDate: '2026-08-06' }, true],
    [{ status: 'storniert', pickupDate: '2026-08-06' }, true],
    [{ status: 'bereit', notCollectedAt: NOW, pickupDate: '2026-08-06' }, true],
    [{ status: 'abgeholt', pickupDate: '2026-08-07' }, false],
    // 90 days after pickup the status no longer matters (P4)
    [{ status: 'offen', pickupDate: '2026-01-01' }, true],
    [{ status: 'bereit', pickupDate: '2026-08-06' }, true],
    [{ status: 'offen', pickupDate: '2026-08-07' }, false],
    [
      { status: 'abgeholt', pickupDate: '2026-01-01', anonymizedAt: NOW },
      false,
    ],
  ])('%j due: %s', (preorder, due) => {
    expect(core.isDueForAnonymization(preorder, '2026-08-07')).toBe(due)
  })

  it.each([
    [{ status: 'offen' }, true],
    [{ status: 'bereit' }, true],
    [{ status: 'bereit', notCollectedAt: NOW }, false],
    [{ status: 'abgeholt' }, false],
    [{ status: 'storniert' }, false],
  ])('%j was unfinished: %s', (preorder, unfinished) => {
    expect(core.wasUnfinished(preorder)).toBe(unfinished)
  })
})

describe('parseQuantity (strict, no silent truncation)', () => {
  it.each([
    [3, 3],
    [0, 0],
    ['4', 4],
    [' 5 ', 5],
    [2.7, null],
    [-1, null],
    ['abc', null],
    ['2.5', null],
    ['', null],
    [null, null],
    [undefined, null],
    [true, null],
    [Number.NaN, null],
  ])('%j -> %j', (value, expected) => {
    expect(core.parseQuantity(value)).toBe(expected)
  })
})
