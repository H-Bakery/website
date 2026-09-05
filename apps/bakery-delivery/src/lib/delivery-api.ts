// Zugriff auf die Liefer-Endpunkte der Bakery-API.
//
// Die App laeuft auf dem Handy im Auto. Netz ist deshalb die Ausnahme, nicht
// die Regel: jedes Abhaken wird sofort lokal angezeigt und in eine Warteschlange
// gelegt, die beim naechsten Funkloch-Ende automatisch nachlaeuft. Solange
// nichts gesendet werden konnte, sagt die Oberflaeche das auch.

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:5000'

export interface Depot {
  name: string
  street: string
  zip: string
  city: string
  phone: string | null
  lat: number | null
  lon: number | null
}

export interface Driver {
  id: number
  name: string
  phone: string | null
  vehicle: 'bike' | 'car' | 'van'
  active: boolean
}

export interface StopItem {
  name: string
  qty: number
  unit: string
}

export type StopStatus = 'open' | 'done' | 'failed'

// --- Sammelstelle (Kindergarten Mörsbach) ---
//
// Ein Stopp mit `pickupPointId` ist keine Zustellung, sondern eine
// Sammelstelle: die Kundschaft hat vorbestellt und holt die Ware im
// Übergabefenster beim Fahrer ab. Der Server hängt die Vorbestellungen des
// Tourtags an den Stopp, damit sie in der Offline-Kopie der Tour mitreisen.

export interface PickupPoint {
  id: string
  name: string
  street: string
  zip: string
  city: string
  /** Liefertag nach `Date.getDay()`: 0 = Sonntag … 6 = Samstag. */
  weekday: number
  /** Übergabefenster vor Ort als `HH:MM-HH:MM`. */
  window: string | null
  orderDeadline: { weekday: number; time: string } | null
  notes: string | null
  active: boolean
  lat: number | null
  lon: number | null
  geocodeSource: string | null
  geocodePrecision: 'house' | 'street' | null
}

export type PreorderStatus =
  | 'open'
  | 'handed_over'
  | 'not_collected'
  | 'cancelled'

export interface PreorderItem {
  productId: string
  name: string
  qty: number
  unit: string
  unitPrice: number
  lineTotal: number
}

export interface Preorder {
  id: number
  /** Für den Zuruf vor Ort, z. B. `MO-2026-09-12-01`. */
  reference: string
  pickupPointId: string
  date: string
  customer: string
  phone: string | null
  items: PreorderItem[]
  total: number
  note: string | null
  status: PreorderStatus
  handedOverAt: string | null
  createdAt: string
  updatedAt: string
  /** Berechnet vom Server: Bestellschluss als ISO-Zeitpunkt. */
  deadline: string | null
  /** Berechnet vom Server: nach Bestellschluss aufgenommen. */
  afterDeadline: boolean
}

export interface PreorderSummaryProduct {
  productId: string
  name: string
  unit: string
  qty: number
}

export interface PreorderSummary {
  count: number
  total: number
  open: number
  handedOver: number
  notCollected: number
  cancelled: number
  byProduct: PreorderSummaryProduct[]
}

export interface Stop {
  id: number
  customer: string
  street: string
  zip: string
  city: string
  address: string
  phone: string | null
  timeWindow: string | null
  notes: string | null
  items: StopItem[]
  status: StopStatus
  completedAt: string | null
  failureReason: string | null
  lat: number | null
  lon: number | null
  geocodeSource: string | null
  /**
   * Was die Adresssuche getroffen hat: `house` die Hausnummer, `street` nur
   * die Straße (der Punkt liegt in der Straßenmitte), `null` unbekannt -
   * nicht gefunden, von Hand gesetzt oder aus einem älteren Cache.
   */
  geocodePrecision: 'house' | 'street' | null
  estimatedArrival: string | null
  /** Gesetzt, wenn der Stopp eine Sammelstelle ist. Alte Payloads haben es nicht. */
  pickupPointId?: string | null
  pickupPoint?: PickupPoint | null
  /** Die Vorbestellungen des Tourtags, ohne stornierte. */
  preorders?: Preorder[]
  preorderSummary?: PreorderSummary
}

export interface TourProgress {
  total: number
  done: number
  failed: number
  open: number
  isComplete: boolean
}

export interface Tour {
  id: number
  date: string
  driverId: number | null
  driver: Driver | null
  depot: Depot
  name: string
  status: 'planned' | 'active' | 'done'
  vehicleType: 'bike' | 'car' | 'van'
  /** Geplante Abfahrt als HH:MM - Grundlage der Ankunftsprognose. */
  plannedStart: string
  startedAt: string | null
  finishedAt: string | null
  distance: number | null
  duration: number | null
  isEstimate: boolean
  geometry: Array<[number, number]> | null
  routedAt: string | null
  lastPosition: { lat: number; lon: number; at: string } | null
  stops: Stop[]
  progress: TourProgress
  nextStopId: number | null
}

/** Was die Übergabeliste an die API schickt. */
export interface PreorderUpdate {
  status: PreorderStatus
}

/** Was die Erfassungsmaske an die API schickt. */
export interface StopInput {
  customer: string
  street: string
  zip?: string
  city?: string
  phone?: string | null
  timeWindow?: string | null
  notes?: string | null
  items?: Array<{ name: string; qty: number; unit?: string }>
  status?: StopStatus
  lat?: number | null
  lon?: number | null
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Macht aus einem Fehler der API-Schicht einen deutschen Satz für die
 * Oberfläche. Netzfehler bleiben absichtlich keine ApiError (flushQueue
 * unterscheidet daran, ob ein Update wiederholt werden darf) - deshalb
 * wird hier übersetzt, nicht in request().
 */
export function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message
  if (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  ) {
    return 'Die Bäckerei-API antwortet nicht. Bitte gleich noch einmal versuchen.'
  }
  if (error instanceof TypeError) {
    return `Keine Verbindung zur Bäckerei-API (${API_BASE_URL}). Läuft der Server?`
  }
  return error instanceof Error ? error.message : fallback
}

/**
 * Nach so vielen Millisekunden gilt eine Anfrage als gescheitert. Im Funkloch
 * haengt `fetch` sonst minutenlang - und solange es haengt, sind alle Knoepfe
 * gesperrt und die Warteschlange kommt nicht zum Zug.
 */
const REQUEST_TIMEOUT_MS = 15_000

function timeoutSignal(): AbortSignal | undefined {
  if (
    typeof AbortSignal === 'undefined' ||
    typeof AbortSignal.timeout !== 'function'
  ) {
    return undefined
  }
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    signal: init?.signal ?? timeoutSignal(),
  })

  const text = await response.text()
  let body: { message?: string; error?: string } | null = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    // Kein JSON - etwa die HTML-Fehlerseite eines Proxys. Dann zaehlt nur
    // der Statuscode.
    body = null
  }

  if (!response.ok) {
    // Die API liefert `message` auf Deutsch und `error` technisch. Der Fahrer
    // sieht den deutschen Text.
    throw new ApiError(
      body?.message || body?.error || `Fehler ${response.status}`,
      response.status
    )
  }

  return body as T
}

export const deliveryApi = {
  drivers: () => request<Driver[]>('/api/deliveries/drivers?active=true'),

  tours: (params: { date?: string; driverId?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.date) query.set('date', params.date)
    if (params.driverId) query.set('driverId', String(params.driverId))
    const suffix = query.toString() ? `?${query}` : ''
    return request<Tour[]>(`/api/deliveries/tours${suffix}`)
  },

  tour: (id: number) => request<Tour>(`/api/deliveries/tours/${id}`),

  createTour: (body: {
    date: string
    driverId?: number | null
    name?: string
  }) =>
    request<Tour>('/api/deliveries/tours', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateTour: (id: number, body: Record<string, unknown>) =>
    request<Tour>(`/api/deliveries/tours/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  addStop: (tourId: number, body: StopInput) =>
    request<Tour>(`/api/deliveries/tours/${tourId}/stops`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateStop: (tourId: number, stopId: number, body: Partial<StopInput>) =>
    request<Tour>(`/api/deliveries/tours/${tourId}/stops/${stopId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  removeStop: (tourId: number, stopId: number) =>
    request<Tour>(`/api/deliveries/tours/${tourId}/stops/${stopId}`, {
      method: 'DELETE',
    }),

  optimize: (tourId: number) =>
    request<Tour>(`/api/deliveries/tours/${tourId}/optimize`, {
      method: 'POST',
      body: JSON.stringify({ optimize: true }),
    }),

  /**
   * Abhaken einer Vorbestellung an der Sammelstelle. Es geht bewusst nur der
   * Status raus - die Positionen samt Preis-Snapshot bleiben stehen (siehe
   * PATCH-Vertrag der API).
   */
  updatePreorder: (preorderId: number, body: PreorderUpdate) =>
    request<Preorder>(`/api/deliveries/preorders/${preorderId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  reportPosition: (
    tourId: number,
    position: { lat: number; lon: number; accuracy?: number; speed?: number }
  ) =>
    request<unknown>(`/api/deliveries/tours/${tourId}/position`, {
      method: 'POST',
      body: JSON.stringify(position),
    }),
}

// --- Warteschlange fuer Funkloecher ---
//
// Sie traegt zwei Arten von Aenderungen: das Abhaken eines Stopps und das
// Abhaken einer Vorbestellung an der Sammelstelle. Beides passiert an
// derselben Stelle im Auto und darf im Funkloch nicht verloren gehen.

const QUEUE_KEY = 'bakery-delivery-queue'

interface QueuedBase {
  id: string
  queuedAt: string
}

export interface QueuedStopUpdate extends QueuedBase {
  kind: 'stop'
  tourId: number
  stopId: number
  body: Partial<StopInput>
}

export interface QueuedPreorderUpdate extends QueuedBase {
  kind: 'preorder'
  preorderId: number
  body: PreorderUpdate
}

export type QueuedUpdate = QueuedStopUpdate | QueuedPreorderUpdate

/**
 * Liest einen gespeicherten Eintrag - auch einen aus der Zeit vor den
 * Vorbestellungen. Damals hatte die Schlange kein `kind`; ein solcher Eintrag
 * ist ein Stopp-Update und darf beim Update der App nicht weggeworfen werden,
 * da koennte ein noch nicht gesendetes Abhaken drinstehen.
 */
function reviveEntry(raw: unknown): QueuedUpdate | null {
  if (!raw || typeof raw !== 'object') return null
  const entry = raw as Record<string, unknown>
  const body =
    entry.body && typeof entry.body === 'object'
      ? (entry.body as Record<string, unknown>)
      : null
  if (!body) return null
  const id = typeof entry.id === 'string' ? entry.id : null
  if (!id) return null
  const queuedAt =
    typeof entry.queuedAt === 'string'
      ? entry.queuedAt
      : new Date(0).toISOString()

  if (entry.kind === 'preorder') {
    if (typeof entry.preorderId !== 'number') return null
    return {
      id,
      kind: 'preorder',
      preorderId: entry.preorderId,
      body: body as unknown as PreorderUpdate,
      queuedAt,
    }
  }

  if (typeof entry.tourId !== 'number' || typeof entry.stopId !== 'number') {
    return null
  }
  return {
    id,
    kind: 'stop',
    tourId: entry.tourId,
    stopId: entry.stopId,
    body: body as Partial<StopInput>,
    queuedAt,
  }
}

/** localStorage kann fehlen (SSR) oder verweigert werden (privater Modus). */
function readQueue(): QueuedUpdate[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(reviveEntry)
      .filter((entry): entry is QueuedUpdate => entry !== null)
  } catch {
    return []
  }
}

function writeQueue(queue: QueuedUpdate[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // Kein Speicher - dann geht die Aenderung eben nur online raus.
  }
}

/**
 * Haengt einen Eintrag an und wirft den vorherigen desselben Ziels weg. Pro
 * Ziel bleibt nur der letzte Stand stehen; zweimal Antippen soll nicht zwei
 * widerspruechliche Aenderungen nachschieben.
 */
function enqueue(
  entry: QueuedUpdate,
  isSameTarget: (other: QueuedUpdate) => boolean
): QueuedUpdate[] {
  const next = [...readQueue().filter((other) => !isSameTarget(other)), entry]
  writeQueue(next)
  return next
}

export function queueStopUpdate(
  tourId: number,
  stopId: number,
  body: Partial<StopInput>
): QueuedUpdate[] {
  return enqueue(
    {
      id: `stop-${tourId}-${stopId}-${Date.now()}`,
      kind: 'stop',
      tourId,
      stopId,
      body,
      queuedAt: new Date().toISOString(),
    },
    (other) =>
      other.kind === 'stop' &&
      other.tourId === tourId &&
      other.stopId === stopId
  )
}

export function queuePreorderUpdate(
  preorderId: number,
  body: PreorderUpdate
): QueuedUpdate[] {
  return enqueue(
    {
      id: `preorder-${preorderId}-${Date.now()}`,
      kind: 'preorder',
      preorderId,
      body,
      queuedAt: new Date().toISOString(),
    },
    (other) => other.kind === 'preorder' && other.preorderId === preorderId
  )
}

export function pendingUpdates(): QueuedUpdate[] {
  return readQueue()
}

/**
 * Schickt die Warteschlange raus. Gibt die zuletzt vom Server gelieferte Tour
 * und die bestaetigten Vorbestellungen zurueck, damit der Aufrufer den echten
 * Stand anzeigen kann.
 *
 * Eine Aenderung, die der Server fachlich ablehnt (4xx), fliegt aus der
 * Schlange - sonst blockiert sie alle folgenden fuer immer. Netzfehler lassen
 * den Eintrag stehen.
 */
export async function flushQueue(): Promise<{
  tour: Tour | null
  preorders: Preorder[]
  remaining: QueuedUpdate[]
  rejected: QueuedUpdate[]
  /** true, wenn der Server nicht erreichbar war und Eintraege liegen blieben. */
  offline: boolean
}> {
  let queue = readQueue()
  let tour: Tour | null = null
  const confirmed: Preorder[] = []
  const rejected: QueuedUpdate[] = []
  let offline = false

  for (const entry of [...queue]) {
    try {
      if (entry.kind === 'preorder') {
        confirmed.push(
          await deliveryApi.updatePreorder(entry.preorderId, entry.body)
        )
      } else {
        tour = await deliveryApi.updateStop(
          entry.tourId,
          entry.stopId,
          entry.body
        )
      }
      queue = queue.filter((q) => q.id !== entry.id)
      writeQueue(queue)
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500
      ) {
        rejected.push(entry)
        queue = queue.filter((q) => q.id !== entry.id)
        writeQueue(queue)
        continue
      }
      offline = true
      break // Netzproblem: der Rest wartet auf den naechsten Versuch.
    }
  }

  return { tour, preorders: confirmed, remaining: queue, rejected, offline }
}

// --- Offline-Kopie ---
//
// Jeder Tipp auf „Navigation" reicht das Handy an Google oder Apple Maps
// weiter; kommt der Fahrer zurueck, laedt der Browser die Seite gern neu - und
// zwar genau dann, wenn er zwischen zwei Funkzellen steht. Damit dann nicht
// die leere Seite kommt, bleiben die zuletzt geladene Fahrerliste und Tourliste
// im localStorage. Es ist bewusst nur *eine* Tourliste (die zuletzt angesehene
// Kombination aus Tag und Fahrer): mit Streckenverlauf ist eine Tour schnell
// einige Dutzend Kilobyte gross, eine Kopie pro Tag liefe dem Speicher davon.

const DRIVERS_COPY_KEY = 'bakery-delivery-drivers'
const TOURS_COPY_KEY = 'bakery-delivery-tours'

export interface ToursCopy {
  date: string
  driverId: number | null
  /** Wann die Liste zuletzt vom Server kam (ISO). */
  at: string
  tours: Tour[]
}

function readCopy<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeCopy(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Voll oder verweigert - dann eben ohne Kopie.
  }
}

export function rememberDrivers(drivers: Driver[]): void {
  writeCopy(DRIVERS_COPY_KEY, drivers)
}

export function rememberedDrivers(): Driver[] | null {
  const parsed = readCopy<unknown>(DRIVERS_COPY_KEY)
  return Array.isArray(parsed) ? (parsed as Driver[]) : null
}

export function rememberTours(
  date: string,
  driverId: number | null,
  tours: Tour[]
): void {
  const copy: ToursCopy = {
    date,
    driverId,
    at: new Date().toISOString(),
    tours,
  }
  writeCopy(TOURS_COPY_KEY, copy)
}

/** Die gemerkte Tourliste - nur, wenn sie zu Tag und Fahrer passt. */
export function rememberedTours(
  date: string,
  driverId: number | null
): ToursCopy | null {
  const copy = readCopy<Partial<ToursCopy>>(TOURS_COPY_KEY)
  if (!copy || copy.date !== date || (copy.driverId ?? null) !== driverId) {
    return null
  }
  if (!Array.isArray(copy.tours) || typeof copy.at !== 'string') return null
  return copy as ToursCopy
}
