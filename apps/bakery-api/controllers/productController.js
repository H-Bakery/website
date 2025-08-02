const models = require("../models");
const logger = require("../utils/logger");

// Get all products
exports.getProducts = async (req, res) => {
  logger.info("Processing get all products request...");
  try {
    const products = await models.Product.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'price', 'stock', 'description', 'image', 'category'],
    });

    logger.info(`Retrieved ${products.length} products`);
    res.json(products);
  } catch (error) {
    logger.error("Product retrieval error:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Get a specific product
exports.getProduct = async (req, res) => {
  logger.info(`Processing get product request for ID: ${req.params.id}`);
  try {
    const product = await models.Product.findByPk(req.params.id, {
      attributes: ['id', 'name', 'price', 'stock', 'description', 'image', 'category', 'dailyTarget', 'isActive'],
    });

    if (!product) {
      logger.warn(`Product not found: ${req.params.id}`);
      return res.status(404).json({ message: "Product not found" });
    }

    logger.info(`Product ${req.params.id} retrieved successfully`);
    res.json(product);
  } catch (error) {
    logger.error(`Error retrieving product ${req.params.id}:`, error);
    res.status(500).json({ error: "Database error" });
  }
};
