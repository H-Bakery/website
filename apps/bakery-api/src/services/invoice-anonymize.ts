/**
 * Liegengebliebene Rechnungsentwürfe im 90-Tage-Lauf (`anonymize-preorders`).
 *
 * Die Aufbewahrungspflicht (§ 14b UStG) gilt für **ausgestellte** Rechnungen;
 * ein Entwurf ist kein Beleg und darf Namen und Anschrift nicht länger halten
 * als die Vorbestellung, aus der er stammt. Regel:
 *
 *   - Entwurf aus einer Vorbestellung: Stichtag ist deren Abholtag - der
 *     Entwurf wird im selben Lauf bereinigt wie die Vorbestellung.
 *   - Freier Entwurf: Stichtag ist das Liefer-/Leistungsdatum, sonst der Tag
 *     der letzten Änderung.
 *
 * Liegt der Stichtag vor `cutoff`, werden Name, Zusatz, Straße, PLZ, Ort und
 * Bemerkung geleert und `anonymized_at` gesetzt. Positionen und Beträge
 * bleiben (keine Personendaten). Ausgestellte und stornierte Rechnungen
 * werden nie angefasst.
 */
import { Op, Transaction } from 'sequelize'

import { audit } from '../auth/audit'
import { Invoice, Preorder } from '../models'

export interface InvoiceDraftAnonymizeReport {
  /** Bereinigte Entwürfe (ohne Personendaten). */
  drafts: Array<{ id: number; preorderCode: string | null; reference: string }>
}

const PERSONAL = [
  'buyerName',
  'buyerCareOf',
  'buyerStreet',
  'buyerPostcode',
  'buyerCity',
  'note',
] as const

function day(value: Date | string | null | undefined): string | null {
  if (!value) return null
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10)
}

export async function anonymizeInvoiceDrafts(
  transaction: Transaction,
  options: { cutoff: string; now: Date }
): Promise<InvoiceDraftAnonymizeReport> {
  const drafts = await Invoice.findAll({
    attributes: { exclude: ['pdf', 'cancelPdf', 'xml'] },
    where: {
      status: 'entwurf',
      [Op.or]: PERSONAL.map((key) => ({ [key]: { [Op.ne]: '' } })),
    },
    order: [['id', 'ASC']],
    transaction,
  })
  const report: InvoiceDraftAnonymizeReport = { drafts: [] }
  for (const draft of drafts) {
    const preorder = draft.preorderId
      ? await Preorder.findByPk(draft.preorderId, {
          attributes: ['id', 'pickupDate'],
          transaction,
        })
      : null
    const reference =
      day(preorder?.pickupDate) ??
      day(draft.deliveryDate) ??
      day(draft.updatedAt)
    if (!reference || reference >= options.cutoff) continue
    await draft.update(
      {
        buyerName: '',
        buyerCareOf: '',
        buyerStreet: '',
        buyerPostcode: '',
        buyerCity: '',
        note: '',
        anonymizedAt: options.now,
      },
      { transaction }
    )
    await audit(
      null,
      'anonymize',
      'invoice',
      draft.id,
      { reference, cutoff: options.cutoff },
      { transaction, userId: null }
    )
    report.drafts.push({
      id: draft.id,
      preorderCode: draft.preorderCode ?? null,
      reference,
    })
  }
  return report
}
