/**
 * User and authentication-related type definitions
 */
import { BaseEntity, UserRole } from './common'
export interface User extends BaseEntity {
  email: string
  password?: string
  firstName: string
  lastName: string
  role: UserRole
  isActive: boolean
  lastLogin?: string
  phoneNumber?: string
  address?: Address
  preferences?: UserPreferences
}
export interface Address {
  street: string
  houseNumber: string
  city: string
  postalCode: string
  country: string
}
export interface UserPreferences {
  newsletter: boolean
  notifications: boolean
  language: string
  theme: 'light' | 'dark' | 'auto'
}
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
export interface Customer extends Omit<User, 'role'> {
  role: UserRole.Customer
  loyaltyPoints?: number
  orderHistory?: number[]
}
export interface Staff extends Omit<User, 'role'> {
  role: UserRole.Staff | UserRole.Manager | UserRole.Admin
  employeeId: string
  startDate: string
  department?: string
  permissions?: Permission[]
}
export interface Permission {
  id: string
  name: string
  description: string
  resource: string
  action: string
}
export type CreateUserInput = Omit<
  User,
  'id' | 'createdAt' | 'updatedAt' | 'lastLogin'
>
export type UpdateUserInput = Partial<CreateUserInput> & {
  id: number
}
export declare function isCustomer(user: User): user is Customer
export declare function isStaff(user: User): user is Staff
