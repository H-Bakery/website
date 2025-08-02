const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { testConnection } = require('../../config/database');
const { syncDatabase, Cash, User } = require('../../models');
const authRoutes = require('../../routes/authRoutes');
const cashRoutes = require('../../routes/cashRoutes');

// Create test app that mirrors the main app
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use('/', authRoutes);
app.use('/cash', cashRoutes);

describe('Cash API Integration Tests', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    // Ensure database connection
    const connected = await testConnection();
    if (connected) {
      await syncDatabase();
    }
  });

  beforeEach(async () => {
    // Clean up data
    await Cash.destroy({ where: {} });
    await User.destroy({ where: {} });

    // Create a test user and get auth token
    const registerResponse = await request(app)
      .post('/register')
      .send({
        username: 'testuser',
        password: 'testpass123'
      });

    expect(registerResponse.status).toBe(200);

    const loginResponse = await request(app)
      .post('/login')
      .send({
        username: 'testuser',
        password: 'testpass123'
      });

    expect(loginResponse.status).toBe(200);
    authToken = loginResponse.body.token;
    
    // Since the login response doesn't include userId, we need to get it from the token
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
    userId = decoded.id;
  });

  afterEach(async () => {
    // Clean up after each test
    await Cash.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  describe('POST /cash', () => {
    it('should create a cash entry with valid authentication', async () => {
      const cashAmount = 456.78;

      const response = await request(app)
        .post('/cash')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: cashAmount });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Cash entry saved' });

      // Verify the entry was created in the database
      const cashEntries = await Cash.findAll({ where: { UserId: userId } });
      expect(cashEntries).toHaveLength(1);
      expect(cashEntries[0].amount).toBe(cashAmount);
      expect(cashEntries[0].date).toBe(new Date().toISOString().split('T')[0]);
    });

    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .post('/cash')
        .send({ amount: 456.78 });

      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .post('/cash')
        .set('Authorization', 'Bearer invalid-token')
        .send({ amount: 456.78 });

      expect(response.status).toBe(401);
    });

    it('should handle missing amount', async () => {
      const response = await request(app)
        .post('/cash')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      // Should return 400 for missing amount due to validation
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid amount');
    });
  });

  describe('GET /cash', () => {
    beforeEach(async () => {
      // Create some test cash entries
      await Cash.create({
        UserId: userId,
        amount: 425.75,
        date: '2024-01-15'
      });
      await Cash.create({
        UserId: userId,
        amount: 380.50,
        date: '2024-01-14'
      });
      await Cash.create({
        UserId: userId,
        amount: 502.25,
        date: '2024-01-13'
      });
    });

    it('should retrieve cash entries for authenticated user', async () => {
      const response = await request(app)
        .get('/cash')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
      
      // Should be ordered by date DESC
      expect(response.body[0].date).toBe('2024-01-15');
      expect(response.body[0].amount).toBe(425.75);
      expect(response.body[1].date).toBe('2024-01-14');
      expect(response.body[2].date).toBe('2024-01-13');

      // Verify all entries belong to the authenticated user
      response.body.forEach(entry => {
        expect(entry.UserId).toBe(userId);
      });
    });

    it('should return empty array when user has no cash entries', async () => {
      // Clean up existing entries
      await Cash.destroy({ where: { UserId: userId } });

      const response = await request(app)
        .get('/cash')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should reject requests without authentication', async () => {
      const response = await request(app).get('/cash');

      expect(response.status).toBe(401);
    });

    it('should not return cash entries from other users', async () => {
      // Create another user
      await request(app)
        .post('/register')
        .send({
          username: 'otheruser',
          password: 'otherpass123'
        });

      const otherLoginResponse = await request(app)
        .post('/login')
        .send({
          username: 'otheruser',
          password: 'otherpass123'
        });

      const otherToken = otherLoginResponse.body.token;
      const jwt = require('jsonwebtoken');
      const otherDecoded = jwt.verify(otherToken, process.env.JWT_SECRET);
      const otherUserId = otherDecoded.id;

      // Add cash entry for other user
      await Cash.create({
        UserId: otherUserId,
        amount: 999.99,
        date: '2024-01-15'
      });

      // Request cash entries with original user's token
      const response = await request(app)
        .get('/cash')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3); // Only original user's entries
      expect(response.body.every(entry => entry.amount !== 999.99)).toBe(true);
    });
  });

  describe('Full workflow', () => {
    it('should allow creating and retrieving cash entries', async () => {
      // Add multiple cash entries
      const amounts = [425.75, 380.50, 502.25];
      
      for (const amount of amounts) {
        const response = await request(app)
          .post('/cash')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ amount });

        expect(response.status).toBe(200);
      }

      // Retrieve all entries
      const getResponse = await request(app)
        .get('/cash')
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toHaveLength(3);

      // Verify amounts (order may vary due to same date)
      const retrievedAmounts = getResponse.body.map(entry => entry.amount).sort();
      const expectedAmounts = amounts.sort();
      expect(retrievedAmounts).toEqual(expectedAmounts);
    });
  });
});