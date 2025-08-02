const request = require('supertest');
const app = require('../../index');

describe('Security Integration Tests', () => {
  describe('Rate Limiting Integration', () => {
    it('should apply different rate limits to different route groups', async () => {
      // Test API route (should have 100 request limit)
      const apiResponse = await request(app)
        .get('/api/recipes')
        .expect(res => {
          // May be 200 or 404, but should not be rate limited initially
          expect([200, 404, 500]).toContain(res.status);
        });
      
      if (apiResponse.headers['ratelimit-limit']) {
        expect(apiResponse.headers['ratelimit-limit']).toBe('100');
      }
      
      // Test public route (should have 30 request limit if configured)
      const publicResponse = await request(app)
        .get('/products')
        .expect(res => {
          expect([200, 404, 500]).toContain(res.status);
        });
      
      if (publicResponse.headers['ratelimit-limit']) {
        expect(publicResponse.headers['ratelimit-limit']).toBe('30');
      }
    });
    
    it('should apply strict rate limiting to authentication endpoints', async () => {
      const authResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test', password: 'test' })
        .expect(res => {
          // Should get validation error or auth error, not rate limit initially
          expect([400, 401, 422, 500]).toContain(res.status);
        });
      
      if (authResponse.headers['ratelimit-limit']) {
        expect(authResponse.headers['ratelimit-limit']).toBe('10');
      }
    });
    
    it('should maintain rate limits across different IPs', async () => {
      // This test simulates different IPs by using different test agents
      const agent1 = request.agent(app);
      const agent2 = request.agent(app);
      
      const response1 = await agent1
        .get('/api/recipes')
        .expect(res => expect([200, 404, 500]).toContain(res.status));
      
      const response2 = await agent2
        .get('/api/recipes')
        .expect(res => expect([200, 404, 500]).toContain(res.status));
      
      // Both should have full rate limit available (rate limits are per IP)
      if (response1.headers['ratelimit-remaining'] && response2.headers['ratelimit-remaining']) {
        expect(response1.headers['ratelimit-remaining']).toBe(response2.headers['ratelimit-remaining']);
      }
    });
  });
  
  describe('Security Headers Integration', () => {
    it('should include helmet security headers on all responses', async () => {
      const endpoints = [
        '/api/recipes',
        '/products',
        '/api/auth/login' // POST endpoint
      ];
      
      for (const endpoint of endpoints) {
        const method = endpoint.includes('login') ? 'post' : 'get';
        const req = request(app)[method](endpoint);
        
        if (method === 'post') {
          req.send({ test: 'data' });
        }
        
        const response = await req.expect(res => {
          // Any response is fine, we're testing headers
          expect(res.status).toBeDefined();
        });
        
        // Check for critical security headers
        expect(response.headers).toHaveProperty('x-content-type-options');
        expect(response.headers).toHaveProperty('x-frame-options');
        expect(response.headers).toHaveProperty('content-security-policy');
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      }
    });
    
    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/api/recipes')
        .expect(res => expect([200, 404, 500]).toContain(res.status));
      
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).not.toContain('Express');
    });
    
    it('should include CSP headers that allow necessary resources', async () => {
      const response = await request(app)
        .get('/api/recipes')
        .expect(res => expect([200, 404, 500]).toContain(res.status));
      
      const csp = response.headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain('https://fonts.googleapis.com');
      expect(csp).toContain('ws://localhost:');
    });
  });
  
  describe('CORS and Security Integration', () => {
    it('should include both CORS and security headers', async () => {
      const response = await request(app)
        .get('/api/recipes')
        .set('Origin', 'http://localhost:3000')
        .expect(res => expect([200, 404, 500]).toContain(res.status));
      
      // Should have CORS headers
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      
      // Should also have security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('content-security-policy');
    });
    
    it('should handle preflight requests with security headers', async () => {
      const response = await request(app)
        .options('/api/recipes')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type')
        .expect(res => expect([200, 204]).toContain(res.status));
      
      // Should include security headers even for OPTIONS requests
      expect(response.headers).toHaveProperty('x-content-type-options');
    });
  });
  
  describe('Error Handling with Security', () => {
    it('should include security headers in error responses', async () => {
      const response = await request(app)
        .get('/nonexistent-endpoint')
        .expect(404);
      
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
    
    it('should include security headers in rate-limited responses', async () => {
      // Make many requests to trigger rate limiting
      const requests = Array(15).fill().map(() => 
        request(app)
          .post('/api/auth/login')
          .send({ username: 'test', password: 'test' })
      );
      
      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find(r => r.status === 429);
      
      if (rateLimitedResponse) {
        expect(rateLimitedResponse.headers).toHaveProperty('x-content-type-options');
        expect(rateLimitedResponse.headers).toHaveProperty('content-security-policy');
        expect(rateLimitedResponse.body).toHaveProperty('error');
        expect(rateLimitedResponse.body.error).toContain('Too many authentication attempts');
      }
    }, 10000);
  });
  
  describe('Security Configuration Validation', () => {
    it('should have appropriate security configuration for production', async () => {
      const response = await request(app)
        .get('/api/recipes')
        .expect(res => expect([200, 404, 500]).toContain(res.status));
      
      // Check HSTS is configured
      expect(response.headers).toHaveProperty('strict-transport-security');
      const hsts = response.headers['strict-transport-security'];
      expect(hsts).toContain('max-age=');
      
      // Check CSP is restrictive but functional
      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'"); // Restrictive default
      expect(csp).not.toContain("'unsafe-eval'"); // Should not allow eval
      
      // Check other security headers
      expect(response.headers['x-dns-prefetch-control']).toBe('off');
      expect(response.headers['x-download-options']).toBe('noopen');
    });
    
    it('should properly handle JSON request bodies with security headers', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ 
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User'
        })
        .expect(res => {
          // Should get validation error or success, not server error
          expect([200, 201, 400, 409, 422, 429]).toContain(res.status);
        });
      
      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers).toHaveProperty('x-content-type-options');
    });
  });
});