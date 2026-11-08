/**
 * Dienstplan und Urlaubskonto (TASK-042): Feiertage Saarland, Öffnungstage,
 * Gewicht eines Tages, Urlaubstage einer Abwesenheit, anteiliger Anspruch,
 * Jahreskonto mit Übertrag, Schicht-Regeln und die Tagesliste des Kalenders.
 *
 * Bewusst abhängigkeitsfreies CommonJS (Konvention wie `targets.core.js`):
 * dieselbe Datei benutzen die API (`src/services/dienstplan.service.ts`), die
 * Verwaltung (über die API - der Browser rechnet keine Feiertage oder Salden
 * selbst) und die Tests (`tests/unit/vacationCore.test.js`). Wer eine Regel
 * ändert, ändert sie hier und nur hier.
 *
 * Entscheidungen des Inhabers (2026-11-08, TASK-042):
 *   - Urlaub zählt in **Arbeitstagen = Öffnungstagen**, für alle gleich
 *     (6-Tage-Woche, Samstag zählt immer), unabhängig vom Profil.
 *   - Öffnungstag = kein Ruhetag und kein Feiertag (Saarland). Feiertage sind
 *     geschlossen und zählen nie als Urlaubstag.
 *   - 24.12. und 31.12. zählen als halbe Tage (0,5), sofern Öffnungstag.
 *   - Halber Tag (`halfDay`) = 0,5; an einem Tag mit Gewicht 0,5 bleibt es 0,5.
 *   - Nur `urlaub` verbraucht Urlaubstage; `frei` und `abwesend` nicht.
 *   - Übertrag aus dem Vorjahr: genehmigter Urlaub bis 31.03. verbraucht ihn
 *     zuerst; was am 31.03. übrig ist, verfällt und wird so ausgewiesen.
 *   - Fehlt der Jahresanspruch, gibt es kein Konto (`status: 'no-config'`,
 *     Rest „offen“) - nie 0.
 *
 * Datumsangaben sind `YYYY-MM-DD` (Ortszeit der Bäckerei, zeitzonenfrei
 * gerechnet), Uhrzeiten `HH:MM`, Wochentage ISO (1 = Montag … 7 = Sonntag).
 */

'use strict'

const { normalizeClosedWeekdays } = require('./targets.core')

const AREAS = ['verkauf', 'backstube', 'fahrer', 'buero']

const AREA_LABELS = {
  verkauf: 'Verkauf',
  backstube: 'Backstube',
  fahrer: 'Fahrer',
  buero: 'Büro',
}

const EMPLOYMENT_TYPES = ['vollzeit', 'teilzeit', 'minijob', 'aushilfe']

const ABSENCE_TYPES = ['urlaub', 'frei', 'abwesend']

const ABSENCE_TYPE_LABELS = {
  urlaub: 'Urlaub',
  frei: 'Frei',
  abwesend: 'Abwesend',
}

const ABSENCE_STATUSES = ['geplant', 'genehmigt']

/** Nur in diesem Bereich gibt es Schichten (Entscheidung 2). */
const SHIFT_AREA = 'verkauf'

/**
 * Ruhetag, wenn die Finanz-Config (`targets.json`) keine gültigen
 * `closed_weekdays` hat: Montag (`hq/notes/procedures/backliste.md`). Steht
 * dort eine gültige Liste - auch eine leere -, gilt sie.
 */
const DEFAULT_CLOSED_WEEKDAYS = [1]

/** Halbe Tage, sofern Öffnungstag (Entscheidung 8): Heiligabend, Silvester. */
const HALF_DAYS = { '12-24': 'Heiligabend', '12-31': 'Silvester' }

/** Bis zu diesem Tag (MM-DD) des Folgejahres gilt der Übertrag. */
const CARRYOVER_DEADLINE = '03-31'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

// ============================================================================
// DATUM
// ============================================================================

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

function isoWeekday(date) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}

function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** `YYYY-MM-DD` um n Monate verschieben (Tag wird auf den Monat gekappt). */
function addMonths(date, n) {
  const [y, m, d] = date.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + n, 1))
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate()
  target.setUTCDate(Math.min(d, last))
  return target.toISOString().slice(0, 10)
}

/** Anzahl Kalendertage von `from` bis `to` einschließlich (0, wenn leer). */
function daysInclusive(from, to) {
  if (!isValidDate(from) || !isValidDate(to) || from > to) return 0
  const a = Date.parse(`${from}T12:00:00Z`)
  const b = Date.parse(`${to}T12:00:00Z`)
  return Math.round((b - a) / 86400000) + 1
}

function listDates(from, to) {
  const out = []
  if (!isValidDate(from) || !isValidDate(to) || from > to) return out
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

function maxDate(a, b) {
  return a > b ? a : b
}

function minDate(a, b) {
  return a < b ? a : b
}

function round2(value) {
  return Math.round(value * 100) / 100
}

// ============================================================================
// FEIERTAGE SAARLAND
// ============================================================================

/** Ostersonntag (gregorianisch, Anonymer Algorithmus nach Meeus/Jones/Butcher). */
function easterSunday(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(
    2,
    '0'
  )}`
}

const holidayCache = new Map()

/**
 * Gesetzliche Feiertage im Saarland (SFG): bundesweite plus Fronleichnam,
 * Mariä Himmelfahrt und Allerheiligen. Ostersonntag und Pfingstsonntag sind
 * im Saarland keine gesetzlichen Feiertage. Sortiert, `[{ date, name }]`.
 */
function holidaysSaarland(year) {
  if (!Number.isInteger(year) || year < 1900 || year > 2999) return []
  if (holidayCache.has(year)) return holidayCache.get(year)
  const easter = easterSunday(year)
  const fixed = (md, name) => ({ date: `${year}-${md}`, name })
  const moving = (offset, name) => ({ date: addDays(easter, offset), name })
  const list = [
    fixed('01-01', 'Neujahr'),
    moving(-2, 'Karfreitag'),
    moving(1, 'Ostermontag'),
    fixed('05-01', 'Tag der Arbeit'),
    moving(39, 'Christi Himmelfahrt'),
    moving(50, 'Pfingstmontag'),
    moving(60, 'Fronleichnam'),
    fixed('08-15', 'Mariä Himmelfahrt'),
    fixed('10-03', 'Tag der Deutschen Einheit'),
    fixed('11-01', 'Allerheiligen'),
    fixed('12-25', '1. Weihnachtstag'),
    fixed('12-26', '2. Weihnachtstag'),
  ].sort((x, y) => (x.date < y.date ? -1 : 1))
  holidayCache.set(year, list)
  return list
}

/** Name des Feiertags an `date` oder `null`. */
function holidayName(date) {
  if (!isValidDate(date)) return null
  const hit = holidaysSaarland(Number(date.slice(0, 4))).find(
    (h) => h.date === date
  )
  return hit ? hit.name : null
}

// ============================================================================
// ÖFFNUNGSTAGE UND GEWICHT
// ============================================================================

/**
 * Ruhetage aus der Finanz-Config (`hq/data/finance/config/targets.json`,
 * Feld `closed_weekdays`, Regel wie in `targets.core.js`). `config` ist das
 * geparste JSON oder `null`. Fehlt die Config oder ist das Feld ungültig,
 * gilt Montag (`DEFAULT_CLOSED_WEEKDAYS`) - `source` sagt, woher der Wert
 * kommt (`'config'` | `'default'`).
 */
function closedWeekdaysFrom(config) {
  const fromConfig =
    config && typeof config === 'object' && !Array.isArray(config)
      ? normalizeClosedWeekdays(config.closed_weekdays)
      : null
  if (fromConfig) return { weekdays: fromConfig, source: 'config' }
  return { weekdays: [...DEFAULT_CLOSED_WEEKDAYS], source: 'default' }
}

function closedSet(closedWeekdays) {
  return new Set(
    Array.isArray(closedWeekdays) ? closedWeekdays : DEFAULT_CLOSED_WEEKDAYS
  )
}

/**
 * Ein Kalendertag: `{ date, weekday, holidayName, restDay, closed, weight,
 * halfDayName }`. `weight` ist, was ein Urlaubstag an diesem Datum kostet:
 * 0 geschlossen (Ruhetag oder Feiertag), 0,5 an 24.12./31.12., sonst 1.
 */
function dayInfo(date, closedWeekdays) {
  const weekday = isoWeekday(date)
  const holiday = holidayName(date)
  const restDay = closedSet(closedWeekdays).has(weekday)
  const closed = restDay || holiday !== null
  const halfDayName = HALF_DAYS[date.slice(5)] || null
  let weight = 1
  if (closed) weight = 0
  else if (halfDayName) weight = 0.5
  return {
    date,
    weekday,
    holidayName: holiday,
    restDay,
    closed,
    weight,
    halfDayName: closed ? null : halfDayName,
  }
}

/** Gewicht eines Tages (siehe `dayInfo`). */
function dayWeight(date, closedWeekdays) {
  return dayInfo(date, closedWeekdays).weight
}

// ============================================================================
// ABWESENHEITEN
// ============================================================================

/**
 * Urlaubstage, die eine Abwesenheit kostet - optional nur der Teil im
 * Fenster `window = { from, to }` (z. B. ein Kalenderjahr). Summe der
 * Tagesgewichte; mit `halfDay` zählt jeder Tag höchstens 0,5 (0 bleibt 0).
 * Die Art spielt hier keine Rolle - welche Arten Urlaub kosten, entscheidet
 * `vacationBalance` (nur `urlaub`).
 */
function absenceDays(absence, closedWeekdays, window) {
  if (!absence || !isValidDate(absence.startDate)) return 0
  const end = isValidDate(absence.endDate) ? absence.endDate : absence.startDate
  let from = absence.startDate
  let to = end
  if (window) {
    if (isValidDate(window.from)) from = maxDate(from, window.from)
    if (isValidDate(window.to)) to = minDate(to, window.to)
  }
  let sum = 0
  for (const date of listDates(from, to)) {
    const w = dayWeight(date, closedWeekdays)
    sum += absence.halfDay ? Math.min(w, 0.5) : w
  }
  return round2(sum)
}

/** Deckt die Abwesenheit den Tag `date`? */
function absenceCovers(absence, date) {
  if (!absence || !isValidDate(absence.startDate)) return false
  const end = isValidDate(absence.endDate) ? absence.endDate : absence.startDate
  return absence.startDate <= date && date <= end
}

/** Überschneiden sich zwei Zeiträume `[startDate, endDate]`? */
function rangesOverlap(a, b) {
  return a.startDate <= b.endDate && b.startDate <= a.endDate
}

// ============================================================================
// ANSPRUCH UND JAHRESKONTO
// ============================================================================

/**
 * Volle Beschäftigungsmonate im Kalenderjahr `year`, gezählt ab dem ersten
 * Beschäftigungstag im Jahr (15.03. → 15.03.-14.04. ist ein Monat), und ob
 * die Person das ganze Jahr beschäftigt ist. `null`, wenn die Beschäftigung
 * das Jahr nicht berührt.
 */
function employmentMonthsInYear(year, entryDate, exitDate) {
  const yearFrom = `${year}-01-01`
  const yearTo = `${year}-12-31`
  const from = isValidDate(entryDate) ? maxDate(entryDate, yearFrom) : yearFrom
  const to = isValidDate(exitDate) ? minDate(exitDate, yearTo) : yearTo
  if (from > to) return null
  if (from === yearFrom && to === yearTo) return { months: 12, fullYear: true }
  const after = addDays(to, 1)
  let months = 0
  while (months < 12 && addMonths(from, months + 1) <= after) months += 1
  return { months, fullYear: false }
}

/**
 * Anteiliger Jahresanspruch bei Eintritt oder Austritt im Jahr: 1/12 je
 * vollem Beschäftigungsmonat (§ 5 Abs. 1 BUrlG, so vom Inhaber für Ein- und
 * Austritt festgelegt). Rundung nach § 5 Abs. 2 BUrlG: Bruchteile von
 * mindestens einem halben Tag werden auf einen vollen Tag aufgerundet;
 * kleinere Bruchteile bleiben stehen (nicht abgerundet, auf 2 Stellen).
 *
 * `{ entitlement, months, fullYear }` oder `null` (keine Beschäftigung im
 * Jahr). `entitlementDays` muss eine Zahl ≥ 0 sein.
 */
function proRataEntitlement(entitlementDays, year, entryDate, exitDate) {
  const span = employmentMonthsInYear(year, entryDate, exitDate)
  if (!span) return null
  if (span.fullYear) {
    return { entitlement: entitlementDays, months: 12, fullYear: true }
  }
  const raw = (entitlementDays * span.months) / 12
  const whole = Math.floor(raw + 1e-9)
  const fraction = raw - whole
  const entitlement =
    fraction >= 0.5 - 1e-9 ? whole + 1 : round2(Math.max(raw, 0))
  return { entitlement, months: span.months, fullYear: false }
}

function isDays(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/**
 * Urlaubskonto eines Jahres.
 *
 *   input = {
 *     year, today,
 *     entitlement: { entitlementDays, carryoverDays } | null,  // Zeile des Jahres
 *     entryDate, exitDate,                                     // Profil
 *     absences: [{ type, status, startDate, endDate, halfDay }],
 *     closedWeekdays,
 *   }
 *
 * Ergebnis (Tage, auf 2 Stellen):
 *   status            'ok' | 'no-config' (kein Anspruch erfasst) |
 *                     'not-employed' (Beschäftigung berührt das Jahr nicht)
 *   entitlementDays   Jahresanspruch laut Eintrag (null = fehlt)
 *   entitlement       wirksamer Anspruch nach Anteil (null bei no-config)
 *   months, fullYear  Beschäftigungsmonate im Jahr
 *   carryoverDays     Übertrag laut Eintrag (null = keiner erfasst, zählt 0)
 *   carryoverUsed     davon durch genehmigten Urlaub bis 31.03. verbraucht
 *   carryoverExpired  am 31.03. verfallen (erst nach dem Stichtag > 0)
 *   carryoverOpen     noch nutzbar bis `carryoverDeadline` (vor dem Stichtag)
 *   approvedDays      genehmigter Urlaub im Jahr
 *   plannedDays       geplanter (noch nicht genehmigter) Urlaub im Jahr
 *   remainingDays     Anspruch + Übertrag − verfallen − genehmigt (null bei no-config)
 *   remainingAfterPlannedDays  remainingDays − plannedDays
 *
 * Genommen und geplant sind Tatsachen und stehen auch ohne Anspruch da.
 */
function vacationBalance(input) {
  const year = input.year
  const closedWeekdays = input.closedWeekdays
  const yearWindow = { from: `${year}-01-01`, to: `${year}-12-31` }
  const deadline = `${year}-${CARRYOVER_DEADLINE}`
  const deadlineWindow = { from: yearWindow.from, to: deadline }

  let approvedDays = 0
  let plannedDays = 0
  let approvedUntilDeadline = 0
  for (const a of Array.isArray(input.absences) ? input.absences : []) {
    if (!a || a.type !== 'urlaub') continue
    const days = absenceDays(a, closedWeekdays, yearWindow)
    if (a.status === 'genehmigt') {
      approvedDays += days
      approvedUntilDeadline += absenceDays(a, closedWeekdays, deadlineWindow)
    } else if (a.status === 'geplant') {
      plannedDays += days
    }
  }
  approvedDays = round2(approvedDays)
  plannedDays = round2(plannedDays)
  approvedUntilDeadline = round2(approvedUntilDeadline)

  const row = input.entitlement || null
  const entitlementDays =
    row && isDays(row.entitlementDays) ? row.entitlementDays : null
  const carryoverDays =
    row && isDays(row.carryoverDays) ? row.carryoverDays : null

  const base = {
    year,
    entitlementDays,
    carryoverDays,
    carryoverDeadline: deadline,
    approvedDays,
    plannedDays,
  }
  const empty = {
    entitlement: null,
    months: null,
    fullYear: null,
    carryoverUsed: null,
    carryoverExpired: null,
    carryoverOpen: null,
    remainingDays: null,
    remainingAfterPlannedDays: null,
  }

  const span = employmentMonthsInYear(year, input.entryDate, input.exitDate)
  if (!span) return { status: 'not-employed', ...base, ...empty }
  if (entitlementDays === null) {
    return {
      status: 'no-config',
      ...base,
      ...empty,
      months: span.months,
      fullYear: span.fullYear,
    }
  }

  const pro = proRataEntitlement(
    entitlementDays,
    year,
    input.entryDate,
    input.exitDate
  )
  const carry = carryoverDays ?? 0
  const carryoverUsed = round2(Math.min(carry, approvedUntilDeadline))
  const pastDeadline = isValidDate(input.today) && input.today > deadline
  const carryoverExpired = pastDeadline ? round2(carry - carryoverUsed) : 0
  const carryoverOpen = pastDeadline ? 0 : round2(carry - carryoverUsed)
  const remainingDays = round2(
    pro.entitlement + carry - carryoverExpired - approvedDays
  )
  return {
    status: 'ok',
    ...base,
    entitlement: pro.entitlement,
    months: pro.months,
    fullYear: pro.fullYear,
    carryoverUsed,
    carryoverExpired,
    carryoverOpen,
    remainingDays,
    remainingAfterPlannedDays: round2(remainingDays - plannedDays),
  }
}

// ============================================================================
// SCHICHTEN
// ============================================================================

function isValidTime(value) {
  return typeof value === 'string' && TIME_RE.test(value)
}

function timeToMinutes(value) {
  const m = TIME_RE.exec(value)
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN
}

/**
 * Prüft Beginn, Ende und Pause einer Schicht. Keine Schicht über Mitternacht:
 * Ende nach Beginn am selben Tag; die Pause ist kürzer als die Schicht.
 * `{ ok: true }` oder `{ ok: false, code, message }` (Deutsch).
 */
function checkShiftTimes(startTime, endTime, breakMinutes) {
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return {
      ok: false,
      code: 'invalid_time',
      message: 'Beginn und Ende bitte als Uhrzeit HH:MM angeben.',
    }
  }
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  if (end <= start) {
    return {
      ok: false,
      code: 'end_before_start',
      message:
        'Das Ende muss nach dem Beginn liegen (keine Schichten über Mitternacht).',
    }
  }
  const pause = breakMinutes ?? 0
  if (!Number.isInteger(pause) || pause < 0 || pause >= end - start) {
    return {
      ok: false,
      code: 'invalid_break',
      message:
        'Die Pause muss eine ganze Zahl an Minuten und kürzer als die Schicht sein.',
    }
  }
  return { ok: true }
}

/** Arbeitsminuten einer Schicht (Ende − Beginn − Pause). */
function shiftMinutes(shift) {
  return (
    timeToMinutes(shift.endTime) -
    timeToMinutes(shift.startTime) -
    (shift.breakMinutes || 0)
  )
}

/** Überschneiden sich zwei Schichten (gleicher Tag, Zeiten überlappen)? */
function shiftsOverlap(a, b) {
  if (a.date !== b.date) return false
  return (
    timeToMinutes(a.startTime) < timeToMinutes(b.endTime) &&
    timeToMinutes(b.startTime) < timeToMinutes(a.endTime)
  )
}

// ============================================================================
// KALENDER
// ============================================================================

/**
 * „Verkauf besetzt“ eines Tages: Personen aus dem Verkauf mit mindestens
 * einer Schicht an `date`, ohne ganztägige Abwesenheit an dem Tag (eine
 * halbtägige Abwesenheit lässt die Schicht stehen). Schnelle Lückenprüfung,
 * keine Stundenrechnung.
 */
function verkaufBesetzt(date, employees, shifts, absences) {
  const verkauf = new Set(
    (employees || []).filter((e) => e.area === SHIFT_AREA).map((e) => e.id)
  )
  const away = new Set(
    (absences || [])
      .filter((a) => !a.halfDay && absenceCovers(a, date))
      .map((a) => a.employeeId)
  )
  const present = new Set()
  for (const s of shifts || []) {
    if (s.date !== date) continue
    if (!verkauf.has(s.employeeId) || away.has(s.employeeId)) continue
    present.add(s.employeeId)
  }
  return present.size
}

/**
 * Tagesliste des Kalenders `from`…`to`:
 * `[{ date, weekday, holidayName, restDay, closed, weight, halfDayName,
 * verkaufBesetzt }]`.
 */
function calendarDays(from, to, closedWeekdays, employees, shifts, absences) {
  return listDates(from, to).map((date) => ({
    ...dayInfo(date, closedWeekdays),
    verkaufBesetzt: verkaufBesetzt(date, employees, shifts, absences),
  }))
}

/** Liegt `date` in der Beschäftigungszeit (Eintritt/Austritt, je optional)? */
function withinEmployment(date, entryDate, exitDate) {
  if (isValidDate(entryDate) && date < entryDate) return false
  if (isValidDate(exitDate) && date > exitDate) return false
  return true
}

module.exports = {
  AREAS,
  AREA_LABELS,
  EMPLOYMENT_TYPES,
  ABSENCE_TYPES,
  ABSENCE_TYPE_LABELS,
  ABSENCE_STATUSES,
  SHIFT_AREA,
  DEFAULT_CLOSED_WEEKDAYS,
  CARRYOVER_DEADLINE,
  isValidDate,
  isValidTime,
  isoWeekday,
  addDays,
  addMonths,
  daysInclusive,
  listDates,
  easterSunday,
  holidaysSaarland,
  holidayName,
  closedWeekdaysFrom,
  dayInfo,
  dayWeight,
  absenceDays,
  absenceCovers,
  rangesOverlap,
  employmentMonthsInYear,
  proRataEntitlement,
  vacationBalance,
  timeToMinutes,
  checkShiftTimes,
  shiftMinutes,
  shiftsOverlap,
  verkaufBesetzt,
  calendarDays,
  withinEmployment,
}
