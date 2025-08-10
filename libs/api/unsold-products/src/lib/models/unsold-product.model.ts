/**
 * Unsold Products domain models and types
 */

// Base interface
export interface BaseEntity {
  id: number;
  createdAt: string;
  updatedAt: string;
}

// Unsold product entry
export interface UnsoldProduct extends BaseEntity {
  productId: number;
  quantity: number;
  date: string; // YYYY-MM-DD format
  userId: number;
  reason?: string;
  notes?: string;
  // Related data (when included)
  product?: {
    name: string;
    category: string;
  };
  user?: {
    username: string;
  };
}

// Create unsold product input
export interface CreateUnsoldProductInput {
  productId: number;
  quantity: number;
  date?: string; // Optional, defaults to today
  reason?: string;
  notes?: string;
}

// Update unsold product input
export interface UpdateUnsoldProductInput {
  quantity?: number;
  reason?: string;
  notes?: string;
}

// Unsold product summary (aggregated data)
export interface UnsoldProductSummary {
  productId: number;
  totalUnsold: number;
  product: {
    name: string;
    category: string;
  };
}

// Filters for querying unsold products
export interface UnsoldProductFilters {
  startDate?: string;
  endDate?: string;
  productId?: number;
  category?: string;
  userId?: number;
  page?: number;
  limit?: number;
}

// Daily waste report
export interface DailyWasteReport {
  date: string;
  totalItems: number;
  totalQuantity: number;
  byCategory: Record<string, number>;
  byProduct: Array<{
    productId: number;
    productName: string;
    quantity: number;
  }>;
}

// Weekly/Monthly waste analysis
export interface WasteAnalysis {
  period: {
    start: string;
    end: string;
  };
  totalWaste: number;
  averageDaily: number;
  topWastedProducts: Array<{
    productId: number;
    productName: string;
    totalQuantity: number;
    percentage: number;
  }>;
  wasteByCategory: Record<string, number>;
  trend: 'increasing' | 'decreasing' | 'stable';
}

// Constants
export const UNSOLD_PRODUCT_CONSTANTS = {
  MAX_REASON_LENGTH: 200,
  MAX_NOTES_LENGTH: 500,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  WASTE_REASONS: [
    'expired',
    'damaged',
    'overproduction',
    'customer_return',
    'quality_issue',
    'other'
  ] as const
} as const;

// Error messages
export const UNSOLD_PRODUCT_ERROR_MESSAGES = {
  PRODUCT_ID_REQUIRED: 'Product ID is required',
  QUANTITY_REQUIRED: 'Quantity is required',
  INVALID_QUANTITY: 'Quantity must be a positive number',
  INVALID_DATE: 'Invalid date format. Use YYYY-MM-DD',
  PRODUCT_NOT_FOUND: 'Product not found',
  ENTRY_NOT_FOUND: 'Unsold product entry not found',
  REASON_TOO_LONG: `Reason must not exceed ${UNSOLD_PRODUCT_CONSTANTS.MAX_REASON_LENGTH} characters`,
  NOTES_TOO_LONG: `Notes must not exceed ${UNSOLD_PRODUCT_CONSTANTS.MAX_NOTES_LENGTH} characters`,
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Insufficient permissions',
  DATABASE_ERROR: 'Database error occurred',
  INVALID_DATE_RANGE: 'Start date must be before end date',
  FUTURE_DATE_NOT_ALLOWED: 'Cannot record unsold products for future dates'
} as const;

// Helper functions
export function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

export function isFutureDate(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today;
}