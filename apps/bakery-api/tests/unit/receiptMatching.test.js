const {
  booking,
  proposeMatches,
  markAmbiguity,
  replacementBookings,
  expensesWithoutReceipt,
} = require('../../src/services/receipt-matching.core')

const exampleIban = 'DE89370400440532013000'
const receipt = (patch = {}) => ({
  kind: 'receipt',
  receipt_kind: 'eingangsrechnung',
  target_id: 1,
  supplier_name: 'Beispiel-Mühle GmbH',
  invoice_number: 'BM-0815',
  invoice_date: '2026-11-12',
  due_date: '2026-11-22',
  gross_cents: 12345,
  currency: 'EUR',
  payment: 'offen',
  status: 'erkannt',
  ...patch,
})
const tx = (patch = {}) =>
  booking({
    id: 'abcd1234',
    amount: -123.45,
    booking_date: '2026-11-20',
    counterparty: '  BEISPIEL-MÜHLE  GMBH  ',
    purpose: 'Testzahlung',
    ...patch,
  })
const offers = (targets, bookings, links = []) =>
  proposeMatches(targets, bookings, links)

it('wertet Nummer, IBAN und exakten Betrag stärker als den reinen Betrag', () => {
  const exactOnly = tx({ id: 'bbbb1234', counterparty: 'Testfirma' })
  const named = tx({ id: 'cccc1234', purpose: 'Bezug BM-08151' })
  const referenced = tx({
    purpose: 'Zahlung ＢＭ-０８１５;',
    counterparty_iban: exampleIban,
  })
  const matched = offers(
    [receipt({ supplier_iban: exampleIban })],
    [named, exactOnly, referenced]
  )
  expect(matched.map((entry) => entry.parts[0].transaction_id)).toEqual([
    'abcd1234',
    'cccc1234',
    'bbbb1234',
  ])
  expect(matched.map((entry) => entry.score)).toEqual([179, 97, 72])
})

it('verwendet das Datumsfenster einschließlich der Grenzen', () => {
  const days = ['2026-11-08', '2026-11-09', '2026-12-06', '2026-12-07']
  const bookings = days.map((booking_date, i) =>
    tx({ id: 'abcd123' + i, booking_date })
  )
  expect(
    offers([receipt()], bookings).map((entry) => entry.parts[0].transaction_id)
  ).toEqual(['abcd1231', 'abcd1232'])
  expect(
    offers([receipt({ due_date: null })], [tx({ booking_date: '2026-12-27' })])
  ).toHaveLength(1)
  expect(
    offers([receipt({ due_date: null })], [tx({ booking_date: '2026-12-28' })])
  ).toHaveLength(0)
})

it('verwendet angegebenes Skonto innerhalb der Frist', () => {
  const target = receipt({ skonto_rate: 2, skonto_due_date: '2026-11-20' })
  const discount = offers([target], [tx({ amount: -120.98 })])[0]
  expect(discount).toMatchObject({
    type: 'skonto',
    parts: [{ amount_cents: 12098, discount_cents: 247 }],
  })
  expect(offers([target], [tx()])[0].score).toBeGreaterThan(discount.score)
  expect(
    offers([target], [tx({ amount: -120.98, booking_date: '2026-11-21' })]).map(
      (offer) => offer.type
    )
  ).toEqual(['teilzahlung'])
  expect(
    offers([receipt()], [tx({ amount: -120.98 })]).map((offer) => offer.type)
  ).toEqual(['teilzahlung'])
})

it('beachtet die Richtung sowie Gutschriften, Barzahlung und Ausgangsrechnungen', () => {
  const inTx = tx({ amount: 123.45, purpose: 'BM-0815' })
  expect(offers([receipt()], [inTx])).toEqual([])
  expect(offers([receipt({ payment: 'bar' })], [tx()])).toEqual([])
  expect(
    offers([receipt({ receipt_kind: 'gutschrift' })], [tx(), inTx])
  ).toHaveLength(1)
  expect(
    offers([receipt({ kind: 'invoice' })], [tx(), inTx])[0].parts[0].kind
  ).toBe('invoice')
  expect(
    offers(
      [receipt({ kind: 'invoice' })],
      [tx({ amount: 123.45, counterparty: 'Unbekannte Testfirma' })]
    )
  ).toEqual([])
})

it.each([2, 3, 4, 5, 6])(
  'schlägt bei einer Sammellastschrift %i offene Belege gemeinsam vor',
  (count) => {
    const receipts = Array.from({ length: count }, (_, index) =>
      receipt({ target_id: index + 1, gross_cents: 1000 })
    )
    const debit = tx({ amount: -10 * count, mandate_reference: 'TEST' })
    const result = offers(receipts, [debit])
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('sammellastschrift')
    expect(result[0].parts).toHaveLength(count)
    expect(
      offers(
        [...receipts.slice(1), { ...receipts[0], supplier_name: 'Testfirma' }],
        [debit]
      )
    ).toEqual([])
    expect(offers(receipts, [tx({ amount: -10 * count })])).toEqual([])
  }
)

it('addiert mehrere Teilzahlungen und berücksichtigt bereits bestätigte Anteile', () => {
  const first = tx({ amount: -100 })
  const second = tx({ id: '1234abcd', amount: -23.45 })
  expect(offers([receipt()], [first, second])[0]).toMatchObject({
    type: 'teilzahlungen',
    parts: [{ amount_cents: 2345 }, { amount_cents: 10000 }],
  })
  const existing = {
    kind: 'receipt',
    target_id: 1,
    transaction_id: first.id,
    amount_cents: 10000,
    status: 'bestaetigt',
  }
  expect(offers([receipt()], [first, second], [existing])).toMatchObject([
    {
      type: 'betrag',
      parts: [{ transaction_id: second.id, amount_cents: 2345 }],
    },
  ])
})

it('stellt ähnlich starke Treffer nebeneinander und erhält den Vormerkungsstatus', () => {
  const results = markAmbiguity(
    offers([receipt()], [tx({ status: 'vorgemerkt' }), tx({ id: 'abcd1235' })])
  )
  expect(results.map((offer) => offer.ambiguous)).toEqual([true, true])
  expect(tx({ status: 'vorgemerkt' }).status).toBe('vorgemerkt')
})

it('verwendet den Schnappschuss bei fehlender ID und unterdrückt abgelehnte Vorschläge', () => {
  const pending = tx({ status: 'vorgemerkt' })
  const booked = tx({ id: 'deaf1234', booking_date: '2026-11-23' })
  const link = {
    kind: 'receipt',
    target_id: 1,
    transaction_id: pending.id,
    booking_date: pending.booking_date,
    booking_amount_cents: pending.cents,
    counterparty_key: pending.key,
    amount_cents: 12345,
    status: 'abgelehnt',
  }
  expect(replacementBookings(link, [booked])).toEqual([booked])
  expect(replacementBookings(link, [pending, booked])).toEqual([])
  expect(
    replacementBookings(link, [
      tx({ id: 'deaf1234', booking_date: '2026-11-24' }),
    ])
  ).toEqual([])
  expect(offers([receipt()], [booked], [link])).toEqual([])
  expect(offers([receipt()], [pending, booked], [link])).toMatchObject([
    { parts: [{ transaction_id: booked.id }] },
  ])
})

it('listet Ausgaben ohne bestätigten Link abzüglich konfigurierter Kategorien', () => {
  const debits = [
    tx(),
    tx({ id: 'abca0000' }),
    tx({ id: 'abca1111', classification: { category: 'beispiel_ausnahme' } }),
  ]
  const links = [
    { transaction_id: debits[0].id, amount_cents: 12345, status: 'bestaetigt' },
    { transaction_id: debits[1].id, status: 'abgelehnt' },
  ]
  expect(
    expensesWithoutReceipt([...debits, tx({ amount: 1 })], links, [
      'beispiel_ausnahme',
    ])
  ).toEqual([{ ...debits[1], remaining_cents: 12345 }])
})

it('erkennt dieselbe Lieferanten-IBAN auch bei abweichender Schreibweise der Namen', () => {
  const targets = [
    receipt({ supplier_iban: exampleIban, gross_cents: 1000 }),
    receipt({
      target_id: 2,
      supplier_name: 'Beispiel-Mühle',
      supplier_iban: exampleIban,
      gross_cents: 2000,
    }),
  ]
  const debit = tx({
    amount: -30,
    counterparty_iban: exampleIban,
    mandate_reference: 'TEST',
  })
  const result = offers(targets, [debit])
  expect(result).toMatchObject([
    { type: 'sammellastschrift', parts: [{ target_id: 1 }, { target_id: 2 }] },
  ])
})

it.each([
  [2, -120.98],
  [3, -119.75],
])(
  'schlägt bei bekannter Frist %i %% Skonto mit geringerem Gewicht vor',
  (rate, amount) => {
    const skonto_due_date = '2026-11-20'
    const inferred = offers([receipt({ skonto_due_date })], [tx({ amount })])[0]
    const explicit = offers(
      [receipt({ skonto_due_date, skonto_rate: rate })],
      [tx({ amount })]
    )[0]
    expect(inferred).toMatchObject({
      type: 'skonto',
      estimated_skonto_rate: rate,
    })
    expect(inferred.score).toBeLessThan(explicit.score)
    expect(explicit).not.toHaveProperty('estimated_skonto_rate')
    expect(
      offers(
        [receipt({ skonto_due_date })],
        [tx({ amount, booking_date: '2026-11-21' })]
      )
    ).toMatchObject([{ type: 'teilzahlung' }])
    expect(
      offers([receipt({ skonto_due_date, skonto_rate: 1 })], [tx({ amount })])
    ).toMatchObject([{ type: 'teilzahlung' }])
  }
)

it('zieht nur bestätigte Bankanteile vom Restbetrag ab', () => {
  const debit = tx({ amount: -100 })
  const first = {
    transaction_id: debit.id,
    amount_cents: 4000,
    discount_cents: 200,
    status: 'bestaetigt',
  }
  const second = {
    transaction_id: debit.id,
    amount_cents: 6000,
    status: 'bestaetigt',
  }
  expect(
    expensesWithoutReceipt(
      [debit],
      [first, { ...second, status: 'abgelehnt' }],
      []
    )
  ).toMatchObject([{ amount: -100, remaining_cents: 6000 }])
  expect(expensesWithoutReceipt([debit], [first, second], [])).toEqual([])
})
