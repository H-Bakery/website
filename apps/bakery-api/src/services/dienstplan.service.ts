/**
 * Dienstplan und Urlaubsplanung (TASK-042): employees, vacation entitlements
 * per year, shift templates, shifts (all areas since 2026-11-08), absences, the vacation
 * balance and the calendar aggregate. Owner only (router).
 *
 * Every rule and formula - holidays, opening days, day weights, vacation
 * days, pro-rata entitlement, carryover, shift times and overlaps - lives in
 * `vacation.core.js`; this file reads, validates input, writes and audits.
 *
 * Writes run in the managed transaction (BEGIN IMMEDIATE, FIFO) together with
 * their checks and their `audit_log` row. The audit `data` never carries
 * notes or display names - the entity id is enough.
 *
 * Opening days: `closed_weekdays` from `HQ_FINANCE_DIR/config/targets.json`
 * (same field and rule as the Tagesziel); without a valid list Monday.
 */
import * as fs from 'fs'
import * as path from 'path'
import type { Request } from 'express'
import { Op, Transaction, WhereOptions } from 'sequelize'

import { audit } from '../auth/audit'
import {
  Absence,
  Employee,
  getSequelize,
  Shift,
  ShiftTemplate,
  User,
  VacationEntitlement,
} from '../models'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('./vacation.core')
const { berlinToday } = require('./backzettel-reference.core')
const controlChars = require('./control-chars.core')
const finance = require('../routes/finance.routes')
/* eslint-enable @typescript-eslint/no-var-requires */

/** Longest range of the calendar and of list queries (a leap year). */
export const MAX_RANGE_DAYS = 366
const MAX_NOTE = 500
const MAX_NAME = 80
const MAX_TEMPLATE_NAME = 40
const COLOR_RE = /^#[0-9a-fA-F]{6}$/

export interface DienstplanOptions {
  /** `hq/data/finance` (for `config/targets.json`). Default `HQ_FINANCE_DIR`. */
  financeDir?: string
  /** Today as `YYYY-MM-DD` (Berlin). Default: the wall clock. */
  today?: string | (() => string)
  log?: (message: string) => void
}

export interface Warning {
  code: string
  message: string
}

export interface ServiceResult {
  status?: number
  data: unknown
  warnings?: Warning[]
}

/** Expected failure: answered with `status`, `code` and German `message`. */
export class DienstplanError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
    this.name = 'DienstplanError'
  }
}

function invalid(message: string, code = 'validation_failed'): never {
  throw new DienstplanError(400, code, message)
}

/** `2026-12-24` → `24.12.2026` for messages. */
function de(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}.${m}.${y}`
}

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key)
}

// ------------------------------------------------------------- serialising

type Plain = Record<string, unknown>

export function plainEmployee(e: Employee): Plain {
  return {
    id: e.id,
    displayName: e.displayName,
    area: e.area,
    color: e.color ?? null,
    employmentType: e.employmentType ?? null,
    weeklyHours: num(e.weeklyHours),
    entryDate: e.entryDate ?? null,
    exitDate: e.exitDate ?? null,
    active: Boolean(e.active),
    userId: e.userId ?? null,
    note: e.note ?? null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }
}

function plainShift(s: Shift): Plain {
  return {
    id: s.id,
    employeeId: s.employeeId,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    breakMinutes: s.breakMinutes ?? 0,
    minutes: core.shiftMinutes(s),
    note: s.note ?? null,
  }
}

function plainTemplate(t: ShiftTemplate): Plain {
  return {
    id: t.id,
    name: t.name,
    startTime: t.startTime,
    endTime: t.endTime,
    breakMinutes: t.breakMinutes ?? 0,
  }
}

function plainEntitlement(v: VacationEntitlement): Plain {
  return {
    employeeId: v.employeeId,
    year: v.year,
    entitlementDays: num(v.entitlementDays),
    carryoverDays: num(v.carryoverDays),
  }
}

function absenceShape(a: Absence): Plain {
  return {
    id: a.id,
    employeeId: a.employeeId,
    type: a.type,
    status: a.status,
    startDate: a.startDate,
    endDate: a.endDate,
    halfDay: Boolean(a.halfDay),
  }
}

// ---------------------------------------------------------------- input

function text(
  body: Record<string, unknown>,
  key: string,
  label: string,
  max: number,
  options: { required?: boolean; multiline?: boolean } = {}
): string | null | undefined {
  if (!has(body, key)) {
    if (options.required) invalid(`${label} fehlt.`)
    return undefined
  }
  const raw = body[key]
  if (raw === null || raw === '') {
    if (options.required) invalid(`${label} fehlt.`)
    return null
  }
  if (typeof raw !== 'string') invalid(`${label} muss ein Text sein.`)
  const value = raw.trim()
  if (value === '') {
    if (options.required) invalid(`${label} fehlt.`)
    return null
  }
  if (value.length > max) invalid(`${label} ist zu lang (höchstens ${max}).`)
  const bad = options.multiline
    ? controlChars.hasTextControlChars(value)
    : controlChars.hasNameControlChars(value)
  if (bad) invalid(`${label} enthält unzulässige Steuerzeichen.`)
  return value
}

function oneOf(
  body: Record<string, unknown>,
  key: string,
  label: string,
  allowed: string[],
  options: { required?: boolean; nullable?: boolean } = {}
): string | null | undefined {
  if (!has(body, key) || body[key] === undefined) {
    if (options.required) invalid(`${label} fehlt.`)
    return undefined
  }
  const raw = body[key]
  if (raw === null && options.nullable) return null
  if (typeof raw !== 'string' || !allowed.includes(raw)) {
    invalid(`${label} muss eines von ${allowed.join(', ')} sein.`)
  }
  return raw as string
}

function dateField(
  body: Record<string, unknown>,
  key: string,
  label: string,
  options: { required?: boolean; nullable?: boolean } = {}
): string | null | undefined {
  if (!has(body, key) || body[key] === undefined) {
    if (options.required) invalid(`${label} fehlt.`)
    return undefined
  }
  const raw = body[key]
  if ((raw === null || raw === '') && options.nullable) return null
  if (!core.isValidDate(raw)) invalid(`${label} bitte als JJJJ-MM-TT angeben.`)
  return raw as string
}

function numberField(
  body: Record<string, unknown>,
  key: string,
  label: string,
  min: number,
  max: number
): number | null | undefined {
  if (!has(body, key) || body[key] === undefined) return undefined
  const raw = body[key]
  if (raw === null || raw === '') return null
  const n = typeof raw === 'number' ? raw : NaN
  if (!Number.isFinite(n) || n < min || n > max) {
    invalid(`${label} muss eine Zahl von ${min} bis ${max} sein.`)
  }
  return Math.round(n * 100) / 100
}

function idField(
  body: Record<string, unknown>,
  key: string,
  label: string,
  options: { required?: boolean; nullable?: boolean } = {}
): number | null | undefined {
  if (!has(body, key) || body[key] === undefined) {
    if (options.required) invalid(`${label} fehlt.`)
    return undefined
  }
  const raw = body[key]
  if (raw === null && options.nullable) return null
  const n = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw
  if (!Number.isInteger(n) || (n as number) <= 0) {
    invalid(`${label} ist ungültig.`)
  }
  return n as number
}

/** Path parameter `:id` → positive integer, else 404 with `notFound`. */
function pathId(raw: unknown, notFound: () => never): number {
  const s = String(raw ?? '')
  if (!/^\d+$/.test(s) || Number(s) <= 0) notFound()
  return Number(s)
}

function bodyOf(req: Request): Record<string, unknown> {
  const b = req.body
  if (!b || typeof b !== 'object' || Array.isArray(b)) {
    invalid('Die Anfrage braucht ein JSON-Objekt.')
  }
  return b as Record<string, unknown>
}

function employeeNotFound(): never {
  throw new DienstplanError(
    404,
    'employee_not_found',
    'Mitarbeiter nicht gefunden.'
  )
}

function shiftNotFound(): never {
  throw new DienstplanError(404, 'shift_not_found', 'Schicht nicht gefunden.')
}

function absenceNotFound(): never {
  throw new DienstplanError(
    404,
    'absence_not_found',
    'Abwesenheit nicht gefunden.'
  )
}

function templateNotFound(): never {
  throw new DienstplanError(
    404,
    'template_not_found',
    'Schichtvorlage nicht gefunden.'
  )
}

/** `?from=&to=` - both required, `from ≤ to`, at most `MAX_RANGE_DAYS`. */
export function parseRange(query: Record<string, unknown>): {
  from: string
  to: string
} {
  const from = query['from']
  const to = query['to']
  if (!core.isValidDate(from) || !core.isValidDate(to)) {
    invalid(
      'Zeitraum bitte als from und to (JJJJ-MM-TT) angeben.',
      'invalid_range'
    )
  }
  const days = core.daysInclusive(from, to)
  if (days < 1)
    invalid('„from“ muss vor oder gleich „to“ sein.', 'invalid_range')
  if (days > MAX_RANGE_DAYS) {
    invalid(
      `Der Zeitraum darf höchstens ${MAX_RANGE_DAYS} Tage lang sein.`,
      'invalid_range'
    )
  }
  return { from: from as string, to: to as string }
}

function parseYear(raw: unknown, fallback: number): number {
  if (raw === undefined || raw === '') return fallback
  const s = String(raw)
  if (!/^\d{4}$/.test(s) || Number(s) < 2000 || Number(s) > 2100) {
    invalid('Jahr bitte als JJJJ (2000-2100) angeben.', 'invalid_year')
  }
  return Number(s)
}

/** Sort: Verkauf first, then the other areas in `AREAS` order, then name. */
function byAreaAndName(a: Employee, b: Employee): number {
  const ai = core.AREAS.indexOf(a.area)
  const bi = core.AREAS.indexOf(b.area)
  if (ai !== bi) return ai - bi
  return a.displayName.localeCompare(b.displayName, 'de')
}

// ---------------------------------------------------------------- service

export class DienstplanService {
  private readonly financeDir: string
  private readonly log: (message: string) => void

  constructor(private readonly options: DienstplanOptions = {}) {
    this.financeDir =
      options.financeDir ||
      process.env['HQ_FINANCE_DIR'] ||
      finance.defaultFinanceDir()
    this.log = options.log ?? ((m) => console.warn(`[WARN] ${m}`))
  }

  today(): string {
    const t = this.options.today
    if (typeof t === 'function') return t()
    return t || berlinToday()
  }

  /**
   * Ruhetage: `closed_weekdays` aus `config/targets.json`, sonst Montag.
   * Read on each call - the file is small and may change with an hq sync.
   */
  closedWeekdays(): { weekdays: number[]; source: 'config' | 'default' } {
    const file = path.join(this.financeDir, 'config', 'targets.json')
    let raw: unknown = null
    try {
      if (fs.existsSync(file)) raw = JSON.parse(fs.readFileSync(file, 'utf-8'))
    } catch (error) {
      this.log(
        `Dienstplan: ${file} not readable (${
          (error as Error).message
        }) - Ruhetag Montag`
      )
    }
    return core.closedWeekdaysFrom(raw)
  }

  // ------------------------------------------------------------ employees

  async listEmployees(): Promise<ServiceResult> {
    const rows = await Employee.findAll()
    return { data: rows.sort(byAreaAndName).map(plainEmployee) }
  }

  private async loadEmployee(
    id: number,
    transaction?: Transaction
  ): Promise<Employee> {
    const row = await Employee.findByPk(id, { transaction })
    if (!row) employeeNotFound()
    return row
  }

  private async employeeInput(
    body: Record<string, unknown>,
    create: boolean,
    transaction: Transaction,
    selfId?: number
  ): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {}
    const displayName = text(body, 'displayName', 'Name', MAX_NAME, {
      required: create,
    })
    if (displayName === null) invalid('Name fehlt.')
    if (displayName !== undefined) out['displayName'] = displayName
    const area = oneOf(body, 'area', 'Bereich', core.AREAS, {
      required: create,
    })
    if (area !== undefined) out['area'] = area
    if (has(body, 'color') && body['color'] !== undefined) {
      const c = body['color']
      if (
        c !== null &&
        c !== '' &&
        (typeof c !== 'string' || !COLOR_RE.test(c))
      ) {
        invalid('Farbe bitte als #RRGGBB angeben.')
      }
      out['color'] = c === '' ? null : c
    }
    const type = oneOf(
      body,
      'employmentType',
      'Beschäftigungsart',
      core.EMPLOYMENT_TYPES,
      { nullable: true }
    )
    if (type !== undefined) out['employmentType'] = type
    const hours = numberField(body, 'weeklyHours', 'Wochenstunden', 0, 60)
    if (hours !== undefined) out['weeklyHours'] = hours
    const entry = dateField(body, 'entryDate', 'Eintrittsdatum', {
      nullable: true,
    })
    if (entry !== undefined) out['entryDate'] = entry
    const exit = dateField(body, 'exitDate', 'Austrittsdatum', {
      nullable: true,
    })
    if (exit !== undefined) out['exitDate'] = exit
    if (has(body, 'active') && body['active'] !== undefined) {
      if (typeof body['active'] !== 'boolean') {
        invalid('„active“ muss true oder false sein.')
      }
      out['active'] = body['active']
    }
    const note = text(body, 'note', 'Notiz', MAX_NOTE, { multiline: true })
    if (note !== undefined) out['note'] = note
    const userId = idField(body, 'userId', 'Benutzerkonto', { nullable: true })
    if (userId !== undefined) {
      if (userId !== null) {
        const user = await User.findByPk(userId, { transaction })
        if (!user) {
          throw new DienstplanError(
            400,
            'user_not_found',
            'Das Benutzerkonto gibt es nicht.'
          )
        }
        const other = await Employee.findOne({
          where: {
            userId,
            ...(selfId ? { id: { [Op.ne]: selfId } } : {}),
          },
          transaction,
        })
        if (other) {
          throw new DienstplanError(
            409,
            'user_linked',
            'Dieses Benutzerkonto ist schon mit einem anderen Mitarbeiter verknüpft.'
          )
        }
      }
      out['userId'] = userId
    }
    return out
  }

  /** Audit data of an employee change: no display name, no note. */
  private employeeAuditData(
    before: Plain | null,
    changes: Record<string, unknown>
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(changes)) {
      if (key === 'note') {
        data['noteChanged'] = true
        continue
      }
      if (key === 'displayName') {
        data['nameChanged'] = true
        continue
      }
      data[key] = before ? { from: before[key] ?? null, to: value } : value
    }
    return data
  }

  async createEmployee(req: Request): Promise<ServiceResult> {
    const body = bodyOf(req)
    const row = await getSequelize().transaction(async (transaction) => {
      const input = await this.employeeInput(body, true, transaction)
      const entry = (input['entryDate'] as string | null) ?? null
      const exit = (input['exitDate'] as string | null) ?? null
      if (entry && exit && exit < entry) {
        invalid('Das Austrittsdatum liegt vor dem Eintrittsdatum.')
      }
      const created = await Employee.create(
        input as unknown as Parameters<typeof Employee.create>[0],
        { transaction }
      )
      await audit(
        req,
        'create',
        'employee',
        created.id,
        this.employeeAuditData(null, input),
        { transaction }
      )
      return created
    })
    return { status: 201, data: plainEmployee(row) }
  }

  async updateEmployee(req: Request): Promise<ServiceResult> {
    const id = pathId(req.params['id'], employeeNotFound)
    const body = bodyOf(req)
    const row = await getSequelize().transaction(async (transaction) => {
      const current = await this.loadEmployee(id, transaction)
      const before = plainEmployee(current)
      const input = await this.employeeInput(body, false, transaction, id)
      const entry = has(input, 'entryDate')
        ? (input['entryDate'] as string | null)
        : current.entryDate ?? null
      const exit = has(input, 'exitDate')
        ? (input['exitDate'] as string | null)
        : current.exitDate ?? null
      if (entry && exit && exit < entry) {
        invalid('Das Austrittsdatum liegt vor dem Eintrittsdatum.')
      }
      if (has(input, 'entryDate') || has(input, 'exitDate')) {
        await this.assertEntriesInside(id, entry, exit, transaction)
      }
      // Ein Bereichswechsel lässt die Schichten stehen (Schichten gibt es in
      // allen Bereichen); sie zählen danach nur nicht mehr zum Verkauf.
      const deactivates = input['active'] === false && Boolean(current.active)
      if (deactivates) {
        const upcoming = await Shift.count({
          where: { employeeId: id, date: { [Op.gte]: this.today() } },
          transaction,
        })
        if (upcoming > 0) {
          throw new DienstplanError(
            409,
            'has_shifts',
            `Es gibt noch ${upcoming} kommende Schicht(en). Bitte erst löschen, dann deaktivieren.`
          )
        }
      }
      const changes: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(input)) {
        if (before[key] !== value) changes[key] = value
      }
      if (Object.keys(changes).length === 0) return current
      await current.update(changes, { transaction })
      const action =
        changes['active'] === false
          ? 'deactivate'
          : changes['active'] === true
          ? 'reactivate'
          : 'update'
      await audit(
        req,
        action,
        'employee',
        id,
        this.employeeAuditData(before, changes),
        { transaction }
      )
      return current
    })
    return { data: plainEmployee(row) }
  }

  /** 409 if a shift or absence would fall outside the new employment period. */
  private async assertEntriesInside(
    employeeId: number,
    entry: string | null,
    exit: string | null,
    transaction: Transaction
  ): Promise<void> {
    const outside: unknown[] = []
    if (entry) outside.push({ [Op.lt]: entry })
    if (exit) outside.push({ [Op.gt]: exit })
    if (outside.length === 0) return
    const shifts = await Shift.count({
      where: { employeeId, date: { [Op.or]: outside } },
      transaction,
    })
    const absenceWhere: WhereOptions<Absence>[] = []
    if (entry) absenceWhere.push({ startDate: { [Op.lt]: entry } })
    if (exit) absenceWhere.push({ endDate: { [Op.gt]: exit } })
    const absences = await Absence.count({
      where: { employeeId, [Op.or]: absenceWhere },
      transaction,
    })
    if (shifts + absences > 0) {
      throw new DienstplanError(
        409,
        'entries_outside_employment',
        `Außerhalb der neuen Beschäftigungszeit liegen noch ${shifts} Schicht(en) und ${absences} Abwesenheit(en). Bitte erst anpassen.`
      )
    }
  }

  async employeeProfile(req: Request): Promise<ServiceResult> {
    const id = pathId(req.params['id'], employeeNotFound)
    const employee = await this.loadEmployee(id)
    const today = this.today()
    const year = parseYear(req.query['year'], Number(today.slice(0, 4)))
    const entitlements = await VacationEntitlement.findAll({
      where: { employeeId: id },
      order: [['year', 'DESC']],
    })
    const absences = await Absence.findAll({
      where: {
        employeeId: id,
        startDate: { [Op.lte]: `${year}-12-31` },
        endDate: { [Op.gte]: `${year}-01-01` },
      },
      order: [['startDate', 'ASC']],
    })
    const upcomingShifts = await Shift.findAll({
      where: { employeeId: id, date: { [Op.gte]: today } },
      order: [
        ['date', 'ASC'],
        ['startTime', 'ASC'],
      ],
      limit: 20,
    })
    const closed = this.closedWeekdays()
    const balance = await this.balanceFor(employee, year, closed.weekdays)
    const hours = await this.currentHours(employee, today, closed.weekdays)
    return {
      data: {
        employee: plainEmployee(employee),
        year,
        entitlements: entitlements.map(plainEntitlement),
        balance,
        // `days` covers the whole absence; `daysInYear` is the share inside
        // the shown year - the part `vacationBalance` counts for it.
        absences: absences.map((a) => ({
          ...this.plainAbsence(a, closed.weekdays),
          daysInYear: core.absenceDays(absenceShape(a), closed.weekdays, {
            from: `${year}-01-01`,
            to: `${year}-12-31`,
          }),
        })),
        upcomingShifts: upcomingShifts.map(plainShift),
        hours,
        closedWeekdays: closed,
      },
    }
  }

  /**
   * Plan und Soll der Person in der laufenden Woche (Mo-So) und im laufenden
   * Monat (`plannedHours` in `vacation.core.js`) - für das Profil.
   */
  private async currentHours(
    employee: Employee,
    today: string,
    closedWeekdays: number[]
  ): Promise<{ week: Plain; month: Plain }> {
    const weekFrom = core.addDays(today, 1 - core.isoWeekday(today))
    const weekTo = core.addDays(weekFrom, 6)
    const monthFrom = `${today.slice(0, 7)}-01`
    const monthTo = core.addDays(core.addMonths(monthFrom, 1), -1)
    const from = weekFrom < monthFrom ? weekFrom : monthFrom
    const to = weekTo > monthTo ? weekTo : monthTo
    const [shifts, absences] = await Promise.all([
      Shift.findAll({
        where: { employeeId: employee.id, date: { [Op.between]: [from, to] } },
      }),
      Absence.findAll({
        where: {
          employeeId: employee.id,
          startDate: { [Op.lte]: to },
          endDate: { [Op.gte]: from },
        },
      }),
    ])
    const input = {
      employee: plainEmployee(employee),
      shifts: shifts.map(plainShift),
      absences: absences.map(absenceShape),
      closedWeekdays,
    }
    return {
      week: core.plannedHours({ ...input, from: weekFrom, to: weekTo }),
      month: core.plannedHours({ ...input, from: monthFrom, to: monthTo }),
    }
  }

  // ---------------------------------------------------------- entitlements

  async listEntitlements(req: Request): Promise<ServiceResult> {
    const id = pathId(req.params['id'], employeeNotFound)
    await this.loadEmployee(id)
    const rows = await VacationEntitlement.findAll({
      where: { employeeId: id },
      order: [['year', 'DESC']],
    })
    return { data: rows.map(plainEntitlement) }
  }

  async putEntitlement(req: Request): Promise<ServiceResult> {
    const id = pathId(req.params['id'], employeeNotFound)
    const year = parseYear(req.params['year'], NaN)
    const body = bodyOf(req)
    const entitlementDays = numberField(
      body,
      'entitlementDays',
      'Jahresanspruch',
      0,
      365
    )
    const carryoverDays = numberField(body, 'carryoverDays', 'Übertrag', 0, 365)
    const row = await getSequelize().transaction(async (transaction) => {
      await this.loadEmployee(id, transaction)
      const existing = await VacationEntitlement.findOne({
        where: { employeeId: id, year },
        transaction,
      })
      const before = existing ? plainEntitlement(existing) : null
      const next = {
        entitlementDays:
          entitlementDays !== undefined
            ? entitlementDays
            : (before?.['entitlementDays'] as number | null) ?? null,
        carryoverDays:
          carryoverDays !== undefined
            ? carryoverDays
            : (before?.['carryoverDays'] as number | null) ?? null,
      }
      if (
        existing &&
        before?.['entitlementDays'] === next.entitlementDays &&
        before?.['carryoverDays'] === next.carryoverDays
      ) {
        return existing
      }
      let saved: VacationEntitlement
      if (existing) {
        saved = await existing.update(next, { transaction })
      } else {
        saved = await VacationEntitlement.create(
          { employeeId: id, year, ...next },
          { transaction }
        )
      }
      await audit(
        req,
        existing ? 'update' : 'create',
        'vacation_entitlement',
        `${id}/${year}`,
        {
          from: before
            ? {
                entitlementDays: before['entitlementDays'],
                carryoverDays: before['carryoverDays'],
              }
            : null,
          to: next,
        },
        { transaction }
      )
      return saved
    })
    return { data: plainEntitlement(row) }
  }

  // ------------------------------------------------------- shift templates

  async listTemplates(): Promise<ServiceResult> {
    const rows = await ShiftTemplate.findAll({
      order: [
        ['startTime', 'ASC'],
        ['name', 'ASC'],
      ],
    })
    return { data: rows.map(plainTemplate) }
  }

  private templateInput(
    body: Record<string, unknown>,
    current: ShiftTemplate | null
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    const name = text(body, 'name', 'Name der Vorlage', MAX_TEMPLATE_NAME, {
      required: !current,
    })
    if (name === null) invalid('Name der Vorlage fehlt.')
    if (name !== undefined) out['name'] = name
    for (const key of ['startTime', 'endTime'] as const) {
      if (has(body, key) && body[key] !== undefined) out[key] = body[key]
    }
    if (has(body, 'breakMinutes') && body['breakMinutes'] !== undefined) {
      out['breakMinutes'] = body['breakMinutes'] ?? 0
    }
    const startTime = (out['startTime'] ?? current?.startTime) as string
    const endTime = (out['endTime'] ?? current?.endTime) as string
    const breakMinutes = (out['breakMinutes'] ??
      current?.breakMinutes ??
      0) as number
    const check = core.checkShiftTimes(startTime, endTime, breakMinutes)
    if (!check.ok) invalid(check.message, check.code)
    return out
  }

  async createTemplate(req: Request): Promise<ServiceResult> {
    const input = this.templateInput(bodyOf(req), null)
    const row = await getSequelize().transaction(async (transaction) => {
      const created = await ShiftTemplate.create(
        input as unknown as Parameters<typeof ShiftTemplate.create>[0],
        { transaction }
      )
      await audit(req, 'create', 'shift_template', created.id, input, {
        transaction,
      })
      return created
    })
    return { status: 201, data: plainTemplate(row) }
  }

  async updateTemplate(req: Request): Promise<ServiceResult> {
    const id = pathId(req.params['id'], templateNotFound)
    const body = bodyOf(req)
    const row = await getSequelize().transaction(async (transaction) => {
      const current = await ShiftTemplate.findByPk(id, { transaction })
      if (!current) templateNotFound()
      const before = plainTemplate(current)
      const input = this.templateInput(body, current)
      if (
        Object.entries(input).every(([key, value]) => before[key] === value)
      ) {
        return current
      }
      await current.update(input, { transaction })
      await audit(
        req,
        'update',
        'shift_template',
        id,
        { from: before, to: plainTemplate(current) },
        { transaction }
      )
      return current
    })
    return { data: plainTemplate(row) }
  }

  async deleteTemplate(req: Request): Promise<ServiceResult> {
    const id = pathId(req.params['id'], templateNotFound)
    await getSequelize().transaction(async (transaction) => {
      const current = await ShiftTemplate.findByPk(id, { transaction })
      if (!current) templateNotFound()
      const before = plainTemplate(current)
      await current.destroy({ transaction })
      await audit(req, 'delete', 'shift_template', id, before, { transaction })
    })
    return { data: { id, deleted: true } }
  }

  // ----------------------------------------------------------------- shifts

  async listShifts(req: Request): Promise<ServiceResult> {
    const { from, to } = parseRange(req.query as Record<string, unknown>)
    const employeeId = this.queryEmployeeId(req)
    const rows = await Shift.findAll({
      where: {
        date: { [Op.between]: [from, to] },
        ...(employeeId ? { employeeId } : {}),
      },
      order: [
        ['date', 'ASC'],
        ['startTime', 'ASC'],
      ],
    })
    return { data: rows.map(plainShift) }
  }

  private queryEmployeeId(req: Request): number | null {
    const raw = req.query['employeeId']
    if (raw === undefined || raw === '') return null
    const s = String(raw)
    if (!/^\d+$/.test(s) || Number(s) <= 0) {
      invalid('employeeId ist ungültig.')
    }
    return Number(s)
  }

  /**
   * Validates a shift (new or changed) against the rules of TASK-042 and
   * returns the warnings: active, inside the employment period,
   * times (`checkShiftTimes`), no overlap with another shift of the person
   * (409). An absence on that day or a closed day is a warning, not an error.
   */
  private async checkShift(
    shift: {
      employeeId: number
      date: string
      startTime: string
      endTime: string
      breakMinutes: number
    },
    selfId: number | null,
    transaction: Transaction
  ): Promise<Warning[]> {
    const employee = await Employee.findByPk(shift.employeeId, { transaction })
    if (!employee) employeeNotFound()
    // Schichten in allen Bereichen (Entscheidung des Inhabers 2026-11-08);
    // die Besetzung zählt trotzdem nur den Verkauf (vacation.core.js).
    if (!employee.active) {
      throw new DienstplanError(
        409,
        'employee_inactive',
        'Deaktivierte Mitarbeiter können nicht eingeplant werden.'
      )
    }
    if (
      !core.withinEmployment(shift.date, employee.entryDate, employee.exitDate)
    ) {
      invalid(
        `Am ${de(shift.date)} ist ${employee.displayName} nicht beschäftigt.`,
        'outside_employment'
      )
    }
    const check = core.checkShiftTimes(
      shift.startTime,
      shift.endTime,
      shift.breakMinutes
    )
    if (!check.ok) invalid(check.message, check.code)

    const sameDay = await Shift.findAll({
      where: {
        employeeId: shift.employeeId,
        date: shift.date,
        ...(selfId ? { id: { [Op.ne]: selfId } } : {}),
      },
      transaction,
    })
    const clash = sameDay.find((s) => core.shiftsOverlap(s, shift))
    if (clash) {
      throw new DienstplanError(
        409,
        'shift_overlap',
        `${employee.displayName} hat am ${de(shift.date)} schon eine Schicht ${
          clash.startTime
        }-${clash.endTime}.`
      )
    }

    const warnings: Warning[] = []
    const absences = await Absence.findAll({
      where: {
        employeeId: shift.employeeId,
        startDate: { [Op.lte]: shift.date },
        endDate: { [Op.gte]: shift.date },
      },
      transaction,
    })
    for (const a of absences) {
      warnings.push({
        code: 'absence_overlap',
        message: `${employee.displayName} ist am ${de(shift.date)} als „${
          core.ABSENCE_TYPE_LABELS[a.type] ?? a.type
        }“ (${a.status}${a.halfDay ? ', halber Tag' : ''}) eingetragen.`,
      })
    }
    const day = core.dayInfo(shift.date, this.closedWeekdays().weekdays)
    if (day.closed) {
      warnings.push({
        code: 'closed_day',
        message: day.holidayName
          ? `Der ${de(shift.date)} ist ein Feiertag (${day.holidayName}).`
          : `Der ${de(shift.date)} ist Ruhetag.`,
      })
    }
    return warnings
  }

  private async shiftFromBody(
    body: Record<string, unknown>,
    current: Shift | null,
    transaction: Transaction
  ): Promise<{
    employeeId: number
    date: string
    startTime: string
    endTime: string
    breakMinutes: number
    note: string | null
  }> {
    const employeeId = idField(body, 'employeeId', 'Mitarbeiter', {
      required: !current,
    })
    const date = dateField(body, 'date', 'Datum', { required: !current })
    const templateId = idField(body, 'templateId', 'Schichtvorlage', {
      nullable: true,
    })
    let template: ShiftTemplate | null = null
    if (templateId) {
      template = await ShiftTemplate.findByPk(templateId, { transaction })
      if (!template) templateNotFound()
    }
    const pick = (key: 'startTime' | 'endTime' | 'breakMinutes'): unknown => {
      if (has(body, key) && body[key] !== undefined) return body[key]
      if (template) return template[key]
      return current ? current[key] : undefined
    }
    const startTime = pick('startTime')
    const endTime = pick('endTime')
    if (startTime === undefined || endTime === undefined) {
      invalid('Beginn und Ende fehlen (oder eine Schichtvorlage).')
    }
    const breakRaw = pick('breakMinutes')
    const note = text(body, 'note', 'Notiz', MAX_NOTE, { multiline: true })
    return {
      employeeId: (employeeId ?? current?.employeeId) as number,
      date: (date ?? current?.date) as string,
      startTime: startTime as string,
      endTime: endTime as string,
      breakMinutes: (breakRaw ?? 0) as number,
      note: note !== undefined ? note : current?.note ?? null,
    }
  }

  private shiftAudit(s: {
    employeeId: number
    date: string
    startTime: string
    endTime: string
    breakMinutes: number
  }): Record<string, unknown> {
    return {
      employeeId: s.employeeId,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      breakMinutes: s.breakMinutes,
    }
  }

  async createShift(req: Request): Promise<ServiceResult> {
    const body = bodyOf(req)
    const { row, warnings } = await getSequelize().transaction(
      async (transaction) => {
        const input = await this.shiftFromBody(body, null, transaction)
        const warnings = await this.checkShift(input, null, transaction)
        const row = await Shift.create(input, { transaction })
        await audit(req, 'create', 'shift', row.id, this.shiftAudit(input), {
          transaction,
        })
        return { row, warnings }
      }
    )
    return { status: 201, data: plainShift(row), warnings }
  }

  async updateShift(req: Request): Promise<ServiceResult> {
    const id = pathId(req.params['id'], shiftNotFound)
    const body = bodyOf(req)
    const { row, warnings } = await getSequelize().transaction(
      async (transaction) => {
        const current = await Shift.findByPk(id, { transaction })
        if (!current) shiftNotFound()
        const before = this.shiftAudit(current)
        const input = await this.shiftFromBody(body, current, transaction)
        const after = this.shiftAudit(input)
        const timesSame = Object.entries(after).every(
          ([key, value]) => before[key] === value
        )
        const noteSame = input.note === (current.note ?? null)
        if (timesSame && noteSame) return { row: current, warnings: [] }
        // A note-only change re-checks nothing: the plan stays as it was.
        const warnings = timesSame
          ? []
          : await this.checkShift(input, id, transaction)
        await current.update(input, { transaction })
        await audit(
          req,
          'update',
          'shift',
          id,
          { from: before, to: after },
          { transaction }
        )
        return { row: current, warnings }
      }
    )
    return { data: plainShift(row), warnings }
  }

  async deleteShift(req: Request): Promise<ServiceResult> {
    const id = pathId(req.params['id'], shiftNotFound)
    await getSequelize().transaction(async (transaction) => {
      const current = await Shift.findByPk(id, { transaction })
      if (!current) shiftNotFound()
      const before = this.shiftAudit(current)
      await current.destroy({ transaction })
      await audit(req, 'delete', 'shift', id, before, { transaction })
    })
    return { data: { id, deleted: true } }
  }

  // --------------------------------------------------------------- absences

  private plainAbsence(a: Absence, closedWeekdays: number[]): Plain {
    return {
      ...absenceShape(a),
      days: core.absenceDays(absenceShape(a), closedWeekdays),
      note: a.note ?? null,
    }
  }

  async listAbsences(req: Request): Promise<ServiceResult> {
    const { from, to } = parseRange(req.query as Record<string, unknown>)
    const employeeId = this.queryEmployeeId(req)
    const rows = await Absence.findAll({
      where: {
        startDate: { [Op.lte]: to },
        endDate: { [Op.gte]: from },
        ...(employeeId ? { employeeId } : {}),
      },
      order: [
        ['startDate', 'ASC'],
        ['id', 'ASC'],
      ],
    })
    const closed = this.closedWeekdays().weekdays
    return { data: rows.map((a) => this.plainAbsence(a, closed)) }
  }

  private absenceFromBody(
    body: Record<string, unknown>,
    current: Absence | null
  ): {
    employeeId: number
    type: string
    status: string
    startDate: string
    endDate: string
    halfDay: boolean
    note: string | null
  } {
    const employeeId = idField(body, 'employeeId', 'Mitarbeiter', {
      required: !current,
    })
    const type = oneOf(body, 'type', 'Art', core.ABSENCE_TYPES, {
      required: !current,
    })
    const status = oneOf(body, 'status', 'Status', core.ABSENCE_STATUSES)
    const startDate = dateField(body, 'startDate', 'Beginn', {
      required: !current,
    })
    const endDate = dateField(body, 'endDate', 'Ende')
    if (has(body, 'halfDay') && body['halfDay'] !== undefined) {
      if (typeof body['halfDay'] !== 'boolean') {
        invalid('„halfDay“ muss true oder false sein.')
      }
    }
    const note = text(body, 'note', 'Notiz', MAX_NOTE, { multiline: true })
    const start = (startDate ?? current?.startDate) as string
    // A new absence without end is one day; a changed start without end
    // keeps the old end only if it still fits.
    const end = (endDate ??
      (current && current.endDate >= start ? current.endDate : start)) as string
    const out = {
      employeeId: (employeeId ?? current?.employeeId) as number,
      type: (type ?? current?.type) as string,
      status: (status ?? current?.status ?? 'geplant') as string,
      startDate: start,
      endDate: end,
      halfDay: (has(body, 'halfDay') && body['halfDay'] !== undefined
        ? body['halfDay']
        : Boolean(current?.halfDay)) as boolean,
      note: note !== undefined ? note : current?.note ?? null,
    }
    if (out.endDate < out.startDate) {
      invalid('Das Ende liegt vor dem Beginn.', 'invalid_range')
    }
    if (core.daysInclusive(out.startDate, out.endDate) > MAX_RANGE_DAYS) {
      invalid(
        `Eine Abwesenheit darf höchstens ${MAX_RANGE_DAYS} Tage lang sein.`,
        'invalid_range'
      )
    }
    if (out.halfDay && out.startDate !== out.endDate) {
      invalid(
        'Ein halber Tag geht nur für einen einzelnen Tag.',
        'half_day_range'
      )
    }
    return out
  }

  /**
   * Inside the employment period, no overlap with another absence of the
   * person (409, it would count twice). Shifts in the period: warning.
   */
  private async checkAbsence(
    a: { employeeId: number; startDate: string; endDate: string },
    selfId: number | null,
    transaction: Transaction
  ): Promise<Warning[]> {
    const employee = await Employee.findByPk(a.employeeId, { transaction })
    if (!employee) employeeNotFound()
    if (
      !core.withinEmployment(
        a.startDate,
        employee.entryDate,
        employee.exitDate
      ) ||
      !core.withinEmployment(a.endDate, employee.entryDate, employee.exitDate)
    ) {
      invalid(
        `Die Abwesenheit liegt nicht ganz in der Beschäftigungszeit von ${employee.displayName}.`,
        'outside_employment'
      )
    }
    const other = await Absence.findOne({
      where: {
        employeeId: a.employeeId,
        startDate: { [Op.lte]: a.endDate },
        endDate: { [Op.gte]: a.startDate },
        ...(selfId ? { id: { [Op.ne]: selfId } } : {}),
      },
      transaction,
    })
    if (other) {
      throw new DienstplanError(
        409,
        'absence_overlap',
        `${employee.displayName} hat vom ${de(other.startDate)} bis ${de(
          other.endDate
        )} schon eine Abwesenheit eingetragen.`
      )
    }
    const shifts = await Shift.findAll({
      where: {
        employeeId: a.employeeId,
        date: { [Op.between]: [a.startDate, a.endDate] },
      },
      order: [['date', 'ASC']],
      transaction,
    })
    if (shifts.length === 0) return []
    const dates = [...new Set(shifts.map((s) => de(s.date)))]
    return [
      {
        code: 'shift_overlap',
        message: `${
          employee.displayName
        } hat in diesem Zeitraum Schichten: ${dates.join(', ')}.`,
      },
    ]
  }

  async createAbsence(req: Request): Promise<ServiceResult> {
    const input = this.absenceFromBody(bodyOf(req), null)
    const { row, warnings } = await getSequelize().transaction(
      async (transaction) => {
        const warnings = await this.checkAbsence(input, null, transaction)
        const row = await Absence.create(input, { transaction })
        await audit(req, 'create', 'absence', row.id, absenceShape(row), {
          transaction,
        })
        return { row, warnings }
      }
    )
    return {
      status: 201,
      data: this.plainAbsence(row, this.closedWeekdays().weekdays),
      warnings,
    }
  }

  async updateAbsence(req: Request): Promise<ServiceResult> {
    const id = pathId(req.params['id'], absenceNotFound)
    const body = bodyOf(req)
    const { row, warnings } = await getSequelize().transaction(
      async (transaction) => {
        const current = await Absence.findByPk(id, { transaction })
        if (!current) absenceNotFound()
        const before = absenceShape(current)
        const input = this.absenceFromBody(body, current)
        const unchanged =
          input.note === (current.note ?? null) &&
          Object.keys(before).every(
            (key) =>
              key === 'id' ||
              before[key] === (input as Record<string, unknown>)[key]
          )
        if (unchanged) return { row: current, warnings: [] as Warning[] }
        const warnings = await this.checkAbsence(input, id, transaction)
        await current.update(input, { transaction })
        await audit(
          req,
          'update',
          'absence',
          id,
          { from: before, to: absenceShape(current) },
          { transaction }
        )
        return { row: current, warnings }
      }
    )
    return {
      data: this.plainAbsence(row, this.closedWeekdays().weekdays),
      warnings,
    }
  }

  async deleteAbsence(req: Request): Promise<ServiceResult> {
    const id = pathId(req.params['id'], absenceNotFound)
    await getSequelize().transaction(async (transaction) => {
      const current = await Absence.findByPk(id, { transaction })
      if (!current) absenceNotFound()
      const before = absenceShape(current)
      await current.destroy({ transaction })
      await audit(req, 'delete', 'absence', id, before, { transaction })
    })
    return { data: { id, deleted: true } }
  }

  // ---------------------------------------------------------------- balance

  private async balanceFor(
    employee: Employee,
    year: number,
    closedWeekdays: number[]
  ): Promise<Plain> {
    const entitlement = await VacationEntitlement.findOne({
      where: { employeeId: employee.id, year },
    })
    const absences = await Absence.findAll({
      where: {
        employeeId: employee.id,
        type: 'urlaub',
        startDate: { [Op.lte]: `${year}-12-31` },
        endDate: { [Op.gte]: `${year}-01-01` },
      },
    })
    return {
      employeeId: employee.id,
      ...core.vacationBalance({
        year,
        today: this.today(),
        entitlement: entitlement ? plainEntitlement(entitlement) : null,
        entryDate: employee.entryDate,
        exitDate: employee.exitDate,
        absences: absences.map(absenceShape),
        closedWeekdays,
      }),
    }
  }

  async balance(req: Request): Promise<ServiceResult> {
    const year = parseYear(req.query['year'], Number(this.today().slice(0, 4)))
    const employeeId = this.queryEmployeeId(req)
    const closed = this.closedWeekdays().weekdays
    if (employeeId) {
      const employee = await this.loadEmployee(employeeId)
      return { data: await this.balanceFor(employee, year, closed) }
    }
    const employees = (await Employee.findAll()).sort(byAreaAndName)
    const out: Plain[] = []
    for (const e of employees) {
      const b = await this.balanceFor(e, year, closed)
      if (b['status'] === 'not-employed') continue
      out.push({
        displayName: e.displayName,
        area: e.area,
        active: e.active,
        ...b,
      })
    }
    return { data: out }
  }

  // --------------------------------------------------------------- calendar

  /**
   * `GET /api/dienstplan?from&to`: everything the week/month/year views need
   * in one answer - employees (active ones plus inactive ones with entries
   * in the range), shifts, absences and `days[]` from `calendarDays`.
   */
  async calendar(req: Request): Promise<ServiceResult> {
    const { from, to } = parseRange(req.query as Record<string, unknown>)
    const closed = this.closedWeekdays()
    const [employees, shifts, absences] = await Promise.all([
      Employee.findAll(),
      Shift.findAll({
        where: { date: { [Op.between]: [from, to] } },
        order: [
          ['date', 'ASC'],
          ['startTime', 'ASC'],
        ],
      }),
      Absence.findAll({
        where: { startDate: { [Op.lte]: to }, endDate: { [Op.gte]: from } },
        order: [
          ['startDate', 'ASC'],
          ['id', 'ASC'],
        ],
      }),
    ])
    const withEntries = new Set<number>([
      ...shifts.map((s) => s.employeeId),
      ...absences.map((a) => a.employeeId),
    ])
    const shown = employees
      .filter((e) => e.active || withEntries.has(e.id))
      .sort(byAreaAndName)
    const plainShifts = shifts.map(plainShift)
    const plainAbsences = absences.map((a) =>
      this.plainAbsence(a, closed.weekdays)
    )
    const plainEmployees = shown.map(plainEmployee)
    return {
      data: {
        from,
        to,
        today: this.today(),
        closedWeekdays: closed,
        employees: plainEmployees,
        shifts: plainShifts,
        absences: plainAbsences,
        days: core.calendarDays(
          from,
          to,
          closed.weekdays,
          shown.map((e) => ({ id: e.id, area: e.area })),
          plainShifts,
          plainAbsences
        ),
        // Plan- und Soll-Stunden je gezeigter Person für from…to (Woche,
        // Monat oder Jahr - der Zeitraum der Ansicht).
        hours: core.hoursByEmployee(
          from,
          to,
          plainEmployees,
          plainShifts,
          plainAbsences,
          closed.weekdays
        ),
      },
    }
  }
}
