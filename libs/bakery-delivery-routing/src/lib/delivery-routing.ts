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
  estimatedArrival?: Date
  notes?: string
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

/**
 * Bringt die Stopps in eine sinnvolle Reihenfolge (Nearest Neighbour ab
 * `origin`).
 *
 * Wichtig: die Reihenfolge wird vom *Start* aus aufgebaut, nicht ab dem ersten
 * Listeneintrag. Sonst haengt das Ergebnis davon ab, welchen Stopp die Backstube
 * zufaellig zuerst eingetippt hat.
 */
export function optimizeRouteOrder(
  waypoints: RouteWaypoint[],
  origin?: Pick<Location, 'latitude' | 'longitude'>
): RouteWaypoint[] {
  if (waypoints.length <= 1) return [...waypoints]

  const remaining = [...waypoints]
  const optimized: RouteWaypoint[] = []
  let current: Pick<Location, 'latitude' | 'longitude'> =
    origin ?? remaining[0].location

  if (!origin) {
    optimized.push(remaining.shift() as RouteWaypoint)
  }

  while (remaining.length > 0) {
    let nearestIndex = 0
    let nearestDistance = Infinity

    for (let i = 0; i < remaining.length; i++) {
      const distance = calculateHaversineDistance(
        current,
        remaining[i].location
      )
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = i
      }
    }

    const next = remaining.splice(nearestIndex, 1)[0]
    optimized.push(next)
    current = next.location
  }

  return optimized
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
 */
export function withEstimatedArrivals(
  route: Route,
  startedAt: Date = new Date(),
  vehicleType: NonNullable<RouteOptimizationRequest['vehicleType']> = 'car'
): Route {
  let cursor = startedAt.getTime()

  const waypoints = route.waypoints.map((waypoint, index) => {
    if (index > 0) {
      const leg = estimateLeg(
        route.waypoints[index - 1].location,
        waypoint.location,
        vehicleType
      )
      cursor += leg.duration * 1000
      if (index > 1) cursor += STOP_SERVICE_TIME * 1000
    }
    return { ...waypoint, estimatedArrival: new Date(cursor) }
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
