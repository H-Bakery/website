// Kern der Tourenplanung: Geometrie, Reihenfolge, Formatierung.
//
// Diese Datei enthaelt *nur* reine Funktionen und Typen - kein Netzwerk, kein
// DOM. Der Netzwerk-Teil (echte Strassenrouten) steht in `osrm-provider.ts`,
// damit Tests ohne Internet laufen.

// Kopie des Location-Interfaces, um eine Lib-zu-Lib-Abhaengigkeit zu vermeiden.
// Strukturgleich mit @bakery/delivery/tracking - beide muessen zusammen
// geaendert werden.
export interface Location {
  latitude: number
  longitude: number
  timestamp: Date
  accuracy?: number
  speed?: number
  heading?: number
}

export interface Route {
  id: string
  waypoints: RouteWaypoint[]
  distance: number // Meter
  duration: number // Sekunden
  /** Strassenverlauf als [lat, lon]-Paare. Fehlt, wenn nur Luftlinie bekannt ist. */
  geometry?: Array<[number, number]>
  /** true, wenn Distanz/Dauer geschaetzt sind statt vom Router berechnet. */
  isEstimate?: boolean
}

export interface RouteWaypoint {
  location: Location
  address: string
  type: 'pickup' | 'delivery' | 'waypoint'
  orderId?: string
  /** Fruehestens zum Fensterbeginn - siehe `withEstimatedArrivals`. */
  estimatedArrival?: Date
  notes?: string
  /** Zeitfenster wie am Stopp erfasst, z. B. "09:00-09:30"; siehe `parseTimeWindow`. */
  timeWindow?: string | null
  /** Sekunden Wartezeit bis zum Fensterbeginn, 0 ohne Wartezeit. */
  waitSeconds?: number
  /** Die Ankunft liegt nach dem Fensterende - das Fenster ist nicht mehr einhaltbar. */
  missesTimeWindow?: boolean
}

export interface RouteOptimizationRequest {
  /** Startpunkt der Tour - in der Regel die Backstube, nicht der Fahrer. */
  origin: Location
  /** Adresse des Startpunkts. Landet als Beschriftung am Abhol-Wegpunkt. */
  originAddress?: string
  destinations: RouteWaypoint[]
  vehicleType?: 'bike' | 'car' | 'van'
  avoidHighways?: boolean
  optimizeFor?: 'time' | 'distance'
}

export interface MapProvider {
  calculateRoute(request: RouteOptimizationRequest): Promise<Route>
  getDirections(from: Location, to: Location): Promise<Route>
  geocodeAddress(address: string): Promise<Location>
  reverseGeocode(location: Location): Promise<string>
}

/**
 * Durchschnittsgeschwindigkeit je Fahrzeug in m/s. Ortsverkehr im Saarpfalz-
 * Kreis, inklusive Ampeln - bewusst konservativ.
 */
const AVERAGE_SPEED_MS: Record<
  NonNullable<RouteOptimizationRequest['vehicleType']>,
  number
> = {
  bike: 4.2, // ~15 km/h
  car: 8.3, // ~30 km/h
  van: 7.5, // ~27 km/h
}

/**
 * Umwegfaktor Luftlinie -> Strasse. Ohne Router ist die Luftlinie systematisch
 * zu kurz; 1.35 trifft Ortslagen wie Kirrberg/Homburg brauchbar.
 */
export const ROAD_DETOUR_FACTOR = 1.35

/** Aufenthalt pro Stopp in Sekunden (aussteigen, uebergeben, quittieren). */
export const STOP_SERVICE_TIME = 180

/**
 * Hat der Wert brauchbare Koordinaten (`lat`/`lon`)?
 *
 * Dieselbe Pruefung wie `hasCoordinates()` in `delivery-tours.core.js`:
 * `null`, `undefined`, Leerstring und NaN sind "keine Koordinaten" - ein
 * `stop.lat !== null` haette `undefined` durchgelassen, und Leaflet wirft bei
 * `[undefined, undefined]` die ganze Karte weg. Werte ausserhalb von -90..90
 * bzw. -180..180 sind Tippfehler, und (0, 0) - "Null Island" im Golf von
 * Guinea - ist das Ergebnis von `Number(null)`, nie eine Lieferadresse.
 */
export function hasCoordinates<T extends { lat?: unknown; lon?: unknown }>(
  value: T | null | undefined
): value is T & { lat: number; lon: number } {
  if (!value) return false
  return (
    isLatitude(value.lat) &&
    isLongitude(value.lon) &&
    !(Number(value.lat) === 0 && Number(value.lon) === 0)
  )
}

/** Breitengrad -90..90 - identisch mit `isLatitude()` im Server-Core. */
export function isLatitude(value: unknown): boolean {
  return isFiniteNumber(value) && Math.abs(Number(value)) <= 90
}

/** Laengengrad -180..180 - identisch mit `isLongitude()` im Server-Core. */
export function isLongitude(value: unknown): boolean {
  return isFiniteNumber(value) && Math.abs(Number(value)) <= 180
}

function isFiniteNumber(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    Number.isFinite(Number(value))
  )
}

/** Uhrzeit als "HH:MM" mit 00-23 Stunden und 00-59 Minuten. */
export function isClockTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

/** Zeitfenster eines Stopps mit optionalen Grenzen als "HH:MM". */
export interface TimeWindow {
  start: string | null
  end: string | null
}

/**
 * Liest das Zeitfenster eines Stopps: "09:00-09:30", "9:00 – 9:30",
 * "ab 09:00" (nur Beginn), "bis 09:30" (nur Ende). `null`, wenn kein Fenster
 * lesbar ist ("vormittags") oder das Ende vor dem Beginn liegt - Freitext
 * bleibt erlaubt und wirkt dann nur nicht auf die Ankunftszeiten.
 * Identisch mit `parseTimeWindow()` in `delivery-tours.core.js`.
 */
export function parseTimeWindow(value: unknown): TimeWindow | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null

  const times: string[] = []
  const pattern = /(\d{1,2}):(\d{2})/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null && times.length < 2) {
    const clock = `${match[1].padStart(2, '0')}:${match[2]}`
    if (!isClockTime(clock)) return null
    times.push(clock)
  }
  if (times.length === 0) return null
  if (times.length === 2) {
    // "HH:MM" vergleicht sich als String korrekt.
    if (times[1] < times[0]) return null
    return { start: times[0], end: times[1] }
  }
  if (/^bis\b/i.test(text)) return { start: null, end: times[0] }
  return { start: times[0], end: null }
}

/** Fensterbeginn und -ende als Zeitstempel (ms) am Tag `date`. */
export interface TimeWindowBounds {
  start: number | null
  end: number | null
}

/**
 * Fensterbeginn und -ende als Zeitstempel am Tourtag (lokale Zeit, wie
 * `arrivalBaseline`), fehlende Grenzen `null`. Identisch mit
 * `timeWindowBounds()` im Server-Core.
 */
export function timeWindowBounds(
  date: string | null | undefined,
  timeWindow: unknown
): TimeWindowBounds {
  const window = parseTimeWindow(timeWindow)
  if (!window || !isBusinessDate(date)) return { start: null, end: null }
  const at = (clock: string | null): number | null => {
    if (!clock) return null
    const ms = Date.parse(`${date}T${clock}:00`)
    return Number.isFinite(ms) ? ms : null
  }
  return { start: at(window.start), end: at(window.end) }
}

/** YYYY-MM-DD, und der Tag existiert - wie `isBusinessDate()` im Server-Core. */
function isBusinessDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  )
}

/** Lokales Datum als YYYY-MM-DD - `toISOString()` waere UTC und schoebe den Tag. */
function toBusinessDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Tourtag der Zeitfenster: das uebergebene Datum, sonst der lokale Tag der Startzeit. */
function windowDate(
  date: string | null | undefined,
  startedAtMs: number
): string | null {
  if (isBusinessDate(date)) return date
  return Number.isFinite(startedAtMs)
    ? toBusinessDate(new Date(startedAtMs))
    : null
}

interface ArrivalAt {
  distance: number
  eta: number
  arrival: number
  waitSeconds: number
  late: boolean
}

/**
 * Ankunft an `to`, wenn man `from` zur Zeit `at` (ms) verlaesst. Vor dem
 * Fensterbeginn wird gewartet: `arrival = max(eta, start)`; `late` heisst,
 * dass selbst die Ankunft nach dem Fensterende liegt.
 */
function arrivalAt(
  from: Pick<Location, 'latitude' | 'longitude'>,
  to: Pick<Location, 'latitude' | 'longitude'>,
  at: number,
  vehicleType: NonNullable<RouteOptimizationRequest['vehicleType']>,
  window: TimeWindowBounds
): ArrivalAt {
  const leg = estimateLeg(from, to, vehicleType)
  const eta = at + leg.duration * 1000
  const arrival = window.start != null ? Math.max(eta, window.start) : eta
  return {
    distance: leg.distance,
    eta,
    arrival,
    waitSeconds: Math.max(0, (arrival - eta) / 1000),
    late: window.end != null && arrival > window.end,
  }
}

/** Ein Punkt mit Koordinaten, wie ihn Depot, Stopp und Fahrerposition tragen. */
export interface Coordinates {
  lat: number | string | null | undefined
  lon: number | string | null | undefined
}

export interface ArrivalBaselineStop extends Coordinates {
  status?: string | null
  completedAt?: string | null
}

export interface ArrivalBaselineTour {
  /** Tourtag als YYYY-MM-DD. */
  date: string
  /** Geplante Abfahrt als HH:MM; Default 06:30. */
  plannedStart?: string | null
  /** ISO-Zeitpunkt, ab dem die Tour laeuft; `null` bei einer geplanten Tour. */
  startedAt?: string | null
  stops?: ArrivalBaselineStop[] | null
  lastPosition?: (Coordinates & { at?: string | null }) | null
}

export interface ArrivalBaseline<TOrigin> {
  origin: TOrigin
  /** ISO-Zeitpunkt, ab dem die Ankunftszeiten laufen. */
  startedAt: string
}

/**
 * Ausgangspunkt und -zeit der Ankunftsprognose - die TypeScript-Fassung von
 * `arrivalBaseline()` in `delivery-tours.core.js`; `core-consistency.spec.ts`
 * rechnet beide gegeneinander.
 *
 * Geplante Tour: Depot ab Datum + geplanter Abfahrt, aber nie frueher als
 * jetzt - am Tourtag um 10:48 stuende sonst "Ankunft ca. 06:38" an der Tour.
 *
 * Laufende Tour: ab dem zuletzt erledigten Stopp (Ort und Zeit) oder der
 * juengeren gemeldeten Fahrerposition, ebenfalls nie frueher als jetzt.
 */
export function arrivalBaseline<TDepot, TStop extends ArrivalBaselineStop>(
  depot: TDepot,
  tour: ArrivalBaselineTour & { stops?: TStop[] | null },
  now: number = Date.now()
): ArrivalBaseline<
  TDepot | TStop | NonNullable<ArrivalBaselineTour['lastPosition']>
> {
  if (!tour.startedAt) {
    const start = isClockTime(tour.plannedStart) ? tour.plannedStart : '06:30'
    let planned = Date.parse(`${tour.date}T${start}:00`)
    if (!Number.isFinite(planned)) planned = now
    return {
      origin: depot,
      startedAt: new Date(Math.max(planned, now)).toISOString(),
    }
  }

  let origin:
    | TDepot
    | TStop
    | NonNullable<ArrivalBaselineTour['lastPosition']> = depot
  let at = Date.parse(tour.startedAt)
  if (!Number.isFinite(at)) at = 0

  for (const stop of tour.stops ?? []) {
    if (stop.status === 'open' || !hasCoordinates(stop)) continue
    const completed = Date.parse(stop.completedAt ?? '')
    if (Number.isFinite(completed) && completed >= at) {
      at = completed
      origin = stop
    }
  }

  const position = tour.lastPosition
  if (hasCoordinates(position)) {
    const reported = Date.parse(position.at ?? '')
    if (Number.isFinite(reported) && reported > at) {
      at = reported
      origin = position
    }
  }

  return { origin, startedAt: new Date(Math.max(at, now)).toISOString() }
}

/**
 * Entfernung zweier Punkte in Metern (Haversine).
 *
 * Exportiert, damit die App sie nicht noch einmal abschreibt - genau das war
 * frueher der Grund, warum Gesamtstrecke und Einzelstrecken auf dem Bildschirm
 * unterschiedliche Zahlen zeigten.
 */
export function calculateHaversineDistance(
  location1: Pick<Location, 'latitude' | 'longitude'>,
  location2: Pick<Location, 'latitude' | 'longitude'>
): number {
  const R = 6371e3 // Erdradius in Metern
  const phi1 = (location1.latitude * Math.PI) / 180
  const phi2 = (location2.latitude * Math.PI) / 180
  const dPhi = ((location2.latitude - location1.latitude) * Math.PI) / 180
  const dLambda = ((location2.longitude - location1.longitude) * Math.PI) / 180

  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(dLambda / 2) *
      Math.sin(dLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Schaetzt Fahrstrecke und -zeit ohne Router: Luftlinie mal Umwegfaktor,
 * geteilt durch die Fahrzeuggeschwindigkeit.
 */
export function estimateLeg(
  from: Pick<Location, 'latitude' | 'longitude'>,
  to: Pick<Location, 'latitude' | 'longitude'>,
  vehicleType: NonNullable<RouteOptimizationRequest['vehicleType']> = 'car'
): { distance: number; duration: number } {
  const distance = calculateHaversineDistance(from, to) * ROAD_DETOUR_FACTOR
  return { distance, duration: distance / AVERAGE_SPEED_MS[vehicleType] }
}

export interface RouteOrderOptions {
  /** Abfahrt am Startpunkt. Ohne sie werden Zeitfenster nicht beruecksichtigt. */
  startedAt?: Date
  vehicleType?: RouteOptimizationRequest['vehicleType']
  /** Tourtag der Zeitfenster (YYYY-MM-DD); Default: lokaler Tag von `startedAt`. */
  date?: string | null
}

/**
 * Bringt die Stopps in eine sinnvolle Reihenfolge (Nearest Neighbour ab
 * `origin`).
 *
 * Wichtig: die Reihenfolge wird vom *Start* aus aufgebaut, nicht ab dem ersten
 * Listeneintrag. Sonst haengt das Ergebnis davon ab, welchen Stopp die Backstube
 * zufaellig zuerst eingetippt hat.
 *
 * Mit `options.startedAt` zaehlen die Zeitfenster der Wegpunkte mit - dieselbe
 * Heuristik "Nearest Neighbour mit Zeitfenstern" wie
 * `orderStopsNearestNeighbour()` im Server-Core (dort steht sie beschrieben):
 * je Kandidat die fruehestmoegliche Bedienung `max(Ankunft, Fensterbeginn)`,
 * verpasste Fenster und Kandidaten, die einem anderen Stopp das Fenster
 * nehmen, ans Ende, bei Gleichstand die kuerzere Etappe. Ohne Fenster ist das
 * das gewoehnliche Nearest Neighbour.
 */
export function optimizeRouteOrder(
  waypoints: RouteWaypoint[],
  origin?: Pick<Location, 'latitude' | 'longitude'>,
  options: RouteOrderOptions = {}
): RouteWaypoint[] {
  if (waypoints.length <= 1) return [...waypoints]

  const remaining = [...waypoints]
  const optimized: RouteWaypoint[] = []
  let current: Pick<Location, 'latitude' | 'longitude'> =
    origin ?? remaining[0].location

  const vehicleType = options.vehicleType ?? 'car'
  let cursor = options.startedAt ? options.startedAt.getTime() : NaN
  const timed = Number.isFinite(cursor)
  // Ohne Startzeit zaehlt nur die Fahrzeit ab 0 - dieselbe Reihenfolge wie
  // die reine Entfernung, weil die Geschwindigkeit je Tour konstant ist.
  if (!timed) cursor = 0
  const date = timed ? windowDate(options.date, cursor) : null
  const noWindow: TimeWindowBounds = { start: null, end: null }
  const windows = new Map<RouteWaypoint, TimeWindowBounds>(
    remaining.map((w) => [
      w,
      timed ? timeWindowBounds(date, w.timeWindow) : noWindow,
    ])
  )

  if (!origin) {
    const first = remaining.shift() as RouteWaypoint
    optimized.push(first)
    if (timed) cursor += STOP_SERVICE_TIME * 1000
  }

  while (remaining.length > 0) {
    let best: {
      waypoint: RouteWaypoint
      rank: number[]
      arrival: number
    } | null = null

    for (const candidate of remaining) {
      const here = arrivalAt(
        current,
        candidate.location,
        cursor,
        vehicleType,
        windows.get(candidate) ?? noWindow
      )

      let harms = false
      if (timed) {
        const depart = here.arrival + STOP_SERVICE_TIME * 1000
        for (const other of remaining) {
          if (other === candidate) continue
          const window = windows.get(other) ?? noWindow
          if (window.end == null) continue
          const now = arrivalAt(
            current,
            other.location,
            cursor,
            vehicleType,
            window
          )
          if (now.late) continue
          const after = arrivalAt(
            candidate.location,
            other.location,
            depart,
            vehicleType,
            window
          )
          if (after.late) {
            harms = true
            break
          }
        }
      }

      const rank = [
        here.late ? 1 : 0,
        harms ? 1 : 0,
        here.arrival,
        here.distance,
      ]
      if (best === null || compareRank(rank, best.rank) < 0) {
        best = { waypoint: candidate, rank, arrival: here.arrival }
      }
    }

    const next = best as { waypoint: RouteWaypoint; arrival: number }
    remaining.splice(remaining.indexOf(next.waypoint), 1)
    optimized.push(next.waypoint)
    current = next.waypoint.location
    cursor = next.arrival + STOP_SERVICE_TIME * 1000
  }

  return optimized
}

function compareRank(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  }
  return 0
}

/**
 * Baut aus Start und Stopps eine Route mit geschaetzten Werten - der Fallback,
 * wenn der Routing-Dienst nicht erreichbar ist.
 */
export function buildEstimatedRoute(request: RouteOptimizationRequest): Route {
  const vehicleType = request.vehicleType ?? 'car'
  const waypoints: RouteWaypoint[] = [
    {
      location: request.origin,
      address: request.originAddress ?? 'Start',
      type: 'pickup',
    },
    ...request.destinations,
  ]

  let distance = 0
  let duration = 0
  for (let i = 1; i < waypoints.length; i++) {
    const leg = estimateLeg(
      waypoints[i - 1].location,
      waypoints[i].location,
      vehicleType
    )
    distance += leg.distance
    duration += leg.duration + STOP_SERVICE_TIME
  }

  return {
    id: `route-estimate-${waypoints.length}`,
    waypoints,
    distance,
    duration,
    isEstimate: true,
  }
}

/**
 * Traegt die voraussichtliche Ankunft in jeden Wegpunkt ein. Der Abholpunkt
 * bekommt die Startzeit, jeder weitere Stopp Fahrzeit plus Standzeit.
 *
 * Ein Wegpunkt mit `timeWindow` wird nicht vor dem Fensterbeginn bedient:
 * `estimatedArrival = max(eta, Fensterbeginn)`, die Wartezeit steht in
 * `waitSeconds` und schiebt alle folgenden Ankuenfte nach hinten. Liegt die
 * Ankunft nach dem Fensterende, ist `missesTimeWindow` gesetzt. `date` ist
 * der Tourtag der Fenster (Default: lokaler Tag von `startedAt`). Dieselbe
 * Rechnung wie `estimateArrivalDetails()` im Server-Core.
 */
export function withEstimatedArrivals(
  route: Route,
  startedAt: Date = new Date(),
  vehicleType: NonNullable<RouteOptimizationRequest['vehicleType']> = 'car',
  date?: string | null
): Route {
  let cursor = startedAt.getTime()
  const day = windowDate(date, cursor)

  const waypoints = route.waypoints.map((waypoint, index) => {
    if (index === 0) {
      return { ...waypoint, estimatedArrival: new Date(cursor) }
    }
    if (index > 1) cursor += STOP_SERVICE_TIME * 1000
    const here = arrivalAt(
      route.waypoints[index - 1].location,
      waypoint.location,
      cursor,
      vehicleType,
      timeWindowBounds(day, waypoint.timeWindow)
    )
    cursor = here.arrival
    return {
      ...waypoint,
      estimatedArrival: new Date(here.arrival),
      waitSeconds: here.waitSeconds,
      missesTimeWindow: here.late,
    }
  })

  return { ...route, waypoints }
}

/** Voraussichtliche Ankunft an einem einzelnen Ziel. */
export function calculateETA(
  currentLocation: Pick<Location, 'latitude' | 'longitude'>,
  destination: Pick<Location, 'latitude' | 'longitude'>,
  averageSpeed = 30 // km/h
): Date {
  const distance =
    calculateHaversineDistance(currentLocation, destination) *
    ROAD_DETOUR_FACTOR
  const timeInMs = (distance / 1000 / averageSpeed) * 60 * 60 * 1000
  return new Date(Date.now() + timeInMs)
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.round((total % 3600) / 60)

  if (hours > 0) {
    return `${hours} h ${minutes} min`
  }
  return `${minutes} min`
}

export function formatRouteDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '–'
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} km`
}

export function formatClockTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Deterministischer Ersatz-Provider fuer Tests und Arbeit ohne Internet.
 *
 * Frueher streute `geocodeAddress` zufaellig um Zuerich, sodass jede Berechnung
 * eine andere Route ergab. Jetzt wird die Adresse gehasht: gleiche Adresse ->
 * gleicher Punkt, und zwar im Umkreis von Homburg.
 */
export class MockMapProvider implements MapProvider {
  constructor(
    private readonly center: { latitude: number; longitude: number } = {
      latitude: 49.3226,
      longitude: 7.3389,
    }
  ) {}

  async calculateRoute(request: RouteOptimizationRequest): Promise<Route> {
    return buildEstimatedRoute(request)
  }

  async getDirections(from: Location, to: Location): Promise<Route> {
    const leg = estimateLeg(from, to)
    return {
      id: 'route-estimate-direct',
      waypoints: [
        { location: from, address: 'Start', type: 'pickup' },
        { location: to, address: 'Ziel', type: 'delivery' },
      ],
      distance: leg.distance,
      duration: leg.duration,
      isEstimate: true,
    }
  }

  async geocodeAddress(address: string): Promise<Location> {
    const hash = hashString(normalizeAddress(address))
    // +/- 0.045 Grad entsprechen rund 5 km - die Groesse des Liefergebiets.
    const latOffset = ((hash % 1000) / 1000 - 0.5) * 0.09
    const lonOffset = ((Math.floor(hash / 1000) % 1000) / 1000 - 0.5) * 0.09

    return {
      latitude: this.center.latitude + latOffset,
      longitude: this.center.longitude + lonOffset,
      timestamp: new Date(),
    }
  }

  async reverseGeocode(location: Location): Promise<string> {
    return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
  }
}

/** Adressen vergleichbar machen: Kleinschreibung, Umlaute, Whitespace. */
export function normalizeAddress(address: string): string {
  return String(address ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}
