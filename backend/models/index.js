const { sequelize } = require("../config/database");
const { DataTypes } = require("sequelize");
const logger = require("../utils/logger");

// Import model definitions
const UserModel = require("./User");
const CashModel = require("./Cash");
const ChatModel = require("./Chat");
const ProductModel = require("./Product");
const OrderModel = require("./order");
const OrderItemModel = require("./orderItem");
const UnsoldProductModel = require("./unsoldProduct");
const RecipeModel = require("./Recipe");
const InventoryModel = require("./Inventory");
const NotificationModel = require("./Notification");
const NotificationPreferencesModel = require("./NotificationPreferences");
const NotificationTemplateModel = require("./NotificationTemplate");
const ProductionScheduleModel = require("./ProductionSchedule");
const ProductionBatchModel = require("./ProductionBatch");
const ProductionStepModel = require("./ProductionStep");

// Initialize models with DataTypes
const User = UserModel(sequelize, DataTypes);
const Cash = CashModel(sequelize, DataTypes);
const Chat = ChatModel(sequelize, DataTypes);
const Product = ProductModel(sequelize, DataTypes);
const Order = OrderModel(sequelize, DataTypes);
const OrderItem = OrderItemModel(sequelize, DataTypes);
const UnsoldProduct = UnsoldProductModel(sequelize, DataTypes);
const Recipe = RecipeModel(sequelize, DataTypes);
const Inventory = InventoryModel(sequelize, DataTypes);
const Notification = NotificationModel(sequelize, DataTypes);
const NotificationPreferences = NotificationPreferencesModel(sequelize, DataTypes);
const NotificationTemplate = NotificationTemplateModel(sequelize, DataTypes);
const ProductionSchedule = ProductionScheduleModel(sequelize, DataTypes);
const ProductionBatch = ProductionBatchModel(sequelize, DataTypes);
const ProductionStep = ProductionStepModel(sequelize, DataTypes);

logger.info("Setting up model relationships...");

// Define relationships
User.hasMany(Cash);
Cash.belongsTo(User);

User.hasMany(Chat);
Chat.belongsTo(User);

// Order relationships
Order.hasMany(OrderItem);
OrderItem.belongsTo(Order);

// UnsoldProduct relationships
User.hasMany(UnsoldProduct);
UnsoldProduct.belongsTo(User);
Product.hasMany(UnsoldProduct);
UnsoldProduct.belongsTo(Product);

// Notification relationships
User.hasMany(Notification, { foreignKey: 'userId' });
Notification.belongsTo(User, { foreignKey: 'userId' });

// Notification preferences relationship
User.hasOne(NotificationPreferences, { foreignKey: 'userId' });
NotificationPreferences.belongsTo(User, { foreignKey: 'userId' });

// Production relationships
User.hasMany(ProductionSchedule, { foreignKey: 'createdBy', as: 'CreatedSchedules' });
User.hasMany(ProductionSchedule, { foreignKey: 'approvedBy', as: 'ApprovedSchedules' });
ProductionSchedule.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
ProductionSchedule.belongsTo(User, { foreignKey: 'approvedBy', as: 'Approver' });

User.hasMany(ProductionBatch, { foreignKey: 'createdBy', as: 'CreatedBatches' });
User.hasMany(ProductionBatch, { foreignKey: 'updatedBy', as: 'UpdatedBatches' });
ProductionBatch.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
ProductionBatch.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });
ProductionBatch.belongsTo(Product, { foreignKey: 'productId' });
Product.hasMany(ProductionBatch, { foreignKey: 'productId' });

ProductionBatch.hasMany(ProductionStep, { foreignKey: 'batchId' });
ProductionStep.belongsTo(ProductionBatch, { foreignKey: 'batchId' });
ProductionStep.belongsTo(User, { foreignKey: 'completedBy', as: 'Completer' });
User.hasMany(ProductionStep, { foreignKey: 'completedBy', as: 'CompletedSteps' });

// Initialize database using migrations
async function initializeDatabaseWithMigrations() {
  try {
    logger.info("Initializing database with migrations...");
    
    // Use environment variable to determine initialization method
    const useMigrations = process.env.USE_MIGRATIONS !== 'false';
    
    if (useMigrations && process.env.NODE_ENV !== 'test') {
      // Use migrations in production and development
      const { initializeDatabase } = require('../config/migrationRunner');
      await initializeDatabase();
    } else {
      // Use sync for tests or when migrations are disabled
      logger.info("Using sequelize.sync() for database initialization...");
      await sequelize.sync();
      logger.info("Database synchronized successfully with sync()");
    }

    // Count existing records to verify database state
    const userCount = await User.count();
    const cashCount = await Cash.count();
    const chatCount = await Chat.count();
    const productCount = await Product.count();
    const orderCount = await Order.count();
    const unsoldProductCount = await UnsoldProduct.count();
    const recipeCount = await Recipe.count();
    const inventoryCount = await Inventory.count();
    const notificationCount = await Notification.count();
    const preferencesCount = await NotificationPreferences.count();
    const templateCount = await NotificationTemplate.count();
    const scheduleCount = await ProductionSchedule.count();
    const batchCount = await ProductionBatch.count();
    const stepCount = await ProductionStep.count();

    logger.info(
      `Database contains: ${userCount} users, ${cashCount} cash entries, ${chatCount} chat messages, ${productCount} products, ${orderCount} orders, ${unsoldProductCount} unsold product entries, ${recipeCount} recipes, ${inventoryCount} inventory items, ${notificationCount} notifications, ${preferencesCount} notification preferences, ${templateCount} notification templates, ${scheduleCount} production schedules, ${batchCount} production batches, ${stepCount} production steps`,
    );
    return true;
  } catch (error) {
    logger.error("Unable to initialize database:", error);
    throw error;
  }
}

// Legacy function for backward compatibility
async function syncDatabase() {
  logger.warn("syncDatabase() is deprecated. Use initializeDatabaseWithMigrations() instead.");
  return initializeDatabaseWithMigrations();
}

module.exports = {
  sequelize,
  User,
  Cash,
  Chat,
  Product,
  Order, // Export the Order model
  OrderItem, // Export the OrderItem model
  UnsoldProduct, // Export the UnsoldProduct model
  Recipe, // Export the Recipe model
  Inventory, // Export the Inventory model
  Notification, // Export the Notification model
  NotificationPreferences, // Export the NotificationPreferences model
  NotificationTemplate, // Export the NotificationTemplate model
  ProductionSchedule, // Export the ProductionSchedule model
  ProductionBatch, // Export the ProductionBatch model
  ProductionStep, // Export the ProductionStep model
  syncDatabase, // Legacy compatibility
  initializeDatabaseWithMigrations, // New migration-based initialization
};
