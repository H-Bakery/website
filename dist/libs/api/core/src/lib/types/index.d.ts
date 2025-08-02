export type UserRole = 'admin' | 'baker' | 'staff' | 'customer'
export interface AuthUser {
  id: number
  username: string
  email: string
  role: UserRole
  firstName?: string
  lastName?: string
  isActive: boolean
}
export interface AuthToken {
  token: string
  expiresAt: Date
}
export interface AuthPayload {
  userId: number
  email: string
  role: UserRole
}
export interface PaginationParams {
  limit?: number
  offset?: number
  page?: number
}
export interface PaginatedResult<T> {
  data: T[]
  total: number
  limit: number
  offset: number
  page: number
  totalPages: number
}
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
  errors?: Record<string, string[]>
}
export interface ApiError {
  code: string
  message: string
  details?: any
  timestamp: Date
}
export interface DateRangeFilter {
  startDate?: Date | string
  endDate?: Date | string
}
export interface SortOptions {
  field: string
  order: 'ASC' | 'DESC'
}
export interface TimestampedModel {
  createdAt: Date
  updatedAt: Date
}
export interface SoftDeletableModel extends TimestampedModel {
  deletedAt?: Date | null
}
export interface AuthenticatedRequest extends Express.Request {
  userId: number
  userEmail: string
  userRole: UserRole
  user?: AuthUser
}
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'in_production'
  | 'ready'
  | 'completed'
  | 'cancelled'
  | 'refunded'
export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
export type ProductionStatus =
  | 'pending'
  | 'ready'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed'
export type InventoryStatus =
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'discontinued'
export type NotificationType = 'info' | 'success' | 'warning' | 'error'
export type NotificationCategory =
  | 'staff'
  | 'order'
  | 'system'
  | 'inventory'
  | 'general'
export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent'
export interface StockAdjustment {
  productId: number
  quantity: number
  type: 'add' | 'remove' | 'set'
  reason: string
  performedBy: number
}
export interface PriceCalculation {
  basePrice: number
  discount: number
  tax: number
  total: number
}
export interface Address {
  street: string
  city: string
  state?: string
  postalCode: string
  country: string
}
export interface ContactInfo {
  name: string
  email?: string
  phone?: string
  address?: Address
}
export interface UploadedFile {
  filename: string
  originalName: string
  mimetype: string
  size: number
  path: string
  url?: string
}
export interface SearchParams {
  query: string
  filters?: Record<string, any>
  sort?: SortOptions
  pagination?: PaginationParams
}
export interface DateRangeStats {
  date: Date
  count: number
  value: number
}
export interface CategoryStats {
  category: string
  count: number
  percentage: number
}
export interface ValidationError {
  field: string
  message: string
  value?: any
}
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}
export declare function isAuthUser(user: any): user is AuthUser
export declare function isPaginatedResult<T>(
  result: any
): result is PaginatedResult<T>
export declare function isApiResponse<T>(
  response: any
): response is ApiResponse<T>
