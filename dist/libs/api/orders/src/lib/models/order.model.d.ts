import { Model, Sequelize, Association } from 'sequelize'
import { OrderItem } from './order-item.model'
export interface OrderAttributes {
  id?: number
  customerName: string
  customerPhone?: string
  customerEmail?: string
  pickupDate: Date
  status?: string
  notes?: string
  totalPrice?: number
  createdAt?: Date
  updatedAt?: Date
  deletedAt?: Date
}
export interface OrderCreationAttributes
  extends Omit<
    OrderAttributes,
    'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
  > {}
export declare class Order
  extends Model<OrderAttributes, OrderCreationAttributes>
  implements OrderAttributes
{
  id: number
  customerName: string
  customerPhone?: string
  customerEmail?: string
  pickupDate: Date
  status: string
  notes?: string
  totalPrice: number
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly deletedAt?: Date
  readonly orderItems?: OrderItem[]
  static associations: {
    orderItems: Association<Order, OrderItem>
  }
  static initialize(sequelize: Sequelize): void
  static associate(models: any): void
}
