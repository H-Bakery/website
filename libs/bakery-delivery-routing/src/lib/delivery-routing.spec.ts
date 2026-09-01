import {
  buildEstimatedRoute,
  calculateHaversineDistance,
  estimateLeg,
  formatDuration,
  formatRouteDistance,
  MockMapProvider,
  normalizeAddress,
  optimizeRouteOrder,
  Route,
  RouteWaypoint,
  withEstimatedArrivals,
} from './delivery-routing'

const BACKSTUBE = { latitude: 49.3015165, longitude: 7.3695327 } // Eckstrasse 3, Kirrberg
const HOMBURG_MITTE = { latitude: 49.3226, longitude: 7.3389 }

function waypoint(
  name: string,
  latitude: number,
  longitude: number
): RouteWaypoint {
  return {
    location: {
      latitude,
      longitude,
      timestamp: new Date('2026-09-05T06:00:00Z'),
    },
    address: name,
    type: 'delivery',
    orderId: name,
  }
}

describe('calculateHaversineDistance', () => {
  it('misst Kirrberg -> Homburg Mitte auf etwa 3,8 km', () => {
    const meters = calculateHaversineDistance(BACKSTUBE, HOMBURG_MITTE)
    expect(meters).toBeGreaterThan(3000)
    expect(meters).toBeLessThan(4500)
  })

  it('ist symmetrisch und fuer identische Punkte null', () => {
    expect(calculateHaversineDistance(BACKSTUBE, BACKSTUBE)).toBe(0)
    expect(calculateHaversineDistance(BACKSTUBE, HOMBURG_MITTE)).toBeCloseTo(
      calculateHaversineDistance(HOMBURG_MITTE, BACKSTUBE),
      6
    )
  })
})

describe('estimateLeg', () => {
  it('rechnet Strasse laenger als Luftlinie', () => {
    const luftlinie = calculateHaversineDistance(BACKSTUBE, HOMBURG_MITTE)
    expect(estimateLeg(BACKSTUBE, HOMBURG_MITTE).distance).toBeGreaterThan(
      luftlinie
    )
  })

  it('braucht mit dem Rad laenger als mit dem Auto', () => {
    const auto = estimateLeg(BACKSTUBE, HOMBURG_MITTE, 'car')
    const rad = estimateLeg(BACKSTUBE, HOMBURG_MITTE, 'bike')
    expect(rad.duration).toBeGreaterThan(auto.duration)
    expect(rad.distance).toBeCloseTo(auto.distance, 6)
  })
})

describe('buildEstimatedRoute', () => {
  const destinations = [
    waypoint('Stopp A', 49.32, 7.34),
    waypoint('Stopp B', 49.31, 7.36),
  ]

  it('setzt den Startpunkt als Abholung mit eigener Adresse', () => {
    const route = buildEstimatedRoute({
      origin: { ...BACKSTUBE, timestamp: new Date() },
      originAddress: 'Eckstraße 3, 66424 Homburg-Kirrberg',
      destinations,
    })

    expect(route.waypoints[0].type).toBe('pickup')
    expect(route.waypoints[0].address).toBe(
      'Eckstraße 3, 66424 Homburg-Kirrberg'
    )
    expect(route.waypoints[0].location.latitude).toBeCloseTo(
      BACKSTUBE.latitude,
      6
    )
  })

  // Regression: der Abholpunkt uebernahm frueher Adresse, orderId und Hinweise
  // des ersten Stopps. Aus drei Lieferungen wurden dadurch vier Stopps, der
  // erste doppelt.
  it('kopiert weder orderId noch Adresse des ersten Stopps auf die Abholung', () => {
    const route = buildEstimatedRoute({
      origin: { ...BACKSTUBE, timestamp: new Date() },
      destinations,
    })

    expect(route.waypoints).toHaveLength(destinations.length + 1)
    expect(route.waypoints[0].orderId).toBeUndefined()
    expect(route.waypoints[0].address).not.toBe(destinations[0].address)
    expect(route.waypoints.filter((w) => w.orderId === 'Stopp A')).toHaveLength(
      1
    )
  })

  it('markiert die Werte als Schaetzung', () => {
    const route = buildEstimatedRoute({
      origin: { ...BACKSTUBE, timestamp: new Date() },
      destinations,
    })
    expect(route.isEstimate).toBe(true)
    expect(route.distance).toBeGreaterThan(0)
    expect(route.duration).toBeGreaterThan(0)
  })
})

describe('optimizeRouteOrder', () => {
  const nah = waypoint('nah', 49.302, 7.37)
  const mittel = waypoint('mittel', 49.312, 7.355)
  const fern = waypoint('fern', 49.33, 7.33)

  it('beginnt beim naechstgelegenen Stopp zum Start, nicht beim ersten Eintrag', () => {
    const order = optimizeRouteOrder([fern, mittel, nah], BACKSTUBE).map(
      (w) => w.address
    )
    expect(order).toEqual(['nah', 'mittel', 'fern'])
  })

  it('liefert dieselbe Reihenfolge, egal wie die Stopps eingetippt wurden', () => {
    const a = optimizeRouteOrder([fern, mittel, nah], BACKSTUBE).map(
      (w) => w.address
    )
    const b = optimizeRouteOrder([mittel, nah, fern], BACKSTUBE).map(
      (w) => w.address
    )
    expect(a).toEqual(b)
  })

  it('laesst kurze Listen unveraendert und verliert nie einen Stopp', () => {
    expect(optimizeRouteOrder([], BACKSTUBE)).toEqual([])
    expect(optimizeRouteOrder([nah], BACKSTUBE)).toHaveLength(1)
    expect(optimizeRouteOrder([fern, mittel, nah], BACKSTUBE)).toHaveLength(3)
  })
})

describe('withEstimatedArrivals', () => {
  it('vergibt aufsteigende Ankunftszeiten ab dem Start', () => {
    const start = new Date('2026-09-05T06:00:00Z')
    const route: Route = buildEstimatedRoute({
      origin: { ...BACKSTUBE, timestamp: start },
      destinations: [waypoint('A', 49.32, 7.34), waypoint('B', 49.31, 7.36)],
    })

    const withEta = withEstimatedArrivals(route, start)
    const times = withEta.waypoints.map((w) => Number(w.estimatedArrival))

    expect(times[0]).toBe(start.getTime())
    expect(times[1]).toBeGreaterThan(times[0])
    expect(times[2]).toBeGreaterThan(times[1])
  })
})

describe('MockMapProvider.geocodeAddress', () => {
  // Regression: frueher ein Zufallspunkt um Zuerich, sodass jede Berechnung
  // eine andere Route ergab.
  it('liefert fuer dieselbe Adresse denselben Punkt', async () => {
    const provider = new MockMapProvider()
    const a = await provider.geocodeAddress('Ortsstraße 36-38, 66424 Homburg')
    const b = await provider.geocodeAddress('ortsstrasse 36-38, 66424 homburg')

    expect(a.latitude).toBeCloseTo(b.latitude, 10)
    expect(a.longitude).toBeCloseTo(b.longitude, 10)
  })

  it('liefert fuer verschiedene Adressen verschiedene Punkte im Liefergebiet', async () => {
    const provider = new MockMapProvider()
    const a = await provider.geocodeAddress('Ortsstraße 36, 66424 Homburg')
    const b = await provider.geocodeAddress('Talstraße 5, 66424 Homburg')

    expect(a.latitude).not.toBeCloseTo(b.latitude, 6)
    expect(calculateHaversineDistance(a, HOMBURG_MITTE)).toBeLessThan(8000)
  })
})

describe('Formatierung', () => {
  it('schreibt Entfernungen deutsch', () => {
    expect(formatRouteDistance(450)).toBe('450 m')
    expect(formatRouteDistance(5038)).toBe('5,0 km')
  })

  it('schreibt Dauern mit Stunden erst ab einer Stunde', () => {
    expect(formatDuration(300)).toBe('5 min')
    expect(formatDuration(4500)).toBe('1 h 15 min')
    expect(formatDuration(-10)).toBe('0 min')
  })

  it('normalisiert Adressen fuer den Vergleich', () => {
    expect(normalizeAddress('Ortsstraße 36-38, 66424 Homburg')).toBe(
      'ortsstrasse 36 38 66424 homburg'
    )
  })
})
