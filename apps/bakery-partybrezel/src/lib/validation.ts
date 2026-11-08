import type {
  PartybrezelConfig,
  ToppingMode,
} from '../config/partybrezel.config'
import { findTopping, getSize } from './configLookup'
import type { OrderDraft, PretzelDraft } from './types'

export const MAX_NAME_LENGTH = 120
export const MIN_PHONE_DIGITS = 5
export const MAX_PHONE_LENGTH = 40
/** Wie die API (delivery-preorders.core.js): Anmerkung höchstens 500 Zeichen. */
export const API_MAX_NOTE_LENGTH = 500
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Steuerzeichen, Bidi-Steuerung, Null-Breiten- und BOM-Zeichen. Angelehnt an
 * control-chars.core.js der API; ZWJ (U+200D) bleibt für Emoji erlaubt.
 */
const CONTROL_CHARS =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b\u200c\u200e\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/
// In der Anmerkung sind Zeilenumbrüche erlaubt.
const NOTE_CONTROL_CHARS =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u061c\u200b\u200c\u200e\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/

export function validateName(name: string): string | null {
  const value = name.trim()
  if (!value) return 'Bitte geben Sie Ihren Namen an.'
  if (value.length > MAX_NAME_LENGTH)
    return `Der Name darf höchstens ${MAX_NAME_LENGTH} Zeichen lang sein.`
  if (CONTROL_CHARS.test(value))
    return 'Der Name enthält unzulässige Steuerzeichen.'
  return null
}

export function validatePhone(phone: string): string | null {
  const value = phone.trim()
  if (!value) return null
  if (value.length > MAX_PHONE_LENGTH) return 'Die Telefonnummer ist zu lang.'
  if (CONTROL_CHARS.test(value))
    return 'Die Telefonnummer enthält unzulässige Zeichen.'
  const digits = value.replace(/\D/g, '').length
  if (digits < MIN_PHONE_DIGITS)
    return `Bitte mindestens ${MIN_PHONE_DIGITS} Ziffern angeben oder das Feld leer lassen.`
  return null
}

export function validateNote(note: string, maxLength: number): string | null {
  if (note.trim().length > maxLength)
    return `Die Anmerkung darf höchstens ${maxLength} Zeichen lang sein.`
  if (NOTE_CONTROL_CHARS.test(note))
    return 'Die Anmerkung enthält unzulässige Steuerzeichen.'
  return null
}

export function validatePickupTime(time: string): string | null {
  const value = time.trim()
  if (!value) return null
  if (!TIME_PATTERN.test(value))
    return 'Bitte die Uhrzeit als HH:MM angeben (z. B. 10:30).'
  return null
}

export function validatePickupDate(
  date: string | null,
  allowedDates: string[]
): string | null {
  if (!date) return 'Bitte wählen Sie einen Abholtag.'
  if (!allowedDates.includes(date))
    return 'Dieser Abholtag ist nicht (mehr) wählbar - bitte einen anderen Tag wählen.'
  return null
}

export function validatePretzelCount(
  pretzels: PretzelDraft[],
  config: PartybrezelConfig
): string | null {
  if (pretzels.length < 1) return 'Bitte wählen Sie mindestens eine Brezel.'
  if (pretzels.length > config.maxPretzelsPerOrder)
    return `Höchstens ${config.maxPretzelsPerOrder} Brezeln je Bestellung.`
  return null
}

export interface MissingTopping {
  pretzelId: string
  /** 1-basierte Brezel-Nummer. */
  index: number
  /** 0-basierte Teile ohne (eindeutigen) Belag. */
  parts: number[]
  /** Im Modus "eine Sorte je Brezel": Teile sind unterschiedlich belegt. */
  mixed: boolean
}

/**
 * Jedes Teil (Modus per-part) bzw. jede Brezel (Modus per-pretzel) braucht
 * einen bekannten Belag. Im Modus per-pretzel zählt eine Brezel mit
 * unterschiedlich belegten Teilen als offen - sie wird nicht still auf eine
 * Sorte gesetzt.
 */
export function findMissingToppings(
  pretzels: PretzelDraft[],
  mode: ToppingMode,
  config: PartybrezelConfig
): MissingTopping[] {
  const missing: MissingTopping[] = []
  pretzels.forEach((pretzel, i) => {
    const size = getSize(config, pretzel.size)
    const parts: number[] = []
    for (let part = 0; part < size.partsPerPretzel; part += 1) {
      if (!findTopping(config, pretzel.toppings[part])) parts.push(part)
    }
    const known = pretzel.toppings.slice(0, size.partsPerPretzel)
    const mixed =
      mode === 'per-pretzel' && parts.length === 0 && new Set(known).size > 1
    if (parts.length > 0 || mixed) {
      missing.push({ pretzelId: pretzel.id, index: i + 1, parts, mixed })
    }
  })
  return missing
}

export function validateToppings(
  pretzels: PretzelDraft[],
  mode: ToppingMode,
  config: PartybrezelConfig
): string | null {
  const missing = findMissingToppings(pretzels, mode, config)
  if (missing.length === 0) return null
  const numbers = missing.map((m) => m.index).join(', ')
  if (mode === 'per-pretzel')
    return `Bitte für jede Brezel eine Sorte wählen (offen: Brezel ${numbers}).`
  return `Bitte jedes Teil belegen (offen: Brezel ${numbers}).`
}

export type OrderField =
  | 'pretzels'
  | 'toppings'
  | 'pickupDate'
  | 'pickupTime'
  | 'name'
  | 'phone'
  | 'note'

export type FieldErrors = Partial<Record<OrderField, string>>

/** Welche Felder zu welchem Schritt gehören (0-basiert). */
export const STEP_FIELDS: OrderField[][] = [
  ['pretzels'],
  ['toppings'],
  ['pickupDate', 'pickupTime', 'name', 'phone', 'note'],
  [],
]

export interface OrderValidation {
  valid: boolean
  errors: FieldErrors
}

export function validateOrder(
  draft: OrderDraft,
  config: PartybrezelConfig,
  allowedDates: string[]
): OrderValidation {
  const candidates: [OrderField, string | null][] = [
    ['pretzels', validatePretzelCount(draft.pretzels, config)],
    ['toppings', validateToppings(draft.pretzels, draft.toppingMode, config)],
    ['pickupDate', validatePickupDate(draft.pickupDate, allowedDates)],
    ['pickupTime', validatePickupTime(draft.pickupTime)],
    ['name', validateName(draft.name)],
    ['phone', validatePhone(draft.phone)],
    ['note', validateNote(draft.note, config.maxCustomerNoteLength)],
  ]
  const errors: FieldErrors = {}
  for (const [field, message] of candidates) {
    if (message) errors[field] = message
  }
  return { valid: Object.keys(errors).length === 0, errors }
}

export function stepErrors(errors: FieldErrors, step: number): string[] {
  return (STEP_FIELDS[step] ?? [])
    .map((field) => errors[field])
    .filter((m): m is string => Boolean(m))
}
