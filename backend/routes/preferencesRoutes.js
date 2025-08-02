const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const preferencesController = require("../controllers/preferencesController");

// All preference routes require authentication
router.use(authenticate);

// Get user's notification preferences
router.get("/", preferencesController.getPreferences);

// Update user's notification preferences
router.put("/", preferencesController.updatePreferences);

// Reset preferences to defaults
router.post("/reset", preferencesController.resetPreferences);

module.exports = router;