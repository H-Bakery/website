/**
 * Typen und Anzeigehilfen für die Vorbestellungen auf der echten API
 * (`/api/preorders`, B7; Bildschirme P1-P3, roadmap §6 M1).
 *
 * Bewusst frei von `fs`/`path` und ohne API-Aufrufe: die Datei wird von
 * Server- und Client-Komponenten importiert und von P2 (Abholliste)
 * mitbenutzt. Gerechnet und geprüft wird auf dem Server
 * (`apps/bakery-api/src/services/delivery-preorders.core.js`) - hier steht
 * nur, was die Oberfläche zum Anzeigen und Vorbelegen braucht.
 *
 * Achtung Wochentage: Sammelstellen zählen nach `Date.getDay()`
 * (0 = Sonntag … 6 = Samstag), Produktionstage nach ISO (1 = Montag).
 */

import {
  formatCurrency,
  formatDate,
  isBusinessDate,
  shiftDate,
  weekdayOf,
} from './partnerTypes'

export {
  formatCurrency,
  formatDate,
  isBusinessDate,
  shiftDate,
  toBusinessDate,
  weekdayOf,
} from './partnerTypes'

/* ------------------------------------------------------------------ *
 * Vertrag
 * ------------------------------------------------------------------ */

export const PREORDER_STATUSES = [
  'offen',
  'bereit',
  'abgeholt',
  'storniert',
] as const
export type PreorderStatus = (typeof PREORDER_STATUSES)[number]

export const PREORDER_CHANNELS = [
  'laden',
  'telefon',
  'whatsapp',
  'shop',
  'sammelstelle',
] as const
export type PreorderChannel = (typeof PREORDER_CHANNELS)[number]

/** Filterwert „Abholung im Laden“ (`pickupPointId=laden`). */
export const LADEN_PICKUP = 'laden'

/** Grenzen des Servers (`delivery-preorders.core.js`). */
export const MAX_QTY_PER_ITEM = 99
export const MAX_ITEMS = 50

export interface PreorderItem {
  /** hq-Slug des Produkts. */
  productId: string
  /** Snapshot des Namens beim Bestellen. */
  name: string
  /** `''` = keine Sorte, sonst ein Slug wie `nuss` - nie `null`. */
  variant: string
  unit: string
  /** Snapshot des hq-Preises: spätere Preisänderungen ändern nichts. */
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface PreorderPickupPointRef {
  id: string
  name: string
  window: string | null
}

export interface Preorder {
  id: number
  /** Kurzcode für Abholzettel und Liste, z. B. `LA-2026-11-17-03`. */
  code: string
  channel: PreorderChannel
  customerName: string | null
  customerPhone: string | null
  pickupDate: string
  /** `HH:MM` bei Abholung im Laden, sonst `null`. */
  pickupTime: string | null
  pickupPointId: string | null
  pickupPoint: PreorderPickupPointRef | null
  status: PreorderStatus
  /** „Nicht abgeholt“ ist kein Status, sondern `bereit` + Zeitpunkt. */
  notCollected: boolean
  notCollectedAt: string | null
  paid: boolean
  /** Bezahlter Betrag (bei `paid`); ältere Server: fehlt. */
  paidAmount?: number | null
  /**
   * Offener Betrag einer bezahlten Bestellung: `> 0` noch kassieren (teurer
   * geworden), `< 0` erstatten (billiger geworden oder storniert).
   */
  paymentBalance?: number
  note: string | null
  items: PreorderItem[]
  total: number
  pickedUpAt: string | null
  anonymizedAt: string | null
  createdBy: number | null
  updatedBy: number | null
  createdAt: string | null
  updatedAt: string | null
  /** Bestellschluss der Sammelstelle (ISO), sonst `null`. */
  deadline: string | null
  afterDeadline: boolean
}

export interface PickupPoint {
  id: string
  name: string
  street: string
  zip: string
  city: string
  /** Liefertag nach `Date.getDay()` (6 = Samstag). */
  weekday: number
  /** Übergabefenster, `HH:MM-HH:MM`. */
  window: string | null
  orderDeadline: { weekday: number; time: string } | null
  notes: string | null
  active: boolean
  /**
   * Stand der Stammdaten (ISO) - nur `/api/preorders/pickup-points` liefert
   * ihn (W4); die Lieferstelle schickt ihn als `expectedUpdatedAt` zurück.
   */
  updatedAt?: string | null
}

/** Höchstlängen der Sammelstellen-Texte - wie `PICKUP_POINT_LIMITS` im Core. */
export const PICKUP_POINT_MAX_LENGTH = {
  name: 100,
  street: 200,
  zip: 10,
  city: 100,
  notes: 2000,
} as const

/** Body von `PUT /api/preorders/pickup-points/:id` (Lieferstelle, Inhaber). */
export interface PickupPointInput {
  name: string
  street: string
  zip: string
  city: string
  weekday: number
  window: string | null
  orderDeadline: { weekday: number; time: string } | null
  notes: string | null
  active: boolean
}

export interface PreorderItemInput {
  productId: string
  variant?: string
  quantity: number
}

/** Body von `POST /api/preorders`; beim Ändern nur die geänderten Felder (`preorderPatch`). */
export interface PreorderInput {
  channel: PreorderChannel
  customerName: string
  customerPhone?: string | null
  pickupDate: string
  pickupTime?: string | null
  pickupPointId?: string | null
  items: PreorderItemInput[]
  paid?: boolean
  note?: string | null
  status?: PreorderStatus
}

export interface PreorderStatusChange {
  status?: PreorderStatus
  notCollected?: boolean
  paid?: boolean
}

export interface PreorderListFilters {
  date?: string
  from?: string
  to?: string
  status?: PreorderStatus[]
  channel?: PreorderChannel
  /** Sammelstellen-ID oder `laden`. */
  pickupPointId?: string
  q?: string
}

export interface PreorderSumItem {
  productId: string
  variant: string
  name: string
  unit: string
  quantity: number
  /** Wie viele Vorbestellungen diese Position enthalten. */
  preorders: number
}

export interface PreorderSums {
  date: string
  pickupPointId: string | null
  preorderCount: number
  items: PreorderSumItem[]
  /**
   * Kopfzahlen wie `/day` (W4) - ohne Namen und Telefonnummern, damit die
   * Backliste nicht die ganze Abholliste laden muss. Ältere Server: fehlt.
   */
  summary?: PreorderDaySummary
}

export interface PreorderDaySummary {
  /** Ohne stornierte. */
  count: number
  total: number
  byStatus: Record<PreorderStatus, number>
  notCollected: number
  paid: number
  /** Noch nicht bezahlt und noch nicht abgeholt, plus Nachzahlungen. */
  unpaidTotal: number
  /** Davon Nachzahlungen bezahlter, teurer gewordener Bestellungen. */
  topUpCount?: number
  topUpTotal?: number
  /** Zu erstatten: bezahlt und storniert oder billiger geworden. */
  refundCount?: number
  refundTotal?: number
  /** Übergeben, aber nicht bezahlt („Ohne Zahlung übergeben“). Ältere Server: fehlt. */
  handedOverUnpaid?: number
  handedOverUnpaidTotal?: number
  byChannel: Partial<Record<PreorderChannel, number>>
}

export interface PreorderDayPickupPoint extends PickupPoint {
  deadline: string | null
  preorderCount: number
}

export interface PreorderDay {
  date: string
  /** Abholort, auf den Kopfzahlen, Summen und Liste beschränkt sind (P2). */
  pickupPointId?: string | null
  summary: PreorderDaySummary
  sums: PreorderSumItem[]
  pickupPoints: PreorderDayPickupPoint[]
  preorders: Preorder[]
}

/** `GET /api/preorders/variants`. */
export interface PreorderVariants {
  /** `false`: keine gültige `backzettel.yaml` - es werden keine Sorten angeboten. */
  configured: boolean
  products: Record<string, string[]>
}

/** Ein bestellbares Produkt aus `GET /api/products` (freigegebener Stand). */
export interface CatalogueProduct {
  productId: string
  name: string
  price: number
  category: string
  unit: string
}

/* ------------------------------------------------------------------ *
 * Beschriftungen
 * ------------------------------------------------------------------ */

export const PREORDER_STATUS_LABELS: Record<PreorderStatus, string> = {
  offen: 'Offen',
  bereit: 'Bereit',
  abgeholt: 'Abgeholt',
  storniert: 'Storniert',
}

/**
 * Chip-Farben. Gefüllte MUI-Chips nehmen `*.contrastText` - das bleibt in
 * Hell und Dunkel lesbar. Kein `warning`: dessen Kontrast ist im hellen
 * Modus zu schwach (CLAUDE.md, Tagesziel).
 */
export const PREORDER_STATUS_COLORS: Record<
  PreorderStatus,
  'info' | 'primary' | 'success' | 'default'
> = {
  offen: 'info',
  bereit: 'primary',
  abgeholt: 'success',
  storniert: 'default',
}

export const CHANNEL_LABELS: Record<PreorderChannel, string> = {
  laden: 'Laden',
  telefon: 'Telefon',
  whatsapp: 'WhatsApp',
  shop: 'Online-Shop',
  sammelstelle: 'Sammelstelle',
}

/** Bestellwege, die die Erfassungsmaske anbietet (Shop kommt vom Shop). */
export const ENTRY_CHANNELS: PreorderChannel[] = [
  'laden',
  'telefon',
  'whatsapp',
]

/** Wochentage nach `Date.getDay()`. */
export const JS_WEEKDAY_SHORT: Record<number, string> = {
  0: 'So',
  1: 'Mo',
  2: 'Di',
  3: 'Mi',
  4: 'Do',
  5: 'Fr',
  6: 'Sa',
}

export const JS_WEEKDAY_LABELS: Record<number, string> = {
  0: 'Sonntag',
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
}

/** „nuss“ → „Nuss“, „schoko-kirsch“ → „Schoko-Kirsch“. */
export function variantLabel(variant: string | null | undefined): string {
  if (!variant) return ''
  return variant
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join('-')
}

/** „Zopf gefüllt (Nuss)“ bzw. nur der Name ohne Sorte. */
export function itemName(item: { name: string; variant?: string }): string {
  return item.variant
    ? `${item.name} (${variantLabel(item.variant)})`
    : item.name
}

/** „2 × Zopf gefüllt (Nuss), 1 × Kornbrot“. */
export function formatItems(items: PreorderItem[]): string {
  return items.map((i) => `${i.quantity} × ${itemName(i)}`).join(', ')
}

/** `Date.getDay()` eines `YYYY-MM-DD` (0 = Sonntag), sonst `null`. */
export function jsWeekdayOf(date: string): number | null {
  const iso = weekdayOf(date)
  return iso === null ? null : iso % 7
}

/** „Di, 17.11.2026“. */
export function formatDateWithWeekday(date: string): string {
  if (!isBusinessDate(date)) return date
  const js = jsWeekdayOf(date)
  return `${js === null ? '' : `${JS_WEEKDAY_SHORT[js]}, `}${formatDate(date)}`
}

/** „Di 17.11.“ - für Tages-Chips. */
export function formatShortDate(date: string): string {
  if (!isBusinessDate(date)) return date
  const js = jsWeekdayOf(date)
  const [, m, d] = date.split('-')
  return `${js === null ? '' : `${JS_WEEKDAY_SHORT[js]} `}${d}.${m}.`
}

/** Wo und wann abgeholt wird, z. B. „Laden · 08:30“ oder „Kita (09:00-09:30)“. */
export function formatPickupPlace(preorder: {
  pickupPoint: PreorderPickupPointRef | null
  pickupTime: string | null
}): string {
  if (preorder.pickupPoint) {
    return `${preorder.pickupPoint.name}${
      preorder.pickupPoint.window ? ` (${preorder.pickupPoint.window})` : ''
    }`
  }
  return `Laden${preorder.pickupTime ? ` · ${preorder.pickupTime} Uhr` : ''}`
}

/* ------------------------------------------------------------------ *
 * Produktionstage (roadmap §1: Di-So, Montag Ruhetag)
 * ------------------------------------------------------------------ */

/** ISO-Wochentag des Ruhetags. */
export const RUHETAG_ISO_WEEKDAY = 1

export function isProductionDay(date: string): boolean {
  const iso = isBusinessDate(date) ? weekdayOf(date) : null
  return iso !== null && iso !== RUHETAG_ISO_WEEKDAY
}

/**
 * Die nächsten `count` Produktionstage ab dem Tag nach `today` (Montag
 * übersprungen). Vorbestellt wird für morgen oder später.
 */
export function nextProductionDates(today: string, count: number): string[] {
  const dates: string[] = []
  let day = today
  while (dates.length < count) {
    day = shiftDate(day, 1)
    if (isProductionDay(day)) dates.push(day)
  }
  return dates
}

/** Vorgabe-Abholtag: der nächste Produktionstag nach `today`. */
export function nextProductionDate(today: string): string {
  return nextProductionDates(today, 1)[0]
}

/** Die nächsten `count` Liefertage einer Sammelstelle ab morgen. */
export function pickupPointDates(
  point: Pick<PickupPoint, 'weekday'>,
  today: string,
  count: number
): string[] {
  const dates: string[] = []
  let day = today
  // höchstens ein Jahr suchen - ein kaputter Wochentag darf nicht hängen
  for (let i = 0; i < 370 && dates.length < count; i++) {
    day = shiftDate(day, 1)
    if (jsWeekdayOf(day) === point.weekday) dates.push(day)
  }
  return dates
}

/** Ob sich Positionen und Abholung noch ändern lassen (P3). */
export function isEditable(
  preorder: Pick<Preorder, 'status' | 'anonymizedAt'>
) {
  return (
    !preorder.anonymizedAt &&
    (preorder.status === 'offen' || preorder.status === 'bereit')
  )
}

function itemsSignature(
  items: ReadonlyArray<{
    productId: string
    variant?: string
    quantity: number
  }>
): string {
  return items
    .map((i) => `${i.productId}|${i.variant ?? ''}|${Number(i.quantity)}`)
    .sort()
    .join(';')
}

/**
 * Nur die Felder, die die Maske gegenüber der geladenen Fassung geändert hat.
 * Wer nur eine Anmerkung ergänzt, schickt nicht `paid`, Positionen und Tag
 * aus der alten Fassung mit - sonst überschriebe das still, was ein anderes
 * Gerät inzwischen gesetzt hat (übergeben + bezahlt). Zusätzlich geht
 * `expectedUpdatedAt` mit (`updatePreorder`), damit der Server veraltete
 * Fassungen ganz ablehnt.
 */
export function preorderPatch(
  before: Preorder,
  after: PreorderInput
): Partial<PreorderInput> {
  const patch: Partial<PreorderInput> = {}
  const same = (a: unknown, b: unknown) => (a ?? null) === (b ?? null)
  if (after.channel !== before.channel) patch.channel = after.channel
  if (!same(after.customerName, before.customerName)) {
    patch.customerName = after.customerName
  }
  if (!same(after.customerPhone, before.customerPhone)) {
    patch.customerPhone = after.customerPhone ?? null
  }
  if (after.pickupDate !== before.pickupDate) {
    patch.pickupDate = after.pickupDate
  }
  if (!same(after.pickupPointId, before.pickupPointId)) {
    patch.pickupPointId = after.pickupPointId ?? null
  }
  if (!same(after.pickupTime, before.pickupTime)) {
    patch.pickupTime = after.pickupTime ?? null
  }
  if (after.paid !== undefined && after.paid !== before.paid) {
    patch.paid = after.paid
  }
  if (!same(after.note, before.note)) patch.note = after.note ?? null
  if (itemsSignature(after.items) !== itemsSignature(before.items)) {
    patch.items = after.items
  }
  return patch
}

/** Ob sich die Bestellung stornieren lässt (`abgeholt ↔ storniert` gesperrt). */
export function isCancellable(
  preorder: Pick<Preorder, 'status' | 'anonymizedAt'>
) {
  return (
    !preorder.anonymizedAt &&
    preorder.status !== 'abgeholt' &&
    preorder.status !== 'storniert'
  )
}

/**
 * Zahlungsstand einer Bestellung für Zeilen, Karten und Ausdrucke
 * (W4-Verifikation Runde 3): eine bezahlte Bestellung, die seitdem teurer
 * (`rest`) oder billiger/storniert (`refund`) wurde, darf nirgends als
 * schlichtes „bezahlt“ erscheinen - sonst wird der Rest nicht kassiert oder
 * das Geld nicht zurückgegeben. `amount` ist immer positiv.
 */
export type PaymentState =
  | { kind: 'unpaid'; amount: number }
  | { kind: 'paid'; amount: number }
  | { kind: 'rest'; amount: number }
  | { kind: 'refund'; amount: number }

export function paymentState(
  preorder: Pick<Preorder, 'paid' | 'paymentBalance' | 'total' | 'status'> & {
    paidAmount?: number | null
  }
): PaymentState {
  if (!preorder.paid) return { kind: 'unpaid', amount: preorder.total }
  const balance = preorder.paymentBalance ?? 0
  if (balance > 0) return { kind: 'rest', amount: balance }
  if (balance < 0) return { kind: 'refund', amount: -balance }
  return {
    kind: 'paid',
    amount: preorder.paidAmount ?? preorder.total,
  }
}

/** Bezahlt, aber zu viel: Geld an die Kundschaft zurückgeben. */
export function owesRefund(
  preorder: Pick<Preorder, 'paid' | 'paymentBalance' | 'total' | 'status'>
): boolean {
  return paymentState(preorder).kind === 'refund'
}

/**
 * Kurztext für Listenzeilen: `''` (unbezahlt), `bezahlt`,
 * `bezahlt · Rest 3,60 € offen`, `bezahlt · 36,00 € erstatten`.
 */
export function paymentRowText(
  preorder: Pick<Preorder, 'paid' | 'paymentBalance' | 'total' | 'status'>
): string {
  const state = paymentState(preorder)
  if (state.kind === 'unpaid') return ''
  if (state.kind === 'rest') {
    return `bezahlt · Rest ${formatCurrency(state.amount)} offen`
  }
  if (state.kind === 'refund') {
    return `bezahlt · ${formatCurrency(state.amount)} erstatten`
  }
  return 'bezahlt'
}

/** Rollen, die Vorbestellungen anlegen und ändern dürfen (API: verkauf; inhaber darf alles). */
export const PREORDER_WRITE_ROLES: readonly string[] = ['inhaber', 'verkauf']

export function canWritePreorders(role: string | null | undefined): boolean {
  return !!role && PREORDER_WRITE_ROLES.includes(role)
}

export type PreorderQuery = Record<string, string | string[] | undefined>

/**
 * „Alle Tage“ in der Seiten-URL. Ohne Marker hieße eine URL ohne Zeitraum
 * „keine Filter“ und fiele beim Neuladen oder Zurückkommen auf „ab heute“
 * zurück. Nur für die Seite - die API kennt den Parameter nicht.
 */
export const ALL_DAYS_PARAM = 'range'
export const ALL_DAYS_VALUE = 'alle'

/**
 * Listenfilter aus der URL; Ungültiges fällt still weg. `undefined` = keine
 * (Vorgabe „ab heute“); mit `range=alle` und ohne Zeitraum `{}` bzw. die
 * übrigen Filter ohne Zeitraum.
 */
export function filtersFromQuery(
  query: PreorderQuery
): PreorderListFilters | undefined {
  const first = (key: string) => {
    const raw = query[key]
    return Array.isArray(raw) ? raw[0] : raw
  }
  const filters: PreorderListFilters = {}
  const date = first('date')
  const from = first('from')
  const to = first('to')
  if (isBusinessDate(date)) filters.date = date
  else {
    if (isBusinessDate(from)) filters.from = from
    if (isBusinessDate(to)) filters.to = to
  }
  const status = (first('status') ?? '')
    .split(',')
    .filter((s): s is PreorderStatus =>
      (PREORDER_STATUSES as readonly string[]).includes(s)
    )
  if (status.length > 0) filters.status = status
  const channel = first('channel')
  if ((PREORDER_CHANNELS as readonly string[]).includes(channel ?? '')) {
    filters.channel = channel as PreorderChannel
  }
  const point = first('pickupPointId')
  if (point && /^[a-z0-9-]{1,64}$/.test(point)) filters.pickupPointId = point
  const q = first('q')?.trim()
  if (q) filters.q = q.slice(0, 100)
  const allDays =
    first(ALL_DAYS_PARAM) === ALL_DAYS_VALUE &&
    !filters.date &&
    !filters.from &&
    !filters.to
  return allDays || Object.keys(filters).length > 0 ? filters : undefined
}
