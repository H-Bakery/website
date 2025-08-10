/**
 * @fileoverview Main export file for @bakery/shared/data-mocks
 * @module @bakery/shared/data-mocks
 */

// Export all mock data
export * from './lib/products'
export * from './lib/users'
export * from './lib/orders'
export * from './lib/analytics'
export * from './lib/generators'

// Re-export commonly used collections for convenience
export { ALL_PRODUCTS as PRODUCTS } from './lib/products'
export { MOCK_USERS as USERS } from './lib/users'
export { MOCK_CUSTOMERS as CUSTOMERS } from './lib/users/customers'
export { ALL_ORDERS as ORDERS } from './lib/orders'
export { DASHBOARD_SUMMARY } from './lib/analytics'
