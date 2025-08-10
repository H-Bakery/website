// Export all orders feature components
export { default as OrdersPage } from './orders-page'
export { default as OrderDetailView } from './order-detail-view'
export { default as BakingListPage } from './baking-list-page'
export { default as QuickOrderForm } from './quick-order-form'

// Export weekly view components
export { default as WeeklyCalendar } from './weekly-view/WeeklyCalendar'
export { default as OrderDetailDialog } from './weekly-view/OrderDetailDialog'

// Export services and types
export * from './services/intern-order.service'
export * from './types/intern-order.types'

// Export mock data
export * from './mocks/intern-orders.mock'
