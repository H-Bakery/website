const jwt = require("jsonwebtoken");
const { authenticate } = require("../../middleware/authMiddleware");

// Mock the logger to avoid console output during tests
jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  db: jest.fn(),
  debug: jest.fn(),
  request: jest.fn(),
}));

// Mock the User model
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn()
  }
}));

const { User } = require("../../models");

describe("Auth Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe("authenticate", () => {
    it("should authenticate valid Bearer token", async () => {
      const userId = 123;
      const mockUser = { id: userId, role: 'user', isActive: true };
      User.findByPk.mockResolvedValue(mockUser);
      
      const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);
      
      // Wait for async operations
      await new Promise(resolve => setImmediate(resolve));

      expect(User.findByPk).toHaveBeenCalledWith(userId);
      expect(req.userId).toBe(userId);
      expect(req.userRole).toBe('user');
      expect(req.user).toBe(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should authenticate valid token without Bearer prefix", async () => {
      const userId = 456;
      const mockUser = { id: userId, role: 'admin', isActive: true };
      User.findByPk.mockResolvedValue(mockUser);
      
      const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
      req.headers.authorization = token;

      authenticate(req, res, next);
      
      // Wait for async operations
      await new Promise(resolve => setImmediate(resolve));

      expect(User.findByPk).toHaveBeenCalledWith(userId);
      expect(req.userId).toBe(userId);
      expect(req.userRole).toBe('admin');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should reject request with no authorization header", () => {
      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
      expect(req.userId).toBeUndefined();
    });

    it("should reject request with empty authorization header", () => {
      req.headers.authorization = "";

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
      expect(req.userId).toBeUndefined();
    });

    it("should reject request with Bearer but no token", () => {
      req.headers.authorization = "Bearer ";

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
      expect(req.userId).toBeUndefined();
    });

    it("should reject request with invalid token", () => {
      req.headers.authorization = "Bearer invalid_token";

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
      expect(req.userId).toBeUndefined();
    });

    it("should reject request with expired token", () => {
      const userId = 789;
      const expiredToken = jwt.sign(
        { id: userId, exp: Math.floor(Date.now() / 1000) - 10 }, // Expired 10 seconds ago
        process.env.JWT_SECRET
      );
      req.headers.authorization = `Bearer ${expiredToken}`;

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
      expect(req.userId).toBeUndefined();
    });

    it("should reject token signed with wrong secret", () => {
      const userId = 999;
      const wrongSecretToken = jwt.sign({ id: userId }, "wrong_secret");
      req.headers.authorization = `Bearer ${wrongSecretToken}`;

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
      expect(req.userId).toBeUndefined();
    });

    it("should handle malformed token", () => {
      req.headers.authorization = "Bearer malformed.token.here";

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
      expect(req.userId).toBeUndefined();
    });

    it("should handle token with missing payload", async () => {
      const mockUser = { id: 1, role: 'user', isActive: true };
      User.findByPk.mockResolvedValue(mockUser);
      
      const tokenWithoutPayload = jwt.sign({}, process.env.JWT_SECRET);
      req.headers.authorization = `Bearer ${tokenWithoutPayload}`;

      authenticate(req, res, next);
      
      // Wait for async operations
      await new Promise(resolve => setImmediate(resolve));

      expect(req.userId).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should preserve other request properties", async () => {
      const userId = 111;
      const mockUser = { id: userId, role: 'staff', isActive: true };
      User.findByPk.mockResolvedValue(mockUser);
      
      const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
      req.headers.authorization = `Bearer ${token}`;
      req.body = { test: "data" };
      req.params = { id: "123" };
      req.query = { search: "test" };

      authenticate(req, res, next);
      
      // Wait for async operations
      await new Promise(resolve => setImmediate(resolve));

      expect(req.userId).toBe(userId);
      expect(req.body).toEqual({ test: "data" });
      expect(req.params).toEqual({ id: "123" });
      expect(req.query).toEqual({ search: "test" });
      expect(next).toHaveBeenCalled();
    });

    it("should handle lowercase bearer (treated as raw token)", () => {
      const userId = 222;
      const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
      
      // Test lowercase bearer - middleware treats this as raw token since it doesn't match "Bearer "
      req.headers.authorization = `bearer ${token}`;
      authenticate(req, res, next);
      
      // This should fail because "bearer token" is not a valid JWT
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should handle token with additional claims", async () => {
      const userId = 333;
      const mockUser = { id: userId, role: 'admin', isActive: true };
      User.findByPk.mockResolvedValue(mockUser);
      
      const tokenWithClaims = jwt.sign(
        { 
          id: userId, 
          username: "testuser",
          role: "admin",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour from now
        }, 
        process.env.JWT_SECRET
      );
      req.headers.authorization = `Bearer ${tokenWithClaims}`;

      authenticate(req, res, next);
      
      // Wait for async operations
      await new Promise(resolve => setImmediate(resolve));

      expect(req.userId).toBe(userId);
      expect(req.userRole).toBe('admin');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should work with numeric user IDs", async () => {
      const userId = 12345;
      const mockUser = { id: userId, role: 'user', isActive: true };
      User.findByPk.mockResolvedValue(mockUser);
      
      const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);
      
      // Wait for async operations
      await new Promise(resolve => setImmediate(resolve));

      expect(req.userId).toBe(userId);
      expect(typeof req.userId).toBe("number");
      expect(next).toHaveBeenCalled();
    });

    it("should reject token when user not found", async () => {
      const userId = 999;
      User.findByPk.mockResolvedValue(null);
      
      const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);
      
      // Wait for async operations
      await new Promise(resolve => setImmediate(resolve));

      expect(User.findByPk).toHaveBeenCalledWith(userId);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
    });
    
    it("should reject token when user is inactive", async () => {
      const userId = 888;
      const inactiveUser = { id: userId, role: 'user', isActive: false };
      User.findByPk.mockResolvedValue(inactiveUser);
      
      const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);
      
      // Wait for async operations
      await new Promise(resolve => setImmediate(resolve));

      expect(User.findByPk).toHaveBeenCalledWith(userId);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
    });
    
    it("should handle database errors gracefully", async () => {
      const userId = 777;
      User.findByPk.mockRejectedValue(new Error('Database error'));
      
      const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);
      
      // Wait for async operations
      await new Promise(resolve => setImmediate(resolve));

      expect(User.findByPk).toHaveBeenCalledWith(userId);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Server error" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should work with string user IDs", async () => {
      const userId = "string-user-id";
      const mockUser = { id: userId, role: 'user', isActive: true };
      User.findByPk.mockResolvedValue(mockUser);
      
      const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);
      
      // Wait for async operations
      await new Promise(resolve => setImmediate(resolve));

      expect(req.userId).toBe(userId);
      expect(typeof req.userId).toBe("string");
      expect(next).toHaveBeenCalled();
    });
  });

  describe("JWT Security", () => {
    it("should verify token signature correctly", async () => {
      const userId = 444;
      const mockUser = { id: userId, role: 'user', isActive: true };
      User.findByPk.mockResolvedValue(mockUser);
      
      const validToken = jwt.sign({ id: userId }, process.env.JWT_SECRET);
      
      // Manually verify the token can be decoded
      const decoded = jwt.verify(validToken, process.env.JWT_SECRET);
      expect(decoded.id).toBe(userId);

      req.headers.authorization = `Bearer ${validToken}`;
      authenticate(req, res, next);
      
      // Wait for async operations
      await new Promise(resolve => setImmediate(resolve));

      expect(req.userId).toBe(userId);
      expect(next).toHaveBeenCalled();
    });

    it("should reject tokens with modified payload", () => {
      const originalToken = jwt.sign({ id: 555 }, process.env.JWT_SECRET);
      
      // Manually tamper with the token (this will break the signature)
      const parts = originalToken.split('.');
      const tamperedPayload = Buffer.from('{"id":999}').toString('base64url');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
      
      req.headers.authorization = `Bearer ${tamperedToken}`;
      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Error Scenarios", () => {
    it("should handle JWT verification errors gracefully", () => {
      const token = "some_token";
      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should handle unexpected token format", () => {
      req.headers.authorization = "NotBearer invalid_format";

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should handle very long tokens", () => {
      const veryLongInvalidToken = "a".repeat(10000);
      req.headers.authorization = `Bearer ${veryLongInvalidToken}`;

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
    });
  });
});