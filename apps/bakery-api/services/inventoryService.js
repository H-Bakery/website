const { Inventory } = require('../models')
const { Op } = require('sequelize')
const logger = require('../utils/logger')

const createItem = async (data) => {
  try {
    logger.info('Creating new inventory item', { name: data.name })
    return await Inventory.create(data)
  } catch (error) {
    logger.error('Error creating inventory item:', error)
    throw error
  }
}

const getAllItems = async (filters = {}) => {
  try {
    const where = {}

    if (filters.category) {
      where.category = filters.category
    }

    if (filters.search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${filters.search}%` } },
        { description: { [Op.like]: `%${filters.search}%` } },
        { sku: { [Op.like]: `%${filters.search}%` } },
      ]
    }

    return await Inventory.findAll({
      where,
      order: [['name', 'ASC']],
    })
  } catch (error) {
    logger.error('Error retrieving inventory items:', error)
    throw error
  }
}

const getItemById = async (id) => {
  try {
    const item = await Inventory.findByPk(id)
    if (!item) {
      logger.warn(`Inventory item not found: ${id}`)
    }
    return item
  } catch (error) {
    logger.error(`Error retrieving inventory item ${id}:`, error)
    throw error
  }
}

const updateItemDetails = async (id, data) => {
  try {
    const item = await Inventory.findByPk(id)
    if (!item) {
      logger.warn(`Inventory item not found for update: ${id}`)
      return null
    }

    // Remove quantity from update data
    const { quantity, ...updateData } = data
    await item.update(updateData)
    return item
  } catch (error) {
    logger.error(`Error updating inventory item ${id}:`, error)
    throw error
  }
}

const adjustStockLevel = async (id, change, reason) => {
  try {
    const item = await Inventory.findByPk(id)
    if (!item) {
      logger.warn(`Inventory item not found for stock adjustment: ${id}`)
      return null
    }

    const oldQuantity = item.quantity

    // Check if stock would go negative
    if (change < 0 && !item.adjustStock) {
      const newQuantity = item.quantity + change
      if (newQuantity < 0) {
        const error = new Error(
          `Insufficient stock. Available: ${
            item.quantity
          }, Requested: ${Math.abs(change)}`
        )
        error.code = 'INSUFFICIENT_STOCK'
        error.available = item.quantity
        error.requested = Math.abs(change)
        throw error
      }
    }

    await item.adjustStock(change)
    logger.info(`Stock adjusted for item ${id}`, {
      oldQuantity,
      change,
      reason,
    })
    return item
  } catch (error) {
    if (
      error.message &&
      error.message.includes('Insufficient stock') &&
      !error.code
    ) {
      error.code = 'INSUFFICIENT_STOCK'
      error.available = error.available || 0
      error.requested = Math.abs(change)
    }
    throw error
  }
}

const deleteItem = async (id) => {
  try {
    const item = await Inventory.findByPk(id)
    if (!item) {
      logger.warn(`Inventory item not found for deletion: ${id}`)
      return false
    }

    await item.update({ isActive: false })
    return true
  } catch (error) {
    logger.error(`Error deleting inventory item ${id}:`, error)
    throw error
  }
}

const getItemsNeedingReorder = async () => {
  try {
    return await Inventory.findAll({
      where: {
        isActive: true,
        quantity: {
          [Op.lte]: Inventory.sequelize
            ? Inventory.sequelize.col('reorderLevel')
            : 0,
        },
      },
    })
  } catch (error) {
    logger.error('Error retrieving items needing reorder:', error)
    throw error
  }
}

const getLowStockItems = async () => {
  try {
    return await Inventory.findAll({
      where: {
        isActive: true,
        quantity: {
          [Op.lte]: Inventory.sequelize
            ? Inventory.sequelize.col('lowStockThreshold')
            : 0,
        },
      },
    })
  } catch (error) {
    logger.error('Error retrieving low stock items:', error)
    throw error
  }
}

const bulkAdjustStock = async (adjustments, reason) => {
  const results = { successful: [], failed: [] }

  for (const adj of adjustments) {
    try {
      const item = await module.exports.adjustStockLevel(
        adj.id,
        adj.change,
        reason
      )
      results.successful.push(item)
    } catch (error) {
      results.failed.push({
        id: adj.id,
        error: error.message,
      })
    }
  }

  return results
}

module.exports = {
  createItem,
  getAllItems,
  getItemById,
  updateItemDetails,
  adjustStockLevel,
  deleteItem,
  getItemsNeedingReorder,
  getLowStockItems,
  bulkAdjustStock,
}
