const models = require('../models')
const logger = require('../utils/logger')

const getProducts = async (req, res) => {
  try {
    const products = await models.Product.findAll({
      where: { isActive: true },
      attributes: [
        'id',
        'name',
        'price',
        'stock',
        'description',
        'image',
        'category',
      ],
    })
    logger.info(`Retrieved ${products.length} products`)
    return res.json(products)
  } catch (error) {
    logger.error('Product retrieval error:', error)
    return res.status(500).json({ error: 'Database error' })
  }
}

const getProduct = async (req, res) => {
  try {
    const product = await models.Product.findByPk(req.params.id, {
      attributes: [
        'id',
        'name',
        'price',
        'stock',
        'description',
        'image',
        'category',
        'dailyTarget',
        'isActive',
      ],
    })
    if (!product) {
      logger.warn(`Product not found: ${req.params.id}`)
      return res.status(404).json({ message: 'Product not found' })
    }
    logger.info(`Product ${req.params.id} retrieved successfully`)
    return res.json(product)
  } catch (error) {
    logger.error(`Error retrieving product ${req.params.id}:`, error)
    return res.status(500).json({ error: 'Database error' })
  }
}

module.exports = { getProducts, getProduct }
