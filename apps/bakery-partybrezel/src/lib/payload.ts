/**
 * Vorschau einer Vorbestellung für `POST /api/preorders` (Vertrag B7).
 * Nichts davon wird gesendet - der Prototyp zeigt nur, wie der Body aussähe.
 *
 * Bewusst OHNE Preisfelder: der Server übernimmt den Preis als Snapshot aus
 * hq. Aufpreise für Beläge lassen sich über diesen Endpunkt heute nicht
 * abbilden.
 */
import type { PartybrezelConfig } from '../config/partybrezel.config'
import {
  MAX_VARIANT_LENGTH,
  VARIANT_PATTERN,
  findTopping,
  getSize,
} from './configLookup'
import { pluralize } from './format'
import {
  API_MAX_NOTE_LENGTH,
  composeNote,
  describePretzels,
  type ComposedNote,
} from './note'
import type { OrderDraft } from './types'

export { composeNote, describePretzels, type ComposedNote } from './note'

export const API_LIMITS = {
  maxItems: 50,
  maxQuantity: 99,
  maxNoteLength: API_MAX_NOTE_LENGTH,
  maxVariantLength: MAX_VARIANT_LENGTH,
} as const

export interface PreorderItemPayload {
  productId: string
  variant?: string
  quantity: number
}

export interface PreorderCreatePayload {
  channel: 'shop'
  customerName: string
  customerPhone?: string
  pickupDate: string
  pickupTime?: string
  items: PreorderItemPayload[]
  note?: string
}

export type PayloadMapping = 'A' | 'B'

export type PayloadWarningCode =
  | 'note_truncated'
  | 'too_many_items'
  | 'quantity_too_large'
  | 'invalid_variant'
  | 'untopped_parts'
  | 'missing_pickup_date'
  | 'no_items'

export interface PayloadWarning {
  code: PayloadWarningCode
  message: string
}

export interface PayloadResult {
  payload: PreorderCreatePayload
  warnings: PayloadWarning[]
}

export const MAPPING_LABELS: Record<PayloadMapping, string> = {
  A: 'A: Produkt je Größe',
  B: 'B: Teile mit Sorte',
}

/**
 * Fasst Zeilen mit gleichem productId + variant zusammen (wie der Server es
 * auch täte) und lässt Mengen ≤ 0 weg. Reihenfolge: erstes Auftreten.
 */
export function mergeItems(
  items: PreorderItemPayload[]
): PreorderItemPayload[] {
  const merged = new Map<string, PreorderItemPayload>()
  for (const item of items) {
    if (!(item.quantity > 0)) continue
    const key = `${item.productId}|${item.variant ?? ''}`
    const existing = merged.get(key)
    if (existing) existing.quantity += item.quantity
    else merged.set(key, { ...item })
  }
  return [...merged.values()]
}

function basePayload(
  draft: OrderDraft,
  items: PreorderItemPayload[],
  note: string,
  warnings: PayloadWarning[]
): PreorderCreatePayload {
  const payload: PreorderCreatePayload = {
    channel: 'shop',
    customerName: draft.name.trim(),
    pickupDate: draft.pickupDate ?? '',
    items,
  }
  const phone = draft.phone.trim()
  if (phone) payload.customerPhone = phone
  const time = draft.pickupTime.trim()
  if (time) payload.pickupTime = time
  if (note) payload.note = note
  if (!draft.pickupDate)
    warnings.push({
      code: 'missing_pickup_date',
      message: 'Es ist noch kein Abholtag gewählt.',
    })
  return payload
}

function limitWarnings(
  items: PreorderItemPayload[],
  noteInfo: ComposedNote,
  warnings: PayloadWarning[]
) {
  if (items.length === 0)
    warnings.push({ code: 'no_items', message: 'Die Bestellung ist leer.' })
  if (items.length > API_LIMITS.maxItems)
    warnings.push({
      code: 'too_many_items',
      message: `${items.length} Positionen – die API nimmt höchstens ${API_LIMITS.maxItems}.`,
    })
  for (const item of items) {
    if (item.quantity > API_LIMITS.maxQuantity)
      warnings.push({
        code: 'quantity_too_large',
        message: `${item.productId}${
          item.variant ? ` (${item.variant})` : ''
        }: Menge ${item.quantity} – die API nimmt höchstens ${
          API_LIMITS.maxQuantity
        } je Position.`,
      })
  }
  if (noteInfo.truncated)
    warnings.push({
      code: 'note_truncated',
      message: `Die Anmerkung wäre ${noteInfo.fullLength} Zeichen lang; die API nimmt höchstens ${API_LIMITS.maxNoteLength}. Sie wurde gekürzt – dabei ginge ein Teil der Belagsliste oder Ihrer Anmerkung verloren.`,
    })
}

function untoppedWarning(
  draft: OrderDraft,
  config: PartybrezelConfig,
  warnings: PayloadWarning[],
  suffix = ''
) {
  const untopped = draft.pretzels.reduce((sum, p) => {
    const size = getSize(config, p.size)
    let n = 0
    for (let part = 0; part < size.partsPerPretzel; part += 1)
      if (!findTopping(config, p.toppings[part])) n += 1
    return sum + n
  }, 0)
  if (untopped > 0)
    warnings.push({
      code: 'untopped_parts',
      message: `${pluralize(untopped, 'Teil', 'Teile')} ohne Belag.${suffix}`,
    })
  return untopped
}

/**
 * Abbildung A "Produkt je Größe": eine Zeile je Größe (Menge = Brezeln), die
 * Beläge stehen nur in der Anmerkung. Einfach, passt zur Zählung "ganze
 * Brezel" (Q-P1), aber die Backstube muss die Beläge aus Freitext lesen.
 */
export function buildPayloadA(
  draft: OrderDraft,
  config: PartybrezelConfig
): PayloadResult {
  const warnings: PayloadWarning[] = []
  const items = mergeItems(
    draft.pretzels.map((p) => ({
      productId: config.productIds.pretzelBySize[p.size],
      quantity: 1,
    }))
  )
  untoppedWarning(draft, config, warnings)
  const noteInfo = composeNote(
    describePretzels(draft.pretzels, draft.toppingMode, config),
    draft.note
  )
  limitWarnings(items, noteInfo, warnings)
  return {
    payload: basePayload(draft, items, noteInfo.note, warnings),
    warnings,
  }
}

/**
 * Abbildung B "Teile mit Sorte": eine Zeile je Größe × Belag, Menge = Teile,
 * `variant` = Belag-ID. Die Backstube kann so Flitteig-Teile (in g) und
 * Beläge zählen wie andere Sorten (Backzettel); welche Teile zu einer Brezel
 * gehören, steht weiter in der Anmerkung.
 */
export function buildPayloadB(
  draft: OrderDraft,
  config: PartybrezelConfig
): PayloadResult {
  const warnings: PayloadWarning[] = []
  const raw: PreorderItemPayload[] = []
  for (const pretzel of draft.pretzels) {
    const size = getSize(config, pretzel.size)
    for (let part = 0; part < size.partsPerPretzel; part += 1) {
      const topping = findTopping(config, pretzel.toppings[part])
      if (!topping) continue // als Warnung gemeldet, nicht als Zeile ohne Sorte
      raw.push({
        productId: config.productIds.partBySize[pretzel.size],
        variant: topping.id,
        quantity: 1,
      })
    }
  }
  const items = mergeItems(raw)
  for (const item of items) {
    const variant = item.variant ?? ''
    if (
      !VARIANT_PATTERN.test(variant) ||
      variant.length > API_LIMITS.maxVariantLength
    )
      warnings.push({
        code: 'invalid_variant',
        message: `„${variant}“ ist kein gültiger Sorten-Slug (a-z, 0-9, Bindestrich, höchstens ${API_LIMITS.maxVariantLength} Zeichen).`,
      })
  }
  untoppedWarning(
    draft,
    config,
    warnings,
    ' In Abbildung B fehlen diese Teile in den Positionen.'
  )
  const noteInfo = composeNote(
    describePretzels(draft.pretzels, draft.toppingMode, config),
    draft.note
  )
  limitWarnings(items, noteInfo, warnings)
  return {
    payload: basePayload(draft, items, noteInfo.note, warnings),
    warnings,
  }
}

export function buildPayload(
  mapping: PayloadMapping,
  draft: OrderDraft,
  config: PartybrezelConfig
): PayloadResult {
  return mapping === 'A'
    ? buildPayloadA(draft, config)
    : buildPayloadB(draft, config)
}
