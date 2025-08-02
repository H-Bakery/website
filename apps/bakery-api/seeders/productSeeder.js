const path = require('path');
const models = require("../models");
const logger = require("../utils/logger");
const { parseCSV } = require("../utils/csvParser");

module.exports = {
  seed: async () => {
    try {
      // Check if Product model exists before trying to use it
      if (!models.Product) {
        logger.error("Product model not found. Skipping product seeding.");
        return;
      }

      const productCount = await models.Product.count();

      if (productCount === 0) {
        // Path to CSV file relative to this file
        const csvFilePath = path.resolve(__dirname, '../../content/products/products.csv');
        
        // Parse CSV data
        const productsData = parseCSV(csvFilePath);
        
        // Transform CSV data to match our model structure
        const productsToCreate = productsData.map(product => ({
          id: parseInt(product.id),
          name: product.name,
          price: parseFloat(product.price),
          description: `Category: ${product.category}`,
          // Set default values for fields not in CSV
          stock: 10,
          dailyTarget: 20,
          isActive: true,
          // Store image path from CSV
          image: product.image
        }));
        
        // Create products in database
        await models.Product.bulkCreate(productsToCreate);
        logger.info(`Created ${productsToCreate.length} products from CSV data`);
      } else {
        logger.info("Products already exist, skipping seed");
      }
    } catch (error) {
      logger.error("Error seeding products:", error);
      logger.error(error.stack);
    }
  },
};
