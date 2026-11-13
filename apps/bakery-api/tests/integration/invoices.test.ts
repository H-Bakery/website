/**
 * `/api/invoices` - Ausgangsrechnungen gegen die echte App (In-Memory-SQLite,
 * alle Migrationen). Nur synthetische Daten: erfundener Verkäufer samt
 * Beispiel-IBAN (tests/fixtures/invoice.synthetic.js), erfundene Kunden,
 * erfundene Preise.
 */
import request from 'supertest'

import {
  AuditLog,
  Invoice,
  InvoiceLine,
  Preorder,
  PreorderItem,
} from '../../src/models'
import { anonymizePreorders } from '../../src/services/preorders-maintenance'
import { currentSeller } from '../../src/services/invoice-seller'
import { bearer, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('../../src/services/invoice.core')
const fixture = require('../fixtures/invoice.synthetic')
/* eslint-enable @typescript-eslint/no-var-requires */

jest.setTimeout(30000)

const NOW = new Date('2026-11-15T09:30:00Z')
const ROLES = [
  'inhaber',
  'backstubenleiter',
  'backstube',
  'verkauf',
  'fahrer',
] as const

let api: TestApp
/** Die Bankverbindung „auf der Box“ - Tests schalten sie ab und an. */
let seller = { ...fixture.SELLER }
const tokens = {} as Record<(typeof ROLES)[number], string>

const as = (role: (typeof ROLES)[number]) => ({
  get: (p: string) => request(api.app).get(p).set(bearer(tokens[role])),
  post: (p: string) => request(api.app).post(p).set(bearer(tokens[role])),
  put: (p: string) => request(api.app).put(p).set(bearer(tokens[role])),
  delete: (p: string) => request(api.app).delete(p).set(bearer(tokens[role])),
})
const owner = () => as('inhaber')

const BUYER = {
  name: 'Sportverein Beispiel e. V.',
  careOf: 'z. Hd. Max Muster',
  street: 'Testgasse 7',
  postcode: '54321',
  city: 'Probedorf',
  countryCode: 'DE',
}

const LINES = [
  { name: 'Musterweck', unit: 'Stück', quantity: 40, unitPriceGross: '0,45' },
  {
    name: 'Testschorle 0,5 l',
    unit: 'Stück',
    quantity: 6,
    unitPriceGross: 1.99,
    vatRate: 19,
  },
]

async function preorder(code: string, extra: Record<string, unknown> = {}) {
  const row = await Preorder.create({
    code,
    channel: 'telefon',
    customerName: 'Testkundin Erika Beispiel',
    customerPhone: '0170 0000001',
    pickupDate: '2026-11-15',
    pickupTime: '10:00',
    status: 'bereit',
    ...extra,
  } as any)
  await PreorderItem.bulkCreate([
    {
      preorderId: row.id,
      productId: 'musterweck',
      productName: 'Musterweck',
      unit: 'Stück',
      unitPrice: 0.45,
      quantity: 40,
      variant: '',
    },
    {
      preorderId: row.id,
      productId: 'musterkranz',
      productName: 'Musterkranz',
      unit: 'Stück',
      unitPrice: 12.9,
      quantity: 2,
      variant: 'Nuss',
    },
  ])
  return row
}

async function issuedInvoice(number: string) {
  const created = await owner()
    .post('/api/invoices')
    .send({ number, buyer: BUYER, deliveryDate: '2026-11-15', lines: LINES })
    .expect(201)
  const id = created.body.data.id as number
  await owner().post(`/api/invoices/${id}/issue`).expect(200)
  return id
}

beforeAll(async () => {
  api = await createTestApp({
    app: { invoices: { seller: () => seller, now: () => NOW } },
  })
  for (const role of ROLES) {
    tokens[role] = await sessionFor(api.app, `test.${role}`, role)
  }
})

afterAll(() => api.close())

beforeEach(() => {
  seller = { ...fixture.SELLER }
})

describe('Zugriff', () => {
  it('verlangt eine Sitzung', async () => {
    const res = await request(api.app).get('/api/invoices').expect(401)
    expect(res.body.message).toBeTruthy()
  })

  it.each(ROLES.filter((r) => r !== 'inhaber'))(
    'verweigert %s jede Route',
    async (role) => {
      const calls = [
        as(role).get('/api/invoices'),
        as(role).get('/api/invoices/config'),
        as(role).get('/api/invoices/1'),
        as(role).post('/api/invoices').send({}),
        as(role).put('/api/invoices/1').send({}),
        as(role).delete('/api/invoices/1'),
        as(role).post('/api/invoices/1/issue'),
        as(role).post('/api/invoices/1/cancel').send({ reason: 'x' }),
        as(role).get('/api/invoices/1/pdf'),
        as(role).get('/api/invoices/1/xml'),
      ]
      for (const call of calls) {
        const res = await call
        expect(res.status).toBe(403)
        expect(res.body.error).toBe('forbidden')
        expect(res.body.message).toBe(
          'Für diese Aktion fehlt die Berechtigung.'
        )
      }
      expect(await Invoice.count()).toBe(0)
    }
  )
})

describe('Einrichtung', () => {
  it('liefert Vorgaben und den Verkäufer', async () => {
    const res = await owner().get('/api/invoices/config').expect(200)
    expect(res.body.data).toMatchObject({
      vatRates: [7, 19],
      defaultVatRate: 7,
      paymentTermDays: 14,
      paymentText: 'Zahlbar per Überweisung',
      today: '2026-11-15',
      bankConfigured: true,
      bankMessage: null,
    })
    expect(res.body.data.seller.vatId).toBe('DE123456789')
  })

  it('sagt, wenn die Bankverbindung fehlt', async () => {
    seller = { ...fixture.SELLER, iban: '', bic: '', accountHolder: '' }
    const res = await owner().get('/api/invoices/config').expect(200)
    expect(res.body.data.bankConfigured).toBe(false)
    expect(res.body.data.bankMessage).toContain('IBAN, BIC, Kontoinhaber')
  })

  it('liest den Verkäufer aus dem Impressum und die Bank aus der Umgebung', () => {
    const without = currentSeller({})
    expect(without.name).toContain(', Inh. ')
    expect(without.countryCode).toBe('DE')
    expect(without.vatId).toMatch(/^DE\d{9}$/)
    expect(without.iban).toBe('')
    expect(core.bankErrors(without)).toHaveLength(1)

    const withBank = currentSeller({
      INVOICE_IBAN: ' de02 1203 0000 0000 2020 51 ',
      INVOICE_BIC: 'byladem1001',
      INVOICE_ACCOUNT_HOLDER: ' Erika Mustermann ',
      INVOICE_BANK_NAME: 'Musterbank',
    })
    expect(withBank.iban).toBe('DE02120300000000202051')
    expect(withBank.bic).toBe('BYLADEM1001')
    expect(withBank.accountHolder).toBe('Erika Mustermann')
    expect(core.bankErrors(withBank)).toEqual([])
  })
})

describe('Entwurf', () => {
  it('legt einen leeren Entwurf an - ohne Nummer, mit Vorgaben', async () => {
    const res = await owner().post('/api/invoices').send({}).expect(201)
    const invoice = res.body.data
    expect(invoice).toMatchObject({
      number: null,
      status: 'entwurf',
      invoiceDate: '2026-11-15',
      deliveryDate: null,
      paymentTermDays: 14,
      paymentText: 'Zahlbar per Überweisung',
      dueDate: '2026-11-29',
      lines: [],
      issuable: false,
    })
    expect(invoice.totals.dueCents).toBe(0)
    expect(invoice.missing.map((m: any) => m.field)).toEqual([
      'number',
      'deliveryDate',
      'buyer.name',
      'buyer.street',
      'buyer.postcode',
      'buyer.city',
      'lines',
    ])
    await owner().delete(`/api/invoices/${invoice.id}`).expect(200)
    await owner().get(`/api/invoices/${invoice.id}`).expect(404)
  })

  it('belegt einen Entwurf aus einer Vorbestellung vor', async () => {
    const order = await preorder('LA-2026-11-15-01')
    const res = await owner()
      .post('/api/invoices')
      .send({ preorderId: order.id })
      .expect(201)
    const invoice = res.body.data
    expect(invoice).toMatchObject({
      preorderId: order.id,
      preorderCode: 'LA-2026-11-15-01',
      deliveryDate: '2026-11-15',
      status: 'entwurf',
    })
    expect(invoice.buyer.name).toBe('Testkundin Erika Beispiel')
    expect(invoice.lines).toMatchObject([
      {
        position: 1,
        productId: 'musterweck',
        name: 'Musterweck',
        quantity: 40,
        unitPriceGrossCents: 45,
        vatRate: 7,
        grossCents: 1800,
      },
      {
        position: 2,
        name: 'Musterkranz (Nuss)',
        quantity: 2,
        unitPriceGrossCents: 1290,
        vatRate: 7,
        grossCents: 2580,
      },
    ])
    // Die Rechnung endet auf dem Betrag der Vorbestellung
    expect(invoice.totals.dueCents).toBe(4380)
    expect(invoice.totals.netCents + invoice.totals.vatCents).toBe(4380)

    // Eine zweite Rechnung zur selben Vorbestellung gibt es nicht
    const again = await owner()
      .post('/api/invoices')
      .send({ preorderId: order.id })
      .expect(409)
    expect(again.body.error).toBe('invoice_exists')
    expect(again.body.invoiceId).toBe(invoice.id)
    expect(again.body.message).toContain('Rechnungsentwurf')

    const list = await owner()
      .get(`/api/invoices?preorderId=${order.id}`)
      .expect(200)
    expect(list.body.data).toHaveLength(1)
    expect(list.body.data[0]).toMatchObject({
      id: invoice.id,
      buyerName: 'Testkundin Erika Beispiel',
      dueCents: 4380,
      status: 'entwurf',
    })
  })

  it('lehnt unbekannte und stornierte Vorbestellungen ab', async () => {
    const missing = await owner()
      .post('/api/invoices')
      .send({ preorderId: 999999 })
      .expect(404)
    expect(missing.body.error).toBe('preorder_not_found')

    const cancelled = await preorder('LA-2026-11-15-02', {
      status: 'storniert',
    })
    const res = await owner()
      .post('/api/invoices')
      .send({ preorderId: cancelled.id })
      .expect(409)
    expect(res.body.error).toBe('preorder_cancelled')
    expect(res.body.message).toContain('storniert')
  })

  it('ändert einen Entwurf und rechnet neu', async () => {
    const created = await owner().post('/api/invoices').send({}).expect(201)
    const id = created.body.data.id
    const res = await owner()
      .put(`/api/invoices/${id}`)
      .send({
        number: 'TEST-ENTWURF-1',
        buyer: BUYER,
        deliveryDate: '2026-11-14',
        invoiceDate: '2026-11-16',
        paymentTermDays: 30,
        note: 'Vielen Dank.',
        lines: LINES,
      })
      .expect(200)
    expect(res.body.data).toMatchObject({
      number: 'TEST-ENTWURF-1',
      dueDate: '2026-12-16',
      paymentTerms: 'Zahlbar per Überweisung bis 16.12.2026 ohne Abzug.',
      issuable: true,
      missing: [],
    })
    expect(res.body.data.lines.map((l: any) => l.vatRate)).toEqual([7, 19])
    expect(res.body.data.totals.dueCents).toBe(1800 + 1194)

    // Teiländerung: nur ein Feld, der Rest bleibt
    const partial = await owner()
      .put(`/api/invoices/${id}`)
      .send({ buyer: { city: 'Neudorf' } })
      .expect(200)
    expect(partial.body.data.buyer).toMatchObject({
      name: BUYER.name,
      city: 'Neudorf',
    })
    expect(partial.body.data.lines).toHaveLength(2)
    await owner().delete(`/api/invoices/${id}`).expect(200)
  })

  it('meldet ungültige Eingaben mit Feld und deutscher Meldung', async () => {
    const res = await owner()
      .post('/api/invoices')
      .send({
        number: 'A<B',
        invoiceDate: '15.11.2026',
        paymentTermDays: -1,
        lines: [{ name: '', quantity: 0, unitPriceGross: '1,999', vatRate: 5 }],
      })
      .expect(422)
    expect(res.body.error).toBe('validation_failed')
    expect(res.body.message).toBeTruthy()
    expect(res.body.fields.map((f: any) => f.field)).toEqual([
      'number',
      'invoiceDate',
      'paymentTermDays',
      'lines[0].name',
      'lines[0].quantity',
      'lines[0].unitPriceGross',
      'lines[0].vatRate',
    ])
  })
})

describe('Ausstellen', () => {
  it('verlangt Nummer, Anschrift und Positionen', async () => {
    const created = await owner()
      .post('/api/invoices')
      .send({ buyer: { name: 'Nur Name' }, lines: LINES })
      .expect(201)
    const id = created.body.data.id
    const res = await owner().post(`/api/invoices/${id}/issue`).expect(422)
    expect(res.body.error).toBe('invoice_incomplete')
    expect(res.body.message).toContain('Rechnungsnummer')
    expect(res.body.fields.map((f: any) => f.field)).toEqual([
      'number',
      'deliveryDate',
      'buyer.street',
      'buyer.postcode',
      'buyer.city',
    ])
    expect((await Invoice.findByPk(id))?.status).toBe('entwurf')
    await owner().delete(`/api/invoices/${id}`).expect(200)
  })

  it('verweigert das Ausstellen ohne Bankverbindung', async () => {
    const created = await owner()
      .post('/api/invoices')
      .send({
        number: 'TEST-OHNE-BANK',
        buyer: BUYER,
        deliveryDate: '2026-11-15',
        lines: LINES,
      })
      .expect(201)
    const id = created.body.data.id
    expect(created.body.data.issuable).toBe(true)

    seller = { ...fixture.SELLER, iban: '', bic: '', accountHolder: '' }
    const draft = await owner().get(`/api/invoices/${id}`).expect(200)
    expect(draft.body.data.issuable).toBe(false)
    expect(draft.body.data.missing[0].field).toBe('seller.bank')

    const res = await owner().post(`/api/invoices/${id}/issue`).expect(409)
    expect(res.body.error).toBe('bank_not_configured')
    expect(res.body.message).toContain('nicht eingerichtet')
    const row = await Invoice.findByPk(id)
    expect(row?.status).toBe('entwurf')
    expect(row?.xml).toBeNull()
    await owner().delete(`/api/invoices/${id}`).expect(200)
  })

  it('stellt aus, schreibt fest und liefert XML und PDF', async () => {
    const created = await owner()
      .post('/api/invoices')
      .send({
        number: 'TEST-2026-0100',
        buyer: BUYER,
        deliveryDate: '2026-11-15',
        lines: LINES,
      })
      .expect(201)
    const id = created.body.data.id
    await owner().get(`/api/invoices/${id}/pdf`).expect(409)
    await owner().get(`/api/invoices/${id}/xml`).expect(409)

    const issued = await owner().post(`/api/invoices/${id}/issue`).expect(200)
    expect(issued.body.data).toMatchObject({
      status: 'ausgestellt',
      number: 'TEST-2026-0100',
      issuable: false,
      missing: [],
      issuedAt: NOW.toISOString(),
    })
    expect(issued.body.data.seller.iban).toBe(fixture.SELLER.iban)

    // Der Verkäufer ist festgeschrieben: eine spätere Änderung der Einrichtung
    // ändert die ausgestellte Rechnung nicht.
    seller = {
      ...fixture.SELLER,
      iban: 'DE89370400440532013000',
      bic: 'COBADEFFXXX',
    }
    const reread = await owner().get(`/api/invoices/${id}`).expect(200)
    expect(reread.body.data.seller.iban).toBe(fixture.SELLER.iban)

    const xml = await owner().get(`/api/invoices/${id}/xml`).expect(200)
    expect(xml.headers['content-type']).toContain('application/xml')
    expect(xml.headers['content-disposition']).toBe(
      'attachment; filename="Rechnung-TEST-2026-0100.xml"'
    )
    expect(xml.text).toContain('<ram:ID>TEST-2026-0100</ram:ID>')
    expect(xml.text).toContain(
      `<ram:IBANID>${fixture.SELLER.iban}</ram:IBANID>`
    )
    expect(xml.text).toContain(
      '<ram:DuePayableAmount>29.94</ram:DuePayableAmount>'
    )

    const pdf = await owner()
      .get(`/api/invoices/${id}/pdf`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => callback(null, Buffer.concat(chunks)))
      })
      .expect(200)
    expect(pdf.headers['content-type']).toBe('application/pdf')
    expect(pdf.headers['content-disposition']).toBe(
      'attachment; filename="Rechnung-TEST-2026-0100.pdf"'
    )
    const text = (pdf.body as Buffer).toString('latin1')
    expect(text.startsWith('%PDF-1.7')).toBe(true)
    expect(text).toContain('/AFRelationship /Alternative')
    expect(text).toContain(
      '<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>'
    )

    // Audit ohne Namen und Anschrift
    const log = await AuditLog.findOne({
      where: { entity: 'invoice', entityId: String(id), action: 'issue' },
    })
    expect(log?.data).toEqual({ number: 'TEST-2026-0100', dueCents: 2994 })
  })

  it('lässt eine ausgestellte Rechnung nicht mehr ändern oder löschen', async () => {
    const id = await issuedInvoice('TEST-2026-0101')
    const before = (await Invoice.findByPk(id))?.toJSON()
    const linesBefore = await InvoiceLine.findAll({ where: { invoiceId: id } })

    const put = await owner()
      .put(`/api/invoices/${id}`)
      .send({ buyer: { name: 'Jemand anders' }, lines: [] })
      .expect(409)
    expect(put.body.error).toBe('invoice_immutable')
    expect(put.body.message).toContain('stornieren')
    const del = await owner().delete(`/api/invoices/${id}`).expect(409)
    expect(del.body.error).toBe('invoice_immutable')
    const again = await owner().post(`/api/invoices/${id}/issue`).expect(409)
    expect(again.body.error).toBe('invoice_not_draft')

    expect((await Invoice.findByPk(id))?.toJSON()).toEqual(before)
    expect(await InvoiceLine.count({ where: { invoiceId: id } })).toBe(
      linesBefore.length
    )
  })

  it('vergibt jede Rechnungsnummer nur einmal', async () => {
    await issuedInvoice('TEST-2026-0102')
    const created = await owner()
      .post('/api/invoices')
      .send({ number: 'TEST-2026-0102' })
      .expect(409)
    expect(created.body.error).toBe('number_taken')
    expect(created.body.message).toContain('TEST-2026-0102')

    const draft = await owner().post('/api/invoices').send({}).expect(201)
    const put = await owner()
      .put(`/api/invoices/${draft.body.data.id}`)
      .send({ number: 'TEST-2026-0102' })
      .expect(409)
    expect(put.body.error).toBe('number_taken')
    await owner().delete(`/api/invoices/${draft.body.data.id}`).expect(200)
  })
})

describe('Stornieren', () => {
  it('storniert mit Grund; danach ist eine neue Rechnung zur Vorbestellung möglich', async () => {
    const order = await preorder('LA-2026-11-15-05')
    const draft = await owner()
      .post('/api/invoices')
      .send({ preorderId: order.id })
      .expect(201)
    const id = draft.body.data.id

    const early = await owner()
      .post(`/api/invoices/${id}/cancel`)
      .send({ reason: 'Tippfehler' })
      .expect(409)
    expect(early.body.error).toBe('invoice_not_issued')

    await owner()
      .put(`/api/invoices/${id}`)
      .send({ number: 'TEST-2026-0103', buyer: BUYER })
      .expect(200)
    await owner().post(`/api/invoices/${id}/issue`).expect(200)

    const noReason = await owner()
      .post(`/api/invoices/${id}/cancel`)
      .send({})
      .expect(422)
    expect(noReason.body.message).toContain('Grund')

    const res = await owner()
      .post(`/api/invoices/${id}/cancel`)
      .send({ reason: 'Falsche Anschrift' })
      .expect(200)
    expect(res.body.data).toMatchObject({
      status: 'storniert',
      cancelReason: 'Falsche Anschrift',
      cancelledAt: NOW.toISOString(),
      number: 'TEST-2026-0103',
    })
    const twice = await owner()
      .post(`/api/invoices/${id}/cancel`)
      .send({ reason: 'nochmal' })
      .expect(409)
    expect(twice.body.error).toBe('invoice_cancelled')

    // Die stornierte Rechnung bleibt lesbar, ihre Nummer vergeben
    await owner().get(`/api/invoices/${id}/xml`).expect(200)
    const next = await owner()
      .post('/api/invoices')
      .send({ preorderId: order.id, number: 'TEST-2026-0103' })
      .expect(409)
    expect(next.body.error).toBe('number_taken')
    const fresh = await owner()
      .post('/api/invoices')
      .send({ preorderId: order.id })
      .expect(201)
    expect(fresh.body.data.status).toBe('entwurf')

    const listed = await owner()
      .get('/api/invoices?status=storniert')
      .expect(200)
    expect(listed.body.data.map((i: any) => i.id)).toContain(id)
    await owner().get('/api/invoices?status=quatsch').expect(400)
  })
})

describe('Aufbewahrung', () => {
  it('bleibt von der 90-Tage-Anonymisierung der Vorbestellung unberührt', async () => {
    const order = await preorder('LA-2026-08-01-01', {
      pickupDate: '2026-08-01',
      status: 'abgeholt',
    })
    const draft = await owner()
      .post('/api/invoices')
      .send({ preorderId: order.id })
      .expect(201)
    const id = draft.body.data.id
    await owner()
      .put(`/api/invoices/${id}`)
      .send({ number: 'TEST-2026-0104', buyer: BUYER })
      .expect(200)
    await owner().post(`/api/invoices/${id}/issue`).expect(200)
    const xmlBefore = (await owner().get(`/api/invoices/${id}/xml`)).text

    const report = await anonymizePreorders({ today: '2026-11-15' })
    expect(report).toBeTruthy()
    const wiped = await Preorder.findByPk(order.id)
    expect(wiped?.anonymizedAt).not.toBeNull()
    expect(wiped?.customerName).not.toBe('Testkundin Erika Beispiel')

    const after = await owner().get(`/api/invoices/${id}`).expect(200)
    expect(after.body.data.buyer).toEqual(BUYER)
    expect(after.body.data.status).toBe('ausgestellt')
    expect((await owner().get(`/api/invoices/${id}/xml`)).text).toBe(xmlBefore)
  })
})
