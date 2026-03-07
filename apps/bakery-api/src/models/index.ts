import { Sequelize } from 'sequelize'

// Re-export sequelize instance - set during initializeModels
export let sequelize: Sequelize

// Temporary local logger until utils library is properly configured
const logger = {
  info: (message: string, ...args: any[]) =>
    console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) =>
    console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) =>
    console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) =>
    console.log(`[DEBUG] ${message}`, ...args),
  db: (message: string, ...args: any[]) =>
    console.log(`[DB] ${message}`, ...args),
}

// Import models from domain libraries
// TODO: These libraries need to be created during migration
// import {
//   initializeOrderModels,
//   Order as OrderModel,
//   OrderItem as OrderItemModel
// } from '@bakery/api/orders';
// import {
//   initializeInventoryModels,
//   Inventory as InventoryModel
// } from '@bakery/api/inventory';
// import {
//   initializeCustomerModels,
//   Customer as CustomerModel
// } from '@bakery/api/customers';
// import {
//   initializeProductionModels,
//   Recipe as RecipeModel,
//   ProductionSchedule as ProductionScheduleModel,
//   ProductionBatch as ProductionBatchModel,
//   ProductionStep as ProductionStepModel
// } from '@bakery/api/production';
// import {
//   initializeNotificationModels,
//   Notification as NotificationModel,
//   NotificationPreferences as NotificationPreferencesModel,
//   NotificationTemplate as NotificationTemplateModel
// } from '@bakery/api/notifications';
// TODO: Re-enable once @bakery/api/sales-analytics module resolution is fixed
// import {
//   initializeSalesAnalyticsModels,
//   SalesTransaction as SalesTransactionModel,
//   TransactionItem as TransactionItemModel,
//   DailySalesReport as DailySalesReportModel,
// } from '@bakery/api/sales-analytics'

// Import local models that haven't been migrated yet
import { default as Cash } from './Cash'
import { default as Chat } from './Chat'
import { default as Product } from './Product'
import { default as UnsoldProduct } from './UnsoldProduct'
import { default as Order } from './Order'
import { default as OrderItem } from './OrderItem'
import { default as User } from './User'
import { default as Inventory } from './Inventory'
import { default as Recipe } from './Recipe'
import { default as Notification } from './Notification'
import { default as StockAdjustment } from './StockAdjustment'

// Import newly created production and notification models
import { default as NotificationPreferences } from './NotificationPreferences'
import { default as NotificationTemplate } from './NotificationTemplate'
import { default as ProductionBatch } from './ProductionBatch'
import { default as ProductionSchedule } from './ProductionSchedule'
import { default as ProductionStep } from './ProductionStep'

// Re-export all models
export {
  Order,
  OrderItem,
  User,
  Inventory,
  Recipe,
  Notification,
  StockAdjustment,
  NotificationPreferences,
  NotificationTemplate,
  ProductionBatch,
  ProductionSchedule,
  ProductionStep,
}
export const Customer = User // Alias for backward compatibility

// TODO: Re-enable once @bakery/api/sales-analytics module resolution is fixed
// export const SalesTransaction = SalesTransactionModel
// export const TransactionItem = TransactionItemModel
// export const DailySalesReport = DailySalesReportModel

// Export local models
export { Cash, Chat, Product, UnsoldProduct }

export async function initializeModels(seq: Sequelize): Promise<void> {
  // Store reference for re-export so services can import { sequelize } from '../models'
  sequelize = seq
  logger.info('Initializing database models...')

  try {
    // Initialize domain models
    // TODO: Uncomment these when the libraries are created
    // await initializeOrderModels(sequelize);
    // await initializeInventoryModels(sequelize);
    // await initializeCustomerModels(sequelize);
    // await initializeProductionModels(sequelize);
    // await initializeNotificationModels(sequelize);
    // await initializeSalesAnalyticsModels(sequelize)

    // Initialize local models
    Cash.initModel(seq)
    Chat.initModel(seq)
    Product.initModel(seq)
    UnsoldProduct.initModel(seq)
    Order.initModel(seq)
    OrderItem.initModel(seq)
    User.initModel(seq)
    Inventory.initModel(seq)
    Recipe.initModel(seq)
    Notification.initModel(seq)
    StockAdjustment.initModel(seq)

    // Initialize production and notification models
    NotificationPreferences.initModel(seq)
    NotificationTemplate.initModel(seq)
    ProductionSchedule.initModel(seq)
    ProductionBatch.initModel(seq)
    ProductionStep.initModel(seq)

    // Set up associations
    setupAssociations()

    logger.info('All models initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize models:', error)
    throw error
  }
}

function setupAssociations(): void {
  logger.info('Setting up model associations...')

  // Order associations
  Order.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' })
  Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' })

  // OrderItem associations
  OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' })
  OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' })

  // Customer associations
  Customer.hasMany(Order, { foreignKey: 'customerId', as: 'orders' })
  Customer.hasMany(Cash, { foreignKey: 'userId', as: 'cashEntries' })
  Customer.hasMany(Chat, { foreignKey: 'userId', as: 'messages' })
  Customer.hasOne(NotificationPreferences, {
    foreignKey: 'userId',
    as: 'notificationPreferences',
  })
  Customer.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' })

  // Product associations
  Product.hasMany(OrderItem, { foreignKey: 'productId', as: 'orderItems' })
  Product.hasMany(UnsoldProduct, {
    foreignKey: 'productId',
    as: 'unsoldProducts',
  })
  Product.hasOne(Inventory, { foreignKey: 'productId', as: 'inventory' })

  // Cash associations
  Cash.belongsTo(Customer, { foreignKey: 'userId', as: 'user' })

  // Chat associations
  Chat.belongsTo(Customer, { foreignKey: 'userId', as: 'user' })

  // UnsoldProduct associations
  UnsoldProduct.belongsTo(Product, { foreignKey: 'productId', as: 'product' })

  // Inventory associations
  Inventory.belongsTo(Product, { foreignKey: 'productId', as: 'product' })
  Inventory.hasMany(StockAdjustment, {
    foreignKey: 'inventoryId',
    as: 'adjustments',
  })

  // StockAdjustment associations
  StockAdjustment.belongsTo(Inventory, {
    foreignKey: 'inventoryId',
    as: 'inventory',
  })
  StockAdjustment.belongsTo(Customer, { foreignKey: 'performedBy', as: 'user' })

  // Production associations
  ProductionSchedule.hasMany(ProductionBatch, {
    foreignKey: 'scheduleId',
    as: 'batches',
  })

  ProductionBatch.belongsTo(ProductionSchedule, {
    foreignKey: 'scheduleId',
    as: 'schedule',
  })
  ProductionBatch.belongsTo(Recipe, { foreignKey: 'recipeId', as: 'recipe' })
  ProductionBatch.hasMany(ProductionStep, {
    foreignKey: 'batchId',
    as: 'steps',
  })
  ProductionBatch.belongsTo(Customer, {
    foreignKey: 'assignedStaffId',
    as: 'assignedStaff',
  })

  ProductionStep.belongsTo(ProductionBatch, {
    foreignKey: 'batchId',
    as: 'batch',
  })
  ProductionStep.belongsTo(Customer, {
    foreignKey: 'completedBy',
    as: 'completedByStaff',
  })

  // Notification associations
  Notification.belongsTo(Customer, { foreignKey: 'userId', as: 'user' })
  NotificationPreferences.belongsTo(Customer, {
    foreignKey: 'userId',
    as: 'user',
  })

  // Sales Analytics associations
  // TODO: Re-enable once @bakery/api/sales-analytics module resolution is fixed
  // SalesTransaction.hasMany(TransactionItem, {
  //   foreignKey: 'salesTransactionId',
  //   as: 'transactionItems',
  //   onDelete: 'CASCADE',
  //   onUpdate: 'CASCADE',
  // })

  // TransactionItem.belongsTo(SalesTransaction, {
  //   foreignKey: 'salesTransactionId',
  //   as: 'salesTransaction',
  //   onDelete: 'CASCADE',
  //   onUpdate: 'CASCADE',
  // })

  // TransactionItem.belongsTo(Product, {
  //   foreignKey: 'productId',
  //   as: 'product',
  //   onDelete: 'RESTRICT',
  //   onUpdate: 'CASCADE',
  // })

  // TODO: Re-enable once DailySalesReport model is migrated
  // DailySalesReport.belongsTo(Product, {
  //   foreignKey: 'mostPopularProductId',
  //   as: 'mostPopularProduct',
  //   onDelete: 'SET NULL',
  //   onUpdate: 'CASCADE',
  // })

  logger.info('Model associations established')
}

// Export function to get all models (for migrations)
export function getAllModels(): any[] {
  return [
    User, // Use User instead of Customer
    Product,
    Order,
    OrderItem,
    Cash,
    Chat,
    UnsoldProduct,
    Recipe,
    Inventory,
    StockAdjustment,
    Notification,
    NotificationPreferences,
    NotificationTemplate,
    ProductionSchedule,
    ProductionBatch,
    ProductionStep,
    // TODO: Re-enable once sales-analytics models are migrated
    // SalesTransaction,
    // TransactionItem,
    // DailySalesReport,
  ]
}
