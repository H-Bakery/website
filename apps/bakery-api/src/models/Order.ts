import { DataTypes, Model, Sequelize } from 'sequelize'

export interface OrderAttributes {
  id: number
  customerId: number
  total: number
  status: string
  notes?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface OrderCreationAttributes extends Omit<OrderAttributes, 'id'> {}

class Order
  extends Model<OrderAttributes, OrderCreationAttributes>
  implements OrderAttributes
{
  public id!: number
  public customerId!: number
  public total!: number
  public status!: string
  public notes?: string
  public readonly createdAt!: Date
  public readonly updatedAt!: Date

  static initModel(sequelize: Sequelize): typeof Order {
    Order.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        customerId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        total: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
        },
        status: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'pending',
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: 'Order',
        tableName: 'orders',
        timestamps: true,
      }
    )
    return Order
  }
}

export default Order
