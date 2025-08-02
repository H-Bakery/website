const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const { Cash, User } = require('../../models');
const cashController = require('../../controllers/cashController');
const { authenticate } = require('../../middleware/authMiddleware');

// Mock the models and middleware
jest.mock('../../models');
jest.mock('../../middleware/authMiddleware');
jest.mock('../../utils/logger');

// Create test app
const app = express();
app.use(bodyParser.json());

// Mock authenticate middleware
authenticate.mockImplementation((req, res, next) => {
  req.userId = 1; // Mock user ID
  next();
});

// Set up routes
app.post('/cash', authenticate, cashController.addCashEntry);
app.get('/cash', authenticate, cashController.getCashEntries);
app.put('/cash/:id', authenticate, cashController.updateCashEntry);
app.delete('/cash/:id', authenticate, cashController.deleteCashEntry);

describe('Cash Controller CRUD Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PUT /cash/:id (Update)', () => {
    it('should update a cash entry successfully', async () => {
      const mockCashEntry = {
        id: 1,
        UserId: 1,
        amount: 425.75,
        date: '2024-01-15',
        createdAt: '2024-01-15T20:30:00.000Z',
        updatedAt: '2024-01-15T20:30:00.000Z',
        update: jest.fn().mockResolvedValue()
      };

      Cash.findOne.mockResolvedValue(mockCashEntry);

      const response = await request(app)
        .put('/cash/1')
        .send({ amount: 500.00, date: '2024-01-16' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Cash entry updated');
      expect(response.body.entry).toBeDefined();
      expect(Cash.findOne).toHaveBeenCalledWith({
        where: { id: '1', UserId: 1 }
      });
      expect(mockCashEntry.update).toHaveBeenCalledWith({
        amount: 500.00,
        date: '2024-01-16'
      });
    });

    it('should update only amount when date is not provided', async () => {
      const mockCashEntry = {
        id: 1,
        UserId: 1,
        amount: 425.75,
        date: '2024-01-15',
        update: jest.fn().mockResolvedValue()
      };

      Cash.findOne.mockResolvedValue(mockCashEntry);

      const response = await request(app)
        .put('/cash/1')
        .send({ amount: 600.00 });

      expect(response.status).toBe(200);
      expect(mockCashEntry.update).toHaveBeenCalledWith({
        amount: 600.00
      });
    });

    it('should return 404 when cash entry not found', async () => {
      Cash.findOne.mockResolvedValue(null);

      const response = await request(app)
        .put('/cash/999')
        .send({ amount: 500.00 });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Cash entry not found');
    });

    it('should validate amount is positive', async () => {
      const mockCashEntry = {
        id: 1,
        UserId: 1,
        update: jest.fn()
      };

      Cash.findOne.mockResolvedValue(mockCashEntry);

      const response = await request(app)
        .put('/cash/1')
        .send({ amount: -100 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid amount');
      expect(mockCashEntry.update).not.toHaveBeenCalled();
    });

    it('should validate date format', async () => {
      const mockCashEntry = {
        id: 1,
        UserId: 1,
        update: jest.fn()
      };

      Cash.findOne.mockResolvedValue(mockCashEntry);

      const response = await request(app)
        .put('/cash/1')
        .send({ amount: 500.00, date: 'invalid-date' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid date format. Use YYYY-MM-DD');
      expect(mockCashEntry.update).not.toHaveBeenCalled();
    });

    it('should only allow users to update their own entries', async () => {
      // Entry belongs to user 2, but request is from user 1
      Cash.findOne.mockResolvedValue(null); // findOne with UserId: 1 returns null

      const response = await request(app)
        .put('/cash/1')
        .send({ amount: 500.00 });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Cash entry not found');
    });
  });

  describe('DELETE /cash/:id', () => {
    it('should delete a cash entry successfully', async () => {
      const mockCashEntry = {
        id: 1,
        UserId: 1,
        amount: 425.75,
        destroy: jest.fn().mockResolvedValue()
      };

      Cash.findOne.mockResolvedValue(mockCashEntry);

      const response = await request(app)
        .delete('/cash/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Cash entry deleted');
      expect(Cash.findOne).toHaveBeenCalledWith({
        where: { id: '1', UserId: 1 }
      });
      expect(mockCashEntry.destroy).toHaveBeenCalled();
    });

    it('should return 404 when cash entry not found for deletion', async () => {
      Cash.findOne.mockResolvedValue(null);

      const response = await request(app)
        .delete('/cash/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Cash entry not found');
    });

    it('should only allow users to delete their own entries', async () => {
      // Entry belongs to different user
      Cash.findOne.mockResolvedValue(null);

      const response = await request(app)
        .delete('/cash/1');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Cash entry not found');
    });

    it('should handle database errors during deletion', async () => {
      const mockCashEntry = {
        id: 1,
        UserId: 1,
        destroy: jest.fn().mockRejectedValue(new Error('Database error'))
      };

      Cash.findOne.mockResolvedValue(mockCashEntry);

      const response = await request(app)
        .delete('/cash/1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('Full CRUD Workflow', () => {
    it('should support create, read, update, delete operations', async () => {
      // Mock data for the workflow
      const mockUser = { id: 1, username: 'testuser' };
      const mockCashEntry = {
        id: 1,
        UserId: 1,
        amount: 425.75,
        date: '2024-01-15',
        createdAt: '2024-01-15T20:30:00.000Z',
        updatedAt: '2024-01-15T20:30:00.000Z',
        update: jest.fn().mockResolvedValue(),
        destroy: jest.fn().mockResolvedValue()
      };

      // 1. CREATE
      User.findByPk.mockResolvedValue(mockUser);
      Cash.create.mockResolvedValue(mockCashEntry);

      const createResponse = await request(app)
        .post('/cash')
        .send({ amount: 425.75 });

      expect(createResponse.status).toBe(200);
      expect(createResponse.body.message).toBe('Cash entry saved');

      // 2. READ
      Cash.findAll.mockResolvedValue([mockCashEntry]);

      const readResponse = await request(app).get('/cash');

      expect(readResponse.status).toBe(200);
      expect(readResponse.body).toEqual([{
        id: 1,
        UserId: 1,
        amount: 425.75,
        date: '2024-01-15',
        createdAt: '2024-01-15T20:30:00.000Z',
        updatedAt: '2024-01-15T20:30:00.000Z'
      }]);

      // 3. UPDATE
      Cash.findOne.mockResolvedValue(mockCashEntry);

      const updateResponse = await request(app)
        .put('/cash/1')
        .send({ amount: 500.00 });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.message).toBe('Cash entry updated');
      expect(mockCashEntry.update).toHaveBeenCalledWith({ amount: 500.00 });

      // 4. DELETE
      Cash.findOne.mockResolvedValue(mockCashEntry);

      const deleteResponse = await request(app)
        .delete('/cash/1');

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.message).toBe('Cash entry deleted');
      expect(mockCashEntry.destroy).toHaveBeenCalled();
    });
  });
});