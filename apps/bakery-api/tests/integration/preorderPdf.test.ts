/**
 * `GET /api/preorders/:id/pdf` - der Bestellschein gegen die echte App
 * (In-Memory-SQLite). Synthetischer Katalog (`tools/e2e/hq-products`),
 * erfundene Kundin. Aufbau des Blatts: `tests/unit/preorderPdf.test.ts`.
 */
import request from 'supertest'

import { AuditLog, Preorder } from '../../src/models'
import { anonymizePreorders } from '../../src/services/preorders-maintenance'
import * as pdfKit from '../../src/services/pdf-kit'
import * as preorderPdf from '../../src/services/preorder-pdf'
import { bearer, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { makeProductsDir, removeTempDirs } from '../helpers/hqProducts'
import { pdfText } from '../helpers/pdfText'

/* eslint-disable @typescript-eslint/no-var-requires */
const invoiceCore = require('../../src/services/invoice.core')
/* eslint-enable @typescript-eslint/no-var-requires */

jest.setTimeout(30000)

// Donnerstag, 12.11.2026, 10:00 in Berlin; Dienstag ist der 17.11.
const NOW = new Date('2026-11-12T09:00:00.000Z')
const TUESDAY = '2026-11-17'

let api: TestApp
const tokens: Record<string, Record<string, string>> = {}

beforeAll(async () => {
  const productsDir = makeProductsDir()
  api = await createTestApp({
    app: {
      hqProducts: { productsDir, writeDir: null },
      preorders: {
        productsDir,
        variantsForProduct: (id: string) =>
          id === 'mustersemmel'
            ? { itemId: 'semmel-gefuellt', variants: ['nuss', 'schoko'] }
            : null,
        variantsMap: () => ({ mustersemmel: ['nuss', 'schoko'] }),
        now: () => NOW,
      },
    },
  })
  for (const role of ['inhaber', 'verkauf', 'backstube', 'fahrer'] as const) {
    tokens[role] = bearer(await sessionFor(api.app, `test.${role}`, role))
  }
})

afterAll(async () => {
  await api.close()
  removeTempDirs()
})

async function create(extra: Record<string, unknown> = {}) {
  const res = await request(api.app)
    .post('/api/preorders')
    .set(tokens['verkauf'])
    .send({
      channel: 'telefon',
      customerName: 'Petra Probekundin',
      customerPhone: '0170 000 0001',
      pickupDate: TUESDAY,
      pickupTime: '08:30',
      note: 'Bitte geschnitten.',
      items: [
        { productId: 'kornbrot-500g', quantity: 2 },
        { productId: 'mustersemmel', variant: 'nuss', quantity: 6 },
      ],
      ...extra,
    })
    .expect(201)
  return res.body.data
}

/** Lädt das PDF als Buffer (supertest liest sonst Text). */
const pdfOf = (id: number | string, role = 'verkauf') =>
  request(api.app)
    .get(`/api/preorders/${id}/pdf`)
    .set(tokens[role])
    .buffer(true)
    .parse((res, callback) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => callback(null, Buffer.concat(chunks)))
    })

const euro = (value: number) =>
  invoiceCore.formatEuro(invoiceCore.priceToCents(value)) as string

describe('GET /api/preorders/:id/pdf (Bestellschein)', () => {
  it('liefert die Bestellung als PDF - dieselben Angaben wie GET /:id', async () => {
    const p = await create()
    const audits = await AuditLog.count()
    const res = await pdfOf(p.id).expect(200)

    expect(res.headers['content-type']).toBe('application/pdf')
    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="Bestellschein-${p.code}.pdf"`
    )
    expect(res.headers['cache-control']).toBe('no-store')
    const raw = (res.body as Buffer).toString('latin1')
    expect(raw.startsWith('%PDF-1.7')).toBe(true)
    expect(raw).not.toContain('/EmbeddedFile')

    const { text, pages } = pdfText(res.body as Buffer)
    expect(pages).toBe(1)
    expect(text).toContain(`Bestellschein ${p.code}`)
    expect(text).toContain('Dieser Bestellschein ist keine Rechnung.')
    expect(text).toContain('Petra Probekundin')
    expect(p.customerPhone).toBeTruthy()
    expect(text).toContain(p.customerPhone)
    expect(text).toContain('Dienstag, 17.11.2026')
    expect(text).toContain('08:30 Uhr')
    expect(text).toContain('Bitte geschnitten.')
    expect(text).toContain('(Nuss)')
    expect(p.items).toHaveLength(2)
    for (const item of p.items) {
      expect(text).toContain(item.name)
      expect(text).toContain(euro(item.unitPrice))
      expect(text).toContain(euro(item.lineTotal))
    }
    expect(p.total).toBeGreaterThan(0)
    expect(text).toContain(euro(p.total))
    expect(text).toContain('nicht bezahlt')
    expect(text).not.toContain('IBAN')
    // Lesen ändert nichts und steht nicht im Audit-Log.
    expect(await AuditLog.count()).toBe(audits)
  })

  it('dürfen dieselben Rollen laden, die die Bestellung lesen dürfen', async () => {
    const p = await create()
    for (const role of ['inhaber', 'verkauf', 'fahrer']) {
      await pdfOf(p.id, role).expect(200)
    }
    const backstube = await request(api.app)
      .get(`/api/preorders/${p.id}/pdf`)
      .set(tokens['backstube'])
      .expect(403)
    expect(backstube.body.error).toBe('forbidden')
    expect(typeof backstube.body.message).toBe('string')

    const anonymous = await request(api.app)
      .get(`/api/preorders/${p.id}/pdf`)
      .expect(401)
    expect(anonymous.body.error).toBe('unauthorized')
  })

  it('antwortet 404 mit deutscher Meldung für eine unbekannte Bestellung', async () => {
    const res = await request(api.app)
      .get('/api/preorders/999999/pdf')
      .set(tokens['verkauf'])
      .expect(404)
    expect(res.body.success).toBe(false)
    expect(typeof res.body.error).toBe('string')
    expect(res.body.message).toMatch(/Vorbestellung/)
  })

  it('druckt „STORNIERT“ und den Bezahlstand', async () => {
    const p = await create()
    await request(api.app)
      .post(`/api/preorders/${p.id}/status`)
      .set(tokens['verkauf'])
      .send({ paid: true })
      .expect(200)
    const paid = pdfText((await pdfOf(p.id).expect(200)).body as Buffer).text
    expect(paid).toContain(`bezahlt (${euro(p.total)})`)
    expect(paid).not.toContain('STORNIERT')

    await request(api.app)
      .post(`/api/preorders/${p.id}/cancel`)
      .set(tokens['verkauf'])
      .send({})
      .expect(200)
    const cancelled = pdfText(
      (await pdfOf(p.id).expect(200)).body as Buffer
    ).text
    expect(cancelled).toContain('STORNIERT')
    expect(cancelled).toContain(`zu erstatten: ${euro(p.total)}`)
  })

  it('verrät nach der Anonymisierung weder Name noch Telefon noch Bemerkung', async () => {
    const p = await create({ customerName: 'Gundula Geheim' })
    // Abholtag weit zurücklegen, dann der 90-Tage-Lauf wie auf der Box.
    await Preorder.update(
      { pickupDate: '2026-05-05' },
      { where: { id: p.id }, silent: true }
    )
    const report = await anonymizePreorders({ today: '2026-11-12' })
    expect(report.anonymized.map((a) => a.code)).toContain(p.code)

    const { text } = pdfText((await pdfOf(p.id).expect(200)).body as Buffer)
    expect(text).toContain('anonymisiert')
    expect(text).not.toContain('Gundula')
    expect(text).not.toContain('Geheim')
    expect(text).not.toContain(p.customerPhone)
    expect(text).not.toContain('geschnitten')
    expect(text).not.toContain('Bemerkung')
  })

  it('antwortet 503 mit deutscher Meldung, wenn die Schriften fehlen', async () => {
    const p = await create()
    const errors = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const spy = jest
      .spyOn(preorderPdf, 'renderPreorderPdf')
      .mockRejectedValue(new pdfKit.PdfFontsError(['/nirgendwo']))
    try {
      const res = await request(api.app)
        .get(`/api/preorders/${p.id}/pdf`)
        .set(tokens['verkauf'])
        .expect(503)
      expect(res.body.error).toBe('pdf_fonts_missing')
      expect(res.body.message).toContain('Schriftdateien')
    } finally {
      spy.mockRestore()
      errors.mockRestore()
    }
  })
})
