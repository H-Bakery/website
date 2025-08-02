/**
 * User and authentication-related type definitions
 */
import { UserRole } from './common'
// Type guards
export function isCustomer(user) {
  return user.role === UserRole.Customer
}
export function isStaff(user) {
  return [UserRole.Staff, UserRole.Manager, UserRole.Admin].includes(user.role)
}
