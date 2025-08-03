import { DataTypes, Model, Sequelize, Association } from 'sequelize';
import { Order } from './order.model';

export interface OrderItemAttributes {
  id?: number;
  orderId?: number;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrderItemCreationAttributes extends Omit<OrderItemAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class OrderItem extends Model<OrderItemAttributes, OrderItemCreationAttributes> implements OrderItemAttributes {
  public id!: number;
  public orderId!: number;
  public productId!: string;
  public productName!: string;
  public quantity!: number;
  public unitPrice!: number;

  // timestamps!
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // associations
  public readonly order?: Order;

  public static override associations: {
    order: Association<OrderItem, Order>;
  };

  public static initialize(sequelize: Sequelize): void {
    OrderItem.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        productId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        productName: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        unitPrice: {
          type: DataTypes.FLOAT,
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: 'OrderItem',
        tableName: 'OrderItems',
        timestamps: true,
      }
    );
  }

  public static associate(models: any): void {
    if (models.Order) {
      OrderItem.belongsTo(models.Order, {
        as: 'order',
        foreignKey: 'orderId',
      });
    }
  }
}