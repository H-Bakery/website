import { Request, Response } from 'express';
import { Transaction } from 'sequelize';
import { Order } from '../models/order.model';
import { OrderItem } from '../models/order-item.model';
import { logger } from '@bakery/api/core';
import { createNewOrderNotification } from '@bakery/api/notifications';

interface OrderRequestBody {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  pickupDate: Date;
  status?: string;
  notes?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalPrice: number;
}

export class OrderController {
  // Get all orders
  static async getOrders(req: Request, res: Response): Promise<void> {
    console.log('Processing get all orders request...');
    logger.info('Processing get all orders request...');
    
    try {
      const orders = await Order.findAll({
        include: [{ model: OrderItem, as: 'orderItems' }],
        order: [['createdAt', 'DESC']],
      });

      logger.info(`Retrieved ${orders.length} orders`);
      res.json(orders);
    } catch (error) {
      logger.error('Order retrieval error:', error);
      res.status(500).json({ error: 'Database error' });
    }
  }

  // Get a specific order
  static async getOrder(req: Request, res: Response): Promise<void> {
    const orderId = req.params['id'];
    logger.info(`Processing get order request for ID: ${orderId}`);
    
    try {
      const order = await Order.findByPk(orderId, {
        include: [{ model: OrderItem, as: 'orderItems' }],
      });

      if (!order) {
        logger.warn(`Order not found: ${orderId}`);
        res.status(404).json({ message: 'Order not found' });
        return;
      }

      logger.info(`Order ${orderId} retrieved successfully`);
      res.json(order);
    } catch (error) {
      logger.error(`Error retrieving order ${orderId}:`, error);
      res.status(500).json({ error: 'Database error' });
    }
  }

  // Create a new order
  static async createOrder(req: Request<{}, {}, OrderRequestBody>, res: Response): Promise<void> {
    logger.info('Processing create order request...');
    
    try {
      const {
        customerName,
        customerPhone,
        customerEmail,
        pickupDate,
        status,
        notes,
        items,
        totalPrice,
      } = req.body;

      logger.info(`Creating order for customer: ${customerName}`);

      // Create order in transaction to ensure all items are saved
      const result = await Order.sequelize!.transaction(async (t: Transaction) => {
        // Create the order
        const order = await Order.create(
          {
            customerName,
            customerPhone,
            customerEmail,
            pickupDate,
            status,
            notes,
            totalPrice,
          },
          { transaction: t }
        );

        // Create all order items
        if (items && items.length > 0) {
          const orderItems = items.map((item) => ({
            orderId: order.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }));

          await OrderItem.bulkCreate(orderItems, { transaction: t });
        }

        return order;
      });

      logger.info(`Order created with ID: ${result.id}`);

      // Send notification for new order
      await createNewOrderNotification({
        id: result.id,
        customerName: result.customerName,
        totalAmount: result.totalPrice || 0,
      });

      // Fetch the complete order with items to return
      const createdOrder = await Order.findByPk(result.id, {
        include: [{ model: OrderItem, as: 'orderItems' }],
      });

      res.status(201).json(createdOrder);
    } catch (error: any) {
      logger.error('Order creation error:', error);
      res
        .status(500)
        .json({ error: 'Error creating order', details: error.message });
    }
  }

  // Update an order
  static async updateOrder(req: Request<{ id: string }, {}, OrderRequestBody>, res: Response): Promise<void> {
    const orderId = req.params['id'];
    logger.info(`Processing update order request for ID: ${orderId}`);
    
    try {
      const {
        customerName,
        customerPhone,
        customerEmail,
        pickupDate,
        status,
        notes,
        items,
        totalPrice,
      } = req.body;

      // Find the order
      const order = await Order.findByPk(orderId);

      if (!order) {
        logger.warn(`Order not found for update: ${orderId}`);
        res.status(404).json({ message: 'Order not found' });
        return;
      }

      // Update in transaction
      await Order.sequelize!.transaction(async (t: Transaction) => {
        // Update order details
        await order.update(
          {
            customerName,
            customerPhone,
            customerEmail,
            pickupDate,
            status,
            notes,
            totalPrice,
          },
          { transaction: t }
        );

        // Delete existing items
        await OrderItem.destroy({
          where: { orderId: order.id },
          transaction: t,
        });

        // Create new items
        if (items && items.length > 0) {
          const orderItems = items.map((item) => ({
            orderId: order.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }));

          await OrderItem.bulkCreate(orderItems, { transaction: t });
        }
      });

      logger.info(`Order ${orderId} updated successfully`);

      // Fetch updated order with items
      const updatedOrder = await Order.findByPk(orderId, {
        include: [{ model: OrderItem, as: 'orderItems' }],
      });

      res.json(updatedOrder);
    } catch (error: any) {
      logger.error(`Error updating order ${orderId}:`, error);
      res
        .status(500)
        .json({ error: 'Error updating order', details: error.message });
    }
  }

  // Delete an order
  static async deleteOrder(req: Request<{ id: string }>, res: Response): Promise<void> {
    const orderId = req.params['id'];
    logger.info(`Processing delete order request for ID: ${orderId}`);
    
    try {
      const order = await Order.findByPk(orderId);

      if (!order) {
        logger.warn(`Order not found for deletion: ${orderId}`);
        res.status(404).json({ message: 'Order not found' });
        return;
      }

      // Delete in transaction
      await Order.sequelize!.transaction(async (t: Transaction) => {
        // Delete order items first
        await OrderItem.destroy({
          where: { orderId: order.id },
          transaction: t,
        });

        // Delete order
        await order.destroy({ transaction: t });
      });

      logger.info(`Order ${orderId} deleted successfully`);
      res.json({ message: 'Order deleted' });
    } catch (error) {
      logger.error(`Error deleting order ${orderId}:`, error);
      res.status(500).json({ error: 'Error deleting order' });
    }
  }
}