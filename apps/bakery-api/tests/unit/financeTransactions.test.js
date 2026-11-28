/**
 * Einzelbuchungen: Core (`finance-transactions.core.js`) und Routen
 * (`/api/finance/transactions[/:id]` in `finance.routes.js`) mit
 * synthetischen Daten in einem Temp-Verzeichnis - nichts aus `hq`.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const express = require('express')
const request = require('supertest')

const core = require('../../src/services/finance-transactions.core')
const financeRoutes = require('../../src/routes/finance.routes')
const { testRoleGuards } = require('../helpers/roleGuards')
const {
  buildSyntheticSummary,
} = require('../fixtures/finance-summary.synthetic')
const {
  FAKE_COUNTERPARTY_IBAN,
  FAKE_OWN_IBAN,
  FAKE_MANDATE,
  FAKE_CREDITOR_ID,
  FAKE_E2E,
  SYNTHETIC_LABELS,
  buildSyntheticTransactionMonths,
} = require('../fixtures/finance-transactions.synthetic')

const silentLog = { log() {}, warn: jest.fn(), error() {} }

function rawOf(month) {
  return buildSyntheticTransactionMonths()[month].transactions
}

describe('finance-transactions.core', () => {
  const labels = core.labelsFrom(SYNTHETIC_LABELS)

  it('Whitelist: maskierte IBAN, keine Referenzen, kein eigenes Konto', () => {
    const tx = core.sanitizeTransaction(rawOf('2026-01')[0], labels)
    expect(tx).toMatchObject({
      id: 'aaaa000000000001',
      booking_date: '2026-01-05',
      amount: -120.5,
      counterparty: 'Beispiel-Großhandel GmbH',
      counterparty_iban: 'DE•• •••• 4711',
      direct_debit: true,
      category: 'wareneinsatz',
      category_label: 'Wareneinsatz',
      kind: 'ausgabe',
      subcategory_label: 'Backmittel (Großhandel)',
    })
    const text = JSON.stringify(tx)
    for (const secret of [
      FAKE_COUNTERPARTY_IBAN,
      FAKE_OWN_IBAN,
      FAKE_MANDATE,
      FAKE_CREDITOR_ID,
      FAKE_E2E,
      'BEISPIELXXX',
      'umsatz.CSV',
    ]) {
      expect(text).not.toContain(secret)
    }
    expect(Object.keys(tx)).not.toEqual(
      expect.arrayContaining(['account', 'source', 'mandate_reference'])
    )
  })

  it('Zeilen ohne ID, Datum oder Betrag fallen weg, nie mit erfundenen Werten', () => {
    expect(
      core.sanitizeTransaction({ booking_date: '2026-01-01', amount: 1 })
    ).toBeNull()
    expect(core.sanitizeTransaction({ id: 'abcdef12', amount: 1 })).toBeNull()
    expect(
      core.sanitizeTransaction({
        id: 'abcdef12',
        booking_date: '2026-01-01',
        amount: 'x',
      })
    ).toBeNull()
  })

  it('unbekannte Kategorie zählt als offen', () => {
    const tx = core.sanitizeTransaction(
      {
        ...rawOf('2026-01')[0],
        classification: { category: 'neu_ohne_label' },
      },
      labels
    )
    expect(tx.kind).toBe('offen')
    expect(tx.category_label).toBe('neu_ohne_label')
  })

  it('maskIban', () => {
    expect(core.maskIban('DE00 0000 0000 0000 0047 11')).toBe('DE•• •••• 4711')
    expect(core.maskIban('')).toBeNull()
    expect(core.maskIban(null)).toBeNull()
    expect(core.maskIban('kein konto')).toBeNull()
  })

  it('Liste: neueste zuerst, Summen, Kategorien, Monatsnachbarn', () => {
    const data = core.buildListResponse({
      month: '2026-02',
      months: ['2026-01', '2026-02'],
      rawTransactions: rawOf('2026-02'),
      labels,
      filters: core.parseFilters({}).filters,
    })
    expect(data.available).toBe(true)
    expect(data.months).toEqual(['2026-02', '2026-01'])
    expect(data.previous_month).toBe('2026-01')
    expect(data.next_month).toBeNull()
    expect(data.skipped).toBe(1)
    expect(data.transactions.map((t) => t.id)).toEqual([
      'bbbb000000000002', // 10.02., größerer Betrag zuerst
      'bbbb000000000003',
      'bbbb000000000001',
    ])
    expect(data.month_totals).toEqual({
      count: 3,
      income: 1250,
      expense: -112.49,
      net: 1137.51,
    })
    expect(data.categories.map((c) => c.category)).toEqual(
      expect.arrayContaining([
        'wareneinsatz',
        'umsatz_laden',
        'unkategorisiert',
      ])
    )
  })

  it('Filter: Richtung, Kategorie, Art, Suche (auch Betrag mit Komma)', () => {
    const run = (query) =>
      core
        .buildListResponse({
          month: '2026-02',
          months: ['2026-02'],
          rawTransactions: rawOf('2026-02'),
          labels,
          filters: core.parseFilters(query).filters,
        })
        .transactions.map((t) => t.id)
    expect(run({ direction: 'in' })).toEqual(['bbbb000000000002'])
    expect(run({ direction: 'out' })).toHaveLength(2)
    expect(run({ category: 'wareneinsatz' })).toEqual(['bbbb000000000001'])
    expect(run({ kind: 'offen' })).toEqual(['bbbb000000000003'])
    expect(run({ q: 'zucker' })).toEqual(['bbbb000000000001'])
    expect(run({ q: '99,99' })).toEqual(['bbbb000000000001'])
    expect(run({ q: '12.50' })).toEqual(['bbbb000000000003'])
  })

  it('parseFilters lehnt Unsinn ab', () => {
    expect(core.parseFilters({ direction: 'quer' }).errors).toEqual([
      'direction',
    ])
    expect(core.parseFilters({ kind: 'x' }).errors).toEqual(['kind'])
    expect(core.parseFilters({ category: 'A B' }).errors).toEqual(['category'])
    expect(core.parseFilters({ q: 'x'.repeat(101) }).errors).toEqual(['q'])
  })

  it('Detail: weitere Buchungen derselben Gegenseite über alle Monate', () => {
    const allRaw = [...rawOf('2026-01'), ...rawOf('2026-02')]
    const d = core.buildDetailResponse({
      id: 'bbbb000000000001',
      allRaw,
      labels,
    })
    expect(d.month).toBe('2026-02')
    expect(d.related_count).toBe(1)
    expect(d.related[0]).toMatchObject({
      id: 'aaaa000000000001',
      amount: -120.5,
    })
    expect(d.related_totals.expense).toBe(-120.5)
    expect(
      core.buildDetailResponse({ id: 'ffff000000000000', allRaw, labels })
    ).toBeNull()
  })
})

function buildApp({ withFiles = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-tx-test-'))
  fs.writeFileSync(
    path.join(dir, 'finance-summary.json'),
    JSON.stringify({ ...buildSyntheticSummary(), ...SYNTHETIC_LABELS })
  )
  if (withFiles) {
    fs.mkdirSync(path.join(dir, 'transactions'))
    for (const [month, file] of Object.entries(
      buildSyntheticTransactionMonths()
    )) {
      fs.writeFileSync(
        path.join(dir, 'transactions', `${month}.json`),
        JSON.stringify(file)
      )
    }
  }
  const app = express()
  financeRoutes.install(app, testRoleGuards(), {
    financeDir: dir,
    log: silentLog,
  })
  return app
}

const OWNER = 'Bearer inhaber'

describe('GET /api/finance/transactions', () => {
  const app = buildApp()

  it('ohne Token 401, als verkauf 403', async () => {
    expect((await request(app).get('/api/finance/transactions')).status).toBe(
      401
    )
    const res = await request(app)
      .get('/api/finance/transactions')
      .set('Authorization', 'Bearer verkauf')
    expect(res.status).toBe(403)
    expect(JSON.stringify(res.body)).not.toContain('Beispiel')
  })

  it('ohne Monat der jüngste, nie im Cache, ohne Klartext-IBAN', async () => {
    const res = await request(app)
      .get('/api/finance/transactions')
      .set('Authorization', OWNER)
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.body.data.month).toBe('2026-02')
    expect(res.body.data.transactions).toHaveLength(3)
    const text = JSON.stringify(res.body)
    expect(text).not.toContain(FAKE_COUNTERPARTY_IBAN)
    expect(text).not.toContain(FAKE_MANDATE)
  })

  it('Monat und Filter aus der Anfrage', async () => {
    const res = await request(app)
      .get('/api/finance/transactions')
      .query({ month: '2026-01', direction: 'in' })
      .set('Authorization', OWNER)
    expect(res.body.data.month).toBe('2026-01')
    expect(res.body.data.next_month).toBe('2026-02')
    expect(res.body.data.transactions.map((t) => t.id)).toEqual([
      'aaaa000000000002',
    ])
  })

  it('Monat ohne Datei: leer und available=false, kein Fehler', async () => {
    const res = await request(app)
      .get('/api/finance/transactions?month=2025-12')
      .set('Authorization', OWNER)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ available: false, transactions: [] })
  })

  it('ungültige Eingaben 400', async () => {
    for (const q of ['month=2026-13', 'direction=quer', 'kind=x']) {
      const res = await request(app)
        .get(`/api/finance/transactions?${q}`)
        .set('Authorization', OWNER)
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({ success: false, error: 'validation' })
    }
  })

  it('ohne transactions/ antwortet der Server no-data', async () => {
    const res = await request(buildApp({ withFiles: false }))
      .get('/api/finance/transactions')
      .set('Authorization', OWNER)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'no-data', data: null })
  })
})

describe('GET /api/finance/transactions/:id', () => {
  const app = buildApp()

  it('liefert Buchung und weitere derselben Gegenseite', async () => {
    const res = await request(app)
      .get('/api/finance/transactions/aaaa000000000001')
      .set('Authorization', OWNER)
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.body.data.transaction.counterparty_iban).toBe('DE•• •••• 4711')
    expect(res.body.data.related.map((t) => t.id)).toEqual(['bbbb000000000001'])
  })

  it('unbekannt 404, ungültig 400, ohne Token 401', async () => {
    const missing = await request(app)
      .get('/api/finance/transactions/ffff000000000000')
      .set('Authorization', OWNER)
    expect(missing.status).toBe(404)
    expect(missing.body.error).toBe('not_found')
    const invalid = await request(app)
      .get('/api/finance/transactions/..%2Fsecret')
      .set('Authorization', OWNER)
    expect(invalid.status).toBe(400)
    expect(
      (await request(app).get('/api/finance/transactions/aaaa000000000001'))
        .status
    ).toBe(401)
  })
})
