import { DataTypes, Model, Sequelize } from 'sequelize'

export interface StockAdjustmentAttributes {
  id: number
  inventoryId: number
  adjustmentType: 'increase' | 'decrease' | 'set'
  quantity: number
  previousQuantity: number
  newQuantity: number
  reason: string
  performedBy?: number
  notes?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface StockAdjustmentCreationAttributes
  extends Omit<StockAdjustmentAttributes, 'id'> {}

class StockAdjustment
  extends Model<StockAdjustmentAttributes, StockAdjustmentCreationAttributes>
  implements StockAdjustmentAttributes
{
  public id!: number
  public inventoryId!: number
  public adjustmentType!: 'increase' | 'decrease' | 'set'
  public quantity!: number
  public previousQuantity!: number
  public newQuantity!: number
  public reason!: string
  public performedBy?: number
  public notes?: string
  public readonly createdAt!: Date
  public readonly updatedAt!: Date

  static initModel(sequelize: Sequelize): typeof StockAdjustment {
    StockAdjustment.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        inventoryId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'inventory',
            key: 'id',
          },
        },
        adjustmentType: {
          type: DataTypes.ENUM('increase', 'decrease', 'set'),
          allowNull: false,
        },
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        previousQuantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        newQuantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        reason: {
          type: DataTypes.STRING(200),
          allowNull: false,
        },
        performedBy: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: 'StockAdjustment',
        tableName: 'stock_adjustments',
        timestamps: true,
      }
    )
    return StockAdjustment
  }
}

export default StockAdjustment
