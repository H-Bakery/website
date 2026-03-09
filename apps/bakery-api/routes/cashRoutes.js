const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/authMiddleware')
const {
  addCashEntry,
  getCashEntries,
} = require('../controllers/cashController')
const logger = require('../utils/logger')

// Validate amount middleware
const validateAmount = (req, res, next) => {
  if (req.body.amount === undefined || req.body.amount === null) {
    return res.status(400).json({ error: 'Invalid amount' })
  }
  next()
}

router.post('/', authenticate, validateAmount, addCashEntry)
router.get('/', authenticate, getCashEntries)

module.exports = router
