/**
 * Synthetische `finance-summary.json` für Tests. Alle Zahlen, Namen und
 * Kontonummern sind erfunden - hier steht bewusst kein einziger Wert aus dem
 * privaten `hq`-Repo. Die Zahlen sind so gewählt, dass die Invariante
 * Einnahmen + Ausgaben + Neutral = Kontoveränderung je Monat aufgeht.
 */

'use strict'

/** Erfundene IBANs (Prüfziffer 00, Bank 00000000 - existieren nicht). */
const FAKE_IBANS = ['DE00000000000000000001', 'DE00000000000000000002']

const FAKE_NAMES = [
  'Erika Beispielfrau',
  'Max Beispielmann',
  'Beispiel-Großhandel GmbH',
]

function month(spec) {
  const income = spec.income
  const expense = spec.expense
  const neutral = spec.neutral
  return {
    month: spec.month,
    transactions: spec.transactions,
    operating_income: income,
    operating_expense: expense,
    operating_result: Math.round((income + expense) * 100) / 100,
    neutral,
    net_change: Math.round((income + expense + neutral) * 100) / 100,
    categories: spec.categories,
  }
}

function buildSyntheticSummary() {
  const months = [
    month({
      month: '2026-01',
      transactions: 40,
      income: 10000,
      expense: -7000,
      neutral: -500,
      categories: {
        umsatz: {
          amount: 10000,
          count: 20,
          income: 10000,
          expense: 0,
          subcategories: { bar: 6000, karte: 4000 },
        },
        wareneinsatz: {
          amount: -4000,
          count: 10,
          income: 0,
          expense: -4000,
          subcategories: { mehl: -4000 },
        },
        personal: {
          amount: -2500,
          count: 5,
          income: 0,
          expense: -2500,
          subcategories: {},
        },
        unkategorisiert: {
          amount: -500,
          count: 3,
          income: 0,
          expense: -500,
          subcategories: {},
        },
        privat: {
          amount: -500,
          count: 2,
          income: 0,
          expense: -500,
          subcategories: {},
        },
      },
    }),
    month({
      month: '2026-02',
      transactions: 35,
      income: 9000,
      expense: -6500,
      neutral: 200,
      categories: {
        umsatz: {
          amount: 9000,
          count: 18,
          income: 9000,
          expense: 0,
          subcategories: { bar: 5000, karte: 4000 },
        },
        wareneinsatz: {
          amount: -3500,
          count: 9,
          income: 0,
          expense: -3500,
          subcategories: { mehl: -3500 },
        },
        personal: {
          amount: -3000,
          count: 6,
          income: 0,
          expense: -3000,
          subcategories: {},
        },
        geldtransit: {
          amount: 200,
          count: 2,
          income: 200,
          expense: 0,
          subcategories: {},
        },
      },
    }),
    month({
      month: '2026-03',
      transactions: 42,
      income: 11000,
      expense: -8000,
      neutral: -1000,
      categories: {
        umsatz: {
          amount: 11000,
          count: 22,
          income: 11000,
          expense: 0,
          subcategories: { bar: 6500, karte: 4500 },
        },
        wareneinsatz: {
          amount: -4500,
          count: 11,
          income: 0,
          expense: -4500,
          subcategories: { mehl: -4500 },
        },
        personal: {
          amount: -3500,
          count: 7,
          income: 0,
          expense: -3500,
          subcategories: {},
        },
        privat: {
          amount: -1000,
          count: 2,
          income: 0,
          expense: -1000,
          subcategories: {},
        },
      },
    }),
  ]

  return {
    generated_at: '2026-04-01T08:00:00+02:00',
    schema_version: 1,
    period: { from: '2026-01-01', to: '2026-03-31' },
    accounts: FAKE_IBANS,
    transaction_count: 117,
    category_labels: {
      umsatz: 'Umsatzerlöse',
      wareneinsatz: 'Wareneinsatz',
      personal: 'Personal',
      privat: 'Privat',
      geldtransit: 'Geldtransit',
      unkategorisiert: 'Nicht zugeordnet',
    },
    category_kinds: {
      umsatz: 'einnahme',
      wareneinsatz: 'ausgabe',
      personal: 'ausgabe',
      privat: 'neutral',
      geldtransit: 'neutral',
      unkategorisiert: 'offen',
    },
    subcategory_labels: {
      bar: 'Bareinzahlung',
      karte: 'Kartenumsatz',
      mehl: 'Mehl',
    },
    totals: {
      umsatz: { amount: 30000, count: 60, income: 30000, expense: 0 },
      wareneinsatz: { amount: -12000, count: 30, income: 0, expense: -12000 },
      personal: { amount: -9000, count: 18, income: 0, expense: -9000 },
      privat: { amount: -1500, count: 4, income: 0, expense: -1500 },
      geldtransit: { amount: 200, count: 2, income: 200, expense: 0 },
      unkategorisiert: { amount: -500, count: 3, income: 0, expense: -500 },
    },
    months,
    top_counterparties: [
      {
        name: FAKE_NAMES[2],
        amount: -12000,
        count: 30,
        category: 'wareneinsatz',
      },
      { name: FAKE_NAMES[0], amount: -5000, count: 9, category: 'personal' },
      { name: FAKE_NAMES[1], amount: -4000, count: 9, category: 'personal' },
    ],
    uncategorized: {
      count: 3,
      amount: -500,
      transactions: [
        {
          date: '2026-01-05',
          amount: -200,
          counterparty: FAKE_NAMES[1],
          purpose: 'Rechnung 4711',
        },
        {
          date: '2026-01-12',
          amount: -150,
          counterparty: null,
          purpose: 'Barabhebung',
        },
        {
          date: '2026-01-20',
          amount: -150,
          counterparty: FAKE_NAMES[0],
          purpose: 'Auslage',
        },
      ],
    },
  }
}

module.exports = { buildSyntheticSummary, FAKE_IBANS, FAKE_NAMES }
