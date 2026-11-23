import { createHash } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
  chmod,
} from 'node:fs/promises'
import type { Server } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { QueryTypes } from 'sequelize'

import { openDocument } from '../../src/services/pdf-kit'
import { AuditLog, Invoice } from '../../src/models'
import type { ReceiptsService } from '../../src/services/receipts.service'
import { cii, EXAMPLE_IBAN, ubl } from '../fixtures/receipt.synthetic'
import { bearer, createUser, TEST_PASSWORD } from '../helpers/auth'
import { createTestApp, type TestApp } from '../helpers/createTestApp'

jest.setTimeout(30_000)

const NOW = new Date('2026-11-23T11:00:00Z')
let clock = NOW
const MONTH = '2026-11'
const BILL = '/api/receipts'
const BANK = '/api/finance/transactions/without-receipt'
const LINKS = '/api/transaction-links'
const PNG = Buffer.from('89504e470d0a1a0a', 'hex')
const PDF_TEXT = [
  'Lieferant: Beispiel-Mühle GmbH',
  'Rechnungsdatum: 21.11.2026',
  'Summe: 15,00 EUR',
  'Gesamtbetrag: EUR 17,85',
].join('\n')
let api: TestApp
let server: Server
let root: string
let token: string
let staff: string
let stationToken: string
let service: ReceiptsService

const owner = () => request(server)
const auth = () => bearer(token)
const upload = (
  body: string | Buffer,
  url = BILL,
  mime = 'application/octet-stream'
) =>
  owner()
    .post(url)
    .set(auth())
    .set('Content-Type', mime)
    .send(typeof body === 'string' ? Buffer.from(body) : body)

const bankRow = (id: string, patch: Record<string, unknown> = {}) => ({
  id,
  amount: -118.9,
  booking_date: '2026-11-20',
  status: 'vorgemerkt',
  currency: 'EUR',
  counterparty: 'Beispiel-Mühle & Co.',
  counterparty_iban: EXAMPLE_IBAN,
  purpose: 'Testzahlung BM-0815 ' + EXAMPLE_IBAN,
  classification: { category: 'test_ausgabe' },
  ...patch,
})

async function writeMonth(transactions: ReturnType<typeof bankRow>[]) {
  await writeFile(
    path.join(root, 'finance', 'transactions', MONTH + '.json'),
    JSON.stringify({
      schema_version: 1,
      month: MONTH,
      transactions,
    })
  )
}

async function extracted(body: string | Buffer, route = BILL) {
  const { body: response } = await upload(body, route).expect(201)
  await service.idle()
  return response.data as { id: number; file_id: number; status: string }
}

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'test-belege-'))
  await mkdir(path.join(root, 'finance', 'transactions'), { recursive: true })
  await mkdir(path.join(root, 'finance', 'config'))
  const localTextTool = path.join(root, 'test-pdftotext')
  // Ersetzt in diesem Test nur das optionale Programm. Erwartet Layout-Modus,
  // Dateieingabe und stdout; die PDF-Datei entsteht in diesem Test mit PDFKit.
  await writeFile(
    localTextTool,
    `#!${process.execPath}
const args = process.argv.slice(2);
const fs = require('fs');
if (args.join('|').startsWith('-layout|-enc|UTF-8|') && args[4] === '-' &&
    fs.readFileSync(args[3]).subarray(0, 5).toString() === '%PDF-') {
  process.stdout.write(${JSON.stringify(PDF_TEXT)});
} else { process.exitCode = 1; }`,
    { mode: 0o700 }
  )
  api = await createTestApp({
    app: {
      hq: { financeDir: path.join(root, 'finance') },
      receipts: {
        directory: path.join(root, 'belege'),
        now: () => clock,
        pdftotext: process.env['RECEIPT_TEST_PDFTOTEXT'] || localTextTool,
      },
    },
  })
  service = api.app.locals['receiptsService']
  // Einmal auf IPv4 lauschen, damit parallele macOS-Jest-Prozesse keine
  // Antworten zwischen den von Supertest vergebenen Ports austauschen.
  server = await new Promise<Server>((resolve, reject) => {
    const listener = api.app.listen(0, '127.0.0.1', () => resolve(listener))
    listener.once('error', reject)
  })

  async function loginAs(username: string, role: 'inhaber' | 'verkauf') {
    await createUser({ username, role })
    const result = await owner()
      .post('/api/auth/login')
      .send({ username, password: TEST_PASSWORD })
      .expect(200)
    return result.body.data.token as string
  }
  token = await loginAs('test.belege.inhaber', 'inhaber')
  staff = await loginAs('test.belege.verkauf', 'verkauf')
  const user = await createUser({
    username: 'test.belege.pin',
    role: 'inhaber',
    pin: '4242',
  })
  const station = await owner()
    .post('/api/auth/stations')
    .set(auth())
    .send({ name: 'Teststation' })
    .expect(201)
  const pin = await owner()
    .post('/api/auth/pin')
    .set('X-Station-Token', station.body.data.token)
    .send({ userId: user.id, pin: '4242' })
    .expect(200)
  stationToken = pin.body.data.token
})

afterAll(async () => {
  await service?.idle()
  if (server)
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  await api?.close()
  if (root) await rm(root, { recursive: true, force: true })
})

it('migrates fresh SQLite and protects all endpoints including the file', async () => {
  expect(api.migrations).toContain('20270403000000-receipts.js')
  expect(
    await api.sequelize.query('PRAGMA foreign_key_check', {
      type: QueryTypes.SELECT,
    })
  ).toEqual([])
  for (const url of [BILL, BILL + '/1/files/1', BILL + '/matches', BANK]) {
    const guest = await owner()
      .get(url)
      .expect(401)
      .expect('Cache-Control', 'no-store')
    expect(guest.body).toEqual(
      expect.objectContaining({
        message: expect.any(String),
        error: expect.any(String),
      })
    )
    await owner().get(url).set(bearer(staff)).expect(403)
    const pin = await owner().get(url).set(bearer(stationToken)).expect(403)
    expect(pin.body.error).toBe('personal_session_required')
  }
  await owner().post(LINKS).set(bearer(staff)).send({}).expect(403)
  await owner()
    .post(BILL)
    .set(bearer(staff))
    .type('application/octet-stream')
    .send(PNG)
    .expect(403)
})

it('speichert lesbare unveränderliche Originale, erkennt XML und warnt über Duplikate', async () => {
  const bytes = Buffer.from(ubl())
  const sha = createHash('sha256').update(bytes).digest('hex')
  const results = await Promise.all([upload(bytes), upload(bytes)])
  const created = results.find((result) => result.status === 201)?.body.data
  expect(results.map((result) => result.status).sort()).toEqual([201, 409])
  const duplicate = results.find((result) => result.status === 409)
  expect(duplicate?.body).toMatchObject({
    error: 'duplicate_receipt_file',
    receipt_id: created.id,
  })
  await service.idle()

  const filename = path.join(root, 'belege', '2026', '11', sha + '.xml')
  expect(await readFile(filename)).toEqual(bytes)
  expect((await stat(filename)).mode & 0o777).toBe(0o440)
  const response = await owner()
    .get(BILL + '/' + created.id)
    .set(auth())
    .expect(200)
    .expect('Cache-Control', 'no-store')
  expect(response.body.data).toMatchObject({
    status: 'erkannt',
    extracted_by: 'xml',
    gross_cents: 11890,
    supplier_iban_masked: 'DE•• •••• 3000',
    files: [{ id: created.file_id, role: 'xml', page: 1, sha256: sha }],
  })
  expect(response.text).not.toContain(EXAMPLE_IBAN)
  expect(response.body.data).not.toHaveProperty('supplier_vat_id')
  const file = await owner()
    .get(`${BILL}/${created.id}/files/${created.file_id}`)
    .set(auth())
    .expect(200)
    .expect('Cache-Control', 'no-store')
    .expect('X-Receipt-Sha256', sha)
    .expect(
      'Content-Disposition',
      `attachment; filename="Beleg-${created.id}-1.xml"`
    )
  expect(file.text).toBe(bytes.toString())

  const extra = await extracted(PNG, BILL + '/' + created.id + '/files')
  const pages = await owner()
    .get(BILL + '/' + extra.id)
    .set(auth())
    .expect(200)
  expect(pages.body.data.files.map(({ page }) => page)).toEqual([1, 2])

  const duplicateNumber = await extracted(ubl().replace('118.90', '119.90'))
  const warning = await owner()
    .get(BILL + '/' + duplicateNumber.id)
    .set(auth())
    .expect(200)
  expect(warning.body.data.duplicates).toContain(created.id)
  await owner()
    .delete(BILL + '/' + duplicateNumber.id)
    .set(auth())
    .expect(200)

  const report = await service.verifyFileHashes()
  expect(report.checked).toBe(2)
  expect(report.issues).toEqual([])
  await chmod(filename, 0o640)
  await writeFile(filename, 'Test für Hashabweichung')
  expect(await service.verifyFileHashes()).toMatchObject({
    issues: [{ file_id: created.file_id, receipt_id: created.id }],
  })
  await writeFile(filename, bytes)
  await chmod(filename, 0o440)
})

it('prüft Anfragegröße vor dem Puffern und protokolliert fehlerhafte Erkennung nach dem Upload', async () => {
  const large = Buffer.alloc(15_000_001)
  PNG.copy(large)
  const tooLarge = await upload(large)
    .expect(413)
    .expect('Cache-Control', 'no-store')
  expect(tooLarge.body.error).toBe('payload_too_large')
  await upload('nur Text', BILL, 'application/pdf').expect(415)
  const unsafeXml =
    '<?xml version="1.0"?><!DOCTYPE Invoice [<!ENTITY test "TEST">]><Invoice>&test;</Invoice>'
  for (const invalid of [
    unsafeXml,
    '<Test>keine XML-Datei',
    '<Test></Andere>',
  ]) {
    await upload(invalid, BILL, 'application/xml').expect(415)
  }
  const receipt = await extracted(
    '<Test>Gültige XML mit unbekanntem Rechnungsformat</Test>'
  )
  const detail = await owner()
    .get(BILL + '/' + receipt.id)
    .set(auth())
    .expect(200)
  expect(detail.body.data.status).toBe('neu')
  expect(detail.body.data.extraction_errors).toEqual([
    'Die XML ist keine unterstützte UBL- oder CII-Rechnung.',
  ])
  await owner()
    .post(BILL + '/' + receipt.id + '/discard')
    .set(auth())
    .expect(200)
  await upload(cii, BILL + '/' + receipt.id + '/files').expect(409)
  await owner()
    .delete(BILL + '/' + receipt.id)
    .set(auth())
    .expect(200)
  await owner()
    .get(BILL + '/' + receipt.id)
    .set(auth())
    .expect(404)
})

it('liest Textschicht nach der Antwort und speichert Erkennungsläufe serverseitig', async () => {
  const { doc, done } = openDocument({ info: { Title: 'Synthetischer Beleg' } })
  doc.text(PDF_TEXT)
  doc.end()
  const receipt = await extracted(await done)
  const detail = await owner()
    .get(BILL + '/' + receipt.id)
    .set(auth())
    .expect(200)
  expect(detail.body.data).toMatchObject({
    gross_cents: 1785,
    extracted_by: 'textlayer',
    field_flags: { vat_lines: expect.any(String) },
  })
  const rows = await api.sequelize.query(
    'SELECT engine, version, fields, raw, duration_ms FROM receipt_extractions WHERE receipt_id = $id',
    {
      type: QueryTypes.SELECT,
      bind: { id: receipt.id },
    }
  )
  expect(rows).toMatchObject([
    {
      engine: 'textlayer',
      version: expect.any(String),
      fields: expect.stringContaining('1785'),
      raw: expect.stringContaining('17,85'),
      duration_ms: expect.any(Number),
    },
  ])

  await extracted(
    cii.replace('BEISPIEL-002', 'BEISPIEL-XML-PDF'),
    BILL + '/' + receipt.id + '/files'
  )
  const authoritative = await owner()
    .get(BILL + '/' + receipt.id)
    .set(auth())
    .expect(200)
  expect(authoritative.body.data).toMatchObject({
    extracted_by: 'xml',
    invoice_number: 'BEISPIEL-XML-PDF',
    gross_cents: 10700,
    skonto_rate: null,
    files: [{ role: 'original' }, { role: 'xml' }],
  })
})

it('behält bestätigte Belege bei Korrekturen mit Alt- und Neuwert', async () => {
  const receipt = await extracted(cii)
  const route = BILL + '/' + receipt.id
  await owner()
    .post(route + '/confirm')
    .set(auth())
    .expect(200)
  await owner()
    .post(route + '/discard')
    .set(auth())
    .expect(409)
  await owner().delete(route).set(auth()).expect(409)
  await upload(Buffer.concat([PNG, Buffer.from([3])]), route + '/files').expect(
    409
  )
  for (const patch of [
    { supplier_name: null },
    { supplier_name: '   ' },
    { invoice_date: null },
    { invoice_date: '2026-11-24' },
    { gross_cents: null },
  ]) {
    const invalid = await owner()
      .patch(route)
      .set(auth())
      .send(patch)
      .expect(422)
    expect(invalid.body.error).toBe('incomplete_receipt')
  }
  const afterRejectedPatches = await owner().get(route).set(auth()).expect(200)
  expect(afterRejectedPatches.body.data).toMatchObject({
    status: 'geprueft',
    supplier_name: 'Beispiel-Mühle GmbH',
    invoice_date: '2026-11-14',
    gross_cents: 10700,
  })
  expect(
    await AuditLog.count({
      where: {
        entity: 'receipt',
        entityId: String(receipt.id),
        action: 'update',
      },
    })
  ).toBe(0)
  await owner()
    .patch(route)
    .set(auth())
    .send({ invoice_number: 'BEISPIEL-003' })
    .expect(200)
  const audit = await AuditLog.findOne({
    where: {
      entity: 'receipt',
      entityId: String(receipt.id),
      action: 'update',
    },
  })
  expect(audit).toMatchObject({
    userId: expect.any(Number),
    createdAt: expect.any(Date),
    data: {
      changes: { invoice_number: { alt: 'BEISPIEL-002', neu: 'BEISPIEL-003' } },
    },
  })
  const list = await owner()
    .get(BILL)
    .set(auth())
    .query({ monat: MONTH, status: 'geprueft' })
    .expect(200)
  expect(list.body.data.receipts).toMatchObject([{ id: receipt.id }])
})

it('schlägt ohne Schreibzugriff vor, merkt Ablehnung und verknüpft erst nach Bestätigung', async () => {
  await writeMonth([
    bankRow('aabb1122'),
    bankRow('aabb1133'),
    bankRow('bbcc1122', {
      amount: -5,
      counterparty: 'Versand Testfirma',
      counterparty_iban: null,
      purpose: 'Testgebühr',
      classification: { category: 'test_ausnahme' },
    }),
  ])
  const before = await owner()
    .get(BANK)
    .set(auth())
    .query({ monat: MONTH })
    .expect(200)
  expect(before.body.data.transactions).toHaveLength(3)
  expect(before.text).not.toContain(EXAMPLE_IBAN)
  const list = await owner()
    .get(BILL + '/matches')
    .set(auth())
    .query({ monat: MONTH })
    .expect(200)
  const proposals = list.body.data.proposals
  expect(proposals).toHaveLength(2)
  expect(proposals[0]).toMatchObject({
    ambiguous: true,
    parts: [{ booking: { status: 'vorgemerkt' } }],
  })
  expect(list.body.data.links).toEqual([])
  expect(list.text).not.toContain(EXAMPLE_IBAN)

  await owner()
    .post(`${LINKS}/${proposals[0].id}/reject`)
    .set(auth())
    .expect(200)
  const remaining = await owner()
    .get(BILL + '/matches')
    .set(auth())
    .query({ monat: MONTH })
    .expect(200)
  expect(remaining.body.data.proposals.map(({ id }) => id)).toEqual([
    proposals[1].id,
  ])
  await owner()
    .post(LINKS)
    .set(auth())
    .send({ proposal_id: proposals[1].id })
    .expect(201)
  await writeFile(
    path.join(root, 'finance', 'config', 'receipt-exclusions.json'),
    JSON.stringify({ excluded_categories: ['test_ausnahme'] })
  )
  const expenses = await owner()
    .get(BANK)
    .set(auth())
    .query({ monat: MONTH })
    .expect(200)
  expect(expenses.body.data.transactions.map(({ id }) => id)).toEqual([
    proposals[0].parts[0].transaction_id,
  ])
  const unset = await owner()
    .get(BANK)
    .set(auth())
    .query({ monat: '2026-10' })
    .expect(200)
  expect(unset.body.data).toMatchObject({ available: false, transactions: [] })
  const unlinked = await owner()
    .get(BILL + '/without-booking')
    .set(auth())
    .query({ monat: MONTH })
    .expect(200)
  const receiptId = proposals[1].parts[0].target_id
  expect(unlinked.body.data.receipts.map(({ id }) => id)).not.toContain(
    receiptId
  )

  const replaced = proposals[1].parts[0].transaction_id
  await writeMonth([
    bankRow('eeff1122', { status: 'gebucht', booking_date: '2026-11-21' }),
  ])
  const scope = { beleg: receiptId }
  const stale = await owner()
    .get(BILL + '/matches')
    .set(auth())
    .query(scope)
    .expect(200)
  const link = stale.body.data.links[0]
  expect(link).toMatchObject({
    transaction_id: replaced,
    booking: null,
    review_required: true,
    replacements: [{ id: 'eeff1122', status: 'gebucht' }],
  })
  const matches = await owner()
    .get(BILL + '/matches')
    .set(auth())
    .query({ buchung: 'eeff1122' })
    .expect(200)
  expect(matches.body.data.links[0]).toMatchObject({
    transaction_id: replaced,
    review_required: true,
  })
  await owner()
    .post(LINKS)
    .set(auth())
    .send({
      transaction_id: 'eeff1122',
      kind: 'receipt',
      target_id: receiptId,
      replace_link_id: link.id,
    })
    .expect(201)
  const final = await owner()
    .get(BILL + '/matches')
    .set(auth())
    .query(scope)
    .expect(200)
  expect(final.body.data.links).toMatchObject([
    { transaction_id: 'eeff1122', review_required: false },
  ])
})

it('verbindet sowohl eine manuelle Teilzahlung als auch einen Vorschlag für Ausgangsrechnungen', async () => {
  await writeMonth([
    bankRow('dcba1122', { amount: -5, purpose: 'Manuelle Testzahlung' }),
    bankRow('dcba1133', {
      amount: 31.01,
      counterparty: 'Testabnehmer GmbH',
      counterparty_iban: null,
      purpose: 'Rechnung TA-0726',
    }),
  ])
  const receipt = await extracted(
    Buffer.concat([PNG, Buffer.from([4])]),
    BILL + '?buchung=dcba1122'
  )
  const detail = await owner()
    .get(BILL + '/' + receipt.id)
    .set(auth())
    .expect(200)
  expect(detail.body.data.booking_hint).toMatchObject({ id: 'dcba1122' })
  expect(detail.body.data.extraction_pending).toBe(false)
  await owner()
    .patch(BILL + '/' + receipt.id)
    .set(auth())
    .send({
      supplier_name: 'Laternen-Testbedarf GmbH',
      invoice_date: '2026-11-10',
      gross_cents: 800,
      currency: 'EUR',
    })
    .expect(200)
  await owner()
    .post(LINKS)
    .set(auth())
    .send({
      transaction_id: 'dcba1122',
      kind: 'receipt',
      target_id: receipt.id,
      amount_cents: 501,
    })
    .expect(422)
  await owner()
    .post(LINKS)
    .set(auth())
    .send({
      transaction_id: 'dcba1122',
      kind: 'receipt',
      target_id: receipt.id,
      amount_cents: 420,
    })
    .expect(201)
  const partial = await owner()
    .get(BANK)
    .set(auth())
    .query({ monat: MONTH })
    .expect(200)
  expect(partial.body.data.transactions).toMatchObject([
    { id: 'dcba1122', amount: -5, remaining_cents: 80 },
  ])
  const withPartial = await owner()
    .get(BILL + '/' + receipt.id)
    .set(auth())
    .expect(200)
  expect(withPartial.body.data.booking_hint.allocation).toMatchObject({
    booking_open_cents: 80,
    receipt_open_cents: 380,
    max_cents: 80,
  })
  const invoice = await Invoice.create({
    number: 'TA-0726',
    buyerName: 'Testabnehmer GmbH',
    status: 'ausgestellt',
    invoiceDate: '2026-11-12',
    dueDate: '2026-11-20',
    totals: { totals: { payableCents: 3101 } },
  })
  const match = await owner()
    .get(BILL + '/matches')
    .set(auth())
    .query({ buchung: 'dcba1133' })
    .expect(200)
  expect(match.body.data.proposals).toMatchObject([
    { parts: [{ target_id: invoice.id, kind: 'invoice' }] },
  ])
  await owner()
    .post(LINKS)
    .set(auth())
    .send({ proposal_id: match.body.data.proposals[0].id })
    .expect(201)
  await invoice.reload()
  expect(invoice.paid).toBe(false)

  await owner()
    .post(BILL + '/' + receipt.id + '/discard')
    .set(auth())
    .expect(200)
  const remaining = await owner()
    .get(BILL + '/matches')
    .set(auth())
    .query({ buchung: 'dcba1122' })
    .expect(200)
  expect(remaining.body.data.links).toEqual([])
  await owner()
    .delete(BILL + '/' + receipt.id)
    .set(auth())
    .expect(200)
})

it('maskiert IBANs mit Unicode-Leerraum in Hinweisen, Vorschlägen und Ausgaben', async () => {
  const iban = Array.from(EXAMPLE_IBAN).join('\u202f\u00a0')
  const second = EXAMPLE_IBAN.replace(/(.{4})(?=.)/g, '$1\u2009')
  const purpose =
    'Testkonto ' + iban + ' und ' + second + ' und IBAN' + EXAMPLE_IBAN
  await writeMonth([
    bankRow('abcdf190', {
      amount: -62.06,
      purpose,
      counterparty: 'Testkonto ' + second,
      booking_text: 'Empfang IBAN' + iban,
      counterparty_iban: null,
    }),
  ])
  const receipt = await extracted(
    ubl('TEST-MASKIERUNG').replace('118.90', '62.06'),
    BILL + '?buchung=abcdf190'
  )
  const detail = await owner()
    .get(BILL + '/' + receipt.id)
    .set(auth())
    .expect(200)
  const matches = await owner()
    .get(BILL + '/matches')
    .set(auth())
    .query({ buchung: 'abcdf190' })
    .expect(200)
  const expenses = await owner()
    .get(BANK)
    .set(auth())
    .query({ monat: MONTH })
    .expect(200)
  for (const data of [
    detail.body.data.booking_hint,
    matches.body.data.proposals[0].parts[0].booking,
    expenses.body.data.transactions[0],
  ]) {
    expect(data).toMatchObject({
      purpose:
        'Testkonto DE•• •••• 3000 und DE•• •••• 3000 und IBANDE•• •••• 3000',
      counterparty: 'Testkonto DE•• •••• 3000',
      booking_text: 'Empfang IBANDE•• •••• 3000',
    })
  }
})

it('ordnet Belege ohne Rechnungsdatum dem Berliner Uploadmonat zu', async () => {
  const boundary = new Date('2026-11-30T23:05:00Z')
  clock = boundary
  try {
    const receipt = await extracted(
      Buffer.concat([PNG, Buffer.from('Monatswechsel')])
    )
    for (const route of [BILL, BILL + '/without-booking']) {
      const actual = await owner()
        .get(route)
        .set(auth())
        .query({ monat: '2026-12' })
        .expect(200)
      expect(actual.body.data.receipts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: receipt.id,
            created_at: boundary.toISOString(),
            invoice_date: null,
          }),
        ])
      )
      const previous = await owner()
        .get(route)
        .set(auth())
        .query({ monat: '2026-11' })
        .expect(200)
      expect(previous.body.data.receipts.map(({ id }) => id)).not.toContain(
        receipt.id
      )
    }
  } finally {
    clock = NOW
  }
})

async function manualReceipt(number: string, cents: number) {
  const receipt = await extracted(Buffer.concat([PNG, Buffer.from(number)]))
  await owner()
    .patch(BILL + '/' + receipt.id)
    .set(auth())
    .send({
      supplier_name: 'Beispielgruppe GmbH',
      gross_cents: cents,
      currency: 'EUR',
      invoice_number: number,
      invoice_date: '2026-11-12',
    })
    .expect(200)
  return receipt.id
}

async function checkGroupRejection(
  scope: { buchung: string } | { beleg: number },
  type: string,
  expectedSingletons: number
) {
  const load = async () =>
    (
      await owner()
        .get(BILL + '/matches')
        .set(auth())
        .query(scope)
        .expect(200)
    ).body.data
  const initial = await load()
  const groups = initial.proposals.filter((proposal) => proposal.type === type)
  expect(groups).toHaveLength(2)
  await owner()
    .post(LINKS + '/' + groups[0].id + '/reject')
    .set(auth())
    .expect(200)

  const stillVisible = await load()
  expect(stillVisible.links).toEqual([])
  expect(
    stillVisible.proposals.filter((proposal) => proposal.type === type)
  ).toEqual([expect.objectContaining({ id: groups[1].id })])
  expect(
    stillVisible.proposals.filter((proposal) => proposal.parts.length === 1)
  ).toHaveLength(expectedSingletons)
  expect(
    await AuditLog.findOne({
      where: {
        entity: 'transaction_link_proposal',
        entityId: groups[0].id,
        action: 'reject',
      },
    })
  ).toMatchObject({
    data: {
      type,
      parts: expect.arrayContaining(
        groups[0].parts.map(
          ({ kind, target_id, transaction_id, amount_cents }) =>
            expect.objectContaining({
              kind,
              target_id,
              transaction_id,
              amount_cents,
            })
        )
      ),
    },
  })

  await owner()
    .post(LINKS)
    .set(auth())
    .send({ proposal_id: groups[1].id })
    .expect(201)
  expect((await load()).links).toHaveLength(2)
}

it('lässt nach Ablehnung einer Sammellastschrift die überlappende Kombination zu', async () => {
  await writeMonth([
    bankRow('abcd0190', {
      amount: -100,
      counterparty: 'Beispielgruppe GmbH',
      booking_text: 'SEPA-Lastschrift',
      counterparty_iban: null,
      purpose: 'Test-Sammellastschrift',
    }),
  ])
  await manualReceipt('TEST-GRUPPE-1', 7000)
  await manualReceipt('TEST-GRUPPE-2', 3000)
  await manualReceipt('TEST-GRUPPE-3', 3000)
  await checkGroupRejection({ buchung: 'abcd0190' }, 'sammellastschrift', 0)
  const expenses = await owner()
    .get(BANK)
    .set(auth())
    .query({ monat: MONTH })
    .expect(200)
  expect(expenses.body.data.transactions).toEqual([])
})

it('lässt nach Ablehnung einer Teilzahlungsgruppe die gemeinsamen Einzelteile und Alternativen zu', async () => {
  await writeMonth(
    [70, 30, 30].map((amount, index) =>
      bankRow('fabc019' + index, {
        amount: -amount,
        counterparty: 'Beispielgruppe GmbH',
        counterparty_iban: null,
        purpose: 'Test-Teilzahlung',
      })
    )
  )
  const id = await manualReceipt('TEST-TEILZAHLUNGEN', 10000)
  await checkGroupRejection({ beleg: id }, 'teilzahlungen', 3)
})

it('lässt die Währung eines Fotos offen und gleicht einen manuell erfassten Fremdwährungsbeleg nicht mit EUR ab', async () => {
  const booking = 'abcde192'
  await writeMonth([
    bankRow(booking, { amount: -150, purpose: 'Test-Fremdwährung' }),
  ])
  const receipt = await extracted(
    Buffer.concat([PNG, Buffer.from('Test-Fremdwährung')]),
    BILL + '?buchung=' + booking
  )
  const route = BILL + '/' + receipt.id
  const start = await owner().get(route).set(auth()).expect(200)
  expect(start.body.data).toMatchObject({
    status: 'neu',
    currency: 'XXX',
    field_flags: { currency: expect.stringMatching(/fehlt|unklar/) },
  })
  await owner()
    .patch(route)
    .set(auth())
    .send({
      supplier_name: 'Test-Export GmbH',
      invoice_date: '2026-11-12',
      gross_cents: 15000,
    })
    .expect(200)
  const confirm = await owner()
    .post(route + '/confirm')
    .set(auth())
    .expect(422)
  expect(confirm.body.error).toBe('incomplete_receipt')
  const link = {
    transaction_id: booking,
    kind: 'receipt',
    target_id: receipt.id,
  }
  await owner().post(LINKS).set(auth()).send(link).expect(422)
  await owner().patch(route).set(auth()).send({ currency: 'CHF' }).expect(200)
  const checked = await owner()
    .post(route + '/confirm')
    .set(auth())
    .expect(200)
  expect(checked.body.data).toMatchObject({
    status: 'geprueft',
    currency: 'CHF',
    booking_hint: { allocation: null },
  })
  const matches = await owner()
    .get(BILL + '/matches')
    .query({ beleg: receipt.id })
    .set(auth())
    .expect(200)
  expect(matches.body.data.proposals).toEqual([])
  await owner().post(LINKS).set(auth()).send(link).expect(422)
})

it('lässt eine spätere Erkennung die Felder einer bestätigten Verknüpfung nicht still ändern', async () => {
  await writeMonth([
    bankRow('feed4455', {
      amount: -17.85,
      booking_date: '2026-11-22',
      purpose: 'Testzahlung Textschicht',
    }),
  ])
  const { doc, done } = openDocument({ info: { Title: 'Synthetischer Beleg' } })
  doc.text(PDF_TEXT)
  doc.end()
  const receipt = await extracted(await done)
  await owner()
    .post(LINKS)
    .set(auth())
    .send({
      transaction_id: 'feed4455',
      kind: 'receipt',
      target_id: receipt.id,
      amount_cents: 1785,
    })
    .expect(201)

  // Die angehängte XML weist 107,00 € aus - die Verknüpfung über 17,85 € bleibt.
  await extracted(
    cii.replace('BEISPIEL-002', 'BEISPIEL-XML-NACH-LINK'),
    BILL + '/' + receipt.id + '/files'
  )
  const detail = await owner()
    .get(BILL + '/' + receipt.id)
    .set(auth())
    .expect(200)
  expect(detail.body.data).toMatchObject({
    extracted_by: 'xml',
    invoice_number: 'BEISPIEL-XML-NACH-LINK',
    gross_cents: 1785,
    currency: 'EUR',
  })
  expect(detail.body.data.field_flags.gross_cents).toMatch(
    /anderen Wert \(10700\).*bestätigte Buchungsverknüpfung bleibt/
  )
  const missing = await owner()
    .get(BANK + '?monat=' + MONTH)
    .set(auth())
    .expect(200)
  expect(JSON.stringify(missing.body.data)).not.toContain('feed4455')
})
