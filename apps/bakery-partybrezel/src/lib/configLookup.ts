import type {
  PartybrezelConfig,
  SizeConfig,
  SizeId,
  ToppingConfig,
} from '../config/partybrezel.config'

export function getSize(config: PartybrezelConfig, id: SizeId): SizeConfig {
  const size = config.sizes.find((s) => s.id === id)
  if (!size) throw new Error(`Unbekannte Größe: ${id}`)
  return size
}

export function findTopping(
  config: PartybrezelConfig,
  id: string | null | undefined
): ToppingConfig | undefined {
  if (!id) return undefined
  return config.toppings.find((t) => t.id === id)
}

/** Variant-Slug wie in der API (delivery-preorders.core.js). */
export const VARIANT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const MAX_VARIANT_LENGTH = 64

/**
 * Prüft die Config selbst - ein Tippfehler in einem Platzhalter soll im Test
 * auffallen, nicht erst in der Payload-Vorschau.
 */
export function checkConfig(config: PartybrezelConfig): string[] {
  const issues: string[] = []
  const sizeIds = new Set<string>()
  for (const size of config.sizes) {
    if (sizeIds.has(size.id)) issues.push(`Größe doppelt: ${size.id}`)
    sizeIds.add(size.id)
    if (!Number.isInteger(size.partsPerPretzel) || size.partsPerPretzel < 1)
      issues.push(`${size.id}: partsPerPretzel muss eine ganze Zahl ≥ 1 sein`)
    if (!Number.isInteger(size.gramsPerPart) || size.gramsPerPart <= 0)
      issues.push(`${size.id}: gramsPerPart muss > 0 sein`)
    if (!Number.isInteger(size.basePriceCents) || size.basePriceCents < 0)
      issues.push(`${size.id}: basePriceCents muss ganzzahlig ≥ 0 sein`)
    if (!config.productIds.pretzelBySize[size.id])
      issues.push(`${size.id}: keine Produkt-ID (Abbildung A)`)
    if (!config.productIds.partBySize[size.id])
      issues.push(`${size.id}: keine Teil-Produkt-ID (Abbildung B)`)
  }
  const toppingIds = new Set<string>()
  for (const topping of config.toppings) {
    if (toppingIds.has(topping.id)) issues.push(`Belag doppelt: ${topping.id}`)
    toppingIds.add(topping.id)
    if (
      !VARIANT_PATTERN.test(topping.id) ||
      topping.id.length > MAX_VARIANT_LENGTH
    )
      issues.push(`Belag-ID ist kein gültiger Sorten-Slug: ${topping.id}`)
    if (
      !Number.isInteger(topping.surchargePerPartCents) ||
      topping.surchargePerPartCents < 0
    )
      issues.push(`${topping.id}: Aufpreis muss ganzzahlig ≥ 0 sein`)
  }
  if (config.toppings.length === 0) issues.push('Keine Beläge konfiguriert')
  if (
    config.availableWeekdays.some((d) => !Number.isInteger(d) || d < 1 || d > 7)
  )
    issues.push('availableWeekdays nur 1 (Mo) bis 7 (So)')
  if (config.availableWeekdays.includes(1))
    issues.push('Montag ist Ruhetag und wird nie angeboten')
  if (!Number.isInteger(config.leadTimeDays) || config.leadTimeDays < 0)
    issues.push('leadTimeDays muss ganzzahlig ≥ 0 sein')
  if (
    !Number.isInteger(config.maxPretzelsPerOrder) ||
    config.maxPretzelsPerOrder < 1
  )
    issues.push('maxPretzelsPerOrder muss ≥ 1 sein')
  return issues
}
