import type {
  PartybrezelConfig,
  ToppingMode,
} from '../config/partybrezel.config'
import { findTopping, getSize } from './configLookup'
import { API_MAX_NOTE_LENGTH, composeNote, describePretzels } from './note'
import type { OrderDraft, PretzelDraft } from './types'

export const MAX_NAME_LENGTH = 120
export const MIN_PHONE_DIGITS = 5
export const MAX_PHONE_LENGTH = 40
export { API_MAX_NOTE_LENGTH }
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/*
 * Steuer- und unsichtbare Zeichen - dieselbe Regel wie die API
 * (apps/bakery-api/src/services/control-chars.core.js, kopiert, weil die App
 * an keiner Lib und an keiner App hängt). Wer dort etwas ändert, zieht es
 * hier nach; sonst zeigt die Vorschau einen Body als gültig, den der echte
 * Endpunkt mit 400 ablehnt.
 *
 * - C0/C1 und DEL; im Freitext (Anmerkung) bleiben Tab, Zeilenumbruch und
 *   Wagenrücklauf erlaubt.
 * - Formatzeichen (\p{Cf}: Bidi, weiches Trennzeichen, Null-Breite, BOM, …),
 *   Default-Ignorables (Hangul-Füller, Variantenselektoren, U+180E …),
 *   U+2028/U+2029 und U+FFFC. Erlaubt bleiben die Darstellungsselektoren
 *   U+FE0E/U+FE0F und ein ZWJ zwischen zwei Emoji (👨‍🍳).
 * - Mehr als vier Kombinationszeichen am Stück („Zalgo“).
 *
 * Ohne Lookbehind (anders als die API), damit ältere Safari-Versionen die
 * Seite noch laden.
 */
const ALLOWED_INVISIBLE = new Set(['\ufe0e', '\ufe0f'])
const INVISIBLE = new RegExp(
  '[\\p{Cf}\\p{Default_Ignorable_Code_Point}\\u2028\\u2029\\ufffc]',
  'gu'
)
const STACKED_MARKS = new RegExp('\\p{M}{5,}', 'u')
/** ZWJ einer Emoji-Sequenz: Emoji (+ Selektor/Hautton) ZWJ Emoji. */
const EMOJI_ZWJ = new RegExp(
  '(\\p{Extended_Pictographic}[\\ufe0e\\ufe0f\\p{Emoji_Modifier}]*)\\u200d(?=\\p{Extended_Pictographic})',
  'gu'
)
// Alternation statt Klasse: Selektoren in einer Klasse hält ESLint für
// zusammengesetzte Zeichen (no-misleading-character-class).
const JOINERS = /\u200d|\ufe0e|\ufe0f/gu
// eslint-disable-next-line no-control-regex
const NAME_ASCII_CONTROL = /[\u0000-\u001f\u007f-\u009f]/
const TEXT_ASCII_CONTROL =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/

function hasInvisible(value: string): boolean {
  for (const m of value.replace(EMOJI_ZWJ, '$1').matchAll(INVISIBLE)) {
    if (!ALLOWED_INVISIBLE.has(m[0])) return true
  }
  return false
}

function hasStackedMarks(value: string): boolean {
  return STACKED_MARKS.test(value.replace(JOINERS, ''))
}

/** `true`, wenn ein einzeiliger Text (Name, Telefon) unzulässige Zeichen enthält. */
export function hasNameControlChars(value: string): boolean {
  return (
    NAME_ASCII_CONTROL.test(value) ||
    hasInvisible(value) ||
    hasStackedMarks(value)
  )
}

/** `true`, wenn ein Freitext (Anmerkung) unzulässige Zeichen enthält. */
export function hasTextControlChars(value: string): boolean {
  return (
    TEXT_ASCII_CONTROL.test(value) ||
    hasInvisible(value) ||
    hasStackedMarks(value)
  )
}

export function validateName(name: string): string | null {
  const value = name.trim()
  if (!value) return 'Bitte geben Sie Ihren Namen an.'
  if (value.length > MAX_NAME_LENGTH)
    return `Der Name darf höchstens ${MAX_NAME_LENGTH} Zeichen lang sein.`
  if (hasNameControlChars(value))
    return 'Der Name enthält unzulässige Steuerzeichen.'
  return null
}

export function validatePhone(phone: string): string | null {
  const value = phone.trim()
  if (!value) return null
  if (value.length > MAX_PHONE_LENGTH) return 'Die Telefonnummer ist zu lang.'
  if (hasNameControlChars(value))
    return 'Die Telefonnummer enthält unzulässige Zeichen.'
  const digits = value.replace(/\D/g, '').length
  if (digits < MIN_PHONE_DIGITS)
    return `Bitte geben Sie mindestens ${MIN_PHONE_DIGITS} Ziffern an oder lassen Sie das Feld leer.`
  return null
}

export function validateNote(note: string, maxLength: number): string | null {
  if (note.trim().length > maxLength)
    return `Die Anmerkung darf höchstens ${maxLength} Zeichen lang sein.`
  if (hasTextControlChars(note))
    return 'Die Anmerkung enthält unzulässige Steuerzeichen.'
  return null
}

export function validatePickupTime(time: string): string | null {
  const value = time.trim()
  if (!value) return null
  if (!TIME_PATTERN.test(value))
    return 'Bitte geben Sie die Uhrzeit als HH:MM an (z. B. 10:30).'
  return null
}

export function validatePickupDate(
  date: string | null,
  allowedDates: string[]
): string | null {
  if (!date) return 'Bitte wählen Sie einen Abholtag.'
  if (!allowedDates.includes(date))
    return 'Dieser Abholtag ist nicht (mehr) wählbar – bitte wählen Sie einen anderen Tag.'
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
  /** Im Modus "ein Belag je Brezel": Teile sind unterschiedlich belegt. */
  mixed: boolean
}

/**
 * Jedes Teil (Modus per-part) bzw. jede Brezel (Modus per-pretzel) braucht
 * einen bekannten Belag. Im Modus per-pretzel zählt eine Brezel mit
 * unterschiedlich belegten Teilen als offen - sie wird nicht still auf einen
 * Belag gesetzt.
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
    return `Bitte wählen Sie für jede Brezel einen Belag (offen: Brezel ${numbers}).`
  return `Bitte belegen Sie jedes Teil (offen: Brezel ${numbers}).`
}

export interface NoteFit {
  /** Fehler am Schritt Belag: schon die Belagsliste ist zu lang. */
  toppings: string | null
  /** Fehler an der Anmerkung: erst mit dem Text der Kundschaft zu lang. */
  note: string | null
}

/**
 * Die API nimmt höchstens 500 Zeichen für die GANZE Anmerkung - Belagsliste
 * und Text der Kundschaft zusammen. Statt in der Vorschau zu kürzen (dabei
 * ginge in Abbildung B die Zuordnung Teil → Brezel verloren), wird es hier
 * abgelehnt: zu viele verschieden belegte Brezeln am Schritt Belag, eine zu
 * lange Anmerkung an ihrem Feld.
 */
export function validateNoteFits(
  draft: OrderDraft,
  config: PartybrezelConfig
): NoteFit {
  const description = describePretzels(
    draft.pretzels,
    draft.toppingMode,
    config
  )
  const listOnly = composeNote(description, '')
  if (listOnly.fullLength > API_MAX_NOTE_LENGTH)
    return {
      toppings: `So viele verschieden belegte Brezeln passen nicht in eine Vorbestellung (Belagsliste ${listOnly.fullLength} von höchstens ${API_MAX_NOTE_LENGTH} Zeichen). Bitte belegen Sie mehr Brezeln gleich oder teilen Sie die Bestellung auf.`,
      note: null,
    }
  const full = composeNote(description, draft.note)
  if (full.fullLength > API_MAX_NOTE_LENGTH)
    return {
      toppings: null,
      note: `Zusammen mit der Belagsliste ist die Anmerkung zu lang (${
        full.fullLength
      } von höchstens ${API_MAX_NOTE_LENGTH} Zeichen). Bitte kürzen Sie Ihre Anmerkung um ${
        full.fullLength - API_MAX_NOTE_LENGTH
      } Zeichen.`,
    }
  return { toppings: null, note: null }
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
  const toppings = validateToppings(draft.pretzels, draft.toppingMode, config)
  const note = validateNote(draft.note, config.maxCustomerNoteLength)
  const fit = validateNoteFits(draft, config)
  const candidates: [OrderField, string | null][] = [
    ['pretzels', validatePretzelCount(draft.pretzels, config)],
    ['toppings', toppings ?? fit.toppings],
    ['pickupDate', validatePickupDate(draft.pickupDate, allowedDates)],
    ['pickupTime', validatePickupTime(draft.pickupTime)],
    ['name', validateName(draft.name)],
    ['phone', validatePhone(draft.phone)],
    ['note', note ?? fit.note],
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

/**
 * Erster Schritt vor `before` (0-basiert), der Fehler hat, sonst -1. Auf der
 * Übersicht heißt ein Treffer: die Zusammenstellung ist nachträglich
 * ungültig geworden (z. B. Belag-Modus in den Prototyp-Einstellungen
 * umgestellt).
 */
export function firstInvalidStep(errors: FieldErrors, before: number): number {
  for (let i = 0; i < before; i += 1) {
    if (stepErrors(errors, i).length > 0) return i
  }
  return -1
}

/**
 * Der Schritt, auf dem ein wiederhergestellter Entwurf weitergeht: der
 * gemerkte, höchstens aber der erste noch offene davor (z. B. ein inzwischen
 * abgelaufener Abholtag).
 */
export function resumeStep(errors: FieldErrors, wanted: number): number {
  const last = STEP_FIELDS.length - 1
  const target = Math.min(Math.max(0, Math.trunc(wanted) || 0), last)
  const blocked = firstInvalidStep(errors, target)
  return blocked >= 0 ? blocked : target
}
