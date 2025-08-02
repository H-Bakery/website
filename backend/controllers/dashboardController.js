const { Order, OrderItem, Product, Cash, UnsoldProduct, User, sequelize } = require("../models");
const { Op } = require("sequelize");
const logger = require("../utils/logger");

// Get sales summary analytics
exports.getSalesSummary = async (req, res) => {
  logger.info("Processing sales summary request...");
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Total sales for the period
    const totalSales = await Order.sum('totalPrice', {
      where: {
        createdAt: {
          [Op.gte]: startDate
        }
      }
    });

    // Order count for the period
    const orderCount = await Order.count({
      where: {
        createdAt: {
          [Op.gte]: startDate
        }
      }
    });

    // Average order value
    const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;

    // Daily sales data for charts
    const dailySales = await sequelize.query(`
      SELECT 
        DATE(createdAt) as date,
        COUNT(*) as orders,
        COALESCE(SUM(totalPrice), 0) as revenue
      FROM Orders 
      WHERE createdAt >= :startDate
      GROUP BY DATE(createdAt)
      ORDER BY DATE(createdAt) ASC
    `, {
      replacements: { startDate: startDate.toISOString() },
      type: sequelize.QueryTypes.SELECT
    });

    // Order status breakdown
    const statusBreakdown = await Order.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('status')), 'count']
      ],
      where: {
        createdAt: {
          [Op.gte]: startDate
        }
      },
      group: ['status']
    });

    logger.info(`Sales summary generated for ${days} days`);
    res.json({
      success: true,
      data: {
        totalSales: totalSales || 0,
        orderCount: orderCount || 0,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        dailySales,
        statusBreakdown,
        period: `${days} days`
      }
    });
  } catch (error) {
    logger.error("Sales summary error:", error);
    res.status(500).json({ success: false, error: "Database error" });
  }
};

// Get production overview analytics
exports.getProductionOverview = async (req, res) => {
  logger.info("Processing production overview request...");
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Most ordered products
    const topProducts = await sequelize.query(`
      SELECT 
        p.name,
        p.category,
        SUM(oi.quantity) as totalQuantity,
        COUNT(DISTINCT o.id) as orderCount,
        SUM(oi.quantity * oi.price) as revenue
      FROM OrderItems oi
      JOIN Orders o ON oi.OrderId = o.id
      JOIN Products p ON oi.ProductId = p.id
      WHERE o.createdAt >= :startDate
      GROUP BY p.id, p.name, p.category
      ORDER BY totalQuantity DESC
      LIMIT 10
    `, {
      replacements: { startDate: startDate.toISOString() },
      type: sequelize.QueryTypes.SELECT
    });

    // Production by category
    const categoryBreakdown = await sequelize.query(`
      SELECT 
        p.category,
        SUM(oi.quantity) as totalQuantity,
        COUNT(DISTINCT p.id) as productCount,
        SUM(oi.quantity * oi.price) as revenue
      FROM OrderItems oi
      JOIN Orders o ON oi.OrderId = o.id
      JOIN Products p ON oi.ProductId = p.id
      WHERE o.createdAt >= :startDate
      GROUP BY p.category
      ORDER BY totalQuantity DESC
    `, {
      replacements: { startDate: startDate.toISOString() },
      type: sequelize.QueryTypes.SELECT
    });

    // Daily production volume
    const dailyProduction = await sequelize.query(`
      SELECT 
        DATE(o.createdAt) as date,
        SUM(oi.quantity) as totalItems,
        COUNT(DISTINCT oi.ProductId) as uniqueProducts
      FROM OrderItems oi
      JOIN Orders o ON oi.OrderId = o.id
      WHERE o.createdAt >= :startDate
      GROUP BY DATE(o.createdAt)
      ORDER BY DATE(o.createdAt) ASC
    `, {
      replacements: { startDate: startDate.toISOString() },
      type: sequelize.QueryTypes.SELECT
    });

    logger.info(`Production overview generated for ${days} days`);
    res.json({
      success: true,
      data: {
        topProducts,
        categoryBreakdown,
        dailyProduction,
        period: `${days} days`
      }
    });
  } catch (error) {
    logger.error("Production overview error:", error);
    res.status(500).json({ success: false, error: "Database error" });
  }
};

// Get revenue analytics
exports.getRevenueAnalytics = async (req, res) => {
  logger.info("Processing revenue analytics request...");
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Cash entries for the period
    const cashData = await Cash.findAll({
      where: {
        date: {
          [Op.gte]: startDate.toISOString().split('T')[0]
        }
      },
      order: [['date', 'ASC']]
    });

    // Calculate revenue from orders
    const orderRevenue = await sequelize.query(`
      SELECT 
        DATE(createdAt) as date,
        SUM(totalPrice) as revenue,
        COUNT(*) as orders
      FROM Orders 
      WHERE createdAt >= :startDate
      GROUP BY DATE(createdAt)
      ORDER BY DATE(createdAt) ASC
    `, {
      replacements: { startDate: startDate.toISOString() },
      type: sequelize.QueryTypes.SELECT
    });

    // Revenue by product category
    const categoryRevenue = await sequelize.query(`
      SELECT 
        p.category,
        SUM(oi.quantity * oi.price) as revenue,
        AVG(oi.price) as avgPrice,
        SUM(oi.quantity) as totalQuantity
      FROM OrderItems oi
      JOIN Orders o ON oi.OrderId = o.id
      JOIN Products p ON oi.ProductId = p.id
      WHERE o.createdAt >= :startDate
      GROUP BY p.category
      ORDER BY revenue DESC
    `, {
      replacements: { startDate: startDate.toISOString() },
      type: sequelize.QueryTypes.SELECT
    });

    // Total metrics
    const totalRevenue = orderRevenue.reduce((sum, day) => sum + parseFloat(day.revenue || 0), 0);
    const totalCash = cashData.reduce((sum, entry) => sum + parseFloat(entry.amount || 0), 0);

    logger.info(`Revenue analytics generated for ${days} days`);
    res.json({
      success: true,
      data: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCash: Math.round(totalCash * 100) / 100,
        dailyCash: cashData,
        dailyRevenue: orderRevenue,
        categoryRevenue,
        period: `${days} days`
      }
    });
  } catch (error) {
    logger.error("Revenue analytics error:", error);
    res.status(500).json({ success: false, error: "Database error" });
  }
};

// Get order analytics
exports.getOrderAnalytics = async (req, res) => {
  logger.info("Processing order analytics request...");
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Order metrics
    const orderMetrics = await sequelize.query(`
      SELECT 
        COUNT(*) as totalOrders,
        AVG(totalPrice) as avgOrderValue,
        MIN(totalPrice) as minOrderValue,
        MAX(totalPrice) as maxOrderValue,
        COUNT(DISTINCT customerName) as uniqueCustomers
      FROM Orders 
      WHERE createdAt >= :startDate
    `, {
      replacements: { startDate: startDate.toISOString() },
      type: sequelize.QueryTypes.SELECT
    });

    // Orders by hour (to see peak times)
    const ordersByHour = await sequelize.query(`
      SELECT 
        CAST(strftime('%H', createdAt) AS INTEGER) as hour,
        COUNT(*) as orderCount,
        AVG(totalPrice) as avgValue
      FROM Orders 
      WHERE createdAt >= :startDate
      GROUP BY CAST(strftime('%H', createdAt) AS INTEGER)
      ORDER BY hour ASC
    `, {
      replacements: { startDate: startDate.toISOString() },
      type: sequelize.QueryTypes.SELECT
    });

    // Orders by day of week
    const ordersByDayOfWeek = await sequelize.query(`
      SELECT 
        CASE CAST(strftime('%w', createdAt) AS INTEGER)
          WHEN 0 THEN 'Sonntag'
          WHEN 1 THEN 'Montag'
          WHEN 2 THEN 'Dienstag'
          WHEN 3 THEN 'Mittwoch'
          WHEN 4 THEN 'Donnerstag'
          WHEN 5 THEN 'Freitag'
          WHEN 6 THEN 'Samstag'
        END as dayOfWeek,
        CAST(strftime('%w', createdAt) AS INTEGER) as dayNumber,
        COUNT(*) as orderCount,
        AVG(totalPrice) as avgValue
      FROM Orders 
      WHERE createdAt >= :startDate
      GROUP BY CAST(strftime('%w', createdAt) AS INTEGER)
      ORDER BY dayNumber ASC
    `, {
      replacements: { startDate: startDate.toISOString() },
      type: sequelize.QueryTypes.SELECT
    });

    // Top customers
    const topCustomers = await sequelize.query(`
      SELECT 
        customerName,
        COUNT(*) as orderCount,
        SUM(totalPrice) as totalSpent,
        AVG(totalPrice) as avgOrderValue,
        MAX(createdAt) as lastOrder
      FROM Orders 
      WHERE createdAt >= :startDate
      GROUP BY customerName
      ORDER BY totalSpent DESC
      LIMIT 10
    `, {
      replacements: { startDate: startDate.toISOString() },
      type: sequelize.QueryTypes.SELECT
    });

    logger.info(`Order analytics generated for ${days} days`);
    res.json({
      success: true,
      data: {
        metrics: orderMetrics[0],
        ordersByHour,
        ordersByDayOfWeek,
        topCustomers,
        period: `${days} days`
      }
    });
  } catch (error) {
    logger.error("Order analytics error:", error);
    res.status(500).json({ success: false, error: "Database error" });
  }
};

// Get product performance analytics
exports.getProductPerformance = async (req, res) => {
  logger.info("Processing product performance request...");
  try {
    const { days = 30, category } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Build where clause for category filter
    const categoryFilter = category ? `AND p.category = :category` : '';

    // Product performance metrics
    const productPerformance = await sequelize.query(`
      SELECT 
        p.id,
        p.name,
        p.category,
        p.price as currentPrice,
        COALESCE(SUM(oi.quantity), 0) as totalSold,
        COALESCE(COUNT(DISTINCT o.id), 0) as orderCount,
        COALESCE(SUM(oi.quantity * oi.price), 0) as revenue,
        COALESCE(AVG(oi.price), p.price) as avgSellingPrice
      FROM Products p
      LEFT JOIN OrderItems oi ON p.id = oi.ProductId
      LEFT JOIN Orders o ON oi.OrderId = o.id AND o.createdAt >= :startDate
      WHERE 1=1 ${categoryFilter}
      GROUP BY p.id, p.name, p.category, p.price
      ORDER BY totalSold DESC
    `, {
      replacements: { 
        startDate: startDate.toISOString(),
        ...(category && { category })
      },
      type: sequelize.QueryTypes.SELECT
    });

    // Product categories summary
    const categorySummary = await sequelize.query(`
      SELECT 
        p.category,
        COUNT(DISTINCT p.id) as productCount,
        COALESCE(SUM(oi.quantity), 0) as totalSold,
        COALESCE(SUM(oi.quantity * oi.price), 0) as revenue
      FROM Products p
      LEFT JOIN OrderItems oi ON p.id = oi.ProductId
      LEFT JOIN Orders o ON oi.OrderId = o.id AND o.createdAt >= :startDate
      GROUP BY p.category
      ORDER BY revenue DESC
    `, {
      replacements: { startDate: startDate.toISOString() },
      type: sequelize.QueryTypes.SELECT
    });

    // Unsold products (waste tracking)
    const unsoldProducts = await UnsoldProduct.findAll({
      include: [
        {
          model: Product,
          attributes: ['name', 'category', 'price']
        }
      ],
      where: {
        createdAt: {
          [Op.gte]: startDate
        }
      },
      order: [['createdAt', 'DESC']]
    });

    logger.info(`Product performance generated for ${days} days`);
    res.json({
      success: true,
      data: {
        productPerformance,
        categorySummary,
        unsoldProducts,
        period: `${days} days`,
        category: category || 'all'
      }
    });
  } catch (error) {
    logger.error("Product performance error:", error);
    res.status(500).json({ success: false, error: "Database error" });
  }
};

// Get daily metrics summary
exports.getDailyMetrics = async (req, res) => {
  logger.info("Processing daily metrics request...");
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Today's metrics
    const todayMetrics = await sequelize.query(`
      SELECT 
        COUNT(*) as orders,
        COALESCE(SUM(totalPrice), 0) as revenue,
        COALESCE(AVG(totalPrice), 0) as avgOrderValue
      FROM Orders 
      WHERE DATE(createdAt) = :today
    `, {
      replacements: { today },
      type: sequelize.QueryTypes.SELECT
    });

    // Yesterday's metrics for comparison
    const yesterdayMetrics = await sequelize.query(`
      SELECT 
        COUNT(*) as orders,
        COALESCE(SUM(totalPrice), 0) as revenue,
        COALESCE(AVG(totalPrice), 0) as avgOrderValue
      FROM Orders 
      WHERE DATE(createdAt) = :yesterday
    `, {
      replacements: { yesterday: yesterdayStr },
      type: sequelize.QueryTypes.SELECT
    });

    // Today's cash entries
    const todayCash = await Cash.findAll({
      where: {
        date: today
      }
    });

    // Recent orders
    const recentOrders = await Order.findAll({
      where: {
        createdAt: {
          [Op.gte]: new Date(today)
        }
      },
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    // Calculate percentage changes
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const today_data = todayMetrics[0];
    const yesterday_data = yesterdayMetrics[0];

    logger.info("Daily metrics generated successfully");
    res.json({
      success: true,
      data: {
        today: {
          orders: today_data.orders,
          revenue: Math.round(today_data.revenue * 100) / 100,
          avgOrderValue: Math.round(today_data.avgOrderValue * 100) / 100,
          cash: todayCash.reduce((sum, entry) => sum + parseFloat(entry.amount || 0), 0)
        },
        yesterday: {
          orders: yesterday_data.orders,
          revenue: Math.round(yesterday_data.revenue * 100) / 100,
          avgOrderValue: Math.round(yesterday_data.avgOrderValue * 100) / 100
        },
        changes: {
          orders: calculateChange(today_data.orders, yesterday_data.orders),
          revenue: calculateChange(today_data.revenue, yesterday_data.revenue),
          avgOrderValue: calculateChange(today_data.avgOrderValue, yesterday_data.avgOrderValue)
        },
        recentOrders
      }
    });
  } catch (error) {
    logger.error("Daily metrics error:", error);
    res.status(500).json({ success: false, error: "Database error" });
  }
};