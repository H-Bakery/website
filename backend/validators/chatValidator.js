const { body } = require('express-validator');

/**
 * Validation rules for sending a chat message
 */
const chatMessageRules = () => [
  body('message')
    .trim()
    .notEmpty().withMessage('Message cannot be empty')
    .isLength({ min: 1, max: 1000 }).withMessage('Message must be between 1 and 1000 characters')
    .escape() // Escape HTML to prevent XSS
];

module.exports = {
  chatMessageRules
};