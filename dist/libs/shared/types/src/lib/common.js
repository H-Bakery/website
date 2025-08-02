/**
 * Common shared types used across the bakery application
 */
// Status enums
export var Status
;(function (Status) {
  Status['Active'] = 'active'
  Status['Inactive'] = 'inactive'
  Status['Pending'] = 'pending'
  Status['Cancelled'] = 'cancelled'
})(Status || (Status = {}))
// User roles
export var UserRole
;(function (UserRole) {
  UserRole['Admin'] = 'admin'
  UserRole['Manager'] = 'manager'
  UserRole['Staff'] = 'staff'
  UserRole['Customer'] = 'customer'
})(UserRole || (UserRole = {}))
// Type guards
export function isValidStatus(status) {
  return Object.values(Status).includes(status)
}
export function isValidUserRole(role) {
  return Object.values(UserRole).includes(role)
}
