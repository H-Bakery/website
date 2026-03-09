const { DataTypes, Op } = require('sequelize')
const { sequelize } = require('../config/database')

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        len: {
          args: [1, 255],
          msg: 'Username must be between 1 and 255 characters',
        },
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'user',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'Users',
    timestamps: true,
  }
)

const Product = sequelize.define(
  'Product',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    dailyTarget: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    description: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
    },
    image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: 'Products',
    timestamps: true,
    indexes: [{ fields: ['category'] }, { fields: ['name'] }],
  }
)

const Cash = sequelize.define(
  'Cash',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    UserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  {
    tableName: 'Cash',
    timestamps: true,
  }
)

const UnsoldProduct = sequelize.define(
  'UnsoldProduct',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    ProductId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    UserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  {
    tableName: 'UnsoldProducts',
    timestamps: true,
  }
)

const Order = sequelize.define(
  'Order',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    UserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
    },
    totalAmount: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'Orders',
    timestamps: true,
  }
)

const OrderItem = sequelize.define(
  'OrderItem',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    OrderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ProductId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  },
  {
    tableName: 'OrderItems',
    timestamps: true,
  }
)

const Recipe = sequelize.define(
  'Recipe',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ingredients: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    prepTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    bakeTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    yield: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'Recipes',
    timestamps: true,
  }
)

const Inventory = sequelize.define(
  'Inventory',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: {
          msg: 'Item name cannot be empty',
        },
      },
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    quantity: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'Quantity cannot be negative',
        },
      },
    },
    unit: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'units',
      validate: {
        isIn: {
          args: [
            [
              'kg',
              'g',
              'liters',
              'ml',
              'units',
              'pieces',
              'bags',
              'boxes',
              'bottles',
              'jars',
            ],
          ],
          msg: 'Invalid unit type',
        },
      },
    },
    lowStockThreshold: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'Low stock threshold cannot be negative',
        },
      },
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: {
          args: [
            [
              'ingredients',
              'packaging',
              'supplies',
              'equipment',
              'consumables',
              'other',
            ],
          ],
          msg: 'Invalid category',
        },
      },
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    supplier: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cost: {
      type: DataTypes.FLOAT,
      allowNull: true,
      validate: {
        min: {
          args: [0],
          msg: 'Cost cannot be negative',
        },
      },
    },
    reorderLevel: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'Reorder level cannot be negative',
        },
      },
    },
    reorderQuantity: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'Reorder quantity cannot be negative',
        },
      },
    },
    lastRestockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'Inventories',
    timestamps: true,
    indexes: [{ fields: ['category'] }, { fields: ['name'] }],
  }
)

// Instance methods for Inventory
Inventory.prototype.isLowStock = function () {
  return this.quantity <= this.lowStockThreshold
}

Inventory.prototype.needsReorder = function () {
  return this.quantity <= this.reorderLevel
}

Inventory.prototype.adjustStock = async function (adjustment) {
  const newQuantity = this.quantity + adjustment
  if (newQuantity < 0) {
    throw new Error(
      `Insufficient stock. Available: ${this.quantity}, Requested: ${Math.abs(
        adjustment
      )}`
    )
  }
  this.quantity = newQuantity
  if (adjustment > 0) {
    this.lastRestockedAt = new Date()
  }
  await this.save()
}

const Notification = sequelize.define(
  'Notification',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    priority: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'medium',
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: 'notifications',
    timestamps: true,
  }
)

const NotificationPreferences = sequelize.define(
  'NotificationPreferences',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    emailEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    pushEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    categories: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'NotificationPreferences',
    timestamps: true,
  }
)

const NotificationTemplate = sequelize.define(
  'NotificationTemplate',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'NotificationTemplates',
    timestamps: true,
  }
)

const Chat = sequelize.define(
  'Chat',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    UserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: 'Chats',
    timestamps: true,
  }
)

// Associations
const StockAdjustment = sequelize.define(
  'StockAdjustment',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    inventoryId: { type: DataTypes.INTEGER, allowNull: false },
    adjustmentType: { type: DataTypes.STRING, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    previousQuantity: { type: DataTypes.INTEGER, allowNull: false },
    newQuantity: { type: DataTypes.INTEGER, allowNull: false },
    reason: { type: DataTypes.STRING(200), allowNull: false },
    performedBy: { type: DataTypes.INTEGER, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: 'stock_adjustments', timestamps: true }
)

const ProductionSchedule = sequelize.define(
  'ProductionSchedule',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    scheduleDate: { type: DataTypes.DATEONLY, allowNull: false },
    scheduleType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'daily',
    },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'draft' },
    staffShifts: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    availableEquipment: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    plannedBatches: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    workdayStartTime: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '06:00',
    },
    workdayEndTime: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '18:00',
    },
    totalStaffHours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    estimatedProductionTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    workdayMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 720,
    },
    efficiencyScore: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    capacityUtilization: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    completionPercentage: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: false },
    approvedBy: { type: DataTypes.INTEGER, allowNull: true },
    approvedAt: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: 'production_schedules', timestamps: true }
)

const ProductionBatch = sequelize.define(
  'ProductionBatch',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    scheduleId: { type: DataTypes.INTEGER, allowNull: true },
    recipeId: { type: DataTypes.INTEGER, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: false },
    workflowId: { type: DataTypes.STRING, allowNull: false },
    productId: { type: DataTypes.INTEGER, allowNull: false },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'planned',
    },
    plannedQuantity: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    actualQuantity: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    unit: { type: DataTypes.STRING, allowNull: false, defaultValue: 'units' },
    priority: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'medium',
    },
    plannedStartTime: { type: DataTypes.DATE, allowNull: false },
    plannedEndTime: { type: DataTypes.DATE, allowNull: false },
    actualStartTime: { type: DataTypes.DATE, allowNull: true },
    actualEndTime: { type: DataTypes.DATE, allowNull: true },
    estimatedDurationMinutes: { type: DataTypes.INTEGER, allowNull: false },
    actualDurationMinutes: { type: DataTypes.INTEGER, allowNull: true },
    currentStepIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    assignedStaffIds: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    assignedStaffId: { type: DataTypes.INTEGER, allowNull: true },
    requiredEquipment: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    qualityResults: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
    issues: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
    metadata: { type: DataTypes.JSON, allowNull: true, defaultValue: {} },
    notes: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: false },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: 'production_batches', timestamps: true }
)

const ProductionStep = sequelize.define(
  'ProductionStep',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    batchId: { type: DataTypes.INTEGER, allowNull: false },
    stepIndex: { type: DataTypes.INTEGER, allowNull: false },
    stepName: { type: DataTypes.STRING, allowNull: false },
    stepType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'manual',
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
    },
    activities: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    conditions: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    parameters: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    actualParameters: { type: DataTypes.JSON, allowNull: true },
    workflowNotes: { type: DataTypes.TEXT, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    location: { type: DataTypes.STRING, allowNull: true },
    repeatCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    requiredEquipment: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    plannedDurationMinutes: { type: DataTypes.INTEGER, allowNull: false },
    actualDurationMinutes: { type: DataTypes.INTEGER, allowNull: true },
    plannedStartTime: { type: DataTypes.DATE, allowNull: true },
    plannedEndTime: { type: DataTypes.DATE, allowNull: true },
    actualStartTime: { type: DataTypes.DATE, allowNull: true },
    actualEndTime: { type: DataTypes.DATE, allowNull: true },
    completedActivities: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    progress: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    qualityCheckCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    qualityResults: { type: DataTypes.JSON, allowNull: true },
    hasIssues: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    issues: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
    metadata: { type: DataTypes.JSON, allowNull: true, defaultValue: {} },
    completedBy: { type: DataTypes.INTEGER, allowNull: true },
    statusChangeTime: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: 'production_steps', timestamps: true }
)

User.hasMany(Cash, { foreignKey: 'UserId' })
Cash.belongsTo(User, { foreignKey: 'UserId' })

Product.hasMany(UnsoldProduct, { foreignKey: 'ProductId' })
UnsoldProduct.belongsTo(Product, { foreignKey: 'ProductId' })

Product.hasMany(OrderItem, { foreignKey: 'ProductId' })
OrderItem.belongsTo(Product, { foreignKey: 'ProductId' })

User.hasMany(UnsoldProduct, { foreignKey: 'UserId' })
UnsoldProduct.belongsTo(User, { foreignKey: 'UserId' })

User.hasMany(Order, { foreignKey: 'UserId' })
Order.belongsTo(User, { foreignKey: 'UserId' })

Order.hasMany(OrderItem, { foreignKey: 'OrderId' })
OrderItem.belongsTo(Order, { foreignKey: 'OrderId' })

User.hasOne(NotificationPreferences, { foreignKey: 'userId' })
NotificationPreferences.belongsTo(User, { foreignKey: 'userId' })

User.hasMany(Notification, { foreignKey: 'userId' })
Notification.belongsTo(User, { foreignKey: 'userId' })

User.hasMany(Chat, { foreignKey: 'UserId' })
Chat.belongsTo(User, { foreignKey: 'UserId' })

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
ProductionBatch.hasMany(ProductionStep, { foreignKey: 'batchId', as: 'steps' })
ProductionStep.belongsTo(ProductionBatch, {
  foreignKey: 'batchId',
  as: 'batch',
})

// Inventory / StockAdjustment associations
Inventory.hasMany(StockAdjustment, {
  foreignKey: 'inventoryId',
  as: 'adjustments',
})
StockAdjustment.belongsTo(Inventory, {
  foreignKey: 'inventoryId',
  as: 'inventory',
})

// Sync database helper (safe — no force:true)
async function syncDatabase() {
  await sequelize.sync()
}

// Initialize database with migrations (alias for compatibility)
async function initializeDatabaseWithMigrations() {
  await sequelize.sync()
}

module.exports = {
  sequelize,
  User,
  Product,
  Cash,
  UnsoldProduct,
  Order,
  OrderItem,
  Recipe,
  Inventory,
  Notification,
  NotificationPreferences,
  NotificationTemplate,
  Chat,
  StockAdjustment,
  ProductionSchedule,
  ProductionBatch,
  ProductionStep,
  syncDatabase,
  initializeDatabaseWithMigrations,
}
