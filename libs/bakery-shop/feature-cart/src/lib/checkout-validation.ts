/**
 * @fileoverview Client-side validation for the shop checkout form.
 * @module @bakery/shop/feature-cart/checkout-validation
 *
 * Pure functions, German messages. Kept out of the component so the rules are
 * unit-testable and so the component stays about layout.
 */

import { ProductCategory } from '@bakery/shared/types'

import {
  formatGermanDate,
  formatOpeningWindow,
  openingWindowFor,
  parseIsoDate,
  toIsoDate,
  weekdayNameFor,
} from './pickup'
import {
  earliestPickupIsoDate,
  leadTimeRuleForItems,
  type LeadTimeProduct,
} from './lead-time'

/** The raw form state, all strings (that is what inputs give us). */
export interface CheckoutFormValues {
  customerName: string
  phone: string
  email: string
  pickupDate: string
  pickupTime: string
  notes: string
}

/** One German message per invalid field. A field with no entry is valid. */
export type CheckoutFieldErrors = Partial<
  Record<keyof CheckoutFormValues, string>
>

/** Blank form state — also the reset value. */
export const EMPTY_CHECKOUT_FORM: CheckoutFormValues = {
  customerName: '',
  phone: '',
  email: '',
  pickupDate: '',
  pickupTime: '',
  notes: '',
}

/**
 * Field order used for "focus the first thing that is wrong" after a failed
 * submit. Matches the visual order of the form.
 */
export const CHECKOUT_FIELD_ORDER: ReadonlyArray<keyof CheckoutFormValues> = [
  'customerName',
  'phone',
  'pickupDate',
  'pickupTime',
  'email',
  'notes',
]

const MAX_NAME_LENGTH = 100
const MAX_NOTES_LENGTH = 500

/**
 * Deliberately permissive: German customers write `06841 / 12 34 56`,
 * `+49 (0)6841-123456` and `06841123456`, and all three are fine. We only
 * reject text that cannot be a phone number at all.
 */
const PHONE_ALLOWED_PATTERN = /^[\d\s+/().-]+$/
const MIN_PHONE_DIGITS = 6

/** Good enough for a form: something, `@`, something, a dot, a TLD. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateName(value: string): string | null {
  const name = value.trim()
  if (!name) return 'Bitte geben Sie Ihren Namen ein.'
  if (name.length < 2) return 'Bitte geben Sie Ihren vollständigen Namen ein.'
  if (name.length > MAX_NAME_LENGTH)
    return `Der Name darf höchstens ${MAX_NAME_LENGTH} Zeichen lang sein.`
  return null
}

export function validatePhone(value: string): string | null {
  const phone = value.trim()
  if (!phone) return 'Bitte geben Sie Ihre Telefonnummer ein.'
  if (!PHONE_ALLOWED_PATTERN.test(phone)) {
    return 'Bitte geben Sie eine gültige Telefonnummer ein.'
  }
  const digits = phone.replace(/\D/g, '')
  if (digits.length < MIN_PHONE_DIGITS) {
    return 'Bitte geben Sie eine gültige Telefonnummer ein.'
  }
  return null
}

/** Optional field: empty is valid, filled must look like an address. */
export function validateEmail(value: string): string | null {
  const email = value.trim()
  if (!email) return null
  if (!EMAIL_PATTERN.test(email)) {
    return 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
  }
  return null
}

/* -------------------------------------------------------------------------- */
/* Vorbestellfrist                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Die Vorbestellfrist, wie die Kasse sie braucht: ein konkretes Datum plus die
 * Begründung aus `lead-time.ts`.
 *
 * `null` heißt "keine Frist" — der Warenkorb enthält nichts, was vorbestellt
 * werden muss. Es gibt bewusst kein `{ hours: 0 }`-Objekt, damit die Oberfläche
 * nicht versehentlich einen leeren Hinweis rendert.
 */
export interface LeadTimeLimit {
  /** Frühestes **buchbares** Datum, `YYYY-MM-DD`. Nie ein Ruhetag. */
  earliestIso: string
  /** Deutscher Satz aus der Regel, z. B. „Ganze Torten backen wir auf Bestellung …". */
  reason: string
}

/**
 * Eine Warenkorbzeile, so wie `CartItem` sie wirklich mitbringt.
 *
 * **Achtung, hier lag die Falle:** `CartItem.id` ist die *numerische* Produkt-ID,
 * nicht der Slug — `leadTimeRuleFor()` erkennt Portionsstücke aber am Slug
 * (`…-1-stueck`). Und `CartItem.category` trägt den Anzeigenamen aus
 * `ProductCategory` (`'Torten'`), nicht den `hq`-Schlüssel (`'torten'`).
 * Beides ungeprüft durchzureichen hätte die Frist still abgeschaltet.
 */
export interface CartLeadTimeItem {
  id?: unknown
  slug?: unknown
  category?: unknown
}

/**
 * Anzeigename der Kategorie → `hq`-Schlüssel. Nur die beiden Kategorien mit
 * einer Frist stehen hier; alles andere fällt auf Kleinschreibung zurück und
 * trifft in `lead-time.ts` ohnehin auf keine Regel.
 */
const CART_CATEGORY_TO_HQ_KEY: Readonly<Record<string, string>> = {
  [ProductCategory.Cakes]: 'kuchen',
  [ProductCategory.SpecialCakes]: 'torten',
}

function hqCategoryKeyOf(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return CART_CATEGORY_TO_HQ_KEY[trimmed] ?? trimmed.toLowerCase()
}

/**
 * Bildet Warenkorbzeilen auf {@link LeadTimeProduct} ab.
 *
 * Fehlt der Slug (Altbestand aus dem `localStorage`, bevor es ihn gab), wird
 * die numerische ID als String eingesetzt. Sie matcht das Portions-Muster nicht,
 * eine ganze Torte bleibt damit eine ganze Torte — im Zweifel gilt also die
 * längere Frist. Andersherum hätten wir einen Termin zugesagt, den die Backstube
 * nicht halten kann.
 */
export function toLeadTimeItems(
  items: ReadonlyArray<CartLeadTimeItem>
): LeadTimeProduct[] {
  return (items ?? []).map((item) => {
    const slug = typeof item.slug === 'string' ? item.slug.trim() : ''
    const id =
      slug || (item.id === undefined || item.id === null ? '' : String(item.id))
    return { id, category: hqCategoryKeyOf(item.category) }
  })
}

/** So weit darf die Suche nach dem nächsten offenen Tag höchstens laufen. */
const MAX_LOOKAHEAD_DAYS = 14

/**
 * Das erste Datum ab `isoDate`, an dem die Bäckerei auch geöffnet hat.
 *
 * `earliestPickupIsoDate()` rechnet nur Tage dazu und kennt den Ruhetag nicht.
 * Ohne diesen Schritt könnte die Kasse „Frühester Termin: Montag" schreiben und
 * denselben Tag im nächsten Atemzug als Ruhetag ablehnen.
 */
export function earliestBookablePickupDate(isoDate: string): string {
  const start = parseIsoDate(isoDate)
  if (!start) return ''

  for (let offset = 0; offset <= MAX_LOOKAHEAD_DAYS; offset += 1) {
    const candidate = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + offset
    )
    const iso = toIsoDate(candidate)
    if (openingWindowFor(iso)) return iso
  }
  return isoDate
}

/**
 * Die bindende Frist für einen Warenkorb, fertig für die Anzeige.
 *
 * @param items die Warenkorbzeilen.
 * @param now Zeitpunkt der Bestellung — im Effect gelesen, nie im Render.
 * @returns `null`, wenn nichts im Korb vorbestellt werden muss.
 */
export function leadTimeLimitFor(
  items: ReadonlyArray<CartLeadTimeItem>,
  now: Date
): LeadTimeLimit | null {
  const mapped = toLeadTimeItems(items)
  const rule = leadTimeRuleForItems(mapped)
  if (rule.hours <= 0) return null

  const earliestIso = earliestBookablePickupDate(
    earliestPickupIsoDate(mapped, now)
  )
  if (!earliestIso) return null

  return { earliestIso, reason: rule.reason }
}

/**
 * Der Wert für `min` am Datumsfeld: das spätere von „heute" und der Frist.
 * Damit bietet der native Datepicker gar nicht erst an, was die Prüfung
 * anschließend ablehnen würde.
 */
export function minPickupIsoDate(
  todayIso: string,
  leadTime?: LeadTimeLimit | null
): string {
  const earliest = leadTime?.earliestIso ?? ''
  if (!todayIso) return earliest
  if (!earliest) return todayIso
  return earliest > todayIso ? earliest : todayIso
}

/**
 * @param value the `YYYY-MM-DD` from the date input.
 * @param todayIso today's local date; pass `''` while it is still unknown
 * (before mount) — the past check is then skipped, the rest still applies.
 * @param leadTime die Vorbestellfrist des Warenkorbs, falls es eine gibt.
 */
export function validatePickupDate(
  value: string,
  todayIso: string,
  leadTime?: LeadTimeLimit | null
): string | null {
  const pickupDate = value.trim()
  if (!pickupDate) return 'Bitte wählen Sie ein Abholdatum.'

  if (!parseIsoDate(pickupDate)) {
    return 'Bitte geben Sie ein gültiges Datum an.'
  }
  if (todayIso && pickupDate < todayIso) {
    return 'Das Abholdatum darf nicht in der Vergangenheit liegen.'
  }
  // Vor dem Ruhetag geprüft: wer eine Torte auf einen zu frühen Montag legt,
  // soll den Grund erfahren und ein Datum genannt bekommen, das wirklich geht —
  // sonst korrigiert er erst den Wochentag und läuft dann in die Frist.
  if (leadTime && leadTime.earliestIso && pickupDate < leadTime.earliestIso) {
    return `${leadTime.reason} Frühester Termin: ${formatGermanDate(
      leadTime.earliestIso
    )}.`
  }
  if (!openingWindowFor(pickupDate)) {
    return `${weekdayNameFor(
      pickupDate
    )} ist Ruhetag. Bitte wählen Sie einen anderen Tag.`
  }
  return null
}

/**
 * @param slots the slots actually available on the chosen day — pass the result
 * of `pickupTimeSlots()` for that date, already narrowed by today's
 * Vorlaufzeit where applicable.
 * @param dateIsValid when the date itself is already rejected, only presence is
 * checked so the customer is not shown two errors for one mistake.
 */
export function validatePickupTime(
  value: string,
  pickupDate: string,
  slots: ReadonlyArray<string>,
  dateIsValid: boolean
): string | null {
  const pickupTime = value.trim()
  if (!pickupTime) return 'Bitte wählen Sie eine Abholzeit.'
  if (!dateIsValid) return null

  if (slots.length === 0) {
    return 'Für diesen Tag können wir leider keine Abholung mehr anbieten. Bitte wählen Sie einen anderen Tag.'
  }
  if (!slots.includes(pickupTime)) {
    const window = openingWindowFor(pickupDate)
    const hours = window ? ` Geöffnet: ${formatOpeningWindow(window)}.` : ''
    return `Zu dieser Uhrzeit haben wir nicht geöffnet.${hours}`
  }
  return null
}

export function validateNotes(value: string): string | null {
  if (value.trim().length > MAX_NOTES_LENGTH) {
    return `Bitte fassen Sie sich etwas kürzer (höchstens ${MAX_NOTES_LENGTH} Zeichen).`
  }
  return null
}

/**
 * Validates the whole form.
 *
 * @param values current form state.
 * @param todayIso today's local date (`''` before mount).
 * @param slotsForDate slots available on `values.pickupDate`.
 * @param leadTime die Vorbestellfrist des Warenkorbs, falls es eine gibt.
 * @returns a message per invalid field; an empty object means "submit it".
 */
export function validateCheckout(
  values: CheckoutFormValues,
  todayIso: string,
  slotsForDate: ReadonlyArray<string>,
  leadTime?: LeadTimeLimit | null
): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {}

  const nameError = validateName(values.customerName)
  if (nameError) errors.customerName = nameError

  const phoneError = validatePhone(values.phone)
  if (phoneError) errors.phone = phoneError

  const emailError = validateEmail(values.email)
  if (emailError) errors.email = emailError

  const dateError = validatePickupDate(values.pickupDate, todayIso, leadTime)
  if (dateError) errors.pickupDate = dateError

  const timeError = validatePickupTime(
    values.pickupTime,
    values.pickupDate,
    slotsForDate,
    !dateError
  )
  if (timeError) errors.pickupTime = timeError

  const notesError = validateNotes(values.notes)
  if (notesError) errors.notes = notesError

  return errors
}

/** The first invalid field in form order, or `null` when everything is valid. */
export function firstInvalidField(
  errors: CheckoutFieldErrors
): keyof CheckoutFormValues | null {
  return CHECKOUT_FIELD_ORDER.find((field) => Boolean(errors[field])) ?? null
}

/* -------------------------------------------------------------------------- */
/* Formular über einen Seitenwechsel retten                                    */
/* -------------------------------------------------------------------------- */

/**
 * Schlüssel im `sessionStorage`.
 *
 * Bewusst `sessionStorage` und nicht `localStorage`: Name, Telefonnummer und
 * E-Mail sind personenbezogene Daten. Sie überleben den Weg „Ändern → Warenkorb
 * → zurück" und den Zurück-Button, aber nicht das Schließen des Tabs — und die
 * abgeschickte Bestellung räumt sie sofort weg.
 */
export const CHECKOUT_FORM_STORAGE_KEY = 'bakery-shop:checkout-form'

/**
 * Obergrenze je Feld beim Einlesen. Der Speicher ist vom Browser aus
 * beschreibbar; ohne Deckel könnte ein manipulierter Eintrag beliebig viel
 * Text in das Formular kippen.
 */
const STORED_FIELD_LIMITS: Record<keyof CheckoutFormValues, number> = {
  customerName: MAX_NAME_LENGTH,
  phone: 40,
  email: 254,
  pickupDate: 10,
  pickupTime: 5,
  notes: MAX_NOTES_LENGTH,
}

const STORED_FIELDS = Object.keys(STORED_FIELD_LIMITS) as ReadonlyArray<
  keyof CheckoutFormValues
>

/** Serialisiert genau die sechs bekannten Felder — nichts sonst. */
export function serializeCheckoutForm(values: CheckoutFormValues): string {
  const payload: Record<string, string> = {}
  for (const field of STORED_FIELDS) {
    const value = values[field]
    if (typeof value === 'string' && value !== '') payload[field] = value
  }
  return JSON.stringify(payload)
}

/**
 * Liest das gespeicherte Formular zurück.
 *
 * Alles Unbekannte fliegt raus, jedes Feld wird auf seine Länge gestutzt, und
 * ein Abholtermin, der inzwischen in der Vergangenheit oder auf dem Ruhetag
 * liegt, wird verworfen statt still stehen zu bleiben.
 *
 * @param raw der rohe Eintrag aus dem `sessionStorage`.
 * @param todayIso heutiges Datum; `''` überspringt die Datumsprüfung.
 * @returns `null`, wenn nichts Brauchbares gespeichert war.
 */
export function restoreCheckoutForm(
  raw: string | null | undefined,
  todayIso = ''
): CheckoutFormValues | null {
  if (typeof raw !== 'string' || raw === '') return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return null

  const source = parsed as Record<string, unknown>
  const values: CheckoutFormValues = { ...EMPTY_CHECKOUT_FORM }

  for (const field of STORED_FIELDS) {
    const value = source[field]
    if (typeof value !== 'string') continue
    values[field] = value.slice(0, STORED_FIELD_LIMITS[field])
  }

  // Ein abgelaufener Termin ist schlimmer als gar keiner: er sieht gültig aus.
  const dateStillUsable =
    values.pickupDate !== '' &&
    validatePickupDate(values.pickupDate, todayIso) === null
  if (!dateStillUsable) {
    values.pickupDate = ''
    values.pickupTime = ''
  }

  const hasSomething = STORED_FIELDS.some((field) => values[field] !== '')
  return hasSomething ? values : null
}
