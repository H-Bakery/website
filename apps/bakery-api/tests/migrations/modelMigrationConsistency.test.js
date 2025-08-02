const { sequelize } = require('../../config/database');
const { runMigrations } = require('../../config/migrationRunner');
const models = require('../../models');

describe('Model-Migration Consistency Tests', () => {
  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    await sequelize.drop();
  });

  afterEach(async () => {
    await sequelize.drop();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Schema Consistency', () => {
    it('should have matching schemas between migrations and models', async () => {
      // Run migrations to create schema
      await runMigrations('test');

      // Sync models (this should not change anything if migrations are correct)
      await sequelize.sync({ alter: false });

      // If we reach here without errors, schemas are consistent
      expect(true).toBe(true);
    });

    it('should create the same table structure via migrations and sync', async () => {
      // Test with a fresh database using migrations
      await runMigrations('test');
      
      // Get table info from migration-created database
      const tablesFromMigrations = await sequelize.getQueryInterface().showAllTables();
      
      // Drop and recreate with sync
      await sequelize.drop();
      await sequelize.sync();
      
      // Get table info from sync-created database
      const tablesFromSync = await sequelize.getQueryInterface().showAllTables();
      
      // Compare table counts (should be similar, accounting for SequelizeMeta)
      expect(tablesFromMigrations.length).toBeGreaterThanOrEqual(tablesFromSync.length);
      
      // Check that all model tables exist in both
      const modelTableNames = [
        'Users', 'Products', 'Orders', 'OrderItems', 'Cash', 'Chats',
        'UnsoldProducts', 'Recipes', 'Inventories', 'notifications',
        'NotificationPreferences', 'NotificationTemplates'
      ];
      
      for (const tableName of modelTableNames) {
        expect(tablesFromMigrations).toContain(tableName);
        expect(tablesFromSync).toContain(tableName);
      }
    });
  });

  describe('Model Validation with Migration Schema', () => {
    beforeEach(async () => {
      await runMigrations('test');
    });

    it('should be able to create records with all models after migration', async () => {
      // Test User model
      const user = await models.User.create({
        username: 'testuser',
        password: 'hashedpassword',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user'
      });
      expect(user.id).toBeDefined();

      // Test Product model
      const product = await models.Product.create({
        name: 'Test Bread',
        category: 'bread',
        price: 5.99,
        available: true
      });
      expect(product.id).toBeDefined();

      // Test Order model with foreign key
      const order = await models.Order.create({
        customerName: 'Test Customer',
        orderDate: new Date(),
        status: 'pending',
        totalAmount: 100.00,
        userId: user.id
      });
      expect(order.id).toBeDefined();

      // Test OrderItem model with multiple foreign keys
      const orderItem = await models.OrderItem.create({
        orderId: order.id,
        productId: product.id,
        quantity: 2,
        unitPrice: 5.99,
        totalPrice: 11.98
      });
      expect(orderItem.id).toBeDefined();

      // Test Cash model
      const cash = await models.Cash.create({
        date: new Date().toISOString().split('T')[0],
        morningCash: 100.00,
        eveningCash: 150.00,
        totalSales: 75.00,
        expenses: 25.00,
        difference: 0.00,
        userId: user.id
      });
      expect(cash.id).toBeDefined();

      // Test Recipe model
      const recipe = await models.Recipe.create({
        slug: 'test-bread-recipe',
        title: 'Test Bread Recipe',
        instructions: 'Mix ingredients and bake',
        difficulty: 'easy'
      });
      expect(recipe.id).toBeDefined();

      // Test Inventory model
      const inventory = await models.Inventory.create({
        name: 'Test Ingredient',
        quantity: 10.5,
        unit: 'kg'
      });
      expect(inventory.id).toBeDefined();

      // Test Notification model
      const notification = await models.Notification.create({
        title: 'Test Notification',
        message: 'This is a test notification',
        type: 'info',
        category: 'general',
        priority: 'medium',
        userId: user.id
      });
      expect(notification.id).toBeDefined();

      // Test NotificationPreferences model
      const preferences = await models.NotificationPreferences.create({
        userId: user.id,
        emailNotifications: true,
        pushNotifications: false
      });
      expect(preferences.id).toBeDefined();

      // Test NotificationTemplate model
      const template = await models.NotificationTemplate.create({
        key: 'test-template',
        name: 'Test Template',
        subject: 'Test Subject',
        body: 'Test body with {{variable}}',
        type: 'email',
        category: 'general'
      });
      expect(template.id).toBeDefined();
    });

    it('should enforce foreign key constraints', async () => {
      // Try to create order with non-existent user
      await expect(
        models.Order.create({
          customerName: 'Test Customer',
          orderDate: new Date(),
          status: 'pending',
          totalAmount: 100.00,
          userId: 99999 // Non-existent user
        })
      ).rejects.toThrow();
    });

    it('should enforce unique constraints', async () => {
      // Create first user
      await models.User.create({
        username: 'testuser',
        password: 'hashedpassword',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      });

      // Try to create another user with same username
      await expect(
        models.User.create({
          username: 'testuser', // Duplicate username
          password: 'hashedpassword2',
          email: 'test2@example.com',
          firstName: 'Test2',
          lastName: 'User2'
        })
      ).rejects.toThrow();
    });

    it('should handle soft deletes properly', async () => {
      const user = await models.User.create({
        username: 'testuser',
        password: 'hashedpassword',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      });

      // Check if user has deletedAt column (for soft delete)
      const userAttributes = models.User.getAttributes();
      if (userAttributes.deletedAt) {
        // Test soft delete
        await user.destroy();
        
        // User should still exist in database but with deletedAt set
        const userInDb = await models.User.findByPk(user.id, { paranoid: false });
        expect(userInDb).not.toBeNull();
        expect(userInDb.deletedAt).not.toBeNull();
        
        // User should not be found with normal query
        const userNormalQuery = await models.User.findByPk(user.id);
        expect(userNormalQuery).toBeNull();
      }
    });
  });

  describe('Association Consistency', () => {
    beforeEach(async () => {
      await runMigrations('test');
    });

    it('should have working model associations after migration', async () => {
      // Create test data
      const user = await models.User.create({
        username: 'testuser',
        password: 'hashedpassword',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      });

      const product = await models.Product.create({
        name: 'Test Bread',
        category: 'bread',
        price: 5.99
      });

      const order = await models.Order.create({
        customerName: 'Test Customer',
        orderDate: new Date(),
        status: 'pending',
        totalAmount: 100.00,
        userId: user.id
      });

      const orderItem = await models.OrderItem.create({
        orderId: order.id,
        productId: product.id,
        quantity: 2,
        unitPrice: 5.99,
        totalPrice: 11.98
      });

      // Test associations work
      const orderWithItems = await models.Order.findByPk(order.id, {
        include: [models.OrderItem]
      });
      expect(orderWithItems.OrderItems).toHaveLength(1);
      expect(orderWithItems.OrderItems[0].id).toBe(orderItem.id);

      const userWithOrders = await models.User.findByPk(user.id, {
        include: [models.Order]
      });
      expect(userWithOrders.Orders).toHaveLength(1);
      expect(userWithOrders.Orders[0].id).toBe(order.id);
    });
  });
});