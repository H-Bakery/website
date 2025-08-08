/**
 * Cash domain models and types
 */

// Base entity interface
export interface BaseEntity {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface CashEntry extends BaseEntity {
  amount: number;
  date: string; // YYYY-MM-DD format
  userId: number;
  notes?: string;
}

export interface CreateCashEntryInput {
  amount: number;
  date?: string; // Optional, defaults to today
  notes?: string;
}

export interface UpdateCashEntryInput {
  amount?: number;
  date?: string;
  notes?: string;
}

export interface CashEntryFilters {
  startDate?: string;
  endDate?: string;
  userId?: number;
  limit?: number;
  offset?: number;
}

export interface CashStatistics {
  totalAmount: number;
  averageAmount: number;
  entryCount: number;
  latestEntry: {
    amount: number;
    date: string;
  } | null;
  dateRange: {
    startDate: string | null;
    endDate: string | null;
  };
}

// Validation constants
export const CASH_VALIDATION = {
  MIN_AMOUNT: 0,
  MAX_AMOUNT: 999999.99,
  MAX_NOTES_LENGTH: 500,
  DATE_FORMAT: /^\d{4}-\d{2}-\d{2}$/
} as const;

// Error messages
export const CASH_ERROR_MESSAGES = {
  INVALID_USER: "Invalid user",
  INVALID_AMOUNT: "Invalid amount",
  INVALID_DATE_FORMAT: "Invalid date format. Use YYYY-MM-DD",
  CASH_ENTRY_NOT_FOUND: "Cash entry not found",
  INVALID_USER_REFERENCE: "Invalid user reference",
  DATABASE_ERROR: "Database error",
  UNAUTHORIZED_ACCESS: "Unauthorized access to cash entry",
  NOTES_TOO_LONG: "Notes must not exceed 500 characters"
} as const;