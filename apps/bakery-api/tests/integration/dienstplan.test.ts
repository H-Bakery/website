/**
 * TASK-042 Dienstplan on the real API: access (inhaber, personal session
 * only), employees (no delete, deactivate), entitlements per year, shift
 * templates, shifts (every area, same day, no overlap), absences (inside
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
/** Z14: the bakery calendar the app hands to the Dienstplan (`null` = none). */
let calendar: unknown = null
let calendarThrows = false

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
    app: {
      dienstplan: {
        today: TODAY,
        financeDir: root,
        log: () => undefined,
        calendar: () => {
          if (calendarThrows) throw new Error('Kalender kaputt')
          return calendar
        },
      },
    },
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
  '/api/dienstplan/hours?week=2026-11-09',
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

  it('creates a shift from a template, in every area (since 2026-11-08)', async () => {
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
    // Backstube gets shifts too (owner decision 2026-11-08)
    expect(other.status).toBe(201)
    expect(other.body.data).toMatchObject({
      employeeId: backstube,
      minutes: 360,
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

  it('a deactivated person cannot be planned; an area change keeps the shifts', async () => {
    const change = await as().patch(`/api/dienstplan/employees/${verkauf}`, {
      area: 'buero',
    })
    expect(change.status).toBe(200)
    expect(change.body.data.area).toBe('buero')
    const back = await as().patch(`/api/dienstplan/employees/${verkauf}`, {
      area: 'verkauf',
    })
    expect(back.status).toBe(200)

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

  it('profile shows the share of an absence inside the shown year', async () => {
    // left over from the test above: Urlaub 29.12.2026-02.01.2027, approved
    const y2026 = await as().get(`/api/dienstplan/employees/${id}?year=2026`)
    expect(y2026.status).toBe(200)
    const across = y2026.body.data.absences.find(
      (a: { endDate: string }) => a.endDate === '2027-01-02'
    )
    // whole range 3.5; in 2026: 29., 30. = 2 + 31.12. = 0.5
    expect(across).toMatchObject({ days: 3.5, daysInYear: 2.5 })
    expect(y2026.body.data.balance.approvedDays).toBe(2.5)

    const y2027 = await as().get(`/api/dienstplan/employees/${id}?year=2027`)
    expect(y2027.body.data.absences).toEqual([
      expect.objectContaining({ days: 3.5, daysInYear: 1 }),
    ])
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

  it('delivers opening hours, the Verkauf Besetzung and planned vs. target hours', async () => {
    const lena = await employee({
      displayName: 'Lena Laden',
      area: 'verkauf',
      weeklyHours: 30,
    })
    const kai = await employee({ displayName: 'Kai Kasse', area: 'verkauf' })
    const bruno = await employee({
      displayName: 'Bruno Brot',
      area: 'backstube',
    })
    for (const body of [
      // Tue 01.12.: Lena 05:30-10:00, Kai 10:00-13:00, Bruno (Backstube)
      {
        employeeId: lena,
        date: '2026-12-01',
        startTime: '05:30',
        endTime: '10:00',
        breakMinutes: 30,
      },
      {
        employeeId: kai,
        date: '2026-12-01',
        startTime: '10:00',
        endTime: '13:00',
      },
      {
        employeeId: bruno,
        date: '2026-12-01',
        startTime: '03:00',
        endTime: '09:00',
      },
      // in today's week (02.11.-08.11.)
      {
        employeeId: lena,
        date: '2026-11-07',
        startTime: '06:00',
        endTime: '12:00',
      },
    ]) {
      const res = await as().post('/api/dienstplan/shifts', body)
      expect(res.status).toBe(201)
    }
    const vacation = await as().post('/api/dienstplan/absences', {
      employeeId: lena,
      type: 'urlaub',
      startDate: '2026-12-03',
    })
    expect(vacation.status).toBe(201)

    const res = await as().get('/api/dienstplan?from=2026-11-30&to=2026-12-06')
    expect(res.status).toBe(200)
    const { days, hours } = res.body.data
    const day = (date: string) =>
      days.find((d: { date: string }) => d.date === date)
    expect(day('2026-11-30')).toMatchObject({
      closed: true,
      openingHours: null,
      besetzung: null,
    })
    expect(day('2026-12-01')).toMatchObject({
      openingHours: { opens: '05:30', closes: '13:30' },
      verkaufBesetzt: 2,
      besetzung: {
        opens: '05:30',
        closes: '13:30',
        segments: [
          { from: '05:30', to: '10:00', employeeIds: [lena] },
          { from: '10:00', to: '13:00', employeeIds: [kai] },
          { from: '13:00', to: '13:30', employeeIds: [] },
        ],
        gaps: [{ from: '13:00', to: '13:30' }],
        covered: false,
      },
    })
    expect(day('2026-12-05').openingHours).toEqual({
      opens: '05:30',
      closes: '12:30',
    })
    expect(day('2026-12-06')).toMatchObject({
      openingHours: { opens: '08:00', closes: '11:00' },
      besetzung: { gaps: [{ from: '08:00', to: '11:00' }], covered: false },
    })

    const of = (id: number) =>
      hours.find((h: { employeeId: number }) => h.employeeId === id)
    expect(hours).toHaveLength(res.body.data.employees.length)
    // 30 h / 6 open weekdays = 5 h a day; Thursday is vacation
    expect(of(lena)).toEqual({
      employeeId: lena,
      from: '2026-11-30',
      to: '2026-12-06',
      weeklyHours: 30,
      plannedMinutes: 240,
      shiftCount: 1,
      targetMinutes: 1500,
      diffMinutes: -1260,
      targetDays: 5,
      creditedDays: 1,
      status: 'ok',
    })
    expect(of(bruno)).toMatchObject({
      plannedMinutes: 360,
      targetMinutes: null,
      diffMinutes: null,
      status: 'no-target',
    })

    const profile = await as().get(`/api/dienstplan/employees/${lena}`)
    expect(profile.status).toBe(200)
    expect(profile.body.data.hours.week).toMatchObject({
      from: '2026-11-02',
      to: '2026-11-08',
      plannedMinutes: 360,
      targetMinutes: 1800,
      diffMinutes: -1440,
    })
    // the current month counts through today (Sun 08.11.: open days
    // 03.-08. = 6 × 300 min) ...
    expect(profile.body.data.hours.month).toMatchObject({
      phase: 'current',
      asOf: TODAY,
      from: '2026-11-01',
      to: TODAY,
      plannedMinutes: 360,
      targetMinutes: 1800,
    })
    // ... next to the whole November: 24 open days (5 Mondays, Allerheiligen
    // on a Sunday)
    expect(profile.body.data.hours.month.full).toMatchObject({
      from: '2026-11-01',
      to: '2026-11-30',
      plannedMinutes: 360,
      targetMinutes: 7200,
    })
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

describe('bakery calendar (Z14)', () => {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const kalender = require('../../src/services/kalender.core')
  /* eslint-enable @typescript-eslint/no-var-requires */
  const RANGE = '/api/dienstplan?from=2026-11-18&to=2026-11-23'

  const synthetic = () =>
    kalender.normalizeKalender({
      version: 1,
      bundesland: 'saarland',
      feiertage: {
        2026: kalender
          .holidaysSaarland(2026)
          .map((h: { date: string; name: string }) => ({
            datum: h.date,
            name: h.name,
          })),
      },
      tage: [
        { datum: '2026-11-18', typ: 'geschlossen', notiz: 'Inventur' },
        {
          datum: '2026-11-23',
          typ: 'sonderoeffnung',
          wie: 6,
          notiz: 'Testmarkt',
        },
      ],
    })

  afterEach(() => {
    calendar = null
    calendarThrows = false
  })

  it('no calendar: days as before (open day, Ruhetag)', async () => {
    const res = await as().get(RANGE)
    expect(res.status).toBe(200)
    expect(res.body.data.days[0]).toMatchObject({
      closed: false,
      kind: 'normal',
      kindLabel: null,
      calendar: 'missing',
    })
    expect(res.body.data.days[5]).toMatchObject({
      closed: true,
      restDay: true,
      kind: 'ruhetag',
    })
  })

  it('days[] carry the day kind of the calendar; a shift on a closing day warns with the reason', async () => {
    calendar = synthetic()
    const res = await as().get(RANGE)
    expect(res.status).toBe(200)
    expect(res.body.data.days[0]).toMatchObject({
      date: '2026-11-18',
      closed: true,
      restDay: false,
      kind: 'geschlossen',
      kindLabel: 'Geschlossen',
      kindDetail: 'Inventur',
      openingHours: null,
      weight: 1,
      calendar: 'ok',
    })
    expect(res.body.data.days[5]).toMatchObject({
      date: '2026-11-23',
      closed: false,
      restDay: true,
      kind: 'sonderoeffnung',
      openingHours: { opens: '05:30', closes: '12:30' },
      weight: 0,
    })

    const id = await employee({ displayName: 'Kira Kalender', area: 'buero' })
    const shift = (date: string) =>
      as().post('/api/dienstplan/shifts', {
        employeeId: id,
        date,
        startTime: '06:00',
        endTime: '12:00',
      })
    const closed = await shift('2026-11-18')
    expect(closed.status).toBe(201)
    expect(closed.body.warnings).toEqual([
      {
        code: 'closed_day',
        message: 'Am 18.11.2026 ist der Laden geschlossen (Inventur).',
      },
    ])
    // Sonderöffnung on the Ruhetag: open, no warning
    const open = await shift('2026-11-23')
    expect(open.status).toBe(201)
    expect(open.body.warnings).toEqual([])
  })

  it('a calendar source that throws never breaks the Dienstplan', async () => {
    calendarThrows = true
    const res = await as().get(RANGE)
    expect(res.status).toBe(200)
    expect(res.body.data.days[0]).toMatchObject({
      closed: false,
      calendar: 'missing',
    })
  })
})

describe('Stundenlohn und geschätzte Überstundenbezahlung', () => {
  it('stores the hourly wage in cents, validates it and audits without the amount', async () => {
    const id = await employee({ displayName: 'Paula Lohn', area: 'buero' })
    const created = await as().get(`/api/dienstplan/employees/${id}`)
    // new and old rows: not entered = null ("Stundenlohn offen"), never 0
    expect(created.body.data.employee.hourlyWageCents).toBeNull()
    for (const hourlyWageCents of [0, -1, 12.5, 100000, '13,90', true]) {
      const res = await as().patch(`/api/dienstplan/employees/${id}`, {
        hourlyWageCents,
      })
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({
        error: 'validation_failed',
        message: expect.stringContaining('Stundenlohn'),
      })
    }
    const set = await as().patch(`/api/dienstplan/employees/${id}`, {
      hourlyWageCents: 1390,
    })
    expect(set.status).toBe(200)
    expect(set.body.data.hourlyWageCents).toBe(1390)
    // the same value again changes nothing (no audit row)
    await as().patch(`/api/dienstplan/employees/${id}`, {
      hourlyWageCents: 1390,
    })
    const cleared = await as().patch(`/api/dienstplan/employees/${id}`, {
      hourlyWageCents: null,
    })
    expect(cleared.body.data.hourlyWageCents).toBeNull()

    const rows = await AuditLog.findAll({
      where: { entity: 'employee', entityId: String(id) },
      order: [['id', 'ASC']],
    })
    expect(rows.map((r) => r.action)).toEqual(['create', 'update', 'update'])
    expect(rows[1].data).toEqual({ hourlyWageChanged: true })
    expect(JSON.stringify(rows.map((r) => r.data))).not.toContain('1390')
  })

  it('GET /hours: week and the month of its Thursday, estimate and totals', async () => {
    const paid = await employee({
      displayName: 'Olga Ueber',
      area: 'buero',
      weeklyHours: 6,
      hourlyWageCents: 1500,
    })
    const unpaid = await employee({
      displayName: 'Otto Offen',
      area: 'buero',
      weeklyHours: 6,
    })
    // KW 13/2027: Mo 29.03. … So 04.04., Donnerstag 01.04. → April
    for (const body of [
      {
        employeeId: paid,
        date: '2027-03-30',
        startTime: '06:00',
        endTime: '14:00',
      },
      {
        employeeId: unpaid,
        date: '2027-03-31',
        startTime: '06:00',
        endTime: '13:00',
      },
    ]) {
      expect((await as().post('/api/dienstplan/shifts', body)).status).toBe(201)
    }
    const res = await as().get(
      '/api/dienstplan/hours?week=2027-04-01&area=buero'
    )
    expect(res.status).toBe(200)
    const data = res.body.data
    expect(data).toMatchObject({
      today: TODAY,
      area: 'buero',
      periods: {
        week: { from: '2027-03-29', to: '2027-04-04' },
        month: { from: '2027-04-01', to: '2027-04-30' },
      },
    })
    expect(
      data.employees.every((e: { area: string }) => e.area === 'buero')
    ).toBe(true)
    expect(data.rows).toHaveLength(data.employees.length)
    const row = (id: number) =>
      data.rows.find((r: { employeeId: number }) => r.employeeId === id)
    // 6 h/Woche, 6 Öffnungstage: Soll 6 h; Olga plant 8 h → +2 h × 15,00 €
    expect(row(paid)).toMatchObject({
      hourlyWageCents: 1500,
      week: {
        plannedMinutes: 480,
        targetMinutes: 360,
        diffMinutes: 120,
        pay: { status: 'ok', overtimeMinutes: 120, amountCents: 3000 },
      },
      // the March shift does not count for April; April is still ahead
      // (today 08.11.2026): planned vs. target only, no overtime yet
      month: { phase: 'future', plannedMinutes: 0, pay: { status: 'future' } },
    })
    expect(row(unpaid)).toMatchObject({
      hourlyWageCents: null,
      week: {
        diffMinutes: 60,
        pay: { status: 'no-wage', overtimeMinutes: 60, amountCents: null },
      },
    })
    expect(data.totals.week).toMatchObject({
      plannedMinutes: 900,
      amountCents: 3000,
      estimatedCount: 1,
      missingWageCount: 1,
    })
    expect(data.totals.month).toMatchObject({
      phase: 'future',
      plannedMinutes: 0,
      overtimeMinutes: null,
      amountCents: null,
      missingWageCount: 0,
      wageCost: { toDate: null, full: { amountCents: 0, missingWageCount: 0 } },
    })

    const march = await as().get(
      '/api/dienstplan/hours?month=2027-03&area=buero'
    )
    expect(march.status).toBe(200)
    expect(march.body.data.periods).toEqual({
      week: null,
      month: { from: '2027-03-01', to: '2027-03-31' },
    })
    const olga = march.body.data.rows.find(
      (r: { employeeId: number }) => r.employeeId === paid
    )
    expect(olga.month).toMatchObject({ plannedMinutes: 480 })
    expect(olga).not.toHaveProperty('week')

    // all areas by default
    const all = await as().get('/api/dienstplan/hours?week=2027-03-29')
    expect(all.body.data.area).toBe('alle')
    expect(
      all.body.data.employees.some((e: { area: string }) => e.area !== 'buero')
    ).toBe(true)
  })

  it('GET /hours validates the period and the area', async () => {
    for (const [query, code] of [
      ['', 'invalid_period'],
      ['?week=2026-13-01', 'invalid_period'],
      ['?week=1999-12-31', 'invalid_period'],
      ['?month=2026-1', 'invalid_period'],
      ['?month=2026-11-01', 'invalid_period'],
      ['?week=2026-11-09&month=2026-11', 'invalid_period'],
      ['?week=2026-11-09&area=kasse', 'invalid_area'],
    ]) {
      const res = await as().get(`/api/dienstplan/hours${query}`)
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({
        error: code,
        message: expect.any(String),
      })
    }
  })

  it('the profile carries the estimate for the current week and month', async () => {
    const id = await employee({
      displayName: 'Pia Profil',
      area: 'buero',
      weeklyHours: 6,
      hourlyWageCents: 2000,
    })
    // today's week 02.11.-08.11.2026: Soll 6 h, Plan 7 h
    expect(
      (
        await as().post('/api/dienstplan/shifts', {
          employeeId: id,
          date: '2026-11-03',
          startTime: '06:00',
          endTime: '13:00',
        })
      ).status
    ).toBe(201)
    const profile = await as().get(`/api/dienstplan/employees/${id}`)
    expect(profile.body.data.employee.hourlyWageCents).toBe(2000)
    expect(profile.body.data.hours.week).toMatchObject({
      diffMinutes: 60,
      pay: { status: 'ok', overtimeMinutes: 60, amountCents: 2000 },
    })
    // the month through today (03.-08.11.: Soll 6 h) has the same +1 h
    expect(profile.body.data.hours.month).toMatchObject({
      phase: 'current',
      diffMinutes: 60,
      pay: { status: 'ok', overtimeMinutes: 60, amountCents: 2000 },
      wageCost: {
        toDate: { status: 'ok', plannedMinutes: 420, amountCents: 14000 },
        full: { status: 'ok', plannedMinutes: 420, amountCents: 14000 },
      },
      minijob: null,
    })
  })

  it('GET /hours: current month through today, net overtime, wage costs and the Minijob limit', async () => {
    const mona = await employee({
      displayName: 'Mona Mini',
      area: 'fahrer',
      employmentType: 'minijob',
      weeklyHours: 6,
      hourlyWageCents: 1500,
    })
    const max = await employee({
      displayName: 'Max Minus',
      area: 'fahrer',
      employmentType: 'teilzeit',
      weeklyHours: 6,
    })
    const shift = (employeeId: number, date: string, endTime: string) =>
      as().post('/api/dienstplan/shifts', {
        employeeId,
        date,
        startTime: '06:00',
        endTime,
      })
    // Mona: 8 h before today, 41 h in November → 615 € > 603 €
    for (const [date, end] of [
      ['2026-11-03', '14:00'],
      ['2026-11-17', '14:00'],
      ['2026-11-18', '14:00'],
      ['2026-11-24', '14:00'],
      ['2026-11-25', '15:00'],
    ]) {
      expect((await shift(mona, date, end)).status).toBe(201)
    }
    // Max: 2 h before today, no wage
    expect((await shift(max, '2026-11-04', '08:00')).status).toBe(201)

    const res = await as().get(
      '/api/dienstplan/hours?month=2026-11&area=fahrer'
    )
    expect(res.status).toBe(200)
    const data = res.body.data
    const row = (id: number) =>
      data.rows.find((r: { employeeId: number }) => r.employeeId === id)
    // through Sun 08.11.: Soll 6 open days × 60 min = 6 h
    expect(row(mona).month).toMatchObject({
      phase: 'current',
      asOf: TODAY,
      to: TODAY,
      plannedMinutes: 480,
      targetMinutes: 360,
      diffMinutes: 120,
      pay: { status: 'ok', overtimeMinutes: 120, amountCents: 3000 },
      full: { to: '2026-11-30', plannedMinutes: 2460, targetMinutes: 1440 },
      wageCost: {
        toDate: { amountCents: 12000 },
        full: { amountCents: 61500 },
      },
      minijob: {
        status: 'over',
        limitCents: 60300,
        plannedCostCents: 61500,
        overCents: 1200,
      },
    })
    expect(row(max).month).toMatchObject({
      diffMinutes: 120 - 360,
      pay: { status: 'no-overtime', amountCents: 0 },
      wageCost: {
        toDate: { status: 'no-wage', amountCents: null },
        full: { status: 'no-wage', amountCents: null },
      },
      minijob: null,
    })
    expect(data.totals.month).toMatchObject({
      phase: 'current',
      asOf: TODAY,
      overtimeMinutes: 120,
      amountCents: 3000,
      wageCost: {
        toDate: { amountCents: 12000, missingWageCount: 1 },
        full: { amountCents: 61500, missingWageCount: 1 },
      },
      minijob: { count: 1, overCount: 1, openCount: 0, limitCents: 60300 },
    })

    // a past month counts whole: through today = the whole month
    const october = await as().get(
      '/api/dienstplan/hours?month=2026-10&area=fahrer'
    )
    expect(october.body.data.totals.month).toMatchObject({
      phase: 'past',
      asOf: null,
    })
    const monaOct = october.body.data.rows.find(
      (r: { employeeId: number }) => r.employeeId === mona
    )
    expect(monaOct.month).toMatchObject({
      phase: 'past',
      from: '2026-10-01',
      to: '2026-10-31',
    })
    expect(monaOct.month.full).toMatchObject({ to: '2026-10-31' })
  })
})
