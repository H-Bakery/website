export declare const HTTP_STATUS: {
  readonly OK: 200
  readonly CREATED: 201
  readonly NO_CONTENT: 204
  readonly BAD_REQUEST: 400
  readonly UNAUTHORIZED: 401
  readonly FORBIDDEN: 403
  readonly NOT_FOUND: 404
  readonly CONFLICT: 409
  readonly UNPROCESSABLE_ENTITY: 422
  readonly INTERNAL_SERVER_ERROR: 500
  readonly SERVICE_UNAVAILABLE: 503
}
export declare const USER_ROLES: {
  readonly ADMIN: 'admin'
  readonly BAKER: 'baker'
  readonly STAFF: 'staff'
  readonly CUSTOMER: 'customer'
}
export declare const ORDER_STATUS: {
  readonly PENDING: 'pending'
  readonly CONFIRMED: 'confirmed'
  readonly IN_PRODUCTION: 'in_production'
  readonly READY: 'ready'
  readonly COMPLETED: 'completed'
  readonly CANCELLED: 'cancelled'
  readonly REFUNDED: 'refunded'
}
export declare const PAYMENT_STATUS: {
  readonly PENDING: 'pending'
  readonly PROCESSING: 'processing'
  readonly COMPLETED: 'completed'
  readonly FAILED: 'failed'
  readonly REFUNDED: 'refunded'
}
export declare const PRODUCT_CATEGORIES: {
  readonly BREAD: 'bread'
  readonly PASTRIES: 'pastries'
  readonly CAKES: 'cakes'
  readonly COOKIES: 'cookies'
  readonly SEASONAL: 'seasonal'
  readonly SPECIAL: 'special'
}
export declare const NOTIFICATION_TYPES: {
  readonly INFO: 'info'
  readonly SUCCESS: 'success'
  readonly WARNING: 'warning'
  readonly ERROR: 'error'
}
export declare const NOTIFICATION_CATEGORIES: {
  readonly STAFF: 'staff'
  readonly ORDER: 'order'
  readonly SYSTEM: 'system'
  readonly INVENTORY: 'inventory'
  readonly GENERAL: 'general'
}
export declare const PRIORITY_LEVELS: {
  readonly LOW: 'low'
  readonly MEDIUM: 'medium'
  readonly HIGH: 'high'
  readonly URGENT: 'urgent'
}
export declare const PRODUCTION_STATUS: {
  readonly PENDING: 'pending'
  readonly READY: 'ready'
  readonly IN_PROGRESS: 'in_progress'
  readonly PAUSED: 'paused'
  readonly COMPLETED: 'completed'
  readonly CANCELLED: 'cancelled'
  readonly FAILED: 'failed'
}
export declare const INVENTORY_STATUS: {
  readonly IN_STOCK: 'in_stock'
  readonly LOW_STOCK: 'low_stock'
  readonly OUT_OF_STOCK: 'out_of_stock'
  readonly DISCONTINUED: 'discontinued'
}
export declare const TIME_CONSTANTS: {
  readonly SECOND: 1000
  readonly MINUTE: number
  readonly HOUR: number
  readonly DAY: number
  readonly WEEK: number
}
export declare const PAGINATION_DEFAULTS: {
  readonly LIMIT: 50
  readonly MAX_LIMIT: 100
  readonly OFFSET: 0
}
export declare const FILE_UPLOAD_LIMITS: {
  readonly MAX_FILE_SIZE: number
  readonly ALLOWED_IMAGE_TYPES: readonly [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
  readonly ALLOWED_DOCUMENT_TYPES: readonly [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
}
export declare const API_VERSION = 'v1'
export declare const API_PREFIX = '/api/v1'
export declare const TOKEN_EXPIRY: {
  readonly ACCESS_TOKEN: '24h'
  readonly REFRESH_TOKEN: '7d'
  readonly RESET_TOKEN: '1h'
}
export declare const CACHE_TTL: {
  readonly SHORT: number
  readonly MEDIUM: number
  readonly LONG: number
  readonly DAY: number
}
export declare const ERROR_MESSAGES: {
  readonly UNAUTHORIZED: 'Unauthorized access'
  readonly FORBIDDEN: 'Access forbidden'
  readonly NOT_FOUND: 'Resource not found'
  readonly VALIDATION_ERROR: 'Validation error'
  readonly INTERNAL_ERROR: 'Internal server error'
  readonly DATABASE_ERROR: 'Database operation failed'
  readonly DUPLICATE_ENTRY: 'Duplicate entry exists'
  readonly INVALID_CREDENTIALS: 'Invalid credentials'
  readonly TOKEN_EXPIRED: 'Token has expired'
  readonly TOKEN_INVALID: 'Invalid token'
  readonly INSUFFICIENT_STOCK: 'Insufficient stock available'
  readonly ORDER_CANNOT_BE_MODIFIED: 'Order cannot be modified in current status'
}
export declare const SUCCESS_MESSAGES: {
  readonly CREATED: 'Resource created successfully'
  readonly UPDATED: 'Resource updated successfully'
  readonly DELETED: 'Resource deleted successfully'
  readonly LOGIN_SUCCESS: 'Login successful'
  readonly LOGOUT_SUCCESS: 'Logout successful'
  readonly PASSWORD_RESET: 'Password reset successful'
  readonly ORDER_PLACED: 'Order placed successfully'
  readonly PAYMENT_COMPLETED: 'Payment completed successfully'
}
export declare const REGEX_PATTERNS: {
  readonly EMAIL: RegExp
  readonly PHONE: RegExp
  readonly PASSWORD: RegExp
  readonly SLUG: RegExp
  readonly TIME_24H: RegExp
}
