const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const { sequelize, Inventory } = require('../../models');
const inventoryRoutes = require('../../routes/inventoryRoutes');
const logger = require('../../utils/logger');

// Mock the auth middleware to bypass authentication in tests
jest.mock('../../middleware/authMiddleware', () => ({
  authenticate: (req, res, next) => {
    req.userId = 1;
    req.userRole = 'admin';
    next();
  }
}));

// Create a test app
let app;
let testInventory;

describe('Inventory API Integration Tests', () => {
  beforeAll(async () => {
    // Create test app
    app = express();
    app.use(bodyParser.json());
    app.use('/api/inventory', inventoryRoutes);

    // Sync database with force
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clear inventory table before each test
    await Inventory.destroy({ where: {} });
    
    // Create a test inventory item
    testInventory = await Inventory.create({
      name: 'Test Flour',
      sku: 'FLOUR-001',
      description: 'High-quality bread flour',
      quantity: 50,
      unit: 'kg',
      lowStockThreshold: 20,
      category: 'ingredients',
      supplier: 'Test Supplier',
      cost: 1.50,
      reorderLevel: 25,
      reorderQuantity: 100
    });
  });

  describe('POST /api/inventory', () => {
    it('should create a new inventory item with valid data', async () => {
      const newItem = {
        name: 'Sugar',
        sku: 'SUGAR-001',
        description: 'Fine granulated sugar',
        quantity: 30,
        unit: 'kg',
        lowStockThreshold: 10,
        category: 'ingredients',
        supplier: 'Sweet Supplies',
        cost: 0.80
      };

      const response = await request(app)
        .post('/api/inventory')
        .send(newItem)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newItem.name);
      expect(response.body.data.quantity).toBe(newItem.quantity);
      expect(response.body.message).toBe('Inventory item created successfully');

      // Verify item was created in database
      const dbItem = await Inventory.findOne({ where: { name: 'Sugar' } });
      expect(dbItem).toBeTruthy();
      expect(dbItem.sku).toBe('SUGAR-001');
    });

    it('should reject creation with duplicate name', async () => {
      const duplicateItem = {
        name: 'Test Flour', // Already exists
        unit: 'kg',
        quantity: 10
      };

      const response = await request(app)
        .post('/api/inventory')
        .send(duplicateItem)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });

    it('should reject creation with invalid data', async () => {
      const invalidItem = {
        name: 'Invalid Item',
        quantity: -10, // Invalid negative quantity
        unit: 'kg'
      };

      const response = await request(app)
        .post('/api/inventory')
        .send(invalidItem)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Quantity cannot be negative');
    });

    it('should reject creation without required fields', async () => {
      const incompleteItem = {
        description: 'Missing required name field'
      };

      const response = await request(app)
        .post('/api/inventory')
        .send(incompleteItem)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/inventory/:id', () => {
    it('should retrieve an inventory item by ID', async () => {
      const response = await request(app)
        .get(`/api/inventory/${testInventory.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testInventory.id);
      expect(response.body.data.name).toBe('Test Flour');
      expect(response.body.data.quantity).toBe(50);
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(app)
        .get('/api/inventory/999999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Inventory item not found');
    });

    it('should handle invalid ID format', async () => {
      const response = await request(app)
        .get('/api/inventory/invalid-id')
        .expect(404); // Sequelize returns null for invalid ID, so we get 404

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Inventory item not found');
    });
  });

  describe('PUT /api/inventory/:id', () => {
    it('should update item details successfully', async () => {
      const updateData = {
        name: 'Premium Bread Flour',
        description: 'Extra fine bread flour',
        lowStockThreshold: 30,
        supplier: 'New Supplier'
      };

      const response = await request(app)
        .put(`/api/inventory/${testInventory.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Premium Bread Flour');
      expect(response.body.data.supplier).toBe('New Supplier');
      expect(response.body.message).toBe('Inventory item updated successfully');

      // Verify in database
      const updated = await Inventory.findByPk(testInventory.id);
      expect(updated.name).toBe('Premium Bread Flour');
      expect(updated.lowStockThreshold).toBe(30);
    });

    it('should not update quantity through PUT endpoint', async () => {
      const originalQuantity = testInventory.quantity;
      
      const response = await request(app)
        .put(`/api/inventory/${testInventory.id}`)
        .send({ quantity: 100, name: 'Updated Flour' })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify quantity wasn't changed
      const item = await Inventory.findByPk(testInventory.id);
      expect(item.quantity).toBe(originalQuantity);
      expect(item.name).toBe('Updated Flour');
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(app)
        .put('/api/inventory/999999')
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Inventory item not found');
    });

    it('should reject update with duplicate name', async () => {
      // Create another item
      await Inventory.create({
        name: 'Another Item',
        unit: 'units',
        quantity: 5
      });

      const response = await request(app)
        .put(`/api/inventory/${testInventory.id}`)
        .send({ name: 'Another Item' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('DELETE /api/inventory/:id', () => {
    it('should soft delete an inventory item', async () => {
      const response = await request(app)
        .delete(`/api/inventory/${testInventory.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Inventory item deleted successfully');

      // Verify soft delete
      const item = await Inventory.findByPk(testInventory.id);
      expect(item.isActive).toBe(false);
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(app)
        .delete('/api/inventory/999999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Inventory item not found');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock a database error
      const originalFindByPk = Inventory.findByPk;
      Inventory.findByPk = jest.fn().mockRejectedValue(new Error('Database connection lost'));

      const response = await request(app)
        .get(`/api/inventory/${testInventory.id}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve inventory item');

      // Restore original method
      Inventory.findByPk = originalFindByPk;
    });

    it('should validate data types correctly', async () => {
      const invalidData = {
        name: 'Test Item',
        unit: 'invalid-unit', // Invalid unit type
        quantity: 10
      };

      const response = await request(app)
        .post('/api/inventory')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid unit type');
    });

    it('should handle concurrent updates', async () => {
      // Simulate concurrent update scenario
      const update1 = request(app)
        .put(`/api/inventory/${testInventory.id}`)
        .send({ name: 'Update 1' });

      const update2 = request(app)
        .put(`/api/inventory/${testInventory.id}`)
        .send({ name: 'Update 2' });

      const [response1, response2] = await Promise.all([update1, update2]);

      // Both should succeed, last one wins
      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);

      const item = await Inventory.findByPk(testInventory.id);
      expect(['Update 1', 'Update 2']).toContain(item.name);
    });
  });
});