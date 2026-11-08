/** Hilfen nur für Specs: Entwürfe ohne Reducer bauen. */
import type { PartybrezelConfig, SizeId } from '../config/partybrezel.config'
import { getSize } from './configLookup'
import type { OrderDraft, PretzelDraft } from './types'

let seq = 0

export function pretzel(
  config: PartybrezelConfig,
  size: SizeId,
  toppings: (string | null)[] | string | null = null
): PretzelDraft {
  const parts = getSize(config, size).partsPerPretzel
  seq += 1
  return {
    id: `t${seq}`,
    size,
    toppings: Array.isArray(toppings) ? toppings : Array(parts).fill(toppings),
  }
}

export function draft(overrides: Partial<OrderDraft> = {}): OrderDraft {
  return {
    pretzels: [],
    toppingMode: 'per-part',
    pickupDate: '2026-11-14',
    pickupTime: '',
    name: 'Erika Beispiel',
    phone: '',
    note: '',
    ...overrides,
  }
}
