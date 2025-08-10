import { PaginationParams, PaginatedResult } from '../types';
import { PAGINATION_DEFAULTS } from '../constants';

/**
 * Parse pagination parameters from query string
 * @param query - Query parameters object
 * @returns Parsed pagination parameters
 */
export function parsePaginationParams(query: any): Required<PaginationParams> {
  const limit = Math.min(
    Math.max(parseInt(query.limit) || PAGINATION_DEFAULTS.LIMIT, 1),
    PAGINATION_DEFAULTS.MAX_LIMIT
  );
  
  const offset = Math.max(parseInt(query.offset) || PAGINATION_DEFAULTS.OFFSET, 0);
  
  const page = Math.max(parseInt(query.page) || Math.floor(offset / limit) + 1, 1);
  
  return { limit, offset, page };
}

/**
 * Create a paginated result object
 * @param data - Array of data items
 * @param total - Total count of items
 * @param params - Pagination parameters
 * @returns Paginated result object
 */
export function createPaginatedResult<T>(
  data: T[],
  total: number,
  params: Required<PaginationParams>
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / params.limit);
  const currentPage = params.page || Math.floor(params.offset / params.limit) + 1;
  
  return {
    data,
    total,
    limit: params.limit,
    offset: params.offset,
    page: currentPage,
    totalPages,
  };
}

/**
 * Calculate offset from page number
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @returns Offset value
 */
export function calculateOffset(page: number, limit: number): number {
  return (Math.max(page, 1) - 1) * limit;
}

/**
 * Generate pagination links
 * @param baseUrl - Base URL for links
 * @param currentPage - Current page number
 * @param totalPages - Total number of pages
 * @param limit - Items per page
 * @returns Object with pagination links
 */
export function generatePaginationLinks(
  baseUrl: string,
  currentPage: number,
  totalPages: number,
  limit: number
): {
  first?: string;
  prev?: string;
  next?: string;
  last?: string;
} {
  const links: any = {};
  
  // First page
  if (currentPage > 1) {
    links.first = `${baseUrl}?page=1&limit=${limit}`;
  }
  
  // Previous page
  if (currentPage > 1) {
    links.prev = `${baseUrl}?page=${currentPage - 1}&limit=${limit}`;
  }
  
  // Next page
  if (currentPage < totalPages) {
    links.next = `${baseUrl}?page=${currentPage + 1}&limit=${limit}`;
  }
  
  // Last page
  if (currentPage < totalPages) {
    links.last = `${baseUrl}?page=${totalPages}&limit=${limit}`;
  }
  
  return links;
}

/**
 * Paginate an array in memory
 * @param array - Array to paginate
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @returns Paginated array slice
 */
export function paginateArray<T>(array: T[], page: number, limit: number): T[] {
  const offset = calculateOffset(page, limit);
  return array.slice(offset, offset + limit);
}