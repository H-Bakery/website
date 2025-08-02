const { Cash, User } = require("../models");
const logger = require("../utils/logger");

/**
 * Cash Controller
 * Handles CRUD operations for cash entries with proper validation and authorization
 */

// Constants for validation
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ERROR_MESSAGES = {
  INVALID_USER: "Invalid user",
  INVALID_AMOUNT: "Invalid amount", 
  INVALID_DATE_FORMAT: "Invalid date format. Use YYYY-MM-DD",
  CASH_ENTRY_NOT_FOUND: "Cash entry not found",
  INVALID_USER_REFERENCE: "Invalid user reference",
  DATABASE_ERROR: "Database error"
};

/**
 * Validation helpers
 */
const validators = {
  /**
   * Validates if user exists in database
   * @param {number} userId - User ID to validate
   * @returns {Promise<Object|null>} User object if exists, null otherwise
   */
  async validateUser(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      logger.error(`User with ID ${userId} not found`);
      return null;
    }
    return user;
  },

  /**
   * Validates amount value
   * @param {*} amount - Amount to validate
   * @returns {boolean} True if valid, false otherwise
   */
  validateAmount(amount) {
    return typeof amount === 'number' && amount >= 0;
  },

  /**
   * Validates date format (YYYY-MM-DD)
   * @param {string} date - Date string to validate
   * @returns {boolean} True if valid format, false otherwise
   */
  validateDateFormat(date) {
    return DATE_REGEX.test(date);
  },

  /**
   * Finds cash entry owned by user
   * @param {number} entryId - Cash entry ID
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Cash entry if found and owned by user
   */
  async findUserCashEntry(entryId, userId) {
    return await Cash.findOne({
      where: { id: entryId, UserId: userId }
    });
  }
};

/**
 * Error response helpers
 */
const errorResponses = {
  badRequest(res, message) {
    return res.status(400).json({ error: message });
  },

  notFound(res, message) {
    return res.status(404).json({ error: message });
  },

  internalError(res, message) {
    return res.status(500).json({ error: message });
  }
};

/**
 * Add cash entry
 * @route POST /cash
 * @access Private (authenticated users only)
 */
exports.addCashEntry = async (req, res) => {
  logger.info("Processing cash entry request...");
  
  try {
    const { amount } = req.body;
    const date = new Date().toISOString().split("T")[0];
    
    logger.info(`Adding cash entry: ${amount} for user ${req.userId} on ${date}`);

    // Validate user exists
    const user = await validators.validateUser(req.userId);
    if (!user) {
      return errorResponses.badRequest(res, ERROR_MESSAGES.INVALID_USER);
    }

    // Validate amount
    if (!validators.validateAmount(amount)) {
      logger.error(`Invalid amount provided: ${amount}`);
      return errorResponses.badRequest(res, ERROR_MESSAGES.INVALID_AMOUNT);
    }

    // Create cash entry
    const cashEntry = await Cash.create({
      UserId: req.userId,
      amount,
      date,
    });

    logger.info(`Cash entry created with ID: ${cashEntry.id}`);
    res.json({ 
      message: "Cash entry saved",
      entry: {
        id: cashEntry.id,
        amount: cashEntry.amount,
        date: cashEntry.date,
        createdAt: cashEntry.createdAt
      }
    });

  } catch (error) {
    logger.error("Cash entry creation error:", error);
    
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return errorResponses.badRequest(res, ERROR_MESSAGES.INVALID_USER_REFERENCE);
    }
    
    return errorResponses.internalError(res, ERROR_MESSAGES.DATABASE_ERROR);
  }
};

/**
 * Get cash entries for authenticated user
 * @route GET /cash
 * @access Private (authenticated users only)
 */
exports.getCashEntries = async (req, res) => {
  logger.info(`Processing get cash entries request for user ${req.userId}`);
  
  try {
    const entries = await Cash.findAll({
      where: { UserId: req.userId },
      order: [["date", "DESC"], ["createdAt", "DESC"]],
      attributes: ['id', 'amount', 'date', 'createdAt', 'updatedAt']
    });

    logger.info(`Retrieved ${entries.length} cash entries for user ${req.userId}`);
    res.json(entries);

  } catch (error) {
    logger.error("Error retrieving cash entries:", error);
    return errorResponses.internalError(res, ERROR_MESSAGES.DATABASE_ERROR);
  }
};

/**
 * Update cash entry
 * @route PUT /cash/:id
 * @access Private (authenticated users only, own entries only)
 */
exports.updateCashEntry = async (req, res) => {
  logger.info("Processing update cash entry request...");
  
  try {
    const { id } = req.params;
    const { amount, date } = req.body;
    
    logger.info(`Updating cash entry ${id} for user ${req.userId}`);

    // Find and validate ownership
    const cashEntry = await validators.findUserCashEntry(id, req.userId);
    if (!cashEntry) {
      logger.error(`Cash entry ${id} not found for user ${req.userId}`);
      return errorResponses.notFound(res, ERROR_MESSAGES.CASH_ENTRY_NOT_FOUND);
    }

    // Validate amount if provided
    if (amount !== undefined && !validators.validateAmount(amount)) {
      logger.error(`Invalid amount provided: ${amount}`);
      return errorResponses.badRequest(res, ERROR_MESSAGES.INVALID_AMOUNT);
    }

    // Validate date if provided
    if (date !== undefined && !validators.validateDateFormat(date)) {
      logger.error(`Invalid date format provided: ${date}`);
      return errorResponses.badRequest(res, ERROR_MESSAGES.INVALID_DATE_FORMAT);
    }

    // Build update data
    const updateData = {};
    if (amount !== undefined) updateData.amount = amount;
    if (date !== undefined) updateData.date = date;

    // Perform update
    await cashEntry.update(updateData);

    logger.info(`Cash entry ${id} updated successfully`);
    res.json({ 
      message: "Cash entry updated", 
      entry: {
        id: cashEntry.id,
        amount: cashEntry.amount,
        date: cashEntry.date,
        updatedAt: cashEntry.updatedAt
      }
    });

  } catch (error) {
    logger.error("Cash entry update error:", error);
    return errorResponses.internalError(res, ERROR_MESSAGES.DATABASE_ERROR);
  }
};

/**
 * Delete cash entry
 * @route DELETE /cash/:id
 * @access Private (authenticated users only, own entries only)
 */
exports.deleteCashEntry = async (req, res) => {
  logger.info("Processing delete cash entry request...");
  
  try {
    const { id } = req.params;
    
    logger.info(`Deleting cash entry ${id} for user ${req.userId}`);

    // Find and validate ownership
    const cashEntry = await validators.findUserCashEntry(id, req.userId);
    if (!cashEntry) {
      logger.error(`Cash entry ${id} not found for user ${req.userId}`);
      return errorResponses.notFound(res, ERROR_MESSAGES.CASH_ENTRY_NOT_FOUND);
    }

    // Store entry data for response
    const deletedEntry = {
      id: cashEntry.id,
      amount: cashEntry.amount,
      date: cashEntry.date
    };

    // Delete the entry
    await cashEntry.destroy();

    logger.info(`Cash entry ${id} deleted successfully`);
    res.json({ 
      message: "Cash entry deleted",
      deletedEntry
    });

  } catch (error) {
    logger.error("Cash entry deletion error:", error);
    return errorResponses.internalError(res, ERROR_MESSAGES.DATABASE_ERROR);
  }
};

/**
 * Get cash statistics for authenticated user
 * @route GET /cash/stats
 * @access Private (authenticated users only)
 */
exports.getCashStats = async (req, res) => {
  logger.info(`Processing cash statistics request for user ${req.userId}`);
  
  try {
    const { startDate, endDate } = req.query;
    
    // Build where clause
    const whereClause = { UserId: req.userId };
    if (startDate && endDate) {
      whereClause.date = {
        [require('sequelize').Op.between]: [startDate, endDate]
      };
    }

    const entries = await Cash.findAll({
      where: whereClause,
      attributes: ['amount', 'date'],
      order: [['date', 'ASC']]
    });

    // Calculate statistics
    const totalAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);
    const averageAmount = entries.length > 0 ? totalAmount / entries.length : 0;
    const entryCount = entries.length;
    
    // Get latest entry
    const latestEntry = entries.length > 0 ? entries[entries.length - 1] : null;

    const stats = {
      totalAmount,
      averageAmount: Math.round(averageAmount * 100) / 100, // Round to 2 decimal places
      entryCount,
      latestEntry: latestEntry ? {
        amount: latestEntry.amount,
        date: latestEntry.date
      } : null,
      dateRange: {
        startDate: startDate || (entries.length > 0 ? entries[0].date : null),
        endDate: endDate || (entries.length > 0 ? entries[entries.length - 1].date : null)
      }
    };

    logger.info(`Calculated stats for user ${req.userId}: ${entryCount} entries, total: ${totalAmount}`);
    res.json(stats);

  } catch (error) {
    logger.error("Error calculating cash statistics:", error);
    return errorResponses.internalError(res, ERROR_MESSAGES.DATABASE_ERROR);
  }
};