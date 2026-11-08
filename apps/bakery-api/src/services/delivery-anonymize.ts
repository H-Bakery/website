/**
 * DSGVO für Liefertouren (B8, Regel aus P4): 90 Tage nach dem Tourtag
 * verlieren die Stopps alles, was eine Kundschaft erkennbar macht.
 *
 *   await anonymizeDeliveryStops(transaction, { cutoff, now })
 *
 * Läuft **in der Transaktion des Aufrufers** - nachts zusammen mit den
 * Vorbestellungen (`anonymizePreorders`, `cli.js anonymize-preorders`,
 * `bakery-anonymize.timer`) und am Ende von `import-deliveries`, damit alte
 * Stopps aus dem Mock-Store nie im Klartext in der Datenbank landen.
 * Stichtag und Name kommen aus `delivery-preorders.core.js`
 * (`anonymizeCutoff`, `ANONYMIZED_NAME`) - dieselbe Frist wie bei
 * Vorbestellungen, keine zweite Regel.
 *
 * Gelöscht: `customer` → `anonymisiert`, Telefon, Hinweis, Fehlergrund
 * (Freitext), Straße, Koordinaten samt Herkunft. Bleiben: PLZ und Ort,
 * Zeitfenster, Positionen, Status, Erledigt-Zeitpunkt, Verbleib der Ware -
 * die tragen die Statistik und nennen niemanden. Stopps einer Sammelstelle
 * (`pickup_point_id`) tragen nur deren öffentliche Adresse und bleiben,
 * wie sie sind; ihre Kundschaft steht in `preorders` und wird dort
 * anonymisiert.
 *
 * Der Adress-Cache (`delivery_geocache`) verliert den Eintrag einer
 * gelöschten Straße, sobald kein anderer (noch nicht anonymisierter) Stopp,
 * keine Sammelstelle und nicht das Depot dieselbe Adresse hat.
 */
import { Op, Transaction } from 'sequelize'

import { audit } from '../auth/audit'
import {
  DeliveryDepot,
  DeliveryGeocache,
  DeliveryStop,
  DeliveryTour,
  PickupPoint,
} from '../models'

/* eslint-disable @typescript-eslint/no-var-requires */
const toursCore = require('./delivery-tours.core')
const preordersCore = require('./delivery-preorders.core')
/* eslint-enable @typescript-eslint/no-var-requires */

export interface DeliveryAnonymizeReport {
  /** Anonymisierte Stopps (ohne Namen - nur Kennungen). */
  stops: Array<{ id: number; tourId: number; date: string; status: string }>
  /** Gelöschte Einträge des Adress-Caches. */
  geocacheRemoved: number
}

/** Schlüssel des Adress-Caches wie in `lookupAddress()`. */
function cacheKey(point: {
  street?: string | null
  zip?: string | null
  city?: string | null
}): string | null {
  if (!String(point.street ?? '').trim()) return null
  const address = toursCore.formatAddress(point)
  return address
    ? String(toursCore.normalizeAddress(address)).slice(0, 300)
    : null
}

/**
 * @param options.extraAddresses Adressen, deren Cache-Eintrag ebenfalls
 *   wegfallen soll, wenn ihn niemand mehr braucht - der Import gibt die
 *   alten Stopps aus der Datei mit, damit ein zweiter Lauf den Eintrag nicht
 *   wieder anlegt und stehen lässt.
 */
export async function anonymizeDeliveryStops(
  transaction: Transaction,
  options: {
    cutoff: string
    now?: Date
    extraAddresses?: Array<{
      street?: string | null
      zip?: string | null
      city?: string | null
    }>
  }
): Promise<DeliveryAnonymizeReport> {
  const now = options.now ?? new Date()
  const report: DeliveryAnonymizeReport = { stops: [], geocacheRemoved: 0 }
  const droppedKeys = new Set<string>()
  for (const point of options.extraAddresses ?? []) {
    const key = cacheKey(point)
    if (key) droppedKeys.add(key)
  }
  const tours = await DeliveryTour.findAll({
    where: { date: { [Op.lt]: options.cutoff } },
    attributes: ['id', 'date'],
    transaction,
  })
  const dateOf = new Map(tours.map((t) => [t.id, String(t.date)] as const))
  const due =
    tours.length === 0
      ? []
      : await DeliveryStop.findAll({
          where: {
            tourId: { [Op.in]: [...dateOf.keys()] },
            pickupPointId: null,
            anonymizedAt: null,
          },
          order: [['id', 'ASC']],
          transaction,
        })
  if (due.length === 0 && droppedKeys.size === 0) return report
  for (const row of due) {
    const key = cacheKey(row)
    if (key) droppedKeys.add(key)
    await row.update(
      {
        customer: preordersCore.ANONYMIZED_NAME,
        phone: null,
        notes: null,
        failureReason: null,
        street: '',
        lat: null,
        lon: null,
        geocodeSource: null,
        geocodePrecision: null,
        anonymizedAt: now,
      },
      { transaction }
    )
    const date = dateOf.get(row.tourId) ?? ''
    report.stops.push({
      id: row.id,
      tourId: row.tourId,
      date,
      status: row.status,
    })
  }

  // Cache-Einträge, die noch jemand braucht, bleiben.
  if (droppedKeys.size > 0) {
    const inUse = new Set<string>()
    const keep = (point: {
      street?: string | null
      zip?: string | null
      city?: string | null
    }) => {
      const key = cacheKey(point)
      if (key) inUse.add(key)
    }
    for (const stop of await DeliveryStop.findAll({
      where: { anonymizedAt: null },
      attributes: ['street', 'zip', 'city'],
      transaction,
    })) {
      keep(stop)
    }
    for (const point of await PickupPoint.findAll({
      attributes: ['street', 'zip', 'city'],
      transaction,
    })) {
      keep(point)
    }
    for (const depot of await DeliveryDepot.findAll({ transaction })) {
      keep(depot)
    }
    const remove = [...droppedKeys].filter((k) => !inUse.has(k))
    if (remove.length > 0) {
      report.geocacheRemoved = await DeliveryGeocache.destroy({
        where: { key: { [Op.in]: remove } },
        transaction,
      })
    }
  }

  if (report.stops.length === 0 && report.geocacheRemoved === 0) return report
  // Ein Eintrag je Lauf, ohne Namen, Adressen oder Telefonnummern.
  await audit(
    null,
    'anonymize',
    'delivery_stop',
    null,
    {
      cutoff: options.cutoff,
      stops: report.stops.map((s) => s.id),
      geocacheRemoved: report.geocacheRemoved,
    },
    { transaction, userId: null }
  )
  return report
}
