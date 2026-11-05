/**
 * Import des Mock-Stores `partner-store.json` nach SQLite (B6). Die Regeln
 * (Normalisierung, Schlüssel, Probleme) stehen in `partner-import.core.js`;
 * hier wird der Plan in **einer** serialisierten Transaktion angewendet:
 * alles oder nichts.
 *
 *   const report = await importPartnerStore(JSON.parse(text), { dryRun: true })
 *
 * Idempotent:
 *  - Partner per Slug: fehlende werden angelegt, vorhandene bleiben, wie sie
 *    sind (`updatePartners: true` überschreibt ihre Stammdaten aus der Datei).
 *  - Vorlagen per Partner + Wochentag: ebenso.
 *  - Besuche per natürlichem Schlüssel (Partner, Tag, Typ, Zeitpunkt):
 *    vorhandene werden übersprungen, nie verändert.
 *
 * `dryRun` rechnet denselben Import in der Transaktion durch und rollt ihn
 * dann zurück - der Bericht ist genau das, was ein echter Lauf täte.
 *
 * Nicht übernommen wird `staffId` aus dem Store: der Mock kannte keine
 * Benutzer, die Ids zeigen auf nichts in `users`. `staffName` bleibt.
 */
import { Transaction } from 'sequelize'

import { audit } from '../auth/audit'
import {
  Partner,
  PartnerDeliveryTemplate,
  PartnerVisit,
  PartnerVisitItem,
  getSequelize,
} from '../models'

// Der Core ist absichtlich CommonJS ohne Typen - deshalb per require geladen.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const core = require('./partner-import.core')

export interface ImportOptions {
  /** Alles durchrechnen, nichts speichern. */
  dryRun?: boolean
  /** Stammdaten vorhandener Partner und Vorlagen aus der Datei übernehmen. */
  updatePartners?: boolean
}

export interface ImportProblem {
  entity: 'partner' | 'template' | 'visit'
  sourceId: number | null
  message: string
}

export interface ImportCounts {
  created: number
  existing: number
  updated: number
}

export interface ImportReport {
  dryRun: boolean
  partners: ImportCounts
  templates: ImportCounts
  visits: { created: number; existing: number; items: number }
  problems: ImportProblem[]
}

/** Die Datei taugt nicht als Partner-Store - nichts wurde angefasst. */
export class ImportInputError extends Error {}

class DryRunRollback extends Error {}

interface PlannedVisit {
  sourceId: number | null
  key: string
  partnerSlug: string
  businessDate: string
  visitAt: string
  visitType: 'initial' | 'refill' | 'pickup'
  sequence: number | null
  staffName: string | null
  note: string | null
  items: Array<Record<string, unknown>>
}

function emptyCounts(): ImportCounts {
  return { created: 0, existing: 0, updated: 0 }
}

/** Stammdaten eines gespeicherten Partners in der Form des Plans. */
function storedAttributes(row: Partner): Record<string, unknown> {
  const plain = row.toJSON() as unknown as Record<string, unknown>
  return core.partnerAttributes(plain, String(plain['slug']))
}

/** Throws `ImportInputError` unless `store` looks like a partner store. */
export function assertPartnerStore(store: unknown): void {
  const plan = core.planImport(store)
  if (!plan.ok) throw new ImportInputError(plan.message)
}

export async function importPartnerStore(
  store: unknown,
  options: ImportOptions = {}
): Promise<ImportReport> {
  const plan = core.planImport(store)
  if (!plan.ok) throw new ImportInputError(plan.message)

  const report: ImportReport = {
    dryRun: options.dryRun === true,
    partners: emptyCounts(),
    templates: emptyCounts(),
    visits: { created: 0, existing: 0, items: 0 },
    problems: [...plan.problems],
  }

  const apply = async (transaction: Transaction) => {
    // ---------------------------------------------------------- partners
    const partnerIds = new Map<string, number>()
    for (const planned of plan.partners) {
      const existing = await Partner.findOne({
        where: { slug: planned.slug },
        transaction,
      })
      if (!existing) {
        const created = await Partner.create(planned.attributes, {
          transaction,
        })
        partnerIds.set(planned.slug, created.id)
        report.partners.created += 1
        continue
      }
      partnerIds.set(planned.slug, existing.id)
      if (
        options.updatePartners &&
        !core.sameAttributes(storedAttributes(existing), planned.attributes)
      ) {
        await existing.update(planned.attributes, { transaction })
        report.partners.updated += 1
      } else {
        report.partners.existing += 1
      }
    }

    // --------------------------------------------------------- templates
    for (const planned of plan.templates) {
      const partnerId = partnerIds.get(planned.partnerSlug)!
      const existing = await PartnerDeliveryTemplate.findOne({
        where: { partnerId, weekday: planned.weekday },
        transaction,
      })
      if (!existing) {
        await PartnerDeliveryTemplate.create(
          {
            partnerId,
            weekday: planned.weekday,
            items: planned.items,
            active: planned.active,
          },
          { transaction }
        )
        report.templates.created += 1
        continue
      }
      const current = {
        items: core.templateItems(
          typeof existing.items === 'string'
            ? JSON.parse(existing.items as unknown as string)
            : existing.items
        ),
        active: existing.active !== false,
      }
      const wanted = { items: planned.items, active: planned.active }
      if (options.updatePartners && !core.sameAttributes(current, wanted)) {
        await existing.update(wanted, { transaction })
        report.templates.updated += 1
      } else {
        report.templates.existing += 1
      }
    }

    // ------------------------------------------------------------ visits
    for (const planned of plan.visits as PlannedVisit[]) {
      const partnerId = partnerIds.get(planned.partnerSlug)!
      const sameDay = await PartnerVisit.findAll({
        where: { partnerId, businessDate: planned.businessDate },
        transaction,
      })
      const keyOf = (row: PartnerVisit) =>
        core.visitKey({
          partnerSlug: planned.partnerSlug,
          businessDate: String(row.businessDate).slice(0, 10),
          visitType: row.visitType,
          visitAt: row.visitAt,
        })
      if (sameDay.some((row) => keyOf(row) === planned.key)) {
        report.visits.existing += 1
        continue
      }
      if (
        planned.visitType === 'initial' &&
        sameDay.some((row) => row.visitType === 'initial')
      ) {
        report.problems.push({
          entity: 'visit',
          sourceId: planned.sourceId,
          message: `Besuch ${planned.sourceId ?? '?'}: für ${
            planned.partnerSlug
          } am ${
            planned.businessDate
          } gibt es in der Datenbank schon eine andere Erstbestückung - nicht übernommen.`,
        })
        continue
      }
      const taken = new Set(sameDay.map((row) => row.sequence))
      const sequence =
        planned.sequence !== null && !taken.has(planned.sequence)
          ? planned.sequence
          : Math.max(0, ...sameDay.map((row) => row.sequence)) + 1

      const visit = await PartnerVisit.create(
        {
          partnerId,
          businessDate: planned.businessDate,
          visitAt: new Date(planned.visitAt),
          visitType: planned.visitType,
          sequence,
          staffId: null,
          staffName: planned.staffName,
          note: planned.note,
        },
        { transaction }
      )
      if (planned.items.length > 0) {
        await PartnerVisitItem.bulkCreate(
          planned.items.map((item) => ({ ...item, visitId: visit.id })) as any,
          { transaction, validate: true }
        )
      }
      report.visits.created += 1
      report.visits.items += planned.items.length
    }

    await audit(
      null,
      'import',
      'partner_store',
      null,
      {
        partners: report.partners,
        templates: report.templates,
        visits: report.visits,
        problems: report.problems.length,
      },
      { transaction, userId: null }
    )

    if (report.dryRun) throw new DryRunRollback()
  }

  try {
    await getSequelize().transaction(apply)
  } catch (error) {
    if (!(error instanceof DryRunRollback)) throw error
  }
  return report
}

/** Deutscher Bericht für die CLI. */
export function formatImportReport(report: ImportReport): string {
  const counts = (c: ImportCounts) =>
    `${c.created} neu, ${c.existing} vorhanden` +
    (c.updated ? `, ${c.updated} aktualisiert` : '')
  const lines = [
    report.dryRun
      ? 'Probelauf (--dry-run): es wurde nichts gespeichert. Ein echter Lauf würde:'
      : 'Import abgeschlossen:',
    `  Partner:  ${counts(report.partners)}`,
    `  Vorlagen: ${counts(report.templates)}`,
    `  Besuche:  ${report.visits.created} neu (${report.visits.items} Positionen), ${report.visits.existing} vorhanden`,
  ]
  if (report.problems.length > 0) {
    lines.push(`  Nicht übernommen (${report.problems.length}):`)
    for (const problem of report.problems) {
      lines.push(`    - ${problem.message}`)
    }
  }
  return lines.join('\n')
}
