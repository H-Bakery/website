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

/** Eine Position der Standard-Bestückung: Produkt + Standardmenge. */
export interface TemplateItem {
  /** Numerische HQ-ID (`numeric_id`). */
  productId: number
  /** HQ-`id` - stabil, auch wenn sich die Nummerierung ändert. */
  productSlug: string
  quantity: number
}

export interface PartnerDeliveryTemplateAttributes {
  id: number
  partnerId: number
  /** ISO-Wochentag, 1 = Montag … 7 = Sonntag. */
  weekday: number
  items: TemplateItem[]
  active: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Standard-Bestückung eines Partners je Wochentag.
 * Dient als Vorbefüllung der Erfassungsmaske - genau eine Vorlage
 * je Partner und Wochentag (Unique-Index auf `partnerId` + `weekday`).
 */
export class PartnerDeliveryTemplate extends Model<
  InferAttributes<PartnerDeliveryTemplate>,
  InferCreationAttributes<PartnerDeliveryTemplate>
> {
  declare id: CreationOptional<number>
  declare partnerId: ForeignKey<number>
  declare weekday: number
  declare items: CreationOptional<TemplateItem[]>
  declare active: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  // Associations
  declare getPartner: BelongsToGetAssociationMixin<any>
  declare partner?: any

  static initModel(sequelize: Sequelize): typeof PartnerDeliveryTemplate {
    PartnerDeliveryTemplate.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        partnerId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'Partners',
            key: 'id',
          },
        },
        weekday: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            isInt: {
              msg: 'Weekday must be an integer',
            },
            min: {
              args: [1],
              msg: 'Weekday must be an ISO weekday between 1 and 7',
            },
            max: {
              args: [7],
              msg: 'Weekday must be an ISO weekday between 1 and 7',
            },
          },
        },
        items: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
          validate: {
            isTemplateItemList(value: any) {
              if (!Array.isArray(value)) {
                throw new Error('items must be an array')
              }
              value.forEach((item: any) => {
                if (!item || typeof item !== 'object') {
                  throw new Error('Each template item must be an object')
                }
                if (!Number.isInteger(item.productId)) {
                  throw new Error(
                    'Each template item needs a numeric productId'
                  )
                }
                if (typeof item.productSlug !== 'string' || !item.productSlug) {
                  throw new Error('Each template item needs a productSlug')
                }
                if (!Number.isFinite(item.quantity) || item.quantity < 0) {
                  throw new Error(
                    'Each template item needs a quantity of zero or more'
                  )
                }
              })
            },
          },
        },
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'PartnerDeliveryTemplate',
        tableName: 'PartnerDeliveryTemplates',
        timestamps: true,
        indexes: [
          {
            name: 'unique_partner_weekday_template',
            unique: true,
            fields: ['partnerId', 'weekday'],
          },
        ],
        hooks: {
          beforeSave: (template: PartnerDeliveryTemplate) => {
            logger.info(
              `Saving delivery template for partner ${
                template.partnerId
              }, weekday ${template.weekday} (${
                Array.isArray(template.items) ? template.items.length : 0
              } items)`
            )
          },
        },
      }
    )

    return PartnerDeliveryTemplate
  }

  // Instance methods
  toJSON() {
    const values = { ...this.get() }
    return values
  }
}

// For backward compatibility
export default PartnerDeliveryTemplate
