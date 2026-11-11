// Kalender der Bäckerei (U9): was an einem Datum gilt - offen, geschlossen,
// wie Sonntag, Sonderöffnung, nur Teig - genau einmal.
//
// Dependency-freies CommonJS wie `backzettel-plan.core.js`. Stammdaten in hq
// `config/kalender.yaml` (privat); Backzettel, Backliste, Vorbestellung,
// Rest am Abend (`rest-am-abend.core.js` `countDayStatus`) und Dienstplan
// (`vacation.core.js` `dayInfo`, Z14) fragen hier, nicht selbst.
//
//   Grundregel: gesetzlicher Feiertag (Saarland) = geschlossen - aber nur für
//   die Jahre, die die Datei unter `feiertage` aufführt (und die Liste muss
//   der Formel unten entsprechen). Die Datei enthält sonst nur, was vom
//   Wochenplan (`days`, `dough_days` aus backzettel.yaml) und den
//   Feiertagen abweicht (`tage`).
//
//   typ            Laden  Backtag             Teigtag                Grundmenge nach
//   geschlossen    zu     nein                nein                   -
//   wie-sonntag    offen  wenn 7 in days      wenn 7 in dough_days   Wochentag 7
//   sonderoeffnung offen  wenn `wie` in days  wenn `wie` in dough_d. Wochentag `wie`
//   teigtag        zu     nein                ja                     - (nur Teig)
//
// Ohne Kalender (Datei fehlt, Tests ohne `calendar`) und für ein Jahr, das
// die Datei nicht aufführt, gilt genau der Wochenplan wie vor U9 - ein
// Feiertag ist dann ein normaler Tag. Nie ein erfundener Schließtag.

const KALENDER_TYPES = [
  'geschlossen',
  'wie-sonntag',
  'sonderoeffnung',
  'teigtag',
]

/** Bundesländer, deren Feiertage die Formel kennt. */
const BUNDESLAENDER = ['saarland']

/** So weit schaut `dayKind` voraus (wie `LOOKAHEAD_DAYS` im Plan-Kern). */
const LOOKAHEAD_DAYS = 14

/** Normal liegt der Teig höchstens Sa → Di vor dem Backtag (3 Tage). */
const DOUGH_DAY_FAR_DAYS = 3

/** Grundmengen-Spalten neben den Wochentagen (`base.vor_feiertag` …). */
const SPECIAL_BASE_KEYS = ['vor_feiertag', 'samstag_ersatz']

const ENTRY_KEYS = new Set([
  'datum',
  'von',
  'bis',
  'wochentage',
  'typ',
  'wie',
  'offen_bis',
  'notiz',
])

const MAX_NOTE_LENGTH = 200
const MAX_RANGE_DAYS = 366

const WEEKDAY_NAMES = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
  7: 'Sonntag',
}
const WEEKDAY_SHORT = {
  1: 'Mo',
  2: 'Di',
  3: 'Mi',
  4: 'Do',
  5: 'Fr',
  6: 'Sa',
  7: 'So',
}

const TYPE_LABELS = {
  ruhetag: 'Ruhetag',
  geschlossen: 'Geschlossen',
  'wie-sonntag': 'Wie Sonntag',
  sonderoeffnung: 'Sonderöffnung',
  teigtag: 'Nur Teig',
}

const BEFORE_LABELS = {
  vor_feiertag: 'Vor Feiertag',
  samstag_ersatz: 'Samstags-Satz',
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
// Steuerzeichen (außer Tab) haben in einer Notiz nichts zu suchen.
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000a-\u001f\u007f]/

// ---------------------------------------------------------------------------
// Datum
// ---------------------------------------------------------------------------

function isPlainObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

function isValidDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return false
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return (
    t.getUTCFullYear() === y &&
    t.getUTCMonth() === m - 1 &&
    t.getUTCDate() === d
  )
}

/** ISO-Wochentag (1 = Montag ... 7 = Sonntag) eines `YYYY-MM-DD`. */
function isoWeekday(date) {
  const [y, m, d] = date.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return day === 0 ? 7 : day
}

function addDays(date, days) {
  const [y, m, d] = String(date).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function daysBetween(from, to) {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000
  )
}

/** YAML-Datum als Text: `2026-12-24` (CORE_SCHEMA liefert Strings). */
function dateText(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString().slice(0, 10)
  return typeof value === 'string' ? value.trim() : value
}

/** `2026-12-24` → „Do 24.12.“ */
function shortDate(date) {
  const [, m, d] = String(date).split('-')
  return `${WEEKDAY_SHORT[isoWeekday(date)]} ${d}.${m}.`
}

// ---------------------------------------------------------------------------
// Gesetzliche Feiertage (Saarland). Einzige Fassung - `vacation.core.js`
// (Dienstplan, Urlaub) nimmt sie von hier.
// ---------------------------------------------------------------------------

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
  // Eingefroren: der Cache gilt für alle späteren Aufrufe im Prozess.
  const frozen = Object.freeze(list.map((h) => Object.freeze(h)))
  holidayCache.set(year, frozen)
  return frozen
}

/** Name des gesetzlichen Feiertags (Saarland) an `date` oder `null`. */
function holidayName(date) {
  if (!isValidDate(date)) return null
  const hit = holidaysSaarland(Number(date.slice(0, 4))).find(
    (h) => h.date === date
  )
  return hit ? hit.name : null
}

// ---------------------------------------------------------------------------
// Prüfen und Normalisieren
// ---------------------------------------------------------------------------

function isWeekday(n) {
  return Number.isInteger(n) && n >= 1 && n <= 7
}

function yearKey(key) {
  const n = Number(key)
  return Number.isInteger(n) && String(n) === String(key).trim() ? n : null
}

/**
 * Prüft den Inhalt von `config/kalender.yaml`.
 *
 * @param {object} raw geparstes YAML
 * @param {object} [options]
 * @param {object} [options.config] normalisierte Backzettel-Stammdaten - dann
 *   prüft der Validator auch `wie` gegen `days` und Teigtage gegen
 *   `dough_days`.
 * @returns {{ ok: boolean, errors: Array<{path, message}>, warnings: Array<{path, message}> }}
 */
function validateKalender(raw, options) {
  const errors = []
  const warnings = []
  const err = (path, message) => errors.push({ path, message })
  const warn = (path, message) => warnings.push({ path, message })
  const cfg = options && isPlainObject(options.config) ? options.config : null

  if (!isPlainObject(raw)) {
    err('', 'Der Kalender muss eine Zuordnung (YAML-Objekt) sein.')
    return { ok: false, errors, warnings }
  }
  for (const key of Object.keys(raw)) {
    if (!['version', 'bundesland', 'feiertage', 'tage'].includes(key))
      warn(key, `Unbekannter Schlüssel „${key}“ wird ignoriert.`)
  }
  if (raw.version !== 1) err('version', 'version muss 1 sein.')
  if (!BUNDESLAENDER.includes(raw.bundesland)) {
    err(
      'bundesland',
      `bundesland muss ${BUNDESLAENDER.map((b) => `„${b}“`).join(
        ' oder '
      )} sein - nur dessen Feiertage kennt die App.`
    )
  }

  // --- feiertage: je Jahr die Liste, gegen die Formel geprüft --------------
  const years = []
  if (
    !isPlainObject(raw.feiertage) ||
    Object.keys(raw.feiertage).length === 0
  ) {
    err(
      'feiertage',
      'feiertage fehlt: je Jahr die gesetzlichen Feiertage (z. B. „2027:“ mit Liste). Ohne Jahr gelten keine Feiertage.'
    )
  } else {
    for (const [key, list] of Object.entries(raw.feiertage)) {
      const p = `feiertage.${key}`
      const year = yearKey(key)
      if (year === null || year < 2000 || year > 2100) {
        err(p, `Ungültiges Jahr „${key}“.`)
        continue
      }
      years.push(year)
      if (!Array.isArray(list)) {
        err(p, 'Je Jahr eine Liste mit { datum, name }.')
        continue
      }
      const expected = holidaysSaarland(year)
      const seen = new Set()
      list.forEach((h, i) => {
        const hp = `${p}[${i}]`
        if (!isPlainObject(h)) {
          err(hp, 'Feiertag als { datum, name }.')
          return
        }
        const date = dateText(h.datum)
        if (!isValidDate(date)) {
          err(`${hp}.datum`, `Ungültiges Datum ${JSON.stringify(h.datum)}.`)
          return
        }
        if (Number(date.slice(0, 4)) !== year) {
          err(`${hp}.datum`, `${date} liegt nicht im Jahr ${year}.`)
          return
        }
        if (seen.has(date)) {
          err(`${hp}.datum`, `${date} steht doppelt.`)
          return
        }
        seen.add(date)
        const hit = expected.find((e) => e.date === date)
        if (!hit) {
          err(
            `${hp}.datum`,
            `${date} ist im Saarland kein gesetzlicher Feiertag. Eigene Schließtage gehören unter tage (typ: geschlossen).`
          )
          return
        }
        if (typeof h.name !== 'string' || !h.name.trim()) {
          err(`${hp}.name`, `Name fehlt (${hit.name}).`)
        } else if (h.name.trim() !== hit.name) {
          warn(
            `${hp}.name`,
            `${date} heißt „${hit.name}“, nicht „${h.name.trim()}“.`
          )
        }
      })
      for (const e of expected) {
        if (!seen.has(e.date)) {
          err(
            p,
            `Gesetzlicher Feiertag ${e.date} (${e.name}) fehlt. Ist der Laden offen, bleibt er hier stehen und kommt unter tage (wie-sonntag oder sonderoeffnung).`
          )
        }
      }
    }
  }

  // --- tage --------------------------------------------------------------
  const singles = new Map()
  const ranges = []
  if (raw.tage !== undefined && raw.tage !== null) {
    if (!Array.isArray(raw.tage)) {
      err('tage', 'tage muss eine Liste sein.')
    } else {
      raw.tage.forEach((t, i) => {
        const p = `tage[${i}]`
        if (!isPlainObject(t)) {
          err(p, 'Eintrag als { datum oder von/bis, typ, notiz }.')
          return
        }
        for (const key of Object.keys(t)) {
          if (!ENTRY_KEYS.has(key))
            warn(
              `${p}.${key}`,
              `Unbekannter Schlüssel „${key}“ wird ignoriert.`
            )
        }
        const hasDatum = t.datum !== undefined
        const hasRange = t.von !== undefined || t.bis !== undefined
        let from = null
        let to = null
        if (hasDatum && hasRange) {
          err(p, 'Entweder datum oder von/bis, nicht beides.')
        } else if (hasDatum) {
          const d = dateText(t.datum)
          if (!isValidDate(d))
            err(`${p}.datum`, `Ungültiges Datum ${JSON.stringify(t.datum)}.`)
          else from = to = d
        } else if (hasRange) {
          const a = dateText(t.von)
          const b = dateText(t.bis)
          if (!isValidDate(a))
            err(`${p}.von`, `Ungültiges Datum ${JSON.stringify(t.von)}.`)
          if (!isValidDate(b))
            err(`${p}.bis`, `Ungültiges Datum ${JSON.stringify(t.bis)}.`)
          if (isValidDate(a) && isValidDate(b)) {
            if (b < a) err(`${p}.bis`, `bis (${b}) liegt vor von (${a}).`)
            else if (daysBetween(a, b) >= MAX_RANGE_DAYS)
              err(p, 'Ein Zeitraum darf höchstens ein Jahr lang sein.')
            else {
              from = a
              to = b
            }
          }
        } else {
          err(p, 'datum oder von/bis fehlt.')
        }

        if (t.wochentage !== undefined) {
          if (
            !Array.isArray(t.wochentage) ||
            t.wochentage.length === 0 ||
            !t.wochentage.every(isWeekday)
          ) {
            err(
              `${p}.wochentage`,
              'wochentage muss eine Liste von Wochentagen 1-7 sein (1 = Montag).'
            )
          } else if (new Set(t.wochentage).size !== t.wochentage.length) {
            err(`${p}.wochentage`, 'Ein Wochentag steht doppelt.')
          } else if (hasDatum) {
            warn(`${p}.wochentage`, 'wochentage wirkt nur bei von/bis.')
          }
        }

        const typ = t.typ
        if (!KALENDER_TYPES.includes(typ)) {
          err(
            `${p}.typ`,
            `typ muss ${KALENDER_TYPES.map((x) => `„${x}“`).join(', ')} sein.`
          )
        }
        if (typ === 'sonderoeffnung') {
          if (!isWeekday(t.wie)) {
            err(
              `${p}.wie`,
              'Sonderöffnung braucht wie: 1-7 - nach welchem Wochentag gebacken wird.'
            )
          } else if (
            cfg &&
            Array.isArray(cfg.days) &&
            !cfg.days.includes(t.wie)
          ) {
            err(
              `${p}.wie`,
              `${WEEKDAY_NAMES[t.wie]} (${
                t.wie
              }) ist kein Produktionstag (days) - dafür gibt es keine Grundmengen.`
            )
          }
        } else if (t.wie !== undefined) {
          err(`${p}.wie`, 'wie gibt es nur bei typ: sonderoeffnung.')
        }
        if (t.offen_bis !== undefined) {
          if (typ !== 'sonderoeffnung' && typ !== 'wie-sonntag') {
            err(
              `${p}.offen_bis`,
              'offen_bis gibt es nur bei sonderoeffnung und wie-sonntag.'
            )
          } else if (
            typeof t.offen_bis !== 'string' ||
            !TIME_RE.test(t.offen_bis)
          ) {
            err(
              `${p}.offen_bis`,
              'offen_bis als Uhrzeit "HH:MM" (in Anführungszeichen).'
            )
          }
        }
        if (typeof t.notiz !== 'string' || !t.notiz.trim()) {
          err(`${p}.notiz`, 'notiz fehlt - sie steht auf dem Zettel.')
        } else if (t.notiz.length > MAX_NOTE_LENGTH) {
          err(`${p}.notiz`, `notiz ist länger als ${MAX_NOTE_LENGTH} Zeichen.`)
        } else if (CONTROL_RE.test(t.notiz)) {
          err(`${p}.notiz`, 'notiz enthält Steuerzeichen.')
        }

        if (from === null) return
        for (const y of new Set([
          Number(from.slice(0, 4)),
          Number(to.slice(0, 4)),
        ])) {
          if (years.length > 0 && !years.includes(y))
            warn(
              p,
              `Jahr ${y} fehlt unter feiertage - die gesetzlichen Feiertage ${y} gelten dann nicht.`
            )
        }
        if (hasDatum) {
          if (singles.has(from)) {
            err(
              `${p}.datum`,
              `${from} steht schon in ${singles.get(
                from
              )} - ein Datum nur einmal mit datum.`
            )
          } else singles.set(from, p)
        } else {
          for (const r of ranges) {
            if (from <= r.to && r.from <= to) {
              warn(
                p,
                `Zeitraum überschneidet sich mit ${r.path} (${r.from} bis ${r.to}) - der spätere Eintrag gewinnt.`
              )
            }
          }
          ranges.push({ from, to, path: p })
        }
        if (
          cfg &&
          typ === 'teigtag' &&
          from === to &&
          Array.isArray(cfg.dough_days) &&
          cfg.dough_days.includes(isoWeekday(from)) &&
          !holidayName(from)
        ) {
          warn(p, `${from} ist ohnehin ein Teigtag (dough_days).`)
        }
      })
    }
  }
  return { ok: errors.length === 0, errors, warnings }
}

/**
 * Bringt einen (geprüften) Kalender in eine feste Form:
 * `{ version, bundesland, years, entries: [{ from, to, weekdays, type, wie,
 * openUntil, note, index }] }`. Idempotent. Ungültige Einträge fallen weg -
 * geprüft wird vorher (`validateKalender`); die API lädt einen ungültigen
 * Kalender gar nicht.
 */
function normalizeKalender(raw) {
  if (raw && raw.__kalender) return raw
  const src = isPlainObject(raw) ? raw : {}
  const years = isPlainObject(src.feiertage)
    ? Object.keys(src.feiertage)
        .map(yearKey)
        .filter((y) => y !== null)
        .sort((a, b) => a - b)
    : []
  const entries = []
  ;(Array.isArray(src.tage) ? src.tage : []).forEach((t, index) => {
    if (!isPlainObject(t) || !KALENDER_TYPES.includes(t.typ)) return
    const from = dateText(t.datum !== undefined ? t.datum : t.von)
    const to = dateText(t.datum !== undefined ? t.datum : t.bis)
    if (!isValidDate(from) || !isValidDate(to) || to < from) return
    if (t.typ === 'sonderoeffnung' && !isWeekday(t.wie)) return
    entries.push({
      from,
      to,
      weekdays:
        t.datum === undefined &&
        Array.isArray(t.wochentage) &&
        t.wochentage.every(isWeekday)
          ? [...t.wochentage]
          : null,
      type: t.typ,
      wie: t.typ === 'sonderoeffnung' ? t.wie : null,
      openUntil:
        typeof t.offen_bis === 'string' && TIME_RE.test(t.offen_bis)
          ? t.offen_bis
          : null,
      note: typeof t.notiz === 'string' ? t.notiz.trim() : '',
      index,
    })
  })
  const out = {
    version: src.version,
    bundesland: BUNDESLAENDER.includes(src.bundesland) ? src.bundesland : null,
    years,
    entries,
  }
  Object.defineProperty(out, '__kalender', { value: true, enumerable: false })
  return out
}

/** Der Kalender an den Stammdaten (`cfg.calendar`), normalisiert, oder `null`. */
const normalizedCache = new WeakMap()

function calendarOf(cfg) {
  const kal = cfg && cfg.calendar
  if (!kal || typeof kal !== 'object') return null
  if (kal.__kalender) return kal
  if (!normalizedCache.has(kal))
    normalizedCache.set(kal, normalizeKalender(kal))
  return normalizedCache.get(kal)
}

// ---------------------------------------------------------------------------
// Was gilt an einem Tag
// ---------------------------------------------------------------------------

function doughDaysOf(cfg) {
  return Array.isArray(cfg.dough_days) ? cfg.dough_days : cfg.days || []
}

/** Der Kalendereintrag für `date` (der spätere gewinnt) oder `null`. */
function entryFor(kal, date) {
  if (!kal) return null
  let hit = null
  for (const e of kal.entries) {
    if (date < e.from || date > e.to) continue
    if (e.weekdays && !e.weekdays.includes(isoWeekday(date))) continue
    if (!hit || e.index > hit.index) hit = e
  }
  return hit
}

/**
 * Der Tag ohne Blick auf die Nachbartage (`before`): Typ, offen, Backtag,
 * Teigtag, nach welchem Wochentag gerechnet wird.
 */
function basicDayKind(cfg, date) {
  const weekday = isoWeekday(date)
  const days = Array.isArray(cfg.days) ? cfg.days : []
  const doughDays = doughDaysOf(cfg)
  const kal = calendarOf(cfg)
  const year = Number(date.slice(0, 4))
  const calendar = !kal
    ? 'missing'
    : kal.years.includes(year)
    ? 'ok'
    : 'year-missing'
  const holiday = calendar === 'ok' ? holidayName(date) : null
  const entry = calendar === 'missing' ? null : entryFor(kal, date)
  const out = {
    date,
    weekday,
    baseWeekday: weekday,
    kind: 'normal',
    open: true,
    bakeDay: true,
    doughDay: false,
    holidayName: holiday,
    note: null,
    openUntil: null,
    calendar,
  }
  const asWeekday = (wd) => {
    out.baseWeekday = wd
    out.bakeDay = days.includes(wd)
    out.open = out.bakeDay
    out.doughDay = out.bakeDay && doughDays.includes(wd)
  }
  if (entry) {
    out.kind = entry.type
    out.note = entry.note || null
    out.openUntil = entry.openUntil
    if (entry.type === 'geschlossen') {
      Object.assign(out, {
        baseWeekday: null,
        open: false,
        bakeDay: false,
        doughDay: false,
      })
    } else if (entry.type === 'teigtag') {
      Object.assign(out, {
        baseWeekday: null,
        open: false,
        bakeDay: false,
        doughDay: true,
      })
    } else if (entry.type === 'wie-sonntag') {
      asWeekday(7)
    } else {
      asWeekday(entry.wie)
    }
    return out
  }
  if (holiday) {
    return Object.assign(out, {
      kind: 'geschlossen',
      baseWeekday: null,
      open: false,
      bakeDay: false,
      doughDay: false,
      note: holiday,
    })
  }
  asWeekday(weekday)
  if (!out.bakeDay) {
    out.kind = 'ruhetag'
    out.baseWeekday = null
  }
  return out
}

/**
 * Tagestyp `before` (abgeleitet, nicht im Kalender): für einen offenen
 * Teigtag, nach dem bis zum nächsten Teigtag mindestens ein geschlossener
 * Tag kommt (`geschlossen`, nicht der normale Ruhetag).
 *   - `samstag_ersatz`: ein Samstag dazwischen ist geschlossen und danach
 *     kommt noch ein offener Backtag (So) - der Tag übernimmt den
 *     Samstagsteig.
 *   - `vor_feiertag`: sonst, wenn gleich der nächste Kalendertag
 *     geschlossen ist.
 * @returns {{ type, closedDays: Array<{date, label}>, nextDoughDay: string|null } | null}
 */
function beforeOf(cfg, info) {
  if (!info.open || !info.doughDay) return null
  const closed = []
  const bakeDays = []
  let nextDoughDay = null
  for (let k = 1; k <= LOOKAHEAD_DAYS; k++) {
    const d = addDays(info.date, k)
    const day = basicDayKind(cfg, d)
    if (day.doughDay) {
      nextDoughDay = d
      break
    }
    if (day.kind === 'geschlossen') closed.push(day)
    else if (day.bakeDay) bakeDays.push(day)
  }
  if (closed.length === 0) return null
  const closedSaturday = closed.find((c) => c.weekday === 6)
  let type = null
  if (closedSaturday && bakeDays.some((b) => b.date > closedSaturday.date)) {
    type = 'samstag_ersatz'
  } else if (closed[0].date === addDays(info.date, 1)) {
    type = 'vor_feiertag'
  }
  if (!type) return null
  return {
    type,
    closedDays: closed.map((c) => ({
      date: c.date,
      weekday: c.weekday,
      holidayName: c.holidayName,
      note: c.note,
      label: `${shortDate(c.date)} ${c.note || 'geschlossen'}`,
    })),
    nextDoughDay,
  }
}

/**
 * Was an `date` gilt, mit dem Kalender an `cfg.calendar` (U9):
 * `{ date, weekday, baseWeekday, kind, open, bakeDay, doughDay, holidayName,
 *    note, openUntil, before, calendar, capWeekday, label, detail }`.
 *
 * - `kind`: `normal` | `ruhetag` (Wochenplan) | `geschlossen` |
 *   `wie-sonntag` | `sonderoeffnung` | `teigtag`.
 * - `baseWeekday`: nach welchem Wochentag Grundmengen und Vorbereitung
 *   gerechnet werden (`null`, wenn nicht gebacken wird).
 * - `capWeekday`: der Wochentag der CAP-Liefervorlage - der echte
 *   Wochentag, an einem gesetzlichen Feiertag `null` (der Markt hat zu).
 * - `before`: `vor_feiertag` / `samstag_ersatz` mit den geschlossenen Tagen.
 * - `calendar`: `ok` | `missing` | `year-missing` (dann gilt der Wochenplan).
 */
function dayKind(cfg, date) {
  const info = basicDayKind(cfg, date)
  const before = beforeOf(cfg, info)
  const capWeekday = info.bakeDay && !info.holidayName ? info.weekday : null
  const out = { ...info, before, capWeekday }
  return { ...out, ...dayKindText(out) }
}

/**
 * Text des Tagestyps für Zettel, Tablet und Druck: `label` (kurz, `null` am
 * normalen Tag) und `detail` (Notiz, Feiertag, geschlossene Tage danach).
 */
function dayKindText(info) {
  const parts = []
  let label = null
  if (info.kind !== 'normal') {
    label = TYPE_LABELS[info.kind] || info.kind
    if (info.kind === 'sonderoeffnung' && info.baseWeekday)
      label = `${label} (wie ${WEEKDAY_NAMES[info.baseWeekday]})`
    if (info.kind === 'teigtag') label = `${label} (Laden geschlossen)`
    if (info.note) parts.push(info.note)
    else if (info.holidayName) parts.push(info.holidayName)
    if (info.openUntil) parts.push(`offen bis ${info.openUntil} Uhr`)
  }
  if (info.before) {
    const b = info.before
    const beforeLabel =
      b.type === 'vor_feiertag' && !b.closedDays.some((c) => c.holidayName)
        ? 'Vor Schließtag'
        : BEFORE_LABELS[b.type]
    label = label ? `${label} · ${beforeLabel}` : beforeLabel
    parts.push(
      `danach geschlossen: ${b.closedDays.map((c) => c.label).join(', ')}`
    )
  }
  return { label, detail: parts.length ? parts.join(' · ') : null }
}

/** Wird an `date` gebacken (Laden offen und Backtag)? */
function isBakeDay(cfg, date) {
  return basicDayKind(cfg, date).bakeDay
}

/** Wird an `date` Teig gemacht (Teigtag; geschlossen nie)? */
function isDoughDay(cfg, date) {
  return basicDayKind(cfg, date).doughDay
}

/** Hat `date` einen Zettel (Backtag oder Teigtag)? */
function isSheetDay(cfg, date) {
  const d = basicDayKind(cfg, date)
  return d.bakeDay || d.doughDay
}

/**
 * Geschlossene Tage (`geschlossen`, nicht der Ruhetag) nach dem Teigtag
 * `date` bis vor den nächsten Teigtag - deren Vorbestellungen meldet der
 * Zettel von `date`. Kein Teigtag → leer.
 */
function closedDaysAfter(cfg, date) {
  if (!basicDayKind(cfg, date).doughDay) return []
  const out = []
  for (let k = 1; k <= LOOKAHEAD_DAYS; k++) {
    const d = addDays(date, k)
    const day = basicDayKind(cfg, d)
    if (day.doughDay) break
    if (day.kind === 'geschlossen') out.push(d)
  }
  return out
}

/**
 * Grund, warum `date` keinen Zettel hat - für 409 und Backliste:
 * `{ code: 'ruhetag' | 'geschlossen', message, note }` oder `null`.
 */
function closedReason(cfg, date) {
  const d = basicDayKind(cfg, date)
  if (d.bakeDay || d.doughDay) return null
  const name = `${WEEKDAY_NAMES[d.weekday]} ${shortDate(date).slice(3)}`
  if (d.kind === 'geschlossen') {
    return {
      code: 'geschlossen',
      note: d.note,
      message: `${name}${
        d.note ? ` ${d.note}` : ''
      } - geschlossen, an diesem Tag gibt es keinen Backzettel.`,
    }
  }
  return {
    code: 'ruhetag',
    note: null,
    message: `${
      WEEKDAY_NAMES[d.weekday]
    } ist Ruhetag - an diesem Tag gibt es keinen Backzettel.`,
  }
}

/**
 * Grundmenge eines Postens an einem Tag (U9): die Spalte des Tagestyps
 * (`base.vor_feiertag` / `base.samstag_ersatz`), wenn der Posten sie hat,
 * sonst die des Wochentags `baseWeekday`.
 * @returns {{ has: boolean, value: any, special: string|null }}
 *   `has` = es gibt einen Eintrag (auch `null` = offen).
 */
function baseFor(item, info) {
  const special = item && item.baseSpecial
  const type = info && info.before ? info.before.type : null
  if (type && special && Object.prototype.hasOwnProperty.call(special, type)) {
    return { has: true, value: special[type], special: type }
  }
  const wd = info ? info.baseWeekday : null
  const base = (item && item.base) || {}
  if (wd === null || !Object.prototype.hasOwnProperty.call(base, wd))
    return { has: false, value: undefined, special: null }
  return { has: true, value: base[wd], special: null }
}

/** Kalendertage zwischen Teigtag und Backtag. */
function leadDays(doughDate, bakeDate) {
  return daysBetween(doughDate, bakeDate)
}

module.exports = {
  KALENDER_TYPES,
  BUNDESLAENDER,
  SPECIAL_BASE_KEYS,
  DOUGH_DAY_FAR_DAYS,
  LOOKAHEAD_DAYS,
  TYPE_LABELS,
  BEFORE_LABELS,
  easterSunday,
  holidaysSaarland,
  holidayName,
  validateKalender,
  normalizeKalender,
  calendarOf,
  entryFor,
  dayKind,
  dayKindText,
  isBakeDay,
  isDoughDay,
  isSheetDay,
  closedDaysAfter,
  closedReason,
  baseFor,
  leadDays,
  shortDate,
  addDays,
}
