import { TIME_CONSTANTS } from '../constants';

/**
 * Format a date to YYYY-MM-DD string
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a date to YYYY-MM-DD HH:mm:ss string
 * @param date - Date to format
 * @returns Formatted datetime string
 */
export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  const dateStr = formatDate(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}:${seconds}`;
}

/**
 * Get start of day (00:00:00)
 * @param date - Date to process
 * @returns Date at start of day
 */
export function startOfDay(date: Date | string): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day (23:59:59.999)
 * @param date - Date to process
 * @returns Date at end of day
 */
export function endOfDay(date: Date | string): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Add days to a date
 * @param date - Starting date
 * @param days - Number of days to add (can be negative)
 * @returns New date
 */
export function addDays(date: Date | string, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Add hours to a date
 * @param date - Starting date
 * @param hours - Number of hours to add (can be negative)
 * @returns New date
 */
export function addHours(date: Date | string, hours: number): Date {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

/**
 * Add minutes to a date
 * @param date - Starting date
 * @param minutes - Number of minutes to add (can be negative)
 * @returns New date
 */
export function addMinutes(date: Date | string, minutes: number): Date {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

/**
 * Check if date is in the past
 * @param date - Date to check
 * @returns True if date is in the past
 */
export function isPast(date: Date | string): boolean {
  return new Date(date) < new Date();
}

/**
 * Check if date is in the future
 * @param date - Date to check
 * @returns True if date is in the future
 */
export function isFuture(date: Date | string): boolean {
  return new Date(date) > new Date();
}

/**
 * Check if date is today
 * @param date - Date to check
 * @returns True if date is today
 */
export function isToday(date: Date | string): boolean {
  const d = new Date(date);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

/**
 * Get days between two dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of days between dates
 */
export function daysBetween(startDate: Date | string, endDate: Date | string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.abs(end.getTime() - start.getTime());
  return Math.floor(diff / TIME_CONSTANTS.DAY);
}

/**
 * Get hours between two dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of hours between dates
 */
export function hoursBetween(startDate: Date | string, endDate: Date | string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.abs(end.getTime() - start.getTime());
  return Math.floor(diff / TIME_CONSTANTS.HOUR);
}

/**
 * Get minutes between two dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of minutes between dates
 */
export function minutesBetween(startDate: Date | string, endDate: Date | string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.abs(end.getTime() - start.getTime());
  return Math.floor(diff / TIME_CONSTANTS.MINUTE);
}

/**
 * Parse date range from query parameters
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns Object with parsed start and end dates
 */
export function parseDateRange(
  startDate?: string,
  endDate?: string
): { start?: Date; end?: Date } {
  const range: { start?: Date; end?: Date } = {};
  
  if (startDate) {
    range.start = startOfDay(startDate);
  }
  
  if (endDate) {
    range.end = endOfDay(endDate);
  }
  
  return range;
}

/**
 * Get week start date (Monday)
 * @param date - Date to process
 * @returns Date at start of week
 */
export function startOfWeek(date: Date | string): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setDate(diff);
  return startOfDay(d);
}

/**
 * Get week end date (Sunday)
 * @param date - Date to process
 * @returns Date at end of week
 */
export function endOfWeek(date: Date | string): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + 7;
  d.setDate(diff);
  return endOfDay(d);
}

/**
 * Get month start date
 * @param date - Date to process
 * @returns Date at start of month
 */
export function startOfMonth(date: Date | string): Date {
  const d = new Date(date);
  d.setDate(1);
  return startOfDay(d);
}

/**
 * Get month end date
 * @param date - Date to process
 * @returns Date at end of month
 */
export function endOfMonth(date: Date | string): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return endOfDay(d);
}