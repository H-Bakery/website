const models = require("../models");
const logger = require("../utils/logger");
const { Op } = require("sequelize");

// Add unsold product entry
exports.addUnsoldProduct = async (req, res) => {
  logger.info("Processing add unsold product request...");
  
  try {
    const { productId, quantity } = req.body;
    const userId = req.userId;

    logger.info("Request data:", { productId, quantity, userId });

    // Validate input
    if (!productId || quantity === undefined || quantity < 0) {
      logger.warn("Invalid input for unsold product entry");
      return res.status(400).json({ error: "Product ID and non-negative quantity are required" });
    }

    if (!userId) {
      logger.warn("No user ID found in request");
      return res.status(401).json({ error: "Authentication required" });
    }

    // Check if product exists
    const product = await models.Product.findByPk(productId);
    if (!product) {
      logger.warn(`Product not found: ${productId}`);
      return res.status(404).json({ error: "Product not found" });
    }

    // Create unsold product entry
    const createData = {
      quantity,
      date: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
      ProductId: productId,
      UserId: userId
    };
    
    logger.info("Creating unsold product with data:", createData);
    const unsoldProduct = await models.UnsoldProduct.create(createData);

    logger.info(`Unsold product entry created: ${unsoldProduct.id}`);
    res.json({ message: "Unsold product entry saved" });

  } catch (error) {
    logger.error("Error adding unsold product entry:", error);
    logger.error("Error details:", {
      message: error.message,
      stack: error.stack,
      sql: error.sql,
      parameters: error.parameters
    });
    res.status(500).json({ error: "Database error", details: error.message });
  }
};

// Get unsold products history
exports.getUnsoldProducts = async (req, res) => {
  logger.info("Processing get unsold products request...");
  
  try {
    const unsoldProducts = await models.UnsoldProduct.findAll({
      include: [
        {
          model: models.Product,
          attributes: ['name', 'category']
        },
        {
          model: models.User,
          attributes: ['username']
        }
      ],
      order: [['date', 'DESC'], ['createdAt', 'DESC']]
    });

    logger.info(`Retrieved ${unsoldProducts.length} unsold product entries`);
    res.json(unsoldProducts);

  } catch (error) {
    logger.error("Error retrieving unsold products:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Get unsold products summary (totals by product)
exports.getUnsoldProductsSummary = async (req, res) => {
  logger.info("Processing get unsold products summary request...");
  
  try {
    const summary = await models.UnsoldProduct.findAll({
      attributes: [
        'ProductId',
        [models.sequelize.fn('SUM', models.sequelize.col('quantity')), 'totalUnsold']
      ],
      include: [
        {
          model: models.Product,
          attributes: ['name', 'category']
        }
      ],
      group: ['ProductId', 'Product.id'],
      order: [[models.sequelize.fn('SUM', models.sequelize.col('quantity')), 'DESC']]
    });

    logger.info(`Retrieved summary for ${summary.length} products`);
    res.json(summary);

  } catch (error) {
    logger.error("Error retrieving unsold products summary:", error);
    res.status(500).json({ error: "Database error" });
  }
};