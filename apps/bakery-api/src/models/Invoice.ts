/**
 * Eine Ausgangsrechnung als eingefrorener Stand (Migration 20270320).
 *
 * `entwurf` ist änderbar. `ausgestellt` ist unveränderlich: `seller`, `totals`
 * und `xml` werden beim Ausstellen festgeschrieben, PDF und XML kommen danach
 * nur noch aus diesen Feldern. Korrektur = `storniert` + neue Rechnung. Die
 * Regeln stehen in `services/invoice.core.js` und `services/invoices.service.ts`.
 *
 * Nicht Teil der 90-Tage-Anonymisierung der Vorbestellungen: Rechnungen
 * unterliegen der Aufbewahrungspflicht (§ 14b UStG).
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Sequelize,
} from 'sequelize'
import type { InvoiceLine } from './InvoiceLine'

export const INVOICE_STATUSES = ['entwurf', 'ausgestellt', 'storniert'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export class Invoice extends Model<
  InferAttributes<Invoice>,
  InferCreationAttributes<Invoice>
> {
  declare id: CreationOptional<number>
  /** Vom Inhaber eingetragen, eindeutig; `null` bei Entwürfen ohne Nummer. */
  declare number: CreationOptional<string | null>
  declare status: CreationOptional<InvoiceStatus>
  declare preorderId: CreationOptional<number | null>
  declare preorderCode: CreationOptional<string | null>
  declare buyerName: CreationOptional<string>
  declare buyerCareOf: CreationOptional<string>
  declare buyerStreet: CreationOptional<string>
  declare buyerPostcode: CreationOptional<string>
  declare buyerCity: CreationOptional<string>
  /** ISO 3166-1 alpha-2 */
  declare buyerCountry: CreationOptional<string>
  /** `YYYY-MM-DD` */
  declare invoiceDate: CreationOptional<string | null>
  /** Liefer-/Leistungsdatum, `YYYY-MM-DD` */
  declare deliveryDate: CreationOptional<string | null>
  declare paymentTermDays: CreationOptional<number>
  declare paymentText: CreationOptional<string>
  declare dueDate: CreationOptional<string | null>
  declare note: CreationOptional<string>
  /** Verkäufer samt Bankverbindung, festgeschrieben beim Ausstellen. */
  declare seller: CreationOptional<Record<string, unknown> | null>
  /** `{ vat: [...], totals: {...} }` aus `computeInvoice()`. */
  declare totals: CreationOptional<Record<string, unknown> | null>
  /** Die Factur-X-XML, festgeschrieben beim Ausstellen. */
  declare xml: CreationOptional<string | null>
  declare issuedAt: CreationOptional<Date | null>
  declare issuedBy: CreationOptional<number | null>
  declare cancelledAt: CreationOptional<Date | null>
  declare cancelledBy: CreationOptional<number | null>
  declare cancelReason: CreationOptional<string>
  declare createdBy: CreationOptional<number | null>
  declare updatedBy: CreationOptional<number | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  declare lines?: NonAttribute<InvoiceLine[]>

  static initModel(sequelize: Sequelize): typeof Invoice {
    Invoice.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        number: { type: DataTypes.STRING(40), allowNull: true },
        status: {
          type: DataTypes.STRING(16),
          allowNull: false,
          defaultValue: 'entwurf',
        },
        preorderId: { type: DataTypes.INTEGER, allowNull: true },
        preorderCode: { type: DataTypes.STRING(32), allowNull: true },
        buyerName: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: '',
        },
        buyerCareOf: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: '',
        },
        buyerStreet: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: '',
        },
        buyerPostcode: {
          type: DataTypes.STRING(16),
          allowNull: false,
          defaultValue: '',
        },
        buyerCity: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: '',
        },
        buyerCountry: {
          type: DataTypes.STRING(2),
          allowNull: false,
          defaultValue: 'DE',
        },
        invoiceDate: { type: DataTypes.DATEONLY, allowNull: true },
        deliveryDate: { type: DataTypes.DATEONLY, allowNull: true },
        paymentTermDays: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 14,
        },
        paymentText: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: '',
        },
        dueDate: { type: DataTypes.DATEONLY, allowNull: true },
        note: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
        seller: { type: DataTypes.JSON, allowNull: true },
        totals: { type: DataTypes.JSON, allowNull: true },
        xml: { type: DataTypes.TEXT, allowNull: true },
        issuedAt: { type: DataTypes.DATE, allowNull: true },
        issuedBy: { type: DataTypes.INTEGER, allowNull: true },
        cancelledAt: { type: DataTypes.DATE, allowNull: true },
        cancelledBy: { type: DataTypes.INTEGER, allowNull: true },
        cancelReason: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: '',
        },
        createdBy: { type: DataTypes.INTEGER, allowNull: true },
        updatedBy: { type: DataTypes.INTEGER, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'Invoice',
        tableName: 'invoices',
        underscored: true,
        timestamps: true,
      }
    )
    return Invoice
  }
}

export default Invoice
