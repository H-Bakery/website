'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.REGEX_PATTERNS =
  exports.SUCCESS_MESSAGES =
  exports.ERROR_MESSAGES =
  exports.CACHE_TTL =
  exports.TOKEN_EXPIRY =
  exports.API_PREFIX =
  exports.API_VERSION =
  exports.FILE_UPLOAD_LIMITS =
  exports.PAGINATION_DEFAULTS =
  exports.TIME_CONSTANTS =
  exports.INVENTORY_STATUS =
  exports.PRODUCTION_STATUS =
  exports.PRIORITY_LEVELS =
  exports.NOTIFICATION_CATEGORIES =
  exports.NOTIFICATION_TYPES =
  exports.PRODUCT_CATEGORIES =
  exports.PAYMENT_STATUS =
  exports.ORDER_STATUS =
  exports.USER_ROLES =
  exports.HTTP_STATUS =
    void 0
// HTTP Status Codes
exports.HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
}
// User Roles
exports.USER_ROLES = {
  ADMIN: 'admin',
  BAKER: 'baker',
  STAFF: 'staff',
  CUSTOMER: 'customer',
}
// Order Status
exports.ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PRODUCTION: 'in_production',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
}
// Payment Status
exports.PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
}
// Product Categories
exports.PRODUCT_CATEGORIES = {
  BREAD: 'bread',
  PASTRIES: 'pastries',
  CAKES: 'cakes',
  COOKIES: 'cookies',
  SEASONAL: 'seasonal',
  SPECIAL: 'special',
}
// Notification Types
exports.NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
}
// Notification Categories
exports.NOTIFICATION_CATEGORIES = {
  STAFF: 'staff',
  ORDER: 'order',
  SYSTEM: 'system',
  INVENTORY: 'inventory',
  GENERAL: 'general',
}
// Priority Levels
exports.PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
}
// Production Status
exports.PRODUCTION_STATUS = {
  PENDING: 'pending',
  READY: 'ready',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
}
// Inventory Status
exports.INVENTORY_STATUS = {
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
  DISCONTINUED: 'discontinued',
}
// Time Constants
exports.TIME_CONSTANTS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
}
// Pagination Defaults
exports.PAGINATION_DEFAULTS = {
  LIMIT: 50,
  MAX_LIMIT: 100,
  OFFSET: 0,
}
// File Upload Limits
exports.FILE_UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
}
// API Versioning
exports.API_VERSION = 'v1'
exports.API_PREFIX = '/api/'.concat(exports.API_VERSION)
// JWT Token Expiry
exports.TOKEN_EXPIRY = {
  ACCESS_TOKEN: '24h',
  REFRESH_TOKEN: '7d',
  RESET_TOKEN: '1h',
}
// Cache TTL
exports.CACHE_TTL = {
  SHORT: 5 * exports.TIME_CONSTANTS.MINUTE,
  MEDIUM: 30 * exports.TIME_CONSTANTS.MINUTE,
  LONG: 2 * exports.TIME_CONSTANTS.HOUR,
  DAY: exports.TIME_CONSTANTS.DAY,
}
// Error Messages
exports.ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation error',
  INTERNAL_ERROR: 'Internal server error',
  DATABASE_ERROR: 'Database operation failed',
  DUPLICATE_ENTRY: 'Duplicate entry exists',
  INVALID_CREDENTIALS: 'Invalid credentials',
  TOKEN_EXPIRED: 'Token has expired',
  TOKEN_INVALID: 'Invalid token',
  INSUFFICIENT_STOCK: 'Insufficient stock available',
  ORDER_CANNOT_BE_MODIFIED: 'Order cannot be modified in current status',
}
// Success Messages
exports.SUCCESS_MESSAGES = {
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  PASSWORD_RESET: 'Password reset successful',
  ORDER_PLACED: 'Order placed successfully',
  PAYMENT_COMPLETED: 'Payment completed successfully',
}
// Regular Expressions
exports.REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/,
  PASSWORD:
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  TIME_24H: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
}
