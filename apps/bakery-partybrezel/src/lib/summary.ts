import type { PartybrezelConfig, SizeId } from '../config/partybrezel.config'
import { findTopping, getSize } from './configLookup'
import type { PretzelDraft } from './types'

export interface DoughBySize {
  sizeId: SizeId
  label: string
  pretzels: number
  parts: number
  gramsPerPart: number
  grams: number
}

export interface DoughSummary {
  bySize: DoughBySize[]
  totalParts: number
  totalGrams: number
}

/** Teile und Teig (g) je Größe - der Hinweis "für die Backstube". */
export function doughSummary(
  pretzels: PretzelDraft[],
  config: PartybrezelConfig
): DoughSummary {
  const bySize = config.sizes
    .map((size) => {
      const count = pretzels.filter((p) => p.size === size.id).length
      const parts = count * size.partsPerPretzel
      return {
        sizeId: size.id,
        label: size.label,
        pretzels: count,
        parts,
        gramsPerPart: size.gramsPerPart,
        grams: parts * size.gramsPerPart,
      }
    })
    .filter((row) => row.pretzels > 0)
  return {
    bySize,
    totalParts: bySize.reduce((s, r) => s + r.parts, 0),
    totalGrams: bySize.reduce((s, r) => s + r.grams, 0),
  }
}

export interface ToppingCount {
  toppingId: string
  label: string
  parts: number
}

/** Belegte Teile je Belag (Reihenfolge der Config). */
export function toppingCounts(
  pretzels: PretzelDraft[],
  config: PartybrezelConfig
): ToppingCount[] {
  const counts = new Map<string, number>()
  for (const pretzel of pretzels) {
    const size = getSize(config, pretzel.size)
    for (let part = 0; part < size.partsPerPretzel; part += 1) {
      const topping = findTopping(config, pretzel.toppings[part])
      if (topping) counts.set(topping.id, (counts.get(topping.id) ?? 0) + 1)
    }
  }
  return config.toppings
    .filter((t) => counts.has(t.id))
    .map((t) => ({
      toppingId: t.id,
      label: t.label,
      parts: counts.get(t.id) ?? 0,
    }))
}
