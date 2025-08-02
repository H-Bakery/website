const request = require('supertest');
const express = require('express');
const { userRegistrationRules, loginRules } = require('../../validators/authValidator');
const { handleValidationErrors } = require('../../middleware/validationMiddleware');

// Create a test express app
const createTestApp = (validationRules) => {
  const app = express();
  app.use(express.json());
  
  app.post('/test', validationRules(), handleValidationErrors, (req, res) => {
    res.json({ success: true, data: req.body });
  });
  
  return app;
};

describe('Auth Validator', () => {
  describe('User Registration Rules', () => {
    let app;
    
    beforeEach(() => {
      app = createTestApp(userRegistrationRules);
    });
    
    it('should accept valid registration data', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          username: 'newuser',
          password: 'SecurePass123!',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'user'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          username: 'newuser'
        });
      
      expect(response.status).toBe(422);
      expect(response.body.errors).toHaveProperty('password');
      expect(response.body.errors).toHaveProperty('email');
    });
    
    it('should reject invalid username', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          username: 'ab', // too short
          password: 'SecurePass123!',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe'
        });
      
      expect(response.status).toBe(422);
      expect(response.body.errors.username).toContain('Username must be between 3 and 30 characters');
    });
    
    it('should reject weak password', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          username: 'newuser',
          password: 'weak', // too short and no uppercase/digits
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe'
        });
      
      expect(response.status).toBe(422);
      expect(response.body.errors.password).toBeDefined();
    });
    
    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          username: 'newuser',
          password: 'SecurePass123!',
          email: 'invalid-email',
          firstName: 'John',
          lastName: 'Doe'
        });
      
      expect(response.status).toBe(422);
      expect(response.body.errors.email).toContain('Must be a valid email address');
    });
    
    it('should reject invalid role', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          username: 'newuser',
          password: 'SecurePass123!',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'superadmin' // invalid role
        });
      
      expect(response.status).toBe(422);
      expect(response.body.errors.role).toContain('Role must be either user or admin');
    });
    
    it('should normalize email to lowercase', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          username: 'newuser',
          password: 'SecurePass123!',
          email: 'USER@EXAMPLE.COM',
          firstName: 'John',
          lastName: 'Doe'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data.email).toBe('user@example.com');
    });
    
    it('should escape HTML in text fields', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          username: 'newuser',
          password: 'SecurePass123!',
          email: 'user@example.com',
          firstName: '<script>alert("xss")</script>',
          lastName: 'Doe'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data.firstName).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });
  });
  
  describe('Login Rules', () => {
    let app;
    
    beforeEach(() => {
      app = createTestApp(loginRules);
    });
    
    it('should accept valid login data', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          username: 'testuser',
          password: 'SecurePass123!'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should reject missing username', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          password: 'SecurePass123!'
        });
      
      expect(response.status).toBe(422);
      expect(response.body.errors.username).toBeDefined();
    });
    
    it('should reject missing password', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          username: 'testuser'
        });
      
      expect(response.status).toBe(422);
      expect(response.body.errors.password).toBeDefined();
    });
    
    it('should trim whitespace from username', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          username: '  testuser  ',
          password: 'SecurePass123!'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data.username).toBe('testuser');
    });
  });
});