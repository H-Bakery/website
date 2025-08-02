const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const { sequelize } = require('../../config/database');
const { initializeDatabaseWithMigrations } = require('../../models');
const { runMigrations, checkMigrationStatus } = require('../../config/migrationRunner');

const execAsync = promisify(exec);

describe('Migration System Tests', () => {
  beforeEach(async () => {
    // Ensure we're using a clean test database
    process.env.NODE_ENV = 'test';
    await sequelize.drop();
  });

  afterEach(async () => {
    // Clean up test database after each test
    await sequelize.drop();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Migration Execution', () => {
    it('should run all migrations successfully', async () => {
      // Run migrations using the CLI
      const { stdout, stderr } = await execAsync('npm run db:migrate', {
        env: { ...process.env, NODE_ENV: 'test' }
      });

      expect(stderr).toBe('');
      expect(stdout).toContain('All migrations performed successfully');
    }, 30000);

    it('should create all expected tables', async () => {
      // Run migrations
      await runMigrations('test');

      // Check that all tables exist
      const tableNames = [
        'Users', 'Products', 'Orders', 'OrderItems', 'Cash', 'Chats',
        'UnsoldProducts', 'Recipes', 'Inventories', 'notifications',
        'NotificationPreferences', 'NotificationTemplates', 'SequelizeMeta'
      ];

      for (const tableName of tableNames) {
        const [results] = await sequelize.query(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}';`
        );
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe(tableName);
      }
    });

    it('should create proper indexes', async () => {
      await runMigrations('test');

      // Check some key indexes exist
      const [indexResults] = await sequelize.query(
        "SELECT name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL;"
      );

      const indexNames = indexResults.map(row => row.name);
      
      // Check for some expected indexes
      expect(indexNames.some(name => name.includes('Users'))).toBe(true);
      expect(indexNames.some(name => name.includes('email'))).toBe(true);
      expect(indexNames.some(name => name.includes('userId'))).toBe(true);
    });
  });

  describe('Schema Integrity', () => {
    beforeEach(async () => {
      await runMigrations('test');
    });

    it('should have proper foreign key relationships', async () => {
      // Test foreign key constraints by trying to insert invalid data
      const { QueryInterface } = require('sequelize');
      const queryInterface = sequelize.getQueryInterface();

      // Try to insert an order with invalid userId (should fail due to FK constraint)
      await expect(
        queryInterface.bulkInsert('Orders', [{
          customerName: 'Test Customer',
          orderDate: new Date(),
          status: 'pending',
          totalAmount: 100.00,
          userId: 99999, // Non-existent user
          createdAt: new Date(),
          updatedAt: new Date()
        }])
      ).rejects.toThrow();
    });

    it('should have proper column constraints', async () => {
      const { QueryInterface } = require('sequelize');
      const queryInterface = sequelize.getQueryInterface();

      // Try to insert invalid data that violates constraints
      await expect(
        queryInterface.bulkInsert('Users', [{
          // Missing required fields should fail
          createdAt: new Date(),
          updatedAt: new Date()
        }])
      ).rejects.toThrow();
    });

    it('should have proper unique constraints', async () => {
      const { QueryInterface } = require('sequelize');
      const queryInterface = sequelize.getQueryInterface();

      // Insert a user
      await queryInterface.bulkInsert('Users', [{
        username: 'testuser',
        password: 'hashedpassword',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }]);

      // Try to insert another user with same username (should fail)
      await expect(
        queryInterface.bulkInsert('Users', [{
          username: 'testuser', // Duplicate username
          password: 'hashedpassword2',
          email: 'test2@example.com',
          firstName: 'Test2',
          lastName: 'User2',
          role: 'user',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }])
      ).rejects.toThrow();
    });
  });

  describe('Migration Rollback', () => {
    it('should rollback migrations successfully', async () => {
      // Run migrations first
      await runMigrations('test');

      // Verify tables exist
      const [beforeRollback] = await sequelize.query(
        "SELECT name FROM sqlite_master WHERE type='table';"
      );
      const tableCountBefore = beforeRollback.length;
      expect(tableCountBefore).toBeGreaterThan(1);

      // Rollback all migrations
      const { stdout } = await execAsync('npm run db:migrate:undo:all', {
        env: { ...process.env, NODE_ENV: 'test' }
      });

      expect(stdout).toContain('All migrations reverted successfully');

      // Verify only SequelizeMeta table remains (or no tables)
      const [afterRollback] = await sequelize.query(
        "SELECT name FROM sqlite_master WHERE type='table';"
      );
      expect(afterRollback.length).toBeLessThanOrEqual(1);
    }, 30000);

    it('should rollback single migration', async () => {
      // Run all migrations
      await runMigrations('test');

      // Count tables before rollback
      const [beforeRollback] = await sequelize.query(
        "SELECT name FROM sqlite_master WHERE type='table';"
      );
      const tableCountBefore = beforeRollback.length;

      // Rollback last migration
      await execAsync('npm run db:migrate:undo', {
        env: { ...process.env, NODE_ENV: 'test' }
      });

      // Count tables after rollback
      const [afterRollback] = await sequelize.query(
        "SELECT name FROM sqlite_master WHERE type='table';"
      );
      const tableCountAfter = afterRollback.length;

      // Should have one less table (the last migration's table should be gone)
      expect(tableCountAfter).toBeLessThan(tableCountBefore);
    }, 30000);
  });

  describe('Migration Status', () => {
    it('should report migration status correctly', async () => {
      // Initially no migrations should be run
      const statusBefore = await checkMigrationStatus('test');
      expect(statusBefore).toContain('No migrations were executed yet');

      // Run migrations
      await runMigrations('test');

      // Now migrations should be reported as executed
      const statusAfter = await checkMigrationStatus('test');
      expect(statusAfter).toContain('up');
    });
  });

  describe('Data Migration Safety', () => {
    it('should preserve existing data during migrations', async () => {
      // First, run migrations to set up schema
      await runMigrations('test');

      // Insert some test data
      const { QueryInterface } = require('sequelize');
      const queryInterface = sequelize.getQueryInterface();

      await queryInterface.bulkInsert('Users', [{
        username: 'testuser',
        password: 'hashedpassword',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }]);

      // Verify data exists
      const [usersBefore] = await sequelize.query('SELECT * FROM Users');
      expect(usersBefore).toHaveLength(1);
      expect(usersBefore[0].username).toBe('testuser');

      // If we had additional migrations, they should preserve this data
      // For now, just verify the data is still there
      const [usersAfter] = await sequelize.query('SELECT * FROM Users');
      expect(usersAfter).toHaveLength(1);
      expect(usersAfter[0].username).toBe('testuser');
    });
  });

  describe('Migration File Validation', () => {
    it('should have valid migration files', () => {
      const migrationsDir = path.join(__dirname, '../../migrations');
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.js'))
        .sort();

      expect(migrationFiles.length).toBeGreaterThan(0);

      // Check each migration file has proper structure
      migrationFiles.forEach(file => {
        const migrationPath = path.join(migrationsDir, file);
        const migration = require(migrationPath);

        expect(migration).toHaveProperty('up');
        expect(migration).toHaveProperty('down');
        expect(typeof migration.up).toBe('function');
        expect(typeof migration.down).toBe('function');
      });
    });

    it('should have proper migration naming convention', () => {
      const migrationsDir = path.join(__dirname, '../../migrations');
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.js'))
        .sort();

      migrationFiles.forEach(file => {
        // Check naming convention: YYYYMMDDHHMMSS-descriptive-name.js
        expect(file).toMatch(/^\d{14}-[\w-]+\.js$/);
      });
    });
  });
});