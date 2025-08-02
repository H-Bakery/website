const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { authenticate } = require("../middleware/authMiddleware");
const { 
  orderCreationRules, 
  orderUpdateRules, 
  orderDeleteRules 
} = require("../validators/orderValidator");
const { handleValidationErrors } = require("../middleware/validationMiddleware");

// Order CRUD routes - all protected with authentication
router.get("/", authenticate, orderController.getOrders);
router.get("/:id", authenticate, orderController.getOrder);
router.post("/", authenticate, orderCreationRules(), handleValidationErrors, orderController.createOrder);
router.put("/:id", authenticate, orderUpdateRules(), handleValidationErrors, orderController.updateOrder);
router.delete("/:id", authenticate, orderDeleteRules(), handleValidationErrors, orderController.deleteOrder);

module.exports = router;
