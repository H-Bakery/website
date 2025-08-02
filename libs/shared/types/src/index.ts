/**
 * @fileoverview Shared TypeScript types for the bakery management system
 * @module @bakery/shared/types
 */

// Export all common types
export * from './lib/common'

// Export product types
export * from './lib/product'

// Export user types
export * from './lib/user'

// Export order types
export * from './lib/order'

// Re-export commonly used types for convenience
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
