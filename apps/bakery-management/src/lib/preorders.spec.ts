import {
  filtersFromQuery,
  formatShortDate,
  isProductionDay,
  jsWeekdayOf,
  nextProductionDate,
  nextProductionDates,
  pickupPointDates,
  variantLabel,
  canWritePreorders,
  preorderPatch,
  paymentRowText,
  paymentState,
  owesRefund,
  type PreorderInput,
} from './preordersTypes'
import { preorderListQuery, preorderPageQuery } from './preordersApi'
import { preorder } from './testing/preorderFixtures'
import {
  frequentProducts,
  matchRank,
  normalizeSearch,
  quickProducts,
  searchProducts,
} from './productSearch'
import { nextQuantity } from '../components/preorders/QuantityPad'

describe('Produktionstage', () => {
  it('Montag ist Ruhetag, Di-So wird gebacken', () => {
    expect(isProductionDay('2026-11-16')).toBe(false) // Mo
    expect(isProductionDay('2026-11-17')).toBe(true) // Di
    expect(isProductionDay('2026-11-22')).toBe(true) // So
    expect(isProductionDay('2026-02-30')).toBe(false)
  })

  it('nächster Produktionstag ab morgen, Montag übersprungen', () => {
    expect(nextProductionDate('2026-11-12')).toBe('2026-11-13')
    expect(nextProductionDate('2026-11-15')).toBe('2026-11-17') // So → Di
    expect(nextProductionDates('2026-11-14', 3)).toEqual([
      '2026-11-15',
      '2026-11-17',
      '2026-11-18',
    ])
  })

  it('Liefertage einer Sammelstelle (Date.getDay)', () => {
    expect(pickupPointDates({ weekday: 6 }, '2026-11-12', 2)).toEqual([
      '2026-11-14',
      '2026-11-21',
    ])
    // am Liefertag selbst: der nächste
    expect(pickupPointDates({ weekday: 6 }, '2026-11-14', 1)).toEqual([
      '2026-11-21',
    ])
    expect(pickupPointDates({ weekday: 9 }, '2026-11-14', 1)).toEqual([])
    expect(jsWeekdayOf('2026-11-15')).toBe(0)
    expect(formatShortDate('2026-11-14')).toBe('Sa 14.11.')
  })
})

describe('Zahlungsstand (W4-verify r3)', () => {
  it('Rest, Erstattung, bezahlt, unbezahlt', () => {
    const rest = preorder({ paid: true, paymentBalance: 36, total: 83 })
    const refund = preorder({ paid: true, paymentBalance: -36, total: 47 })
    const cancelled = preorder({
      status: 'storniert',
      paid: true,
      paymentBalance: -9,
    })
    expect(paymentState(rest)).toEqual({ kind: 'rest', amount: 36 })
    expect(paymentState(refund)).toEqual({ kind: 'refund', amount: 36 })
    expect(owesRefund(cancelled)).toBe(true)
    expect(owesRefund(rest)).toBe(false)
    expect(paymentRowText(rest)).toMatch(/^bezahlt · Rest 36,00\s€ offen$/)
    expect(paymentRowText(refund)).toMatch(/^bezahlt · 36,00\s€ erstatten$/)
    expect(paymentRowText(preorder({ paid: true, paymentBalance: 0 }))).toBe(
      'bezahlt'
    )
    expect(paymentRowText(preorder({ paid: false }))).toBe('')
  })
})

describe('Anzeige und Rechte', () => {
  it('Sortenname', () => {
    expect(variantLabel('nuss')).toBe('Nuss')
    expect(variantLabel('schoko-kirsch')).toBe('Schoko-Kirsch')
    expect(variantLabel('')).toBe('')
  })

  it('nur Verkauf und Inhaber schreiben', () => {
    expect(canWritePreorders('verkauf')).toBe(true)
    expect(canWritePreorders('inhaber')).toBe(true)
    expect(canWritePreorders('fahrer')).toBe(false)
    expect(canWritePreorders(null)).toBe(false)
  })
})

describe('Listenfilter', () => {
  it('liest die URL und lässt Ungültiges weg', () => {
    expect(
      filtersFromQuery({
        date: '2026-11-14',
        from: '2026-11-01',
        status: 'offen,quatsch,bereit',
        channel: 'fax',
        pickupPointId: 'laden',
        q: '  Erika ',
      })
    ).toEqual({
      date: '2026-11-14',
      status: ['offen', 'bereit'],
      pickupPointId: 'laden',
      q: 'Erika',
    })
    expect(filtersFromQuery({ from: '2026-13-01' })).toBeUndefined()
    expect(filtersFromQuery({})).toBeUndefined()
  })

  it('baut die Query für die API (date schlägt from/to)', () => {
    expect(
      preorderListQuery({
        date: '2026-11-14',
        from: '2026-11-01',
        status: ['offen', 'bereit'],
        q: ' 0170 ',
      })
    ).toBe('date=2026-11-14&status=offen%2Cbereit&q=0170')
    expect(preorderListQuery({ from: '2026-11-01', to: '2026-11-30' })).toBe(
      'from=2026-11-01&to=2026-11-30'
    )
    expect(preorderListQuery({ q: '  ' })).toBe('')
  })

  it('„Alle Tage" überlebt den Weg über die URL', () => {
    expect(preorderPageQuery({})).toBe('range=alle')
    expect(preorderPageQuery({ status: ['offen'] })).toBe(
      'status=offen&range=alle'
    )
    expect(preorderPageQuery({ from: '2026-11-12' })).toBe('from=2026-11-12')
    expect(filtersFromQuery({ range: 'alle' })).toEqual({})
    expect(filtersFromQuery({ status: 'offen', range: 'alle' })).toEqual({
      status: ['offen'],
    })
    // ein Zeitraum schlägt den Marker
    expect(filtersFromQuery({ from: '2026-11-12', range: 'alle' })).toEqual({
      from: '2026-11-12',
    })
    expect(filtersFromQuery({ range: 'quatsch' })).toBeUndefined()
  })
})

describe('Ändern schickt nur Geändertes (preorderPatch)', () => {
  const loaded = preorder()
  const unchanged: PreorderInput = {
    channel: loaded.channel,
    customerName: loaded.customerName ?? '',
    customerPhone: loaded.customerPhone,
    pickupDate: loaded.pickupDate,
    pickupPointId: loaded.pickupPointId,
    pickupTime: loaded.pickupTime,
    items: loaded.items.map((i) => ({
      productId: i.productId,
      variant: i.variant,
      quantity: i.quantity,
    })),
    paid: loaded.paid,
    note: loaded.note,
  }

  it('nur die Notiz: kein paid, keine Positionen, kein Tag', () => {
    expect(preorderPatch(loaded, unchanged)).toEqual({})
    expect(
      preorderPatch(loaded, { ...unchanged, note: 'Bitte schneiden' })
    ).toEqual({ note: 'Bitte schneiden' })
  })

  it('Positionen nur bei echter Änderung, Reihenfolge egal', () => {
    const items = [
      { productId: 'musterweck', variant: '', quantity: 1 },
      ...unchanged.items,
    ]
    expect(preorderPatch(loaded, { ...unchanged, items })).toEqual({ items })
    expect(
      preorderPatch(loaded, { ...unchanged, items: [...unchanged.items] })
    ).toEqual({})
  })

  it('Wechsel an die Sammelstelle nimmt Uhrzeit und Bestellweg mit', () => {
    expect(
      preorderPatch(loaded, {
        ...unchanged,
        channel: 'sammelstelle',
        pickupPointId: 'kita-test',
        pickupTime: null,
        pickupDate: '2026-11-14',
        paid: true,
      })
    ).toEqual({
      channel: 'sammelstelle',
      pickupPointId: 'kita-test',
      pickupTime: null,
      pickupDate: '2026-11-14',
      paid: true,
    })
  })
})

describe('Produktsuche', () => {
  const products = [
    { productId: 'kornbrot-500g', name: 'Kornbrot 500g' },
    { productId: 'kornbrot-1000g', name: 'Kornbrot 1000g' },
    { productId: 'zopf', name: 'Zopf gefüllt' },
    { productId: 'broetchen', name: 'Laugenbrötchen' },
  ]

  it('normalisiert Umlaute und Satzzeichen', () => {
    expect(normalizeSearch('Brötchen, Süß!')).toBe('broetchen suess')
  })

  it('findet unscharf und sortiert Anfang vor Teilstring vor Buchstabenfolge', () => {
    expect(searchProducts(products, 'korn').map((p) => p.productId)).toEqual([
      'kornbrot-500g',
      'kornbrot-1000g',
    ])
    expect(searchProducts(products, 'gefullt')[0].productId).toBe('zopf')
    expect(searchProducts(products, 'brotchen')[0].productId).toBe('broetchen')
    expect(searchProducts(products, 'zopf gef')[0].productId).toBe('zopf')
    expect(searchProducts(products, 'xyz')).toEqual([])
    expect(matchRank('Kornbrot', '')).toBeNull()
  })

  it('häufig vorbestellt: je Bestellung einmal, Stornierte zählen nicht', () => {
    const list = [
      { items: [{ productId: 'zopf' }, { productId: 'zopf' }] },
      { items: [{ productId: 'kornbrot-500g' }] },
      { items: [{ productId: 'kornbrot-500g' }] },
      { status: 'storniert', items: [{ productId: 'zopf' }] },
      { items: [{ productId: 'gibt-es-nicht' }] },
    ]
    expect(frequentProducts(list, products).map((p) => p.productId)).toEqual([
      'kornbrot-500g',
      'zopf',
    ])
  })

  it('Schnellknöpfe: zuletzt benutzte zuerst, ohne Doppelte', () => {
    const frequent = [products[0], products[2]]
    expect(
      quickProducts(['zopf', 'weg'], frequent, products, 3).map(
        (p) => p.productId
      )
    ).toEqual(['zopf', 'kornbrot-500g'])
  })
})

describe('Ziffernblock', () => {
  it('ersetzt die vorbelegte Menge mit der ersten Ziffer', () => {
    expect(nextQuantity('1', '3', true)).toBe('3')
    expect(nextQuantity('3', '2', false)).toBe('32')
    expect(nextQuantity('0', '5', false)).toBe('5')
  })

  it('nimmt nicht mehr als 99 an; löschen und leeren', () => {
    expect(nextQuantity('99', '1', false)).toBe('99')
    expect(nextQuantity('12', 'Backspace', false)).toBe('1')
    expect(nextQuantity('1', 'Backspace', true)).toBe('')
    expect(nextQuantity('12', 'Clear', false)).toBe('')
    expect(nextQuantity('12', 'x', false)).toBe('12')
  })
})
