const request = require('supertest');
const express = require('express');
const { 
  inventoryCreationRules, 
  inventoryUpdateRules, 
  stockAdjustmentRules,
  bulkStockAdjustmentRules 
} = require('../../validators/inventoryValidator');
const { handleValidationErrors } = require('../../middleware/validationMiddleware');

// Create a test express app
const createTestApp = (validationRules) => {
  const app = express();
  app.use(express.json());
  
  app.post('/test', validationRules(), handleValidationErrors, (req, res) => {
    res.json({ success: true, data: req.body });
  });
  
  app.patch('/test/:id', validationRules(), handleValidationErrors, (req, res) => {
    res.json({ success: true, data: req.body, params: req.params });
  });
  
  return app;
};

describe('Inventory Validator', () => {
  describe('Inventory Creation Rules', () => {
    let app;
    
    beforeEach(() => {
      app = createTestApp(inventoryCreationRules);
    });
    
    it('should accept valid inventory item', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          name: 'Flour',
          quantity: 100,
          unit: 'kg',
          minStockLevel: 20,
          maxStockLevel: 200,
          category: 'ingredients',
          supplier: 'Local Mill',
          costPerUnit: 2.50,
          notes: 'Premium bread flour'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          name: 'Flour'
        });
      
      expect(response.status).toBe(422);
      const errorFields = response.body.errors.map(err => err.field);
      expect(errorFields).toContain('quantity');
      expect(errorFields).toContain('unit');
    });
    
    it('should reject invalid unit', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          name: 'Flour',
          quantity: 100,
          unit: 'invalid-unit'
        });
      
      expect(response.status).toBe(422);
      const unitError = response.body.errors.find(err => err.field === 'unit');
      expect(unitError.message).toContain('Invalid unit');
    });
    
    it('should reject negative quantity', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          name: 'Flour',
          quantity: -10,
          unit: 'kg'
        });
      
      expect(response.status).toBe(422);
      expect(response.body.errors.quantity).toContain('Quantity must be a positive number');
    });
    
    it('should reject invalid stock levels', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          name: 'Flour',
          quantity: 100,
          unit: 'kg',
          minStockLevel: 100,
          maxStockLevel: 50 // max less than min
        });
      
      expect(response.status).toBe(422);
      expect(response.body.errors.maxStockLevel).toContain('Maximum stock level must be greater than minimum stock level');
    });
    
    it('should escape HTML in text fields', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          name: '<script>alert("xss")</script>',
          quantity: 100,
          unit: 'kg',
          notes: '<img src="x" onerror="alert(1)">'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(response.body.data.notes).toBe('&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;');
    });
  });
  
  describe('Stock Adjustment Rules', () => {
    let app;
    
    beforeEach(() => {
      app = createTestApp(stockAdjustmentRules);
    });
    
    it('should accept valid stock adjustment', async () => {
      const response = await request(app)
        .patch('/test/1')
        .send({
          adjustment: 50,
          reason: 'Delivery received'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should accept negative adjustment', async () => {
      const response = await request(app)
        .patch('/test/1')
        .send({
          adjustment: -20,
          reason: 'Used in production'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should reject missing adjustment', async () => {
      const response = await request(app)
        .patch('/test/1')
        .send({
          reason: 'Test'
        });
      
      expect(response.status).toBe(422);
      expect(response.body.errors.adjustment).toBeDefined();
    });
    
    it('should reject zero adjustment', async () => {
      const response = await request(app)
        .patch('/test/1')
        .send({
          adjustment: 0,
          reason: 'Test'
        });
      
      expect(response.status).toBe(422);
      expect(response.body.errors.adjustment).toContain('Adjustment cannot be zero');
    });
  });
  
  describe('Bulk Stock Adjustment Rules', () => {
    let app;
    
    beforeEach(() => {
      app = createTestApp(bulkStockAdjustmentRules);
    });
    
    it('should accept valid bulk adjustments', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          adjustments: [
            { itemId: 1, adjustment: 50, reason: 'Delivery' },
            { itemId: 2, adjustment: -10, reason: 'Used' }
          ]
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should reject empty adjustments array', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          adjustments: []
        });
      
      expect(response.status).toBe(422);
      expect(response.body.errors.adjustments).toContain('At least one adjustment is required');
    });
    
    it('should reject too many adjustments', async () => {
      const adjustments = Array(101).fill({ itemId: 1, adjustment: 10 });
      
      const response = await request(app)
        .post('/test')
        .send({ adjustments });
      
      expect(response.status).toBe(422);
      expect(response.body.errors.adjustments).toContain('Cannot process more than 100 adjustments at once');
    });
    
    it('should reject invalid adjustment data', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          adjustments: [
            { itemId: 'invalid', adjustment: 0 },
            { itemId: 2, adjustment: 10 } // valid one
          ]
        });
      
      expect(response.status).toBe(422);
      expect(response.body.errors['adjustments[0].itemId']).toBeDefined();
      expect(response.body.errors['adjustments[0].adjustment']).toBeDefined();
    });
  });
});