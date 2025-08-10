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

export interface CashAttributes {
  id: number
  amount: number
  date: string // DATEONLY
  userId: number
  createdAt: Date
  updatedAt: Date
}

export class Cash extends Model<
  InferAttributes<Cash>,
  InferCreationAttributes<Cash>
> {
  declare id: CreationOptional<number>
  declare amount: number
  declare date: string
  declare userId: ForeignKey<number>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  // Associations
  declare getUser: BelongsToGetAssociationMixin<any>
  declare user?: any

  static initModel(sequelize: Sequelize): typeof Cash {
    Cash.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        amount: {
          type: DataTypes.FLOAT,
          allowNull: false,
          validate: {
            isFloat: {
              msg: 'Amount must be a valid number',
            },
          },
        },
        date: {
          type: DataTypes.DATEONLY,
          allowNull: false,
          validate: {
            isDate: {
              args: true,
              msg: 'Date must be a valid date',
            },
          },
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'Users',
            key: 'id',
          },
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'Cash',
        tableName: 'Cash',
        timestamps: true,
        hooks: {
          beforeCreate: (cash: Cash) => {
            logger.info(`Creating cash entry: Amount ${cash.amount}`)
          },
          beforeUpdate: (cash: Cash) => {
            logger.info(`Updating cash entry: Amount ${cash.amount}`)
          },
        },
      }
    )

    return Cash
  }

  // Instance methods
  toJSON() {
    const values = { ...this.get() }
    return values
  }
}

// For backward compatibility
export default Cash
