'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.parsePaginationParams = parsePaginationParams
exports.createPaginatedResult = createPaginatedResult
exports.calculateOffset = calculateOffset
exports.generatePaginationLinks = generatePaginationLinks
exports.paginateArray = paginateArray
var constants_1 = require('../constants')
/**
 * Parse pagination parameters from query string
 * @param query - Query parameters object
 * @returns Parsed pagination parameters
 */
function parsePaginationParams(query) {
  var limit = Math.min(
    Math.max(parseInt(query.limit) || constants_1.PAGINATION_DEFAULTS.LIMIT, 1),
    constants_1.PAGINATION_DEFAULTS.MAX_LIMIT
  )
  var offset = Math.max(
    parseInt(query.offset) || constants_1.PAGINATION_DEFAULTS.OFFSET,
    0
  )
  var page = Math.max(parseInt(query.page) || Math.floor(offset / limit) + 1, 1)
  return { limit: limit, offset: offset, page: page }
}
/**
 * Create a paginated result object
 * @param data - Array of data items
 * @param total - Total count of items
 * @param params - Pagination parameters
 * @returns Paginated result object
 */
function createPaginatedResult(data, total, params) {
  var totalPages = Math.ceil(total / params.limit)
  var currentPage = params.page || Math.floor(params.offset / params.limit) + 1
  return {
    data: data,
    total: total,
    limit: params.limit,
    offset: params.offset,
    page: currentPage,
    totalPages: totalPages,
  }
}
/**
 * Calculate offset from page number
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @returns Offset value
 */
function calculateOffset(page, limit) {
  return (Math.max(page, 1) - 1) * limit
}
/**
 * Generate pagination links
 * @param baseUrl - Base URL for links
 * @param currentPage - Current page number
 * @param totalPages - Total number of pages
 * @param limit - Items per page
 * @returns Object with pagination links
 */
function generatePaginationLinks(baseUrl, currentPage, totalPages, limit) {
  var links = {}
  // First page
  if (currentPage > 1) {
    links.first = ''.concat(baseUrl, '?page=1&limit=').concat(limit)
  }
  // Previous page
  if (currentPage > 1) {
    links.prev = ''
      .concat(baseUrl, '?page=')
      .concat(currentPage - 1, '&limit=')
      .concat(limit)
  }
  // Next page
  if (currentPage < totalPages) {
    links.next = ''
      .concat(baseUrl, '?page=')
      .concat(currentPage + 1, '&limit=')
      .concat(limit)
  }
  // Last page
  if (currentPage < totalPages) {
    links.last = ''
      .concat(baseUrl, '?page=')
      .concat(totalPages, '&limit=')
      .concat(limit)
  }
  return links
}
/**
 * Paginate an array in memory
 * @param array - Array to paginate
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @returns Paginated array slice
 */
function paginateArray(array, page, limit) {
  var offset = calculateOffset(page, limit)
  return array.slice(offset, offset + limit)
}
