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

function csvCell(value) {
  const s = value == null ? '' : String(value)
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
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
  businessDateOf,
  weekdayOf,
  sortVisits,
  groupByBusinessDate,
  computeDay,
  computeDayDetail,
  computeStats,
  statsToCsv,
}
