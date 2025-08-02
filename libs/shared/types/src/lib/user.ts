/**
 * User and authentication-related type definitions
 */

import { BaseEntity, UserRole } from './common'

// User interface
export interface User extends BaseEntity {
  email: string
  password?: string // Optional for frontend, excluded in responses
  firstName: string
  lastName: string
  role: UserRole
  isActive: boolean
  lastLogin?: string
  phoneNumber?: string
  address?: Address
  preferences?: UserPreferences
}

// Address interface
export interface Address {
  street: string
  houseNumber: string
  city: string
  postalCode: string
  country: string
}

// User preferences
export interface UserPreferences {
  newsletter: boolean
  notifications: boolean
  language: string
  theme: 'light' | 'dark' | 'auto'
}

// Authentication types
export interface LoginCredentials {
  email: string
  password: string
}

export interface LoginResponse {
  user: Omit<User, 'password'>
  token: string
  refreshToken: string
  expiresIn: number
}

export interface RegisterInput {
  email: string
  password: string
  firstName: string
  lastName: string
  phoneNumber?: string
  address?: Address
}

// Customer-specific types
export interface Customer extends Omit<User, 'role'> {
  role: UserRole.Customer
  loyaltyPoints?: number
  orderHistory?: number[]
}

// Staff-specific types
export interface Staff extends Omit<User, 'role'> {
  role: UserRole.Staff | UserRole.Manager | UserRole.Admin
  employeeId: string
  startDate: string
  department?: string
  permissions?: Permission[]
}

// Permission system
export interface Permission {
  id: string
  name: string
  description: string
  resource: string
  action: string
}

// User creation/update types
export type CreateUserInput = Omit<
  User,
  'id' | 'createdAt' | 'updatedAt' | 'lastLogin'
>
export type UpdateUserInput = Partial<CreateUserInput> & { id: number }

// Type guards
export function isCustomer(user: User): user is Customer {
  return user.role === UserRole.Customer
}

export function isStaff(user: User): user is Staff {
  return [UserRole.Staff, UserRole.Manager, UserRole.Admin].includes(user.role)
}
