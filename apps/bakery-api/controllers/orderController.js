const models = require("../models");
const logger = require("../utils/logger");
const { createNewOrderNotification } = require("../utils/notificationHelper");

// Get all orders
exports.getOrders = async (req, res) => {
  console.log("Processing get all orders request...");
  logger.info("Processing get all orders request...");
  try {
    const orders = await models.Order.findAll({
      include: [{ model: models.OrderItem }],
      order: [["createdAt", "DESC"]],
    });

    logger.info(`Retrieved ${orders.length} orders`);
    res.json(orders);
  } catch (error) {
    logger.error("Order retrieval error:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Get a specific order
exports.getOrder = async (req, res) => {
  logger.info(`Processing get order request for ID: ${req.params.id}`);
  try {
    const order = await models.Order.findByPk(req.params.id, {
      include: [{ model: models.OrderItem }],
    });

    if (!order) {
      logger.warn(`Order not found: ${req.params.id}`);
      return res.status(404).json({ message: "Order not found" });
    }

    logger.info(`Order ${req.params.id} retrieved successfully`);
    res.json(order);
  } catch (error) {
    logger.error(`Error retrieving order ${req.params.id}:`, error);
    res.status(500).json({ error: "Database error" });
  }
};

// Create a new order
exports.createOrder = async (req, res) => {
  logger.info("Processing create order request...");
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
    const result = await models.sequelize.transaction(async (t) => {
      // Create the order
      const order = await models.Order.create(
        {
          customerName,
          customerPhone,
          customerEmail,
          pickupDate,
          status,
          notes,
          totalPrice,
        },
        { transaction: t },
      );

      // Create all order items
      if (items && items.length > 0) {
        const orderItems = items.map((item) => ({
          OrderId: order.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }));

        await models.OrderItem.bulkCreate(orderItems, { transaction: t });
      }

      return order;
    });

    logger.info(`Order created with ID: ${result.id}`);
    
    // Send notification for new order
    await createNewOrderNotification({
      id: result.id,
      customerName: result.customerName,
      totalAmount: result.totalPrice
    });

    // Fetch the complete order with items to return
    const createdOrder = await models.Order.findByPk(result.id, {
      include: [{ model: models.OrderItem }],
    });

    res.status(201).json(createdOrder);
  } catch (error) {
    logger.error("Order creation error:", error);
    res
      .status(500)
      .json({ error: "Error creating order", details: error.message });
  }
};

// Update an order
exports.updateOrder = async (req, res) => {
  logger.info(`Processing update order request for ID: ${req.params.id}`);
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
    const order = await models.Order.findByPk(req.params.id);

    if (!order) {
      logger.warn(`Order not found for update: ${req.params.id}`);
      return res.status(404).json({ message: "Order not found" });
    }

    // Update in transaction
    await models.sequelize.transaction(async (t) => {
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
        { transaction: t },
      );

      // Delete existing items
      await models.OrderItem.destroy({
        where: { OrderId: order.id },
        transaction: t,
      });

      // Create new items
      if (items && items.length > 0) {
        const orderItems = items.map((item) => ({
          OrderId: order.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }));

        await models.OrderItem.bulkCreate(orderItems, { transaction: t });
      }
    });

    logger.info(`Order ${req.params.id} updated successfully`);

    // Fetch updated order with items
    const updatedOrder = await models.Order.findByPk(req.params.id, {
      include: [{ model: models.OrderItem }],
    });

    res.json(updatedOrder);
  } catch (error) {
    logger.error(`Error updating order ${req.params.id}:`, error);
    res
      .status(500)
      .json({ error: "Error updating order", details: error.message });
  }
};

// Delete an order
exports.deleteOrder = async (req, res) => {
  logger.info(`Processing delete order request for ID: ${req.params.id}`);
  try {
    const order = await models.Order.findByPk(req.params.id);

    if (!order) {
      logger.warn(`Order not found for deletion: ${req.params.id}`);
      return res.status(404).json({ message: "Order not found" });
    }

    // Delete in transaction
    await models.sequelize.transaction(async (t) => {
      // Delete order items first
      await models.OrderItem.destroy({
        where: { OrderId: order.id },
        transaction: t,
      });

      // Delete order
      await order.destroy({ transaction: t });
    });

    logger.info(`Order ${req.params.id} deleted successfully`);
    res.json({ message: "Order deleted" });
  } catch (error) {
    logger.error(`Error deleting order ${req.params.id}:`, error);
    res.status(500).json({ error: "Error deleting order" });
  }
};
