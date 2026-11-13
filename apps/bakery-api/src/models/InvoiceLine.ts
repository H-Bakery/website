/**
 * Eine Rechnungsposition: Bruttopreis in Cent, Steuersatz und die daraus
 * gerechneten Beträge (`services/invoice.core.js` `computeInvoice`). Name,
 * Einheit und Preis sind Kopien - eine spätere Preisänderung im Katalog
 * ändert keine Rechnung.
 */
import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export class InvoiceLine extends Model<
  InferAttributes<InvoiceLine>,
  InferCreationAttributes<InvoiceLine>
> {
  declare id: CreationOptional<number>
  declare invoiceId: ForeignKey<number>
  /** 1, 2, 3 … */
  declare position: number
  /** hq-Slug, '' bei frei eingetragenen Positionen. */
  declare productId: CreationOptional<string>
  declare name: string
  declare unit: CreationOptional<string>
  /** SQLite liefert DECIMAL als Zahl, andere Dialekte als Text. */
  declare quantity: number | string
  declare unitPriceGrossCents: number
  declare vatRate: number | string
  declare grossCents: number
  declare netCents: number
  /** Dezimaltext mit vier Nachkommastellen (BT-146). */
  declare netUnitPrice: string
  /** Dezimaltext (BT-149), meist „1“. */
  declare netBasisQuantity: string
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof InvoiceLine {
    InvoiceLine.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        invoiceId: { type: DataTypes.INTEGER, allowNull: false },
        position: { type: DataTypes.INTEGER, allowNull: false },
        productId: {
          type: DataTypes.STRING(128),
          allowNull: false,
          defaultValue: '',
        },
        name: { type: DataTypes.STRING, allowNull: false },
        unit: {
          type: DataTypes.STRING(32),
          allowNull: false,
          defaultValue: 'Stück',
        },
        quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
        unitPriceGrossCents: { type: DataTypes.INTEGER, allowNull: false },
        vatRate: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
        grossCents: { type: DataTypes.INTEGER, allowNull: false },
        netCents: { type: DataTypes.INTEGER, allowNull: false },
        netUnitPrice: { type: DataTypes.STRING(24), allowNull: false },
        netBasisQuantity: { type: DataTypes.STRING(16), allowNull: false },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'InvoiceLine',
        tableName: 'invoice_lines',
        underscored: true,
        timestamps: true,
      }
    )
    return InvoiceLine
  }
}

export default InvoiceLine
