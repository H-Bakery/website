/** de-DE-Formatierung (kopiert statt aus @bakery/* importiert - die App hängt an keiner Lib). */

const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
})

const decimal = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 2,
})

/** 1990 -> "19,90 €" (mit geschütztem Leerzeichen, wie Intl es liefert). */
export function formatEuro(cents: number): string {
  return euro.format(cents / 100)
}

/** 900 -> "900 g", 2400 -> "2,4 kg". */
export function formatGrams(grams: number): string {
  if (Math.abs(grams) >= 1000) return `${decimal.format(grams / 1000)} kg`
  return `${decimal.format(grams)} g`
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}
