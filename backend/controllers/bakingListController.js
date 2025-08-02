const models = require("../models");
const { Op } = require("sequelize");
const logger = require("../utils/logger");

// Generate baking list for a specific date
exports.getBakingList = async (req, res) => {
  logger.info("Processing baking list request...");
  try {
    // Get the requested date or default to today
    const requestDate =
      req.query.date || new Date().toISOString().split("T")[0];
    logger.info(`Generating baking list for date: ${requestDate}`);

    // Start and end of the requested date
    const dayStart = new Date(requestDate);
    const dayEnd = new Date(requestDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Get all active orders for the date
    const orders = await models.Order.findAll({
      where: {
        pickupDate: {
          [Op.between]: [dayStart, dayEnd],
        },
        status: {
          [Op.in]: ["Pending", "Confirmed"],
        },
      },
      include: [{ model: models.OrderItem }],
    });

    logger.info(`Found ${orders.length} orders for date ${requestDate}`);

    // Get all products
    const products = await models.Product.findAll({
      where: { isActive: true },
    });

    // Calculate quantities needed for shop inventory
    const shopItems = products.map((product) => ({
      productId: product.id,
      name: product.name,
      dailyTarget: product.dailyTarget,
      currentStock: product.stock,
      shopQuantity: Math.max(0, product.dailyTarget - product.stock),
    }));

    // Calculate quantities needed for orders
    const orderItemsMap = {};
    orders.forEach((order) => {
      order.OrderItems.forEach((item) => {
        if (!orderItemsMap[item.productId]) {
          orderItemsMap[item.productId] = {
            productId: item.productId,
            name: item.productName,
            orderQuantity: 0,
          };
        }
        orderItemsMap[item.productId].orderQuantity += item.quantity;
      });
    });

    // Combine shop and order requirements
    const allItemsMap = {};

    // Add shop items first
    shopItems.forEach((item) => {
      allItemsMap[item.productId] = {
        ...item,
        orderQuantity: 0,
        totalQuantity: item.shopQuantity,
      };
    });

    // Add order items
    Object.values(orderItemsMap).forEach((item) => {
      if (!allItemsMap[item.productId]) {
        // Product only in orders, not in shop inventory
        allItemsMap[item.productId] = {
          productId: item.productId,
          name: item.name,
          shopQuantity: 0,
          orderQuantity: item.orderQuantity,
          totalQuantity: item.orderQuantity,
        };
      } else {
        // Product in both shop and orders
        allItemsMap[item.productId].orderQuantity = item.orderQuantity;
        allItemsMap[item.productId].totalQuantity += item.orderQuantity;
      }
    });

    // Format order data for the response
    const formattedOrders = orders.map((order) => ({
      orderId: order.id,
      customerName: order.customerName,
      pickupDate: order.pickupDate,
      status: order.status,
      notes: order.notes,
      items: order.OrderItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
      })),
    }));

    logger.info("Baking list generated successfully");
    res.json({
      date: requestDate,
      allItems: Object.values(allItemsMap),
      shopItems: shopItems,
      orderItems: formattedOrders,
    });
  } catch (error) {
    logger.error("Error generating baking list:", error);
    res.status(500).json({ error: "Error generating baking list" });
  }
};
