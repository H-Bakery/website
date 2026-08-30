import {
  Model,
  DataTypes,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  HasManyGetAssociationsMixin,
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

/**
 * Abrechnungsmodell eines Verkaufspartners.
 * `commission`  - Kommission: der Partner zahlt nur, was verkauft wurde.
 * `firm_sale`   - Festkauf: der Partner kauft die Ware fest ab.
 */
export type SettlementModel = 'commission' | 'firm_sale'

export const SETTLEMENT_MODELS: SettlementModel[] = ['commission', 'firm_sale']

export interface PartnerAttributes {
  id: number
  name: string
  slug: string
  street: string
  zip: string
  city: string
  contactName: string | null
  phone: string | null
  email: string | null
  /** ISO-Wochentage, 1 = Montag … 7 = Sonntag. CAP-Markt: [2,3,4,5,6] (Di–Sa). */
  deliveryDays: number[]
  settlementModel: SettlementModel
  active: boolean
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Ein Verkaufspartner, der unsere Ware in seinen Räumen anbietet
 * (erster Datensatz: CAP-Markt Homburg-Kirrberg mit seinem "Backschrank").
 * Bewusst generisch modelliert - weitere Partner brauchen kein neues Modell.
 */
export class Partner extends Model<
  InferAttributes<Partner>,
  InferCreationAttributes<Partner>
> {
  declare id: CreationOptional<number>
  declare name: string
  declare slug: string
  declare street: CreationOptional<string>
  declare zip: CreationOptional<string>
  declare city: CreationOptional<string>
  declare contactName: CreationOptional<string | null>
  declare phone: CreationOptional<string | null>
  declare email: CreationOptional<string | null>
  /** ISO-Wochentage, 1 = Montag … 7 = Sonntag. */
  declare deliveryDays: CreationOptional<number[]>
  declare settlementModel: CreationOptional<SettlementModel>
  declare active: CreationOptional<boolean>
  declare notes: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  // Associations
  declare getTemplates: HasManyGetAssociationsMixin<any>
  declare getVisits: HasManyGetAssociationsMixin<any>
  declare templates?: any
  declare visits?: any

  static initModel(sequelize: Sequelize): typeof Partner {
    Partner.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Partner name cannot be empty',
            },
          },
        },
        slug: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: {
            notEmpty: {
              msg: 'Partner slug cannot be empty',
            },
          },
        },
        street: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: '',
        },
        zip: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: '',
        },
        city: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: '',
        },
        contactName: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        phone: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        email: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        deliveryDays: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
          validate: {
            isWeekdayList(value: any) {
              if (!Array.isArray(value)) {
                throw new Error('deliveryDays must be an array')
              }
              const invalid = value.filter(
                (day: any) => !Number.isInteger(day) || day < 1 || day > 7
              )
              if (invalid.length > 0) {
                throw new Error(
                  'deliveryDays must only contain ISO weekdays (1-7)'
                )
              }
            },
          },
        },
        settlementModel: {
          type: DataTypes.ENUM('commission', 'firm_sale'),
          allowNull: false,
          defaultValue: 'commission',
        },
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'Partner',
        tableName: 'Partners',
        timestamps: true,
        indexes: [
          {
            fields: ['active'],
          },
        ],
        hooks: {
          beforeCreate: (partner: Partner) => {
            logger.info(`Creating sales partner: ${partner.name}`)
          },
        },
      }
    )

    return Partner
  }

  // Instance methods
  toJSON() {
    const values = { ...this.get() }
    return values
  }
}

// For backward compatibility
export default Partner
