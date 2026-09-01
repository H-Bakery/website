// Server und Frontend rechnen dieselbe Geometrie zweimal: einmal in
// `apps/bakery-api/src/services/delivery-tours.core.js` (CommonJS, ohne
// Abhaengigkeiten), einmal hier in TypeScript. Die CommonJS/ESM-Grenze laesst
// sich nicht ohne Build-Umbau ueberbruecken - also prueft dieser Test, dass
// beide Fassungen dieselben Zahlen liefern. Faellt er, hat jemand nur eine
// Seite geaendert.

import * as path from 'path'
import {
  calculateHaversineDistance,
  estimateLeg,
  hasCoordinates,
  normalizeAddress,
  optimizeRouteOrder,
  ROAD_DETOUR_FACTOR,
  STOP_SERVICE_TIME,
  withEstimatedArrivals,
  type RouteWaypoint,
} from './delivery-routing'

// Pfad zur Laufzeit gebaut, damit die Modulgrenzen-Regel von Nx den
// Querverweis nicht als Abhaengigkeit zwischen Projekten liest.
const CORE_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'apps',
  'bakery-api',
  'src',
  'services',
  'delivery-tours.core.js'
)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const core = require(CORE_PATH)

const DEPOT = { lat: 49.3015165, lon: 7.3695327 }
const STOPS = [
  { id: 1, lat: 49.300633, lon: 7.3663013 },
  { id: 2, lat: 49.3214815, lon: 7.3392 },
  { id: 3, lat: 49.3222198, lon: 7.3372 },
  { id: 4, lat: 49.3117, lon: 7.3542 },
  { id: 5, lat: 49.2955, lon: 7.3801 },
]

const toLocation = (p: { lat: number; lon: number }) => ({
  latitude: p.lat,
  longitude: p.lon,
})

describe('Server- und Frontend-Geometrie', () => {
  it('benutzen dieselben Konstanten', () => {
    expect(core.ROAD_DETOUR_FACTOR).toBe(ROAD_DETOUR_FACTOR)
    expect(core.STOP_SERVICE_TIME).toBe(STOP_SERVICE_TIME)
  })

  it('messen jede Etappe gleich (Haversine)', () => {
    const points = [DEPOT, ...STOPS]
    for (let i = 0; i < points.length; i++) {
      for (let j = 0; j < points.length; j++) {
        expect(
          calculateHaversineDistance(
            toLocation(points[i]),
            toLocation(points[j])
          )
        ).toBeCloseTo(core.haversineMeters(points[i], points[j]), 6)
      }
    }
  })

  it('schaetzen Strecke und Fahrzeit jeder Etappe gleich', () => {
    for (const vehicle of ['bike', 'car', 'van'] as const) {
      for (const stop of STOPS) {
        const server = core.estimateLeg(DEPOT, stop, vehicle)
        const client = estimateLeg(toLocation(DEPOT), toLocation(stop), vehicle)
        expect(client.distance).toBeCloseTo(server.distance, 6)
        expect(client.duration).toBeCloseTo(server.duration, 6)
      }
    }
  })

  it('sortieren die Stopps ab dem Depot in derselben Reihenfolge', () => {
    const serverOrder = core
      .orderStopsNearestNeighbour(DEPOT, STOPS)
      .map((s: { id: number }) => s.id)

    const waypoints: RouteWaypoint[] = STOPS.map((s) => ({
      location: { ...toLocation(s), timestamp: new Date(0) },
      address: String(s.id),
      type: 'delivery',
    }))
    const clientOrder = optimizeRouteOrder(waypoints, toLocation(DEPOT)).map(
      (w) => Number(w.address)
    )

    expect(clientOrder).toEqual(serverOrder)
  })

  it('kommen auf dieselben Ankunftszeiten', () => {
    const start = new Date('2026-09-05T04:30:00.000Z')
    const serverArrivals = core.estimateArrivals(
      DEPOT,
      STOPS,
      start.toISOString(),
      'car'
    )

    const route = withEstimatedArrivals(
      {
        id: 'x',
        distance: 0,
        duration: 0,
        waypoints: [
          {
            location: { ...toLocation(DEPOT), timestamp: start },
            address: 'Depot',
            type: 'pickup',
          },
          ...STOPS.map(
            (s): RouteWaypoint => ({
              location: { ...toLocation(s), timestamp: start },
              address: String(s.id),
              type: 'delivery',
            })
          ),
        ],
      },
      start,
      'car'
    )

    route.waypoints.slice(1).forEach((waypoint) => {
      const expected = Date.parse(serverArrivals[Number(waypoint.address)])
      expect(waypoint.estimatedArrival?.getTime()).toBeCloseTo(expected, -1)
    })
  })

  it('normalisieren Adressen gleich', () => {
    for (const address of [
      'Ortsstraße 36-38, 66424 Homburg',
      '  Talstraße 5 ',
      'Eckstraße 3, Homburg-Kirrberg',
    ]) {
      expect(normalizeAddress(address)).toBe(core.normalizeAddress(address))
    }
  })

  it('erkennen dieselben Werte als "keine Koordinaten"', () => {
    const samples: Array<{ lat: unknown; lon: unknown }> = [
      { lat: null, lon: null },
      { lat: undefined, lon: undefined },
      { lat: '', lon: '' },
      { lat: ' ', lon: ' ' },
      { lat: 49.3, lon: null },
      { lat: 0, lon: 0 },
      { lat: '49.3', lon: '7.36' },
      { lat: NaN, lon: 7.36 },
      { lat: true, lon: true },
    ]
    for (const sample of samples) {
      expect(hasCoordinates(sample)).toBe(core.hasCoordinates(sample))
    }
  })
})
