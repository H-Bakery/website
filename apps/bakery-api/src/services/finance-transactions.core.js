/**
 * Einzelbuchungen des Geschäftskontos aus `hq/data/finance/transactions/JJJJ-MM.json`
 * für die Buchungsliste (`/admin/finance/buchungen`) und die Detailseite.
 *
 * Bewusst dependency-freies CommonJS wie `finance.core.js`: Routen
 * (`src/routes/finance.routes.js`) und Tests benutzen genau diese Datei.
 *
 * Datenschutz: Anders als die Monatssummen enthalten Einzelbuchungen
 * Empfänger, Verwendungszweck und Kontonummern - auch Löhne an Beschäftigte.
 * Sie gehen deshalb nur an den Inhaber mit Passwort-Sitzung (Wache in
 * `hq-data.routes.ts`, wie alle Finanz-Endpunkte) und nur durch die
 * **Whitelist** `sanitizeTransaction`:
 *   - IBAN der Gegenseite nur maskiert (Land + letzte vier Stellen),
 *   - Mandatsreferenz, Gläubiger-ID, End-to-End-Referenz, BIC, eigenes Konto
 *     und Quelldatei fallen weg,
 *   - ein neues Feld im Export bleibt unsichtbar, bis es hier freigegeben wird.
 *
 * Gerechnet wird hier genau einmal (Summen, Filter, Kategorien der Auswahl);
 * die Verwaltung zeigt nur an.
 */

'use strict'

const TRANSACTIONS_SCHEMA_VERSION = 1

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const MONTH_FILE_RE = /^(\d{4}-(0[1-9]|1[0-2]))\.json$/
/** IDs aus `import_bank_csv.py`: Hex, gekürzter SHA-1. */
const ID_RE = /^[0-9a-f]{8,40}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Längste Suche (Zeichen) - mehr ist kein sinnvoller Suchbegriff. */
const MAX_QUERY_LENGTH = 100
/** Höchstens so viele „weitere Buchungen derselben Gegenseite“. */
const RELATED_LIMIT = 10

const KINDS = ['einnahme', 'ausgabe', 'neutral', 'offen']
const DIRECTIONS = ['in', 'out']

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function round2(value) {
  return Math.round(value * 100) / 100
}

function str(value, max = 500) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text ? text.slice(0, max) : null
}

function isValidMonth(value) {
  return typeof value === 'string' && MONTH_RE.test(value)
}

function isValidId(value) {
  return typeof value === 'string' && ID_RE.test(value)
}

/** `JJJJ-MM` aus den Dateinamen von `transactions/`, aufsteigend. */
function monthsFromFileNames(names) {
  const out = []
  for (const name of names || []) {
    const m = MONTH_FILE_RE.exec(String(name))
    if (m) out.push(m[1])
  }
  return out.sort()
}

/**
 * „DE•• •••• 1600“ - Land und letzte vier Stellen reichen, um zwei Konten
 * derselben Gegenseite auseinanderzuhalten.
 */
function maskIban(iban) {
  if (typeof iban !== 'string') return null
  const compact = iban.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[0-9A-Z]{8,30}$/.test(compact)) return null
  return `${compact.slice(0, 2)}•• •••• ${compact.slice(-4)}`
}

/**
 * Liest eine Monatsdatei. Liefert `{ status: 'ok', month, transactions }`
 * (Rohdaten, noch nicht bereinigt) oder `{ status: 'invalid', reason }` -
 * wirft nie.
 */
function parseMonthFile(text) {
  let raw
  try {
    raw = JSON.parse(text)
  } catch {
    return { status: 'invalid', reason: 'Monatsdatei ist kein gültiges JSON.' }
  }
  if (!isPlainObject(raw)) {
    return { status: 'invalid', reason: 'Monatsdatei ist kein Objekt.' }
  }
  if (raw.schema_version !== TRANSACTIONS_SCHEMA_VERSION) {
    return {
      status: 'invalid',
      reason: `Monatsdatei hat schema_version ${JSON.stringify(
        raw.schema_version
      )} (erwartet ${TRANSACTIONS_SCHEMA_VERSION}).`,
    }
  }
  if (!isValidMonth(raw.month) || !Array.isArray(raw.transactions)) {
    return {
      status: 'invalid',
      reason: 'Monatsdatei ohne Monat oder Buchungen.',
    }
  }
  return {
    status: 'ok',
    month: raw.month,
    generated_at: str(raw.generated_at, 40),
    transactions: raw.transactions.filter(isPlainObject),
  }
}

/** Bezeichnungen aus der (bereinigten) Zusammenfassung. */
function labelsFrom(summary) {
  const src = isPlainObject(summary) ? summary : {}
  return {
    category: isPlainObject(src.category_labels) ? src.category_labels : {},
    kind: isPlainObject(src.category_kinds) ? src.category_kinds : {},
    subcategory: isPlainObject(src.subcategory_labels)
      ? src.subcategory_labels
      : {},
  }
}

/**
 * Whitelist einer Buchung. `null`, wenn ID, Datum oder Betrag fehlen - eine
 * solche Zeile wird nie mit erfundenen Werten gezeigt.
 */
function sanitizeTransaction(raw, labels = labelsFrom(null)) {
  if (!isPlainObject(raw)) return null
  const amount = Number(raw.amount)
  if (
    !isValidId(raw.id) ||
    typeof raw.booking_date !== 'string' ||
    !DATE_RE.test(raw.booking_date) ||
    !Number.isFinite(amount)
  ) {
    return null
  }
  const cls = isPlainObject(raw.classification) ? raw.classification : {}
  const category = str(cls.category, 80) || 'unkategorisiert'
  const subcategory = str(cls.subcategory, 80)
  const kindRaw = labels.kind[category]
  const kind = KINDS.includes(kindRaw) ? kindRaw : 'offen'
  return {
    id: raw.id,
    booking_date: raw.booking_date,
    value_date:
      typeof raw.value_date === 'string' && DATE_RE.test(raw.value_date)
        ? raw.value_date
        : null,
    amount: round2(amount),
    currency: str(raw.currency, 3) || 'EUR',
    status: raw.status === 'vorgemerkt' ? 'vorgemerkt' : 'gebucht',
    booking_text: str(raw.booking_text, 120),
    counterparty: str(raw.counterparty, 200),
    counterparty_iban: maskIban(raw.counterparty_iban),
    purpose: str(raw.purpose, 500),
    direct_debit: Boolean(str(raw.mandate_reference, 80)),
    category,
    category_label:
      typeof labels.category[category] === 'string'
        ? labels.category[category]
        : category === 'unkategorisiert'
        ? 'Nicht zugeordnet'
        : category,
    kind,
    subcategory,
    subcategory_label:
      subcategory && typeof labels.subcategory[subcategory] === 'string'
        ? labels.subcategory[subcategory]
        : subcategory,
    flow: str(cls.flow, 40),
    note: str(cls.note, 300),
  }
}

/** Neueste zuerst; am selben Tag die größeren Beträge (Betrag) zuerst. */
function compareTransactions(a, b) {
  if (a.booking_date !== b.booking_date) {
    return a.booking_date < b.booking_date ? 1 : -1
  }
  const diff = Math.abs(b.amount) - Math.abs(a.amount)
  if (diff !== 0) return diff
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Prüft und normalisiert die Filter aus der Anfrage. */
function parseFilters(query = {}) {
  const errors = []
  const out = { category: null, kind: null, direction: null, q: null }
  if (query.category !== undefined && query.category !== '') {
    const c = String(query.category)
    if (!/^[a-z0-9_-]{1,80}$/.test(c)) errors.push('category')
    else out.category = c
  }
  if (query.kind !== undefined && query.kind !== '') {
    if (!KINDS.includes(String(query.kind))) errors.push('kind')
    else out.kind = String(query.kind)
  }
  if (query.direction !== undefined && query.direction !== '') {
    if (!DIRECTIONS.includes(String(query.direction))) errors.push('direction')
    else out.direction = String(query.direction)
  }
  if (query.q !== undefined && query.q !== '') {
    const q = String(query.q).trim()
    if (q.length > MAX_QUERY_LENGTH) errors.push('q')
    else if (q) out.q = q
  }
  return { filters: out, errors }
}

/** Betrag als Suchtext: „12.5“ findet „12,50“ und umgekehrt. */
function amountTexts(amount) {
  const abs = Math.abs(amount).toFixed(2)
  return [abs, abs.replace('.', ',')]
}

function matches(tx, filters) {
  if (filters.category && tx.category !== filters.category) return false
  if (filters.kind && tx.kind !== filters.kind) return false
  if (filters.direction === 'in' && !(tx.amount > 0)) return false
  if (filters.direction === 'out' && !(tx.amount < 0)) return false
  if (filters.q) {
    const needle = filters.q.toLowerCase().replace(/^[-+]/, '')
    const hay = [
      tx.counterparty,
      tx.purpose,
      tx.booking_text,
      tx.category_label,
      tx.subcategory_label,
      ...amountTexts(tx.amount),
    ]
      .filter(Boolean)
      .join('\n')
      .toLowerCase()
    if (!hay.includes(needle)) return false
  }
  return true
}

function totalsOf(list) {
  let income = 0
  let expense = 0
  for (const tx of list) {
    if (tx.amount > 0) income += tx.amount
    else expense += tx.amount
  }
  return {
    count: list.length,
    income: round2(income),
    expense: round2(expense),
    net: round2(income + expense),
  }
}

/** Kategorien, die im Monat vorkommen (für die Auswahl), nach Anzahl. */
function categoryOptions(list) {
  const map = new Map()
  for (const tx of list) {
    const entry = map.get(tx.category) || {
      category: tx.category,
      label: tx.category_label,
      kind: tx.kind,
      count: 0,
    }
    entry.count += 1
    map.set(tx.category, entry)
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'de')
  )
}

/**
 * Antwort der Liste für einen Monat. `rawTransactions` sind die Rohzeilen der
 * Monatsdatei (oder `null`, wenn es den Monat nicht gibt), `months` alle
 * Monate mit Datei (aufsteigend).
 */
function buildListResponse({
  month,
  months,
  rawTransactions,
  labels,
  filters,
}) {
  const all = (rawTransactions || [])
    .map((raw) => sanitizeTransaction(raw, labels))
    .filter(Boolean)
    .sort(compareTransactions)
  const dropped = (rawTransactions || []).length - all.length
  const shown = all.filter((tx) => matches(tx, filters))
  const index = months.indexOf(month)
  return {
    month,
    available: rawTransactions !== null,
    months: [...months].reverse(),
    previous_month: index > 0 ? months[index - 1] : null,
    next_month:
      index >= 0 && index < months.length - 1 ? months[index + 1] : null,
    filters,
    month_totals: totalsOf(all),
    totals: totalsOf(shown),
    categories: categoryOptions(all),
    skipped: dropped,
    transactions: shown,
  }
}

/** Gleiche Gegenseite (ohne Groß/Klein, Leerraum zusammengezogen). */
function counterpartyKey(name) {
  return typeof name === 'string'
    ? name.toLowerCase().replace(/\s+/g, ' ').trim()
    : ''
}

/**
 * Detail einer Buchung. `allRaw` sind die Rohzeilen aller Monate. Liefert
 * `null`, wenn die ID nicht vorkommt.
 */
function buildDetailResponse({ id, allRaw, labels }) {
  const all = allRaw
    .map((raw) => sanitizeTransaction(raw, labels))
    .filter(Boolean)
  const tx = all.find((t) => t.id === id)
  if (!tx) return null
  const key = counterpartyKey(tx.counterparty)
  const related = key
    ? all
        .filter(
          (t) => t.id !== tx.id && counterpartyKey(t.counterparty) === key
        )
        .sort(compareTransactions)
    : []
  return {
    transaction: tx,
    month: tx.booking_date.slice(0, 7),
    related_count: related.length,
    related_totals: totalsOf(related),
    related: related.slice(0, RELATED_LIMIT).map((t) => ({
      id: t.id,
      booking_date: t.booking_date,
      amount: t.amount,
      purpose: t.purpose,
      category_label: t.category_label,
    })),
  }
}

module.exports = {
  TRANSACTIONS_SCHEMA_VERSION,
  MAX_QUERY_LENGTH,
  RELATED_LIMIT,
  isValidMonth,
  isValidId,
  monthsFromFileNames,
  maskIban,
  counterpartyKey,
  parseMonthFile,
  labelsFrom,
  sanitizeTransaction,
  compareTransactions,
  parseFilters,
  totalsOf,
  categoryOptions,
  buildListResponse,
  buildDetailResponse,
}
