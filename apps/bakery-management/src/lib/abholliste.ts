/**
 * Abholliste (P2, roadmap §6 M1): Gruppierung, Suche, erlaubte Aktionen und
 * Vorgaben für Tag und Abholort. Reine Funktionen ohne API-Aufrufe - die
 * Seite (`admin/preorders/abholliste`) zeigt an, was `/api/preorders/day`
 * liefert; Status und Summen rechnet der Server.
 */

import {
  JS_WEEKDAY_LABELS,
  LADEN_PICKUP,
  canWritePreorders,
  isBusinessDate,
  isProductionDay,
  jsWeekdayOf,
  shiftDate,
  type PickupPoint,
  type Preorder,
} from './preordersTypes'

export const ABHOLLISTE_PATH = '/admin/preorders/abholliste'

/** Gruppierung der Liste: nach Abholzeit oder nach Name (Anfangsbuchstabe). */
export type AbholSort = 'zeit' | 'name'

export interface AbholGroup {
  key: string
  label: string
  preorders: Preorder[]
}

/** Schlüssel der Gruppe „storniert" - steht immer am Ende, ohne Aktionen. */
export const CANCELLED_GROUP = 'storniert'

const NO_TIME = 'ohne-uhrzeit'

function byName(a: Preorder, b: Preorder): number {
  return (
    (a.customerName ?? '').localeCompare(b.customerName ?? '', 'de', {
      sensitivity: 'base',
    }) || a.code.localeCompare(b.code)
  )
}

function initialOf(name: string | null): string {
  const letter = (name ?? '')
    .trim()
    .charAt(0)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
  return /[A-Z]/.test(letter) ? letter : '#'
}

/**
 * Gruppen für Bildschirm und Druck. Stornierte stehen gesammelt am Ende
 * (nie in einer Zeitgruppe - sie werden nicht übergeben). Innerhalb einer
 * Gruppe nach Name, dann Code.
 *
 * - `zeit`: je Abholzeit (`08:30 Uhr`), Bestellungen ohne Uhrzeit danach;
 *   an einer Sammelstelle gibt es keine Uhrzeit, dort heißt die Gruppe nach
 *   dem Übergabefenster.
 * - `name`: je Anfangsbuchstabe.
 */
export function groupPreorders(
  preorders: readonly Preorder[],
  sort: AbholSort,
  options: { window?: string | null } = {}
): AbholGroup[] {
  const active = preorders.filter((p) => p.status !== 'storniert')
  const cancelled = preorders.filter((p) => p.status === 'storniert')
  const groups = new Map<string, AbholGroup>()
  for (const p of active) {
    let key: string
    let label: string
    if (sort === 'name') {
      key = initialOf(p.customerName)
      label = key
    } else if (p.pickupTime) {
      key = p.pickupTime
      label = `${p.pickupTime} Uhr`
    } else {
      key = NO_TIME
      label = options.window ? `Übergabe ${options.window} Uhr` : 'Ohne Uhrzeit'
    }
    const group = groups.get(key) ?? { key, label, preorders: [] }
    group.preorders.push(p)
    groups.set(key, group)
  }
  const ordered = Array.from(groups.values()).sort((a, b) => {
    if (a.key === NO_TIME) return 1
    if (b.key === NO_TIME) return -1
    if (a.key === '#') return 1
    if (b.key === '#') return -1
    return a.key.localeCompare(b.key, 'de')
  })
  for (const group of ordered) group.preorders.sort(byName)
  if (cancelled.length > 0) {
    ordered.push({
      key: CANCELLED_GROUP,
      label: 'Storniert',
      preorders: [...cancelled].sort(byName),
    })
  }
  return ordered
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .trim()
}

/**
 * Suche nach Name oder Code. Eine kurze Zahl (`3`, `03`) heißt die laufende
 * Nummer am Ende des Codes (`LA-2026-11-17-03`) - das ruft man an der Theke
 * zu; ab drei Ziffern zählt auch die Telefonnummer.
 */
export function matchesSearch(preorder: Preorder, query: string): boolean {
  const q = normalize(query)
  if (!q) return true
  if (/^\d{1,2}$/.test(q)) {
    // Nur die laufende Nummer - sonst passte „4" auf jedes Datum mit 4.
    const number = preorder.code.match(/-(\d+)$/)
    return Boolean(number && Number(number[1]) === Number(q))
  }
  if (normalize(preorder.customerName ?? '').includes(q)) return true
  if (normalize(preorder.code).includes(q)) return true
  const digits = q.replace(/\D/g, '')
  if (
    digits.length >= 3 &&
    digits.length === q.replace(/[\s/+-]/g, '').length &&
    (preorder.customerPhone ?? '').replace(/\D/g, '').includes(digits)
  ) {
    return true
  }
  return false
}

/** Noch zu übergeben: offen oder bereit, nicht als „nicht abgeholt" markiert. */
export function isWaiting(preorder: Preorder): boolean {
  return (
    (preorder.status === 'offen' || preorder.status === 'bereit') &&
    !preorder.notCollected
  )
}

export interface AbholActions {
  /** Großer Haken: übergeben (→ `abgeholt`). */
  handover: boolean
  /** `offen` → `bereit` (gepackt). Fahrer dürfen das nicht (API). */
  ready: boolean
  /** Am Tagesende: `bereit` + „nicht abgeholt". */
  notCollected: boolean
  /** „Nicht abgeholt" zurücknehmen (kommt doch noch). */
  clearNotCollected: boolean
  markPaid: boolean
  markUnpaid: boolean
  /** Übergabe zurücknehmen (→ `bereit`). */
  undoHandover: boolean
}

const NONE: AbholActions = {
  handover: false,
  ready: false,
  notCollected: false,
  clearNotCollected: false,
  markPaid: false,
  markUnpaid: false,
  undoHandover: false,
}

/**
 * Was die Rolle an dieser Bestellung tun darf - so, wie die API es zulässt
 * (`POST /api/preorders/:id/status`): Fahrer nur übergeben, „nicht
 * abgeholt" und bezahlt; Verkauf und Inhaber alles. Stornierte und
 * anonymisierte bleiben unberührt.
 */
export function abholActions(
  preorder: Preorder,
  role: string | null | undefined
): AbholActions {
  if (!role || preorder.anonymizedAt || preorder.status === 'storniert') {
    return NONE
  }
  const writer = canWritePreorders(role)
  const driver = role === 'fahrer'
  if (!writer && !driver) return NONE
  const open = preorder.status === 'offen' || preorder.status === 'bereit'
  return {
    handover: open,
    ready: writer && preorder.status === 'offen',
    notCollected: open && !preorder.notCollected,
    clearNotCollected: writer && preorder.notCollected,
    markPaid: !preorder.paid,
    markUnpaid: writer && preorder.paid,
    undoHandover: writer && preorder.status === 'abgeholt',
  }
}

/** Vorheriger/nächster Abholtag: im Laden Produktionstage, sonst Wochen. */
export function stepPickupDay(
  date: string,
  direction: 1 | -1,
  point: Pick<PickupPoint, 'weekday'> | null
): string {
  if (point) {
    let day = shiftDate(date, direction)
    for (let i = 0; i < 7 && jsWeekdayOf(day) !== point.weekday; i++) {
      day = shiftDate(day, direction)
    }
    return day
  }
  let day = shiftDate(date, direction)
  while (!isProductionDay(day)) day = shiftDate(day, direction)
  return day
}

/**
 * Vorgabetag: im Laden heute (Montag → Dienstag), an einer Sammelstelle ihr
 * nächster Liefertag ab heute (samstags früh also heute).
 */
export function defaultPickupDate(
  today: string,
  point: Pick<PickupPoint, 'weekday'> | null
): string {
  if (point) {
    let day = today
    for (let i = 0; i < 7 && jsWeekdayOf(day) !== point.weekday; i++) {
      day = shiftDate(day, 1)
    }
    return day
  }
  let day = today
  while (!isProductionDay(day)) day = shiftDate(day, 1)
  return day
}

/**
 * Vorgabe-Abholort: Fahrer fahren zur Sammelstelle (die an `date` beliefert
 * wird, sonst die erste aktive), alle anderen stehen im Laden.
 */
export function defaultPickupPlace(
  role: string | null | undefined,
  points: readonly PickupPoint[],
  date?: string
): string {
  if (role !== 'fahrer') return LADEN_PICKUP
  const active = points.filter((p) => p.active !== false)
  const weekday = date && isBusinessDate(date) ? jsWeekdayOf(date) : null
  const served = active.find((p) => p.weekday === weekday)
  return (served ?? active[0])?.id ?? LADEN_PICKUP
}

/** Gültiger Ort aus der URL: `laden` oder eine bekannte Sammelstelle. */
export function isPickupPlace(
  value: string | null | undefined,
  points: readonly Pick<PickupPoint, 'id'>[]
): value is string {
  if (!value) return false
  return value === LADEN_PICKUP || points.some((p) => p.id === value)
}

/** „Laden" oder der Name der Sammelstelle. */
export function placeLabel(
  place: string,
  points: readonly Pick<PickupPoint, 'id' | 'name'>[]
): string {
  if (place === LADEN_PICKUP) return 'Laden'
  return points.find((p) => p.id === place)?.name ?? place
}

/** Ob der Tag vorbei ist oder läuft - erst dann gibt es „nicht abgeholt". */
export function isDayEndAllowed(date: string, today: string): boolean {
  return isBusinessDate(date) && isBusinessDate(today) && date <= today
}

/** Hinweis, wenn ein Tag an einer Sammelstelle kein Liefertag ist. */
export function wrongWeekdayNotice(
  date: string,
  point: Pick<PickupPoint, 'weekday' | 'name'> | null
): string | null {
  if (!point || !isBusinessDate(date)) return null
  if (jsWeekdayOf(date) === point.weekday) return null
  return `${point.name} wird nur ${
    JS_WEEKDAY_LABELS[point.weekday] ?? 'am Liefertag'
  }s beliefert.`
}

/** `09:14` aus einem ISO-Zeitpunkt (Ortszeit), sonst `''`. */
export function formatClock(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

/** Seiten-URL der Abholliste. */
export function abhollisteHref(date?: string, place?: string): string {
  const params = new URLSearchParams()
  if (date && isBusinessDate(date)) params.set('date', date)
  if (place) params.set('point', place)
  const query = params.toString()
  return query ? `${ABHOLLISTE_PATH}?${query}` : ABHOLLISTE_PATH
}
