/**
 * Import des Liefer-Stores des Mock-Servers (`delivery-store.json`) nach
 * SQLite (B8): Fahrer, Touren mit Stopps, Adress-Cache, auf Wunsch das Depot.
 * Regeln in `delivery-import.core.js`; hier wird der Plan in **einer**
 * serialisierten Transaktion angewendet - alles oder nichts.
 *
 *   const report = await importDeliveryTours(JSON.parse(text), { dryRun: true })
 *
 * Idempotent über `import_key`: Vorhandenes wird erkannt und nie verändert.
 * Sammelstellen und Vorbestellungen übernimmt vorher `import-preorders` (B7);
 * ein Stopp, dessen Sammelstelle es in der Datenbank nicht gibt, kommt ohne
 * die Verknüpfung (Problem gemeldet). Hat am selben Tag schon eine andere
 * Tour den Stopp dieser Sammelstelle, verliert der importierte ebenfalls die
 * Verknüpfung - sonst hätten zwei Fahrer dieselbe Übergabeliste.
 *
 * `dryRun` rechnet in der Transaktion durch und rollt zurück.
 */
import { Op } from 'sequelize'

import { audit } from '../auth/audit'
import {
  DeliveryDepot,
  DeliveryDriver,
  DeliveryGeocache,
  DeliveryStop,
  DeliveryTour,
  PickupPoint,
  getSequelize,
} from '../models'
import { DEPOT_ID } from '../models/DeliveryDepot'
import { PlainStop, checkStopText } from './delivery-tours.service'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('./delivery-import.core')
/* eslint-enable @typescript-eslint/no-var-requires */

export const DeliveryImportInputError: new (message: string) => Error =
  core.DeliveryImportInputError

export interface DeliveryImportOptions {
  dryRun?: boolean
  /** Depot (Adresse, Koordinaten) aus der Datei übernehmen. */
  updateDepot?: boolean
}

export interface DeliveryImportProblem {
  entity: 'driver' | 'tour' | 'stop' | 'depot'
  key: string | null
  message: string
}

export interface DeliveryImportReport {
  dryRun: boolean
  drivers: { created: number; existing: number }
  tours: {
    created: Array<{ key: string; date: string; stops: number }>
    existing: Array<{ key: string; date: string }>
  }
  stops: number
  geocache: { created: number; existing: number }
  depot: 'updated' | 'unchanged' | 'differs' | 'missing'
  problems: DeliveryImportProblem[]
}

class DryRunRollback extends Error {}

export function assertDeliveryStore(store: unknown): void {
  core.assertDeliveryStore(store)
}

export async function importDeliveryTours(
  store: unknown,
  options: DeliveryImportOptions = {}
): Promise<DeliveryImportReport> {
  const plan = core.planDeliveryImport(store)
  const report: DeliveryImportReport = {
    dryRun: !!options.dryRun,
    drivers: { created: 0, existing: 0 },
    tours: { created: [], existing: [] },
    stops: 0,
    geocache: { created: 0, existing: 0 },
    depot: plan.depot ? 'unchanged' : 'missing',
    problems: [...plan.problems],
  }

  try {
    await getSequelize().transaction(async (transaction) => {
      // ---- depot
      if (plan.depot) {
        const row = await DeliveryDepot.findByPk(DEPOT_ID, { transaction })
        if (row) {
          const differs = (
            ['name', 'street', 'zip', 'city', 'phone', 'lat', 'lon'] as const
          ).some((k) => String(row[k] ?? '') !== String(plan.depot[k] ?? ''))
          if (differs && options.updateDepot) {
            await row.update(plan.depot, { transaction })
            report.depot = 'updated'
          } else if (differs) {
            report.depot = 'differs'
          }
        }
      }

      // ---- drivers
      const driverIds = new Map<string, number>()
      for (const driver of plan.drivers) {
        const existing = await DeliveryDriver.findOne({
          where: { importKey: driver.key },
          transaction,
        })
        if (existing) {
          driverIds.set(driver.key, existing.id)
          report.drivers.existing++
          continue
        }
        const row = await DeliveryDriver.create(
          { ...driver.data, importKey: driver.key },
          { transaction }
        )
        driverIds.set(driver.key, row.id)
        report.drivers.created++
      }

      // ---- tours and stops
      const points = new Set(
        (await PickupPoint.findAll({ attributes: ['id'], transaction })).map(
          (p) => p.id
        )
      )
      for (const tour of plan.tours) {
        const existing = await DeliveryTour.findOne({
          where: { importKey: tour.key },
          transaction,
        })
        if (existing) {
          report.tours.existing.push({ key: tour.key, date: tour.date })
          continue
        }
        const stops = []
        for (const stop of tour.stops) {
          const problem = checkStopText({ id: 0, ...stop.data } as PlainStop)
          if (problem) {
            report.problems.push({
              entity: 'stop',
              key: stop.key,
              message: `${stop.key}: ${problem.message}`,
            })
            continue
          }
          if (stop.data.pickupPointId && !points.has(stop.data.pickupPointId)) {
            report.problems.push({
              entity: 'stop',
              key: stop.key,
              message: `${stop.key}: Sammelstelle „${stop.data.pickupPointId}“ gibt es nicht (zuerst import-preorders) - Stopp ohne Verknüpfung übernommen.`,
            })
            stop.data.pickupPointId = null
          }
          if (stop.data.pickupPointId) {
            const taken = await DeliveryStop.findOne({
              where: { pickupPointId: stop.data.pickupPointId },
              include: [
                {
                  model: DeliveryTour,
                  as: 'tour',
                  where: { date: tour.date },
                  required: true,
                },
              ],
              transaction,
            })
            if (taken) {
              report.problems.push({
                entity: 'stop',
                key: stop.key,
                message: `${stop.key}: Am ${tour.date} hat schon eine andere Tour die Sammelstelle - Stopp ohne Verknüpfung übernommen.`,
              })
              stop.data.pickupPointId = null
            }
          }
          stops.push(stop)
        }
        const row = await DeliveryTour.create(
          {
            ...tour.data,
            startedAt: toDate(tour.data.startedAt),
            finishedAt: toDate(tour.data.finishedAt),
            routedAt: toDate(tour.data.routedAt),
            driverId: tour.driverKey
              ? driverIds.get(tour.driverKey) ?? null
              : null,
            importKey: tour.key,
          },
          { transaction }
        )
        let position = 0
        for (const stop of stops) {
          const taken = await DeliveryStop.findOne({
            where: { importKey: stop.key },
            transaction,
          })
          if (taken) continue // cannot happen for a new tour key; safety
          await DeliveryStop.create(
            {
              ...stop.data,
              completedAt: toDate(stop.data.completedAt),
              tourId: row.id,
              position: position++,
              importKey: stop.key,
            },
            { transaction }
          )
          report.stops++
        }
        report.tours.created.push({
          key: tour.key,
          date: tour.date,
          stops: position,
        })
      }

      // ---- geocache
      const keys = plan.geocache.map((g: { key: string }) => g.key)
      const known = new Set(
        (
          await DeliveryGeocache.findAll({
            where: { key: { [Op.in]: keys } },
            attributes: ['key'],
            transaction,
          })
        ).map((g) => g.key)
      )
      for (const hit of plan.geocache) {
        if (known.has(hit.key)) {
          report.geocache.existing++
          continue
        }
        known.add(hit.key)
        await DeliveryGeocache.create(hit, { transaction })
        report.geocache.created++
      }

      // Keine Namen, Adressen oder Telefonnummern im Protokoll.
      await audit(
        null,
        'import',
        'delivery_store',
        null,
        {
          dryRun: report.dryRun,
          drivers: report.drivers,
          tours: report.tours.created.map((t) => t.key),
          stops: report.stops,
          geocache: report.geocache.created,
          depot: report.depot,
          problems: report.problems.length,
        },
        { transaction, userId: null }
      )

      if (options.dryRun) throw new DryRunRollback()
    })
  } catch (error) {
    if (!(error instanceof DryRunRollback)) throw error
  }
  return report
}

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null
}

export function formatDeliveryImportReport(
  report: DeliveryImportReport
): string {
  const lines = [
    report.dryRun
      ? 'Probelauf (--dry-run): es wurde nichts gespeichert. Ein echter Lauf würde:'
      : 'Import abgeschlossen:',
    `  Fahrer:  ${report.drivers.created} neu, ${report.drivers.existing} vorhanden`,
    `  Touren:  ${report.tours.created.length} neu (${report.stops} Stopps), ${report.tours.existing.length} vorhanden`,
    `  Adress-Cache: ${report.geocache.created} neu, ${report.geocache.existing} vorhanden`,
    `  Depot:   ${
      {
        updated: 'aus der Datei übernommen',
        unchanged: 'unverändert',
        differs: 'weicht ab, nicht übernommen (--update-depot übernimmt es)',
        missing: 'nicht in der Datei',
      }[report.depot]
    }`,
  ]
  if (report.problems.length > 0) {
    lines.push(`  Hinweise (${report.problems.length}):`)
    for (const problem of report.problems)
      lines.push(`    - ${problem.message}`)
  }
  return lines.join('\n')
}
