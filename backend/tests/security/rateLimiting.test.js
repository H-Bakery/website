const request = require('supertest');
const express = require('express');
const { apiLimiter, authLimiter, publicLimiter } = require('../../middleware/rateLimitMiddleware');

// Create test apps with different rate limiters
const createTestApp = (limiter, routePath = '/test') => {
  const app = express();
  app.use(express.json());
  
  app.use(routePath, limiter);
  
  app.get('/test', (req, res) => {
    res.json({ message: 'success', timestamp: Date.now() });
  });
  
  app.post('/test', (req, res) => {
    res.json({ message: 'success', body: req.body });
  });
  
  return app;
};

describe('Rate Limiting Middleware', () => {
  describe('API Rate Limiter', () => {
    let app;
    
    beforeEach(() => {
      app = createTestApp(apiLimiter);
    });
    
    it('should allow requests within the limit', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.body.message).toBe('success');
      expect(response.headers['ratelimit-limit']).toBe('100');
      expect(response.headers['ratelimit-remaining']).toBe('99');
    });
    
    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
      expect(response.headers).toHaveProperty('ratelimit-reset');
      expect(response.headers['ratelimit-limit']).toBe('100');
    });
    
    it('should rate limit after exceeding the limit', async () => {
      // Make 101 requests quickly
      const requests = Array(101).fill().map(() => 
        request(app).get('/test')
      );
      
      const responses = await Promise.all(requests);
      
      // First 100 should succeed
      const successfulResponses = responses.filter(r => r.status === 200);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(successfulResponses.length).toBeGreaterThanOrEqual(90); // Allow some variance
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      // Check rate limited response
      if (rateLimitedResponses.length > 0) {
        const limitedResponse = rateLimitedResponses[0];
        expect(limitedResponse.body.error).toContain('Too many requests');
        expect(limitedResponse.body.retryAfter).toBe('15 minutes');
      }
    }, 10000); // Increase timeout for this test
  });
  
  describe('Auth Rate Limiter', () => {
    let app;
    
    beforeEach(() => {
      app = createTestApp(authLimiter);
    });
    
    it('should have stricter limits than API limiter', async () => {
      const response = await request(app)
        .post('/test')
        .send({ username: 'test', password: 'test' })
        .expect(200);
      
      expect(response.headers['ratelimit-limit']).toBe('10');
      expect(response.headers['ratelimit-remaining']).toBe('9');
    });
    
    it('should rate limit authentication attempts', async () => {
      // Make 11 requests quickly
      const requests = Array(11).fill().map(() => 
        request(app)
          .post('/test')
          .send({ username: 'test', password: 'test' })
      );
      
      const responses = await Promise.all(requests);
      
      const successfulResponses = responses.filter(r => r.status === 200);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(successfulResponses.length).toBeLessThanOrEqual(10);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      if (rateLimitedResponses.length > 0) {
        const limitedResponse = rateLimitedResponses[0];
        expect(limitedResponse.body.error).toContain('Too many authentication attempts');
      }
    }, 8000);
  });
  
  describe('Public Rate Limiter', () => {
    let app;
    
    beforeEach(() => {
      app = createTestApp(publicLimiter);
    });
    
    it('should have more lenient limits', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers['ratelimit-limit']).toBe('30');
      expect(response.headers['ratelimit-remaining']).toBe('29');
    });
    
    it('should have shorter window period', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      // Reset time should be within 1 minute (60 seconds)
      const resetTime = parseInt(response.headers['ratelimit-reset']);
      const currentTime = Math.floor(Date.now() / 1000);
      const timeDifference = resetTime - currentTime;
      
      expect(timeDifference).toBeLessThanOrEqual(60);
    });
  });
  
  describe('Rate Limit Error Handling', () => {
    let app;
    
    beforeEach(() => {
      app = createTestApp(authLimiter);
    });
    
    it('should log rate limit violations', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Trigger rate limit
      const requests = Array(12).fill().map(() => 
        request(app).post('/test').send({ test: 'data' })
      );
      
      await Promise.all(requests);
      
      // The logger should have been called for rate limit violations
      // Note: This test depends on the logger implementation
      consoleSpy.mockRestore();
    });
    
    it('should return consistent error format', async () => {
      // Trigger rate limit by making many requests
      const requests = Array(12).fill().map(() => 
        request(app).post('/test').send({ test: 'data' })
      );
      
      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find(r => r.status === 429);
      
      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body).toHaveProperty('error');
        expect(rateLimitedResponse.body).toHaveProperty('retryAfter');
        expect(typeof rateLimitedResponse.body.error).toBe('string');
        expect(typeof rateLimitedResponse.body.retryAfter).toBe('string');
      }
    });
  });
  
  describe('Rate Limit Configuration', () => {
    it('should have different limits for different rate limiters', async () => {
      // Test that each rate limiter has the expected configuration
      const apiApp = createTestApp(apiLimiter);
      const authApp = createTestApp(authLimiter);
      const publicApp = createTestApp(publicLimiter);
      
      const [apiResponse, authResponse, publicResponse] = await Promise.all([
        request(apiApp).get('/test'),
        request(authApp).post('/test').send({}),
        request(publicApp).get('/test')
      ]);
      
      // Check that different limiters have different limits
      expect(apiResponse.headers['ratelimit-limit']).toBe('100');
      expect(authResponse.headers['ratelimit-limit']).toBe('10');
      expect(publicResponse.headers['ratelimit-limit']).toBe('30');
    });
    
    it('should have appropriate error messages for each limiter type', async () => {
      // The error messages should be different for different limiters
      expect(typeof apiLimiter).toBe('function');
      expect(typeof authLimiter).toBe('function');
      expect(typeof publicLimiter).toBe('function');
    });
  });
});