const inventoryService = require("../services/inventoryService");
const logger = require("../utils/logger");

// Create new inventory item
exports.createInventoryItem = async (req, res) => {
  try {
    logger.info("Creating new inventory item", { body: req.body });
    
    const item = await inventoryService.createItem(req.body);
    
    res.status(201).json({
      success: true,
      data: item,
      message: "Inventory item created successfully"
    });
  } catch (error) {
    logger.error("Error creating inventory item:", error);
    
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        error: "An item with this name or SKU already exists"
      });
    }
    
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        error: error.errors.map(e => e.message).join(", ")
      });
    }
    
    res.status(500).json({
      success: false,
      error: "Failed to create inventory item"
    });
  }
};

// Get all inventory items
exports.getInventoryItems = async (req, res) => {
  try {
    logger.info("Retrieving inventory items", { query: req.query });
    
    const filters = {
      category: req.query.category,
      lowStock: req.query.lowStock,
      search: req.query.search,
      supplier: req.query.supplier,
      isActive: req.query.isActive !== undefined ? req.query.isActive : true
    };
    
    const items = await inventoryService.getAllItems(filters);
    
    // Add pagination info if requested
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || items.length;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    const paginatedItems = limit < items.length ? items.slice(startIndex, endIndex) : items;
    
    res.json({
      success: true,
      data: paginatedItems,
      pagination: {
        total: items.length,
        page,
        limit,
        pages: Math.ceil(items.length / limit)
      }
    });
  } catch (error) {
    logger.error("Error retrieving inventory items:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve inventory items"
    });
  }
};

// Get single inventory item
exports.getInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Retrieving inventory item: ${id}`);
    
    const item = await inventoryService.getItemById(id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: "Inventory item not found"
      });
    }
    
    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    logger.error(`Error retrieving inventory item ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve inventory item"
    });
  }
};

// Update inventory item (non-stock details)
exports.updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Updating inventory item: ${id}`, { body: req.body });
    
    const item = await inventoryService.updateItemDetails(id, req.body);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: "Inventory item not found"
      });
    }
    
    res.json({
      success: true,
      data: item,
      message: "Inventory item updated successfully"
    });
  } catch (error) {
    logger.error(`Error updating inventory item ${req.params.id}:`, error);
    
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        error: "An item with this name or SKU already exists"
      });
    }
    
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        error: error.errors.map(e => e.message).join(", ")
      });
    }
    
    res.status(500).json({
      success: false,
      error: "Failed to update inventory item"
    });
  }
};

// Adjust stock level
exports.adjustStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { change, reason } = req.body;
    
    logger.info(`Adjusting stock for item: ${id}`, { change, reason });
    
    if (typeof change !== "number") {
      return res.status(400).json({
        success: false,
        error: "Change must be a number"
      });
    }
    
    const item = await inventoryService.adjustStockLevel(id, change, reason);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: "Inventory item not found"
      });
    }
    
    res.json({
      success: true,
      data: item,
      message: `Stock ${change > 0 ? 'increased' : 'decreased'} successfully`
    });
  } catch (error) {
    logger.error(`Error adjusting stock for item ${req.params.id}:`, error);
    
    if (error.code === "INSUFFICIENT_STOCK") {
      return res.status(400).json({
        success: false,
        error: error.message,
        available: error.available,
        requested: error.requested
      });
    }
    
    res.status(500).json({
      success: false,
      error: "Failed to adjust stock level"
    });
  }
};

// Delete inventory item
exports.deleteInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Deleting inventory item: ${id}`);
    
    const deleted = await inventoryService.deleteItem(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Inventory item not found"
      });
    }
    
    res.json({
      success: true,
      message: "Inventory item deleted successfully"
    });
  } catch (error) {
    logger.error(`Error deleting inventory item ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to delete inventory item"
    });
  }
};

// Get items needing reorder
exports.getItemsNeedingReorder = async (req, res) => {
  try {
    logger.info("Retrieving items needing reorder");
    
    const items = await inventoryService.getItemsNeedingReorder();
    
    res.json({
      success: true,
      data: items,
      count: items.length
    });
  } catch (error) {
    logger.error("Error retrieving items needing reorder:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve items needing reorder"
    });
  }
};

// Get low stock items
exports.getLowStockItems = async (req, res) => {
  try {
    logger.info("Retrieving low stock items");
    
    const items = await inventoryService.getLowStockItems();
    
    res.json({
      success: true,
      data: items,
      count: items.length
    });
  } catch (error) {
    logger.error("Error retrieving low stock items:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve low stock items"
    });
  }
};

// Bulk adjust stock
exports.bulkAdjustStock = async (req, res) => {
  try {
    const { adjustments, reason } = req.body;
    
    logger.info("Processing bulk stock adjustment", { 
      count: adjustments?.length,
      reason 
    });
    
    if (!Array.isArray(adjustments) || adjustments.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Adjustments must be a non-empty array"
      });
    }
    
    // Validate all adjustments have required fields
    const invalid = adjustments.find(adj => 
      typeof adj.id !== "number" || typeof adj.change !== "number"
    );
    
    if (invalid) {
      return res.status(400).json({
        success: false,
        error: "Each adjustment must have id and change as numbers"
      });
    }
    
    const results = await inventoryService.bulkAdjustStock(adjustments, reason);
    
    res.json({
      success: true,
      data: results,
      message: `Bulk adjustment completed: ${results.successful.length} successful, ${results.failed.length} failed`
    });
  } catch (error) {
    logger.error("Error in bulk stock adjustment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process bulk stock adjustment"
    });
  }
};