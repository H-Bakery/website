/**
 * Formatting utilities for the application
 */

/**
 * Currency formatter instance for EUR (German formatting, e.g. "2,50 €")
 */
export const formatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
})

/**
 * Format a number as currency (EUR, de-DE — e.g. "2,50 €")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

/**
 * Format a date in German format
 */
export function formatDateGerman(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(dateObj)
}

/**
 * Format a date with time in German format
 */
export function formatDateTimeGerman(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj)
}

/**
 * Format a phone number in German format
 *
 * German numbers are conventionally written as "<Vorwahl> <Rufnummer>", e.g.
 * "06841 123456" or in international form "+49 6841 123456".
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '')

  // International German number: +49 <area code without leading 0> <number>
  if (
    cleaned.startsWith('49') &&
    cleaned.length >= 11 &&
    cleaned.length <= 14
  ) {
    const national = cleaned.slice(2)
    return `+49 ${national.slice(0, 4)} ${national.slice(4)}`
  }

  // National German number with leading 0: <area code> <number>
  if (cleaned.startsWith('0') && cleaned.length >= 10 && cleaned.length <= 13) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`
  }

  // Return as-is if format is not recognized
  return phone
}

/**
 * Format a percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Format quantity with proper units
 */
export function formatQuantity(
  quantity: number,
  unit: string = 'Stück'
): string {
  if (quantity === 1) {
    return `${quantity} ${unit}`
  }

  // Handle plural forms for common units
  const pluralForms: Record<string, string> = {
    Stück: 'Stück',
    Laib: 'Laibe',
    Brot: 'Brote',
    Brötchen: 'Brötchen',
    Kuchen: 'Kuchen',
    Torte: 'Torten',
  }

  const pluralUnit = pluralForms[unit] || unit
  return `${quantity} ${pluralUnit}`
}

/**
 * Get week number from date
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  )
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - dateObj.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) {
    return 'gerade eben'
  } else if (diffMinutes < 60) {
    return `vor ${diffMinutes} ${diffMinutes === 1 ? 'Minute' : 'Minuten'}`
  } else if (diffHours < 24) {
    return `vor ${diffHours} ${diffHours === 1 ? 'Stunde' : 'Stunden'}`
  } else if (diffDays < 7) {
    return `vor ${diffDays} ${diffDays === 1 ? 'Tag' : 'Tagen'}`
  } else {
    return formatDateGerman(dateObj)
  }
}
