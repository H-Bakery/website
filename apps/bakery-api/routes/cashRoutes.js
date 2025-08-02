const express = require("express");
const router = express.Router();
const cashController = require("../controllers/cashController");
const { authenticate } = require("../middleware/authMiddleware");
const { 
  cashEntryCreationRules, 
  cashEntryUpdateRules, 
  cashEntryDeleteRules 
} = require("../validators/cashValidator");
const { handleValidationErrors } = require("../middleware/validationMiddleware");

// Cash routes (all protected)
router.post("/", authenticate, cashEntryCreationRules(), handleValidationErrors, cashController.addCashEntry);
router.get("/", authenticate, cashController.getCashEntries);
router.get("/stats", authenticate, cashController.getCashStats);
router.put("/:id", authenticate, cashEntryUpdateRules(), handleValidationErrors, cashController.updateCashEntry);
router.delete("/:id", authenticate, cashEntryDeleteRules(), handleValidationErrors, cashController.deleteCashEntry);

module.exports = router;
