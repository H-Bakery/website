/**
 * TASK-042 Dienstplan on the real API: access (inhaber, personal session
 * only), employees (no delete, deactivate), entitlements per year, shift
 * templates, shifts (Verkauf only, same day, no overlap), absences (inside
 * the employment, warnings on shift overlap), the balance and the calendar
 * aggregate. Invented people only.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'

import { AuditLog } from '../../src/models'
import { bearer, createUser, login, sessionFor } from '../helpers/auth'
import { createTestApp, TestApp } from '../helpers/createTestApp'

jest.setTimeout(30000)

const TODAY = '2026-11-08' // a Sunday

let root: string
let api: TestApp
let owner: Record<string, string>
let ownerStation: Record<string, string>
const tokens: Record<string, Record<string, string>> = {}

function writeTargets(content: unknown): void {
  const dir = path.join(root, 'config')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'targets.json'),
    typeof content === 'string' ? content : JSON.stringify(content)
  )
}

const as = () => ({
  get: (url: string) => request(api.app).get(url).set(owner),
  post: (url: string, body: unknown) =>
    request(api.app)
      .post(url)
      .set(owner)
      .send(body as object),
  patch: (url: string, body: unknown) =>
    request(api.app)
      .patch(url)
      .set(owner)
      .send(body as object),
  put: (url: string, body: unknown) =>
    request(api.app)
      .put(url)
      .set(owner)
      .send(body as object),
  delete: (url: string) => request(api.app).delete(url).set(owner),
})

async function employee(body: Record<string, unknown>): Promise<number> {
  const res = await as().post('/api/dienstplan/employees', body)
  expect(res.status).toBe(201)
  return res.body.data.id
}

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-dienstplan-'))
  writeTargets({ closed_weekdays: [1] })
  api = await createTestApp({
    app: { dienstplan: { today: TODAY, financeDir: root } },
  })
  const ownerUser = await createUser({
    username: 'test.inhaber',
    role: 'inhaber',
    pin: '4242',
  })
  owner = bearer((await login(api.app, 'test.inhaber')).token)
  for (const role of ['verkauf', 'backstube', 'fahrer'] as const) {
    tokens[role] = bearer(await sessionFor(api.app, `test.${role}`, role))
  }
  const station = await request(api.app)
    .post('/api/auth/stations')
    .set(owner)
    .send({ name: 'Laden-Tablet' })
  expect(station.status).toBe(201)
  const pin = await request(api.app)
    .post('/api/auth/pin')
    .set('X-Station-Token', station.body.data.token)
    .send({ userId: ownerUser.id, pin: '4242' })
  expect(pin.status).toBe(200)
  ownerStation = bearer(pin.body.data.token)
})

afterAll(async () => {
  await api.close()
  fs.rmSync(root, { recursive: true, force: true })
})

const PATHS = [
  '/api/dienstplan?from=2026-11-09&to=2026-11-15',
  '/api/dienstplan/employees',
  '/api/dienstplan/shift-templates',
  '/api/dienstplan/shifts?from=2026-11-09&to=2026-11-15',
  '/api/dienstplan/absences?from=2026-11-09&to=2026-11-15',
  '/api/dienstplan/balance?year=2026',
]

describe('access: inhaber with a personal session only', () => {
  it.each(PATHS)('%s without a session: 401', async (p) => {
    const res = await request(api.app).get(p)
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'unauthorized' })
  })

  it.each(
    PATHS.flatMap((p) =>
      ['verkauf', 'backstube', 'fahrer'].map((role) => [p, role])
    )
  )('%s as %s: 403', async (p, role) => {
    const res = await request(api.app).get(p).set(tokens[role])
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({
      success: false,
      error: 'forbidden',
      message: expect.any(String),
    })
  })

  it('writes as verkauf: 403', async () => {
    const res = await request(api.app)
      .post('/api/dienstplan/employees')
      .set(tokens['verkauf'])
      .send({ displayName: 'Max Muster', area: 'verkauf' })
    expect(res.status).toBe(403)
  })

  it.each(PATHS)(
    '%s as inhaber at a PIN station: 403 personal_session_required',
    async (p) => {
      const res = await request(api.app).get(p).set(ownerStation)
      expect(res.status).toBe(403)
      expect(res.body).toMatchObject({
        error: 'personal_session_required',
        message: expect.any(String),
      })
    }
  )

  it.each(PATHS)('%s as inhaber: 200', async (p) => {
    const res = await request(api.app).get(p).set(owner)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

describe('employees', () => {
  it('creates, validates and lists Verkauf first', async () => {
    const backstube = await employee({
      displayName: 'Bruno Beispiel',
      area: 'backstube',
      employmentType: 'vollzeit',
      weeklyHours: 40,
    })
    const verkauf = await employee({
      displayName: 'Anna Probe',
      area: 'verkauf',
      color: '#aa5500',
      note: 'nur vormittags',
    })
    const list = await as().get('/api/dienstplan/employees')
    const ids = list.body.data.map((e: { id: number }) => e.id)
    expect(ids.indexOf(verkauf)).toBeLessThan(ids.indexOf(backstube))
    expect(
      list.body.data.find((e: { id: number }) => e.id === backstube)
    ).toMatchObject({
      weeklyHours: 40,
      employmentType: 'vollzeit',
      active: true,
    })

    for (const body of [
      {},
      { displayName: 'Ohne Bereich' },
      { displayName: 'X', area: 'kasse' },
      { displayName: 'X', area: 'verkauf', color: 'rot' },
      { displayName: 'X', area: 'verkauf', weeklyHours: 99 },
      { displayName: 'X', area: 'verkauf', employmentType: 'praktikum' },
      {
        displayName: 'X',
        area: 'verkauf',
        entryDate: '2026-05-01',
        exitDate: '2026-04-30',
      },
      { displayName: 'X\u0007', area: 'verkauf' },
    ]) {
      const res = await as().post('/api/dienstplan/employees', body)
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({
        success: false,
        error: expect.any(String),
        message: expect.any(String),
      })
    }
  })

  it('links a login once, deactivates instead of deleting, audits without notes', async () => {
    const user = await createUser({ username: 'test.link', role: 'verkauf' })
    const id = await employee({
      displayName: 'Lena Link',
      area: 'verkauf',
      userId: user.id,
      note: 'geheime Notiz',
    })
    const again = await as().post('/api/dienstplan/employees', {
      displayName: 'Lena Doppelt',
      area: 'verkauf',
      userId: user.id,
    })
    expect(again.status).toBe(409)
    expect(again.body.error).toBe('user_linked')
    const unknownUser = await as().post('/api/dienstplan/employees', {
      displayName: 'Lena Fremd',
      area: 'verkauf',
      userId: 99999,
    })
    expect(unknownUser.status).toBe(400)

    const del = await as().delete(`/api/dienstplan/employees/${id}`)
    expect(del.status).toBe(404)

    const off = await as().patch(`/api/dienstplan/employees/${id}`, {
      active: false,
      note: 'andere Notiz',
    })
    expect(off.status).toBe(200)
    expect(off.body.data).toMatchObject({ active: false, note: 'andere Notiz' })

    const rows = await AuditLog.findAll({
      where: { entity: 'employee', entityId: String(id) },
      order: [['id', 'ASC']],
    })
    expect(rows.map((r) => r.action)).toEqual(['create', 'deactivate'])
    const dump = JSON.stringify(rows.map((r) => r.data))
    expect(dump).not.toContain('Notiz')
    expect(dump).not.toContain('Lena')
    expect(rows[1].data).toMatchObject({
      active: { from: true, to: false },
      noteChanged: true,
    })
  })

  it('404 for an unknown employee', async () => {
    expect((await as().get('/api/dienstplan/employees/99999')).status).toBe(404)
    expect((await as().get('/api/dienstplan/employees/abc')).status).toBe(404)
    const res = await as().patch('/api/dienstplan/employees/99999', {
      active: false,
    })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('employee_not_found')
  })
})

describe('entitlements and balance', () => {
  it('no entitlement: no-config with remaining null; then pro-rata on entry', async () => {
    const id = await employee({
      displayName: 'Erika Beispiel',
      area: 'verkauf',
      entryDate: '2026-07-01',
    })
    const none = await as().get(
      `/api/dienstplan/balance?year=2026&employeeId=${id}`
    )
    expect(none.status).toBe(200)
    expect(none.body.data).toMatchObject({
      employeeId: id,
      status: 'no-config',
      remainingDays: null,
      entitlementDays: null,
    })

    const put = await as().put(
      `/api/dienstplan/employees/${id}/entitlements/2026`,
      { entitlementDays: 24, carryoverDays: null }
    )
    expect(put.status).toBe(200)
    expect(put.body.data).toEqual({
      employeeId: id,
      year: 2026,
      entitlementDays: 24,
      carryoverDays: null,
    })
    const samePut = await as().put(
      `/api/dienstplan/employees/${id}/entitlements/2026`,
      { entitlementDays: 24 }
    )
    expect(samePut.status).toBe(200)
    expect(samePut.body.data.entitlementDays).toBe(24)
    const entitlementAudit = await AuditLog.findAll({
      where: { entity: 'vacation_entitlement', entityId: `${id}/2026` },
    })
    expect(entitlementAudit.map((a) => a.action)).toEqual(['create'])
    const bad = await as().put(
      `/api/dienstplan/employees/${id}/entitlements/2026`,
      { entitlementDays: -1 }
    )
    expect(bad.status).toBe(400)
    const badYear = await as().put(
      `/api/dienstplan/employees/${id}/entitlements/26`,
      { entitlementDays: 20 }
    )
    expect(badYear.status).toBe(400)

    // Di 2026-07-07 … So 2026-07-12 = 6 days, approved
    const absence = await as().post('/api/dienstplan/absences', {
      employeeId: id,
      type: 'urlaub',
      status: 'genehmigt',
      startDate: '2026-07-07',
      endDate: '2026-07-12',
    })
    expect(absence.status).toBe(201)
    expect(absence.body.data.days).toBe(6)

    const profile = await as().get(`/api/dienstplan/employees/${id}?year=2026`)
    expect(profile.status).toBe(200)
    expect(profile.body.data.balance).toMatchObject({
      status: 'ok',
      entitlementDays: 24,
      entitlement: 12,
      months: 6,
      approvedDays: 6,
      remainingDays: 6,
    })
    expect(profile.body.data.entitlements).toHaveLength(1)
    expect(profile.body.data.absences).toHaveLength(1)
    expect(profile.body.data.closedWeekdays).toEqual({
      weekdays: [1],
      source: 'config',
    })

    const all = await as().get('/api/dienstplan/balance?year=2026')
    expect(
      all.body.data.find((b: { employeeId: number }) => b.employeeId === id)
    ).toMatchObject({ displayName: 'Erika Beispiel', status: 'ok' })
    // not employed in 2025: left out of the list
    const y2025 = await as().get('/api/dienstplan/balance?year=2025')
    expect(
      y2025.body.data.some((b: { employeeId: number }) => b.employeeId === id)
    ).toBe(false)
  })
})

describe('shift templates', () => {
  it('CRUD with time checks', async () => {
    const created = await as().post('/api/dienstplan/shift-templates', {
      name: 'Früh',
      startTime: '06:00',
      endTime: '12:00',
      breakMinutes: 15,
    })
    expect(created.status).toBe(201)
    const id = created.body.data.id
    const bad = await as().post('/api/dienstplan/shift-templates', {
      name: 'Nacht',
      startTime: '22:00',
      endTime: '02:00',
    })
    expect(bad.status).toBe(400)
    expect(bad.body.error).toBe('end_before_start')
    const changed = await as().patch(`/api/dienstplan/shift-templates/${id}`, {
      endTime: '12:30',
    })
    expect(changed.body.data).toMatchObject({
      name: 'Früh',
      startTime: '06:00',
      endTime: '12:30',
      breakMinutes: 15,
    })
    const same = await as().patch(`/api/dienstplan/shift-templates/${id}`, {
      name: 'Früh',
      endTime: '12:30',
    })
    expect(same.status).toBe(200)
    const templateAudit = await AuditLog.findAll({
      where: { entity: 'shift_template', entityId: String(id) },
    })
    expect(templateAudit.map((a) => a.action)).toEqual(['create', 'update'])
    expect(
      (await as().delete(`/api/dienstplan/shift-templates/${id}`)).status
    ).toBe(200)
    expect(
      (await as().delete(`/api/dienstplan/shift-templates/${id}`)).status
    ).toBe(404)
  })
})

describe('shifts', () => {
  let verkauf: number
  let backstube: number
  let templateId: number

  beforeAll(async () => {
    verkauf = await employee({
      displayName: 'Max Muster',
      area: 'verkauf',
      exitDate: '2026-12-31',
    })
    backstube = await employee({
      displayName: 'Paula Probe',
      area: 'backstube',
    })
    templateId = (
      await as().post('/api/dienstplan/shift-templates', {
        name: 'Spät',
        startTime: '12:00',
        endTime: '18:00',
        breakMinutes: 30,
      })
    ).body.data.id
  })

  it('creates a shift from a template, only for Verkauf', async () => {
    const res = await as().post('/api/dienstplan/shifts', {
      employeeId: verkauf,
      date: '2026-11-10',
      templateId,
    })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      employeeId: verkauf,
      date: '2026-11-10',
      startTime: '12:00',
      endTime: '18:00',
      breakMinutes: 30,
      minutes: 330,
    })
    expect(res.body.warnings).toEqual([])

    const other = await as().post('/api/dienstplan/shifts', {
      employeeId: backstube,
      date: '2026-11-10',
      startTime: '04:00',
      endTime: '10:00',
    })
    expect(other.status).toBe(400)
    expect(other.body).toMatchObject({
      error: 'not_verkauf',
      message: 'Schichten gibt es nur für den Verkauf.',
    })
  })

  it('rejects end before start, overlaps and days outside the employment', async () => {
    const midnight = await as().post('/api/dienstplan/shifts', {
      employeeId: verkauf,
      date: '2026-11-11',
      startTime: '20:00',
      endTime: '01:00',
    })
    expect(midnight.status).toBe(400)
    expect(midnight.body.error).toBe('end_before_start')

    const overlap = await as().post('/api/dienstplan/shifts', {
      employeeId: verkauf,
      date: '2026-11-10',
      startTime: '06:00',
      endTime: '12:30',
    })
    expect(overlap.status).toBe(409)
    expect(overlap.body.error).toBe('shift_overlap')

    const adjacent = await as().post('/api/dienstplan/shifts', {
      employeeId: verkauf,
      date: '2026-11-10',
      startTime: '06:00',
      endTime: '12:00',
    })
    expect(adjacent.status).toBe(201)

    const after = await as().post('/api/dienstplan/shifts', {
      employeeId: verkauf,
      date: '2027-01-05',
      startTime: '06:00',
      endTime: '12:00',
    })
    expect(after.status).toBe(400)
    expect(after.body.error).toBe('outside_employment')
  })

  it('warns on a closed day and on an absence, edits and deletes', async () => {
    const monday = await as().post('/api/dienstplan/shifts', {
      employeeId: verkauf,
      date: '2026-11-16',
      startTime: '06:00',
      endTime: '12:00',
    })
    expect(monday.status).toBe(201)
    expect(monday.body.warnings).toEqual([
      expect.objectContaining({ code: 'closed_day' }),
    ])

    const absence = await as().post('/api/dienstplan/absences', {
      employeeId: verkauf,
      type: 'frei',
      startDate: '2026-11-17',
    })
    expect(absence.status).toBe(201)
    const shift = await as().post('/api/dienstplan/shifts', {
      employeeId: verkauf,
      date: '2026-11-17',
      startTime: '06:00',
      endTime: '12:00',
      note: 'Vertretung',
    })
    expect(shift.status).toBe(201)
    expect(shift.body.warnings).toEqual([
      expect.objectContaining({ code: 'absence_overlap' }),
    ])

    const moved = await as().patch(
      `/api/dienstplan/shifts/${shift.body.data.id}`,
      { date: '2026-11-18' }
    )
    expect(moved.status).toBe(200)
    expect(moved.body.data).toMatchObject({
      date: '2026-11-18',
      startTime: '06:00',
      note: 'Vertretung',
    })
    expect(moved.body.warnings).toEqual([])

    const shiftAudits = async () =>
      AuditLog.count({
        where: { entity: 'shift', entityId: String(shift.body.data.id) },
      })
    const auditsBefore = await shiftAudits()
    const same = await as().patch(
      `/api/dienstplan/shifts/${shift.body.data.id}`,
      { date: '2026-11-18', startTime: '06:00', note: 'Vertretung' }
    )
    expect(same.status).toBe(200)
    expect(same.body.data).toMatchObject({ date: '2026-11-18' })
    expect(await shiftAudits()).toBe(auditsBefore)

    expect(
      (await as().delete(`/api/dienstplan/shifts/${shift.body.data.id}`)).status
    ).toBe(200)
    expect(
      (await as().delete(`/api/dienstplan/shifts/${shift.body.data.id}`)).status
    ).toBe(404)

    const list = await as().get(
      `/api/dienstplan/shifts?from=2026-11-09&to=2026-11-22&employeeId=${verkauf}`
    )
    expect(list.body.data.map((s: { date: string }) => s.date)).toEqual([
      '2026-11-10',
      '2026-11-10',
      '2026-11-16',
    ])
    const audit = await AuditLog.findAll({ where: { entity: 'shift' } })
    expect(JSON.stringify(audit.map((a) => a.data))).not.toContain('Vertretung')
  })

  it('a deactivated person cannot be planned; area change blocked by upcoming shifts', async () => {
    const change = await as().patch(`/api/dienstplan/employees/${verkauf}`, {
      area: 'buero',
    })
    expect(change.status).toBe(409)
    expect(change.body.error).toBe('has_shifts')

    const exitEarly = await as().patch(`/api/dienstplan/employees/${verkauf}`, {
      exitDate: '2026-11-12',
    })
    expect(exitEarly.status).toBe(409)
    expect(exitEarly.body.error).toBe('entries_outside_employment')

    const off = await as().patch(`/api/dienstplan/employees/${verkauf}`, {
      active: false,
    })
    expect(off.status).toBe(409)
    expect(off.body).toMatchObject({
      error: 'has_shifts',
      message: expect.stringContaining('deaktivieren'),
    })
    const still = await as().get(`/api/dienstplan/employees/${verkauf}`)
    expect(still.body.data.employee.active).toBe(true)

    const temp = await employee({ displayName: 'Tim Test', area: 'verkauf' })
    await as().patch(`/api/dienstplan/employees/${temp}`, { active: false })
    const res = await as().post('/api/dienstplan/shifts', {
      employeeId: temp,
      date: '2026-11-12',
      startTime: '06:00',
      endTime: '12:00',
    })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('employee_inactive')
  })

  it('validates the range of list queries', async () => {
    for (const q of [
      '',
      '?from=2026-11-10',
      '?from=2026-11-10&to=2026-11-01',
      '?from=2026-01-01&to=2027-06-01',
      '?from=2026-02-30&to=2026-03-01',
    ]) {
      const res = await as().get(`/api/dienstplan/shifts${q}`)
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_range')
    }
  })
})

describe('absences', () => {
  let id: number

  beforeAll(async () => {
    id = await employee({
      displayName: 'Frida Fahrer',
      area: 'fahrer',
      entryDate: '2026-01-01',
    })
  })

  it('validates type, half day and employment period', async () => {
    const base = { employeeId: id, startDate: '2026-11-11' }
    for (const [body, code] of [
      [{ ...base, type: 'krank' }, 'validation_failed'],
      [{ ...base, type: 'urlaub', status: 'beantragt' }, 'validation_failed'],
      [
        { ...base, type: 'urlaub', endDate: '2026-11-12', halfDay: true },
        'half_day_range',
      ],
      [{ ...base, type: 'urlaub', endDate: '2026-11-10' }, 'invalid_range'],
      [
        { employeeId: id, type: 'urlaub', startDate: '2025-12-30' },
        'outside_employment',
      ],
    ] as const) {
      const res = await as().post('/api/dienstplan/absences', body)
      expect(res.status).toBe(400)
      expect(res.body.error).toBe(code)
    }
    const unknown = await as().post('/api/dienstplan/absences', {
      ...base,
      employeeId: 99999,
      type: 'urlaub',
    })
    expect(unknown.status).toBe(404)
  })

  it('half day on 24.12. counts 0.5; overlapping absences are refused', async () => {
    const half = await as().post('/api/dienstplan/absences', {
      employeeId: id,
      type: 'urlaub',
      status: 'genehmigt',
      startDate: '2026-12-24',
      halfDay: true,
    })
    expect(half.status).toBe(201)
    expect(half.body.data).toMatchObject({
      startDate: '2026-12-24',
      endDate: '2026-12-24',
      halfDay: true,
      days: 0.5,
      status: 'genehmigt',
    })
    const clash = await as().post('/api/dienstplan/absences', {
      employeeId: id,
      type: 'frei',
      startDate: '2026-12-22',
      endDate: '2026-12-27',
    })
    expect(clash.status).toBe(409)
    expect(clash.body.error).toBe('absence_overlap')

    const planned = await as().post('/api/dienstplan/absences', {
      employeeId: id,
      type: 'urlaub',
      startDate: '2026-12-29',
      endDate: '2027-01-02',
    })
    expect(planned.status).toBe(201)
    expect(planned.body.data.status).toBe('geplant')
    // 29, 30 = 2; 31 = 0.5; 01.01. = 0; 02.01. = 1
    expect(planned.body.data.days).toBe(3.5)

    const approved = await as().patch(
      `/api/dienstplan/absences/${planned.body.data.id}`,
      { status: 'genehmigt' }
    )
    expect(approved.status).toBe(200)
    expect(approved.body.data.status).toBe('genehmigt')
    const again = await as().patch(
      `/api/dienstplan/absences/${planned.body.data.id}`,
      { status: 'genehmigt', endDate: '2027-01-02' }
    )
    expect(again.status).toBe(200)
    expect(again.body.data.days).toBe(3.5)
    const plannedAudit = await AuditLog.findAll({
      where: { entity: 'absence', entityId: String(planned.body.data.id) },
    })
    expect(plannedAudit.map((a) => a.action)).toEqual(['create', 'update'])

    const list = await as().get(
      `/api/dienstplan/absences?from=2027-01-01&to=2027-01-31&employeeId=${id}`
    )
    expect(list.body.data).toHaveLength(1)

    const del = await as().delete(
      `/api/dienstplan/absences/${half.body.data.id}`
    )
    expect(del.status).toBe(200)
    const audit = await AuditLog.findAll({
      where: { entity: 'absence', entityId: String(half.body.data.id) },
      order: [['id', 'ASC']],
    })
    expect(audit.map((a) => a.action)).toEqual(['create', 'delete'])
  })

  it('warns when the absence covers shifts', async () => {
    const seller = await employee({
      displayName: 'Sina Schicht',
      area: 'verkauf',
    })
    await as().post('/api/dienstplan/shifts', {
      employeeId: seller,
      date: '2026-11-19',
      startTime: '06:00',
      endTime: '12:00',
    })
    const res = await as().post('/api/dienstplan/absences', {
      employeeId: seller,
      type: 'urlaub',
      startDate: '2026-11-18',
      endDate: '2026-11-20',
    })
    expect(res.status).toBe(201)
    expect(res.body.warnings).toEqual([
      expect.objectContaining({
        code: 'shift_overlap',
        message: expect.stringContaining('19.11.2026'),
      }),
    ])
  })
})

describe('calendar aggregate', () => {
  it('returns employees, shifts, absences and days with holidays, Ruhetag, weights and Verkauf besetzt', async () => {
    const res = await as().get('/api/dienstplan?from=2026-11-16&to=2026-11-22')
    expect(res.status).toBe(200)
    const data = res.body.data
    expect(data).toMatchObject({
      from: '2026-11-16',
      to: '2026-11-22',
      today: TODAY,
      closedWeekdays: { weekdays: [1], source: 'config' },
    })
    expect(data.days).toHaveLength(7)
    expect(data.days[0]).toMatchObject({
      date: '2026-11-16',
      weekday: 1,
      restDay: true,
      closed: true,
      weight: 0,
      holidayName: null,
    })
    // Max Muster has a shift on Monday the 16th (closed day, still counted)
    expect(data.days[0].verkaufBesetzt).toBe(1)
    // Sina Schicht's shift on the 19th is covered by her vacation
    const thu = data.days.find((d: { date: string }) => d.date === '2026-11-19')
    expect(thu.verkaufBesetzt).toBe(0)
    expect(data.shifts.length).toBeGreaterThan(0)
    expect(data.absences.length).toBeGreaterThan(0)
    expect(data.employees[0].area).toBe('verkauf')
    // inactive people without entries in the range are left out
    expect(
      data.employees.some(
        (e: { displayName: string }) => e.displayName === 'Tim Test'
      )
    ).toBe(false)
  })

  it('names holidays and halves 24.12.', async () => {
    const res = await as().get('/api/dienstplan?from=2026-12-24&to=2026-12-26')
    expect(
      res.body.data.days.map((d: Record<string, unknown>) => [
        d.date,
        d.holidayName,
        d.weight,
      ])
    ).toEqual([
      ['2026-12-24', null, 0.5],
      ['2026-12-25', '1. Weihnachtstag', 0],
      ['2026-12-26', '2. Weihnachtstag', 0],
    ])
  })

  it('falls back to Monday when the finance config has no Ruhetage', async () => {
    writeTargets('kein json')
    const broken = await as().get(
      '/api/dienstplan?from=2026-11-16&to=2026-11-17'
    )
    expect(broken.body.data.closedWeekdays).toEqual({
      weekdays: [1],
      source: 'default',
    })
    writeTargets({ closed_weekdays: [2] })
    const tuesday = await as().get(
      '/api/dienstplan?from=2026-11-16&to=2026-11-17'
    )
    expect(
      tuesday.body.data.days.map((d: { closed: boolean }) => d.closed)
    ).toEqual([false, true])
    writeTargets({ closed_weekdays: [1] })
  })
})
