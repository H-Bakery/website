const path = require("path");
const { parseCSV } = require("./utils/csvParser");
const logger = require("./utils/logger");

async function main() {
  try {
    // Path to CSV file
    const csvFilePath = path.resolve(
      __dirname,
      "../content/products/products.csv",
    );

    // Parse CSV data
    const productsData = parseCSV(csvFilePath);

    // Log results
    logger.info(`Successfully parsed ${productsData.length} products from CSV`);
    logger.info("First 3 products:");

    // Log first 3 products for verification
    productsData.slice(0, 3).forEach((product, index) => {
      logger.info(`Product ${index + 1}:`, product.name);
    });

    // Transform CSV data to match our model structure (as in seeder)
    const transformedProducts = productsData.slice(0, 3).map((product) => ({
      id: parseInt(product.id),
      name: product.name,
      price: parseFloat(product.price),
      description: `Category: ${product.category}`,
      stock: 10,
      dailyTarget: 20,
      isActive: true,
      image: product.image,
      category: product.category,
    }));

    // Log transformed data
    logger.info("Transformed products:");
    transformedProducts.forEach((product, index) => {
      logger.info(
        `Transformed Product ${index + 1}:`,
        JSON.stringify(product, null, 2),
      );
    });
  } catch (error) {
    logger.error("Error testing CSV parser:", error);
  }
}

main();
