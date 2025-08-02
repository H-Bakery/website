const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const { Cash, User } = require('../../models');
const cashController = require('../../controllers/cashController');
const { authenticate } = require('../../middleware/authMiddleware');
const jwt = require('jsonwebtoken');

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

describe('Cash Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /cash', () => {
    it('should create a cash entry successfully', async () => {
      const mockUser = { id: 1, username: 'testuser' };
      const mockCashEntry = {
        id: 1,
        UserId: 1,
        amount: 425.75,
        date: '2024-01-15',
        createdAt: '2024-01-15T20:30:00.000Z',
        updatedAt: '2024-01-15T20:30:00.000Z'
      };

      User.findByPk.mockResolvedValue(mockUser);
      Cash.create.mockResolvedValue(mockCashEntry);

      const response = await request(app)
        .post('/cash')
        .send({ amount: 425.75 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Cash entry saved' });
      expect(Cash.create).toHaveBeenCalledWith({
        UserId: 1,
        amount: 425.75,
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      });
    });

    it('should handle database errors', async () => {
      const mockUser = { id: 1, username: 'testuser' };
      User.findByPk.mockResolvedValue(mockUser);
      Cash.create.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/cash')
        .send({ amount: 425.75 });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Database error' });
    });

    it('should require authentication', async () => {
      // Remove the mock authentication for this test
      authenticate.mockImplementationOnce((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .post('/cash')
        .send({ amount: 425.75 });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /cash', () => {
    it('should retrieve cash entries for user', async () => {
      const mockCashEntries = [
        {
          id: 2,
          UserId: 1,
          amount: 380.50,
          date: '2024-01-15',
          createdAt: '2024-01-15T20:30:00.000Z',
          updatedAt: '2024-01-15T20:30:00.000Z'
        },
        {
          id: 1,
          UserId: 1,
          amount: 425.75,
          date: '2024-01-14',
          createdAt: '2024-01-14T19:45:00.000Z',
          updatedAt: '2024-01-14T19:45:00.000Z'
        }
      ];

      Cash.findAll.mockResolvedValue(mockCashEntries);

      const response = await request(app).get('/cash');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCashEntries);
      expect(Cash.findAll).toHaveBeenCalledWith({
        where: { UserId: 1 },
        order: [['date', 'DESC']]
      });
    });

    it('should handle database errors on retrieval', async () => {
      Cash.findAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/cash');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Database error' });
    });

    it('should return empty array when no entries exist', async () => {
      Cash.findAll.mockResolvedValue([]);

      const response = await request(app).get('/cash');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });
});