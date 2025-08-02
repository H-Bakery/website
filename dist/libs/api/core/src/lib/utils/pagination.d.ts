import { PaginationParams, PaginatedResult } from '../types'
/**
 * Parse pagination parameters from query string
 * @param query - Query parameters object
 * @returns Parsed pagination parameters
 */
export declare function parsePaginationParams(
  query: any
): Required<PaginationParams>
/**
 * Create a paginated result object
 * @param data - Array of data items
 * @param total - Total count of items
 * @param params - Pagination parameters
 * @returns Paginated result object
 */
export declare function createPaginatedResult<T>(
  data: T[],
  total: number,
  params: Required<PaginationParams>
): PaginatedResult<T>
/**
 * Calculate offset from page number
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @returns Offset value
 */
export declare function calculateOffset(page: number, limit: number): number
/**
 * Generate pagination links
 * @param baseUrl - Base URL for links
 * @param currentPage - Current page number
 * @param totalPages - Total number of pages
 * @param limit - Items per page
 * @returns Object with pagination links
 */
export declare function generatePaginationLinks(
  baseUrl: string,
  currentPage: number,
  totalPages: number,
  limit: number
): {
  first?: string
  prev?: string
  next?: string
  last?: string
}
/**
 * Paginate an array in memory
 * @param array - Array to paginate
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @returns Paginated array slice
 */
export declare function paginateArray<T>(
  array: T[],
  page: number,
  limit: number
): T[]
