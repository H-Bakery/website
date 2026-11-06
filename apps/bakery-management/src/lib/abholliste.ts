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
  type PreorderStatusChange,
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

/** Bezahlt, aber seitdem teurer geworden - der Rest ist noch offen. */
export function owesRest(preorder: Preorder): boolean {
  return (
    preorder.paid &&
    preorder.status !== 'storniert' &&
    (preorder.paymentBalance ?? 0) > 0
  )
}

/**
 * Was die Rolle an dieser Bestellung tun darf - so, wie die API es zulässt
 * (`POST /api/preorders/:id/status`): Fahrer nur übergeben, „nicht
 * abgeholt" und bezahlt; Verkauf und Inhaber alles. Stornierte und
 * anonymisierte bleiben unberührt.
 *
 * „Nicht abgeholt" gibt es erst ab dem Abholtag (`today`, Geschäftstag
 * Berlin) - davor kann noch jemand kommen, und die API lehnt es mit 409
 * `not_collected_too_early` ab (W4). Ohne bekannten Tag: nicht anbieten.
 */
export function abholActions(
  preorder: Preorder,
  role: string | null | undefined,
  today?: string | null
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
    notCollected:
      open &&
      !preorder.notCollected &&
      isDayEndAllowed(preorder.pickupDate, today ?? ''),
    clearNotCollected: writer && preorder.notCollected,
    // Bezahlt, aber teurer geworden: der Rest ist noch zu kassieren
    // (W4-Verifikation Runde 2).
    markPaid: !preorder.paid || owesRest(preorder),
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

/* ------------------------------------------------------------------ *
 * Sammelaktionen (W4): Meldungen
 * ------------------------------------------------------------------ */

export type AbholBulkKind = 'ready' | 'dayEnd'

/** Ergebnis je Bestellung, wie `POST /api/preorders/bulk-status` es liefert. */
export interface AbholBulkResult {
  id: number
  result: 'ok' | 'conflict' | 'anonymized' | 'not_found' | 'refused'
  message?: string
}

export interface AbholBulkReport {
  /** Erfolgsmeldung (Snackbar), `null` wenn nichts geändert wurde. */
  done: string | null
  /** Je Fehlerart ein Satz, in fester Reihenfolge. */
  problems: string[]
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * Deutsche Meldungen zu einer Sammelaktion - je Fehlerart ein eigener Satz,
 * damit „inzwischen geändert" (neu laden hilft) nicht wie „anonymisiert"
 * (bleibt so) oder „abgelehnt" (Regel der API) aussieht.
 */
export function describeBulkResults(
  kind: AbholBulkKind,
  results: AbholBulkResult[],
  codes: Map<number, string> = new Map()
): AbholBulkReport {
  const by = (r: AbholBulkResult['result']) =>
    results.filter((x) => x.result === r)
  const ok = by('ok').length
  const what = kind === 'ready' ? 'als bereit' : 'als nicht abgeholt'
  const problems: string[] = []
  const conflicts = by('conflict').length
  if (conflicts > 0) {
    problems.push(
      `${count(
        conflicts,
        'Bestellung wurde',
        'Bestellungen wurden'
      )} inzwischen an anderer Stelle geändert und nicht angefasst.`
    )
  }
  const anonymized = by('anonymized').length
  if (anonymized > 0) {
    problems.push(
      `${count(
        anonymized,
        'Bestellung ist',
        'Bestellungen sind'
      )} schon anonymisiert (Datenschutz) und ${
        anonymized === 1 ? 'lässt' : 'lassen'
      } sich nicht mehr ändern.`
    )
  }
  const missing = by('not_found').length
  if (missing > 0) {
    problems.push(
      `${count(missing, 'Bestellung gibt', 'Bestellungen gibt')} es nicht mehr.`
    )
  }
  for (const r of by('refused')) {
    const code = codes.get(r.id)
    problems.push(
      `${code ?? `Bestellung ${r.id}`}: ${r.message || 'vom Server abgelehnt.'}`
    )
  }
  return {
    done:
      ok > 0
        ? `${count(ok, 'Bestellung', 'Bestellungen')} ${what} markiert.`
        : null,
    problems,
  }
}

/**
 * Meldung, wenn der ganze Sammel-Request scheitert. Der Server schreibt in
 * einer Transaktion - ohne Antwort oder bei 5xx ist **nichts** gespeichert.
 */
export function bulkRequestFailedMessage(
  kind: 'offline' | 'server' | 'refused',
  message?: string
): string {
  if (kind === 'offline') {
    return 'Keine Verbindung zum Server - es wurde nichts gespeichert. Bitte WLAN prüfen und erneut versuchen.'
  }
  if (kind === 'server') {
    return 'Der Server hat einen Fehler gemeldet - es wurde nichts gespeichert. Bitte gleich noch einmal versuchen.'
  }
  return message || 'Das hat nicht geklappt - es wurde nichts gespeichert.'
}

/**
 * Hinweis, wenn stilles Nachladen scheitert: die Liste bleibt stehen,
 * aber sie kann veraltet sein. `since` = Uhrzeit des letzten Stands.
 */
export function staleListMessage(
  kind: 'offline' | 'server' | 'refused',
  since: string
): string {
  const stand = since ? ` Angezeigt wird der Stand von ${since}.` : ''
  if (kind === 'offline') {
    return `Keine Verbindung zum Server - die Liste konnte nicht neu geladen werden.${stand}`
  }
  if (kind === 'server') {
    return `Der Server hat beim Neuladen einen Fehler gemeldet.${stand}`
  }
  return `Die Liste konnte nicht neu geladen werden.${stand}`
}

/**
 * Steht die gewünschte Änderung schon so am Server? Dann war ein scheinbar
 * gescheiterter Tipp (verlorene Antwort im WLAN-Loch) oder ein 409 auf den
 * zweiten Versuch in Wahrheit erfolgreich (W4-Verifikation).
 */
export function changeAlreadyApplied(
  preorder: Preorder,
  change: PreorderStatusChange
): boolean {
  if (change.status !== undefined && preorder.status !== change.status) {
    return false
  }
  if (change.paid !== undefined && Boolean(preorder.paid) !== change.paid) {
    return false
  }
  if (
    change.notCollected !== undefined &&
    Boolean(preorder.notCollected) !== change.notCollected
  ) {
    return false
  }
  return true
}

/**
 * Meldung, wenn ein einzelner Tipp ohne Antwort blieb (`offline`) oder der
 * Server 5xx meldete. `reloaded`: ob die Liste danach frisch geladen werden
 * konnte - nur dann ist sicher, dass nichts gespeichert wurde. Ohne frische
 * Liste ist es **unklar**: die Anfrage kann den Server erreicht haben, bevor
 * die Verbindung abriss.
 */
export function singleRequestFailedMessage(
  kind: 'offline' | 'server',
  reloaded: boolean
): string {
  if (reloaded) {
    return kind === 'offline'
      ? 'Keine Verbindung zum Server - es wurde nichts gespeichert. Bitte erneut versuchen.'
      : 'Der Server hat einen Fehler gemeldet - es wurde nichts gespeichert. Bitte gleich noch einmal versuchen.'
  }
  return kind === 'offline'
    ? 'Keine Verbindung zum Server - ob das gespeichert wurde, ist unklar. Die Liste lädt neu, sobald das WLAN wieder da ist; bitte dann prüfen, bevor erneut getippt wird.'
    : 'Der Server hat einen Fehler gemeldet - ob das gespeichert wurde, ist unklar. Bitte die Liste neu laden und prüfen, bevor erneut getippt wird.'
}
