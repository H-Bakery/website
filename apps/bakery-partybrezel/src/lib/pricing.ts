import type { PartybrezelConfig, SizeId } from '../config/partybrezel.config'
import { findTopping, getSize } from './configLookup'
import type { PretzelDraft } from './types'

export interface SurchargeLine {
  toppingId: string
  label: string
  parts: number
  centsPerPart: number
  cents: number
}

export interface PretzelPriceLine {
  pretzelId: string
  /** 1-basiert, wie in der Oberfläche ("Brezel 1"). */
  index: number
  sizeId: SizeId
  sizeLabel: string
  baseCents: number
  surcharges: SurchargeLine[]
  /** Teile ohne Belag (kosten keinen Aufpreis, sind aber noch offen). */
  untoppedParts: number
  totalCents: number
}

export interface PriceBreakdown {
  lines: PretzelPriceLine[]
  totalCents: number
}

/**
 * Preis je Brezel = Grundpreis der Größe + Σ Aufpreis je belegtem Teil.
 * Alles in ganzen Cent; formatiert wird erst in der Oberfläche.
 * Der Belag-Modus spielt keine Rolle: "eine Sorte je Brezel" belegt alle Teile.
 */
export function pretzelPrice(
  pretzel: PretzelDraft,
  index: number,
  config: PartybrezelConfig
): PretzelPriceLine {
  const size = getSize(config, pretzel.size)
  const partsByTopping = new Map<string, number>()
  let untoppedParts = 0
  for (let part = 0; part < size.partsPerPretzel; part += 1) {
    const topping = findTopping(config, pretzel.toppings[part])
    if (!topping) {
      untoppedParts += 1
      continue
    }
    partsByTopping.set(topping.id, (partsByTopping.get(topping.id) ?? 0) + 1)
  }
  // Reihenfolge wie in der Config, damit die Aufstellung stabil ist.
  const surcharges: SurchargeLine[] = config.toppings
    .filter((t) => partsByTopping.has(t.id))
    .map((t) => {
      const parts = partsByTopping.get(t.id) ?? 0
      return {
        toppingId: t.id,
        label: t.label,
        parts,
        centsPerPart: t.surchargePerPartCents,
        cents: parts * t.surchargePerPartCents,
      }
    })
  const totalCents =
    size.basePriceCents + surcharges.reduce((sum, s) => sum + s.cents, 0)
  return {
    pretzelId: pretzel.id,
    index,
    sizeId: size.id,
    sizeLabel: size.label,
    baseCents: size.basePriceCents,
    surcharges,
    untoppedParts,
    totalCents,
  }
}

export function priceBreakdown(
  pretzels: PretzelDraft[],
  config: PartybrezelConfig
): PriceBreakdown {
  const lines = pretzels.map((p, i) => pretzelPrice(p, i + 1, config))
  return {
    lines,
    totalCents: lines.reduce((sum, line) => sum + line.totalCents, 0),
  }
}
