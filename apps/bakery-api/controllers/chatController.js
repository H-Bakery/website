const { Chat, User } = require("../models");
const logger = require("../utils/logger");

// Get all chat messages
exports.getChatMessages = async (req, res) => {
  logger.info("Processing chat messages retrieval request...");
  try {
    logger.info("Querying for chat messages with user info...");
    const messages = await Chat.findAll({
      include: [{ model: User, attributes: ["username"] }],
      order: [["timestamp", "ASC"]],
    });

    logger.info(`Retrieved ${messages.length} chat messages`);
    res.json(messages);
  } catch (error) {
    logger.error("Chat retrieval error:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Add a new chat message
exports.addChatMessage = async (req, res) => {
  logger.info("Processing new chat message request...");
  try {
    const { message } = req.body;
    logger.info(
      `Adding message from user ${req.userId}: "${message.substring(0, 20)}${message.length > 20 ? "..." : ""}"`,
    );

    const chatMessage = await Chat.create({
      UserId: req.userId,
      message,
      timestamp: new Date(),
    });

    logger.info(`Chat message created with ID: ${chatMessage.id}`);
    res.json({ message: "Message saved" });
  } catch (error) {
    logger.error("Chat message creation error:", error);
    res.status(500).json({ error: "Database error" });
  }
};
