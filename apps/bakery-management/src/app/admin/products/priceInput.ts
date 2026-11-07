/**
 * Preisfeld der Produktmaske: deutsch anzeigen, deutsch und englisch lesen.
 *
 * Vorher war das Feld `type="number"` mit dem JS-Wert als Text: im Formular
 * stand „2.5“ statt „2,50“, und wer „2,50“ tippte, bekam je nach Browser ein
 * leeres Feld (Chrome nimmt im Zahlenfeld kein Komma) und die Meldung
 * „ungültiger Preis“ - oder `parseFloat('2,50')` = 2 €.
 */

/** Höchstpreis wie in der API (`product-input.core.js`). */
export const MAX_PRODUCT_PRICE = 10000

/** `2.5` → `"2,50"` (ohne Tausenderpunkt, damit das Feld editierbar bleibt). */
export function formatPriceInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return ''
  return value.toFixed(2).replace('.', ',')
}

/**
 * `"2,50"`, `"2.5"`, `"2,50 €"`, `"1.234,50"` → Zahl; `null`, wenn es kein
 * Preis mit höchstens zwei Nachkommastellen zwischen 0 und 10.000 € ist.
 */
export function parsePriceInput(raw: string): number | null {
  let text = raw.replace(/€/g, '').replace(/\s/g, '')
  if (!text) return null
  if (text.includes(',')) {
    // Deutsch: Punkt nur als Tausendertrenner (1.234,50).
    if (!/^\d{1,3}(\.\d{3})*(,\d{0,2})?$|^\d+(,\d{0,2})?$/.test(text)) {
      return null
    }
    text = text.replace(/\./g, '').replace(',', '.')
  } else if (!/^\d+(\.\d{0,2})?$/.test(text)) {
    return null
  }
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0 || value > MAX_PRODUCT_PRICE) {
    return null
  }
  return Math.round(value * 100) / 100
}

export const PRICE_INPUT_ERROR =
  'Bitte einen gültigen Preis angeben, z. B. 2,50 (höchstens 10.000 €).'
