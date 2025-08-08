/**
 * Local formatting utilities for the landing page
 * (Copied from shared utils to make landing page self-contained)
 */

/**
 * Format a number as currency (CHF)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(amount)
}
