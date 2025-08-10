export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(price)
}

// Export formatter object for backward compatibility
export const formatter = {
  format: (price: number): string => formatPrice(price),
}
