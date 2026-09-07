/**
 * Berechnungslogik für Verkaufspartner-Kennzahlen.
 *
 * Bewusst dependency-freies CommonJS: dieselbe Datei wird von der echten API
 * (`partner-stats.service.ts`), vom Mock-Server (`simple-server.js`) und von den
 * Tests (`tests/unit/partnerStats.test.js`) benutzt. Es gibt damit genau *eine*
 * Implementierung der Formeln - keine Kopie, die auseinanderlaufen kann.
 *
 * Modell: erfasst wird ein *Besuch* am Backschrank, nicht eine Lieferung.
 * Jeder Besuch hält fest, was noch dalag (`countedQty`) und was neu eingeräumt
 * wurde (`deliveredQty`).
 *
 *   Bestand nach Besuch k = Rest_k + Geliefert_k
 *   Verkauf im Intervall  = Bestand nach Besuch k − Rest_(k+1)
 *   Umsatz                = Σ (Verkauf je Produkt × Preis-Snapshot)
 *   Abverkaufsquote       = Verkauf / Geliefert
 *
 * Ein Tag ist *offen*, solange keine Abholung erfasst ist, und *unvollständig*,
 * wenn die Abholung nicht jedes Produkt mit Bestand gezählt hat: die
 * ungezählten Stücke sind dann weder verkauft noch Retoure. Beides macht die
 * Zahlen vorläufig.
 */

'use strict'

/** Besuchstypen. `pickup` schließt den Geschäftstag ab. */
const VISIT_TYPES = ['initial', 'refill', 'pickup']

const VISIT_TYPE_LABELS = {
  initial: 'Erstbestückung',
  refill: 'Nachlieferung',
  pickup: 'Abholung',
}

/** ISO-Wochentage, wie sie in `Partner.deliveryDays` stehen. */
const WEEKDAY_LABELS = {
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

/** Geldbeträge werden intern in ganzen Cent gerechnet, um Float-Drift zu vermeiden. */
function toCents(price) {
  const n = Number(price)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

function fromCents(cents) {
  return Math.round(cents) / 100
}

function toInt(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

/**
 * Geschäftstag (`YYYY-MM-DD`) eines Zeitpunkts, in *lokaler* Zeit.
 * Bewusst nicht UTC: ein Besuch um 07:00 in Kirrberg gehört zum selben Tag,
 * egal ob Sommer- oder Winterzeit.
 */
function businessDateOf(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** ISO-Wochentag (1 = Montag … 7 = Sonntag) eines `YYYY-MM-DD`-Strings. */
function weekdayOf(businessDate) {
  if (typeof businessDate !== 'string') return null
  const parts = businessDate.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  if (Number.isNaN(d.getTime())) return null
  const js = d.getDay()
  return js === 0 ? 7 : js
}

/**
 * Kalendarisch gültiger Geschäftstag (`YYYY-MM-DD`). Das Muster allein reicht
 * nicht: `new Date(2026, 1, 30)` läuft stillschweigend auf den 2. März über,
 * deshalb wird das Datum hin- und zurückgerechnet.
 */
function isBusinessDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const [y, m, d] = value.split('-').map(Number)
  return businessDateOf(new Date(y, m - 1, d)) === value
}

/** Obergrenze für Stückzahlen je Position - mehr passt in keinen Backschrank. */
const MAX_ITEM_QTY = 10000
/** Obergrenze für den Preis-Snapshot in EUR. */
const MAX_UNIT_PRICE = 10000

/**
 * Ganze Zahl aus einer Eingabe, streng: Zahlen und Ziffern-Strings (`"5"`)
 * gelten, `true`, `"abc"`, `1.5` oder ein Objekt nicht. `Number("abc")` wäre
 * `NaN` und `Number(true)` wäre `1` - beides darf nie zu einer Menge werden.
 * @returns {number|null} `null` = unbrauchbar
 */
function strictInt(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : null
  }
  if (typeof value === 'string' && /^\s*-?\d+\s*$/.test(value)) {
    return Number(value)
  }
  return null
}

function strictNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && /^\s*-?\d+([.,]\d+)?\s*$/.test(value)) {
    return Number(value.replace(',', '.'))
  }
  return null
}

function isBlank(value) {
  return value === null || value === undefined || value === ''
}

/**
 * Positionen eines Besuchs prüfen und normalisieren - die eine Stelle, an der
 * entschieden wird, was als Rest, Lieferung und Preis-Snapshot in die
 * Abrechnung darf. Beide Server benutzen sie; die Regeln:
 *
 * - `countedQty` `null`/`''`/fehlend heißt "nicht gezählt" und bleibt `null`.
 *   `0` heißt "Schrank war leer". Alles andere muss eine ganze Zahl zwischen
 *   0 und `MAX_ITEM_QTY` sein - `"abc"` wird abgelehnt, nicht zu `0`, sonst
 *   entstünde aus einem Tippfehler ein Verkauf des ganzen Bestands.
 * - `deliveredQty` fehlend heißt 0, sonst gleiche Grenzen.
 * - `unitPrice` fehlend heißt Katalogpreis, sonst 0 … `MAX_UNIT_PRICE`,
 *   auf Cent gerundet. Negative Preise fliegen raus.
 * - Mit `lookup` muss jedes Produkt im Katalog stehen; Name und Kennungen
 *   kommen dann aus dem Katalog, nicht aus dem Request. Ohne `lookup`
 *   (echte API, kein HQ-Katalog zur Hand) gelten die Angaben des Requests.
 * - Ein Produkt darf je Besuch nur einmal vorkommen - zwei Zeilen würden im
 *   Bestands-Automaten gegeneinander rechnen.
 * - Zeilen ohne jede Information (nicht gezählt, nichts geliefert) werden
 *   verworfen, sonst steht im Report der halbe Katalog mit lauter Nullen.
 *
 * @param {unknown} items Positionen aus dem Request (`undefined`/`null` = keine)
 * @param {(item: object) => ({id?: string, numeric_id?: number|string,
 *   name?: string, price?: number|string} | null | undefined)} [lookup]
 *   Katalogsuche, z. B. über den HQ-Index des Mock-Servers
 * @returns {{ ok: true, items: Array } | { ok: false, error: string, message: string }}
 */
function validateVisitItems(items, lookup) {
  const fail = (message) => ({ ok: false, error: 'INVALID_ITEMS', message })
  if (isBlank(items)) return { ok: true, items: [] }
  if (!Array.isArray(items)) {
    return fail('Der Besuch braucht eine Liste von Positionen.')
  }

  const out = []
  const seen = new Set()
  for (let i = 0; i < items.length; i += 1) {
    const raw = items[i]
    const pos = `Position ${i + 1}`
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return fail(`${pos}: Die Position muss ein Objekt sein.`)
    }

    const requestedSlug =
      typeof raw.productSlug === 'string' ? raw.productSlug.trim() : ''
    const requestedId = strictInt(raw.productId)
    const label =
      requestedSlug || (requestedId != null ? `#${requestedId}` : '')
    if (!label) {
      return fail(`${pos}: Die Position braucht ein Produkt (productSlug).`)
    }

    let productSlug = requestedSlug
    let productId = requestedId == null ? 0 : requestedId
    let productName =
      typeof raw.productName === 'string' && raw.productName.trim()
        ? raw.productName.trim()
        : productSlug
    let catalogPrice = null

    if (typeof lookup === 'function') {
      const product = lookup(raw) || null
      if (!product) {
        return fail(
          `${pos} (${label}): Unbekanntes Produkt - es steht nicht im Katalog.`
        )
      }
      productSlug = String(product.id || productSlug)
      productId = strictInt(product.numeric_id) ?? productId
      productName = String(product.name || productName || productSlug)
      catalogPrice = strictNumber(product.price)
    }
    if (!productSlug) {
      return fail(`${pos}: Die Position braucht ein Produkt (productSlug).`)
    }
    if (seen.has(productSlug)) {
      return fail(
        `${pos} (${productSlug}): Das Produkt ist doppelt aufgeführt - jedes Produkt nur einmal je Besuch.`
      )
    }
    seen.add(productSlug)

    let countedQty = null
    if (!isBlank(raw.countedQty)) {
      countedQty = strictInt(raw.countedQty)
      if (countedQty == null || countedQty < 0 || countedQty > MAX_ITEM_QTY) {
        return fail(
          `${pos} (${productSlug}): Der Rest muss eine ganze Zahl zwischen 0 und ${MAX_ITEM_QTY} sein (leer = nicht gezählt).`
        )
      }
    }

    let deliveredQty = 0
    if (!isBlank(raw.deliveredQty)) {
      deliveredQty = strictInt(raw.deliveredQty)
      if (
        deliveredQty == null ||
        deliveredQty < 0 ||
        deliveredQty > MAX_ITEM_QTY
      ) {
        return fail(
          `${pos} (${productSlug}): Die gelieferte Menge muss eine ganze Zahl zwischen 0 und ${MAX_ITEM_QTY} sein.`
        )
      }
    }

    let unitPrice
    if (isBlank(raw.unitPrice)) {
      unitPrice = catalogPrice == null ? 0 : catalogPrice
    } else {
      unitPrice = strictNumber(raw.unitPrice)
      if (unitPrice == null || unitPrice < 0 || unitPrice > MAX_UNIT_PRICE) {
        return fail(
          `${pos} (${productSlug}): Der Einzelpreis muss zwischen 0 und ${MAX_UNIT_PRICE} EUR liegen.`
        )
      }
    }
    unitPrice = Math.max(0, Math.round(unitPrice * 100) / 100)

    if (countedQty === null && deliveredQty === 0) continue
    out.push({
      productId,
      productSlug,
      productName,
      unitPrice,
      countedQty,
      deliveredQty,
    })
  }
  return { ok: true, items: out }
}

/**
 * Nachschlagewerk für Korrekturen: der Snapshot eines schon gespeicherten
 * Besuchs. Ein Produkt, das seit der Erfassung aus dem Katalog verschwunden
 * ist (Datei gelöscht, `id` umbenannt), soll beim Korrigieren nicht mit
 * "Unbekanntes Produkt" abgewiesen werden - sonst könnte der Nutzer die Zeile
 * nur leeren, und genau die Mengen gingen verloren, die die Erfassungsmaske
 * für solche Positionen ausdrücklich mitschickt. Neue Besuche bekommen diesen
 * Fallback nicht; dort muss jedes Produkt im Katalog stehen.
 *
 * Gesucht wird über den Slug, ersatzweise über eine positive numerische
 * Kennung (`0` steht für "unbekannt" und trifft deshalb nie).
 *
 * @param {Array<{productSlug?: string, productId?: number, productName?: string,
 *   unitPrice?: number}>|null|undefined} existingItems Positionen des
 *   gespeicherten Besuchs
 * @returns {(item: object) => ({id: string, numeric_id: number, name: string,
 *   price: number} | null)} Lookup in der Form des HQ-Katalogs
 */
function snapshotLookup(existingItems) {
  const items = Array.isArray(existingItems)
    ? existingItems.filter((e) => e && typeof e === 'object')
    : []
  return (item) => {
    if (!item || typeof item !== 'object') return null
    const slug =
      typeof item.productSlug === 'string' ? item.productSlug.trim() : ''
    const numericId = strictInt(item.productId)
    const found = items.find((e) =>
      slug
        ? e.productSlug === slug
        : numericId != null && numericId > 0 && e.productId === numericId
    )
    if (!found) return null
    return {
      id: found.productSlug,
      numeric_id: found.productId,
      name: found.productName || found.productSlug,
      price: found.unitPrice,
    }
  }
}

/**
 * Chronologische Reihenfolge: Geschäftstag, dann `sequence`, dann Zeitpunkt.
 * `sequence` gewinnt vor `visitAt`, damit eine korrigierte Uhrzeit die
 * Reihenfolge der Erfassung nicht durcheinanderbringt.
 */
function sortVisits(visits) {
  return [...(visits || [])].sort((a, b) => {
    const dateA = a.businessDate || ''
    const dateB = b.businessDate || ''
    if (dateA !== dateB) return dateA < dateB ? -1 : 1
    const seqA = toInt(a.sequence, 0)
    const seqB = toInt(b.sequence, 0)
    if (seqA !== seqB) return seqA - seqB
    return new Date(a.visitAt || 0) - new Date(b.visitAt || 0)
  })
}

/** Gruppiert Besuche nach Geschäftstag, jede Gruppe chronologisch sortiert. */
function groupByBusinessDate(visits) {
  const groups = new Map()
  for (const visit of sortVisits(visits)) {
    const key = visit.businessDate
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(visit)
  }
  return groups
}

function emptyProductBucket(item) {
  return {
    productId: toInt(item.productId, 0),
    productSlug: item.productSlug || '',
    productName: item.productName || item.productSlug || 'Unbekannt',
    unitPriceCents: toCents(item.unitPrice),
    deliveredQty: 0,
    returnedQty: 0,
    soldQty: 0,
    discrepancyQty: 0,
    revenueCents: 0,
    uncountedQty: 0,
  }
}

/**
 * Rechnet einen einzelnen Geschäftstag durch.
 *
 * Führt je Produkt einen Bestands-Automaten: an jedem Besuch wird - sofern
 * gezählt wurde - die Differenz zum erwarteten Bestand als Verkauf gebucht,
 * danach die neue Lieferung aufgeschlagen.
 *
 * Das ist die allgemeine Form von "Tagesverkauf = Σ Geliefert − Rest bei der
 * Abholung": sie stimmt auch dann, wenn der Tag noch offen ist oder bei einer
 * Nachlieferung zugleich gezählt *und* geliefert wurde.
 *
 * @param {Array} dayVisits Besuche *eines* Geschäftstags
 * @returns {{ isOpen: boolean, isComplete: boolean, uncountedQty: number,
 *   uncountedProducts: Array, timeline: Array, products: Map }}
 */
function computeDay(dayVisits) {
  const visits = sortVisits(dayVisits)
  /** @type {Map<string, object>} Produktbilanz des Tages, Schlüssel = productSlug */
  const products = new Map()
  /** @type {Map<string, number>} aktueller Bestand im Schrank je Produkt */
  const stock = new Map()
  const timeline = []

  for (const visit of visits) {
    const items = visit.items || []
    const entry = {
      visitId: visit.id,
      visitType: visit.visitType,
      visitAt: visit.visitAt,
      sequence: toInt(visit.sequence, 0),
      staffName: visit.staffName || null,
      note: visit.note || null,
      countedQty: 0,
      deliveredQty: 0,
      soldSinceLastQty: 0,
      soldSinceLastRevenue: 0,
      stockAfterQty: 0,
      items: [],
    }
    let soldCents = 0

    for (const item of items) {
      const key = item.productSlug || `#${item.productId}`
      if (!products.has(key)) products.set(key, emptyProductBucket(item))
      const bucket = products.get(key)
      // Der Preis-Snapshot des jüngsten Besuchs gewinnt - er ist der, zu dem
      // die zuletzt gezählten Stücke verkauft wurden.
      if (item.unitPrice != null)
        bucket.unitPriceCents = toCents(item.unitPrice)
      if (item.productName) bucket.productName = item.productName

      const counted = item.countedQty == null ? null : toInt(item.countedQty, 0)
      const delivered = Math.max(0, toInt(item.deliveredQty, 0))
      const before = stock.get(key) || 0

      let soldHere = 0
      if (counted !== null) {
        const diff = before - counted
        if (diff >= 0) {
          soldHere = diff
        } else {
          // Mehr vorgefunden als erwartet - eine Fehlzählung, kein Negativ-Verkauf.
          // Wird sichtbar gemacht statt still in den Summen zu verschwinden.
          bucket.discrepancyQty += -diff
        }
        stock.set(key, counted + delivered)
      } else {
        stock.set(key, before + delivered)
      }

      bucket.soldQty += soldHere
      bucket.deliveredQty += delivered
      bucket.revenueCents += soldHere * bucket.unitPriceCents
      if (visit.visitType === 'pickup' && counted !== null) {
        bucket.returnedQty += counted
      }

      soldCents += soldHere * bucket.unitPriceCents
      entry.countedQty += counted === null ? 0 : counted
      entry.deliveredQty += delivered
      entry.soldSinceLastQty += soldHere
      entry.items.push({
        productId: bucket.productId,
        productSlug: bucket.productSlug,
        productName: bucket.productName,
        unitPrice: fromCents(bucket.unitPriceCents),
        countedQty: counted,
        deliveredQty: delivered,
        soldSinceLastQty: soldHere,
        stockAfterQty: stock.get(key) || 0,
      })
    }

    entry.soldSinceLastRevenue = fromCents(soldCents)
    entry.stockAfterQty = [...stock.values()].reduce((sum, n) => sum + n, 0)
    timeline.push(entry)
  }

  const isOpen = !visits.some((v) => v.visitType === 'pickup')

  // Unvollständige Abholung: ein Produkt lag noch im Schrank, wurde beim
  // letzten Besuch (der Abholung) aber nicht gezählt. Seine Stücke sind dann
  // weder verkauft noch Retoure - ohne Markierung läse sich der Tag als
  // abgeschlossen und die Stücke verschwänden aus der Abrechnung.
  const last = visits[visits.length - 1]
  const uncountedProducts = []
  let uncountedQty = 0
  if (last && last.visitType === 'pickup') {
    const countedKeys = new Set(
      (last.items || [])
        .filter((item) => item.countedQty != null)
        .map((item) => item.productSlug || `#${item.productId}`)
    )
    for (const [key, stockQty] of stock) {
      if (stockQty <= 0 || countedKeys.has(key)) continue
      const bucket = products.get(key)
      bucket.uncountedQty += stockQty
      uncountedQty += stockQty
      uncountedProducts.push({
        productId: bucket.productId,
        productSlug: bucket.productSlug,
        productName: bucket.productName,
        stockQty,
      })
    }
  }
  const isComplete = uncountedQty === 0

  return {
    isOpen,
    isComplete,
    uncountedQty,
    uncountedProducts,
    timeline,
    products,
    visits,
  }
}

function rate(numerator, denominator) {
  if (!denominator) return null
  return Math.round((numerator / denominator) * 10000) / 10000
}

/**
 * Kennzahlen über einen Zeitraum.
 *
 * @param {Array} visits Besuche (werden nach `businessDate` gefiltert)
 * @param {{from?: string, to?: string}} range inklusive Grenzen, `YYYY-MM-DD`
 */
function computeStats(visits, range = {}) {
  const from = range.from || null
  const to = range.to || null
  const inRange = (visits || []).filter((v) => {
    if (!v || !v.businessDate) return false
    if (from && v.businessDate < from) return false
    if (to && v.businessDate > to) return false
    return true
  })

  const days = groupByBusinessDate(inRange)
  /** @type {Map<string, object>} Produktbilanz über den ganzen Zeitraum */
  const productTotals = new Map()
  const byDay = []

  for (const [businessDate, dayVisits] of [...days.entries()].sort()) {
    const day = computeDay(dayVisits)
    let deliveredQty = 0
    let soldQty = 0
    let returnedQty = 0
    let discrepancyQty = 0
    let uncountedQty = 0
    let revenueCents = 0
    let returnValueCents = 0

    for (const [key, bucket] of day.products) {
      deliveredQty += bucket.deliveredQty
      soldQty += bucket.soldQty
      returnedQty += bucket.returnedQty
      discrepancyQty += bucket.discrepancyQty
      uncountedQty += bucket.uncountedQty
      revenueCents += bucket.revenueCents
      returnValueCents += bucket.returnedQty * bucket.unitPriceCents

      if (!productTotals.has(key)) {
        productTotals.set(key, {
          productId: bucket.productId,
          productSlug: bucket.productSlug,
          productName: bucket.productName,
          unitPriceCents: bucket.unitPriceCents,
          deliveredQty: 0,
          returnedQty: 0,
          soldQty: 0,
          discrepancyQty: 0,
          uncountedQty: 0,
          revenueCents: 0,
          returnValueCents: 0,
        })
      }
      const total = productTotals.get(key)
      total.productName = bucket.productName
      total.unitPriceCents = bucket.unitPriceCents
      total.deliveredQty += bucket.deliveredQty
      total.returnedQty += bucket.returnedQty
      total.soldQty += bucket.soldQty
      total.discrepancyQty += bucket.discrepancyQty
      total.uncountedQty += bucket.uncountedQty
      total.revenueCents += bucket.revenueCents
      total.returnValueCents += bucket.returnedQty * bucket.unitPriceCents
    }

    byDay.push({
      businessDate,
      weekday: weekdayOf(businessDate),
      isOpen: day.isOpen,
      isComplete: day.isComplete,
      visitCount: day.visits.length,
      refillCount: day.visits.filter((v) => v.visitType === 'refill').length,
      deliveredQty,
      soldQty,
      returnedQty,
      discrepancyQty,
      uncountedQty,
      revenue: fromCents(revenueCents),
      returnValue: fromCents(returnValueCents),
      sellThroughRate: rate(soldQty, deliveredQty),
    })
  }

  const byProduct = [...productTotals.values()]
    .map((p) => ({
      productId: p.productId,
      productSlug: p.productSlug,
      productName: p.productName,
      unitPrice: fromCents(p.unitPriceCents),
      deliveredQty: p.deliveredQty,
      soldQty: p.soldQty,
      returnedQty: p.returnedQty,
      discrepancyQty: p.discrepancyQty,
      uncountedQty: p.uncountedQty,
      revenue: fromCents(p.revenueCents),
      returnValue: fromCents(p.returnValueCents),
      sellThroughRate: rate(p.soldQty, p.deliveredQty),
    }))
    .sort(
      (a, b) =>
        b.revenue - a.revenue ||
        a.productName.localeCompare(b.productName, 'de')
    )

  // Wochentags-Mittel: Grundlage für spätere Mengenempfehlungen.
  const weekdayGroups = new Map()
  for (const day of byDay) {
    if (day.weekday == null) continue
    if (!weekdayGroups.has(day.weekday)) weekdayGroups.set(day.weekday, [])
    weekdayGroups.get(day.weekday).push(day)
  }
  const byWeekday = [...weekdayGroups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekday, dayList]) => {
      const n = dayList.length
      const sum = (pick) => dayList.reduce((acc, d) => acc + pick(d), 0)
      const delivered = sum((d) => d.deliveredQty)
      const sold = sum((d) => d.soldQty)
      return {
        weekday,
        weekdayLabel: WEEKDAY_LABELS[weekday] || String(weekday),
        dayCount: n,
        openDayCount: dayList.filter((d) => d.isOpen).length,
        avgDeliveredQty: Math.round((delivered / n) * 10) / 10,
        avgSoldQty: Math.round((sold / n) * 10) / 10,
        avgReturnedQty: Math.round((sum((d) => d.returnedQty) / n) * 10) / 10,
        avgRevenue: Math.round((sum((d) => d.revenue) / n) * 100) / 100,
        sellThroughRate: rate(sold, delivered),
      }
    })

  const deliveredQty = byDay.reduce((s, d) => s + d.deliveredQty, 0)
  const soldQty = byDay.reduce((s, d) => s + d.soldQty, 0)
  const returnedQty = byDay.reduce((s, d) => s + d.returnedQty, 0)
  const revenue =
    Math.round(byDay.reduce((s, d) => s + d.revenue, 0) * 100) / 100
  const returnValue =
    Math.round(byDay.reduce((s, d) => s + d.returnValue, 0) * 100) / 100
  const openDays = byDay.filter((d) => d.isOpen)
  const incompleteDays = byDay.filter((d) => !d.isOpen && !d.isComplete)

  return {
    range: { from, to },
    totals: {
      dayCount: byDay.length,
      openDayCount: openDays.length,
      incompleteDayCount: incompleteDays.length,
      visitCount: byDay.reduce((s, d) => s + d.visitCount, 0),
      refillCount: byDay.reduce((s, d) => s + d.refillCount, 0),
      deliveredQty,
      soldQty,
      returnedQty,
      discrepancyQty: byDay.reduce((s, d) => s + d.discrepancyQty, 0),
      uncountedQty: byDay.reduce((s, d) => s + d.uncountedQty, 0),
      revenue,
      returnValue,
      sellThroughRate: rate(soldQty, deliveredQty),
      returnRate: rate(returnedQty, deliveredQty),
    },
    /**
     * Vorläufig, solange ein Tag ohne Abholung dabei ist - oder eine Abholung
     * nicht jedes Produkt mit Bestand gezählt hat (`incompleteDates`).
     */
    isProvisional: openDays.length > 0 || incompleteDays.length > 0,
    openDates: openDays.map((d) => d.businessDate),
    incompleteDates: incompleteDays.map((d) => d.businessDate),
    byProduct,
    byDay,
    byWeekday,
  }
}

/** Tagesansicht für die Besuchs-Timeline im Partner-Detail. */
function computeDayDetail(dayVisits) {
  const day = computeDay(dayVisits)
  const businessDate = day.visits.length ? day.visits[0].businessDate : null
  const stats = computeStats(dayVisits, {
    from: businessDate,
    to: businessDate,
  })
  return {
    businessDate,
    isOpen: day.isOpen,
    isComplete: day.isComplete,
    uncountedQty: day.uncountedQty,
    uncountedProducts: day.uncountedProducts,
    timeline: day.timeline,
    totals: stats.totals,
    byProduct: stats.byProduct,
  }
}

/** Deutsches Zahlenformat für den CSV-Export (Excel DE: Semikolon, Dezimalkomma). */
function deNumber(value, decimals = 2) {
  if (value == null) return ''
  return Number(value).toFixed(decimals).replace('.', ',')
}

/**
 * Eine CSV-Zelle. Semikolon, Anführungszeichen und Zeilenumbrüche werden
 * eingefasst; eine Zelle, die mit `=`, `+`, `-`, `@`, Tab oder CR beginnt,
 * bekommt ein Apostroph voran - Excel und LibreOffice würden sie sonst als
 * Formel ausführen (CSV-Injection über Partner- oder Produktnamen).
 */
function csvCell(value) {
  let s = value == null ? '' : String(value)
  // Eine schlichte Zahl (`-5`, `-3,50`) ist keine Formel und bleibt Zahl.
  const formulaLike =
    /^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+([.,]\d+)?%?$/.test(s)
  if (formulaLike) s = `'${s}`
  return formulaLike || /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Partner-Report als CSV. Zwei Blöcke - je Produkt und je Geschäftstag -
 * mit einem Kopf, der so an den Partner herausgegeben werden kann.
 */
function statsToCsv(stats, partner = {}) {
  const rows = []
  const push = (cells) => rows.push(cells.map(csvCell).join(';'))

  push(['Partner-Report'])
  push(['Partner', partner.name || ''])
  push([
    'Abrechnungsmodell',
    partner.settlementModel === 'firm_sale' ? 'Festkauf' : 'Kommission',
  ])
  push(['Zeitraum', `${stats.range.from || ''} bis ${stats.range.to || ''}`])
  if (stats.isProvisional) {
    const reasons = []
    if (stats.openDates.length > 0) {
      reasons.push(`${stats.openDates.length} Tag(e) ohne Abholung`)
    }
    if ((stats.incompleteDates || []).length > 0) {
      reasons.push(
        `${stats.incompleteDates.length} Tag(e) mit ungezählten Produkten bei der Abholung`
      )
    }
    push(['Hinweis', `Vorläufig - ${reasons.join(', ')}`])
  }
  push([])

  push(['Je Produkt'])
  push([
    'Produkt',
    'Einzelpreis',
    'Geliefert',
    'Verkauft',
    'Retoure',
    'Abverkaufsquote',
    'Umsatz',
    'Ungezählt',
  ])
  for (const p of stats.byProduct) {
    push([
      p.productName,
      deNumber(p.unitPrice),
      p.deliveredQty,
      p.soldQty,
      p.returnedQty,
      p.sellThroughRate == null
        ? ''
        : `${deNumber(p.sellThroughRate * 100, 1)}%`,
      deNumber(p.revenue),
      p.uncountedQty || 0,
    ])
  }
  push([])

  push(['Je Geschäftstag'])
  push([
    'Datum',
    'Wochentag',
    'Status',
    'Besuche',
    'Geliefert',
    'Verkauft',
    'Retoure',
    'Abverkaufsquote',
    'Umsatz',
    'Ungezählt',
  ])
  for (const d of stats.byDay) {
    push([
      d.businessDate,
      WEEKDAY_SHORT[d.weekday] || '',
      d.isOpen
        ? 'offen'
        : d.isComplete === false
        ? 'unvollständig'
        : 'abgeschlossen',
      d.visitCount,
      d.deliveredQty,
      d.soldQty,
      d.returnedQty,
      d.sellThroughRate == null
        ? ''
        : `${deNumber(d.sellThroughRate * 100, 1)}%`,
      deNumber(d.revenue),
      d.uncountedQty || 0,
    ])
  }
  push([])

  push(['Gesamt'])
  push(['Geliefert', stats.totals.deliveredQty])
  push(['Verkauft', stats.totals.soldQty])
  push(['Retoure', stats.totals.returnedQty])
  push([
    'Abverkaufsquote',
    stats.totals.sellThroughRate == null
      ? ''
      : `${deNumber(stats.totals.sellThroughRate * 100, 1)}%`,
  ])
  push(['Umsatz', deNumber(stats.totals.revenue)])
  push(['Retourenwert', deNumber(stats.totals.returnValue)])
  push(['Ungezählt', stats.totals.uncountedQty || 0])

  return rows.join('\r\n')
}

module.exports = {
  VISIT_TYPES,
  VISIT_TYPE_LABELS,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  MAX_ITEM_QTY,
  MAX_UNIT_PRICE,
  businessDateOf,
  weekdayOf,
  isBusinessDate,
  validateVisitItems,
  snapshotLookup,
  csvCell,
  sortVisits,
  groupByBusinessDate,
  computeDay,
  computeDayDetail,
  computeStats,
  statsToCsv,
}
