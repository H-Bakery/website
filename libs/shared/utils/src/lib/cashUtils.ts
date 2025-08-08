/**
 * Cash Management Utility Functions
 * Provides reusable functions for cash-related operations and formatting
 */

import { CashEntry } from '@bakery/shared/types'

/**
 * Currency formatting utilities
 */
export const currencyUtils = {
  /**
   * Format amount as German currency
   * @param amount - Amount to format
   * @returns Formatted currency string (e.g., "€425,75")
   */
  format(amount: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  },

  /**
   * Format currency input (removes non-numeric characters except decimal point)
   * @param value - Input value to format
   * @returns Cleaned numeric string
   */
  formatInput(value: string): string {
    return value.replace(/[^0-9.]/g, '')
  },

  /**
   * Parse currency input to number
   * @param value - String value to parse
   * @returns Parsed number or 0 if invalid
   */
  parse(value: string): number {
    const cleanValue = value.replace(/[^0-9.]/g, '')
    const parsed = parseFloat(cleanValue)
    return isNaN(parsed) ? 0 : parsed
  },
}

/**
 * Date formatting utilities
 */
export const dateUtils = {
  /**
   * Format date for display (German locale)
   * @param dateString - ISO date string
   * @returns Formatted date string
   */
  formatDisplay(dateString: string): string {
    return new Date(dateString).toLocaleDateString('de-DE', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  },

  /**
   * Format date with weekday name
   * @param dateString - ISO date string
   * @returns Full weekday name
   */
  formatWeekday(dateString: string): string {
    return new Date(dateString).toLocaleDateString('de-DE', {
      weekday: 'long',
    })
  },

  /**
   * Format datetime for display
   * @param dateString - ISO datetime string
   * @returns Formatted datetime string
   */
  formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  },

  /**
   * Get current date in YYYY-MM-DD format
   * @returns Current date string
   */
  getCurrentDate(): string {
    return new Date().toISOString().split('T')[0]
  },

  /**
   * Check if date is in the future
   * @param dateString - Date string to check
   * @returns True if date is in the future
   */
  isFutureDate(dateString: string): boolean {
    const inputDate = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return inputDate > today
  },
}

/**
 * Cash entry calculations
 */
export const cashCalculations = {
  /**
   * Calculate total amount from cash entries
   * @param entries - Array of cash entries
   * @returns Total amount
   */
  calculateTotal(entries: CashEntry[]): number {
    return entries.reduce((sum, entry) => sum + entry.amount, 0)
  },

  /**
   * Calculate average amount from cash entries
   * @param entries - Array of cash entries
   * @returns Average amount
   */
  calculateAverage(entries: CashEntry[]): number {
    if (entries.length === 0) return 0
    return this.calculateTotal(entries) / entries.length
  },

  /**
   * Filter entries by date range
   * @param entries - Array of cash entries
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   * @returns Filtered entries
   */
  filterByDateRange(
    entries: CashEntry[],
    startDate?: string,
    endDate?: string
  ): CashEntry[] {
    return entries.filter((entry) => {
      if (startDate && entry.date < startDate) return false
      if (endDate && entry.date > endDate) return false
      return true
    })
  },

  /**
   * Filter entries by current month
   * @param entries - Array of cash entries
   * @returns Entries from current month
   */
  filterCurrentMonth(entries: CashEntry[]): CashEntry[] {
    const currentMonth = new Date().toISOString().substring(0, 7) // YYYY-MM
    return entries.filter((entry) => entry.date.startsWith(currentMonth))
  },

  /**
   * Filter entries by today's date
   * @param entries - Array of cash entries
   * @returns Today's entries
   */
  filterToday(entries: CashEntry[]): CashEntry[] {
    const today = dateUtils.getCurrentDate()
    return entries.filter((entry) => entry.date === today)
  },

  /**
   * Get trend direction between two amounts
   * @param current - Current amount
   * @param previous - Previous amount
   * @returns 'up' | 'down' | 'neutral'
   */
  getTrend(current: number, previous?: number): 'up' | 'down' | 'neutral' {
    if (!previous) return 'neutral'
    if (current > previous) return 'up'
    if (current < previous) return 'down'
    return 'neutral'
  },
}

/**
 * Validation utilities
 */
export const validationUtils = {
  /**
   * Validate amount value
   * @param amount - Amount to validate
   * @returns Validation result
   */
  validateAmount(amount: number): { isValid: boolean; message?: string } {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return { isValid: false, message: 'Betrag muss eine gültige Zahl sein' }
    }
    if (amount < 0) {
      return {
        isValid: false,
        message: 'Bitte geben Sie einen gültigen Betrag größer als 0 ein',
      }
    }
    return { isValid: true }
  },

  /**
   * Validate date string
   * @param dateString - Date string to validate
   * @returns Validation result
   */
  validateDate(dateString: string): { isValid: boolean; message?: string } {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(dateString)) {
      return { isValid: false, message: 'Ungültiges Datumsformat' }
    }

    if (dateUtils.isFutureDate(dateString)) {
      return {
        isValid: false,
        message: 'Das Datum darf nicht in der Zukunft liegen',
      }
    }

    return { isValid: true }
  },
}

/**
 * Export utilities for CSV generation
 */
export const exportUtils = {
  /**
   * Generate CSV content from cash entries
   * @param entries - Cash entries to export
   * @returns CSV content string
   */
  generateCSV(entries: CashEntry[]): string {
    const headers = ['Datum', 'Betrag (EUR)', 'Erfasst am']
    const csvContent = [
      headers.join(','),
      ...entries.map((entry) =>
        [
          entry.date,
          entry.amount.toFixed(2),
          dateUtils.formatDateTime(entry.createdAt),
        ].join(',')
      ),
    ].join('\n')

    return csvContent
  },

  /**
   * Download CSV file
   * @param csvContent - CSV content string
   * @param filename - Optional filename (default: kassenstand_YYYY-MM-DD.csv)
   */
  downloadCSV(csvContent: string, filename?: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      filename || `kassenstand_${dateUtils.getCurrentDate()}.csv`
    )
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  },
}

/**
 * Error message utilities
 */
export const errorUtils = {
  /**
   * Get user-friendly error message
   * @param error - Error object
   * @returns User-friendly error message in German
   */
  getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('Authentication')) {
        return 'Authentifizierung fehlgeschlagen. Bitte melden Sie sich erneut an.'
      }
      if (error.message.includes('not found')) {
        return 'Der Kassenstand wurde nicht gefunden.'
      }
      if (error.message.includes('Invalid amount')) {
        return 'Ungültiger Betrag angegeben.'
      }
      if (error.message.includes('Invalid date')) {
        return 'Ungültiges Datum angegeben.'
      }
      return error.message
    }
    return 'Ein unerwarteter Fehler ist aufgetreten.'
  },

  /**
   * Check if error requires authentication redirect
   * @param error - Error object
   * @returns True if should redirect to login
   */
  requiresAuth(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.message.includes('Authentication') ||
        error.message.includes('user session is invalid')
      )
    }
    return false
  },
}
