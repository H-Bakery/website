// Backzettel v2 (Z10): Teigtag ≠ Backtag (docs/backzettel-v2.md §2.4).
//
// U9: Back- und Teigtage kommen aus `kalender.core.js` (Wochenplan plus
// Kalender an `cfg.calendar`): ein geschlossener Tag ist weder Back- noch
// Teigtag, die Teigtag-Suche springt über ihn. Ohne Kalender genau der
// Wochenplan (`days`, `dough_days`) wie vor U9.
//
// Dependency-freies CommonJS wie `backzettel.core.js`. Hier steht genau
// einmal, an welchem Teigtag die Ware eines Backtags gemacht wird und welche
// Backtage ein Zettel einsammelt - keine Mengen.
//
//   doughDate(item, B) =
//     lead(item, weekday(B)) === 0 ? B
//     : der lead-te Tag D < B (höchstens 14 Tage zurück), der Teigtag ist
//       (weekday(D) ∈ dough_days und nicht geschlossen, oder `teigtag` im Kalender)
//
// Ein Posten ohne `lead` hat lead 0: sein Teigtag ist sein Backtag. Eine
// Konfiguration ohne die neuen Schlüssel ergibt deshalb genau die v1-Tage.
//
// Ein Plan (`planForSheet`) sagt, welche (Backtag × Posten) ein Zettel trägt:
// `{ version: 2, doughDate, bakeDates: [{ date, itemIds }] }`. Der Plan eines
// Tages, der vor Z10 freigegeben wurde, ist `legacyPlan(date)` - alle Posten
// des Tages (`itemIds: null`).

const kalender = require('./kalender.core')

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
  let count = 0
  for (let k = 1; k <= LOOKAHEAD_DAYS; k++) {
    const d = addDays(bakeDate, -k)
    if (!kalender.isDoughDay(cfg, d)) continue
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
    if (!kalender.isBakeDay(cfg, b)) continue
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
  if (!kalender.isBakeDay(cfg, bakeDate)) return []
  const set = new Set(
    cfg.items.map((item) => doughDateFor(cfg, item, bakeDate))
  )
  return [...set].sort()
}

/** Ist `date` ein Teigtag (`dough_days`, Kalender)? */
function isDoughDay(cfg, date) {
  return kalender.isDoughDay(cfg, date)
}

/** Ist `date` ein Backtag (`days`, Kalender)? */
function isBakeDay(cfg, date) {
  return kalender.isBakeDay(cfg, date)
}

function ownedKey(bakeDate, itemId) {
  return `${bakeDate}|${itemId}`
}

/**
 * Der Plan eines Zettels (Teigtag `doughDate`): je Backtag die Posten, deren
 * Teig an diesem Tag gemacht wird. `owned` (Set von `${bakeDate}|${itemId}`)
 * nennt Paare, die schon ein anderer freigegebener Zettel trägt (§5.4) - die
 * fehlen hier. `adopted` (Posten-IDs oder `{itemId}`) sind Posten des
 * eigenen Backtags, die sonst auf keinem Zettel stünden (`orphanedItems`) -
 * der Zettel ihres Backtags nimmt sie auf.
 * @returns {{ version: 2, doughDate: string, bakeDates: Array<{date: string, itemIds: string[]}> }}
 */
function planForSheet(cfg, doughDate, owned, adopted) {
  const skip = owned instanceof Set ? owned : new Set(owned || [])
  const adopt = new Set(
    [...(adopted || [])].map((a) => (a && a.itemId ? a.itemId : a))
  )
  return {
    version: 2,
    doughDate,
    bakeDates: bakeDatesFor(cfg, doughDate).map((date) => ({
      date,
      itemIds: cfg.items
        .filter(
          (item) =>
            ((date === doughDate && adopt.has(item.id)) ||
              doughDateFor(cfg, item, date) === doughDate) &&
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

/**
 * Deckt der (eingefrorene) Plan den Posten `item` am Backtag `bakeDate`?
 * Wie `planIncludes`, dazu (Plan v2 mit `knownItems`): ein Posten, den es
 * beim Freigeben noch nicht gab, dessen Teigtag an diesem Backtag der Zettel
 * des Plans ist - so landen seine Vorbestellungen als Nachtrag auf dem
 * freigegebenen Zettel, statt auf keinem (wie in v1).
 */
function planCovers(cfg, plan, bakeDate, item) {
  if (!item) return false
  if (planIncludes(plan, bakeDate, item.id)) return true
  if (!plan || !Array.isArray(plan.knownItems)) return false
  if (plan.knownItems.includes(item.id)) return false
  if (!plan.bakeDates.some((b) => b && b.date === bakeDate)) return false
  return doughDateFor(cfg, item, bakeDate) === plan.doughDate
}

/**
 * Posten des Backtags `bakeDate`, die auf keinem Zettel stehen (§5.4,
 * Übergang): ihr Teigtag laut heutigen Stammdaten ist ein freigegebener
 * Zettel, dessen Plan sie nicht trägt (vor der Umstellung freigegeben oder
 * nach dem Freigeben eines anderen Zettels wieder geöffnet), und auch kein
 * anderer freigegebener Plan trägt sie.
 *
 * @param {object} cfg normalisierte Stammdaten
 * @param {string} bakeDate Backtag
 * @param {Array<{date: string, plan: object}>} confirmed freigegebene Zettel
 *   (mindestens die 14 Tage vor `bakeDate` und `bakeDate` selbst)
 * @returns {Array<{itemId: string, name: string, doughDate: string}>}
 */
function orphanedItems(cfg, bakeDate, confirmed) {
  if (!kalender.isBakeDay(cfg, bakeDate)) return []
  const list = Array.isArray(confirmed) ? confirmed : []
  const dates = new Set(list.map((c) => c.date))
  const out = []
  for (const item of cfg.items) {
    const dd = doughDateFor(cfg, item, bakeDate)
    if (!dates.has(dd)) continue
    if (list.some((c) => planCovers(cfg, c.plan, bakeDate, item))) continue
    out.push({ itemId: item.id, name: item.name, doughDate: dd })
  }
  return out
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
  isBakeDay,
  ownedKey,
  planForSheet,
  legacyPlan,
  planIncludes,
  planCovers,
  orphanedItems,
  planBakeDates,
}
