const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const logger = require("../utils/logger");

// Register new user
exports.register = async (req, res) => {
  logger.info("Processing registration request...");
  try {
    const { username, password, email, firstName, lastName, role } = req.body;
    logger.info(`Attempting to register user: ${username}`);

    // Validate required fields
    if (!username || !password || !email || !firstName || !lastName) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    logger.info("Password hashed successfully");

    const newUser = await User.create({
      username,
      password: hashedPassword,
      email,
      firstName,
      lastName,
      role: role || 'user' // Default to 'user' if no role specified
    });

    logger.info(`User created successfully with ID: ${newUser.id}`);
    res.json({ 
      message: "User created",
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role
      }
    });
  } catch (error) {
    logger.error("Registration error:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      logger.info("Registration failed: Username or email already exists");
      return res.status(400).json({ error: "Username or email already exists" });
    }
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: "Server error" });
  }
};

// Login user
exports.login = async (req, res) => {
  logger.info("Processing login request...");
  try {
    const { username, password } = req.body;
    logger.info(`Login attempt for user: ${username}`);

    const user = await User.findOne({ where: { username } });

    if (!user) {
      logger.info(`Login failed: User ${username} not found`);
      return res.status(400).json({ error: "Invalid credentials" });
    }

    logger.info(`User found with ID: ${user.id}, validating password...`);
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      logger.info(`Login failed: Invalid password for user ${username}`);
      return res.status(400).json({ error: "Invalid credentials" });
    }

    logger.info(`Password valid, generating token for user ${username}`);
    
    // Update last login timestamp
    await user.update({ lastLogin: new Date() });
    
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET);
    logger.info("Login successful");
    res.json({ 
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    logger.error("Login error:", error);
    res.status(500).json({ error: "Server error" });
  }
};
