'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
var express_1 = require('express')
var order_controller_1 = require('../controllers/order.controller')
var core_1 = require('@bakery/api/core')
var order_validator_1 = require('../validators/order.validator')
var core_2 = require('@bakery/api/core')
var router = (0, express_1.Router)()
// Order CRUD routes - all protected with authentication
router.get(
  '/',
  core_1.authenticate,
  order_controller_1.OrderController.getOrders
)
router.get(
  '/:id',
  core_1.authenticate,
  order_controller_1.OrderController.getOrder
)
router.post(
  '/',
  core_1.authenticate,
  (0, order_validator_1.orderCreationRules)(),
  core_2.handleValidationErrors,
  order_controller_1.OrderController.createOrder
)
router.put(
  '/:id',
  core_1.authenticate,
  (0, order_validator_1.orderUpdateRules)(),
  core_2.handleValidationErrors,
  order_controller_1.OrderController.updateOrder
)
router.delete(
  '/:id',
  core_1.authenticate,
  (0, order_validator_1.orderDeleteRules)(),
  core_2.handleValidationErrors,
  order_controller_1.OrderController.deleteOrder
)
exports.default = router
