/**
 * Client für Dienstplan und Urlaub (TASK-042, nach dem Pilot) - `/api/dienstplan`
 * der echten API, nur `inhaber` aus einer persönlichen Sitzung.
 *
 *   GET    /api/dienstplan?from&to                 Kalender (Mitarbeiter, Schichten, Abwesenheiten, days[])
 *   GET    /api/dienstplan/employees               alle Mitarbeiter (auch ausgeschiedene)
 *   POST   /api/dienstplan/employees               anlegen
 *   GET    /api/dienstplan/employees/:id?year      Profil mit Urlaubskonto
 *   PATCH  /api/dienstplan/employees/:id           ändern, `active: false` = ausscheiden
 *   GET    /api/dienstplan/employees/:id/entitlements
 *   PUT    /api/dienstplan/employees/:id/entitlements/:year
 *   GET/POST/PATCH/DELETE /api/dienstplan/shift-templates
 *   GET/POST/PATCH/DELETE /api/dienstplan/shifts
 *   GET/POST/PATCH/DELETE /api/dienstplan/absences
 *   GET    /api/dienstplan/balance?year[&employeeId]
 *
 * Gerechnet wird hier nichts - Feiertage, Ruhetag, Urlaubstage und Salden
 * kommen aus `apps/bakery-api/src/services/vacation.core.js` über die API
 * (`docs/api/dienstplan.md`). Hier stehen nur Typen, Aufrufe, Beschriftungen
 * und Formatierung.
 */

import { apiClient } from '@bakery/shared/data-access'

const BASE = '/api/dienstplan'

// ---------------------------------------------------------------- Typen

export const AREAS = ['verkauf', 'backstube', 'fahrer', 'buero'] as const
export type Area = (typeof AREAS)[number]

export const EMPLOYMENT_TYPES = [
  'vollzeit',
  'teilzeit',
  'minijob',
  'aushilfe',
] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

export const ABSENCE_TYPES = ['urlaub', 'frei', 'abwesend'] as const
export type AbsenceType = (typeof ABSENCE_TYPES)[number]

export const ABSENCE_STATUSES = ['geplant', 'genehmigt'] as const
export type AbsenceStatus = (typeof ABSENCE_STATUSES)[number]

export interface Employee {
  id: number
  displayName: string
  area: Area
  /** `#RRGGBB` für den Kalender, `null` = keine. */
  color: string | null
  employmentType: EmploymentType | null
  weeklyHours: number | null
  entryDate: string | null
  exitDate: string | null
  active: boolean
  /** Optionaler Verweis auf einen Login (`/api/users`). */
  userId: number | null
  note: string | null
  createdAt: string
  updatedAt: string
}

/** Felder für Anlegen und Ändern; `null` leert ein optionales Feld. */
export interface EmployeeInput {
  displayName?: string
  area?: Area
  color?: string | null
  employmentType?: EmploymentType | null
  weeklyHours?: number | null
  entryDate?: string | null
  exitDate?: string | null
  userId?: number | null
  note?: string | null
  active?: boolean
}

/** Anspruch eines Jahres; `null` = „offen“ (nicht erfasst), nie 0. */
export interface Entitlement {
  employeeId: number
  year: number
  entitlementDays: number | null
  carryoverDays: number | null
}

/**
 * Urlaubskonto eines Jahres (`vacationBalance` in `vacation.core.js`).
 * `no-config`: kein Anspruch erfasst - `entitlement` und die Reste sind
 * `null` („offen“). `not-employed`: im Jahr nicht beschäftigt.
 */
export interface VacationBalance {
  employeeId: number
  status: 'ok' | 'no-config' | 'not-employed'
  year: number
  /** Voller Jahresanspruch, wie erfasst. */
  entitlementDays: number | null
  carryoverDays: number | null
  carryoverDeadline: string
  approvedDays: number
  plannedDays: number
  /** Anspruch im Jahr, anteilig bei Ein-/Austritt. */
  entitlement: number | null
  months: number | null
  fullYear: boolean | null
  carryoverUsed: number | null
  carryoverExpired: number | null
  carryoverOpen: number | null
  remainingDays: number | null
  remainingAfterPlannedDays: number | null
}

export interface BalanceListEntry extends VacationBalance {
  displayName: string
  area: Area
  active: boolean
}

export interface ShiftTemplate {
  id: number
  name: string
  startTime: string
  endTime: string
  breakMinutes: number
}

export interface Shift {
  id: number
  employeeId: number
  date: string
  startTime: string
  endTime: string
  breakMinutes: number
  /** Arbeitszeit ohne Pause (von der API gerechnet). */
  minutes: number
  note: string | null
}

export interface ShiftInput {
  employeeId?: number
  date?: string
  startTime?: string
  endTime?: string
  breakMinutes?: number
  templateId?: number
  note?: string | null
}

export interface Absence {
  id: number
  employeeId: number
  type: AbsenceType
  status: AbsenceStatus
  startDate: string
  endDate: string
  halfDay: boolean
  /** Urlaubstage, die der Zeitraum kostet (Öffnungstage, von der API gerechnet). */
  days: number
  note: string | null
}

export interface AbsenceInput {
  employeeId?: number
  type?: AbsenceType
  status?: AbsenceStatus
  startDate?: string
  endDate?: string
  halfDay?: boolean
  note?: string | null
}

export interface ClosedWeekdays {
  /** ISO-Wochentage (1 = Montag … 7 = Sonntag). */
  weekdays: number[]
  source: 'config' | 'default'
}

export interface CalendarDay {
  date: string
  weekday: number
  holidayName: string | null
  restDay: boolean
  closed: boolean
  /** 1, 0,5 (24./31.12.) oder 0 (geschlossen). */
  weight: number
  halfDayName: string | null
  verkaufBesetzt: number
}

export interface Calendar {
  from: string
  to: string
  today: string
  closedWeekdays: ClosedWeekdays
  employees: Employee[]
  shifts: Shift[]
  absences: Absence[]
  days: CalendarDay[]
}

/**
 * Abwesenheit im Profil: `days` zählt den ganzen Zeitraum, `daysInYear` nur
 * den Teil im gezeigten Jahr - den, den das Urlaubskonto des Jahres zählt.
 */
export interface ProfileAbsence extends Absence {
  daysInYear: number
}

export interface EmployeeProfile {
  employee: Employee
  year: number
  entitlements: Entitlement[]
  balance: VacationBalance
  /** Abwesenheiten, die das Jahr berühren. */
  absences: ProfileAbsence[]
  /** Kommende Schichten ab heute (höchstens 20). */
  upcomingShifts: Shift[]
  closedWeekdays: ClosedWeekdays
}

/** Hinweis der API neben `data` (Überschneidung, geschlossener Tag) - kein Fehler. */
export interface DienstplanWarning {
  code: string
  message: string
}

export interface WithWarnings<T> {
  data: T
  warnings: DienstplanWarning[]
}

// ---------------------------------------------------------------- Aufrufe

function unwrap<T>(res: { data?: T } | undefined): T {
  if (!res || res.data === undefined) {
    throw new Error('Leere Antwort vom Server.')
  }
  return res.data
}

function withWarnings<T>(
  res: { data?: T; warnings?: unknown } | undefined
): WithWarnings<T> {
  const data = unwrap(res)
  const raw = (res as { warnings?: unknown }).warnings
  const warnings = Array.isArray(raw)
    ? raw.filter(
        (w): w is DienstplanWarning =>
          !!w &&
          typeof w === 'object' &&
          typeof (w as DienstplanWarning).message === 'string'
      )
    : []
  return { data, warnings }
}

function id(value: number): string {
  return encodeURIComponent(String(value))
}

export async function fetchCalendar(range: {
  from: string
  to: string
}): Promise<Calendar> {
  return unwrap(
    await apiClient.get<Calendar>(BASE, { from: range.from, to: range.to })
  )
}

export async function fetchEmployees(): Promise<Employee[]> {
  return unwrap(await apiClient.get<Employee[]>(`${BASE}/employees`))
}

export async function createEmployee(input: EmployeeInput): Promise<Employee> {
  return unwrap(await apiClient.post<Employee>(`${BASE}/employees`, input))
}

export async function fetchEmployeeProfile(
  employeeId: number,
  year?: number
): Promise<EmployeeProfile> {
  return unwrap(
    await apiClient.get<EmployeeProfile>(
      `${BASE}/employees/${id(employeeId)}`,
      year !== undefined ? { year } : undefined
    )
  )
}

export async function updateEmployee(
  employeeId: number,
  changes: EmployeeInput
): Promise<Employee> {
  return unwrap(
    await apiClient.patch<Employee>(
      `${BASE}/employees/${id(employeeId)}`,
      changes
    )
  )
}

export async function fetchEntitlements(
  employeeId: number
): Promise<Entitlement[]> {
  return unwrap(
    await apiClient.get<Entitlement[]>(
      `${BASE}/employees/${id(employeeId)}/entitlements`
    )
  )
}

export async function saveEntitlement(
  employeeId: number,
  year: number,
  values: { entitlementDays: number | null; carryoverDays: number | null }
): Promise<Entitlement> {
  return unwrap(
    await apiClient.put<Entitlement>(
      `${BASE}/employees/${id(employeeId)}/entitlements/${id(year)}`,
      values
    )
  )
}

export async function fetchShiftTemplates(): Promise<ShiftTemplate[]> {
  return unwrap(await apiClient.get<ShiftTemplate[]>(`${BASE}/shift-templates`))
}

export async function createShiftTemplate(
  input: Omit<ShiftTemplate, 'id'>
): Promise<ShiftTemplate> {
  return unwrap(
    await apiClient.post<ShiftTemplate>(`${BASE}/shift-templates`, input)
  )
}

export async function updateShiftTemplate(
  templateId: number,
  changes: Partial<Omit<ShiftTemplate, 'id'>>
): Promise<ShiftTemplate> {
  return unwrap(
    await apiClient.patch<ShiftTemplate>(
      `${BASE}/shift-templates/${id(templateId)}`,
      changes
    )
  )
}

export async function deleteShiftTemplate(templateId: number): Promise<void> {
  await apiClient.delete(`${BASE}/shift-templates/${id(templateId)}`)
}

export async function fetchShifts(query: {
  from: string
  to: string
  employeeId?: number
}): Promise<Shift[]> {
  return unwrap(await apiClient.get<Shift[]>(`${BASE}/shifts`, query))
}

export async function createShift(
  input: ShiftInput
): Promise<WithWarnings<Shift>> {
  return withWarnings(await apiClient.post<Shift>(`${BASE}/shifts`, input))
}

export async function updateShift(
  shiftId: number,
  changes: ShiftInput
): Promise<WithWarnings<Shift>> {
  return withWarnings(
    await apiClient.patch<Shift>(`${BASE}/shifts/${id(shiftId)}`, changes)
  )
}

export async function deleteShift(shiftId: number): Promise<void> {
  await apiClient.delete(`${BASE}/shifts/${id(shiftId)}`)
}

export async function fetchAbsences(query: {
  from: string
  to: string
  employeeId?: number
}): Promise<Absence[]> {
  return unwrap(await apiClient.get<Absence[]>(`${BASE}/absences`, query))
}

export async function createAbsence(
  input: AbsenceInput
): Promise<WithWarnings<Absence>> {
  return withWarnings(await apiClient.post<Absence>(`${BASE}/absences`, input))
}

export async function updateAbsence(
  absenceId: number,
  changes: AbsenceInput
): Promise<WithWarnings<Absence>> {
  return withWarnings(
    await apiClient.patch<Absence>(`${BASE}/absences/${id(absenceId)}`, changes)
  )
}

export async function deleteAbsence(absenceId: number): Promise<void> {
  await apiClient.delete(`${BASE}/absences/${id(absenceId)}`)
}

export async function fetchBalances(
  year?: number
): Promise<BalanceListEntry[]> {
  return unwrap(
    await apiClient.get<BalanceListEntry[]>(
      `${BASE}/balance`,
      year !== undefined ? { year } : undefined
    )
  )
}

export async function fetchBalance(
  employeeId: number,
  year?: number
): Promise<VacationBalance> {
  return unwrap(
    await apiClient.get<VacationBalance>(`${BASE}/balance`, {
      employeeId,
      ...(year !== undefined ? { year } : {}),
    })
  )
}

// ------------------------------------------------- Beschriftung (Deutsch)

/** Dieselben Wörter wie `AREA_LABELS` in `vacation.core.js` (Spec prüft). */
export const AREA_LABELS: Record<Area, string> = {
  verkauf: 'Verkauf',
  backstube: 'Backstube',
  fahrer: 'Fahrer',
  buero: 'Büro',
}

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  vollzeit: 'Vollzeit',
  teilzeit: 'Teilzeit',
  minijob: 'Minijob',
  aushilfe: 'Aushilfe',
}

/** Dieselben Wörter wie `ABSENCE_TYPE_LABELS` in `vacation.core.js` (Spec prüft). */
export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  urlaub: 'Urlaub',
  frei: 'Frei',
  abwesend: 'Abwesend',
}

export const ABSENCE_STATUS_LABELS: Record<AbsenceStatus, string> = {
  geplant: 'geplant',
  genehmigt: 'genehmigt',
}

/** Farben zur Auswahl im Profil (Kalenderfarbe). */
export const EMPLOYEE_COLORS: readonly string[] = [
  '#1E88E5',
  '#43A047',
  '#F4511E',
  '#8E24AA',
  '#FDD835',
  '#00ACC1',
  '#6D4C41',
  '#D81B60',
]

// ---------------------------------------------------------------- Helfer

/** Mitarbeiter nach Bereich (Verkauf zuerst), je Bereich nach Name. */
export function groupByArea(
  employees: readonly Employee[]
): { area: Area; label: string; employees: Employee[] }[] {
  return AREAS.map((area) => ({
    area,
    label: AREA_LABELS[area],
    employees: employees
      .filter((e) => e.area === area)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'de')),
  })).filter((group) => group.employees.length > 0)
}

export type EmployeeFilter = 'aktiv' | 'ausgeschieden' | 'alle'

export function filterEmployees(
  employees: readonly Employee[],
  filter: EmployeeFilter
): Employee[] {
  if (filter === 'alle') return [...employees]
  return employees.filter((e) => e.active === (filter === 'aktiv'))
}

/**
 * Nur die Felder, die sich gegenüber `original` geändert haben - ein
 * Speichern ohne Änderung schickt nichts (No-op, kein Audit-Eintrag).
 */
export function employeeChanges(
  original: Employee,
  next: EmployeeInput
): EmployeeInput {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue
    if ((original as unknown as Record<string, unknown>)[key] !== value) {
      out[key] = value
    }
  }
  return out as EmployeeInput
}

/** Tage deutsch: 1,5 statt 1.5; ganze Zahlen ohne Nachkommastellen. */
export function formatDays(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–'
  return value.toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

/** Wert eines Urlaubskontos: `null` heißt „offen“ (kein Anspruch erfasst). */
export function formatOpenDays(value: number | null | undefined): string {
  return value === null || value === undefined ? 'offen' : formatDays(value)
}

/** `2026-12-24` → `24.12.2026`. */
export function formatDateDe(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '–'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** `2026-12-24` → `Do, 24.12.2026`. */
export function formatDateWithWeekday(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return formatDateDe(iso)
  const weekday = WEEKDAYS_SHORT[(date.getUTCDay() + 6) % 7]
  return `${weekday}, ${formatDateDe(iso)}`
}

/** Zeitraum einer Abwesenheit: ein Tag oder „von – bis“, Halbtag markiert. */
export function formatAbsenceRange(
  absence: Pick<Absence, 'startDate' | 'endDate' | 'halfDay'>
): string {
  const single = absence.startDate === absence.endDate
  const range = single
    ? formatDateDe(absence.startDate)
    : `${formatDateDe(absence.startDate)} – ${formatDateDe(absence.endDate)}`
  return absence.halfDay ? `${range} (halber Tag)` : range
}

/** `450` Minuten → `7:30 h`. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')} h`
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const d = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/**
 * Tage-Eingabe lesen (Anspruch, Übertrag): leer = `null` („offen“), sonst
 * 0-365 mit höchstens zwei Nachkommastellen, Komma oder Punkt. `NaN` =
 * ungültig. Die Grenzen prüft die API noch einmal.
 */
export function parseDaysInput(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return NaN
  const n = Number(t)
  return n > 365 ? NaN : n
}

/** Wochenstunden lesen: leer = `null`, sonst 0-60. `NaN` = ungültig. */
export function parseHoursInput(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) return NaN
  const n = Number(t)
  return n > 60 ? NaN : n
}

/** Zahl für ein Eingabefeld: `1.5` → `1,5`, `null` → leer. */
export function numberToInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value).replace('.', ',')
}
