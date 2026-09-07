/**
 * Tagesziel-Ampel (TASK-039): Break-even als täglicher Messwert.
 *
 * Bewusst dependency-freies CommonJS (Konvention wie `finance.core.js` und
 * `reports.core.js`): dieselbe Datei benutzen der Mock-Server
 * (`src/routes/targets.mock.js`) und die Tests (`tests/unit/targetsCore.test.js`).
 * Die gesamte Rechnung steht genau hier - nicht im Controller, nicht im
 * Frontend. Wer eine Formel ändert, ändert sie an einer Stelle.
 *
 * Das Modell (klassische Deckungsbeitragsrechnung, Cashflow-Sicht):
 *
 *   variable Kostenquote   = |variable Kosten| / Einnahmen
 *   Deckungsbeitragsquote  = 1 − variable Kostenquote
 *   Break-even (Monat)     = Fixkosten / Deckungsbeitragsquote
 *   Kassenziel (Monat)     = Break-even − erwarteter Umsatz außerhalb der Kasse
 *   Tagesziel (Basis)      = Kassenziel / Geschäftstage im Monat
 *   Ziel je Wochentag      = Tagesziel (Basis) × Wochentagsfaktor
 *
 * Zwei Zielstufen: "Betriebsergebnis ausgeglichen" (Untergrenze) und
 * "inklusive Entnahme" (Fixkosten + Privatentnahme). Die zweite ist eine
 * *Annahme*, solange die Überweisungen aufs Privatkonto im Export als
 * neutraler Geldtransit stehen - `assumed: true` sagt das jedem Aufrufer.
 *
 * Wochentagsfaktoren: Ø Umsatz je Wochentag über ein rollierendes Fenster,
 * normiert auf Mittelwert 1 über die geöffneten Wochentage. Ruhetage
 * (`closed_weekdays`), Tage ohne Bericht und Tage ohne positiven Umsatz
 * (Storno-Tage) fließen nicht ein - ein fehlender Tag ist eine Lücke, kein
 * Umsatz 0.
 *
 * Konfiguration: `hq/data/finance/config/targets.json` (privat). Fehlt sie
 * oder ist sie unplausibel, gibt es **kein Ziel** (`status: 'no-target'`) -
 * nie einen geschätzten Wert. Konkrete Beträge stehen nirgends in diesem
 * Repo; die Tests rechnen mit erfundenen Zahlen.
 *
 * Die Ampel ist rückblickend: die Kassendaten sind Tagesabschlüsse, der
 * frischeste Tag ist im Regelfall gestern. Der laufende Tag und alle Tage
 * danach sind `open`, nie rot.
 */

'use strict'

/** Die einzige Schema-Version der Zielkonfiguration, die dieser Code versteht. */
const TARGETS_SCHEMA_VERSION = 1

const MODES = ['derived', 'manual']

/** Ampelzustände. Die Farbe trägt die Information nie allein - `label` immer mit. */
const STATUSES = ['green', 'amber', 'red', 'open']

const STATUS_LABELS = {
  green: 'Ziel erreicht',
  amber: 'Knapp unter Ziel',
  red: 'Unter Ziel',
  open: 'Offen',
}

/** Gründe, warum ein Tag `open` ist - für ein genaueres Label in der Oberfläche. */
const OPEN_REASONS = {
  today: 'Laufender Tag',
  future: 'Liegt in der Zukunft',
  closed: 'Ruhetag',
  'no-report': 'Kein Bericht',
  'no-days': 'Noch kein Tag bewertet',
  'no-target': 'Kein Ziel',
}

const LEVELS = ['breakeven', 'draw']

const LEVEL_LABELS = {
  breakeven: 'Betriebsergebnis ausgeglichen',
  draw: 'Inklusive Entnahme',
}

/** Unterkategorien der Einnahmen, die über die Kasse laufen (Vorgabe, per Config änderbar). */
const DEFAULT_POS_REVENUE_SUBCATEGORIES = ['bar', 'karte', 'karte_elv']

/** Kategorien, aus denen die Privatentnahme abgeleitet wird, wenn sie nicht konfiguriert ist. */
const DEFAULT_PRIVATE_DRAW_CATEGORIES = ['privat', 'geldtransit']

/** Ab diesem Alter (Monate) gilt die Kostenbasis als veraltet. */
const STALE_AFTER_MONTHS = 6

const WEEKDAY_LABELS_ISO = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
  7: 'Sonntag',
}

const WEEKDAY_SHORT_ISO = {
  1: 'Mo',
  2: 'Di',
  3: 'Mi',
  4: 'Do',
  5: 'Fr',
  6: 'Sa',
  7: 'So',
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

// ============================================================================
// HELFER
// ============================================================================

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function round2(value) {
  return Math.round(value * 100) / 100
}

function round4(value) {
  return Math.round(value * 10000) / 10000
}

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

function isValidMonth(value) {
  return (
    typeof value === 'string' &&
    MONTH_RE.test(value) &&
    isValidDate(`${value}-01`)
  )
}

/** ISO-Wochentag (1 = Montag … 7 = Sonntag) eines `YYYY-MM-DD`, zeitzonenfrei. */
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

function listDates(from, to) {
  const out = []
  if (!isValidDate(from) || !isValidDate(to) || from > to) return out
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

function monthOf(date) {
  return date.slice(0, 7)
}

function monthBounds(month) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, '0')}`,
  }
}

/** Montag der ISO-Woche, in der `date` liegt. */
function isoWeekStart(date) {
  return addDays(date, 1 - isoWeekday(date))
}

/** ISO-Woche als `YYYY-Www`. */
function isoWeek(date) {
  const d = new Date(`${date}T12:00:00Z`)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Heutiges Datum als `YYYY-MM-DD` (lokale Zeit des Servers). */
function todayIso(now) {
  const d = now instanceof Date ? now : new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Ganze Monate zwischen zwei Tagen (abgerundet). */
function monthsBetween(from, to) {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  let months = (ty - fy) * 12 + (tm - fm)
  if (td < fd) months -= 1
  return months
}

// ============================================================================
// KONFIGURATION
// ============================================================================

function stringList(value) {
  if (!Array.isArray(value)) return null
  const out = value.filter((v) => typeof v === 'string' && v.trim() !== '')
  return out.length === value.length ? out : null
}

/**
 * Prüft und normalisiert `targets.json`. Ergebnis ist `{ ok: true, config }`
 * oder `{ ok: false, reason }` - wirft nie. Alles, was hier durchfällt,
 * führt zu "kein Ziel verfügbar", nie zu einem Ersatzwert.
 */
function validateConfig(raw) {
  if (!isPlainObject(raw)) {
    return { ok: false, reason: 'Zielkonfiguration ist kein JSON-Objekt.' }
  }
  if (raw.schema_version !== TARGETS_SCHEMA_VERSION) {
    return {
      ok: false,
      reason:
        `Unbekannte schema_version ${JSON.stringify(raw.schema_version)} ` +
        `(erwartet ${TARGETS_SCHEMA_VERSION}).`,
    }
  }
  if (!MODES.includes(raw.mode)) {
    return {
      ok: false,
      reason: `Unbekannter mode ${JSON.stringify(
        raw.mode
      )} (erwartet derived oder manual).`,
    }
  }
  if (!isValidDate(raw.updated)) {
    return {
      ok: false,
      reason: 'Stand der Kostenbasis (`updated`) fehlt oder ist kein Datum.',
    }
  }
  const businessDays = raw.business_days_per_month
  if (
    !Number.isInteger(businessDays) ||
    businessDays < 1 ||
    businessDays > 31
  ) {
    return {
      ok: false,
      reason:
        '`business_days_per_month` muss eine ganze Zahl zwischen 1 und 31 sein.',
    }
  }
  const windowMonths = raw.weekday_window_months
  if (
    !Number.isInteger(windowMonths) ||
    windowMonths < 1 ||
    windowMonths > 60
  ) {
    return {
      ok: false,
      reason:
        '`weekday_window_months` muss eine ganze Zahl zwischen 1 und 60 sein.',
    }
  }
  const thresholds = raw.thresholds
  if (
    !isPlainObject(thresholds) ||
    !isFiniteNumber(thresholds.green) ||
    !isFiniteNumber(thresholds.amber) ||
    thresholds.amber <= 0 ||
    thresholds.amber > thresholds.green ||
    thresholds.green > 2
  ) {
    return {
      ok: false,
      reason:
        '`thresholds` braucht 0 < amber ≤ green ≤ 2 (Anteil vom Ziel, z. B. 0.9 / 1.0).',
    }
  }
  const closed = Array.isArray(raw.closed_weekdays) ? raw.closed_weekdays : null
  if (
    !closed ||
    closed.some((d) => !Number.isInteger(d) || d < 1 || d > 7) ||
    new Set(closed).size >= 7
  ) {
    return {
      ok: false,
      reason:
        '`closed_weekdays` muss eine Liste von ISO-Wochentagen (1 = Montag … 7 = Sonntag) sein, nicht alle sieben.',
    }
  }

  const optionalAmount = (key) => {
    const v = raw[key]
    if (v === null || v === undefined) return { ok: true, value: null }
    if (!isFiniteNumber(v) || v < 0) {
      return {
        ok: false,
        reason: `\`${key}\` muss null oder eine Zahl ≥ 0 sein.`,
      }
    }
    return { ok: true, value: v }
  }
  const nonPos = optionalAmount('non_pos_revenue_monthly')
  if (!nonPos.ok) return nonPos
  const draw = optionalAmount('private_draw_monthly')
  if (!draw.ok) return draw

  const config = {
    schema_version: TARGETS_SCHEMA_VERSION,
    updated: raw.updated,
    mode: raw.mode,
    business_days_per_month: businessDays,
    weekday_window_months: windowMonths,
    thresholds: { green: thresholds.green, amber: thresholds.amber },
    closed_weekdays: [...new Set(closed)].sort((a, b) => a - b),
    non_pos_revenue_monthly: nonPos.value,
    private_draw_monthly: draw.value,
    fixed_costs_monthly: null,
    variable_cost_ratio: null,
    cost_window_months: null,
    variable_categories: [],
    pos_revenue_subcategories: DEFAULT_POS_REVENUE_SUBCATEGORIES,
    private_draw_categories: DEFAULT_PRIVATE_DRAW_CATEGORIES,
  }

  if (raw.mode === 'manual') {
    if (
      !isFiniteNumber(raw.fixed_costs_monthly) ||
      raw.fixed_costs_monthly <= 0
    ) {
      return {
        ok: false,
        reason: 'mode manual braucht `fixed_costs_monthly` > 0.',
      }
    }
    if (
      !isFiniteNumber(raw.variable_cost_ratio) ||
      raw.variable_cost_ratio < 0 ||
      raw.variable_cost_ratio >= 1
    ) {
      return {
        ok: false,
        reason:
          'mode manual braucht `variable_cost_ratio` zwischen 0 und 1 (ausschließlich).',
      }
    }
    config.fixed_costs_monthly = raw.fixed_costs_monthly
    config.variable_cost_ratio = raw.variable_cost_ratio
  } else {
    const costWindow = raw.cost_window_months
    if (!Number.isInteger(costWindow) || costWindow < 1 || costWindow > 60) {
      return {
        ok: false,
        reason:
          'mode derived braucht `cost_window_months` (ganze Zahl zwischen 1 und 60).',
      }
    }
    const variable = stringList(raw.variable_categories)
    if (!variable) {
      return {
        ok: false,
        reason:
          'mode derived braucht `variable_categories` (Liste von Kategorie-Slugs).',
      }
    }
    config.cost_window_months = costWindow
    config.variable_categories = [...new Set(variable)]
  }

  if (raw.pos_revenue_subcategories !== undefined) {
    const list = stringList(raw.pos_revenue_subcategories)
    if (!list) {
      return {
        ok: false,
        reason: '`pos_revenue_subcategories` muss eine Liste von Slugs sein.',
      }
    }
    config.pos_revenue_subcategories = list
  }
  if (raw.private_draw_categories !== undefined) {
    const list = stringList(raw.private_draw_categories)
    if (!list) {
      return {
        ok: false,
        reason: '`private_draw_categories` muss eine Liste von Slugs sein.',
      }
    }
    config.private_draw_categories = list
  }

  return { ok: true, config }
}

/**
 * Parst den Dateiinhalt und prüft ihn. `{ status: 'ok', config }` oder
 * `{ status: 'no-target', reason }` - wirft nie.
 */
function parseConfig(text) {
  let raw
  try {
    raw = JSON.parse(String(text))
  } catch (err) {
    return {
      status: 'no-target',
      reason: `Zielkonfiguration nicht lesbar: ${err.message}`,
    }
  }
  const check = validateConfig(raw)
  if (!check.ok) return { status: 'no-target', reason: check.reason }
  return { status: 'ok', config: check.config }
}

/**
 * Alter der Kostenbasis in ganzen Monaten und ob sie als veraltet gilt
 * (`> STALE_AFTER_MONTHS`). Für die Kopfzeile der Seite.
 */
function configAge(config, today) {
  const ref = isValidDate(today) ? today : todayIso()
  const months = Math.max(0, monthsBetween(config.updated, ref))
  return {
    updated: config.updated,
    age_months: months,
    stale: months > STALE_AFTER_MONTHS,
  }
}

// ============================================================================
// KOSTENBASIS
// ============================================================================

function bucketNet(bucket) {
  if (!isPlainObject(bucket)) return 0
  const amount = Number(bucket.amount)
  if (Number.isFinite(amount)) return amount
  const income = Number(bucket.income) || 0
  const expense = Number(bucket.expense) || 0
  return income + expense
}

/** Die letzten `count` Monate der Zusammenfassung, aufsteigend sortiert. */
function lastMonths(summary, count) {
  const months = (
    Array.isArray(summary && summary.months) ? summary.months : []
  )
    .filter((m) => isPlainObject(m) && isValidMonth(String(m.month)))
    .sort((a, b) => String(a.month).localeCompare(String(b.month)))
  return months.slice(Math.max(0, months.length - count))
}

/**
 * Kostenbasis für die Zielrechnung.
 *
 * `mode: 'manual'` nimmt Fixkosten und Kostenquote aus der Config und liest
 * die Zusammenfassung **nicht** - die Ableitung ist damit vollständig
 * überschrieben. `mode: 'derived'` bildet über die letzten
 * `cost_window_months` Monate von `finance-summary.json` Monatsmittel:
 *
 *   Fixkosten          = |Netto aller Kategorien vom Typ ausgabe/offen, die
 *                        nicht in variable_categories stehen|
 *   variable Kosten    = |Netto der variable_categories|
 *   Einnahmen          = Zufluss aller Kategorien vom Typ einnahme
 *   Kassenumsatz       = Summe der Unterkategorien aus pos_revenue_subcategories
 *   Umsatz außer Kasse = Einnahmen − Kassenumsatz (wenn unterscheidbar)
 *   Privatentnahme     = Netto-Abfluss der private_draw_categories (Annahme)
 *
 * Netto statt reinem Abfluss, damit Rückerstattungen innerhalb einer
 * Kategorie die Kosten mindern. Liefert `{ status: 'ok', ... }` oder
 * `{ status: 'no-target', reason }`; unplausible Zahlen (keine Fixkosten,
 * Kostenquote ≥ 1) sind "kein Ziel", nie ein Ersatzwert.
 */
function computeCostBase(summary, config) {
  if (!isPlainObject(config)) {
    return { status: 'no-target', reason: 'Keine Zielkonfiguration.' }
  }
  const assumptions = []

  if (config.mode === 'manual') {
    const nonPos = config.non_pos_revenue_monthly
    const draw = config.private_draw_monthly
    if (nonPos === null) {
      assumptions.push(
        'Umsatz außerhalb der Kasse ist im manuellen Modus nicht konfiguriert und wird mit 0 angesetzt.'
      )
    }
    if (draw === null) {
      assumptions.push(
        'Privatentnahme ist im manuellen Modus nicht konfiguriert; die zweite Zielstufe entspricht der ersten.'
      )
    }
    return {
      status: 'ok',
      mode: 'manual',
      window: { from: null, to: null, months: 0 },
      fixed_costs_monthly: round2(config.fixed_costs_monthly),
      variable_cost_ratio: round4(config.variable_cost_ratio),
      contribution_ratio: round4(1 - config.variable_cost_ratio),
      revenue_monthly: null,
      variable_costs_monthly: null,
      pos_revenue_monthly: null,
      non_pos_revenue_monthly: nonPos === null ? 0 : round2(nonPos),
      non_pos_source: nonPos === null ? 'none' : 'config',
      private_draw_monthly: draw === null ? 0 : round2(draw),
      private_draw_source: draw === null ? 'none' : 'config',
      assumptions,
    }
  }

  const months = lastMonths(summary, config.cost_window_months)
  if (months.length === 0) {
    return {
      status: 'no-target',
      reason: 'Keine Monate in den Finanzdaten - Kostenbasis nicht ableitbar.',
    }
  }
  const kinds = isPlainObject(summary.category_kinds)
    ? summary.category_kinds
    : {}
  const variableSet = new Set(config.variable_categories)
  const posSubs = new Set(config.pos_revenue_subcategories)
  const drawSet = new Set(config.private_draw_categories)

  let fixed = 0
  let variable = 0
  let revenue = 0
  let posRevenue = 0
  let posSeen = false
  let draw = 0
  let drawSeen = false

  for (const m of months) {
    const categories = isPlainObject(m.categories) ? m.categories : {}
    for (const [slug, bucket] of Object.entries(categories)) {
      const kind = kinds[slug]
      const net = bucketNet(bucket)
      if (kind === 'einnahme') {
        revenue += Number(bucket && bucket.income) || 0
        const subs = isPlainObject(bucket && bucket.subcategories)
          ? bucket.subcategories
          : {}
        for (const [sub, value] of Object.entries(subs)) {
          if (!posSubs.has(sub)) continue
          const n = Number(value)
          if (!Number.isFinite(n)) continue
          posSeen = true
          posRevenue += n
        }
      } else if (kind === 'ausgabe' || kind === 'offen') {
        if (variableSet.has(slug)) variable += -net
        else fixed += -net
      }
      if (drawSet.has(slug)) {
        drawSeen = true
        if (net < 0) draw += -net
      }
    }
  }

  const n = months.length
  const fixedMonthly = fixed / n
  const variableMonthly = variable / n
  const revenueMonthly = revenue / n

  if (!(revenueMonthly > 0)) {
    return {
      status: 'no-target',
      reason:
        'Keine Einnahmen im Kostenfenster - Kostenquote nicht berechenbar.',
    }
  }
  if (!(fixedMonthly > 0)) {
    return {
      status: 'no-target',
      reason:
        'Keine Fixkosten im Kostenfenster - das ist unplausibel, kein Ziel.',
    }
  }
  const ratio = variableMonthly / revenueMonthly
  if (!(ratio >= 0) || ratio >= 1) {
    return {
      status: 'no-target',
      reason: `Variable Kostenquote ${round4(
        ratio
      )} liegt außerhalb von 0..1 - kein Ziel.`,
    }
  }

  if (n < config.cost_window_months) {
    assumptions.push(
      `Kostenfenster umfasst nur ${n} von ${config.cost_window_months} Monaten.`
    )
  }
  if (config.variable_categories.some((slug) => kinds[slug] === undefined)) {
    assumptions.push(
      'Mindestens eine variable Kategorie kommt in den Finanzdaten nicht vor.'
    )
  }

  let nonPosMonthly
  let nonPosSource
  if (config.non_pos_revenue_monthly !== null) {
    nonPosMonthly = config.non_pos_revenue_monthly
    nonPosSource = 'config'
  } else if (posSeen) {
    nonPosMonthly = Math.max(0, (revenue - posRevenue) / n)
    nonPosSource = 'subcategories'
    assumptions.push(
      'Umsatz außerhalb der Kasse ist aus den Unterkategorien der Einnahmen abgeleitet (Einnahmen minus Bar- und Kartenumsätze).'
    )
  } else {
    nonPosMonthly = 0
    nonPosSource = 'none'
    assumptions.push(
      'Kassen- und Rechnungsumsatz sind in den Finanzdaten nicht unterscheidbar; Umsatz außerhalb der Kasse wird mit 0 angesetzt.'
    )
  }

  let drawMonthly
  let drawSource
  if (config.private_draw_monthly !== null) {
    drawMonthly = config.private_draw_monthly
    drawSource = 'config'
  } else if (drawSeen) {
    drawMonthly = draw / n
    drawSource = 'derived'
    assumptions.push(
      'Privatentnahme ist aus den neutralen Kategorien (Privat, Geldtransit) abgeleitet - ob das Entnahmen oder Eigenkonto-Umbuchungen sind, ist fachlich nicht geklärt.'
    )
  } else {
    drawMonthly = 0
    drawSource = 'none'
    assumptions.push(
      'Keine Privatentnahme ableitbar; die zweite Zielstufe entspricht der ersten.'
    )
  }

  return {
    status: 'ok',
    mode: 'derived',
    window: {
      from: String(months[0].month),
      to: String(months[n - 1].month),
      months: n,
    },
    fixed_costs_monthly: round2(fixedMonthly),
    variable_costs_monthly: round2(variableMonthly),
    revenue_monthly: round2(revenueMonthly),
    pos_revenue_monthly: posSeen ? round2(posRevenue / n) : null,
    variable_cost_ratio: round4(ratio),
    contribution_ratio: round4(1 - ratio),
    non_pos_revenue_monthly: round2(nonPosMonthly),
    non_pos_source: nonPosSource,
    private_draw_monthly: round2(drawMonthly),
    private_draw_source: drawSource,
    assumptions,
  }
}

// ============================================================================
// WOCHENTAGSFAKTOREN
// ============================================================================

/** Ein Tageseintrag (`{ date, status, revenue }`) mit auswertbarem Umsatz? */
function dayRevenue(entry) {
  if (!isPlainObject(entry) || !isValidDate(entry.date)) return null
  if (entry.status !== undefined && entry.status !== 'ok') return null
  const revenue = Number(entry.revenue)
  return Number.isFinite(revenue) ? revenue : null
}

/**
 * Wochentagsfaktoren aus den Tagesumsätzen.
 *
 *   Faktor(Wochentag) = Ø Umsatz(Wochentag) / Mittel der Wochentagsmittel
 *
 * Fenster: die letzten `weekday_window_months` Monate bis `asOf` (Vorgabe:
 * jüngster Tag mit Bericht). Es zählen nur Tage mit Bericht (`status: 'ok'`),
 * die nicht auf einen Ruhetag fallen und deren Umsatz > 0 ist - ein Tag, der
 * nur aus Stornos besteht, ist kein Geschäftstag. Betriebsferien und
 * Feiertage haben keinen Bericht und fallen damit von selbst heraus.
 *
 * Normierung: der (ungewichtete) Mittelwert der Faktoren über alle
 * geöffneten Wochentage mit Daten ist 1. So ergibt Basis × Faktor über eine
 * Woche mit je einem Exemplar jedes Wochentags genau Basis × Anzahl
 * Geschäftstage.
 */
function computeWeekdayFactors(days, config, options = {}) {
  if (!isPlainObject(config)) {
    return { status: 'no-target', reason: 'Keine Zielkonfiguration.' }
  }
  const closed = new Set(config.closed_weekdays || [])
  const list = Array.isArray(days) ? days : []
  const usable = list
    .map((entry) => ({ date: entry && entry.date, revenue: dayRevenue(entry) }))
    .filter((d) => d.revenue !== null)
    .sort((a, b) => a.date.localeCompare(b.date))

  const asOf = isValidDate(options.asOf)
    ? options.asOf
    : usable.length
    ? usable[usable.length - 1].date
    : null
  if (!asOf) {
    return {
      status: 'no-target',
      reason: 'Keine Kassenberichte - Wochentagsfaktoren nicht berechenbar.',
    }
  }
  const from = addDays(addMonths(asOf, -config.weekday_window_months), 1)

  const sums = {}
  const counts = {}
  let used = 0
  for (const d of usable) {
    if (d.date < from || d.date > asOf) continue
    const iso = isoWeekday(d.date)
    if (closed.has(iso)) continue
    if (!(d.revenue > 0)) continue
    sums[iso] = (sums[iso] || 0) + d.revenue
    counts[iso] = (counts[iso] || 0) + 1
    used += 1
  }

  const averages = {}
  for (const iso of Object.keys(sums)) {
    averages[iso] = sums[iso] / counts[iso]
  }
  const withData = Object.keys(averages)
  if (withData.length === 0) {
    return {
      status: 'no-target',
      reason: 'Kein Geschäftstag mit Umsatz im Fenster der Wochentagsfaktoren.',
    }
  }
  const meanOfAverages =
    withData.reduce((sum, iso) => sum + averages[iso], 0) / withData.length

  const weekdays = []
  for (let iso = 1; iso <= 7; iso++) {
    const isClosed = closed.has(iso)
    const samples = counts[iso] || 0
    weekdays.push({
      iso,
      label: WEEKDAY_LABELS_ISO[iso],
      short: WEEKDAY_SHORT_ISO[iso],
      closed: isClosed,
      samples,
      average_revenue: samples > 0 ? round2(averages[iso]) : null,
      factor:
        !isClosed && samples > 0
          ? round4(averages[iso] / meanOfAverages)
          : null,
    })
  }

  return {
    status: 'ok',
    window: { from, to: asOf, months: config.weekday_window_months },
    days_used: used,
    mean_average_revenue: round2(meanOfAverages),
    weekdays,
  }
}

// ============================================================================
// ZIELWERTE
// ============================================================================

/**
 * Eine Zielstufe. Neben dem Ziel je Wochentag liefert sie die Abweichung
 * `Ø Ist − Ziel` je Wochentag und **einmal** das Verhältnis `Ø Ist / Ziel`
 * (`average_ratio`): weil Ziel = Basis × Faktor und Faktor = Ø Ist /
 * Mittel der Wochentagsmittel, ist dieses Verhältnis an jedem Wochentag
 * dasselbe (Mittel der Wochentagsmittel / Basis) - es beschreibt, wie weit
 * das Haus im Faktorfenster insgesamt über oder unter dem Ziel lag, nicht
 * einen einzelnen Wochentag. Es steht deshalb an der Stufe, nicht an der
 * Zeile.
 */
function levelTargets(fixed, costBase, factors, config, extra) {
  const breakeven = fixed / costBase.contribution_ratio
  const posTarget = Math.max(0, breakeven - costBase.non_pos_revenue_monthly)
  const dailyBase = posTarget / config.business_days_per_month
  const meanAverage = isFiniteNumber(factors.mean_average_revenue)
    ? factors.mean_average_revenue
    : null
  return {
    ...extra,
    fixed_costs_monthly: round2(fixed),
    breakeven_monthly: round2(breakeven),
    pos_target_monthly: round2(posTarget),
    daily_base: round2(dailyBase),
    average_ratio:
      meanAverage !== null && dailyBase > 0
        ? round4(meanAverage / dailyBase)
        : null,
    weekdays: factors.weekdays.map((w) => {
      const target = w.factor === null ? null : round2(dailyBase * w.factor)
      return {
        iso: w.iso,
        label: w.label,
        short: w.short,
        closed: w.closed,
        factor: w.factor,
        target,
        average_revenue: w.average_revenue,
        deviation:
          target === null || w.average_revenue === null
            ? null
            : round2(w.average_revenue - target),
        samples: w.samples,
      }
    }),
  }
}

/**
 * Beide Zielstufen mit Tagesziel je Wochentag.
 *
 *   Break-even (Monat) = Fixkosten / Deckungsbeitragsquote
 *   Kassenziel (Monat) = Break-even − Umsatz außerhalb der Kasse (≥ 0)
 *   Tagesziel (Basis)  = Kassenziel / Geschäftstage im Monat
 *   Ziel je Wochentag  = Basis × Faktor
 *
 * Stufe `draw` rechnet die Privatentnahme zu den Fixkosten; `assumed` ist
 * dort `true`, solange die Entnahme nicht konfiguriert, sondern abgeleitet
 * (oder gar nicht bekannt) ist.
 */
function computeTargets(costBase, factors, config) {
  if (!isPlainObject(costBase) || costBase.status !== 'ok') {
    return {
      status: 'no-target',
      reason: (costBase && costBase.reason) || 'Keine Kostenbasis.',
    }
  }
  if (!isPlainObject(factors) || factors.status !== 'ok') {
    return {
      status: 'no-target',
      reason: (factors && factors.reason) || 'Keine Wochentagsfaktoren.',
    }
  }
  if (!isPlainObject(config)) {
    return { status: 'no-target', reason: 'Keine Zielkonfiguration.' }
  }
  const fixed = costBase.fixed_costs_monthly
  const draw = costBase.private_draw_monthly || 0
  return {
    status: 'ok',
    levels: {
      breakeven: levelTargets(fixed, costBase, factors, config, {
        key: 'breakeven',
        label: LEVEL_LABELS.breakeven,
        assumed: false,
      }),
      draw: levelTargets(fixed + draw, costBase, factors, config, {
        key: 'draw',
        label: LEVEL_LABELS.draw,
        assumed: costBase.private_draw_source !== 'config',
        private_draw_monthly: round2(draw),
        private_draw_source: costBase.private_draw_source,
      }),
    },
  }
}

/** Tagesziel einer Stufe für ein Datum (`null` an Ruhetagen und ohne Faktor). */
function targetForDate(level, date) {
  if (!isPlainObject(level) || !Array.isArray(level.weekdays)) return null
  const entry = level.weekdays[isoWeekday(date) - 1]
  return entry && entry.target !== null ? entry.target : null
}

// ============================================================================
// AMPEL
// ============================================================================

/**
 * Ampel für einen Wert gegen ein Ziel:
 *   grün  ≥ thresholds.green × Ziel
 *   gelb  ≥ thresholds.amber × Ziel
 *   rot   sonst
 *   offen ohne Ist-Wert oder ohne Ziel
 * Liefert immer Zahl **und** Textlabel - die Farbe trägt die Information nie allein.
 */
function evaluateDay(actual, target, thresholds, openReason) {
  const t = isPlainObject(thresholds) ? thresholds : { green: 1, amber: 0.9 }
  const open = (reason) => ({
    status: 'open',
    label: OPEN_REASONS[reason] || STATUS_LABELS.open,
    reason,
    actual: isFiniteNumber(actual) ? round2(actual) : null,
    target: isFiniteNumber(target) ? round2(target) : null,
    ratio: null,
    diff: null,
  })
  if (!isFiniteNumber(target)) return open(openReason || 'no-target')
  if (!isFiniteNumber(actual)) return open(openReason || 'no-report')
  if (target <= 0) {
    return {
      status: 'green',
      label: STATUS_LABELS.green,
      reason: null,
      actual: round2(actual),
      target: round2(target),
      ratio: null,
      diff: round2(actual - target),
    }
  }
  const ratio = actual / target
  const status = ratio >= t.green ? 'green' : ratio >= t.amber ? 'amber' : 'red'
  return {
    status,
    label: STATUS_LABELS[status],
    reason: null,
    actual: round2(actual),
    target: round2(target),
    ratio: round4(ratio),
    diff: round2(actual - target),
  }
}

/**
 * Warum ein Tag ohne Ist-Wert offen ist: laufender Tag, Zukunft, Ruhetag oder
 * ein vergangener Tag ohne Bericht (Ferien, Feiertag, fehlender Export -
 * ohne Öffnungskalender nicht unterscheidbar, deshalb "kein Bericht").
 */
function openReasonFor(date, today, config) {
  if (date > today) return 'future'
  if (date === today) return 'today'
  const closed = new Set((config && config.closed_weekdays) || [])
  if (closed.has(isoWeekday(date))) return 'closed'
  return 'no-report'
}

// ============================================================================
// ZEITRÄUME
// ============================================================================

function indexDays(days) {
  const byDate = new Map()
  for (const entry of Array.isArray(days) ? days : []) {
    const revenue = dayRevenue(entry)
    if (revenue !== null) byDate.set(entry.date, revenue)
  }
  return byDate
}

/**
 * Jüngster Tag mit Bericht in `days`, oder `null`. Mit `before` (Vorgabe:
 * heute) zählt nur, was vor diesem Tag liegt - ein Bericht für den laufenden
 * Tag ist noch kein ausgewerteter Tag.
 */
function latestEvaluatedDate(days, before) {
  const limit = isValidDate(before) ? before : todayIso()
  let latest = null
  for (const date of indexDays(days).keys()) {
    if (date >= limit) continue
    if (latest === null || date > latest) latest = date
  }
  return latest
}

function evaluateDate(date, byDate, targets, config, today) {
  const actual = byDate.has(date) ? byDate.get(date) : null
  // Laufender Tag und Zukunft sind immer offen - auch wenn (etwa durch einen
  // frühen Export) schon ein Bericht da wäre, wird nicht bewertet.
  const pending = date >= today
  const reason =
    pending || actual === null ? openReasonFor(date, today, config) : null
  const levels = {}
  for (const key of LEVELS) {
    const level = targets && targets.levels ? targets.levels[key] : null
    const target = level ? targetForDate(level, date) : null
    levels[key] = evaluateDay(
      pending ? null : actual,
      target,
      config.thresholds,
      reason
    )
  }
  return {
    date,
    iso: isoWeekday(date),
    weekday: WEEKDAY_LABELS_ISO[isoWeekday(date)],
    short: WEEKDAY_SHORT_ISO[isoWeekday(date)],
    has_report: actual !== null,
    actual: actual === null ? null : round2(actual),
    levels,
  }
}

function sumLevel(entries, key) {
  let actual = 0
  let target = 0
  let counted = 0
  for (const day of entries) {
    const ev = day.levels[key]
    if (ev.status === 'open') continue
    actual += ev.actual
    target += ev.target
    counted += 1
  }
  return { actual, target, counted }
}

/**
 * Tagesreihe `from..to` mit Ampel je Tag und Summen je Zielstufe. Gezählt
 * werden nur bewertete Tage (mit Bericht und Ziel): ein Tag ohne Bericht ist
 * eine Lücke und drückt weder Ist noch Ziel. Das Ziel bis heute ist deshalb
 * die Summe der Tagesziele der bewerteten Tage - kein Kalender-Soll.
 *
 * `options.today` (Vorgabe: Serverdatum) trennt bewertbare Tage von offenen.
 */
function aggregatePeriod(from, to, days, targets, config, options = {}) {
  const today = isValidDate(options.today) ? options.today : todayIso()
  if (!isValidDate(from) || !isValidDate(to) || from > to) {
    return { status: 'invalid', reason: 'Ungültiger Zeitraum.' }
  }
  const byDate = indexDays(days)
  const entries = listDates(from, to).map((date) =>
    evaluateDate(date, byDate, targets, config, today)
  )
  const thresholds = config && config.thresholds
  const levels = {}
  for (const key of LEVELS) {
    const sums = sumLevel(entries, key)
    const ev =
      sums.counted > 0
        ? evaluateDay(sums.actual, sums.target, thresholds)
        : evaluateDay(null, null, thresholds, 'no-days')
    levels[key] = { ...ev, days_counted: sums.counted }
  }
  const evaluated = entries.filter((d) => d.has_report && d.date < today)
  return {
    status: 'ok',
    from,
    to,
    today,
    last_evaluated_date: evaluated.length
      ? evaluated[evaluated.length - 1].date
      : null,
    days: entries,
    levels,
  }
}

/**
 * Woche (Mo–So) und Monat des Bezugstags `date` bis einschließlich `date`,
 * plus Hochrechnung des Monats auf Monatsende:
 *
 *   Restziel        = Σ Tagesziel der Tage nach `date` bis Monatsende,
 *                     ohne Ruhetage
 *   Monatsziel      = Ziel bis heute + Restziel
 *   Hochrechnung    = Ist bis heute × Monatsziel / Ziel bis heute
 *                     (der bisherige Zielerreichungsgrad wird über die
 *                     Wochentagsfaktoren auf den Rest des Monats übertragen)
 *
 * Vergangene Tage ohne Bericht (Ferien, Feiertage) bleiben außen vor - sie
 * wurden nicht bewertet und werden auch nicht nachträglich als Soll gezählt.
 */
function aggregateToDate(date, days, targets, config, options = {}) {
  const today = isValidDate(options.today) ? options.today : todayIso()
  if (!isValidDate(date)) {
    return { status: 'invalid', reason: 'Ungültiges Datum.' }
  }
  const weekFrom = isoWeekStart(date)
  const week = aggregatePeriod(weekFrom, date, days, targets, config, { today })
  const month = monthOf(date)
  const bounds = monthBounds(month)
  const monthToDate = aggregatePeriod(
    bounds.from,
    date,
    days,
    targets,
    config,
    {
      today,
    }
  )

  const projection = {}
  const remainingDates = listDates(addDays(date, 1), bounds.to)
  const closed = new Set((config && config.closed_weekdays) || [])
  for (const key of LEVELS) {
    const level = targets && targets.levels ? targets.levels[key] : null
    let remainingTarget = 0
    let remainingDays = 0
    for (const d of remainingDates) {
      if (closed.has(isoWeekday(d))) continue
      const t = level ? targetForDate(level, d) : null
      if (t === null) continue
      remainingTarget += t
      remainingDays += 1
    }
    const toDate = monthToDate.levels[key]
    const monthTarget =
      toDate.target === null ? null : round2(toDate.target + remainingTarget)
    let projected = null
    if (toDate.status !== 'open' && toDate.target > 0) {
      projected = round2((toDate.actual * monthTarget) / toDate.target)
    } else if (toDate.status !== 'open') {
      projected = round2(toDate.actual + remainingTarget)
    }
    const ev =
      projected === null
        ? evaluateDay(null, monthTarget, config.thresholds, 'no-days')
        : evaluateDay(projected, monthTarget, config.thresholds)
    projection[key] = {
      ...ev,
      remaining_days: remainingDays,
      remaining_target: round2(remainingTarget),
      month_target: monthTarget,
      projected_actual: projected,
    }
  }

  return {
    status: 'ok',
    date,
    today,
    week: { ...week, iso_week: isoWeek(date) },
    month: { ...monthToDate, month, month_end: bounds.to, projection },
  }
}

// ============================================================================
// ALLES IN EINEM
// ============================================================================

/**
 * Zielwerte, Faktoren und Stand für `GET /api/finance/targets`.
 * `days` sind Tageseinträge (`{ date, status, revenue }`) aus den
 * Kassenberichten; `summary` die bereinigte Finanz-Zusammenfassung (bei
 * `mode: 'manual'` darf sie fehlen).
 */
function buildTargets(summary, config, days, options = {}) {
  const today = isValidDate(options.today) ? options.today : todayIso()
  const lastEvaluated = latestEvaluatedDate(days, today)
  const asOf = lastEvaluated || addDays(today, -1)
  const costBase = computeCostBase(summary, config)
  const factors = computeWeekdayFactors(days, config, { asOf })
  const targets = computeTargets(costBase, factors, config)
  const base = {
    today,
    last_evaluated_date: lastEvaluated,
    config: {
      mode: config.mode,
      ...configAge(config, today),
      stale_after_months: STALE_AFTER_MONTHS,
      business_days_per_month: config.business_days_per_month,
      weekday_window_months: config.weekday_window_months,
      cost_window_months: config.cost_window_months,
      thresholds: config.thresholds,
      closed_weekdays: config.closed_weekdays,
      variable_categories: config.variable_categories,
    },
    cost_base: costBase,
    factors,
  }
  if (targets.status !== 'ok') {
    return { status: 'no-target', reason: targets.reason, ...base }
  }
  return { status: 'ok', ...base, levels: targets.levels }
}

module.exports = {
  TARGETS_SCHEMA_VERSION,
  MODES,
  STATUSES,
  STATUS_LABELS,
  OPEN_REASONS,
  LEVELS,
  LEVEL_LABELS,
  STALE_AFTER_MONTHS,
  DEFAULT_POS_REVENUE_SUBCATEGORIES,
  DEFAULT_PRIVATE_DRAW_CATEGORIES,
  WEEKDAY_LABELS_ISO,
  WEEKDAY_SHORT_ISO,
  isValidDate,
  isValidMonth,
  isoWeekday,
  isoWeek,
  isoWeekStart,
  addDays,
  addMonths,
  listDates,
  monthBounds,
  todayIso,
  monthsBetween,
  validateConfig,
  parseConfig,
  configAge,
  computeCostBase,
  computeWeekdayFactors,
  computeTargets,
  targetForDate,
  evaluateDay,
  openReasonFor,
  latestEvaluatedDate,
  aggregatePeriod,
  aggregateToDate,
  buildTargets,
}
