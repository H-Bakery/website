import {
  arrivalBaseline,
  buildEstimatedRoute,
  calculateHaversineDistance,
  estimateLeg,
  formatDuration,
  formatRouteDistance,
  hasCoordinates,
  MockMapProvider,
  normalizeAddress,
  optimizeRouteOrder,
  parseTimeWindow,
  Route,
  RouteWaypoint,
  timeWindowBounds,
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

describe('hasCoordinates', () => {
  it('erkennt fehlende Werte als "keine Koordinaten"', () => {
    expect(hasCoordinates(null)).toBe(false)
    expect(hasCoordinates(undefined)).toBe(false)
    expect(hasCoordinates({ lat: null, lon: null })).toBe(false)
    expect(hasCoordinates({ lat: undefined, lon: undefined })).toBe(false)
    expect(hasCoordinates({ lat: '', lon: '' })).toBe(false)
    expect(hasCoordinates({ lat: 49.3, lon: null })).toBe(false)
    expect(hasCoordinates({ lat: NaN, lon: 7.36 })).toBe(false)
  })

  it('akzeptiert echte Koordinaten, auch als String', () => {
    expect(hasCoordinates({ lat: 49.3, lon: 7.36 })).toBe(true)
    expect(hasCoordinates({ lat: '49.3', lon: '7.36' })).toBe(true)
    expect(hasCoordinates({ lat: 0, lon: 7.36 })).toBe(true)
  })

  // (0, 0) ist "Null Island" im Golf von Guinea - das Ergebnis von
  // `Number(null)`, nie eine Lieferadresse. Leaflet zoege die Karte dorthin.
  it('lehnt (0, 0) und Werte ausserhalb des Wertebereichs ab', () => {
    expect(hasCoordinates({ lat: 0, lon: 0 })).toBe(false)
    expect(hasCoordinates({ lat: 999, lon: 7.36 })).toBe(false)
    expect(hasCoordinates({ lat: 49.3, lon: -181 })).toBe(false)
    expect(hasCoordinates({ lat: 90, lon: 180 })).toBe(true)
  })
})

describe('arrivalBaseline', () => {
  const DEPOT = { lat: 49.3015165, lon: 7.3695327 }
  const localIso = (date: string, time: string) =>
    new Date(`${date}T${time}:00`).toISOString()

  it('rechnet eine geplante Tour ab Datum und geplanter Abfahrt', () => {
    const twoDaysBefore = Date.parse('2026-09-03T07:00:00.000Z')
    const baseline = arrivalBaseline(
      DEPOT,
      { date: '2026-09-05', plannedStart: '06:30', startedAt: null },
      twoDaysBefore
    )
    expect(baseline.origin).toBe(DEPOT)
    expect(baseline.startedAt).toBe(localIso('2026-09-05', '06:30'))
  })

  // Regression: am Tourtag um 10:48 stand an einer geplanten Tour
  // "Ankunft ca. 06:38".
  it('rechnet eine geplante Tour nie frueher als jetzt', () => {
    const lateMorning = Date.parse(localIso('2026-09-05', '10:48'))
    const baseline = arrivalBaseline(
      DEPOT,
      { date: '2026-09-05', plannedStart: '06:30', startedAt: null },
      lateMorning
    )
    expect(baseline.startedAt).toBe(new Date(lateMorning).toISOString())
  })

  it('rechnet eine laufende Tour ab dem zuletzt erledigten Stopp', () => {
    const now = Date.parse('2026-09-05T07:00:00.000Z')
    const done = {
      id: 1,
      lat: 49.300633,
      lon: 7.3663013,
      status: 'done',
      completedAt: '2026-09-05T06:40:00.000Z',
    }
    const baseline = arrivalBaseline(
      DEPOT,
      {
        date: '2026-09-05',
        startedAt: '2026-09-05T04:30:00.000Z',
        stops: [done, { id: 2, lat: 49.32, lon: 7.34, status: 'open' }],
      },
      now
    )
    expect(baseline.origin).toBe(done)
    expect(baseline.startedAt).toBe('2026-09-05T07:00:00.000Z')
  })

  it('zieht eine juengere Fahrerposition dem letzten Stopp vor', () => {
    const now = Date.parse('2026-09-05T07:00:00.000Z')
    const lastPosition = {
      lat: 49.31,
      lon: 7.35,
      at: '2026-09-05T06:50:00.000Z',
    }
    const baseline = arrivalBaseline(
      DEPOT,
      {
        date: '2026-09-05',
        startedAt: '2026-09-05T04:30:00.000Z',
        lastPosition,
        stops: [
          {
            id: 1,
            lat: 49.300633,
            lon: 7.3663013,
            status: 'done',
            completedAt: '2026-09-05T06:40:00.000Z',
          },
        ],
      },
      now
    )
    expect(baseline.origin).toBe(lastPosition)
  })
})

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

  // Die Sammelstelle Moersbach hat das Fenster 09:00-09:30. Als naechster
  // Nachbar stand sie um 06:34 auf Platz 1, der Stopp mit 08:00-09:00 dahinter.
  it('sortiert Stopps mit Zeitfenster nach Fensterbeginn', () => {
    const sammelstelle = {
      ...waypoint('Sammelstelle', 49.302619, 7.3937453),
      timeWindow: '09:00-09:30',
    }
    const kunde = {
      ...waypoint('Kunde', 49.3214815, 7.338267),
      timeWindow: '08:00-09:00',
    }
    const capMarkt = {
      ...waypoint('CAP-Markt', 49.300633, 7.3663013),
      timeWindow: '07:00-08:00',
    }

    const order = optimizeRouteOrder(
      [sammelstelle, kunde, capMarkt],
      BACKSTUBE,
      { startedAt: new Date('2026-09-19T06:30:00'), date: '2026-09-19' }
    ).map((w) => w.address)

    expect(order).toEqual(['CAP-Markt', 'Kunde', 'Sammelstelle'])
  })

  it('bedient einen Stopp ohne Fenster, wo er ohne Wartezeit passt', () => {
    const sammelstelle = {
      ...waypoint('Sammelstelle', 49.302619, 7.3937453),
      timeWindow: '09:00-09:30',
    }
    const order = optimizeRouteOrder([sammelstelle, nah, fern], BACKSTUBE, {
      startedAt: new Date('2026-09-19T06:30:00'),
      date: '2026-09-19',
    }).map((w) => w.address)

    expect(order).toEqual(['nah', 'fern', 'Sammelstelle'])
  })

  it('ohne Startzeit bleibt es beim Nearest Neighbour', () => {
    const sammelstelle = {
      ...waypoint('Sammelstelle', 49.302, 7.37),
      timeWindow: '09:00-09:30',
    }
    const order = optimizeRouteOrder([fern, sammelstelle, mittel], BACKSTUBE)
    expect(order.map((w) => w.address)).toEqual([
      'Sammelstelle',
      'mittel',
      'fern',
    ])
  })
})

describe('parseTimeWindow', () => {
  it('liest Fenster mit Beginn und Ende in mehreren Schreibweisen', () => {
    expect(parseTimeWindow('09:00-09:30')).toEqual({
      start: '09:00',
      end: '09:30',
    })
    expect(parseTimeWindow('9:00 – 9:30')).toEqual({
      start: '09:00',
      end: '09:30',
    })
    expect(parseTimeWindow('07:00 bis 08:00')).toEqual({
      start: '07:00',
      end: '08:00',
    })
  })

  it('kennt "ab" und "bis" mit nur einer Grenze', () => {
    expect(parseTimeWindow('ab 09:00')).toEqual({ start: '09:00', end: null })
    expect(parseTimeWindow('bis 09:30')).toEqual({ start: null, end: '09:30' })
  })

  it('deutet eine einzelne Uhrzeit nur mit erkennbarem Praefix', () => {
    expect(parseTimeWindow('spätestens 09:30')).toEqual({
      start: null,
      end: '09:30',
    })
    expect(parseTimeWindow('nicht vor 10:00')).toEqual({
      start: '10:00',
      end: null,
    })
    expect(parseTimeWindow('09:00 Uhr')).toBeNull()
    expect(parseTimeWindow('ca. 12:30')).toBeNull()
  })

  it('liest die deutsche Punkt-Schreibweise, aber kein Datum', () => {
    expect(parseTimeWindow('08.00-09.00')).toEqual({
      start: '08:00',
      end: '09:00',
    })
    expect(parseTimeWindow('19.09.2026')).toBeNull()
  })

  it('laesst Freitext und Unsinn ohne Wirkung', () => {
    expect(parseTimeWindow('vormittags')).toBeNull()
    expect(parseTimeWindow('')).toBeNull()
    expect(parseTimeWindow(null)).toBeNull()
    expect(parseTimeWindow('10:00-09:00')).toBeNull()
    expect(parseTimeWindow('25:00-26:00')).toBeNull()
  })

  it('legt die Grenzen auf den Tourtag in lokaler Zeit', () => {
    const bounds = timeWindowBounds('2026-09-19', '09:00-09:30')
    expect(bounds.start).toBe(Date.parse('2026-09-19T09:00:00'))
    expect(bounds.end).toBe(Date.parse('2026-09-19T09:30:00'))
    expect(timeWindowBounds('2026-09-19', 'vormittags')).toEqual({
      start: null,
      end: null,
    })
    expect(timeWindowBounds(null, '09:00-09:30')).toEqual({
      start: null,
      end: null,
    })
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

  it('wartet auf den Fensterbeginn und schiebt die Folge-ETAs', () => {
    const start = new Date('2026-09-19T06:30:00')
    const route: Route = buildEstimatedRoute({
      origin: { ...BACKSTUBE, timestamp: start },
      destinations: [
        {
          ...waypoint('Sammelstelle', 49.302619, 7.3937453),
          timeWindow: '09:00-09:30',
        },
        waypoint('Danach', 49.31, 7.36),
      ],
    })

    const withEta = withEstimatedArrivals(route, start, 'car', '2026-09-19')
    const [, sammelstelle, danach] = withEta.waypoints

    expect(sammelstelle.estimatedArrival?.getTime()).toBe(
      Date.parse('2026-09-19T09:00:00')
    )
    expect(sammelstelle.waitSeconds).toBeGreaterThan(2 * 3600)
    expect(sammelstelle.missesTimeWindow).toBe(false)
    expect(danach.estimatedArrival?.getTime()).toBeGreaterThan(
      Date.parse('2026-09-19T09:03:00')
    )
    expect(danach.waitSeconds).toBe(0)
  })

  it('markiert ein Fenster, das nicht mehr einhaltbar ist', () => {
    const start = new Date('2026-09-19T09:40:00')
    const route: Route = buildEstimatedRoute({
      origin: { ...BACKSTUBE, timestamp: start },
      destinations: [
        {
          ...waypoint('Sammelstelle', 49.302619, 7.3937453),
          timeWindow: '09:00-09:30',
        },
      ],
    })

    const [, sammelstelle] = withEstimatedArrivals(
      route,
      start,
      'car',
      '2026-09-19'
    ).waypoints
    expect(sammelstelle.missesTimeWindow).toBe(true)
    expect(sammelstelle.waitSeconds).toBe(0)
    expect(sammelstelle.estimatedArrival?.getTime()).toBeGreaterThan(
      start.getTime()
    )
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
