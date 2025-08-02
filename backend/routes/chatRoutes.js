const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { authenticate } = require("../middleware/authMiddleware");
const { chatMessageRules } = require("../validators/chatValidator");
const { handleValidationErrors } = require("../middleware/validationMiddleware");

// Chat routes (all protected)
router.get("/", authenticate, chatController.getChatMessages);
router.post("/", authenticate, chatMessageRules(), handleValidationErrors, chatController.addChatMessage);

module.exports = router;
