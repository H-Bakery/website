import { DataTypes, Model, Sequelize, Association } from 'sequelize';
import { OrderItem } from './order-item.model';

export interface OrderAttributes {
  id?: number;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  pickupDate: Date;
  status?: string;
  notes?: string;
  totalPrice?: number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface OrderCreationAttributes extends Omit<OrderAttributes, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

export class Order extends Model<OrderAttributes, OrderCreationAttributes> implements OrderAttributes {
  public id!: number;
  public customerName!: string;
  public customerPhone?: string;
  public customerEmail?: string;
  public pickupDate!: Date;
  public status!: string;
  public notes?: string;
  public totalPrice!: number;

  // timestamps!
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt?: Date;

  // associations
  public readonly orderItems?: OrderItem[];

  public static override associations: {
    orderItems: Association<Order, OrderItem>;
  };

  public static initialize(sequelize: Sequelize): void {
    Order.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        customerName: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        customerPhone: {
          type: DataTypes.STRING,
        },
        customerEmail: {
          type: DataTypes.STRING,
        },
        pickupDate: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        status: {
          type: DataTypes.STRING,
          defaultValue: 'Pending',
        },
        notes: {
          type: DataTypes.TEXT,
        },
        totalPrice: {
          type: DataTypes.FLOAT,
          defaultValue: 0,
        },
      },
      {
        sequelize,
        modelName: 'Order',
        tableName: 'Orders',
        timestamps: true,
        paranoid: true, // Enable soft deletes
      }
    );
  }

  public static associate(models: any): void {
    if (models.OrderItem) {
      Order.hasMany(models.OrderItem, {
        as: 'orderItems',
        foreignKey: 'orderId',
      });
    }
  }
}