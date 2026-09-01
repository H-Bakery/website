/**
 * @fileoverview Grundpreis (Preis je Kilogramm) für Ware nach Gewicht.
 * @module @bakery/shared/data-access/unit-price
 *
 * § 4 PAngV: Wer Waren nach Gewicht anbietet, muss neben dem Endpreis den
 * Grundpreis je Mengeneinheit angeben. 25 der 103 Artikel tragen ihr Gewicht
 * im Namen („Kornbrot 500g“), und ohne Grundpreis lassen sich 2,50 € für 500 g
 * und 4,40 € für 1000 g nicht vergleichen — genau das ist der Zweck der Norm.
 *
 * Die Mengeneinheit ist grundsätzlich 1 kg; bei Nennfüllmengen unter 250 g
 * darf und soll auf 100 g bezogen werden (§ 4 Abs. 1 Satz 2 PAngV).
 *
 * Das Gewicht steht heute nur im Produktnamen. Sobald `hq` ein eigenes
 * `weight`-Feld führt (das Template sieht es bereits vor), sollte
 * {@link parseWeightFromName} von dort gespeist werden statt aus dem Namen.
 */

/** Eine erkannte Nennfüllmenge. */
export interface ProductWeight {
  /** Nennfüllmenge in Gramm. */
  grams: number
}

/**
 * Liest die Nennfüllmenge aus einem Produktnamen.
 *
 * Erkennt „500g“, „1000 g“, „1kg“, „1,5 kg“. Gibt `null` zurück, wenn der Name
 * kein Gewicht trägt — dann gibt es keinen Grundpreis, und es darf auch keiner
 * erfunden werden.
 */
export function parseWeightFromName(name: string): ProductWeight | null {
  if (typeof name !== 'string') return null
  const match = name.match(/(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i)
  if (!match) return null

  const amount = Number(match[1].replace(',', '.'))
  if (!Number.isFinite(amount) || amount <= 0) return null

  const grams = match[2].toLowerCase() === 'kg' ? amount * 1000 : amount
  // Ein „1“ aus einem Namen wie „Kranzkuchen (1/4 Stück)“ ist kein Gewicht.
  if (grams < 20) return null
  return { grams }
}

/**
 * Der Grundpreis als Zahl plus die Bezugseinheit.
 *
 * @returns `null`, wenn Preis oder Gewicht unbrauchbar sind.
 */
export function unitPrice(
  price: number,
  grams: number
): { value: number; unit: 'kg' | '100 g' } | null {
  if (!Number.isFinite(price) || price <= 0) return null
  if (!Number.isFinite(grams) || grams <= 0) return null

  // Unter 250 g Nennfüllmenge ist 100 g die aussagekräftigere Bezugsgröße.
  if (grams < 250) {
    return { value: (price / grams) * 100, unit: '100 g' }
  }
  return { value: (price / grams) * 1000, unit: 'kg' }
}

/**
 * Fertige deutsche Beschriftung, z. B. `'5,00 € / kg'`.
 *
 * @returns `null`, wenn das Produkt keine Nennfüllmenge trägt — der Aufrufer
 * darf dann schlicht nichts anzeigen.
 */
export function unitPriceLabel(product: {
  name: string
  price: number
}): string | null {
  const weight = parseWeightFromName(product?.name ?? '')
  if (!weight) return null

  const result = unitPrice(product.price, weight.grams)
  if (!result) return null

  const formatted = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(result.value)

  return `${formatted} / ${result.unit}`
}
