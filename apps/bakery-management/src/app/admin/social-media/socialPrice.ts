/**
 * Preis-Text der Social-Media-Grafik (Vorschau und PNG).
 *
 * Vorher hing beides stur ein „€“ an die Eingabe: „3,50“ wurde „3,50€“
 * (ohne Leerzeichen), „3,50 €“ wurde „3,50 €€“ und der Aktions-Platzhalter
 * „Sparen Sie 30%“ wurde „Sparen Sie 30%€“.
 *
 * - reine Beträge („3,50“, „3.5“, „12,90 €“, „€ 2“) → „3,50 €“
 * - Freitext („Sparen Sie 30%“, „ab 2,50 €“, „3 für 2“) bleibt, wie er ist
 */
export function formatSocialPrice(raw: string): string {
  const text = raw.trim().replace(/\s+/g, ' ')
  if (!text) return ''
  const amount = text.replace(/€/g, '').trim()
  if (!/^\d{1,6}(?:[.,]\d{1,2})?$/.test(amount)) return text
  const [euros, cents = ''] = amount.split(/[.,]/)
  const centsText = cents ? `,${cents.padEnd(2, '0')}` : ''
  return `${euros}${centsText} €`
}
