/**
 * Common shared types used across the bakery application
 */

// Base types
export interface BaseEntity {
  id: number
  createdAt: string
  updatedAt: string
}

// API Response types
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

// Common utility types
export type Nullable<T> = T | null
export type Optional<T> = T | undefined
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// Date range utilities
export interface DateRange {
  startDate: string
  endDate: string
}

// Status enums
export enum Status {
  Active = 'active',
  Inactive = 'inactive',
  Pending = 'pending',
  Cancelled = 'cancelled',
}

// User roles
export enum UserRole {
  Admin = 'admin',
  Manager = 'manager',
  Staff = 'staff',
  Customer = 'customer',
}

// Type guards
export function isValidStatus(status: string): status is Status {
  return Object.values(Status).includes(status as Status)
}

export function isValidUserRole(role: string): role is UserRole {
  return Object.values(UserRole).includes(role as UserRole)
}
