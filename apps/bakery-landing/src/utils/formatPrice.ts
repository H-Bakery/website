export const formatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
})

export const formatPrice = (price: number | null): string => {
  return price === null ? 'Preis offen' : formatter.format(price)
}
