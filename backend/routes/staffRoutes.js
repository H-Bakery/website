const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staffController");
const { authenticate, requireAdmin } = require("../middleware/authMiddleware");
const { 
  staffCreationRules, 
  staffUpdateRules, 
  staffDeleteRules 
} = require("../validators/staffValidator");
const { handleValidationErrors } = require("../middleware/validationMiddleware");

// All staff routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Staff management routes
router.get("/", staffController.getAllStaff); // GET /api/staff
router.get("/:id", staffController.getStaffById); // GET /api/staff/:id
router.post("/", staffCreationRules(), handleValidationErrors, staffController.createStaff); // POST /api/staff
router.put("/:id", staffUpdateRules(), handleValidationErrors, staffController.updateStaff); // PUT /api/staff/:id
router.delete("/:id", staffDeleteRules(), handleValidationErrors, staffController.deleteStaff); // DELETE /api/staff/:id

module.exports = router;