/**
 * Tests für die Prüfung von Shop-Bestellungen (`POST /api/orders`).
 *
 * Der Core ist dependency-frei - dieser Test braucht deshalb keine Mocks.
 * Produkte werden über `lookupProduct` hereingereicht, so wie der Mock-Server
 * es mit den `hq`-Produkten tut.
 */

const {
  MAX_QUANTITY_PER_ITEM,
  berlinToday,
  isCalendarDate,
  roundCents,
  validateShopOrder,
} = require('../../src/services/shop-orders.core')

const TODAY = '2026-09-01'

const HQ = {
  'kornbrot-500g': {
    id: 'kornbrot-500g',
    numeric_id: 1,
    name: 'Kornbrot 500g',
    price: 2.5,
    available: true,
  },
  brezel: {
    id: 'brezel',
    numeric_id: 46,
    name: 'Brezel',
    price: 0.9,
    available: true,
  },
  'saison-stollen': {
    id: 'saison-stollen',
    numeric_id: 200,
    name: 'Stollen',
    price: 12,
    available: false,
  },
}

const lookupProduct = (productId) =>
  Object.values(HQ).find(
    (p) => p.id === productId || String(p.numeric_id) === productId
  ) || null

function validBody(overrides) {
  return {
    customerName: 'Erika Mustermann',
    phone: '06841 123456',
    email: 'erika@beispiel.de',
    pickupDate: '2026-09-02',
    pickupTime: '09:00',
    notes: 'Brot bitte ungeschnitten.',
    items: [
      {
        productId: 'kornbrot-500g',
        name: 'Kornbrot 500g',
        quantity: 2,
        price: 2.5,
      },
      { productId: 'brezel', name: 'Brezel', quantity: 3, price: 0.9 },
    ],
    total: 7.7,
    ...overrides,
  }
}

function check(body, options) {
  return validateShopOrder(body, { lookupProduct, todayIso: TODAY, ...options })
}

describe('validateShopOrder - gültige Bestellung', () => {
  it('übernimmt genau die bekannten Felder und rechnet die Summe selbst', () => {
    const result = check(
      validBody({ total: 0.01, isAdmin: true, status: 'completed' })
    )
    expect(result.ok).toBe(true)
    expect(result.order).toEqual({
      customerName: 'Erika Mustermann',
      phone: '06841 123456',
      email: 'erika@beispiel.de',
      pickupDate: '2026-09-02',
      pickupTime: '09:00',
      notes: 'Brot bitte ungeschnitten.',
      items: [
        {
          productId: 'kornbrot-500g',
          name: 'Kornbrot 500g',
          quantity: 2,
          price: 2.5,
        },
        { productId: 'brezel', name: 'Brezel', quantity: 3, price: 0.9 },
      ],
      total: 7.7,
    })
    expect(result.order).not.toHaveProperty('isAdmin')
    expect(result.order).not.toHaveProperty('status')
  })

  it('nimmt Preis und Name aus hq, nicht aus dem Warenkorb', () => {
    const result = check(
      validBody({
        items: [
          {
            productId: 'kornbrot-500g',
            name: 'Gratisbrot',
            quantity: 1,
            price: 0,
          },
        ],
      })
    )
    expect(result.ok).toBe(true)
    expect(result.order.items[0]).toEqual({
      productId: 'kornbrot-500g',
      name: 'Kornbrot 500g',
      quantity: 1,
      price: 2.5,
    })
    expect(result.order.total).toBe(2.5)
  })

  it('löst auch die numerische ID auf (Altbestand im localStorage)', () => {
    const result = check(
      validBody({
        items: [{ productId: '46', name: 'Brezel', quantity: 1, price: 0.9 }],
      })
    )
    expect(result.ok).toBe(true)
    expect(result.order.items[0].productId).toBe('46')
    expect(result.order.items[0].name).toBe('Brezel')
  })

  it('lässt E-Mail und Anmerkungen weg, wenn sie leer sind', () => {
    const result = check(validBody({ email: '  ', notes: undefined }))
    expect(result.ok).toBe(true)
    expect(result.order).not.toHaveProperty('email')
    expect(result.order).not.toHaveProperty('notes')
  })

  it('rundet die Summe auf Cent', () => {
    // 3 × 0,9 = 2,7000000000000006 in Fließkomma.
    const result = check(
      validBody({
        items: [
          { productId: 'brezel', name: 'Brezel', quantity: 3, price: 0.9 },
        ],
      })
    )
    expect(result.order.total).toBe(2.7)
  })

  it('kommt ohne lookupProduct aus und glaubt dann dem Body', () => {
    const result = validateShopOrder(validBody(), { todayIso: TODAY })
    expect(result.ok).toBe(true)
    expect(result.order.total).toBe(7.7)
  })
})

describe('validateShopOrder - Ablehnungen tragen eine deutsche message', () => {
  it.each([
    [null, 'body', 'Die Bestellung ist unvollständig.'],
    [[], 'body', 'Die Bestellung ist unvollständig.'],
    [{}, 'customerName', 'Bitte geben Sie Ihren Namen ein.'],
    [
      validBody({ customerName: 'E' }),
      'customerName',
      'Bitte geben Sie Ihren vollständigen Namen ein.',
    ],
    [
      validBody({ customerName: 'x'.repeat(101) }),
      'customerName',
      'Der Name darf höchstens 100 Zeichen lang sein.',
    ],
    [
      validBody({ phone: '' }),
      'phone',
      'Bitte geben Sie Ihre Telefonnummer ein.',
    ],
    [
      validBody({ phone: 'ruf mich an' }),
      'phone',
      'Bitte geben Sie eine gültige Telefonnummer ein.',
    ],
    [
      validBody({ phone: '12345' }),
      'phone',
      'Bitte geben Sie eine gültige Telefonnummer ein.',
    ],
    [
      validBody({ email: 'erika(at)beispiel' }),
      'email',
      'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    ],
    [
      validBody({ email: 42 }),
      'email',
      'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    ],
    [
      validBody({ pickupDate: '' }),
      'pickupDate',
      'Bitte wählen Sie ein Abholdatum.',
    ],
    [
      validBody({ pickupDate: '02.09.2026' }),
      'pickupDate',
      'Bitte geben Sie ein gültiges Datum an.',
    ],
    [
      validBody({ pickupDate: '2026-02-31' }),
      'pickupDate',
      'Bitte geben Sie ein gültiges Datum an.',
    ],
    [
      validBody({ pickupDate: '2026-08-31' }),
      'pickupDate',
      'Das Abholdatum darf nicht in der Vergangenheit liegen.',
    ],
    [
      validBody({ pickupTime: '' }),
      'pickupTime',
      'Bitte wählen Sie eine Abholzeit.',
    ],
    [
      validBody({ pickupTime: '9 Uhr' }),
      'pickupTime',
      'Bitte geben Sie eine gültige Abholzeit an.',
    ],
    [
      validBody({ pickupTime: '25:00' }),
      'pickupTime',
      'Bitte geben Sie eine gültige Abholzeit an.',
    ],
    [
      validBody({ notes: 'x'.repeat(501) }),
      'notes',
      'Bitte fassen Sie sich etwas kürzer (höchstens 500 Zeichen).',
    ],
    [validBody({ items: [] }), 'items', 'Ihr Warenkorb ist leer.'],
    [validBody({ items: 'kornbrot' }), 'items', 'Ihr Warenkorb ist leer.'],
  ])('%#: lehnt ab mit %s → "%s"', (body, field, message) => {
    const result = check(body)
    expect(result).toEqual({ ok: false, field, message })
  })

  it('heute ist noch erlaubt', () => {
    expect(check(validBody({ pickupDate: TODAY })).ok).toBe(true)
  })

  it.each([0, -1, 1.5, MAX_QUANTITY_PER_ITEM + 1, '2', undefined])(
    'lehnt die Menge %p ab',
    (quantity) => {
      const result = check(
        validBody({
          items: [
            { productId: 'brezel', name: 'Brezel', quantity, price: 0.9 },
          ],
        })
      )
      expect(result.ok).toBe(false)
      expect(result.field).toBe('items')
      expect(result.message).toContain('Menge zwischen 1 und 99')
    }
  )

  it('lehnt ein unbekanntes Produkt ab und nennt es beim Namen', () => {
    const result = check(
      validBody({
        items: [
          {
            productId: 'bauernbrot',
            name: 'Bauernbrot',
            quantity: 1,
            price: 3,
          },
        ],
      })
    )
    expect(result.ok).toBe(false)
    expect(result.message).toBe(
      '„Bauernbrot“ gibt es bei uns nicht mehr. Bitte entfernen Sie den Artikel aus dem Warenkorb.'
    )
  })

  it('lehnt ein nicht verfügbares Produkt ab', () => {
    const result = check(
      validBody({
        items: [
          {
            productId: 'saison-stollen',
            name: 'Stollen',
            quantity: 1,
            price: 12,
          },
        ],
      })
    )
    expect(result.ok).toBe(false)
    expect(result.message).toContain('„Stollen“ ist zur Zeit nicht verfügbar')
  })

  it('lehnt einen Artikel ohne Produkt-ID ab', () => {
    const result = check(
      validBody({ items: [{ name: 'Brezel', quantity: 1, price: 0.9 }] })
    )
    expect(result).toEqual({
      ok: false,
      field: 'items',
      message: 'Ein Artikel im Warenkorb ist unvollständig.',
    })
  })

  it('lehnt ohne lookupProduct einen negativen Preis ab', () => {
    const result = validateShopOrder(
      validBody({
        items: [
          { productId: 'brezel', name: 'Brezel', quantity: 1, price: -1 },
        ],
      }),
      { todayIso: TODAY }
    )
    expect(result.ok).toBe(false)
    expect(result.message).toBe(
      'Ein Artikel im Warenkorb hat keinen gültigen Preis.'
    )
  })

  it('lehnt zu viele Positionen ab', () => {
    const items = Array.from({ length: 51 }, () => ({
      productId: 'brezel',
      name: 'Brezel',
      quantity: 1,
      price: 0.9,
    }))
    const result = check(validBody({ items }))
    expect(result.ok).toBe(false)
    expect(result.message).toContain('höchstens 50')
  })
})

describe('Hilfsfunktionen', () => {
  it('berlinToday rechnet in Europa/Berlin, nicht in UTC', () => {
    // 22:30 UTC am 1. September ist in Berlin (MESZ, UTC+2) schon der 2.
    expect(berlinToday(new Date('2026-09-01T22:30:00Z'))).toBe('2026-09-02')
    // Winterzeit (MEZ, UTC+1): 23:30 UTC ist ebenfalls schon der nächste Tag.
    expect(berlinToday(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-16')
    expect(berlinToday(new Date('2026-01-15T22:30:00Z'))).toBe('2026-01-15')
  })

  it('isCalendarDate kennt Schaltjahre und Überläufe', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true)
    expect(isCalendarDate('2026-02-29')).toBe(false)
    expect(isCalendarDate('2026-13-01')).toBe(false)
    expect(isCalendarDate('2026-9-2')).toBe(false)
  })

  it('roundCents rundet kaufmännisch auf zwei Stellen', () => {
    expect(roundCents(2.7000000000000006)).toBe(2.7)
    expect(roundCents(1.005)).toBe(1)
    expect(roundCents(4.4 * 3)).toBe(13.2)
  })
})
