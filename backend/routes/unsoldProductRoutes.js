const express = require("express");
const router = express.Router();
const unsoldProductController = require("../controllers/unsoldProductController");
const { authenticate } = require("../middleware/authMiddleware");
const { unsoldProductRules } = require("../validators/unsoldProductValidator");
const { handleValidationErrors } = require("../middleware/validationMiddleware");

// All routes require authentication
router.use(authenticate);

// Unsold product routes
router.post("/", unsoldProductRules(), handleValidationErrors, unsoldProductController.addUnsoldProduct);
router.get("/", unsoldProductController.getUnsoldProducts);
router.get("/summary", unsoldProductController.getUnsoldProductsSummary);

module.exports = router;