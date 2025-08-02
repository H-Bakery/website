const request = require('supertest');
const express = require('express');
const helmet = require('helmet');

// Create test app with helmet
const createTestApp = () => {
  const app = express();
  
  // Apply helmet with same configuration as main app
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws://localhost:*", "wss://localhost:*"],
        scriptSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));
  
  app.get('/test', (req, res) => {
    res.json({ message: 'success' });
  });
  
  app.get('/api/test', (req, res) => {
    res.json({ message: 'api success' });
  });
  
  return app;
};

describe('Security Headers (Helmet.js)', () => {
  let app;
  
  beforeEach(() => {
    app = createTestApp();
  });
  
  describe('Content Security Policy', () => {
    it('should include Content-Security-Policy header', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers).toHaveProperty('content-security-policy');
      
      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
      expect(csp).toContain("font-src 'self' https://fonts.gstatic.com");
      expect(csp).toContain("img-src 'self' data: https:");
      expect(csp).toContain("script-src 'self'");
    });
    
    it('should allow WebSocket connections in development', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("connect-src 'self' ws://localhost:* wss://localhost:*");
    });
  });
  
  describe('Security Headers', () => {
    it('should include X-Content-Type-Options header', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
    
    it('should include X-Frame-Options header', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
    
    it('should include X-XSS-Protection header', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
    
    it('should include Referrer-Policy header', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers).toHaveProperty('referrer-policy');
    });
    
    it('should include X-DNS-Prefetch-Control header', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers['x-dns-prefetch-control']).toBe('off');
    });
    
    it('should include X-Download-Options header', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers['x-download-options']).toBe('noopen');
    });
    
    it('should include X-Permitted-Cross-Domain-Policies header', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers['x-permitted-cross-domain-policies']).toBe('none');
    });
  });
  
  describe('HTTPS Security Headers', () => {
    it('should include Strict-Transport-Security header', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers).toHaveProperty('strict-transport-security');
      
      // Check that it includes max-age directive
      const hsts = response.headers['strict-transport-security'];
      expect(hsts).toContain('max-age=');
    });
  });
  
  describe('Cross-Origin Policy', () => {
    it('should not include Cross-Origin-Embedder-Policy when disabled', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      // Should not include COEP since we disabled it for development
      expect(response.headers).not.toHaveProperty('cross-origin-embedder-policy');
    });
    
    it('should include Cross-Origin-Resource-Policy', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers).toHaveProperty('cross-origin-resource-policy');
    });
  });
  
  describe('API Endpoints Security', () => {
    it('should apply security headers to API endpoints', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);
      
      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('strict-transport-security');
    });
    
    it('should maintain consistent security headers across different endpoints', async () => {
      const [response1, response2] = await Promise.all([
        request(app).get('/test'),
        request(app).get('/api/test')
      ]);
      
      // Both should have the same security headers
      expect(response1.headers['x-content-type-options']).toBe(response2.headers['x-content-type-options']);
      expect(response1.headers['x-frame-options']).toBe(response2.headers['x-frame-options']);
      expect(response1.headers['content-security-policy']).toBe(response2.headers['content-security-policy']);
    });
  });
  
  describe('Security Headers Validation', () => {
    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      // Should not expose Express server info
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
    
    it('should include all critical security headers for defense in depth', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      const criticalHeaders = [
        'content-security-policy',
        'x-content-type-options',
        'x-frame-options',
        'strict-transport-security',
        'referrer-policy'
      ];
      
      criticalHeaders.forEach(header => {
        expect(response.headers).toHaveProperty(header);
      });
    });
    
    it('should have appropriate CSP directives for a bakery application', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      const csp = response.headers['content-security-policy'];
      
      // Should allow fonts from Google Fonts for UI
      expect(csp).toContain('https://fonts.googleapis.com');
      expect(csp).toContain('https://fonts.gstatic.com');
      
      // Should allow images from various sources for product images
      expect(csp).toContain("img-src 'self' data: https:");
      
      // Should allow unsafe-inline for styles (common requirement for dynamic UIs)
      expect(csp).toContain("'unsafe-inline'");
    });
  });
});