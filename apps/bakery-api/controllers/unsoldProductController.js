const { UnsoldProduct, Product, User, sequelize } = require('../models')
const logger = require('../utils/logger')

const addUnsoldProduct = async (req, res) => {
  try {
    const { productId, quantity } = req.body

    if (!productId || quantity < 0) {
      return res
        .status(400)
        .json({ error: 'Product ID and non-negative quantity are required' })
    }

    const product = await Product.findByPk(productId)
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const today = new Date().toISOString().split('T')[0]

    await UnsoldProduct.create({
      ProductId: productId,
      quantity,
      UserId: req.user.id,
      date: today,
    })

    return res.json({ message: 'Unsold product entry saved' })
  } catch (error) {
    logger.error('Add unsold product error:', error)
    return res.status(500).json({ error: 'Database error' })
  }
}

const getUnsoldProducts = async (req, res) => {
  try {
    const unsoldProducts = await UnsoldProduct.findAll({
      include: [
        {
          model: Product,
          attributes: ['name', 'category'],
        },
        {
          model: User,
          attributes: ['username'],
        },
      ],
      order: [
        ['date', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    })

    return res.json(unsoldProducts)
  } catch (error) {
    logger.error('Get unsold products error:', error)
    return res.status(500).json({ error: 'Database error' })
  }
}

const getUnsoldProductsSummary = async (req, res) => {
  try {
    const summary = await UnsoldProduct.findAll({
      attributes: [
        'ProductId',
        [sequelize.fn('SUM', sequelize.col('quantity')), 'totalUnsold'],
      ],
      include: [
        {
          model: Product,
          attributes: ['name', 'category'],
        },
      ],
      group: ['ProductId', 'Product.id'],
      order: [[sequelize.fn('SUM', sequelize.col('quantity')), 'DESC']],
    })

    return res.json(summary)
  } catch (error) {
    logger.error('Get unsold products summary error:', error)
    return res.status(500).json({ error: 'Database error' })
  }
}

module.exports = {
  addUnsoldProduct,
  getUnsoldProducts,
  getUnsoldProductsSummary,
}
