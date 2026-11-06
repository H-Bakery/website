// Referenzwert neben der Grundmenge (Z4, roadmap §5.5 Bildschirm 1, §6 M2).
//
// Für jeden Backzettel-Posten mit Kassennummern (`plu`) der **Median der
// verkauften Stück** am selben Wochentag über die letzten N Verkaufswochen,
// für die es einen Kassenbericht gibt. Nur zur Information: der Wert wird nie
// in die Grundmenge übernommen, auch nicht als Vorschlag-zum-Klicken (das ist
// v2, M4).
//
// Dependency-freies CommonJS wie `partner-stats.core.js`: die Tagesberichte
// liest der Aufrufer über `reports-files.core.js` und reicht sie hier als
// aggregierte Tage (`reports.core.js` `aggregateDay`) herein. Damit gelten
// genau dieselben Regeln wie im Berichtsarchiv:
//
//   - Abgebrochene Belege (`type: 'cancelled'`) zählen nicht.
//   - Storno-Gegenbuchungen sind negative Positionen und werden mit der
//     Fehlbuchung saldiert (Nettomenge je Kassennummer und Tag).
//   - Ein Tag **ohne** Bericht (Ruhetag, Ferien, fehlender Export) ist eine
//     Lücke und wird übersprungen - er zählt nie als 0. Ein Tag **mit**
//     Bericht, an dem ein Posten nicht verkauft wurde, zählt als 0.
//
// Die Kassennummern zählen Stück, nicht die Einheit des Postens. Seit der
// W4-Verifikation Runde 6 rechnet der Referenzwert mit **demselben Faktor
// wie der Backzettel** (`products[].factor`, über die Kassennummer =
// `numeric_id` des hq-Produkts): ein Stück Marmorkuchen ist 0,25 Kuchen,
// ein 500-g-Laib 0,5 l. Nur wenn jede Kassennummer eines Postens so einem
// Produkt zugeordnet ist (`converted: true`), steht der Wert in der Einheit
// des Postens; sonst bleiben es Stück laut Kasse (`converted: false`), und
// die Oberfläche sagt das dazu.

'use strict'

const core = require('./backzettel.core')

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Standard: die letzten 6 gleichen Wochentage (roadmap §5.4 v2, §6 Z4). */
const DEFAULT_WEEKS = 6
const MAX_WEEKS = 26
/**
 * So weit wird höchstens zurückgeschaut, um N Tage mit Bericht zu finden.
 * Ältere Zahlen sagen über die heutige Woche nichts mehr.
 */
const LOOKBACK_WEEKS = 26

const WEEKDAY_NAMES = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
  7: 'Sonntag',
}

function isCalendarDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  )
}

function toUtc(date) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fromUtc(dt) {
  return dt.toISOString().slice(0, 10)
}

function addDays(date, n) {
  const dt = toUtc(date)
  dt.setUTCDate(dt.getUTCDate() + n)
  return fromUtc(dt)
}

/** ISO-Wochentag, 1 = Montag … 7 = Sonntag. */
function isoWeekday(date) {
  const day = toUtc(date).getUTCDay()
  return day === 0 ? 7 : day
}

/** Heute in Europa/Berlin (der Server läuft in UTC). */
function berlinToday(now) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now || new Date())
}

/**
 * `?weekday=` lesen: leer → alle `days`, sonst eine Zahl 1…7 oder eine
 * Kommaliste. Liefert `{ ok, weekdays }` oder `{ ok: false, message }`.
 */
function parseWeekdays(raw, productionDays) {
  const all = Array.isArray(productionDays)
    ? productionDays.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
    : []
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { ok: true, weekdays: [...all].sort((a, b) => a - b) }
  }
  if (Array.isArray(raw)) {
    return { ok: false, message: 'weekday bitte nur einmal angeben.' }
  }
  const out = []
  for (const part of String(raw).split(',')) {
    const text = part.trim()
    const n = Number(text)
    if (!/^\d+$/.test(text) || n < 1 || n > 7) {
      return {
        ok: false,
        message: `Ungültiger Wochentag „${text}“ (1 = Montag … 7 = Sonntag).`,
      }
    }
    if (!out.includes(n)) out.push(n)
  }
  return { ok: true, weekdays: out.sort((a, b) => a - b) }
}

/** `?weeks=` lesen: leer → 6, sonst ganze Zahl 1…26. */
function parseWeeks(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { ok: true, weeks: DEFAULT_WEEKS }
  }
  const text = String(raw).trim()
  const n = Number(text)
  if (!/^\d+$/.test(text) || n < 1 || n > MAX_WEEKS) {
    return {
      ok: false,
      message: `weeks muss eine ganze Zahl von 1 bis ${MAX_WEEKS} sein.`,
    }
  }
  return { ok: true, weeks: n }
}

/**
 * Die Tage, über die der Median läuft: derselbe Wochentag vor `today`
 * (heute nie - der Tag ist noch nicht abgeschlossen), neueste zuerst, nur
 * Tage mit Bericht, höchstens `weeks` Stück, höchstens `LOOKBACK_WEEKS`
 * zurück. Tage ohne Bericht stehen in `skipped` (Lücke, nicht 0).
 *
 * @param {{weekday:number, today:string, weeks:number, hasReport:(date:string)=>boolean, lookbackWeeks?:number}} a
 * @returns {{dates:string[], skipped:string[]}}
 */
function referenceDates(a) {
  const lookback = Math.max(a.lookbackWeeks || LOOKBACK_WEEKS, a.weeks)
  const back = (isoWeekday(a.today) - a.weekday + 7) % 7 || 7
  const dates = []
  const skipped = []
  let date = addDays(a.today, -back)
  for (let i = 0; i < lookback && dates.length < a.weeks; i += 1) {
    if (a.hasReport(date)) dates.push(date)
    else skipped.push(date)
    date = addDays(date, -7)
  }
  return { dates, skipped }
}

/** Median; bei gerader Anzahl der Mittelwert der beiden mittleren Werte. */
function median(values) {
  const list = values
    .filter((v) => typeof v === 'number' && Number.isFinite(v))
    .sort((x, y) => x - y)
  if (list.length === 0) return null
  const mid = Math.floor(list.length / 2)
  return list.length % 2 === 1 ? list[mid] : (list[mid - 1] + list[mid]) / 2
}

function round1(value) {
  return Math.round(value * 10) / 10
}

function round2(value) {
  return Math.round(value * 100) / 100
}

/**
 * Faktor je Kassennummer eines Postens: aus `products[].factor` des
 * Postens, wenn die Kassennummer die `numeric_id` eines dieser Produkte
 * ist. `null` für eine Kassennummer ohne solches Produkt.
 */
function pluFactors(item, resolve) {
  const out = new Map()
  for (const raw of Array.isArray(item.plu) ? item.plu : []) {
    const key = String(raw).trim()
    if (!key) continue
    const hit = resolve ? resolve(key) : null
    out.set(
      key,
      hit && hit.item && hit.item.id === item.id && Number(hit.factor) > 0
        ? Number(hit.factor)
        : null
    )
  }
  return out
}

/**
 * Netto verkaufte Stück je Kassennummer an einem Tag, aus einem
 * aggregierten Tagesbericht (`products[].productId`, `quantity` - Stornos
 * schon saldiert). `null` für einen Tag ohne Bericht.
 */
function soldByPlu(report) {
  if (!report || report.status !== 'ok') return null
  const map = new Map()
  for (const p of Array.isArray(report.products) ? report.products : []) {
    if (!p || p.productId === null || p.productId === undefined) continue
    const key = String(p.productId).trim()
    const qty = Number(p.quantity)
    map.set(key, (map.get(key) || 0) + (Number.isFinite(qty) ? qty : 0))
  }
  return map
}

/**
 * Kassennummern eines Postens samt Umrechnung (W4-Verifikation Runde 6):
 * `converted` = jede Kassennummer ist einem Produkt des Postens mit Faktor
 * zugeordnet, die Mengen stehen dann in der Einheit des Postens.
 * Geteilt mit „Rest am Abend“ (`rest-am-abend.core.js`, M4) - eine Regel.
 *
 * @returns {{plu: string[], factors: Map<string, number|null>, converted: boolean}}
 */
function itemSoldInfo(item, resolve) {
  const plu = (Array.isArray(item.plu) ? item.plu : [])
    .map((p) => String(p).trim())
    .filter(Boolean)
  const factors = pluFactors(item, resolve)
  const converted =
    plu.length > 0 && plu.every((key) => factors.get(key) !== null)
  return { plu, factors, converted }
}

/**
 * Verkauft an einem Tag (`soldByPlu` des Tagesberichts): Σ über die
 * Kassennummern, umgerechnet nur bei `converted` (dann auf 0,01, sonst auf
 * 0,1 Stück gerundet).
 */
function soldOnDay(info, map) {
  const round = info.converted ? round2 : round1
  return round(
    info.plu.reduce(
      (sum, key) =>
        sum +
        (map.get(key) || 0) * (info.converted ? info.factors.get(key) : 1),
      0
    )
  )
}

/** Produkt-Auflöser für die Umrechnung; `null`, wenn er nicht zu bauen ist. */
function soldResolver(cfg, catalog) {
  try {
    return Array.isArray(cfg.items) && cfg.items.length > 0
      ? core.createProductResolver(cfg, catalog)
      : null
  } catch {
    return null
  }
}

/**
 * Referenzwerte eines Wochentags.
 *
 * @param {{config: object, weekday: number, weeks: number, dates: string[], skipped?: string[], reports: Object<string, object>}} a
 *   `config`: normalisierte Stammdaten (`normalizeConfig`); `reports`:
 *   Datum → aggregierter Tagesbericht (`aggregateDay`).
 * @returns {object} `{ weekday, weekdayName, weeks, dates, skippedDates, items[] }`;
 *   je Posten `{ itemId, plu, median, samples, status }` mit `status`
 *   `ok` | `no_plu` (keine Kassennummer) | `no_data` (kein Bericht im Zeitraum).
 */
function computeWeekdayReference(a) {
  const cfg = a.config || {}
  const dates = []
  const sold = []
  for (const date of a.dates || []) {
    const map = soldByPlu(a.reports ? a.reports[date] : null)
    if (!map) continue // ohne Bericht: Lücke, nie 0
    dates.push(date)
    sold.push(map)
  }
  const resolve = soldResolver(cfg, a.catalog)
  const items = (Array.isArray(cfg.items) ? cfg.items : []).map((item) => {
    const info = itemSoldInfo(item, resolve)
    const { plu, converted } = info
    if (plu.length === 0) {
      return {
        itemId: item.id,
        plu: [],
        median: null,
        samples: [],
        status: 'no_plu',
        converted: false,
      }
    }
    if (dates.length === 0) {
      return {
        itemId: item.id,
        plu: plu.map(Number),
        median: null,
        samples: [],
        status: 'no_data',
        converted,
      }
    }
    const round = converted ? round2 : round1
    const samples = sold.map((map) => soldOnDay(info, map))
    const m = median(samples)
    return {
      itemId: item.id,
      plu: plu.map(Number),
      median: m === null ? null : round(m),
      samples,
      status: 'ok',
      converted,
    }
  })
  return {
    weekday: a.weekday,
    weekdayName: WEEKDAY_NAMES[a.weekday] || null,
    weeks: a.weeks,
    dates,
    skippedDates: Array.isArray(a.skipped) ? [...a.skipped] : [],
    items,
  }
}

module.exports = {
  DEFAULT_WEEKS,
  MAX_WEEKS,
  LOOKBACK_WEEKS,
  WEEKDAY_NAMES,
  isCalendarDate,
  isoWeekday,
  addDays,
  berlinToday,
  parseWeekdays,
  parseWeeks,
  referenceDates,
  median,
  soldByPlu,
  itemSoldInfo,
  soldOnDay,
  soldResolver,
  computeWeekdayReference,
}
