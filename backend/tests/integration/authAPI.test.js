const request = require("supertest");
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authRoutes = require("../../routes/authRoutes");
const { User } = require("../../models");
const { setupTestDatabase, cleanupTestDatabase } = require("../helpers/testSetup");
// JWT secret is now in environment variables

// Mock the logger to avoid console output during tests
jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  db: jest.fn(),
  debug: jest.fn(),
  request: jest.fn(),
}));

describe("Auth API Integration Tests", () => {
  let app;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // Create Express app with auth routes
    app = express();
    app.use(express.json());
    app.use("/auth", authRoutes);
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Clear users table before each test
    await User.destroy({ where: {} });
  });

  describe("POST /auth/register", () => {
    it("should register a new user successfully", async () => {
      const userData = {
        username: "testuser",
        password: "testpassword123",
      };

      const response = await request(app)
        .post("/auth/register")
        .send(userData)
        .expect(200);

      expect(response.body).toEqual({ message: "User created" });

      // Verify user was created in database
      const user = await User.findOne({ where: { username: "testuser" } });
      expect(user).toBeTruthy();
      expect(user.username).toBe("testuser");
      
      // Verify password was hashed
      const isPasswordValid = await bcrypt.compare("testpassword123", user.password);
      expect(isPasswordValid).toBe(true);
    });

    it("should return 400 for duplicate username", async () => {
      // Create a user first
      await User.create({
        username: "existinguser",
        password: await bcrypt.hash("password123", 10),
      });

      const userData = {
        username: "existinguser",
        password: "newpassword123",
      };

      const response = await request(app)
        .post("/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body).toEqual({ error: "User exists" });
    });

    it("should return 500 for missing username", async () => {
      const userData = {
        password: "testpassword123",
      };

      const response = await request(app)
        .post("/auth/register")
        .send(userData)
        .expect(500);

      expect(response.body).toEqual({ error: "Server error" });
    });

    it("should return 500 for missing password", async () => {
      const userData = {
        username: "testuser",
      };

      const response = await request(app)
        .post("/auth/register")
        .send(userData)
        .expect(500);

      expect(response.body).toEqual({ error: "Server error" });
    });

    it("should handle empty request body", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({})
        .expect(500);

      expect(response.body).toEqual({ error: "Server error" });
    });

    it("should handle malformed JSON", async () => {
      const response = await request(app)
        .post("/auth/register")
        .set("Content-Type", "application/json")
        .send("invalid json")
        .expect(400);
    });

    it("should reject very long username", async () => {
      const userData = {
        username: "a".repeat(1000), // Very long username
        password: "testpassword123",
      };

      const response = await request(app)
        .post("/auth/register")
        .send(userData)
        .expect(500);

      expect(response.body).toEqual({ error: "Server error" });
    });

    it("should handle special characters in username", async () => {
      const userData = {
        username: "user@test.com",
        password: "testpassword123",
      };

      const response = await request(app)
        .post("/auth/register")
        .send(userData)
        .expect(200);

      expect(response.body).toEqual({ message: "User created" });
    });

    it("should handle unicode characters in username", async () => {
      const userData = {
        username: "用戶名",
        password: "testpassword123",
      };

      const response = await request(app)
        .post("/auth/register")
        .send(userData)
        .expect(200);

      expect(response.body).toEqual({ message: "User created" });
    });
  });

  describe("POST /auth/login", () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await User.create({
        username: "loginuser",
        password: await bcrypt.hash("correctpassword", 10),
      });
    });

    it("should login successfully with valid credentials", async () => {
      const loginData = {
        username: "loginuser",
        password: "correctpassword",
      };

      const response = await request(app)
        .post("/auth/login")
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty("token");
      expect(typeof response.body.token).toBe("string");

      // Verify the token is valid
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      expect(decoded.id).toBeTruthy();
    });

    it("should return 400 for invalid username", async () => {
      const loginData = {
        username: "nonexistentuser",
        password: "correctpassword",
      };

      const response = await request(app)
        .post("/auth/login")
        .send(loginData)
        .expect(400);

      expect(response.body).toEqual({ error: "Invalid credentials" });
    });

    it("should return 400 for invalid password", async () => {
      const loginData = {
        username: "loginuser",
        password: "wrongpassword",
      };

      const response = await request(app)
        .post("/auth/login")
        .send(loginData)
        .expect(400);

      expect(response.body).toEqual({ error: "Invalid credentials" });
    });

    it("should return 400 for missing username", async () => {
      const loginData = {
        password: "correctpassword",
      };

      const response = await request(app)
        .post("/auth/login")
        .send(loginData)
        .expect(400);

      expect(response.body).toEqual({ error: "Invalid credentials" });
    });

    it("should return 500 for missing password", async () => {
      const loginData = {
        username: "loginuser",
      };

      const response = await request(app)
        .post("/auth/login")
        .send(loginData)
        .expect(500);

      expect(response.body).toEqual({ error: "Server error" });
    });

    it("should handle empty request body", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({})
        .expect(400);

      expect(response.body).toEqual({ error: "Invalid credentials" });
    });

    it("should handle case-sensitive username", async () => {
      const loginData = {
        username: "LOGINUSER", // Different case
        password: "correctpassword",
      };

      const response = await request(app)
        .post("/auth/login")
        .send(loginData)
        .expect(400);

      expect(response.body).toEqual({ error: "Invalid credentials" });
    });

    it("should return different tokens for different logins", async () => {
      const loginData = {
        username: "loginuser",
        password: "correctpassword",
      };

      // First login
      const response1 = await request(app)
        .post("/auth/login")
        .send(loginData)
        .expect(200);

      // Second login
      const response2 = await request(app)
        .post("/auth/login")
        .send(loginData)
        .expect(200);

      expect(response1.body.token).not.toBe(response2.body.token);
    });

    it("should handle multiple users correctly", async () => {
      // Create another user
      await User.create({
        username: "anotheruser",
        password: await bcrypt.hash("password123", 10),
      });

      // Login as first user
      const response1 = await request(app)
        .post("/auth/login")
        .send({ username: "loginuser", password: "correctpassword" })
        .expect(200);

      // Login as second user
      const response2 = await request(app)
        .post("/auth/login")
        .send({ username: "anotheruser", password: "password123" })
        .expect(200);

      expect(response1.body.token).not.toBe(response2.body.token);

      // Verify tokens decode to different user IDs
      const decoded1 = jwt.verify(response1.body.token, process.env.JWT_SECRET);
      const decoded2 = jwt.verify(response2.body.token, process.env.JWT_SECRET);
      expect(decoded1.id).not.toBe(decoded2.id);
    });
  });

  describe("Content-Type Handling", () => {
    it("should handle application/json content type", async () => {
      const userData = {
        username: "jsonuser",
        password: "password123",
      };

      const response = await request(app)
        .post("/auth/register")
        .set("Content-Type", "application/json")
        .send(userData)
        .expect(200);

      expect(response.body).toEqual({ message: "User created" });
    });

    it("should reject non-JSON content types", async () => {
      const response = await request(app)
        .post("/auth/register")
        .set("Content-Type", "text/plain")
        .send("username=testuser&password=password123")
        .expect(500);

      expect(response.body).toEqual({ error: "Server error" });
    });
  });

  describe("Rate Limiting Simulation", () => {
    it("should handle multiple rapid requests", async () => {
      const requests = [];
      
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post("/auth/register")
            .send({
              username: `user${i}`,
              password: "password123",
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // All should succeed (no rate limiting implemented yet)
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: "User created" });
      });
    });
  });

  describe("Security Headers", () => {
    it("should not expose sensitive information in error responses", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({ username: "nonexistent", password: "wrong" })
        .expect(400);

      expect(response.body.error).toBe("Invalid credentials");
      expect(response.body).not.toHaveProperty("username");
      expect(response.body).not.toHaveProperty("password");
      expect(response.body).not.toHaveProperty("stack");
    });

    it("should handle SQL injection attempts", async () => {
      const maliciousData = {
        username: "admin'; DROP TABLE users; --",
        password: "password123",
      };

      const response = await request(app)
        .post("/auth/login")
        .send(maliciousData)
        .expect(400);

      expect(response.body).toEqual({ error: "Invalid credentials" });
      
      // Verify users table still exists and is accessible
      const users = await User.findAll();
      expect(Array.isArray(users)).toBe(true);
    });

    it("should handle XSS attempts in username", async () => {
      const xssData = {
        username: "<script>alert('xss')</script>",
        password: "password123",
      };

      const response = await request(app)
        .post("/auth/register")
        .send(xssData)
        .expect(200);

      expect(response.body).toEqual({ message: "User created" });
      
      // Verify the malicious script was stored as plain text
      const user = await User.findOne({ where: { username: xssData.username } });
      expect(user.username).toBe("<script>alert('xss')</script>");
    });
  });

  describe("Large Payload Handling", () => {
    it("should handle reasonably large passwords", async () => {
      const userData = {
        username: "longpassuser",
        password: "a".repeat(200), // 200 character password
      };

      const response = await request(app)
        .post("/auth/register")
        .send(userData)
        .expect(200);

      expect(response.body).toEqual({ message: "User created" });
    });

    it("should handle extremely large payloads gracefully", async () => {
      const userData = {
        username: "largeuser",
        password: "a".repeat(10000), // Very large password
      };

      const response = await request(app)
        .post("/auth/register")
        .send(userData);

      // Should either succeed or fail gracefully (not crash)
      expect([200, 413, 500]).toContain(response.status);
    });
  });
});