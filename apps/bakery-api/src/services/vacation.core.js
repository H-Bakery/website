/**
 * Dienstplan und Urlaubskonto (TASK-042): Feiertage Saarland, Öffnungstage
 * und -zeiten, Gewicht eines Tages, Urlaubstage einer Abwesenheit,
 * anteiliger Anspruch, Jahreskonto mit Übertrag, Schicht-Regeln, die
 * Tagesliste des Kalenders mit der Besetzung des Verkaufs und die geplanten
 * Stunden neben dem Soll.
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
const { openingHoursForWeekday } = require('./opening-hours.core')
const {
  easterSunday,
  holidaysSaarland,
  holidayName,
  dayKind: kalenderDayKind,
  dayKindText,
} = require('./kalender.core')

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

/**
 * Bereich, dessen Besetzung der Kalender prüft („Verkauf besetzt“,
 * Besetzung über die Öffnungszeit). Schichten gibt es seit 2026-11-08 in
 * allen Bereichen (Entscheidung des Inhabers); gezählt wird nur dieser.
 */
const STAFFING_AREA = 'verkauf'

/**
 * Abwesenheitsarten, die das Soll mindern: Urlaub und abwesend. „frei“
 * mindert es nicht - ein freier Tag ist Ausgleich, die Stunden fehlen dann
 * wirklich in der Woche.
 */
const CREDITED_ABSENCE_TYPES = ['urlaub', 'abwesend']

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
// FEIERTAGE SAARLAND UND SCHLIESSTAGE - einzige Fassung in
// `kalender.core.js` (U9, Z14)
// ============================================================================

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
 * Was der Kalender der Bäckerei (`kalender.core.js` `dayKind`, hq
 * `config/kalender.yaml`) zu `date` sagt - dieselbe Frage wie Backzettel und
 * Rest am Abend, hier mit den Öffnungstagen des Dienstplans als Wochenplan
 * (alle Wochentage außer den Ruhetagen). `null` ohne Kalender.
 */
function calendarKind(date, closedWeekdays, calendar) {
  if (!calendar || typeof calendar !== 'object') return null
  const closed = closedSet(closedWeekdays)
  const days = [1, 2, 3, 4, 5, 6, 7].filter((wd) => !closed.has(wd))
  return kalenderDayKind({ days, dough_days: [], calendar }, date)
}

/**
 * Ein Kalendertag: `{ date, weekday, holidayName, restDay, closed, weight,
 * halfDayName, openingHours, kind, kindLabel, kindDetail, calendar }`.
 *
 * `closed` (Laden zu) kommt mit Kalender (`calendar` = `config.calendar` der
 * Backzettel-Stammdaten, Z14) aus `kalender.core.js`: ein Schließtag
 * (`geschlossen`, Betriebsferien, „nur Teig“) ist geschlossen, eine
 * Sonderöffnung oder „wie Sonntag“ offen - auch am Feiertag oder Ruhetag -
 * mit den Zeiten des Wochentags, nach dem geöffnet wird (`offen_bis` kürzt
 * das Ende). Ohne Kalender gilt genau die alte Regel: Ruhetag oder
 * gesetzlicher Feiertag = geschlossen. Für ein Jahr, das der Kalender nicht
 * führt, bleibt ein gesetzlicher Feiertag ohne eigenen Eintrag geschlossen
 * (wie ohne Kalender).
 *
 * `kind` ist der Tagestyp des Kalenders (`normal` | `ruhetag` |
 * `geschlossen` | `wie-sonntag` | `sonderoeffnung` | `teigtag`), `kindLabel`
 * / `kindDetail` sein Text (`dayKindText`), `calendar` = `ok` | `missing` |
 * `year-missing`.
 *
 * `weight` ist, was ein Urlaubstag an diesem Datum kostet, und hängt
 * **nicht** am Kalender (vorläufig, docs/domains/dienstplan.md): 0 am
 * Ruhetag und am gesetzlichen Feiertag (auch wenn der Laden dann offen
 * hat), 0,5 an 24.12./31.12., sonst 1 - auch an einem Schließtag des
 * Kalenders (Betriebsferien kosten Urlaub).
 *
 * `openingHours` = `{ opens, closes }` aus `opening-hours.core.js` an
 * offenen Tagen; `null` an geschlossenen - und an einem offenen Tag, für
 * dessen Wochentag die Tabelle keine Zeiten hat (die Finanz-Config öffnet
 * z. B. den Montag): dann ist die Öffnungszeit nicht hinterlegt.
 */
function dayInfo(date, closedWeekdays, calendar) {
  const weekday = isoWeekday(date)
  const holiday = holidayName(date)
  const restDay = closedSet(closedWeekdays).has(weekday)
  const noVacationDay = restDay || holiday !== null
  const halfDayName = HALF_DAYS[date.slice(5)] || null
  let weight = 1
  if (noVacationDay) weight = 0
  else if (halfDayName) weight = 0.5

  // Tagestyp: der Kalender, sonst (kein Kalender; Feiertag in einem Jahr,
  // das der Kalender nicht führt) die Regel von vor Z14.
  const k = calendarKind(date, closedWeekdays, calendar)
  const byCalendar =
    k !== null &&
    !(
      k.calendar === 'year-missing' &&
      holiday !== null &&
      (k.kind === 'normal' || k.kind === 'ruhetag')
    )
  let kind
  let closed
  let openingHours = null
  let text
  if (byCalendar) {
    kind = k.kind
    closed = !k.open
    text = { label: k.label, detail: k.detail }
    if (!closed) {
      const hours = openingHoursForWeekday(k.baseWeekday)
      openingHours =
        hours && k.openUntil && k.openUntil > hours.opens
          ? { ...hours, closes: k.openUntil }
          : hours
    }
  } else {
    closed = noVacationDay
    kind = holiday !== null ? 'geschlossen' : restDay ? 'ruhetag' : 'normal'
    text = dayKindText({ kind, note: holiday, holidayName: holiday })
    if (!closed) openingHours = openingHoursForWeekday(weekday)
  }
  return {
    date,
    weekday,
    holidayName: holiday,
    restDay,
    closed,
    weight,
    halfDayName: noVacationDay ? null : halfDayName,
    openingHours,
    kind,
    kindLabel: text.label,
    kindDetail: text.detail,
    calendar: k ? k.calendar : 'missing',
  }
}

/**
 * Gewicht eines Tages (siehe `dayInfo`) - ohne Kalender, das Gewicht hängt
 * nicht an ihm.
 */
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
 * Letzter Tag des `k`-ten Beschäftigungsmonats ab `from` (§ 187 Abs. 2,
 * § 188 Abs. 2 und 3 BGB): der Tag vor dem Tag mit derselben Zahl wie
 * `from`, k Monate später (15.03. → 14.04.). Fehlt dieser Tag im Monat
 * (31.01. + 1 Monat), endet der Monat mit dem letzten Tag des Monats
 * (28.02. bzw. 29.02.).
 */
function employmentMonthEnd(from, k) {
  const shifted = addMonths(from, k)
  const clamped = Number(shifted.slice(8, 10)) < Number(from.slice(8, 10))
  return clamped ? shifted : addDays(shifted, -1)
}

/**
 * Volle Beschäftigungsmonate im Kalenderjahr `year`, gezählt ab dem ersten
 * Beschäftigungstag im Jahr (15.03. → 15.03.-14.04. ist ein Monat,
 * 31.01. → 31.01.-28.02.), und ob die Person das ganze Jahr beschäftigt ist.
 * `null`, wenn die Beschäftigung das Jahr nicht berührt.
 */
function employmentMonthsInYear(year, entryDate, exitDate) {
  const yearFrom = `${year}-01-01`
  const yearTo = `${year}-12-31`
  const from = isValidDate(entryDate) ? maxDate(entryDate, yearFrom) : yearFrom
  const to = isValidDate(exitDate) ? minDate(exitDate, yearTo) : yearTo
  if (from > to) return null
  if (from === yearFrom && to === yearTo) return { months: 12, fullYear: true }
  let months = 0
  while (months < 12 && employmentMonthEnd(from, months + 1) <= to) months += 1
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
 *                     - alle drei null, wenn kein Übertrag erfasst ist
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
  // Ohne erfassten Übertrag rechnet der Rest mit 0, die Übertragsfelder
  // bleiben aber null ("nicht erfasst", nicht "0 verfallen").
  const carry = carryoverDays ?? 0
  const used = round2(Math.min(carry, approvedUntilDeadline))
  const pastDeadline = isValidDate(input.today) && input.today > deadline
  const expired = pastDeadline ? round2(carry - used) : 0
  const open = pastDeadline ? 0 : round2(carry - used)
  const hasCarry = carryoverDays !== null
  const carryoverUsed = hasCarry ? used : null
  const carryoverExpired = hasCarry ? expired : null
  const carryoverOpen = hasCarry ? open : null
  const remainingDays = round2(pro.entitlement + carry - expired - approvedDays)
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
 * Schichten aus dem Verkauf, die an `date` zählen: Person im Verkauf, ohne
 * ganztägige Abwesenheit an dem Tag (eine halbtägige Abwesenheit lässt die
 * Schicht stehen - wann der halbe Tag liegt, ist nicht erfasst).
 */
function presentVerkaufShifts(date, employees, shifts, absences) {
  const verkauf = new Set(
    (employees || []).filter((e) => e.area === STAFFING_AREA).map((e) => e.id)
  )
  const away = new Set(
    (absences || [])
      .filter((a) => !a.halfDay && absenceCovers(a, date))
      .map((a) => a.employeeId)
  )
  return (shifts || []).filter(
    (s) =>
      s.date === date && verkauf.has(s.employeeId) && !away.has(s.employeeId)
  )
}

/**
 * „Verkauf besetzt“ eines Tages: Personen aus dem Verkauf mit mindestens
 * einer Schicht an `date`, ohne ganztägige Abwesenheit an dem Tag (eine
 * halbtägige Abwesenheit lässt die Schicht stehen). Nur eine Zahl - wann
 * über den Tag niemand da ist, sagt `verkaufCoverage`.
 */
function verkaufBesetzt(date, employees, shifts, absences) {
  const present = new Set(
    presentVerkaufShifts(date, employees, shifts, absences).map(
      (s) => s.employeeId
    )
  )
  return present.size
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Besetzung des Verkaufs über die Öffnungszeit eines Tages: wer welchen Teil
 * abdeckt und wo niemand da ist. Gezählt werden dieselben Schichten wie bei
 * `verkaufBesetzt`, von Beginn bis Ende - die Pause hat keine Uhrzeit und
 * ist deshalb keine Lücke. Was vor dem Öffnen oder nach dem Schließen liegt,
 * fällt heraus.
 *
 *   openingHours = { opens, closes } | null
 *
 * `null` ohne Öffnungszeit (geschlossen oder nicht hinterlegt), sonst
 * `{ opens, closes, segments, gaps, covered }`:
 *   segments  lückenlos von `opens` bis `closes`, je Abschnitt dieselben
 *             Personen: `[{ from, to, employeeIds }]` (`employeeIds` nach
 *             Beginn ihrer Schicht, leer = unbesetzt)
 *   gaps      die unbesetzten Abschnitte `[{ from, to }]`
 *   covered   true, wenn es keine Lücke gibt
 */
function verkaufCoverage(date, openingHours, employees, shifts, absences) {
  if (
    !openingHours ||
    !isValidTime(openingHours.opens) ||
    !isValidTime(openingHours.closes)
  ) {
    return null
  }
  const opens = timeToMinutes(openingHours.opens)
  const closes = timeToMinutes(openingHours.closes)
  if (closes <= opens) return null
  const present = presentVerkaufShifts(date, employees, shifts, absences)
    .map((s) => ({
      employeeId: s.employeeId,
      from: Math.max(timeToMinutes(s.startTime), opens),
      to: Math.min(timeToMinutes(s.endTime), closes),
    }))
    .filter((s) => s.to > s.from)
    .sort((a, b) => a.from - b.from || a.employeeId - b.employeeId)

  const points = new Set([opens, closes])
  for (const s of present) {
    points.add(s.from)
    points.add(s.to)
  }
  const sorted = [...points].sort((a, b) => a - b)
  const segments = []
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const from = sorted[i]
    const to = sorted[i + 1]
    const ids = []
    for (const s of present) {
      if (s.from <= from && s.to >= to && !ids.includes(s.employeeId)) {
        ids.push(s.employeeId)
      }
    }
    const last = segments[segments.length - 1]
    if (last && last.employeeIds.join(',') === ids.join(',')) {
      last.to = to
    } else {
      segments.push({ from, to, employeeIds: ids })
    }
  }
  const out = segments.map((seg) => ({
    from: minutesToTime(seg.from),
    to: minutesToTime(seg.to),
    employeeIds: seg.employeeIds,
  }))
  const gaps = out
    .filter((seg) => seg.employeeIds.length === 0)
    .map((seg) => ({ from: seg.from, to: seg.to }))
  return {
    opens: openingHours.opens,
    closes: openingHours.closes,
    segments: out,
    gaps,
    covered: gaps.length === 0,
  }
}

/**
 * Tagesliste des Kalenders `from`…`to`:
 * `[{ date, weekday, holidayName, restDay, closed, weight, halfDayName,
 * openingHours, kind, kindLabel, kindDetail, calendar, verkaufBesetzt,
 * besetzung }]` (`besetzung` aus `verkaufCoverage`, `null` ohne
 * Öffnungszeit). `calendar` (optional) = Kalender der Bäckerei, siehe
 * `dayInfo`.
 */
function calendarDays(
  from,
  to,
  closedWeekdays,
  employees,
  shifts,
  absences,
  calendar
) {
  return listDates(from, to).map((date) => {
    const info = dayInfo(date, closedWeekdays, calendar)
    return {
      ...info,
      verkaufBesetzt: verkaufBesetzt(date, employees, shifts, absences),
      besetzung: verkaufCoverage(
        date,
        info.openingHours,
        employees,
        shifts,
        absences
      ),
    }
  })
}

// ============================================================================
// STUNDEN (Plan und Soll)
// ============================================================================

/**
 * Soll-Minuten je Öffnungstag: Wochenstunden ÷ Zahl der offenen Wochentage
 * (6 beim Ruhetag Montag - dieselbe 6-Tage-Woche wie beim Urlaub). `null`
 * ohne Wochenstunden oder ohne offenen Wochentag.
 */
function dailyTargetMinutes(weeklyHours, closedWeekdays) {
  if (
    typeof weeklyHours !== 'number' ||
    !Number.isFinite(weeklyHours) ||
    weeklyHours < 0
  ) {
    return null
  }
  const openWeekdays = 7 - closedSet(closedWeekdays).size
  if (openWeekdays <= 0) return null
  return (weeklyHours * 60) / openWeekdays
}

/**
 * Geplante Stunden einer Person im Zeitraum `from`…`to` neben dem Soll.
 *
 *   input = {
 *     from, to,
 *     employee: { id, weeklyHours, entryDate, exitDate },
 *     shifts:   Schichten (nur die der Person im Zeitraum zählen),
 *     absences: Abwesenheiten (nur die der Person zählen),
 *     closedWeekdays,
 *   }
 *
 * Plan = Σ (Ende − Beginn − Pause) der Schichten im Zeitraum, egal in
 * welchem Bereich und auch an einem Abwesenheits- oder geschlossenen Tag
 * (das ist beim Anlegen ein Hinweis, kein Fehler).
 *
 * Soll = Tagessoll (`dailyTargetMinutes`) × Σ Gewicht der Öffnungstage im
 * Zeitraum, an denen die Person beschäftigt ist. Ein Tag mit Urlaub oder
 * „abwesend“ (geplant oder genehmigt) zählt nicht, ein halber Tag zur
 * Hälfte (`CREDITED_ABSENCE_TYPES`; „frei“ mindert das Soll nicht).
 * Ruhetag und Feiertage zählen nicht, 24.12./31.12. halb. Eine volle Woche
 * ohne Feiertag ergibt genau die Wochenstunden, ein Monat im Mittel
 * Wochenstunden × 13/3.
 *
 * Ergebnis (Minuten, ganzzahlig gerundet):
 *   `{ employeeId, from, to, weeklyHours, plannedMinutes, shiftCount,
 *      targetMinutes, diffMinutes, targetDays, creditedDays, status }`
 *   status        'ok' | 'no-target' (keine Wochenstunden: Soll und
 *                 Differenz `null` = „offen“, nie 0)
 *   targetDays    Öffnungstage, die ins Soll eingehen (Summe der Gewichte)
 *   creditedDays  Öffnungstage, die Urlaub/abwesend vom Soll abziehen
 */
function plannedHours(input) {
  const { from, to, employee } = input
  const shifts = (input.shifts || []).filter(
    (s) => s.employeeId === employee.id && s.date >= from && s.date <= to
  )
  const plannedMinutes = shifts.reduce((sum, s) => sum + shiftMinutes(s), 0)
  const credited = (input.absences || []).filter(
    (a) =>
      a.employeeId === employee.id && CREDITED_ABSENCE_TYPES.includes(a.type)
  )

  let openDays = 0
  let creditedDays = 0
  for (const date of listDates(from, to)) {
    if (!withinEmployment(date, employee.entryDate, employee.exitDate)) continue
    const w = dayWeight(date, input.closedWeekdays)
    if (w === 0) continue
    openDays += w
    const absence = credited.find((a) => absenceCovers(a, date))
    if (absence) creditedDays += absence.halfDay ? Math.min(w, 0.5) : w
  }
  creditedDays = round2(creditedDays)
  const targetDays = round2(openDays - creditedDays)

  const weeklyHours =
    typeof employee.weeklyHours === 'number' &&
    Number.isFinite(employee.weeklyHours)
      ? employee.weeklyHours
      : null
  const perDay = dailyTargetMinutes(weeklyHours, input.closedWeekdays)
  const targetMinutes = perDay === null ? null : Math.round(perDay * targetDays)
  return {
    employeeId: employee.id,
    from,
    to,
    weeklyHours,
    plannedMinutes,
    shiftCount: shifts.length,
    targetMinutes,
    diffMinutes: targetMinutes === null ? null : plannedMinutes - targetMinutes,
    targetDays,
    creditedDays,
    status: targetMinutes === null ? 'no-target' : 'ok',
  }
}

/** `plannedHours` für jede Person aus `employees`, in deren Reihenfolge. */
function hoursByEmployee(
  from,
  to,
  employees,
  shifts,
  absences,
  closedWeekdays
) {
  return (employees || []).map((employee) =>
    plannedHours({ from, to, employee, shifts, absences, closedWeekdays })
  )
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
  STAFFING_AREA,
  CREDITED_ABSENCE_TYPES,
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
  verkaufCoverage,
  calendarDays,
  dailyTargetMinutes,
  plannedHours,
  hoursByEmployee,
  withinEmployment,
}
