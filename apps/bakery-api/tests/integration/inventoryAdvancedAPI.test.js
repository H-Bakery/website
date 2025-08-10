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

describe('Inventory Advanced API Endpoints', () => {
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
    
    // Create test inventory items
    await Inventory.bulkCreate([
      {
        id: 1,
        name: 'Flour',
        sku: 'FLOUR-001',
        quantity: 10,
        unit: 'kg',
        lowStockThreshold: 20,
        category: 'ingredients',
        isActive: true
      },
      {
        id: 2,
        name: 'Sugar',
        sku: 'SUGAR-001',
        quantity: 50,
        unit: 'kg',
        lowStockThreshold: 30,
        category: 'ingredients',
        isActive: true
      },
      {
        id: 3,
        name: 'Yeast',
        sku: 'YEAST-001',
        quantity: 5,
        unit: 'kg',
        lowStockThreshold: 10,
        category: 'ingredients',
        isActive: true
      },
      {
        id: 4,
        name: 'Bread Bags',
        sku: 'BAGS-001',
        quantity: 100,
        unit: 'pieces',
        lowStockThreshold: 50,
        category: 'packaging',
        isActive: true
      },
      {
        id: 5,
        name: 'Inactive Item',
        sku: 'INACTIVE-001',
        quantity: 0,
        unit: 'units',
        lowStockThreshold: 5,
        category: 'other',
        isActive: false
      }
    ]);
  });

  describe('GET /api/inventory - List with Filtering', () => {
    it('should return all active items by default', async () => {
      const response = await request(app)
        .get('/api/inventory')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(4); // Only active items
      expect(response.body.data.every(item => item.isActive)).toBe(true);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/inventory?category=ingredients')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data.every(item => item.category === 'ingredients')).toBe(true);
    });

    it('should filter low stock items', async () => {
      const response = await request(app)
        .get('/api/inventory?lowStock=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2); // Flour and Yeast
      
      const lowStockItems = response.body.data;
      expect(lowStockItems.find(item => item.name === 'Flour')).toBeTruthy();
      expect(lowStockItems.find(item => item.name === 'Yeast')).toBeTruthy();
      
      // Verify they are actually low stock
      lowStockItems.forEach(item => {
        expect(item.quantity).toBeLessThanOrEqual(item.lowStockThreshold);
      });
    });

    it('should handle search parameter', async () => {
      const response = await request(app)
        .get('/api/inventory?search=flour')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Flour');
    });

    it('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/inventory?page=1&limit=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toEqual({
        total: 4,
        page: 1,
        limit: 2,
        pages: 2
      });
    });

    it('should handle pagination page 2', async () => {
      const response = await request(app)
        .get('/api/inventory?page=2&limit=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.page).toBe(2);
    });

    it('should combine multiple filters', async () => {
      const response = await request(app)
        .get('/api/inventory?category=ingredients&lowStock=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2); // Only Flour and Yeast
      expect(response.body.data.every(item => 
        item.category === 'ingredients' && 
        item.quantity <= item.lowStockThreshold
      )).toBe(true);
    });

    it('should include inactive items when specified', async () => {
      const response = await request(app)
        .get('/api/inventory?isActive=false')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Inactive Item');
    });

    it('should return empty array when no items match filters', async () => {
      const response = await request(app)
        .get('/api/inventory?category=nonexistent')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('PATCH /api/inventory/:id/stock - Stock Adjustment', () => {
    it('should increase stock successfully', async () => {
      const response = await request(app)
        .patch('/api/inventory/1/stock')
        .send({ change: 25, reason: 'New delivery' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.quantity).toBe(35); // 10 + 25
      expect(response.body.message).toBe('Stock increased successfully');

      // Verify in database
      const item = await Inventory.findByPk(1);
      expect(item.quantity).toBe(35);
      expect(item.lastRestockedAt).toBeTruthy();
    });

    it('should decrease stock successfully', async () => {
      const response = await request(app)
        .patch('/api/inventory/2/stock')
        .send({ change: -20, reason: 'Used in production' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.quantity).toBe(30); // 50 - 20
      expect(response.body.message).toBe('Stock decreased successfully');

      // Verify in database
      const item = await Inventory.findByPk(2);
      expect(item.quantity).toBe(30);
    });

    it('should reject negative stock result', async () => {
      const response = await request(app)
        .patch('/api/inventory/1/stock')
        .send({ change: -15 }) // Flour has 10, trying to remove 15
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Insufficient stock');
      expect(response.body.available).toBe(10);
      expect(response.body.requested).toBe(15);

      // Verify stock wasn't changed
      const item = await Inventory.findByPk(1);
      expect(item.quantity).toBe(10);
    });

    it('should allow reducing stock to exactly zero', async () => {
      const response = await request(app)
        .patch('/api/inventory/1/stock')
        .send({ change: -10 }) // Flour has 10, removing exactly 10
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.quantity).toBe(0);

      const item = await Inventory.findByPk(1);
      expect(item.quantity).toBe(0);
    });

    it('should reject non-numeric change value', async () => {
      const response = await request(app)
        .patch('/api/inventory/1/stock')
        .send({ change: 'not-a-number' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Change must be a number');
    });

    it('should handle missing change parameter', async () => {
      const response = await request(app)
        .patch('/api/inventory/1/stock')
        .send({ reason: 'No change provided' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Change must be a number');
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(app)
        .patch('/api/inventory/999/stock')
        .send({ change: 10 })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Inventory item not found');
    });

    it('should handle decimal quantities', async () => {
      const response = await request(app)
        .patch('/api/inventory/1/stock')
        .send({ change: 5.5 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.quantity).toBe(15.5);
    });
  });

  describe('Special Endpoints', () => {
    it('should get low stock items via dedicated endpoint', async () => {
      const response = await request(app)
        .get('/api/inventory/low-stock')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.data).toHaveLength(2);
      
      response.body.data.forEach(item => {
        expect(item.quantity).toBeLessThanOrEqual(item.lowStockThreshold);
      });
    });

    it('should get items needing reorder', async () => {
      // First update some items with reorder levels
      await Inventory.update(
        { reorderLevel: 15 },
        { where: { id: 1 } }
      );
      await Inventory.update(
        { reorderLevel: 8 },
        { where: { id: 3 } }
      );

      const response = await request(app)
        .get('/api/inventory/needs-reorder')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.data).toHaveLength(2);
      
      response.body.data.forEach(item => {
        expect(item.quantity).toBeLessThanOrEqual(item.reorderLevel);
      });
    });

    it('should handle bulk stock adjustments', async () => {
      const adjustments = [
        { id: 1, change: 10 },
        { id: 2, change: -10 },
        { id: 3, change: 5 }
      ];

      const response = await request(app)
        .post('/api/inventory/bulk-adjust')
        .send({ 
          adjustments,
          reason: 'Monthly adjustment'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.successful).toHaveLength(3);
      expect(response.body.data.failed).toHaveLength(0);

      // Verify changes
      const flour = await Inventory.findByPk(1);
      const sugar = await Inventory.findByPk(2);
      const yeast = await Inventory.findByPk(3);
      
      expect(flour.quantity).toBe(20); // 10 + 10
      expect(sugar.quantity).toBe(40); // 50 - 10
      expect(yeast.quantity).toBe(10); // 5 + 5
    });

    it('should handle partial failures in bulk adjustments', async () => {
      const adjustments = [
        { id: 1, change: 10 },
        { id: 1, change: -50 }, // Will fail - insufficient stock
        { id: 3, change: 5 }
      ];

      const response = await request(app)
        .post('/api/inventory/bulk-adjust')
        .send({ adjustments })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.successful).toHaveLength(2);
      expect(response.body.data.failed).toHaveLength(1);
      expect(response.body.data.failed[0].error).toContain('Insufficient stock');
    });
  });
});