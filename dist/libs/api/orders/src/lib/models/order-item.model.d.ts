import { Model, Sequelize, Association } from 'sequelize';
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
export interface OrderItemCreationAttributes extends Omit<OrderItemAttributes, 'id' | 'createdAt' | 'updatedAt'> {
}
export declare class OrderItem extends Model<OrderItemAttributes, OrderItemCreationAttributes> implements OrderItemAttributes {
    id: number;
    orderId: number;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly order?: Order;
    static associations: {
        order: Association<OrderItem, Order>;
    };
    static initialize(sequelize: Sequelize): void;
    static associate(models: any): void;
}
