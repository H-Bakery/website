const { body, param } = require('express-validator');

/**
 * Validation rules for creating an order
 */
const orderCreationRules = () => [
  body('customerName')
    .trim()
    .notEmpty().withMessage('Customer name is required')
    .isLength({ min: 1, max: 100 }).withMessage('Customer name must be between 1 and 100 characters'),
  
  body('customerPhone')
    .trim()
    .notEmpty().withMessage('Customer phone is required')
    .matches(/^[\d\s\-\+\(\)]+$/).withMessage('Invalid phone number format')
    .isLength({ min: 7, max: 20 }).withMessage('Phone number must be between 7 and 20 characters'),
  
  body('customerEmail')
    .optional({ nullable: true })
    .trim()
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('pickupDate')
    .notEmpty().withMessage('Pickup date is required')
    .isISO8601().withMessage('Invalid date format')
    .custom((value) => {
      const pickupDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (pickupDate < today) {
        throw new Error('Pickup date cannot be in the past');
      }
      return true;
    }),
  
  body('status')
    .optional()
    .trim()
    .isIn(['pending', 'confirmed', 'in_progress', 'ready', 'completed', 'cancelled'])
    .withMessage('Invalid order status'),
  
  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 }).withMessage('Notes must not exceed 1000 characters'),
  
  body('items')
    .isArray({ min: 1 }).withMessage('Order must contain at least one item'),
  
  body('items.*.productId')
    .isInt({ min: 1 }).withMessage('Each item must have a valid product ID'),
  
  body('items.*.productName')
    .trim()
    .notEmpty().withMessage('Each item must have a product name'),
  
  body('items.*.quantity')
    .isInt({ min: 1 }).withMessage('Each item quantity must be at least 1'),
  
  body('items.*.unitPrice')
    .isFloat({ min: 0 }).withMessage('Each item must have a valid unit price')
    .toFloat(),
  
  body('totalPrice')
    .notEmpty().withMessage('Total price is required')
    .isFloat({ min: 0 }).withMessage('Total price must be a non-negative number')
    .toFloat()
];

/**
 * Validation rules for updating an order
 */
const orderUpdateRules = () => [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid order ID'),
  
  body('customerName')
    .optional()
    .trim()
    .notEmpty().withMessage('Customer name cannot be empty if provided')
    .isLength({ min: 1, max: 100 }).withMessage('Customer name must be between 1 and 100 characters'),
  
  body('customerPhone')
    .optional()
    .trim()
    .matches(/^[\d\s\-\+\(\)]+$/).withMessage('Invalid phone number format')
    .isLength({ min: 7, max: 20 }).withMessage('Phone number must be between 7 and 20 characters'),
  
  body('customerEmail')
    .optional({ nullable: true })
    .trim()
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('pickupDate')
    .optional()
    .isISO8601().withMessage('Invalid date format')
    .custom((value) => {
      const pickupDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (pickupDate < today) {
        throw new Error('Pickup date cannot be in the past');
      }
      return true;
    }),
  
  body('status')
    .optional()
    .trim()
    .isIn(['pending', 'confirmed', 'in_progress', 'ready', 'completed', 'cancelled'])
    .withMessage('Invalid order status'),
  
  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 }).withMessage('Notes must not exceed 1000 characters'),
  
  body('items')
    .optional()
    .isArray({ min: 1 }).withMessage('Order must contain at least one item if updating items'),
  
  body('items.*.productId')
    .optional()
    .isInt({ min: 1 }).withMessage('Each item must have a valid product ID'),
  
  body('items.*.productName')
    .optional()
    .trim()
    .notEmpty().withMessage('Each item must have a product name'),
  
  body('items.*.quantity')
    .optional()
    .isInt({ min: 1 }).withMessage('Each item quantity must be at least 1'),
  
  body('items.*.unitPrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Each item must have a valid unit price')
    .toFloat(),
  
  body('totalPrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Total price must be a non-negative number')
    .toFloat()
];

/**
 * Validation rules for deleting an order
 */
const orderDeleteRules = () => [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid order ID')
];

module.exports = {
  orderCreationRules,
  orderUpdateRules,
  orderDeleteRules
};