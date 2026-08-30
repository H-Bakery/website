import {
  Model,
  DataTypes,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
  BelongsToGetAssociationMixin,
} from 'sequelize'
// Temporary local logger until utils library is properly configured
const logger = {
  info: (message: string, ...args: any[]) =>
    console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) =>
    console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) =>
    console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) =>
    console.log(`[DEBUG] ${message}`, ...args),
  db: (message: string, ...args: any[]) =>
    console.log(`[DB] ${message}`, ...args),
}

export interface PartnerVisitItemAttributes {
  id: number
  visitId: number
  /** Numerische HQ-ID (`numeric_id`). */
  productId: number
  /** HQ-`id` - stabil, auch wenn sich die Nummerierung ändert. */
  productSlug: string
  productName: string
  unitPrice: number
  /** Vorgefundener Restbestand. `null` = nicht gezählt. */
  countedQty: number | null
  /** Neu eingeräumte Menge. */
  deliveredQty: number
  createdAt: Date
  updatedAt: Date
}

/**
 * Eine Produktzeile eines Besuchs: was lag noch da (`countedQty`) und was wurde
 * neu eingeräumt (`deliveredQty`). Verkäufe werden daraus abgeleitet:
 *
 *   Bestand nach Besuch k = countedQty_k + deliveredQty_k
 *   Verkauf im Intervall  = Bestand nach Besuch k − countedQty_(k+1)
 *
 * `productName` und `unitPrice` sind bewusst **Snapshots** aus HQ zum Zeitpunkt
 * des Besuchs und keine Verweise auf den aktuellen Produktstammsatz: ändert sich
 * später ein HQ-Preis oder ein Produktname, bleiben bereits erstellte
 * Abrechnungen und Partner-Reports historisch korrekt. Würde der Report die
 * heutigen Preise nachschlagen, würde eine Preiserhöhung rückwirkend alle
 * Altbelege umschreiben.
 */
export class PartnerVisitItem extends Model<
  InferAttributes<PartnerVisitItem>,
  InferCreationAttributes<PartnerVisitItem>
> {
  declare id: CreationOptional<number>
  declare visitId: ForeignKey<number>
  declare productId: number
  declare productSlug: string
  /** Snapshot des Produktnamens zum Zeitpunkt des Besuchs. */
  declare productName: string
  /** Snapshot des HQ-Preises zum Zeitpunkt des Besuchs. */
  declare unitPrice: CreationOptional<number>
  declare countedQty: CreationOptional<number | null>
  declare deliveredQty: CreationOptional<number>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  // Associations
  declare getVisit: BelongsToGetAssociationMixin<any>
  declare visit?: any

  static initModel(sequelize: Sequelize): typeof PartnerVisitItem {
    PartnerVisitItem.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        visitId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'PartnerVisits',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        productId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            isInt: {
              msg: 'Product id must be an integer',
            },
          },
        },
        productSlug: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Product slug cannot be empty',
            },
          },
        },
        productName: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: '',
        },
        unitPrice: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
          // Sequelize gibt DECIMAL je nach Dialekt als String zurück - die
          // Umsatzrechnung braucht aber verlässlich eine Zahl.
          get(this: PartnerVisitItem): number {
            const raw = this.getDataValue('unitPrice')
            const value = Number(raw)
            return Number.isFinite(value) ? value : 0
          },
          validate: {
            min: {
              args: [0],
              msg: 'Unit price cannot be negative',
            },
          },
        },
        countedQty: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: null,
          validate: {
            min: {
              args: [0],
              msg: 'Counted quantity cannot be negative',
            },
            isInt: {
              msg: 'Counted quantity must be an integer',
            },
          },
        },
        deliveredQty: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: {
              args: [0],
              msg: 'Delivered quantity cannot be negative',
            },
            isInt: {
              msg: 'Delivered quantity must be an integer',
            },
          },
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'PartnerVisitItem',
        tableName: 'PartnerVisitItems',
        timestamps: true,
        indexes: [
          {
            fields: ['visitId'],
          },
          {
            fields: ['productSlug'],
          },
        ],
        hooks: {
          beforeBulkCreate: (items: PartnerVisitItem[]) => {
            logger.debug(
              `Recording ${items.length} partner visit items for visit ${
                items[0]?.visitId ?? 'unknown'
              }`
            )
          },
        },
      }
    )

    return PartnerVisitItem
  }

  // Instance methods
  toJSON() {
    const values = { ...this.get() }
    return values
  }
}

// For backward compatibility
export default PartnerVisitItem
