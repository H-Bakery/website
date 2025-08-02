const express = require("express");
const router = express.Router();
const emailService = require("../services/emailService");
const { requireAdmin } = require("../middleware/authMiddleware");
const logger = require("../utils/logger");

// Test email configuration
router.get("/test", requireAdmin, async (req, res) => {
  try {
    const isConnected = await emailService.verifyConnection();
    res.json({
      configured: emailService.isConfigured,
      connected: isConnected,
      provider: emailService.config.provider,
      from: emailService.config.from,
    });
  } catch (error) {
    logger.error("Email test error:", error);
    res.status(500).json({ error: "Failed to test email configuration" });
  }
});

// Send test email
router.post("/test", requireAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email address is required" });
    }

    const testNotification = {
      id: "test",
      title: "Test Email Notification",
      message: "This is a test email from your bakery notification system. If you received this, email notifications are working correctly!",
      category: "system",
      priority: "low",
      type: "info",
    };

    const result = await emailService.sendNotificationEmail(
      testNotification,
      email,
      "en"
    );

    res.json(result);
  } catch (error) {
    logger.error("Test email send error:", error);
    res.status(500).json({ error: "Failed to send test email" });
  }
});

// Get email statistics (placeholder for future implementation)
router.get("/stats", requireAdmin, async (req, res) => {
  try {
    // TODO: Implement email statistics tracking
    res.json({
      sent: 0,
      failed: 0,
      pending: 0,
      lastSent: null,
    });
  } catch (error) {
    logger.error("Email stats error:", error);
    res.status(500).json({ error: "Failed to retrieve email statistics" });
  }
});

module.exports = router;