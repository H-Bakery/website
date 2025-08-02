const express = require("express");
const router = express.Router();
const { authenticate, requireAdmin } = require("../middleware/authMiddleware");
const templateController = require("../controllers/templateController");

// Public routes (authenticated users can read templates)
router.use(authenticate);

// Get all templates or by category
router.get("/", templateController.getTemplates);

// Get a single template by key
router.get("/:key", templateController.getTemplate);

// Preview a template with variables
router.post("/:key/preview", templateController.previewTemplate);

// Validate template syntax
router.post("/validate", templateController.validateTemplate);

// Admin-only routes
router.use(requireAdmin);

// Create or update a template
router.post("/", templateController.upsertTemplate);
router.put("/:key", templateController.upsertTemplate);

// Delete a template
router.delete("/:key", templateController.deleteTemplate);

module.exports = router;