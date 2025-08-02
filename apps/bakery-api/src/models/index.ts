import { Sequelize } from 'sequelize';
import { logger } from '@bakery/api/core';

// Import models from domain libraries
import { 
  initializeOrderModels,
  Order as OrderModel,
  OrderItem as OrderItemModel 
} from '@bakery/api/orders';
import { 
  initializeInventoryModels,
  Inventory as InventoryModel 
} from '@bakery/api/inventory';
import { 
  initializeCustomerModels,
  Customer as CustomerModel 
} from '@bakery/api/customers';
import { 
  initializeProductionModels,
  Recipe as RecipeModel,
  ProductionSchedule as ProductionScheduleModel,
  ProductionBatch as ProductionBatchModel,
  ProductionStep as ProductionStepModel
} from '@bakery/api/production';
import { 
  initializeNotificationModels,
  Notification as NotificationModel,
  NotificationPreferences as NotificationPreferencesModel,
  NotificationTemplate as NotificationTemplateModel
} from '@bakery/api/notifications';

// Import local models that haven't been migrated yet
import { default as Cash } from './Cash';
import { default as Chat } from './Chat';
import { default as Product } from './Product';
import { default as UnsoldProduct } from './UnsoldProduct';

// Re-export all models
export const Order = OrderModel;
export const OrderItem = OrderItemModel;
export const Inventory = InventoryModel;
export const Customer = CustomerModel;
export const Recipe = RecipeModel;
export const ProductionSchedule = ProductionScheduleModel;
export const ProductionBatch = ProductionBatchModel;
export const ProductionStep = ProductionStepModel;
export const Notification = NotificationModel;
export const NotificationPreferences = NotificationPreferencesModel;
export const NotificationTemplate = NotificationTemplateModel;

// Export local models
export { Cash, Chat, Product, UnsoldProduct };

// For backward compatibility
export const User = CustomerModel;

export async function initializeModels(sequelize: Sequelize): Promise<void> {
  logger.info('Initializing database models...');

  try {
    // Initialize domain models
    await initializeOrderModels(sequelize);
    await initializeInventoryModels(sequelize);
    await initializeCustomerModels(sequelize);
    await initializeProductionModels(sequelize);
    await initializeNotificationModels(sequelize);

    // Initialize local models
    Cash.initModel(sequelize);
    Chat.initModel(sequelize);
    Product.initModel(sequelize);
    UnsoldProduct.initModel(sequelize);

    // Set up associations
    setupAssociations();

    logger.info('All models initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize models:', error);
    throw error;
  }
}

function setupAssociations(): void {
  logger.info('Setting up model associations...');

  // Order associations
  Order.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
  Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });

  // OrderItem associations
  OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
  OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

  // Customer associations
  Customer.hasMany(Order, { foreignKey: 'customerId', as: 'orders' });
  Customer.hasMany(Cash, { foreignKey: 'userId', as: 'cashEntries' });
  Customer.hasMany(Chat, { foreignKey: 'userId', as: 'messages' });
  Customer.hasOne(NotificationPreferences, { 
    foreignKey: 'userId', 
    as: 'notificationPreferences' 
  });
  Customer.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });

  // Product associations
  Product.hasMany(OrderItem, { foreignKey: 'productId', as: 'orderItems' });
  Product.hasMany(UnsoldProduct, { foreignKey: 'productId', as: 'unsoldProducts' });
  Product.hasOne(Inventory, { foreignKey: 'productId', as: 'inventory' });

  // Cash associations
  Cash.belongsTo(Customer, { foreignKey: 'userId', as: 'user' });

  // Chat associations
  Chat.belongsTo(Customer, { foreignKey: 'userId', as: 'user' });

  // UnsoldProduct associations
  UnsoldProduct.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

  // Inventory associations
  Inventory.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

  // Production associations
  ProductionSchedule.belongsTo(Recipe, { foreignKey: 'recipeId', as: 'recipe' });
  ProductionSchedule.hasMany(ProductionBatch, { 
    foreignKey: 'scheduleId', 
    as: 'batches' 
  });

  ProductionBatch.belongsTo(ProductionSchedule, { 
    foreignKey: 'scheduleId', 
    as: 'schedule' 
  });
  ProductionBatch.belongsTo(Recipe, { foreignKey: 'recipeId', as: 'recipe' });
  ProductionBatch.hasMany(ProductionStep, { foreignKey: 'batchId', as: 'steps' });
  ProductionBatch.belongsTo(Customer, { 
    foreignKey: 'assignedStaffId', 
    as: 'assignedStaff' 
  });

  ProductionStep.belongsTo(ProductionBatch, { foreignKey: 'batchId', as: 'batch' });
  ProductionStep.belongsTo(Customer, { 
    foreignKey: 'completedBy', 
    as: 'completedByStaff' 
  });

  // Notification associations
  Notification.belongsTo(Customer, { foreignKey: 'userId', as: 'user' });

  NotificationPreferences.belongsTo(Customer, { foreignKey: 'userId', as: 'user' });

  logger.info('Model associations established');
}

// Export function to get all models (for migrations)
export function getAllModels(): any[] {
  return [
    Customer,
    Product,
    Order,
    OrderItem,
    Cash,
    Chat,
    UnsoldProduct,
    Recipe,
    Inventory,
    Notification,
    NotificationPreferences,
    NotificationTemplate,
    ProductionSchedule,
    ProductionBatch,
    ProductionStep
  ];
}