/**
 * Härtung des Mock-Servers (`simple-server.js`):
 *
 *   - Fehlerantworten sind JSON mit `{ error, message }` - kein Express-HTML,
 *     kein Stacktrace, keine absoluten Pfade, kein `X-Powered-By`.
 *   - Die mutierenden Mock-Routen übernehmen nur ihre bekannten Felder und
 *     prüfen Status-Werte gegen eine Whitelist.
 *
 * Die App wird in-process geladen (`module.exports = app`, kein `listen`);
 * supertest öffnet je Request einen eigenen Port. Partner- und Liefer-Routen
 * werden hier bewusst nicht berührt - sie lesen ihren JSON-Store erst beim
 * ersten Aufruf.
 *
 * Testdaten sind synthetisch (example.org, erfundene Namen).
 */

const path = require('path')
const request = require('supertest')

const {
  describeError,
  notFound,
  validateCashEntry,
  validateInventoryAdjustment,
  validateNotification,
  validateOrderUpdate,
  validateProductionCreate,
  validateStaffCreate,
} = require('../../src/services/mock-input.core')

// Ohne hq-Verzeichnis loggt loadHQProducts() nur eine Warnung - die Routen
// unter Test brauchen keine Produkte.
process.env.HQ_PRODUCTS_DIR = path.join(__dirname, 'gibt-es-nicht')

const app = require('../../simple-server')

const REPO_PATH_PATTERN = /\/Users\/|\/home\/|node_modules|\.js:\d+/

async function firstOrderId() {
  const res = await request(app).get('/api/orders')
  return res.body.data[0].id
}

describe('Mock-Server: Fehlerantworten', () => {
  it('verrät keine Software-Version über X-Powered-By', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('beantwortet kaputtes JSON mit 400 als JSON ohne Stacktrace', async () => {
    const res = await request(app)
      .post('/api/cash')
      .set('Content-Type', 'application/json')
      .send('{"amount": 1,')
    expect(res.status).toBe(400)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body).toMatchObject({
      success: false,
      error: 'invalid_json',
      message: expect.stringMatching(/JSON/),
    })
    expect(res.text).not.toMatch(REPO_PATH_PATTERN)
    expect(res.text).not.toMatch(/<html|SyntaxError/i)
  })

  it('beantwortet einen zu großen Body mit 413 als JSON', async () => {
    const big = { text: 'a'.repeat(300 * 1024) }
    const res = await request(app).post('/api/cash').send(big)
    expect(res.status).toBe(413)
    expect(res.body).toMatchObject({
      success: false,
      error: 'payload_too_large',
      message: expect.stringMatching(/zu groß/),
    })
    expect(res.text).not.toMatch(REPO_PATH_PATTERN)
  })

  it('beantwortet eine unbekannte Route mit 404 als JSON', async () => {
    const res = await request(app).get('/api/gibtsnicht')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      success: false,
      error: 'not_found',
      message: 'Unbekannte Route: GET /api/gibtsnicht',
    })
  })

  it('gilt für alle Methoden, nicht nur GET', async () => {
    const res = await request(app).post('/api/gibtsnicht').send({})
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('not_found')
    expect(res.body.message).toMatch(/^Unbekannte Route: POST/)
  })

  it('kürzt einen überlangen Pfad in der 404-Meldung', () => {
    const body = notFound('GET', '/' + 'x'.repeat(5000))
    expect(body.message.length).toBeLessThan(200)
  })

  it('übersetzt fremde Fehler ohne Typ zu 500 ohne Details', () => {
    const err = new Error('ENOENT: /Users/jemand/geheim/datei.json')
    expect(describeError(err)).toEqual({
      status: 500,
      error: 'internal_error',
      message: 'Interner Serverfehler.',
    })
  })

  it('übernimmt einen gesetzten 4xx-Status, aber nicht die Meldung', () => {
    const err = Object.assign(new Error('/abs/path'), { status: 415 })
    const body = describeError(err)
    expect(body.status).toBe(415)
    expect(body.message).not.toMatch(/abs\/path/)
  })
})

describe('PUT /api/orders/:id', () => {
  it('übernimmt den Status, den der Admin schickt', async () => {
    const id = await firstOrderId()
    const res = await request(app)
      .put(`/api/orders/${id}`)
      .send({ status: 'ready' })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('ready')
  })

  it('lehnt einen unbekannten Status ab', async () => {
    const id = await firstOrderId()
    const res = await request(app)
      .put(`/api/orders/${id}`)
      .send({ status: 'foo' })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({
      success: false,
      error: 'invalid_status',
      field: 'status',
      message: expect.stringMatching(/Status/),
    })
  })

  it('ignoriert createdAt, total und id aus dem Body', async () => {
    const id = await firstOrderId()
    const before = (await request(app).get(`/api/orders/${id}`)).body.data
    const res = await request(app)
      .put(`/api/orders/${id}`)
      .send({ status: 'completed', createdAt: 1999, total: 0, id: 'HACK' })
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(id)
    expect(res.body.data.createdAt).toBe(before.createdAt)
    expect(res.body.data.total).toBe(before.total)
    expect(res.body.data.items).toEqual(before.items)
  })

  it('lehnt einen Body ohne änderbares Feld ab', async () => {
    const id = await firstOrderId()
    const res = await request(app)
      .put(`/api/orders/${id}`)
      .send({ createdAt: 1999 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('no_fields')
  })

  it('lehnt einen Body ab, der kein Objekt ist', async () => {
    const id = await firstOrderId()
    const res = await request(app).put(`/api/orders/${id}`).send([1, 2])
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_body')
  })

  it('meldet eine unbekannte Bestellung weiter als 404', async () => {
    const res = await request(app)
      .put('/api/orders/XXXX-XXXX-XXXX')
      .send({ status: 'ready' })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/staff und PUT /api/staff/:id', () => {
  it('legt ein Mitglied mit genau den bekannten Feldern an', async () => {
    const res = await request(app).post('/api/staff').send({
      username: 'Test.Person',
      email: 'Test@example.org',
      firstName: 'Test',
      lastName: 'Person',
      role: 'staff',
      isActive: false,
      id: 999,
      createdAt: '1999-01-01',
    })
    expect(res.status).toBe(201)
    expect(res.body.username).toBe('test.person')
    expect(res.body.email).toBe('test@example.org')
    expect(res.body.isActive).toBe(true)
    expect(res.body.id).not.toBe(999)
    expect(res.body.createdAt).not.toBe('1999-01-01')
  })

  it('braucht Benutzername, E-Mail, Vor- und Nachname', async () => {
    const res = await request(app)
      .post('/api/staff')
      .send({ username: 'ohne', email: 'ohne@example.org' })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({
      error: 'invalid_input',
      field: 'firstName',
      message: 'Der Vorname fehlt.',
    })
  })

  it('lehnt eine unbekannte Rolle ab', async () => {
    const res = await request(app).post('/api/staff').send({
      username: 'rolle',
      email: 'rolle@example.org',
      firstName: 'R',
      lastName: 'Olle',
      role: 'root',
    })
    expect(res.status).toBe(400)
    expect(res.body.field).toBe('role')
  })

  it('lehnt einen vergebenen Benutzernamen mit 409 ab', async () => {
    const member = {
      username: 'doppelt',
      email: 'doppelt@example.org',
      firstName: 'D',
      lastName: 'Oppelt',
    }
    expect((await request(app).post('/api/staff').send(member)).status).toBe(
      201
    )
    const res = await request(app).post('/api/staff').send(member)
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({
      error: 'username_taken',
      message: expect.stringMatching(/bereits vergeben/),
    })
  })

  it('ändert beim Update nur bekannte Felder und lässt id/createdAt in Ruhe', async () => {
    const before = (await request(app).get('/api/staff/1')).body
    const res = await request(app)
      .put('/api/staff/1')
      .send({ firstName: 'Neu', id: 999, createdAt: '1999-01-01', foo: 'bar' })
    expect(res.status).toBe(200)
    expect(res.body.firstName).toBe('Neu')
    expect(res.body.id).toBe(1)
    expect(res.body.createdAt).toBe(before.createdAt)
    expect(res.body.foo).toBeUndefined()
  })

  it('verlangt beim Update einen echten Boolean für isActive', async () => {
    const res = await request(app).put('/api/staff/1').send({ isActive: 'no' })
    expect(res.status).toBe(400)
    expect(res.body.field).toBe('isActive')
  })
})

describe('POST /api/cash', () => {
  it('bucht Einnahme mit Betrag, Beschreibung und Kategorie', async () => {
    const res = await request(app).post('/api/cash').send({
      type: 'income',
      amount: 12.345,
      description: 'Testbuchung',
      category: 'sales',
      date: '2026-09-07',
      createdAt: 'gestern',
      id: 'x',
    })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      type: 'income',
      amount: 12.35,
      description: 'Testbuchung',
      category: 'sales',
      date: '2026-09-07',
    })
    expect(res.body.data.id).not.toBe('x')
    expect(res.body.data.createdAt).not.toBe('gestern')
  })

  it('lehnt eine unbekannte Buchungsart ab', async () => {
    const res = await request(app)
      .post('/api/cash')
      .send({ type: 'donation', amount: 5 })
    expect(res.status).toBe(400)
    expect(res.body.field).toBe('type')
  })

  it('lehnt einen negativen oder fehlenden Betrag ab', async () => {
    const negative = await request(app)
      .post('/api/cash')
      .send({ type: 'expense', amount: -5 })
    expect(negative.status).toBe(400)
    expect(negative.body.field).toBe('amount')

    const missing = await request(app)
      .post('/api/cash')
      .send({ type: 'income' })
    expect(missing.status).toBe(400)
    expect(missing.body.message).toBe('Der Betrag fehlt.')
  })

  it('setzt das Datum auf heute, wenn keines mitkommt', () => {
    const result = validateCashEntry(
      { type: 'expense', amount: 3 },
      { now: new Date('2026-09-07T12:00:00Z') }
    )
    expect(result.ok).toBe(true)
    expect(result.value.date).toBe('2026-09-07')
  })

  it('lehnt ein kalendarisch ungültiges Datum ab', async () => {
    const res = await request(app)
      .post('/api/cash')
      .send({ type: 'income', amount: 1, date: '2026-02-31' })
    expect(res.status).toBe(400)
    expect(res.body.field).toBe('date')
  })
})

describe('POST /api/inventory/:id/adjust', () => {
  it('nimmt die Buchung des Admin-Dialogs an, auch mit leerem Grund', async () => {
    const before = (await request(app).get('/api/inventory/1')).body.data
    const res = await request(app)
      .post('/api/inventory/1/adjust')
      .send({ adjustment: -2, reason: '' })
    expect(res.status).toBe(200)
    expect(res.body.data.stock).toBe(before.stock - 2)
  })

  it('lehnt eine Änderung ab, die den Bestand negativ machen würde', async () => {
    const before = (await request(app).get('/api/inventory/1')).body.data
    const res = await request(app)
      .post('/api/inventory/1/adjust')
      .send({ adjustment: -(before.stock + 1), reason: 'Schwund' })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({
      field: 'adjustment',
      message: expect.stringMatching(/nicht negativ/),
    })
    const after = (await request(app).get('/api/inventory/1')).body.data
    expect(after.stock).toBe(before.stock)
  })

  it('lehnt String-Zahlen, 0 und fehlende Änderung ab', async () => {
    for (const body of [{ adjustment: '5' }, { adjustment: 0 }, {}]) {
      const res = await request(app).post('/api/inventory/1/adjust').send(body)
      expect(res.status).toBe(400)
      expect(res.body.field).toBe('adjustment')
    }
  })

  it('übernimmt keine fremden Felder in den Artikel', async () => {
    const res = await request(app)
      .post('/api/inventory/1/adjust')
      .send({ adjustment: 1, name: 'Gold', stock: 9999 })
    expect(res.status).toBe(200)
    expect(res.body.data.name).not.toBe('Gold')
    expect(res.body.data.stock).not.toBe(9999)
  })

  it('rechnet mit `Number(null) === 0` nicht als Bestand', () => {
    const result = validateInventoryAdjustment(
      { adjustment: null },
      { stock: 5 }
    )
    expect(result.ok).toBe(false)
    expect(result.field).toBe('adjustment')
  })
})

describe('POST /api/production und PUT /api/production/:id', () => {
  it('legt den Auftrag an, den der Admin schickt', async () => {
    const res = await request(app).post('/api/production').send({
      product: 'Testbrot',
      quantity: 40,
      date: '2026-09-12',
      status: 'planned',
    })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      product: 'Testbrot',
      quantity: 40,
      date: '2026-09-12',
      status: 'planned',
    })
    expect(typeof res.body.data.id).toBe('string')
  })

  it('setzt status auf planned, wenn keiner mitkommt', () => {
    const result = validateProductionCreate({
      product: 'X',
      quantity: 1,
      date: '2026-09-12',
    })
    expect(result.ok).toBe(true)
    expect(result.value.status).toBe('planned')
  })

  it('lehnt String-Mengen und ungültige Daten ab', async () => {
    const qty = await request(app)
      .post('/api/production')
      .send({ product: 'X', quantity: '40', date: '2026-09-12' })
    expect(qty.status).toBe(400)
    expect(qty.body.field).toBe('quantity')

    const date = await request(app)
      .post('/api/production')
      .send({ product: 'X', quantity: 40, date: '2026-02-31' })
    expect(date.status).toBe(400)
    expect(date.body.field).toBe('date')
  })

  it('übernimmt den Status-Wechsel des Admins und lehnt fremde Status ab', async () => {
    const ok = await request(app)
      .put('/api/production/1')
      .send({ status: 'in-progress' })
    expect(ok.status).toBe(200)
    expect(ok.body.data.status).toBe('in-progress')

    const bad = await request(app)
      .put('/api/production/1')
      .send({ status: 'done', id: 'HACK' })
    expect(bad.status).toBe(400)
    expect(bad.body.error).toBe('invalid_status')
  })

  it('lässt die id beim Update nicht überschreiben', async () => {
    const res = await request(app)
      .put('/api/production/2')
      .send({ quantity: 5, id: 'HACK' })
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe('2')
    expect(res.body.data.quantity).toBe(5)
  })
})

describe('POST /api/notifications', () => {
  it('legt die Benachrichtigung von feature-notifications an', async () => {
    const res = await request(app).post('/api/notifications').send({
      type: 'warning',
      category: 'inventory',
      priority: 'high',
      title: 'Test',
      message: 'Testnachricht',
      relatedId: 'abc',
      relatedType: 'order',
      read: true,
      channel: 'sms',
      id: 'x',
    })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      type: 'warning',
      category: 'inventory',
      priority: 'high',
      title: 'Test',
      message: 'Testnachricht',
      relatedId: 'abc',
      relatedType: 'order',
      read: false,
      channel: 'inApp',
    })
    expect(res.body.data.id).not.toBe('x')
  })

  it('braucht Titel und Nachricht', async () => {
    const res = await request(app)
      .post('/api/notifications')
      .send({ title: 'Nur Titel' })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({
      field: 'message',
      message: 'Die Nachricht fehlt.',
    })
  })

  it('lehnt unbekannte Typen, Kategorien und Prioritäten ab', async () => {
    for (const [field, value] of [
      ['type', 'fatal'],
      ['category', 'weather'],
      ['priority', 'now'],
    ]) {
      const res = await request(app)
        .post('/api/notifications')
        .send({ title: 'T', message: 'M', [field]: value })
      expect(res.status).toBe(400)
      expect(res.body.field).toBe(field)
    }
  })

  it('füllt Typ, Kategorie und Priorität mit Standardwerten', () => {
    const result = validateNotification({ title: 'T', message: 'M' })
    expect(result.ok).toBe(true)
    expect(result.value).toEqual({
      title: 'T',
      message: 'M',
      type: 'info',
      category: 'general',
      priority: 'medium',
    })
  })
})

describe('mock-input.core: Randfälle', () => {
  it('validateOrderUpdate: null, String und Array sind kein Body', () => {
    for (const body of [null, 'text', [1], 42]) {
      const result = validateOrderUpdate(body)
      expect(result.ok).toBe(false)
      expect(result.error).toBe('invalid_body')
    }
  })

  it('validateStaffCreate: E-Mail wird geprüft und kleingeschrieben', () => {
    const bad = validateStaffCreate({
      username: 'a.b',
      email: 'keine-adresse',
      firstName: 'A',
      lastName: 'B',
    })
    expect(bad.ok).toBe(false)
    expect(bad.field).toBe('email')

    const ok = validateStaffCreate({
      username: 'a.b',
      email: 'A.B@Example.org',
      firstName: 'A',
      lastName: 'B',
    })
    expect(ok.ok).toBe(true)
    expect(ok.value.email).toBe('a.b@example.org')
    expect(ok.value.role).toBe('staff')
  })

  it('validateCashEntry: Betrag wird auf Cent gerundet', () => {
    const result = validateCashEntry({ type: 'income', amount: 0.1 + 0.2 })
    expect(result.ok).toBe(true)
    expect(result.value.amount).toBe(0.3)
  })
})
