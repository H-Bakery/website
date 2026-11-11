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
  /** Kennung des Speicherns; ein Wiederholen legt nichts doppelt an. */
  requestId?: string
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
 * Modus zu schwach (`docs/domains/finanzen.md`, Tagesziel).
 */
/**
 * Farbe je Status. „Offen“ (noch packen) und „Bereit“ (gepackt) waren zwei
 * fast gleiche Blautöne (UI-Runde 1) - jetzt Blau gegen Violett, und
 * `PREORDER_STATUS_VARIANTS` setzt „Offen“ zusätzlich umrandet ab.
 */
export const PREORDER_STATUS_COLORS: Record<
  PreorderStatus,
  'info' | 'secondary' | 'success' | 'default'
> = {
  offen: 'info',
  bereit: 'secondary',
  abgeholt: 'success',
  storniert: 'default',
}

/** Gefüllt = erledigt oder gepackt; umrandet = steht noch aus bzw. storniert. */
export const PREORDER_STATUS_VARIANTS: Record<
  PreorderStatus,
  'filled' | 'outlined'
> = {
  offen: 'outlined',
  bereit: 'filled',
  abgeholt: 'filled',
  storniert: 'outlined',
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
 * Gesperrte Abholtage vom Server (`GET /api/preorders/pickup-points` →
 * `pickupDays`, Z14): Ruhetage und Schließtage des Kalenders im Fenster, das
 * die API annimmt. Gerechnet wird dort (`closedPickupDays()` im Core) - die
 * Maske fragt nur nach.
 */
export interface ClosedPickupDay {
  date: string
  code: 'geschlossen' | 'ruhetag'
  /** Notiz oder Feiertag; `null` am Ruhetag. */
  reason: string | null
  /** Deutsche Meldung, wie sie auch das Speichern liefern würde. */
  message: string
  /** Nur im Laden gesperrt - eine Sammelstelle darf den Tag nehmen. */
  shopOnly: boolean
}

export interface PickupDays {
  from: string
  to: string
  /** `false`: kein gültiger Kalender, es gilt nur der Ruhetag. */
  calendar: boolean
  closed: ClosedPickupDay[]
}

/** Meldung ohne Serverdaten (ältere API, Tag außerhalb des Fensters). */
export const RUHETAG_MESSAGE =
  'Montag ist Ruhetag - bitte einen anderen Tag wählen.'

/**
 * Warum `date` kein Abholtag sein kann (`null` = wählbar). Im Fenster des
 * Servers gilt allein dessen Liste - eine Sonderöffnung gibt dort auch einen
 * Montag frei. Ohne Liste oder außerhalb des Fensters bleibt nur der Ruhetag
 * im Laden, wie die API ohne Kalender.
 */
export function closedPickupDay(
  days: PickupDays | null | undefined,
  date: string,
  atPickupPoint: boolean
): Pick<ClosedPickupDay, 'code' | 'reason' | 'message'> | null {
  if (!isBusinessDate(date)) return null
  if (days && date >= days.from && date <= days.to) {
    const entry = days.closed.find((d) => d.date === date)
    return entry && !(atPickupPoint && entry.shopOnly) ? entry : null
  }
  if (!atPickupPoint && !isProductionDay(date)) {
    return { code: 'ruhetag', reason: null, message: RUHETAG_MESSAGE }
  }
  return null
}

/** Höchstens so viele Tage voraus wird ein freier Abholtag gesucht. */
const PICKUP_SEARCH_DAYS = 370

/**
 * Die nächsten `count` Produktionstage ab dem Tag nach `today` (Montag
 * übersprungen). Vorbestellt wird für morgen oder später. Mit `days`
 * (Abholtag-Vorschläge der Maske) fallen auch die Schließtage des Kalenders
 * weg, und eine Sonderöffnung am Montag zählt mit.
 */
export function nextProductionDates(
  today: string,
  count: number,
  days?: PickupDays | null
): string[] {
  const dates: string[] = []
  let day = today
  for (let i = 0; i < PICKUP_SEARCH_DAYS && dates.length < count; i++) {
    day = shiftDate(day, 1)
    if (days ? !closedPickupDay(days, day, false) : isProductionDay(day)) {
      dates.push(day)
    }
  }
  return dates
}

/** Vorgabe-Abholtag: der nächste Produktionstag nach `today` (`''`: keiner). */
export function nextProductionDate(
  today: string,
  days?: PickupDays | null
): string {
  return nextProductionDates(today, 1, days)[0] ?? ''
}

/**
 * Die nächsten `count` Liefertage einer Sammelstelle ab morgen; mit `days`
 * ohne die Tage, an denen die Bäckerei geschlossen ist.
 */
export function pickupPointDates(
  point: Pick<PickupPoint, 'weekday'>,
  today: string,
  count: number,
  days?: PickupDays | null
): string[] {
  const dates: string[] = []
  let day = today
  // höchstens ein Jahr suchen - ein kaputter Wochentag darf nicht hängen
  for (let i = 0; i < PICKUP_SEARCH_DAYS && dates.length < count; i++) {
    day = shiftDate(day, 1)
    if (jsWeekdayOf(day) !== point.weekday) continue
    if (days && closedPickupDay(days, day, true)) continue
    dates.push(day)
  }
  return dates
}

/**
 * Schließtage, die zwischen morgen und `until` (dem letzten Vorschlag) liegen
 * und deshalb in den Vorschlägen fehlen - für den Hinweis darunter. Der
 * wöchentliche Ruhetag steht nicht dabei (den kennt jede), bei einer
 * Sammelstelle nur ihr Liefertag.
 */
export function skippedPickupDays(
  days: PickupDays | null | undefined,
  today: string,
  until: string,
  point: Pick<PickupPoint, 'weekday'> | null
): ClosedPickupDay[] {
  if (!days || !isBusinessDate(today) || !isBusinessDate(until)) return []
  return days.closed.filter(
    (d) =>
      d.code === 'geschlossen' &&
      d.date > today &&
      d.date <= until &&
      (!point || jsWeekdayOf(d.date) === point.weekday)
  )
}

/** „Fr 25.12. (1. Weihnachtstag)“ - ein Schließtag im Hinweis der Maske. */
export function formatClosedDay(day: ClosedPickupDay): string {
  return `${formatShortDate(day.date)}${day.reason ? ` (${day.reason})` : ''}`
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
