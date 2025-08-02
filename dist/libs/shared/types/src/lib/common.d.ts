/**
 * Common shared types used across the bakery application
 */
export interface BaseEntity {
  id: number
  createdAt: string
  updatedAt: string
}
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasMore: boolean
  hasPrevious: boolean
}
export type Nullable<T> = T | null
export type Optional<T> = T | undefined
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
export interface DateRange {
  startDate: string
  endDate: string
}
export declare enum Status {
  Active = 'active',
  Inactive = 'inactive',
  Pending = 'pending',
  Cancelled = 'cancelled',
}
export declare enum UserRole {
  Admin = 'admin',
  Manager = 'manager',
  Staff = 'staff',
  Customer = 'customer',
}
export declare function isValidStatus(status: string): status is Status
export declare function isValidUserRole(role: string): role is UserRole
