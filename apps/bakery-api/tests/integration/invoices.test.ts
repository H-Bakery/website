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
import * as invoicePdf from '../../src/services/invoice-pdf'
import { currentSeller } from '../../src/services/invoice-seller'
import { bearer, createUser, login, sessionFor } from '../helpers/auth'
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
let stationToken = ''

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
  // Derselbe Inhaber-Rang, aber mit PIN an einer Station angemeldet
  const pinOwner = await createUser({
    username: 'test.inhaber.pin',
    role: 'inhaber',
    pin: '4242',
  })
  await login(api.app, 'test.inhaber.pin')
  const station = await owner()
    .post('/api/auth/stations')
    .send({ name: 'Laden-Tablet' })
    .expect(201)
  const pin = await request(api.app)
    .post('/api/auth/pin')
    .set('X-Station-Token', station.body.data.token)
    .send({ userId: pinOwner.id, pin: '4242' })
    .expect(200)
  stationToken = pin.body.data.token
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

describe('Sitzungsart', () => {
  it('verweigert dem Inhaber an einer PIN-Station jede Route', async () => {
    const at = (method: 'get' | 'post' | 'put' | 'delete', p: string) =>
      request(api.app)[method](p).set(bearer(stationToken))
    const calls = [
      at('get', '/api/invoices'),
      at('get', '/api/invoices/config'),
      at('post', '/api/invoices').send({}),
      at('put', '/api/invoices/1').send({}),
      at('delete', '/api/invoices/1'),
      at('post', '/api/invoices/1/issue'),
      at('post', '/api/invoices/1/cancel').send({ reason: 'x' }),
      at('get', '/api/invoices/1/pdf'),
      at('get', '/api/invoices/1/xml'),
    ]
    for (const call of calls) {
      const res = await call
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('personal_session_required')
      expect(res.body.message).toContain('Station')
    }
  })
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
    expect(log?.data).toEqual({
      number: 'TEST-2026-0100',
      dueCents: 2994,
      paid: false,
      pdfSha256: pdf.headers['x-invoice-sha256'],
    })
    expect(JSON.stringify(log?.data)).not.toContain('Sportverein')
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

function download(path: string) {
  return owner()
    .get(path)
    .buffer(true)
    .parse((res, callback) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => callback(null, Buffer.concat(chunks)))
    })
}

describe('Festgeschriebenes PDF', () => {
  it('liefert bei jedem Abruf dieselben, beim Ausstellen gespeicherten Bytes', async () => {
    const id = await issuedInvoice('TEST-2026-0200')
    const row = await Invoice.findByPk(id)
    expect(row?.pdf).toBeInstanceOf(Buffer)
    expect(row?.pdfSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(row?.pdfStoredAt).not.toBeNull()

    const first = await download(`/api/invoices/${id}/pdf`).expect(200)
    const second = await download(`/api/invoices/${id}/pdf`).expect(200)
    expect((first.body as Buffer).equals(row?.pdf as Buffer)).toBe(true)
    expect((second.body as Buffer).equals(first.body as Buffer)).toBe(true)
    expect(first.headers['x-invoice-sha256']).toBe(row?.pdfSha256)
    const dto = await owner().get(`/api/invoices/${id}`).expect(200)
    expect(dto.body.data.pdfSha256).toBe(row?.pdfSha256)
    // die Liste und die Detailansicht tragen die Bytes nicht mit
    expect(dto.body.data.pdf).toBeUndefined()

    // Ausgeliefert wird, was gespeichert ist - nicht, was der Code heute
    // erzeugen würde: ein Renderer, der jetzt etwas anderes liefert, ändert
    // die ausgestellte Rechnung nicht.
    const spy = jest
      .spyOn(invoicePdf, 'renderInvoicePdf')
      .mockResolvedValue(Buffer.from('%PDF-anderes-layout'))
    try {
      const later = await download(`/api/invoices/${id}/pdf`).expect(200)
      expect((later.body as Buffer).equals(first.body as Buffer)).toBe(true)
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  it('lässt das Original beim Stornieren unangetastet und legt die Storno-Fassung daneben', async () => {
    const id = await issuedInvoice('TEST-2026-0201')
    const original = await download(`/api/invoices/${id}/pdf`).expect(200)
    const tooEarly = await owner()
      .get(`/api/invoices/${id}/pdf?variant=storniert`)
      .expect(409)
    expect(tooEarly.body.error).toBe('invoice_not_cancelled')
    await owner().get(`/api/invoices/${id}/pdf?variant=quatsch`).expect(400)

    await owner()
      .post(`/api/invoices/${id}/cancel`)
      .send({ reason: 'Falsche Anschrift' })
      .expect(200)

    const after = await download(`/api/invoices/${id}/pdf`).expect(200)
    expect((after.body as Buffer).equals(original.body as Buffer)).toBe(true)
    expect(after.headers['content-disposition']).toBe(
      'attachment; filename="Rechnung-TEST-2026-0201.pdf"'
    )

    const stamped = await download(
      `/api/invoices/${id}/pdf?variant=storniert`
    ).expect(200)
    expect(stamped.headers['content-disposition']).toBe(
      'attachment; filename="Rechnung-TEST-2026-0201-storniert.pdf"'
    )
    expect((stamped.body as Buffer).equals(original.body as Buffer)).toBe(false)
    const again = await download(
      `/api/invoices/${id}/pdf?variant=storniert`
    ).expect(200)
    expect((again.body as Buffer).equals(stamped.body as Buffer)).toBe(true)

    const row = await Invoice.findByPk(id)
    expect(row?.pdfSha256).toBe(original.headers['x-invoice-sha256'])
    expect(row?.cancelPdfSha256).toBe(stamped.headers['x-invoice-sha256'])
    expect(row?.cancelPdfSha256).not.toBe(row?.pdfSha256)
  })

  it('schreibt eine vor dieser Fassung ausgestellte Rechnung beim ersten Abruf fest', async () => {
    const id = await issuedInvoice('TEST-2026-0202')
    // Stand wie vor der Festschreibung: ausgestellt, aber ohne gespeichertes PDF
    await Invoice.update(
      { pdf: null, pdfSha256: null, pdfStoredAt: null },
      { where: { id } }
    )
    const first = await download(`/api/invoices/${id}/pdf`).expect(200)
    const row = await Invoice.findByPk(id)
    expect((row?.pdf as Buffer).equals(first.body as Buffer)).toBe(true)
    const log = await AuditLog.findOne({
      where: { entity: 'invoice', entityId: String(id), action: 'pdf_freeze' },
    })
    expect(log?.data).toMatchObject({ stamped: false, sha256: row?.pdfSha256 })

    const spy = jest.spyOn(invoicePdf, 'renderInvoicePdf')
    try {
      const second = await download(`/api/invoices/${id}/pdf`).expect(200)
      expect((second.body as Buffer).equals(first.body as Buffer)).toBe(true)
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }

    // ... und beim Stornieren einer solchen Rechnung bleibt das Original erhalten
    const legacy = await issuedInvoice('TEST-2026-0203')
    await Invoice.update(
      { pdf: null, pdfSha256: null },
      { where: { id: legacy } }
    )
    await owner()
      .post(`/api/invoices/${legacy}/cancel`)
      .send({ reason: 'Test' })
      .expect(200)
    const original = await download(`/api/invoices/${legacy}/pdf`).expect(200)
    const stamped = await download(
      `/api/invoices/${legacy}/pdf?variant=storniert`
    ).expect(200)
    expect((original.body as Buffer).equals(stamped.body as Buffer)).toBe(false)
    expect((await Invoice.findByPk(legacy))?.pdfSha256).toBe(
      original.headers['x-invoice-sha256']
    )
  })

  it('stellt nicht aus, wenn die Schriften fehlen (503 statt 500)', async () => {
    const created = await owner()
      .post('/api/invoices')
      .send({
        number: 'TEST-2026-0204',
        buyer: BUYER,
        deliveryDate: '2026-11-15',
        lines: LINES,
      })
      .expect(201)
    const id = created.body.data.id
    const errors = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const spy = jest
      .spyOn(invoicePdf, 'renderInvoicePdf')
      .mockRejectedValue(new invoicePdf.InvoiceFontsError(['/nirgendwo']))
    try {
      const res = await owner().post(`/api/invoices/${id}/issue`).expect(503)
      expect(res.body.error).toBe('invoice_fonts_missing')
      expect(res.body.message).toContain('Schriftdateien')
    } finally {
      spy.mockRestore()
      errors.mockRestore()
    }
    // nichts halb ausgestellt
    const row = await Invoice.findByPk(id)
    expect(row?.status).toBe('entwurf')
    expect(row?.xml).toBeNull()
    expect(row?.pdf).toBeNull()
    await owner().post(`/api/invoices/${id}/issue`).expect(200)

    const config = await owner().get('/api/invoices/config').expect(200)
    expect(config.body.data).toMatchObject({ pdfReady: true, pdfMessage: null })
    expect(invoicePdf.fontsProblem()).toBeNull()
  })
})

describe('Bereits bezahlt', () => {
  it('startet aus einer bezahlten Vorbestellung als „bereits bezahlt“ und verlangt keine Überweisung', async () => {
    const order = await preorder('LA-2026-11-15-20', {
      paid: true,
      paidAmount: 43.8,
    })
    const res = await owner()
      .post('/api/invoices')
      .send({ preorderId: order.id })
      .expect(201)
    const draft = res.body.data
    expect(draft).toMatchObject({
      paid: true,
      paidOn: null,
      paidMethod: '',
      preorderPaidCents: 4380,
      warnings: [],
    })
    expect(draft.missing.map((m: any) => m.field)).toEqual(
      expect.arrayContaining(['paidOn', 'paidMethod'])
    )
    expect(draft.missing.map((m: any) => m.field)).not.toContain('seller.bank')

    // ohne Bankverbindung ausstellbar: es wird nichts überwiesen
    seller = { ...fixture.SELLER, iban: '', bic: '', accountHolder: '' }
    const bad = await owner()
      .put(`/api/invoices/${draft.id}`)
      .send({ paidMethod: 'scheck' })
      .expect(422)
    expect(bad.body.fields[0].field).toBe('paidMethod')
    const saved = await owner()
      .put(`/api/invoices/${draft.id}`)
      .send({
        number: 'TEST-2026-0210',
        buyer: BUYER,
        paid: true,
        paidOn: '2026-11-15',
        paidMethod: 'bar',
      })
      .expect(200)
    expect(saved.body.data).toMatchObject({
      issuable: true,
      paymentTerms: 'Betrag bereits bezahlt am 15.11.2026 (bar).',
    })
    expect(saved.body.data.totals).toMatchObject({
      dueCents: 4380,
      prepaidCents: 4380,
      payableCents: 0,
    })
    const issued = await owner()
      .post(`/api/invoices/${draft.id}/issue`)
      .expect(200)
    expect(issued.body.data.totals.payableCents).toBe(0)

    const xml = (await owner().get(`/api/invoices/${draft.id}/xml`)).text
    expect(xml).toContain(
      '<ram:TotalPrepaidAmount>43.80</ram:TotalPrepaidAmount>' +
        '<ram:DuePayableAmount>0.00</ram:DuePayableAmount>'
    )
    expect(xml).toContain(
      '<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>10</ram:TypeCode></ram:SpecifiedTradeSettlementPaymentMeans>'
    )
    expect(xml).not.toContain('IBANID')
    expect(xml).not.toContain('DueDateDateTime')
  })

  it('warnt, wenn eine bezahlte Vorbestellung doch per Überweisung berechnet wird', async () => {
    const order = await preorder('LA-2026-11-15-21', { paid: true })
    const res = await owner()
      .post('/api/invoices')
      .send({ preorderId: order.id })
      .expect(201)
    // paidAmount fehlt = in voller Höhe bezahlt
    expect(res.body.data).toMatchObject({ paid: true, preorderPaidCents: 4380 })
    const switched = await owner()
      .put(`/api/invoices/${res.body.data.id}`)
      .send({ paid: false })
      .expect(200)
    expect(switched.body.data.paid).toBe(false)
    expect(switched.body.data.warnings).toHaveLength(1)
    expect(switched.body.data.warnings[0]).toContain('als bezahlt vermerkt')
    expect(switched.body.data.warnings[0]).toContain('43,80 €')
    await owner().delete(`/api/invoices/${res.body.data.id}`).expect(200)
  })

  it('weist eine Teilzahlung nicht aus, sondern warnt', async () => {
    const order = await preorder('LA-2026-11-15-22', {
      paid: true,
      paidAmount: 20,
    })
    const res = await owner()
      .post('/api/invoices')
      .send({ preorderId: order.id })
      .expect(201)
    expect(res.body.data.paid).toBe(false)
    expect(res.body.data.warnings[0]).toContain('20,00 €')
    expect(res.body.data.warnings[0]).toContain('Teilzahlungen')
    await owner().delete(`/api/invoices/${res.body.data.id}`).expect(200)

    const unpaid = await preorder('LA-2026-11-15-23')
    const plain = await owner()
      .post('/api/invoices')
      .send({ preorderId: unpaid.id })
      .expect(201)
    expect(plain.body.data).toMatchObject({
      paid: false,
      preorderPaidCents: null,
      warnings: [],
    })
    await owner().delete(`/api/invoices/${plain.body.data.id}`).expect(200)
  })

  it('verlangt beim Ausstellen Zahlungsdatum und Zahlart', async () => {
    const created = await owner()
      .post('/api/invoices')
      .send({
        number: 'TEST-2026-0211',
        buyer: BUYER,
        deliveryDate: '2026-11-15',
        lines: LINES,
        paid: true,
        paidOn: '2026-11-20',
        paidMethod: 'karte',
      })
      .expect(201)
    const res = await owner()
      .post(`/api/invoices/${created.body.data.id}/issue`)
      .expect(422)
    expect(res.body.fields.map((f: any) => f.field)).toEqual(['paidOn'])
    expect(res.body.message).toContain('nach dem Rechnungsdatum')
    await owner().delete(`/api/invoices/${created.body.data.id}`).expect(200)
  })
})

describe('Eingaben', () => {
  it('nennt das Produkt, wenn ein Preis der Vorbestellung keine ganzen Cent hat', async () => {
    const order = await preorder('LA-2026-11-15-30')
    await PreorderItem.update(
      { unitPrice: 0.333 },
      { where: { preorderId: order.id, productId: 'musterkranz' } }
    )
    const res = await owner()
      .post('/api/invoices')
      .send({ preorderId: order.id })
      .expect(422)
    expect(res.body.error).toBe('preorder_price_invalid')
    expect(res.body.message).toContain('„Musterkranz (Nuss)“')
    expect(res.body.message).toContain('0,333 €')
    expect(res.body.productId).toBe('musterkranz')
  })

  it('antwortet 422 statt 500, wenn Menge × Preis zu groß ist', async () => {
    const res = await owner()
      .post('/api/invoices')
      .send({
        lines: [
          { name: 'Zu viel', quantity: 100000, unitPriceGross: '999999,99' },
        ],
      })
      .expect(422)
    expect(res.body.error).toBe('validation_failed')
    expect(res.body.fields[0].field).toBe('lines[0].quantity')
    expect(res.body.message).toContain('zu groß')
  })

  it('erkennt gleich aussehende Rechnungsnummern als dieselbe', async () => {
    await issuedInvoice('TEST 2026/0300')
    for (const number of [
      'test 2026/0300',
      '  TEST  2026/0300 ',
      'ＴＥＳＴ 2026/0300',
    ]) {
      const res = await owner()
        .post('/api/invoices')
        .send({ number })
        .expect(409)
      expect(res.body.error).toBe('number_taken')
    }
    // gespeichert bleibt, was getippt wurde
    const draft = await owner()
      .post('/api/invoices')
      .send({ number: 'Test 2026/0301' })
      .expect(201)
    expect(draft.body.data.number).toBe('Test 2026/0301')
    expect((await Invoice.findByPk(draft.body.data.id))?.numberKey).toBe(
      'test 2026/0301'
    )
    const clash = await owner()
      .put(`/api/invoices/${draft.body.data.id}`)
      .send({ number: 'TEST 2026/0300' })
      .expect(409)
    expect(clash.body.error).toBe('number_taken')
    await owner().delete(`/api/invoices/${draft.body.data.id}`).expect(200)
  })

  it('lehnt unsichtbare Zeichen in der Rechnungsnummer ab', async () => {
    for (const number of [
      'TEST\u200b-1',
      'TEST\u00a01',
      'TEST\ufeff1',
      'TE\tST',
    ]) {
      const res = await owner()
        .post('/api/invoices')
        .send({ number })
        .expect(422)
      expect(res.body.fields[0].field).toBe('number')
      expect(res.body.message).toContain('unsichtbare Zeichen')
    }
  })

  it('lehnt Zeilenumbrüche in der Anschrift und unbekannte Länder ab', async () => {
    const res = await owner()
      .post('/api/invoices')
      .send({
        buyer: {
          name: 'Verein\nBeispiel',
          city: 'Probe\tdorf',
          countryCode: 'XX',
        },
        note: 'Zeile 1\nZeile 2',
      })
      .expect(422)
    expect(res.body.fields.map((f: any) => f.field)).toEqual([
      'buyer.name',
      'buyer.city',
      'buyer.countryCode',
    ])
    expect(res.body.fields[0].message).toContain('Zeilenumbrüche')
    expect(res.body.fields[2].message).toContain('Ländercode')
    const ok = await owner()
      .post('/api/invoices')
      .send({ buyer: { countryCode: 'fr' }, note: 'Zeile 1\nZeile 2' })
      .expect(201)
    expect(ok.body.data.buyer.countryCode).toBe('FR')
    await owner().delete(`/api/invoices/${ok.body.data.id}`).expect(200)
  })

  it('prüft Rechnungs- und Leistungsdatum beim Ausstellen auf Plausibilität', async () => {
    const created = await owner()
      .post('/api/invoices')
      .send({
        number: 'TEST-2026-0310',
        buyer: BUYER,
        lines: LINES,
        invoiceDate: '2026-11-30',
        deliveryDate: '2023-11-15',
      })
      .expect(201)
    const id = created.body.data.id
    expect(created.body.data.missing.map((m: any) => m.field)).toEqual([
      'invoiceDate',
      'deliveryDate',
    ])
    const res = await owner().post(`/api/invoices/${id}/issue`).expect(422)
    expect(res.body.message).toContain('Zukunft')
    expect(res.body.fields[1].message).toContain('zwei Jahre')
    // eine Woche voraus und der Abholtag am Sonntag sind in Ordnung
    const ok = await owner()
      .put(`/api/invoices/${id}`)
      .send({ invoiceDate: '2026-11-22', deliveryDate: '2026-11-15' })
      .expect(200)
    expect(ok.body.data.issuable).toBe(true)
    await owner().delete(`/api/invoices/${id}`).expect(200)
  })
})

describe('Entwürfe und die 90-Tage-Bereinigung', () => {
  it('leert Name und Anschrift liegengebliebener Entwürfe, nie ausgestellter Rechnungen', async () => {
    // alt: Entwurf aus einer Vorbestellung, deren Abholtag über 90 Tage zurückliegt
    const oldOrder = await preorder('LA-2026-07-01-01', {
      pickupDate: '2026-07-01',
      status: 'abgeholt',
    })
    const fromPreorder = (
      await owner()
        .post('/api/invoices')
        .send({ preorderId: oldOrder.id, buyer: BUYER, note: 'ruft an' })
        .expect(201)
    ).body.data.id
    // alt: freier Entwurf mit altem Leistungsdatum
    const free = (
      await owner()
        .post('/api/invoices')
        .send({ buyer: BUYER, deliveryDate: '2026-07-01', lines: LINES })
        .expect(201)
    ).body.data.id
    // frisch: Entwurf aus einer aktuellen Vorbestellung und ein freier von heute
    const freshOrder = await preorder('LA-2026-11-15-40')
    const fresh = (
      await owner()
        .post('/api/invoices')
        .send({ preorderId: freshOrder.id, buyer: BUYER })
        .expect(201)
    ).body.data.id
    const today = (
      await owner().post('/api/invoices').send({ buyer: BUYER }).expect(201)
    ).body.data.id
    // ausgestellt, mit altem Leistungsdatum: bleibt vollständig
    const issued = await owner()
      .post('/api/invoices')
      .send({
        number: 'TEST-2026-0400',
        buyer: BUYER,
        deliveryDate: '2026-07-01',
        lines: LINES,
      })
      .expect(201)
    await owner().post(`/api/invoices/${issued.body.data.id}/issue`).expect(200)

    const dry = await anonymizePreorders({ today: '2026-11-15', dryRun: true })
    expect(dry.invoiceDrafts.map((d) => d.id)).toEqual([fromPreorder, free])
    expect((await Invoice.findByPk(free))?.buyerName).toBe(BUYER.name)

    const report = await anonymizePreorders({ today: '2026-11-15' })
    expect(report.invoiceDrafts).toEqual([
      {
        id: fromPreorder,
        preorderCode: 'LA-2026-07-01-01',
        reference: '2026-07-01',
      },
      { id: free, preorderCode: null, reference: '2026-07-01' },
    ])
    for (const id of [fromPreorder, free]) {
      const dto = (await owner().get(`/api/invoices/${id}`).expect(200)).body
        .data
      expect(dto.buyer).toEqual({
        name: '',
        careOf: '',
        street: '',
        postcode: '',
        city: '',
        countryCode: 'DE',
      })
      expect(dto.note).toBe('')
      expect(dto.anonymizedAt).not.toBeNull()
      expect(dto.status).toBe('entwurf')
    }
    // Positionen bleiben (keine Personendaten)
    expect(
      (await owner().get(`/api/invoices/${free}`)).body.data.lines
    ).toHaveLength(2)
    for (const id of [fresh, today, issued.body.data.id]) {
      const dto = (await owner().get(`/api/invoices/${id}`).expect(200)).body
        .data
      expect(dto.buyer).toEqual(BUYER)
      expect(dto.anonymizedAt).toBeNull()
    }
    const log = await AuditLog.findOne({
      where: { entity: 'invoice', entityId: String(free), action: 'anonymize' },
    })
    expect(JSON.stringify(log?.data)).not.toContain('Sportverein')

    // ein zweiter Lauf findet nichts mehr
    const again = await anonymizePreorders({ today: '2026-11-15' })
    expect(again.invoiceDrafts).toEqual([])
    for (const id of [fromPreorder, free, fresh, today]) {
      await owner().delete(`/api/invoices/${id}`).expect(200)
    }
  })
})
