const { Inventory } = require("../models");
const logger = require("../utils/logger");
const { Op } = require("sequelize");
const { createLowInventoryNotification } = require("../utils/notificationHelper");

class InventoryService {
  /**
   * Create a new inventory item
   * @param {Object} itemData - The inventory item data
   * @returns {Promise<Object>} The created inventory item
   */
  async createItem(itemData) {
    try {
      logger.info("Creating new inventory item", { name: itemData.name });
      const item = await Inventory.create(itemData);
      logger.info(`Inventory item created successfully: ${item.id}`);
      return item;
    } catch (error) {
      logger.error("Error creating inventory item:", error);
      throw error;
    }
  }

  /**
   * Get all inventory items with optional filtering
   * @param {Object} filters - Optional filters (category, lowStock, etc.)
   * @returns {Promise<Array>} Array of inventory items
   */
  async getAllItems(filters = {}) {
    try {
      const where = {};
      
      // Apply category filter
      if (filters.category) {
        where.category = filters.category;
      }

      // Apply low stock filter
      if (filters.lowStock === true || filters.lowStock === 'true') {
        where[Op.and] = [
          { quantity: { [Op.lte]: Inventory.sequelize.col('lowStockThreshold') } },
          { isActive: true }
        ];
      } else if (filters.isActive !== undefined) {
        where.isActive = filters.isActive === true || filters.isActive === 'true';
      }

      // Apply search filter
      if (filters.search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${filters.search}%` } },
          { sku: { [Op.like]: `%${filters.search}%` } },
          { description: { [Op.like]: `%${filters.search}%` } }
        ];
      }

      // Apply supplier filter
      if (filters.supplier) {
        where.supplier = { [Op.like]: `%${filters.supplier}%` };
      }

      logger.info("Retrieving inventory items", { filters });
      const items = await Inventory.findAll({
        where,
        order: [['name', 'ASC']]
      });

      logger.info(`Retrieved ${items.length} inventory items`);
      return items;
    } catch (error) {
      logger.error("Error retrieving inventory items:", error);
      throw error;
    }
  }

  /**
   * Get a single inventory item by ID
   * @param {number} id - The inventory item ID
   * @returns {Promise<Object|null>} The inventory item or null if not found
   */
  async getItemById(id) {
    try {
      logger.info(`Retrieving inventory item: ${id}`);
      const item = await Inventory.findByPk(id);
      
      if (!item) {
        logger.warn(`Inventory item not found: ${id}`);
        return null;
      }

      logger.info(`Inventory item retrieved: ${id}`);
      return item;
    } catch (error) {
      logger.error(`Error retrieving inventory item ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update inventory item details (excluding stock quantity)
   * @param {number} id - The inventory item ID
   * @param {Object} updateData - The data to update
   * @returns {Promise<Object|null>} The updated inventory item
   */
  async updateItemDetails(id, updateData) {
    try {
      logger.info(`Updating inventory item: ${id}`, { updateData });
      
      // Remove quantity from update data to prevent direct stock updates
      const { quantity, ...safeUpdateData } = updateData;
      
      const item = await Inventory.findByPk(id);
      if (!item) {
        logger.warn(`Inventory item not found for update: ${id}`);
        return null;
      }

      await item.update(safeUpdateData);
      logger.info(`Inventory item updated successfully: ${id}`);
      return item;
    } catch (error) {
      logger.error(`Error updating inventory item ${id}:`, error);
      throw error;
    }
  }

  /**
   * Adjust stock level (increase or decrease)
   * @param {number} id - The inventory item ID
   * @param {number} change - The quantity change (positive or negative)
   * @param {string} reason - Optional reason for the adjustment
   * @returns {Promise<Object|null>} The updated inventory item
   */
  async adjustStockLevel(id, change, reason = null) {
    try {
      logger.info(`Adjusting stock for item ${id}`, { change, reason });
      
      const item = await Inventory.findByPk(id);
      if (!item) {
        logger.warn(`Inventory item not found for stock adjustment: ${id}`);
        return null;
      }

      const oldQuantity = item.quantity;
      const newQuantity = oldQuantity + change;

      // Check if the adjustment would result in negative stock
      if (newQuantity < 0) {
        const error = new Error(`Insufficient stock. Available: ${oldQuantity}, Requested change: ${change}`);
        error.code = 'INSUFFICIENT_STOCK';
        error.available = oldQuantity;
        error.requested = Math.abs(change);
        throw error;
      }

      // Use the model's instance method for stock adjustment
      await item.adjustStock(change);
      
      logger.info(`Stock adjusted for item ${id}`, {
        oldQuantity,
        newQuantity: item.quantity,
        change,
        reason
      });

      // Check if stock is now below the low stock threshold
      if (item.lowStockThreshold && item.quantity <= item.lowStockThreshold) {
        // Create notification for low stock
        await createLowInventoryNotification(
          item.name,
          item.quantity,
          item.lowStockThreshold
        );
      }

      return item;
    } catch (error) {
      if (error.code === 'INSUFFICIENT_STOCK') {
        logger.warn(`Insufficient stock for item ${id}:`, error.message);
      } else {
        logger.error(`Error adjusting stock for item ${id}:`, error);
      }
      throw error;
    }
  }

  /**
   * Delete an inventory item (soft delete by setting isActive to false)
   * @param {number} id - The inventory item ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteItem(id) {
    try {
      logger.info(`Soft deleting inventory item: ${id}`);
      
      const item = await Inventory.findByPk(id);
      if (!item) {
        logger.warn(`Inventory item not found for deletion: ${id}`);
        return false;
      }

      await item.update({ isActive: false });
      logger.info(`Inventory item soft deleted: ${id}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting inventory item ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get items that need reordering
   * @returns {Promise<Array>} Array of items below reorder level
   */
  async getItemsNeedingReorder() {
    try {
      logger.info("Retrieving items needing reorder");
      
      const items = await Inventory.findAll({
        where: {
          isActive: true,
          quantity: { [Op.lte]: Inventory.sequelize.col('reorderLevel') },
          reorderLevel: { [Op.gt]: 0 }
        },
        order: [['quantity', 'ASC']]
      });

      logger.info(`Found ${items.length} items needing reorder`);
      return items;
    } catch (error) {
      logger.error("Error retrieving items needing reorder:", error);
      throw error;
    }
  }

  /**
   * Get low stock items
   * @returns {Promise<Array>} Array of items below low stock threshold
   */
  async getLowStockItems() {
    try {
      logger.info("Retrieving low stock items");
      
      const items = await Inventory.findAll({
        where: {
          isActive: true,
          quantity: { [Op.lte]: Inventory.sequelize.col('lowStockThreshold') },
          lowStockThreshold: { [Op.gt]: 0 }
        },
        order: [['quantity', 'ASC']]
      });

      logger.info(`Found ${items.length} low stock items`);
      return items;
    } catch (error) {
      logger.error("Error retrieving low stock items:", error);
      throw error;
    }
  }

  /**
   * Bulk adjust stock levels (for production use)
   * @param {Array} adjustments - Array of {id, change} objects
   * @param {string} reason - Reason for bulk adjustment
   * @returns {Promise<Object>} Summary of adjustments
   */
  async bulkAdjustStock(adjustments, reason = 'Bulk adjustment') {
    const results = {
      successful: [],
      failed: []
    };

    try {
      logger.info(`Starting bulk stock adjustment for ${adjustments.length} items`, { reason });
      
      for (const adjustment of adjustments) {
        try {
          const item = await this.adjustStockLevel(adjustment.id, adjustment.change, reason);
          results.successful.push({
            id: adjustment.id,
            name: item.name,
            oldQuantity: item.quantity - adjustment.change,
            newQuantity: item.quantity,
            change: adjustment.change
          });
        } catch (error) {
          results.failed.push({
            id: adjustment.id,
            change: adjustment.change,
            error: error.message
          });
        }
      }

      logger.info("Bulk stock adjustment completed", {
        total: adjustments.length,
        successful: results.successful.length,
        failed: results.failed.length
      });

      return results;
    } catch (error) {
      logger.error("Error in bulk stock adjustment:", error);
      throw error;
    }
  }
}

module.exports = new InventoryService();