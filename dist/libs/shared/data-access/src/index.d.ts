/**
 * @fileoverview Shared data access layer for the bakery management system
 * @module @bakery/shared/data-access
 */
export * from './lib/api-client'
export * from './lib/services/product.service'
export * from './lib/services/order.service'
export * from './lib/services/user.service'
export * from './lib/services/auth.service'
export * from './lib/services/notification.service'
export { productService } from './lib/services/product.service'
export { orderService } from './lib/services/order.service'
export { userService } from './lib/services/user.service'
export { authService } from './lib/services/auth.service'
export { notificationService } from './lib/services/notification.service'
export { apiClient } from './lib/api-client'
