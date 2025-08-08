import { DataTypes, Model, Sequelize } from 'sequelize'

export interface OrderItemAttributes {
  id: number
  orderId: number
  productId: number
  quantity: number
  price: number
  total: number
  createdAt?: Date
  updatedAt?: Date
}

export interface OrderItemCreationAttributes
  extends Omit<OrderItemAttributes, 'id'> {}

class OrderItem
  extends Model<OrderItemAttributes, OrderItemCreationAttributes>
  implements OrderItemAttributes
{
  public id!: number
  public orderId!: number
  public productId!: number
  public quantity!: number
  public price!: number
  public total!: number
  public readonly createdAt!: Date
  public readonly updatedAt!: Date

  static initModel(sequelize: Sequelize): typeof OrderItem {
    OrderItem.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        orderId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        productId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        price: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
        },
        total: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: 'OrderItem',
        tableName: 'order_items',
        timestamps: true,
      }
    )
    return OrderItem
  }
}

export default OrderItem
