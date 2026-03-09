const express = require('express')
const router = express.Router()
const { register, login } = require('../controllers/authController')
const {
  userRegistrationRules,
  loginRules,
} = require('../validators/authValidator')
const { handleValidationErrors } = require('../middleware/validationMiddleware')

router.post(
  '/register',
  userRegistrationRules(),
  handleValidationErrors,
  register
)
router.post('/login', loginRules(), handleValidationErrors, login)

module.exports = router
