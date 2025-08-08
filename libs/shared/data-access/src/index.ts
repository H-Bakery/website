/**
 * @fileoverview Shared data access layer for the bakery management system
 * @module @bakery/shared/data-access
 */

// Export API client
export * from './lib/api-client'

// Export all services
export * from './lib/services/product.service'
export * from './lib/services/order.service'
export * from './lib/services/user.service'
export * from './lib/services/auth.service'
export * from './lib/services/notification.service'
export * from './lib/services/report.service'
export * from './lib/services/analytics.service'
export * from './lib/services/reporting.service'
export * from './lib/services/inventory.service'

// Re-export service instances for convenience
export { productService } from './lib/services/product.service'
export { orderService } from './lib/services/order.service'
export { userService } from './lib/services/user.service'
export { authService } from './lib/services/auth.service'
export { notificationService } from './lib/services/notification.service'
export { reportService } from './lib/services/report.service'
export { analyticsService } from './lib/services/analytics.service'
export { reportingService } from './lib/services/reporting.service'
export { inventoryService } from './lib/services/inventory.service'
export { apiClient } from './lib/api-client'

// Export bakeryAPI
export { default as bakeryAPI } from './lib/services/bakeryAPI'
