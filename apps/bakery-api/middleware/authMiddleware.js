const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const { User } = require("../models");

const authenticate = (req, res, next) => {
  logger.info("Authenticating request...");
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    logger.info("Authentication failed: No authorization header provided");
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Extract token from "Bearer <token>" format
  const token = authHeader.startsWith("Bearer ") 
    ? authHeader.substring(7) 
    : authHeader;

  if (!token) {
    logger.info("Authentication failed: No token provided");
    return res.status(401).json({ error: "Unauthorized" });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      logger.error("Authentication failed: Invalid token", err);
      return res.status(401).json({ error: "Invalid token" });
    }

    try {
      // Fetch user to get current role and check if active
      const user = await User.findByPk(decoded.id);
      
      if (!user || !user.isActive) {
        logger.info(`Authentication failed: User ${decoded.id} not found or inactive`);
        return res.status(401).json({ error: "Unauthorized" });
      }

      req.userId = decoded.id;
      req.userRole = user.role;
      req.user = user;
      logger.info(`Authentication successful for user ID: ${req.userId} with role: ${req.userRole}`);
      next();
    } catch (error) {
      logger.error("Error fetching user during authentication:", error);
      return res.status(500).json({ error: "Server error" });
    }
  });
};

// Middleware to require admin role
const requireAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    logger.info(`Access denied: User ${req.userId} with role ${req.userRole} attempted to access admin resource`);
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  next();
};

// Middleware to require at least staff role
const requireStaff = (req, res, next) => {
  if (req.userRole !== 'admin' && req.userRole !== 'staff') {
    logger.info(`Access denied: User ${req.userId} with role ${req.userRole} attempted to access staff resource`);
    return res.status(403).json({ error: "Forbidden: Staff access required" });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireStaff };
