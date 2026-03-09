const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/authMiddleware')
const { Inventory } = require('../models')
const { Op } = require('sequelize')
const logger = require('../utils/logger')

// Get low stock items (must be before /:id)
router.get('/low-stock', authenticate, async (req, res) => {
  try {
    const items = await Inventory.findAll({
      where: { isActive: true },
    })
    const lowStock = items.filter((i) => i.isLowStock())
    return res.json({ success: true, count: lowStock.length, data: lowStock })
  } catch (error) {
    logger.error('Error retrieving low stock items:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve low stock items',
    })
  }
})

// Get items needing reorder (must be before /:id)
router.get('/needs-reorder', authenticate, async (req, res) => {
  try {
    const items = await Inventory.findAll({
      where: { isActive: true },
    })
    const needsReorder = items.filter((i) => i.needsReorder())
    return res.json({
      success: true,
      count: needsReorder.length,
      data: needsReorder,
    })
  } catch (error) {
    logger.error('Error retrieving items needing reorder:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve reorder items',
    })
  }
})

// Keep old alert paths for backward compatibility
router.get('/alerts/low-stock', authenticate, async (req, res) => {
  try {
    const items = await Inventory.findAll({ where: { isActive: true } })
    const lowStock = items.filter((i) => i.isLowStock())
    return res.json({ success: true, count: lowStock.length, data: lowStock })
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: 'Failed to retrieve low stock items' })
  }
})

router.get('/alerts/reorder', authenticate, async (req, res) => {
  try {
    const items = await Inventory.findAll({ where: { isActive: true } })
    const needsReorder = items.filter((i) => i.needsReorder())
    return res.json({
      success: true,
      count: needsReorder.length,
      data: needsReorder,
    })
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: 'Failed to retrieve reorder items' })
  }
})

// List inventory items with filtering and pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const { category, lowStock, search, page, limit, isActive } = req.query
    const where = {}

    // Active filter
    if (isActive === 'false') {
      where.isActive = false
    } else if (isActive === undefined || isActive === 'true') {
      where.isActive = true
    }

    // Category filter
    if (category) {
      where.category = category
    }

    // Search filter
    if (search) {
      where.name = { [Op.like]: `%${search}%` }
    }

    // Get all matching items
    let items = await Inventory.findAll({ where })

    // Low stock filter (post-query since it's a computed check)
    if (lowStock === 'true') {
      items = items.filter((i) => i.quantity <= i.lowStockThreshold)
    }

    // Pagination (default max 100 items per page)
    const MAX_PAGE_SIZE = 200
    const total = items.length
    const pageNum = parseInt(page) || 1
    const limitNum = Math.min(parseInt(limit) || 100, MAX_PAGE_SIZE)
    const pages = Math.ceil(total / limitNum)
    const offset = (pageNum - 1) * limitNum
    const paginatedItems = items.slice(offset, offset + limitNum)

    const response = { success: true, data: paginatedItems }
    if (page || limit) {
      response.pagination = { total, page: pageNum, limit: limitNum, pages }
    }

    return res.json(response)
  } catch (error) {
    logger.error('Error listing inventory items:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve inventory items',
    })
  }
})

// Bulk stock adjustment (must be before /:id)
router.post('/bulk-adjust', authenticate, async (req, res) => {
  try {
    const { adjustments, reason } = req.body
    const results = { successful: [], failed: [] }

    for (const adj of adjustments) {
      try {
        const item = await Inventory.findByPk(adj.id)
        if (item) {
          await item.adjustStock(adj.change)
          results.successful.push(item)
        } else {
          results.failed.push({ id: adj.id, error: 'Item not found' })
        }
      } catch (err) {
        results.failed.push({ id: adj.id, error: err.message })
      }
    }

    return res.json({ success: true, data: results })
  } catch (error) {
    logger.error('Error in bulk stock adjustment:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to process bulk adjustment',
    })
  }
})

// Create inventory item
router.post('/', authenticate, async (req, res) => {
  try {
    const item = await Inventory.create(req.body)
    return res.status(201).json({
      success: true,
      data: item,
      message: 'Inventory item created successfully',
    })
  } catch (error) {
    logger.error('Error creating inventory item:', error)
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        error: 'Item with this name already exists',
      })
    }
    if (error.name === 'SequelizeValidationError') {
      const msg = error.errors.map((e) => e.message).join(', ')
      return res.status(400).json({ success: false, error: msg })
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to create inventory item',
    })
  }
})

// Get inventory item by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const item = await Inventory.findByPk(req.params.id)
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Inventory item not found',
      })
    }
    return res.json({ success: true, data: item })
  } catch (error) {
    logger.error('Error retrieving inventory item:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve inventory item',
    })
  }
})

// Update inventory item (excludes quantity)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const item = await Inventory.findByPk(req.params.id)
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Inventory item not found',
      })
    }

    const { quantity, ...updateData } = req.body
    await item.update(updateData)
    return res.json({
      success: true,
      data: item,
      message: 'Inventory item updated successfully',
    })
  } catch (error) {
    logger.error('Error updating inventory item:', error)
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        error: 'Item with this name already exists',
      })
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to update inventory item',
    })
  }
})

// Soft delete inventory item
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const item = await Inventory.findByPk(req.params.id)
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Inventory item not found',
      })
    }

    await item.update({ isActive: false })
    return res.json({
      success: true,
      message: 'Inventory item deleted successfully',
    })
  } catch (error) {
    logger.error('Error deleting inventory item:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to delete inventory item',
    })
  }
})

// Adjust stock level
router.patch('/:id/stock', authenticate, async (req, res) => {
  try {
    const { change, reason } = req.body

    if (change === undefined || change === null || typeof change !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Change must be a number',
      })
    }

    const item = await Inventory.findByPk(req.params.id)
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Inventory item not found',
      })
    }

    await item.adjustStock(change)
    const message =
      change > 0
        ? 'Stock increased successfully'
        : 'Stock decreased successfully'
    return res.json({
      success: true,
      data: item,
      message,
    })
  } catch (error) {
    if (error.message && error.message.includes('Insufficient stock')) {
      const availableMatch = error.message.match(/Available: (\d+(?:\.\d+)?)/)
      const requestedMatch = error.message.match(/Requested: (\d+(?:\.\d+)?)/)
      return res.status(400).json({
        success: false,
        error: error.message,
        available: availableMatch ? parseFloat(availableMatch[1]) : undefined,
        requested: requestedMatch ? parseFloat(requestedMatch[1]) : undefined,
      })
    }
    logger.error('Error adjusting stock:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to adjust stock',
    })
  }
})

module.exports = router
