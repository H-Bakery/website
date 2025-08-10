const request = require('supertest');
const { sequelize } = require('../../models');
const app = require('../../src/main');
const path = require('path');
const fs = require('fs');

describe('Migration Parity Tests - Legacy to TypeScript', () => {
  let server;
  let authToken;

  beforeAll(async () => {
    // Ensure database is connected
    await sequelize.authenticate();
    
    // Start server
    server = app.listen(0);
    
    // Login to get auth token
    const loginResponse = await request(server)
      .post('/api/auth/login')
      .send({
        email: 'admin@bakery.com',
        password: 'admin123'
      });
    
    authToken = loginResponse.body?.token;
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await sequelize.close();
  });

  describe('Authentication Module Parity', () => {
    test('POST /api/auth/register - should create new user', async () => {
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'newuser@test.com',
          password: 'Password123!',
          name: 'Test User',
          role: 'staff'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('newuser@test.com');
    });

    test('POST /api/auth/login - should authenticate user', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({
          email: 'admin@bakery.com',
          password: 'admin123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
    });

    test('GET /api/auth/me - should return current user', async () => {
      const response = await request(server)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('email');
    });
  });

  describe('Products Module Parity', () => {
    test('GET /api/products - should list all products', async () => {
      const response = await request(server)
        .get('/api/products')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/products - should create new product', async () => {
      const response = await request(server)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Croissant',
          price: 3.50,
          category: 'Pastry',
          description: 'Delicious test croissant',
          stock: 20
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Croissant');
    });

    test('PUT /api/products/:id - should update product', async () => {
      // First create a product
      const createResponse = await request(server)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Update Test Product',
          price: 5.00,
          category: 'Bread',
          stock: 10
        });

      const productId = createResponse.body.id;

      // Then update it
      const updateResponse = await request(server)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          price: 6.00,
          stock: 15
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.price).toBe(6.00);
      expect(updateResponse.body.stock).toBe(15);
    });
  });

  describe('Orders Module Parity', () => {
    test('GET /api/orders - should list all orders', async () => {
      const response = await request(server)
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/orders - should create new order', async () => {
      const response = await request(server)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          items: [
            { productId: 1, quantity: 2, price: 3.50 },
            { productId: 2, quantity: 1, price: 2.00 }
          ],
          totalAmount: 9.00,
          status: 'pending'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.customerName).toBe('John Doe');
    });

    test('PUT /api/orders/:id/status - should update order status', async () => {
      // Create an order first
      const createResponse = await request(server)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerName: 'Jane Doe',
          customerEmail: 'jane@example.com',
          items: [],
          totalAmount: 5.00,
          status: 'pending'
        });

      const orderId = createResponse.body.id;

      // Update status
      const updateResponse = await request(server)
        .put(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'completed'
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.status).toBe('completed');
    });
  });

  describe('Inventory Module Parity', () => {
    test('GET /api/inventory - should list inventory items', async () => {
      const response = await request(server)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/inventory - should create inventory item', async () => {
      const response = await request(server)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemName: 'Flour',
          quantity: 50,
          unit: 'kg',
          minQuantity: 10,
          category: 'Ingredients'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.itemName).toBe('Flour');
    });

    test('PUT /api/inventory/:id/adjust - should adjust inventory quantity', async () => {
      // Create an inventory item
      const createResponse = await request(server)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemName: 'Sugar',
          quantity: 30,
          unit: 'kg',
          minQuantity: 5
        });

      const itemId = createResponse.body.id;

      // Adjust quantity
      const adjustResponse = await request(server)
        .put(`/api/inventory/${itemId}/adjust`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          adjustment: -5,
          reason: 'Used in production'
        });

      expect(adjustResponse.status).toBe(200);
      expect(adjustResponse.body.quantity).toBe(25);
    });
  });

  describe('Production Module Parity', () => {
    test('GET /api/production/schedules - should list production schedules', async () => {
      const response = await request(server)
        .get('/api/production/schedules')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/production/schedules - should create production schedule', async () => {
      const response = await request(server)
        .post('/api/production/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          date: '2025-08-15',
          shift: 'morning',
          items: [
            { productId: 1, quantity: 50 },
            { productId: 2, quantity: 30 }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.date).toBe('2025-08-15');
    });

    test('GET /api/production/batches - should list production batches', async () => {
      const response = await request(server)
        .get('/api/production/batches')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Recipes Module Parity', () => {
    test('GET /api/recipes - should list all recipes', async () => {
      const response = await request(server)
        .get('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/recipes - should create new recipe', async () => {
      const response = await request(server)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Bread Recipe',
          ingredients: [
            { name: 'Flour', quantity: 500, unit: 'g' },
            { name: 'Water', quantity: 300, unit: 'ml' },
            { name: 'Yeast', quantity: 10, unit: 'g' }
          ],
          instructions: 'Mix, knead, rise, bake',
          prepTime: 30,
          cookTime: 45,
          yield: 2
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Bread Recipe');
    });
  });

  describe('Notifications Module Parity', () => {
    test('GET /api/notifications - should list notifications', async () => {
      const response = await request(server)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/notifications - should create notification', async () => {
      const response = await request(server)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Notification',
          message: 'This is a test notification',
          type: 'info',
          priority: 'medium'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Test Notification');
    });

    test('PUT /api/notifications/:id/read - should mark notification as read', async () => {
      // Create a notification
      const createResponse = await request(server)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Read Test',
          message: 'Mark as read test',
          type: 'info'
        });

      const notificationId = createResponse.body.id;

      // Mark as read
      const readResponse = await request(server)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(readResponse.status).toBe(200);
      expect(readResponse.body.isRead).toBe(true);
    });
  });

  describe('Staff Module Parity', () => {
    test('GET /api/staff - should list staff members', async () => {
      const response = await request(server)
        .get('/api/staff')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/staff/schedule - should create staff schedule', async () => {
      const response = await request(server)
        .post('/api/staff/schedule')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          staffId: 1,
          date: '2025-08-15',
          startTime: '06:00',
          endTime: '14:00',
          role: 'Baker'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });
  });

  describe('Reports Module Parity', () => {
    test('GET /api/reports/sales - should generate sales report', async () => {
      const response = await request(server)
        .get('/api/reports/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2025-08-01',
          endDate: '2025-08-31'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalSales');
      expect(response.body).toHaveProperty('orderCount');
    });

    test('GET /api/reports/inventory - should generate inventory report', async () => {
      const response = await request(server)
        .get('/api/reports/inventory')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalItems');
      expect(response.body).toHaveProperty('lowStockItems');
    });

    test('GET /api/reports/production - should generate production report', async () => {
      const response = await request(server)
        .get('/api/reports/production')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          date: '2025-08-10'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalProduced');
      expect(response.body).toHaveProperty('efficiency');
    });
  });

  describe('Health Check Parity', () => {
    test('GET /api/health - should return health status', async () => {
      const response = await request(server)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('healthy');
    });

    test('GET /api/health/ready - should return readiness status', async () => {
      const response = await request(server)
        .get('/api/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ready');
      expect(response.body.ready).toBe(true);
    });
  });
});