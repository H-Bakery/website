// Backzettel v2 (Z10): Teigtag ≠ Backtag (docs/backzettel-v2.md §2.4).
//
// Dependency-freies CommonJS wie `backzettel.core.js`. Hier steht genau
// einmal, an welchem Teigtag die Ware eines Backtags gemacht wird und welche
// Backtage ein Zettel einsammelt - keine Mengen.
//
//   doughDate(item, B) =
//     lead(item, weekday(B)) === 0 ? B
//     : der lead-te Tag D < B (höchstens 14 Tage zurück) mit weekday(D) ∈ dough_days
//
// Ein Posten ohne `lead` hat lead 0: sein Teigtag ist sein Backtag. Eine
// Konfiguration ohne die neuen Schlüssel ergibt deshalb genau die v1-Tage.
//
// Ein Plan (`planForSheet`) sagt, welche (Backtag × Posten) ein Zettel trägt:
// `{ version: 2, doughDate, bakeDates: [{ date, itemIds }] }`. Der Plan eines
// Tages, der vor Z10 freigegeben wurde, ist `legacyPlan(date)` - alle Posten
// des Tages (`itemIds: null`).

/** So weit sucht `doughDateFor` zurück bzw. `bakeDatesFor` voraus. */
const LOOKAHEAD_DAYS = 14

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

/** `date` + `days` Kalendertage, als `YYYY-MM-DD`. */
function addDays(date, days) {
  const [y, m, d] = String(date).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function doughDays(cfg) {
  return Array.isArray(cfg.dough_days) ? cfg.dough_days : cfg.days || []
}

/**
 * Wie viele Teigtage vor dem Backtag (ISO-Wochentag des Backtags) der Posten
 * gemacht wird. Ohne `lead` 0.
 */
function leadFor(item, weekday) {
  const lead = item && item.lead
  if (Number.isInteger(lead)) return lead
  if (!lead || typeof lead !== 'object') return 0
  if (Number.isInteger(lead[weekday])) return lead[weekday]
  return Number.isInteger(lead.default) ? lead.default : 0
}

/**
 * Teigtag eines Postens für den Backtag `bakeDate`, mit Angabe, ob er
 * gefunden wurde. Kein Teigtag in den 14 Tagen davor → der Backtag selbst
 * (`found: false`, Warnung `no_dough_day` beim Zettel) - die Zeile fällt nie
 * weg.
 * @returns {{ date: string, lead: number, found: boolean }}
 */
function resolveDoughDate(cfg, item, bakeDate) {
  const lead = leadFor(item, isoWeekday(bakeDate))
  if (lead <= 0) return { date: bakeDate, lead: 0, found: true }
  const days = doughDays(cfg)
  let count = 0
  for (let k = 1; k <= LOOKAHEAD_DAYS; k++) {
    const d = addDays(bakeDate, -k)
    if (!days.includes(isoWeekday(d))) continue
    count += 1
    if (count === lead) return { date: d, lead, found: true }
  }
  return { date: bakeDate, lead, found: false }
}

/** Teigtag (`YYYY-MM-DD`) eines Postens für den Backtag `bakeDate`. */
function doughDateFor(cfg, item, bakeDate) {
  return resolveDoughDate(cfg, item, bakeDate).date
}

/**
 * Backtage, deren Ware (ganz oder teilweise) am Teigtag `doughDate` gemacht
 * wird - aufsteigend, `doughDate` selbst dabei, wenn es ein Backtag ist.
 */
function bakeDatesFor(cfg, doughDate) {
  const out = []
  for (let k = 0; k <= LOOKAHEAD_DAYS; k++) {
    const b = addDays(doughDate, k)
    if (!cfg.days.includes(isoWeekday(b))) continue
    if (
      k === 0 ||
      cfg.items.some((item) => doughDateFor(cfg, item, b) === doughDate)
    ) {
      out.push(b)
    }
  }
  return out
}

/**
 * Teigtage, an denen die Ware des Backtags `bakeDate` gemacht wird
 * (aufsteigend, ohne doppelte). Kein Backtag → leer.
 */
function doughDatesFor(cfg, bakeDate) {
  if (!cfg.days.includes(isoWeekday(bakeDate))) return []
  const set = new Set(
    cfg.items.map((item) => doughDateFor(cfg, item, bakeDate))
  )
  return [...set].sort()
}

/** Ist `date` ein Teigtag (`dough_days`)? */
function isDoughDay(cfg, date) {
  return doughDays(cfg).includes(isoWeekday(date))
}

function ownedKey(bakeDate, itemId) {
  return `${bakeDate}|${itemId}`
}

/**
 * Der Plan eines Zettels (Teigtag `doughDate`): je Backtag die Posten, deren
 * Teig an diesem Tag gemacht wird. `owned` (Set von `${bakeDate}|${itemId}`)
 * nennt Paare, die schon ein anderer freigegebener Zettel trägt (§5.4) - die
 * fehlen hier.
 * @returns {{ version: 2, doughDate: string, bakeDates: Array<{date: string, itemIds: string[]}> }}
 */
function planForSheet(cfg, doughDate, owned) {
  const skip = owned instanceof Set ? owned : new Set(owned || [])
  return {
    version: 2,
    doughDate,
    bakeDates: bakeDatesFor(cfg, doughDate).map((date) => ({
      date,
      itemIds: cfg.items
        .filter(
          (item) =>
            doughDateFor(cfg, item, date) === doughDate &&
            !skip.has(ownedKey(date, item.id))
        )
        .map((item) => item.id),
    })),
  }
}

/** Plan eines vor Z10 freigegebenen Tages: alle Posten des Tages selbst. */
function legacyPlan(date) {
  return { version: 1, doughDate: date, bakeDates: [{ date, itemIds: null }] }
}

/** Trägt der Plan den Posten `itemId` für den Backtag `bakeDate`? */
function planIncludes(plan, bakeDate, itemId) {
  if (!plan || !Array.isArray(plan.bakeDates)) return false
  const entry = plan.bakeDates.find((b) => b && b.date === bakeDate)
  if (!entry) return false
  return entry.itemIds === null || entry.itemIds === undefined
    ? true
    : entry.itemIds.includes(itemId)
}

/** Die Backtage eines Plans (`YYYY-MM-DD`, in Plan-Reihenfolge). */
function planBakeDates(plan) {
  return plan && Array.isArray(plan.bakeDates)
    ? plan.bakeDates.map((b) => b.date)
    : []
}

module.exports = {
  LOOKAHEAD_DAYS,
  isValidDate,
  isoWeekday,
  addDays,
  leadFor,
  resolveDoughDate,
  doughDateFor,
  bakeDatesFor,
  doughDatesFor,
  isDoughDay,
  ownedKey,
  planForSheet,
  legacyPlan,
  planIncludes,
  planBakeDates,
}
