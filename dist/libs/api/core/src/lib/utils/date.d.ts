/**
 * Format a date to YYYY-MM-DD string
 * @param date - Date to format
 * @returns Formatted date string
 */
export declare function formatDate(date: Date | string): string
/**
 * Format a date to YYYY-MM-DD HH:mm:ss string
 * @param date - Date to format
 * @returns Formatted datetime string
 */
export declare function formatDateTime(date: Date | string): string
/**
 * Get start of day (00:00:00)
 * @param date - Date to process
 * @returns Date at start of day
 */
export declare function startOfDay(date: Date | string): Date
/**
 * Get end of day (23:59:59.999)
 * @param date - Date to process
 * @returns Date at end of day
 */
export declare function endOfDay(date: Date | string): Date
/**
 * Add days to a date
 * @param date - Starting date
 * @param days - Number of days to add (can be negative)
 * @returns New date
 */
export declare function addDays(date: Date | string, days: number): Date
/**
 * Add hours to a date
 * @param date - Starting date
 * @param hours - Number of hours to add (can be negative)
 * @returns New date
 */
export declare function addHours(date: Date | string, hours: number): Date
/**
 * Add minutes to a date
 * @param date - Starting date
 * @param minutes - Number of minutes to add (can be negative)
 * @returns New date
 */
export declare function addMinutes(date: Date | string, minutes: number): Date
/**
 * Check if date is in the past
 * @param date - Date to check
 * @returns True if date is in the past
 */
export declare function isPast(date: Date | string): boolean
/**
 * Check if date is in the future
 * @param date - Date to check
 * @returns True if date is in the future
 */
export declare function isFuture(date: Date | string): boolean
/**
 * Check if date is today
 * @param date - Date to check
 * @returns True if date is today
 */
export declare function isToday(date: Date | string): boolean
/**
 * Get days between two dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of days between dates
 */
export declare function daysBetween(
  startDate: Date | string,
  endDate: Date | string
): number
/**
 * Get hours between two dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of hours between dates
 */
export declare function hoursBetween(
  startDate: Date | string,
  endDate: Date | string
): number
/**
 * Get minutes between two dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of minutes between dates
 */
export declare function minutesBetween(
  startDate: Date | string,
  endDate: Date | string
): number
/**
 * Parse date range from query parameters
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns Object with parsed start and end dates
 */
export declare function parseDateRange(
  startDate?: string,
  endDate?: string
): {
  start?: Date
  end?: Date
}
/**
 * Get week start date (Monday)
 * @param date - Date to process
 * @returns Date at start of week
 */
export declare function startOfWeek(date: Date | string): Date
/**
 * Get week end date (Sunday)
 * @param date - Date to process
 * @returns Date at end of week
 */
export declare function endOfWeek(date: Date | string): Date
/**
 * Get month start date
 * @param date - Date to process
 * @returns Date at start of month
 */
export declare function startOfMonth(date: Date | string): Date
/**
 * Get month end date
 * @param date - Date to process
 * @returns Date at end of month
 */
export declare function endOfMonth(date: Date | string): Date
