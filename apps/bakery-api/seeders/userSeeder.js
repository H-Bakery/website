const { User } = require("../models");
const logger = require("../utils/logger");
const bcrypt = require("bcrypt");

const seed = async () => {
  try {
    logger.info("Starting user seeder...");
    
    // Check if users already exist
    const userCount = await User.count();
    
    if (userCount > 0) {
      logger.info(`Users already exist (${userCount} users found). Skipping user seeding.`);
      return;
    }
    
    logger.info("No users found. Creating default users...");
    
    // Hash password for default users
    const hashedPassword = await bcrypt.hash("admin123", 10);
    
    // Create default users
    const defaultUsers = [
      {
        id: 1,
        username: "admin",
        password: hashedPassword,
        email: "admin@bakery.local",
        firstName: "Admin",
        lastName: "User",
        role: "admin",
        isActive: true
      },
      {
        id: 2, 
        username: "baker",
        password: hashedPassword,
        email: "baker@bakery.local",
        firstName: "Bäcker",
        lastName: "Meister",
        role: "staff",
        isActive: true
      },
      {
        id: 3,
        username: "sales",
        password: hashedPassword,
        email: "sales@bakery.local",
        firstName: "Verkauf",
        lastName: "Mitarbeiter",
        role: "staff",
        isActive: true
      }
    ];
    
    // Use bulkCreate to insert all users at once
    await User.bulkCreate(defaultUsers);
    
    logger.info(`Successfully created ${defaultUsers.length} default users`);
    logger.info("Default users created with password: admin123");
    
  } catch (error) {
    logger.error("Error in user seeder:", error);
    throw error;
  }
};

module.exports = { seed };