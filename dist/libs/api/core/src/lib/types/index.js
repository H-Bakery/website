'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.isAuthUser = isAuthUser
exports.isPaginatedResult = isPaginatedResult
exports.isApiResponse = isApiResponse
// Export Type Guards
function isAuthUser(user) {
  return (
    user &&
    typeof user.id === 'number' &&
    typeof user.username === 'string' &&
    typeof user.email === 'string' &&
    typeof user.role === 'string' &&
    typeof user.isActive === 'boolean'
  )
}
function isPaginatedResult(result) {
  return (
    result &&
    Array.isArray(result.data) &&
    typeof result.total === 'number' &&
    typeof result.limit === 'number' &&
    typeof result.offset === 'number'
  )
}
function isApiResponse(response) {
  return response && typeof response.success === 'boolean'
}
