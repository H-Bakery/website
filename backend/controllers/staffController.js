const bcrypt = require("bcrypt");
const { User } = require("../models");
const logger = require("../utils/logger");
const { Op } = require("sequelize");

// Get all staff members with pagination
exports.getAllStaff = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const role = req.query.role;
    const isActive = req.query.isActive;

    logger.info(`Fetching staff members - Page: ${page}, Limit: ${limit}, Search: ${search}`);

    // Build where clause
    const whereClause = {};
    
    if (search) {
      whereClause[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } }
      ];
    }

    if (role) {
      whereClause.role = role;
    }

    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      users: rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: count,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    logger.error("Error fetching staff members:", error);
    res.status(500).json({ error: "Failed to fetch staff members" });
  }
};

// Get single staff member by ID
exports.getStaffById = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Fetching staff member with ID: ${id}`);

    const user = await User.findByPk(id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      logger.info(`Staff member not found with ID: ${id}`);
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    logger.error("Error fetching staff member:", error);
    res.status(500).json({ error: "Failed to fetch staff member" });
  }
};

// Create new staff member
exports.createStaff = async (req, res) => {
  try {
    const { username, password, email, firstName, lastName, role } = req.body;

    logger.info(`Creating new staff member: ${username}`);

    // Validate required fields
    if (!username || !password || !email || !firstName || !lastName) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Validate role
    if (role && !['admin', 'staff', 'user'].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await User.create({
      username,
      password: hashedPassword,
      email,
      firstName,
      lastName,
      role: role || 'staff'
    });

    logger.info(`Staff member created successfully with ID: ${newUser.id}`);

    // Return user without password
    const userResponse = newUser.toJSON();
    delete userResponse.password;

    res.status(201).json({
      message: "Staff member created successfully",
      user: userResponse
    });
  } catch (error) {
    logger.error("Error creating staff member:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ error: "Username or email already exists" });
    }
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({ error: error.errors[0].message });
    }

    res.status(500).json({ error: "Failed to create staff member" });
  }
};

// Update staff member
exports.updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, firstName, lastName, role, isActive, password } = req.body;

    logger.info(`Updating staff member with ID: ${id}`);

    // Find user
    const user = await User.findByPk(id);

    if (!user) {
      logger.info(`Staff member not found with ID: ${id}`);
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent users from modifying their own role or deactivating themselves
    if (req.userId === parseInt(id)) {
      if (role !== undefined && role !== user.role) {
        return res.status(400).json({ error: "You cannot change your own role" });
      }
      if (isActive !== undefined && !isActive) {
        return res.status(400).json({ error: "You cannot deactivate your own account" });
      }
    }

    // Build update object
    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Hash new password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Update user
    await user.update(updateData);

    logger.info(`Staff member updated successfully with ID: ${id}`);

    // Return updated user without password
    const userResponse = user.toJSON();
    delete userResponse.password;

    res.json({
      message: "Staff member updated successfully",
      user: userResponse
    });
  } catch (error) {
    logger.error("Error updating staff member:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ error: "Username or email already exists" });
    }
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({ error: error.errors[0].message });
    }

    res.status(500).json({ error: "Failed to update staff member" });
  }
};

// Delete staff member (soft delete)
exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;

    logger.info(`Deleting staff member with ID: ${id}`);

    // Prevent users from deleting themselves
    if (req.userId === parseInt(id)) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    // Find user
    const user = await User.findByPk(id);

    if (!user) {
      logger.info(`Staff member not found with ID: ${id}`);
      return res.status(404).json({ error: "User not found" });
    }

    // Soft delete by setting isActive to false
    await user.update({ isActive: false });

    logger.info(`Staff member soft deleted successfully with ID: ${id}`);

    res.json({ message: "Staff member deleted successfully" });
  } catch (error) {
    logger.error("Error deleting staff member:", error);
    res.status(500).json({ error: "Failed to delete staff member" });
  }
};