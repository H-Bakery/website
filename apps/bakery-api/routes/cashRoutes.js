const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/authMiddleware')
const {
  addCashEntry,
  getCashEntries,
  updateCashEntry,
  deleteCashEntry,
} = require('../controllers/cashController')

// Validate amount middleware
const validateAmount = (req, res, next) => {
  if (req.body.amount === undefined || req.body.amount === null) {
    return res.status(400).json({ error: 'Invalid amount' })
  }
  next()
}

router.post('/', authenticate, validateAmount, addCashEntry)
router.get('/', authenticate, getCashEntries)
router.put('/:id', authenticate, updateCashEntry)
router.delete('/:id', authenticate, deleteCashEntry)

module.exports = router
