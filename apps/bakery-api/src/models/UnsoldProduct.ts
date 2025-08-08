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

export interface UnsoldProductAttributes {
  id: number
  quantity: number
  date: string // DATEONLY
  productId: number
  userId: number
  createdAt: Date
  updatedAt: Date
}

export class UnsoldProduct extends Model<
  InferAttributes<UnsoldProduct>,
  InferCreationAttributes<UnsoldProduct>
> {
  declare id: CreationOptional<number>
  declare quantity: number
  declare date: CreationOptional<string>
  declare productId: ForeignKey<number>
  declare userId: ForeignKey<number>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  // Associations
  declare getProduct: BelongsToGetAssociationMixin<any>
  declare getUser: BelongsToGetAssociationMixin<any>
  declare product?: any
  declare user?: any

  static initModel(sequelize: Sequelize): typeof UnsoldProduct {
    UnsoldProduct.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: 'Quantity cannot be negative',
            },
            isInt: {
              msg: 'Quantity must be an integer',
            },
          },
        },
        date: {
          type: DataTypes.DATEONLY,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        productId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'Products',
            key: 'id',
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
        modelName: 'UnsoldProduct',
        tableName: 'UnsoldProducts',
        timestamps: true,
        hooks: {
          beforeCreate: (unsoldProduct: UnsoldProduct) => {
            logger.info(
              `Recording unsold product: ${unsoldProduct.quantity} units on ${unsoldProduct.date}`
            )
          },
        },
      }
    )

    return UnsoldProduct
  }

  // Instance methods
  toJSON() {
    const values = { ...this.get() }
    return values
  }
}

// For backward compatibility
export default UnsoldProduct
