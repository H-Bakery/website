const { Cash, User } = require('../models')
const logger = require('../utils/logger')

const addCashEntry = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId)
    const today = new Date().toISOString().split('T')[0]

    await Cash.create({
      UserId: req.userId,
      amount: req.body.amount,
      date: today,
    })

    return res.json({ message: 'Cash entry saved' })
  } catch (error) {
    logger.error('Cash entry error:', error)
    return res.status(500).json({ error: 'Database error' })
  }
}

const getCashEntries = async (req, res) => {
  try {
    const entries = await Cash.findAll({
      where: { UserId: req.userId },
      order: [['date', 'DESC']],
    })

    return res.json(entries)
  } catch (error) {
    logger.error('Get cash entries error:', error)
    return res.status(500).json({ error: 'Database error' })
  }
}

const updateCashEntry = async (req, res) => {
  try {
    const entry = await Cash.findOne({
      where: { id: req.params.id, UserId: req.userId },
    })

    if (!entry) {
      return res.status(404).json({ error: 'Cash entry not found' })
    }

    const { amount, date } = req.body

    if (amount !== undefined && amount < 0) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ error: 'Invalid date format. Use YYYY-MM-DD' })
    }

    const updateData = {}
    if (amount !== undefined) updateData.amount = amount
    if (date !== undefined) updateData.date = date

    await entry.update(updateData)

    return res.json({ message: 'Cash entry updated', entry })
  } catch (error) {
    logger.error('Update cash entry error:', error)
    return res.status(500).json({ error: 'Database error' })
  }
}

const deleteCashEntry = async (req, res) => {
  try {
    const entry = await Cash.findOne({
      where: { id: req.params.id, UserId: req.userId },
    })

    if (!entry) {
      return res.status(404).json({ error: 'Cash entry not found' })
    }

    await entry.destroy()

    return res.json({ message: 'Cash entry deleted' })
  } catch (error) {
    logger.error('Delete cash entry error:', error)
    return res.status(500).json({ error: 'Database error' })
  }
}

module.exports = {
  addCashEntry,
  getCashEntries,
  updateCashEntry,
  deleteCashEntry,
}
