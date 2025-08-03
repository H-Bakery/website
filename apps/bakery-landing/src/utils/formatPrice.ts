export const formatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
})

export const formatPrice = (price: number): string => {
  return formatter.format(price)
}