/**
 * Vorbestellungen - Wartung (B7 Import, P4 Anonymisierung).
 *
 *   importDeliveryStore(store, { dryRun })   Mock-Store → SQLite, idempotent
 *   anonymizePreorders({ today, dryRun })    DSGVO: 90 Tage nach Abholung
 *
 * Beide laufen in **einer** verwalteten Transaktion; ein Probelauf
 * (`dryRun`) macht dieselbe Arbeit und rollt am Ende zurück, damit der
 * Bericht genau das zeigt, was ein echter Lauf täte.
 */
import { Op } from 'sequelize'

import { audit } from '../auth/audit'
import {
  AuditLog,
  getSequelize,
  PickupPoint,
  Preorder,
  PreorderItem,
} from '../models'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('./delivery-preorders.core')
const shopOrders = require('./shop-orders.core')
/* eslint-enable @typescript-eslint/no-var-requires */

export const IMPORT_SOURCE = 'delivery-store.json'

class DryRunRollback extends Error {
  constructor(readonly report: unknown) {
    super('dry run')
  }
}

async function inTransaction<T>(
  dryRun: boolean,
  work: (t: import('sequelize').Transaction) => Promise<T>
): Promise<T> {
  try {
    return await getSequelize().transaction(async (t) => {
      const report = await work(t)
      if (dryRun) throw new DryRunRollback(report)
      return report
    })
  } catch (error) {
    if (error instanceof DryRunRollback) return error.report as T
    throw error
  }
}

// ------------------------------------------------------------------ import

export interface ImportReport {
  dryRun: boolean
  pickupPoints: { created: string[]; existing: string[]; invalid: string[] }
  imported: Array<{ reference: string; code: string; id: number }>
  alreadyImported: string[]
  skipped: Array<{ reference: string; reason: string }>
}

interface StorePickupPoint {
  id?: unknown
  [key: string]: unknown
}

/**
 * Importiert Sammelstellen und Vorbestellungen aus dem Mock-Store
 * (`apps/bakery-api/data/delivery-store.json`). Touren, Fahrer und Depot
 * bleiben liegen (D11: Touren erst nach Weihnachten, B8).
 *
 * Idempotent über das Audit: jede importierte Bestellung hinterlässt eine
 * `import`-Zeile mit `sourceReference`; ein zweiter Lauf überspringt sie.
 * Ist die Referenz als Code schon von einer in der App erfassten Bestellung
 * belegt, bekommt die importierte den nächsten freien Code des Tages.
 */
export async function importDeliveryStore(
  store: unknown,
  options: { dryRun?: boolean } = {}
): Promise<ImportReport> {
  const dryRun = options.dryRun === true
  const source = (store && typeof store === 'object' ? store : {}) as {
    pickupPoints?: unknown
    preorders?: unknown
  }
  const storePoints = Array.isArray(source.pickupPoints)
    ? (source.pickupPoints as StorePickupPoint[])
    : []
  const storePreorders = Array.isArray(source.preorders)
    ? (source.preorders as Record<string, unknown>[])
    : []

  return inTransaction(dryRun, async (transaction) => {
    const report: ImportReport = {
      dryRun,
      pickupPoints: { created: [], existing: [], invalid: [] },
      imported: [],
      alreadyImported: [],
      skipped: [],
    }

    // --- Sammelstellen
    for (const raw of storePoints) {
      const id = typeof raw?.id === 'string' ? raw.id.trim() : ''
      if (!id || id === core.LADEN_PICKUP) {
        report.pickupPoints.invalid.push(String(raw?.id ?? ''))
        continue
      }
      if (await PickupPoint.findByPk(id, { transaction })) {
        report.pickupPoints.existing.push(id)
        continue
      }
      const result = core.normalizePickupPointInput(raw, { id })
      if (result.error) {
        report.pickupPoints.invalid.push(id)
        continue
      }
      const p = result.pickupPoint
      await PickupPoint.create(
        {
          id,
          name: p.name,
          street: p.street,
          zip: p.zip,
          city: p.city,
          weekday: p.weekday,
          window: p.window,
          orderDeadline: p.orderDeadline,
          notes: p.notes,
          active: p.active,
          lat: typeof raw['lat'] === 'number' ? (raw['lat'] as number) : null,
          lon: typeof raw['lon'] === 'number' ? (raw['lon'] as number) : null,
          geocodeSource:
            typeof raw['geocodeSource'] === 'string'
              ? (raw['geocodeSource'] as string)
              : null,
          geocodePrecision:
            typeof raw['geocodePrecision'] === 'string'
              ? (raw['geocodePrecision'] as string)
              : null,
        },
        { transaction }
      )
      await audit(
        null,
        'import',
        'pickup_point',
        id,
        { source: IMPORT_SOURCE },
        {
          transaction,
          userId: null,
        }
      )
      report.pickupPoints.created.push(id)
    }

    // --- Schon importiert?
    const previous = await AuditLog.findAll({
      where: { action: 'import', entity: 'preorder' },
      transaction,
    })
    const done = new Set(
      previous
        .map((row) => {
          const data = (
            typeof row.data === 'string' ? JSON.parse(row.data) : row.data
          ) as Record<string, unknown> | null
          return data && data['source'] === IMPORT_SOURCE
            ? String(data['sourceReference'])
            : null
        })
        .filter((v): v is string => v !== null)
    )

    // --- Vorbestellungen
    for (const legacy of storePreorders) {
      const reference = String(legacy?.['reference'] ?? '')
      if (done.has(reference)) {
        report.alreadyImported.push(reference)
        continue
      }
      const mapped = core.legacyPreorderToRecord(legacy)
      if (mapped.skip) {
        report.skipped.push({ reference, reason: mapped.skip })
        continue
      }
      const rec = mapped.record
      if (!(await PickupPoint.findByPk(rec.pickupPointId, { transaction }))) {
        report.skipped.push({
          reference,
          reason: `Sammelstelle „${rec.pickupPointId}“ unbekannt`,
        })
        continue
      }
      let code: string = rec.code
      if (await Preorder.findOne({ where: { code }, transaction })) {
        const prefix = core.codePrefixFor(rec.pickupPointId)
        const taken = await Preorder.findAll({
          attributes: ['code'],
          where: { code: { [Op.like]: `${prefix}-${rec.pickupDate}-%` } },
          transaction,
        })
        code = core.nextCode(
          taken.map((r) => r.code),
          prefix,
          rec.pickupDate
        )
      }
      const row = await Preorder.create(
        {
          code,
          channel: rec.channel,
          customerName: rec.customerName,
          customerPhone: rec.customerPhone,
          pickupDate: rec.pickupDate,
          pickupTime: null,
          pickupPointId: rec.pickupPointId,
          status: rec.status,
          paid: rec.paid,
          note: rec.note,
          pickedUpAt: rec.pickedUpAt ? new Date(rec.pickedUpAt) : null,
          notCollectedAt: rec.notCollectedAt
            ? new Date(rec.notCollectedAt)
            : null,
          createdBy: null,
          updatedBy: null,
          createdAt: new Date(rec.createdAt),
          updatedAt: new Date(rec.updatedAt),
        },
        { transaction, silent: true }
      )
      await PreorderItem.bulkCreate(
        rec.items.map(
          (i: {
            productId: string
            name: string
            unit: string
            unitPrice: number
            quantity: number
            variant: string
          }) => ({
            preorderId: row.id,
            productId: i.productId,
            productName: i.name,
            unit: i.unit,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            variant: i.variant,
          })
        ),
        { transaction }
      )
      await audit(
        null,
        'import',
        'preorder',
        row.id,
        {
          source: IMPORT_SOURCE,
          sourceId: legacy['id'] ?? null,
          sourceReference: reference,
          code,
          status: rec.status,
          pickupDate: rec.pickupDate,
        },
        { transaction, userId: null }
      )
      done.add(reference)
      report.imported.push({ reference, code, id: row.id })
    }
    return report
  })
}

// ------------------------------------------------------------ anonymise (P4)

export interface AnonymizeReport {
  dryRun: boolean
  today: string
  cutoff: string
  anonymized: Array<{ id: number; code: string; pickupDate: string }>
  /** Older than the cutoff but still offen/bereit: never anonymised automatically. */
  stillOpen: number
}

/**
 * Anonymisiert Vorbestellungen, deren Abholtag mehr als `days` (90) Tage
 * zurückliegt und die abgeschlossen sind (abgeholt, storniert, nicht
 * abgeholt): `customerName` → `anonymisiert`, `customerPhone` und `note`
 * → null, `anonymizedAt` = jetzt. Positionen, Summen und Codes bleiben (sie
 * sind keine Personendaten und tragen die Statistik). Danach ist die
 * Bestellung schreibgeschützt (409 `anonymized`).
 */
export async function anonymizePreorders(
  options: { today?: string; days?: number; dryRun?: boolean; now?: Date } = {}
): Promise<AnonymizeReport> {
  const now = options.now ?? new Date()
  const today = options.today ?? shopOrders.berlinToday(now)
  const days = options.days ?? core.ANONYMIZE_AFTER_DAYS
  const cutoff = core.anonymizeCutoff(today, days)
  if (!cutoff) {
    throw new Error(
      `Ungültiger Stichtag oder Frist (heute ${today}, ${days} Tage).`
    )
  }
  const dryRun = options.dryRun === true
  return inTransaction(dryRun, async (transaction) => {
    const candidates = await Preorder.findAll({
      where: { pickupDate: { [Op.lt]: cutoff }, anonymizedAt: null },
      order: [['id', 'ASC']],
      transaction,
    })
    const report: AnonymizeReport = {
      dryRun,
      today,
      cutoff,
      anonymized: [],
      stillOpen: 0,
    }
    for (const row of candidates) {
      const plain = row.get({ plain: true })
      if (!core.isDueForAnonymization(plain, cutoff)) {
        report.stillOpen += 1
        continue
      }
      await row.update(
        {
          customerName: core.ANONYMIZED_NAME,
          customerPhone: null,
          note: null,
          anonymizedAt: now,
        },
        { transaction }
      )
      await audit(
        null,
        'anonymize',
        'preorder',
        row.id,
        { code: row.code, pickupDate: row.pickupDate, cutoff },
        { transaction, userId: null }
      )
      report.anonymized.push({
        id: row.id,
        code: row.code,
        pickupDate: String(row.pickupDate),
      })
    }
    return report
  })
}
