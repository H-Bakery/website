const { Sequelize } = require("sequelize");
const logger = require("../utils/logger");

logger.info("Initializing Sequelize with SQLite database...");

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "database.db",
  logging: (msg) => logger.db(`${msg}`), // Log SQL queries
});

// Function to test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info("Database connection established successfully.");
    return true;
  } catch (error) {
    logger.error("Unable to connect to the database:", error);
    return false;
  }
};

module.exports = {
  sequelize,
  testConnection,
};
