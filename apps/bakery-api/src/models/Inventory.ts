import { DataTypes, Model, Sequelize } from 'sequelize'

export interface InventoryAttributes {
  id: number
  productId: number
  quantity: number
  minimumQuantity: number
  maximumQuantity?: number
  reorderPoint?: number
  location?: string
  unit?: string
  category?: string
  supplier?: string
  supplierContact?: string
  lastRestocked?: Date
  notes?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface InventoryCreationAttributes
  extends Omit<InventoryAttributes, 'id'> {}

class Inventory
  extends Model<InventoryAttributes, InventoryCreationAttributes>
  implements InventoryAttributes
{
  public id!: number
  public productId!: number
  public quantity!: number
  public minimumQuantity!: number
  public maximumQuantity?: number
  public reorderPoint?: number
  public location?: string
  public unit?: string
  public category?: string
  public supplier?: string
  public supplierContact?: string
  public lastRestocked?: Date
  public notes?: string
  public readonly createdAt!: Date
  public readonly updatedAt!: Date

  static initModel(sequelize: Sequelize): typeof Inventory {
    Inventory.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        productId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          unique: true,
        },
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        minimumQuantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        maximumQuantity: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        reorderPoint: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: 10,
        },
        location: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        unit: {
          type: DataTypes.STRING(50),
          allowNull: true,
          defaultValue: 'pieces',
        },
        category: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        supplier: {
          type: DataTypes.STRING(200),
          allowNull: true,
        },
        supplierContact: {
          type: DataTypes.STRING(200),
          allowNull: true,
        },
        lastRestocked: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: 'Inventory',
        tableName: 'inventory',
        timestamps: true,
      }
    )
    return Inventory
  }
}

export default Inventory
