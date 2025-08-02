/**
 * @fileoverview Shared TypeScript types for the bakery management system
 * @module @bakery/shared/types
 */
export * from './lib/common'
export * from './lib/product'
export * from './lib/user'
export * from './lib/order'
export * from './lib/notification'
export type {
  ApiResponse,
  PaginatedResponse,
  DateRange,
  DeepPartial,
  Nullable,
  Optional,
} from './lib/common'
export type {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductFilters,
  ProductCategory,
  ProductType,
  ProductStatus,
} from './lib/product'
export type {
  User,
  Customer,
  Staff,
  LoginCredentials,
  LoginResponse,
  RegisterInput,
  CreateUserInput,
  UpdateUserInput,
} from './lib/user'
export type {
  Order,
  OrderItem,
  CreateOrderInput,
  CreateOrderItemInput,
  UpdateOrderInput,
  OrderFilters,
  OrderSummary,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
} from './lib/order'
export type {
  Notification,
  NotificationCategory,
  NotificationPriority,
  NotificationChannel,
  NotificationType,
  NotificationAction,
  NotificationPreferences,
  CreateNotificationInput,
  UpdateNotificationInput,
  NotificationFilters,
  NotificationStats,
  NotificationEvent,
} from './lib/notification'
