/**
 * Rechen- und Bereinigungslogik für die Finanzdaten aus
 * `hq/data/finance/finance-summary.json`.
 *
 * Bewusst dependency-freies CommonJS (Konvention wie `partner-stats.core.js`):
 * dieselbe Datei benutzen der Mock-Server (`src/routes/finance.mock.js`), der
 * Loader der Management-App (`apps/bakery-management/src/lib/finance.ts`) und
 * die Tests (`tests/unit/financeCore.test.js`). Es gibt damit genau *eine*
 * Implementierung - vor allem des Sanitizers, denn der entscheidet, was das
 * private `hq`-Repo verlassen darf.
 *
 * Datenschutz: `accounts` sind IBANs, `top_counterparties` Klarnamen (darunter
 * Beschäftigte), `uncategorized.transactions` Einzelbuchungen mit Empfänger und
 * Verwendungszweck. Nichts davon darf einen Server verlassen. Der Sanitizer
 * arbeitet deshalb als **Whitelist**: nur Felder, die hier ausdrücklich
 * aufgeführt sind, kommen durch - ein neues Feld im Export ist so lange
 * unsichtbar, bis jemand es bewusst freigibt.
 *
 * Rechenregeln (aus `hq/data/finance/README.md`):
 *   - Beträge sind Euro als `number`, Abflüsse negativ. Vorzeichen werden
 *     nirgends gedreht.
 *   - `category_kinds` bestimmt den Topf: einnahme | ausgabe | neutral | offen.
 *     "offen" (nicht zugeordnet) zählt im Export zu den Ausgaben.
 *   - Invariante je Monat:  Einnahmen + Ausgaben + Neutral = Kontoveränderung
 *     (`operating_income + operating_expense + neutral = net_change`) und
 *     `operating_income + operating_expense = operating_result`.
 */

'use strict'

/** Die einzige Schema-Version, die dieser Code versteht. */
const FINANCE_SCHEMA_VERSION = 1

/** Toleranz beim Vergleich gerundeter Euro-Beträge (halber Cent). */
const CENT_TOLERANCE = 0.005

const KINDS = ['einnahme', 'ausgabe', 'neutral', 'offen']

const KIND_LABELS = {
  einnahme: 'Einnahmen',
  ausgabe: 'Ausgaben',
  neutral: 'Neutral',
  offen: 'Nicht zugeordnet',
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function round2(value) {
  return Math.round(value * 100) / 100
}

/** `Record<string, string>` ohne Fremdes - nur String-Werte kommen durch. */
function copyStringMap(source) {
  const out = {}
  if (!isPlainObject(source)) return out
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

/** Summenblock einer Kategorie: `{ amount, count, income, expense }`. */
function copyBucket(source) {
  const src = isPlainObject(source) ? source : {}
  return {
    amount: toNumber(src.amount),
    count: toNumber(src.count),
    income: toNumber(src.income),
    expense: toNumber(src.expense),
  }
}

function copyNumberMap(source) {
  const out = {}
  if (!isPlainObject(source)) return out
  for (const [key, value] of Object.entries(source)) {
    out[key] = toNumber(value)
  }
  return out
}

// ============================================================================
// SCHEMA
// ============================================================================

/**
 * Prüft, ob `raw` ein `finance-summary.json` in der erwarteten Schema-Version
 * ist. Liefert `{ ok: true }` oder `{ ok: false, reason }` - wirft nie.
 */
function validateSummary(raw) {
  if (!isPlainObject(raw)) {
    return { ok: false, reason: 'Finanzdaten sind kein JSON-Objekt' }
  }
  if (raw.schema_version !== FINANCE_SCHEMA_VERSION) {
    return {
      ok: false,
      reason:
        `Unbekannte schema_version ${JSON.stringify(raw.schema_version)} ` +
        `(erwartet ${FINANCE_SCHEMA_VERSION})`,
    }
  }
  if (!Array.isArray(raw.months)) {
    return { ok: false, reason: 'Finanzdaten ohne Monatsreihe (`months`)' }
  }
  return { ok: true }
}

/**
 * Parst den Dateiinhalt und prüft das Schema. Ergebnis ist entweder
 * `{ status: 'ok', summary }` mit der **bereinigten** Zusammenfassung oder
 * `{ status: 'no-data', reason }`. Wirft nie - ein kaputter Export ist "keine
 * Daten", nicht ein abgestürzter Server.
 */
function parseSummary(text) {
  let raw
  try {
    raw = JSON.parse(String(text))
  } catch (err) {
    return {
      status: 'no-data',
      reason: `Finanzdaten nicht lesbar: ${err.message}`,
    }
  }
  const check = validateSummary(raw)
  if (!check.ok) return { status: 'no-data', reason: check.reason }
  return { status: 'ok', summary: sanitizeSummary(raw) }
}

// ============================================================================
// SANITIZER
// ============================================================================

/**
 * Bereinigte Monatszeile. `categories` behält nur Summen je Kategorie und
 * Unterkategorie - Slugs, keine Namen.
 */
function sanitizeMonth(month) {
  const src = isPlainObject(month) ? month : {}
  const categories = {}
  if (isPlainObject(src.categories)) {
    for (const [slug, bucket] of Object.entries(src.categories)) {
      categories[slug] = {
        ...copyBucket(bucket),
        subcategories: copyNumberMap(
          isPlainObject(bucket) ? bucket.subcategories : null
        ),
      }
    }
  }
  return {
    month: String(src.month || ''),
    transactions: toNumber(src.transactions),
    operating_income: toNumber(src.operating_income),
    operating_expense: toNumber(src.operating_expense),
    operating_result: toNumber(src.operating_result),
    neutral: toNumber(src.neutral),
    net_change: toNumber(src.net_change),
    categories,
  }
}

/**
 * Entfernt alles Personenbezogene aus der Zusammenfassung, bevor sie den
 * Server verlässt:
 *   - `accounts` (IBANs) fällt komplett weg,
 *   - `top_counterparties` (Klarnamen) fällt komplett weg,
 *   - `uncategorized` behält nur `count` und `amount`, keine Einzelbuchungen.
 *
 * Whitelist: unbekannte Felder werden nicht kopiert.
 */
function sanitizeSummary(raw) {
  const src = isPlainObject(raw) ? raw : {}
  const period = isPlainObject(src.period) ? src.period : {}
  const totals = {}
  if (isPlainObject(src.totals)) {
    for (const [slug, bucket] of Object.entries(src.totals)) {
      totals[slug] = copyBucket(bucket)
    }
  }
  const uncategorized = isPlainObject(src.uncategorized)
    ? src.uncategorized
    : {}

  const months = (Array.isArray(src.months) ? src.months : [])
    .map(sanitizeMonth)
    .filter((m) => MONTH_RE.test(m.month))
    .sort((a, b) => a.month.localeCompare(b.month))

  return {
    generated_at:
      typeof src.generated_at === 'string' ? src.generated_at : null,
    schema_version: FINANCE_SCHEMA_VERSION,
    period: {
      from: typeof period.from === 'string' ? period.from : null,
      to: typeof period.to === 'string' ? period.to : null,
    },
    transaction_count: toNumber(src.transaction_count),
    category_labels: copyStringMap(src.category_labels),
    category_kinds: copyStringMap(src.category_kinds),
    subcategory_labels: copyStringMap(src.subcategory_labels),
    totals,
    months,
    uncategorized: {
      count: toNumber(uncategorized.count),
      amount: toNumber(uncategorized.amount),
    },
  }
}

// ============================================================================
// MONATSREIHE
// ============================================================================

function inRange(month, from, to) {
  if (from && month < from) return false
  if (to && month > to) return false
  return true
}

/**
 * Monatsreihe für Diagramme: Einnahmen / Ausgaben / Ergebnis / Neutral /
 * Kontoveränderung je Monat, optional auf `from..to` (inklusive, `YYYY-MM`)
 * eingeschränkt. Nimmt die rohe *oder* die bereinigte Zusammenfassung.
 */
function monthSeries(summary, range = {}) {
  const months = Array.isArray(summary && summary.months) ? summary.months : []
  const from = range.from || null
  const to = range.to || null
  return months
    .filter((m) => isPlainObject(m) && MONTH_RE.test(String(m.month)))
    .filter((m) => inRange(m.month, from, to))
    .sort((a, b) => String(a.month).localeCompare(String(b.month)))
    .map((m) => ({
      month: m.month,
      transactions: toNumber(m.transactions),
      income: toNumber(m.operating_income),
      expense: toNumber(m.operating_expense),
      result: toNumber(m.operating_result),
      neutral: toNumber(m.neutral),
      net_change: toNumber(m.net_change),
    }))
}

/** `YYYY-MM` oder leer; alles andere ist ein Eingabefehler. */
function isValidMonthParam(value) {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    MONTH_RE.test(String(value))
  )
}

// ============================================================================
// INVARIANTE
// ============================================================================

/**
 * Prüft je Monat die beiden Identitäten
 *   operating_income + operating_expense + neutral = net_change
 *   operating_income + operating_expense           = operating_result
 * und über alle Monate, dass die Kategorien-Summen (`totals`) zusammen die
 * Summe der Kontoveränderungen ergeben. Liefert `{ ok, violations }`; jede
 * Verletzung nennt Monat, Regel, erwarteten und tatsächlichen Wert.
 */
function checkInvariant(summary, tolerance = CENT_TOLERANCE) {
  const violations = []
  const months = Array.isArray(summary && summary.months) ? summary.months : []

  for (const m of months) {
    if (!isPlainObject(m)) continue
    const income = toNumber(m.operating_income)
    const expense = toNumber(m.operating_expense)
    const neutral = toNumber(m.neutral)
    const netExpected = round2(income + expense + neutral)
    const netActual = toNumber(m.net_change)
    if (Math.abs(netExpected - netActual) > tolerance) {
      violations.push({
        month: m.month,
        rule: 'income + expense + neutral = net_change',
        expected: netExpected,
        actual: netActual,
        diff: round2(netActual - netExpected),
      })
    }
    const resultExpected = round2(income + expense)
    const resultActual = toNumber(m.operating_result)
    if (Math.abs(resultExpected - resultActual) > tolerance) {
      violations.push({
        month: m.month,
        rule: 'income + expense = operating_result',
        expected: resultExpected,
        actual: resultActual,
        diff: round2(resultActual - resultExpected),
      })
    }
  }

  if (isPlainObject(summary && summary.totals) && months.length > 0) {
    const totalsSum = round2(
      Object.values(summary.totals).reduce(
        (sum, bucket) => sum + toNumber(bucket && bucket.amount),
        0
      )
    )
    const netSum = round2(
      months.reduce((sum, m) => sum + toNumber(m && m.net_change), 0)
    )
    if (Math.abs(totalsSum - netSum) > tolerance) {
      violations.push({
        month: null,
        rule: 'Σ totals.amount = Σ net_change',
        expected: netSum,
        actual: totalsSum,
        diff: round2(totalsSum - netSum),
      })
    }
  }

  return { ok: violations.length === 0, violations }
}

// ============================================================================
// AUSWERTUNGEN FÜR DIE OBERFLÄCHE
// ============================================================================

/**
 * Summen über den ganzen Zeitraum, aus der Monatsreihe gebildet - nicht aus
 * `totals`, damit ein Zeitraumfilter dieselbe Formel benutzen kann.
 */
function overview(summary, range = {}) {
  const series = monthSeries(summary, range)
  const sum = (key) => round2(series.reduce((acc, m) => acc + m[key], 0))
  return {
    months: series.length,
    from: series.length ? series[0].month : null,
    to: series.length ? series[series.length - 1].month : null,
    transactions: sum('transactions'),
    income: sum('income'),
    expense: sum('expense'),
    result: sum('result'),
    neutral: sum('neutral'),
    net_change: sum('net_change'),
  }
}

/**
 * Summen je Kategorie über die Monate im Zeitraum, aus `months[].categories`
 * gebildet - nicht aus `totals`, damit ein Zeitraumfilter dieselbe Formel
 * benutzt wie die Gesamtsicht (ohne Filter ergeben beide dasselbe).
 */
function aggregateCategories(summary, range) {
  const months = Array.isArray(summary && summary.months) ? summary.months : []
  const from = (range && range.from) || null
  const to = (range && range.to) || null
  const acc = {}
  for (const m of months) {
    if (!isPlainObject(m) || !MONTH_RE.test(String(m.month))) continue
    if (!inRange(m.month, from, to)) continue
    if (!isPlainObject(m.categories)) continue
    for (const [slug, bucket] of Object.entries(m.categories)) {
      const b = copyBucket(bucket)
      const target =
        acc[slug] ||
        (acc[slug] = { amount: 0, count: 0, income: 0, expense: 0 })
      target.amount = round2(target.amount + b.amount)
      target.count += b.count
      target.income = round2(target.income + b.income)
      target.expense = round2(target.expense + b.expense)
    }
  }
  return acc
}

function structureRows(summary, range, wantedKinds) {
  const src = isPlainObject(summary) ? summary : {}
  const kinds = isPlainObject(src.category_kinds) ? src.category_kinds : {}
  const labels = isPlainObject(src.category_labels) ? src.category_labels : {}
  const totals = aggregateCategories(src, range)
  return Object.entries(totals)
    .filter(([slug]) => wantedKinds.includes(kinds[slug]))
    .map(([slug, bucket]) => ({
      category: slug,
      label: labels[slug] || slug,
      kind: kinds[slug],
      ...bucket,
    }))
}

/**
 * Kostenstruktur: alle Kategorien vom Typ `ausgabe` oder `offen`, nach Abfluss
 * sortiert, mit Anteil am Gesamtabfluss. `share` ist ein Bruchteil (0..1), der
 * über die Abflüsse (`expense`) gebildet wird - Rückerstattungen innerhalb einer
 * Ausgabenkategorie (`income`) bleiben sichtbar, verzerren den Anteil aber nicht.
 * Optional auf `range` (`from`/`to`, `YYYY-MM`, inklusive) eingeschränkt.
 */
function costStructure(summary, range = {}) {
  const rows = structureRows(summary, range, ['ausgabe', 'offen'])
  const totalExpense = rows.reduce((sum, row) => sum + row.expense, 0)
  return rows
    .map((row) => ({
      ...row,
      share: totalExpense !== 0 ? row.expense / totalExpense : 0,
    }))
    .sort((a, b) => a.expense - b.expense) // größter Abfluss (negativ) zuerst
}

/**
 * Einnahmen nach Kategorie, analog zur Kostenstruktur.
 */
function incomeStructure(summary, range = {}) {
  const rows = structureRows(summary, range, ['einnahme'])
  const totalIncome = rows.reduce((sum, row) => sum + row.income, 0)
  return rows
    .map((row) => ({
      ...row,
      share: totalIncome !== 0 ? row.income / totalIncome : 0,
    }))
    .sort((a, b) => b.income - a.income)
}

/**
 * Alles, was die Finanzseite braucht, in einem Aufruf - auf Basis der
 * bereinigten Zusammenfassung. Der Sanitizer läuft hier noch einmal, damit
 * kein Aufrufer versehentlich Rohdaten durchreicht.
 */
function buildSummaryResponse(raw) {
  const summary = sanitizeSummary(raw)
  return {
    ...summary,
    derived: {
      overview: overview(summary),
      series: monthSeries(summary),
      cost_structure: costStructure(summary),
      income_structure: incomeStructure(summary),
      invariant: checkInvariant(summary),
    },
  }
}

module.exports = {
  FINANCE_SCHEMA_VERSION,
  CENT_TOLERANCE,
  KINDS,
  KIND_LABELS,
  validateSummary,
  parseSummary,
  sanitizeSummary,
  monthSeries,
  aggregateCategories,
  isValidMonthParam,
  checkInvariant,
  overview,
  costStructure,
  incomeStructure,
  buildSummaryResponse,
}
