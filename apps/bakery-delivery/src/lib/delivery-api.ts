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
  lat: number
  lon: number
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
  estimatedArrival: string | null
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  const text = await response.text()
  const body = text ? JSON.parse(text) : null

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

const QUEUE_KEY = 'bakery-delivery-queue'

export interface QueuedUpdate {
  id: string
  tourId: number
  stopId: number
  body: Partial<StopInput>
  queuedAt: string
}

/** localStorage kann fehlen (SSR) oder verweigert werden (privater Modus). */
function readQueue(): QueuedUpdate[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
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

export function queueStopUpdate(
  tourId: number,
  stopId: number,
  body: Partial<StopInput>
): QueuedUpdate[] {
  const queue = readQueue()
  // Pro Stopp bleibt nur der letzte Stand stehen; zweimal Antippen soll nicht
  // zwei widerspruechliche Aenderungen nachschieben.
  const withoutStop = queue.filter(
    (entry) => !(entry.tourId === tourId && entry.stopId === stopId)
  )
  const next = [
    ...withoutStop,
    {
      id: `${tourId}-${stopId}-${Date.now()}`,
      tourId,
      stopId,
      body,
      queuedAt: new Date().toISOString(),
    },
  ]
  writeQueue(next)
  return next
}

export function pendingUpdates(): QueuedUpdate[] {
  return readQueue()
}

/**
 * Schickt die Warteschlange raus. Gibt die zuletzt vom Server gelieferte Tour
 * zurueck, damit der Aufrufer den echten Stand anzeigen kann.
 *
 * Eine Aenderung, die der Server fachlich ablehnt (4xx), fliegt aus der
 * Schlange - sonst blockiert sie alle folgenden fuer immer. Netzfehler lassen
 * den Eintrag stehen.
 */
export async function flushQueue(): Promise<{
  tour: Tour | null
  remaining: QueuedUpdate[]
  rejected: QueuedUpdate[]
}> {
  let queue = readQueue()
  let tour: Tour | null = null
  const rejected: QueuedUpdate[] = []

  for (const entry of [...queue]) {
    try {
      tour = await deliveryApi.updateStop(
        entry.tourId,
        entry.stopId,
        entry.body
      )
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
      break // Netzproblem: der Rest wartet auf den naechsten Versuch.
    }
  }

  return { tour, remaining: queue, rejected }
}
