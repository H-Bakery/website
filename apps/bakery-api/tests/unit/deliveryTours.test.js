/**
 * Rechenlogik der Liefertouren. Reines JS ohne Netz - `delivery-geo.core.js`
 * wird hier bewusst nicht angefasst, damit die Tests offline laufen.
 */
const core = require('../../src/services/delivery-tours.core')

const DEPOT = { lat: 49.3015165, lon: 7.3695327 } // Eckstraße 3, Kirrberg
const CAP_MARKT = { id: 1, lat: 49.300633, lon: 7.3663013, status: 'open' }
const TALSTRASSE = { id: 2, lat: 49.3214815, lon: 7.3392, status: 'open' }
const KAISERSTRASSE = { id: 3, lat: 49.3222198, lon: 7.3372, status: 'open' }

describe('haversineMeters', () => {
  test('misst Kirrberg -> Homburg Mitte auf etwa 3,8 km', () => {
    const meters = core.haversineMeters(DEPOT, { lat: 49.3226, lon: 7.3389 })
    expect(meters).toBeGreaterThan(3000)
    expect(meters).toBeLessThan(4500)
  })

  test('ist null fuer denselben Punkt', () => {
    expect(core.haversineMeters(DEPOT, DEPOT)).toBe(0)
  })
})

describe('hasCoordinates', () => {
  // Regression: `Number(null)` ist 0. Ein noch nicht gefundener Stopp waere
  // damit als Punkt (0, 0) durchgegangen - im Atlantik vor Afrika - und haette
  // Reihenfolge und Kilometer der ganzen Tour verdorben.
  test('erkennt null, undefined und Leerstring als "keine Koordinaten"', () => {
    expect(core.hasCoordinates({ lat: null, lon: null })).toBe(false)
    expect(core.hasCoordinates({ lat: undefined, lon: undefined })).toBe(false)
    expect(core.hasCoordinates({ lat: '', lon: '' })).toBe(false)
    expect(core.hasCoordinates({ lat: 49.3, lon: null })).toBe(false)
    expect(core.hasCoordinates(null)).toBe(false)
  })

  test('akzeptiert echte Koordinaten, auch als String', () => {
    expect(core.hasCoordinates({ lat: 49.3, lon: 7.36 })).toBe(true)
    expect(core.hasCoordinates({ lat: '49.3', lon: '7.36' })).toBe(true)
    expect(core.hasCoordinates({ lat: 0, lon: 0 })).toBe(true)
  })
})

describe('formatAddress / normalizeAddress', () => {
  test('setzt Straße, PLZ und Ort zusammen', () => {
    expect(
      core.formatAddress({
        street: 'Ortsstraße 36-38',
        zip: '66424',
        city: 'Homburg',
      })
    ).toBe('Ortsstraße 36-38, 66424 Homburg')
  })

  test('laesst fehlende Teile weg, statt Kommas zu haeufen', () => {
    expect(
      core.formatAddress({ street: 'Eckstraße 3', zip: '', city: '' })
    ).toBe('Eckstraße 3')
    expect(core.formatAddress({})).toBe('')
  })

  test('macht Adressen fuer den Cache vergleichbar', () => {
    expect(core.normalizeAddress('Ortsstraße 36-38, 66424 Homburg')).toBe(
      core.normalizeAddress('ortsstrasse  36 - 38 , 66424 homburg')
    )
  })
})

describe('orderStopsNearestNeighbour', () => {
  test('beginnt beim naechstgelegenen Stopp zum Depot', () => {
    const order = core
      .orderStopsNearestNeighbour(DEPOT, [KAISERSTRASSE, TALSTRASSE, CAP_MARKT])
      .map((s) => s.id)
    expect(order[0]).toBe(CAP_MARKT.id)
  })

  test('haengt nicht auffindbare Stopps hinten an, statt sie zu verwerfen', () => {
    const unbekannt = { id: 9, lat: null, lon: null, status: 'open' }
    const ordered = core.orderStopsNearestNeighbour(DEPOT, [
      unbekannt,
      KAISERSTRASSE,
      CAP_MARKT,
    ])
    expect(ordered).toHaveLength(3)
    expect(ordered[ordered.length - 1].id).toBe(9)
  })

  test('ist unabhaengig von der Eingabereihenfolge', () => {
    const a = core
      .orderStopsNearestNeighbour(DEPOT, [KAISERSTRASSE, TALSTRASSE, CAP_MARKT])
      .map((s) => s.id)
    const b = core
      .orderStopsNearestNeighbour(DEPOT, [CAP_MARKT, KAISERSTRASSE, TALSTRASSE])
      .map((s) => s.id)
    expect(a).toEqual(b)
  })
})

describe('estimateTour', () => {
  test('rechnet Strecke, Zeit und Standzeit je Stopp', () => {
    const estimate = core.estimateTour(DEPOT, [CAP_MARKT, TALSTRASSE], 'car')
    expect(estimate.distance).toBeGreaterThan(0)
    expect(estimate.duration).toBeGreaterThan(2 * core.STOP_SERVICE_TIME)
    expect(estimate.isEstimate).toBe(true)
  })

  test('ignoriert Stopps ohne Koordinaten', () => {
    const mitLeiche = core.estimateTour(
      DEPOT,
      [CAP_MARKT, { id: 9, lat: null, lon: null }],
      'car'
    )
    const ohne = core.estimateTour(DEPOT, [CAP_MARKT], 'car')
    expect(mitLeiche.distance).toBeCloseTo(ohne.distance, 6)
  })

  test('gibt fuer eine leere Tour null Kilometer zurueck', () => {
    expect(core.estimateTour(DEPOT, [], 'car').distance).toBe(0)
  })
})

describe('estimateArrivals', () => {
  test('vergibt aufsteigende Zeiten ab dem Start', () => {
    const arrivals = core.estimateArrivals(
      DEPOT,
      [CAP_MARKT, KAISERSTRASSE],
      '2026-09-05T05:00:00.000Z',
      'car'
    )
    expect(Date.parse(arrivals[1])).toBeGreaterThan(
      Date.parse('2026-09-05T05:00:00Z')
    )
    expect(Date.parse(arrivals[3])).toBeGreaterThan(Date.parse(arrivals[1]))
  })

  test('sagt fuer Stopps ohne Koordinaten nichts vorher', () => {
    const arrivals = core.estimateArrivals(
      DEPOT,
      [{ id: 9, lat: null, lon: null }],
      '2026-09-05T05:00:00.000Z',
      'car'
    )
    expect(arrivals[9]).toBeUndefined()
  })
})

describe('tourProgress / nextOpenStop', () => {
  const tour = {
    stops: [
      { id: 1, status: 'done' },
      { id: 2, status: 'failed' },
      { id: 3, status: 'open' },
    ],
  }

  test('zaehlt erledigt, gescheitert und offen', () => {
    expect(core.tourProgress(tour)).toEqual({
      total: 3,
      done: 1,
      failed: 1,
      open: 1,
      isComplete: false,
    })
  })

  test('gilt als fertig, wenn kein Stopp mehr offen ist', () => {
    const fertig = { stops: [{ status: 'done' }, { status: 'failed' }] }
    expect(core.tourProgress(fertig).isComplete).toBe(true)
  })

  test('eine leere Tour ist nicht "fertig"', () => {
    expect(core.tourProgress({ stops: [] }).isComplete).toBe(false)
  })

  test('nennt den ersten offenen Stopp in Tourreihenfolge', () => {
    expect(core.nextOpenStop(tour).id).toBe(3)
    expect(core.nextOpenStop({ stops: [{ status: 'done' }] })).toBeNull()
  })
})

describe('normalizeStopInput', () => {
  test('verlangt Kunde und Straße', () => {
    expect(core.normalizeStopInput({ street: 'Talstraße 5' }, null).error).toBe(
      'Customer is required'
    )
    expect(core.normalizeStopInput({ customer: 'Müller' }, null).error).toBe(
      'Street is required'
    )
  })

  test('setzt Homburg als Ort und Stück als Einheit vor', () => {
    const { stop } = core.normalizeStopInput(
      {
        customer: 'Müller',
        street: 'Talstraße 5',
        items: [{ name: 'Brot', qty: 2 }],
      },
      null
    )
    expect(stop.city).toBe('Homburg')
    expect(stop.status).toBe('open')
    expect(stop.items).toEqual([{ name: 'Brot', qty: 2, unit: 'Stück' }])
  })

  test('wirft Positionen ohne Namen weg', () => {
    const { stop } = core.normalizeStopInput(
      {
        customer: 'Müller',
        street: 'Talstraße 5',
        items: [
          { name: '', qty: 3 },
          { name: 'Brot', qty: 1 },
        ],
      },
      null
    )
    expect(stop.items).toHaveLength(1)
  })

  test('stempelt das Abhaken und traegt einen Grund ein', () => {
    const bestehend = {
      customer: 'Müller',
      street: 'Talstraße 5',
      status: 'open',
    }
    const geliefert = core.normalizeStopInput(
      { status: 'done' },
      bestehend
    ).stop
    expect(geliefert.completedAt).toBeTruthy()
    expect(geliefert.failureReason).toBeNull()

    const gescheitert = core.normalizeStopInput(
      { status: 'failed' },
      bestehend
    ).stop
    expect(gescheitert.failureReason).toBe('Nicht angetroffen')
  })

  test('setzt ein Zurueckstellen auf offen sauber zurueck', () => {
    const erledigt = {
      customer: 'Müller',
      street: 'Talstraße 5',
      status: 'done',
      completedAt: '2026-09-05T06:00:00.000Z',
      failureReason: null,
    }
    const zurueck = core.normalizeStopInput({ status: 'open' }, erledigt).stop
    expect(zurueck.completedAt).toBeNull()
    expect(zurueck.failureReason).toBeNull()
  })

  test('erlaubt manuelle Koordinaten und ihr Loeschen', () => {
    const bestehend = {
      customer: 'Müller',
      street: 'Talstraße 5',
      status: 'open',
    }
    const gesetzt = core.normalizeStopInput(
      { lat: 49.32, lon: 7.34 },
      bestehend
    ).stop
    expect(gesetzt.geocodeSource).toBe('manual')

    const geloescht = core.normalizeStopInput(
      { lat: null, lon: null },
      gesetzt
    ).stop
    expect(geloescht.lat).toBeNull()
    expect(geloescht.geocodeSource).toBeNull()
  })

  test('lehnt unbekannte Status ab', () => {
    expect(
      core.normalizeStopInput(
        { customer: 'Müller', street: 'Talstraße 5', status: 'unterwegs' },
        null
      ).error
    ).toBe('Invalid status')
  })
})

describe('normalizePhone', () => {
  test('behaelt nur Ziffern und ein fuehrendes Plus', () => {
    expect(core.normalizePhone('+49 6841 / 22-29')).toBe('+4968412229')
  })

  test('macht aus Unsinn null statt einer kaputten Nummer', () => {
    expect(core.normalizePhone('k. A.')).toBeNull()
    expect(core.normalizePhone('')).toBeNull()
    expect(core.normalizePhone(null)).toBeNull()
  })
})

describe('Datumshilfen', () => {
  test('findet den naechsten Samstag', () => {
    // 2026-09-02 ist ein Mittwoch.
    expect(core.nextWeekday(new Date('2026-09-02T10:00:00'), 6)).toBe(
      '2026-09-05'
    )
  })

  test('gibt an einem Samstag denselben Tag zurueck', () => {
    expect(core.nextWeekday(new Date('2026-09-05T10:00:00'), 6)).toBe(
      '2026-09-05'
    )
  })

  // `toISOString()` waere UTC: ein spaeter Abend rutschte auf den Folgetag.
  test('formatiert das lokale Datum, nicht UTC', () => {
    expect(core.toBusinessDate(new Date(2026, 8, 5, 23, 30))).toBe('2026-09-05')
  })

  test('prueft das Datumsformat', () => {
    expect(core.isBusinessDate('2026-09-05')).toBe(true)
    expect(core.isBusinessDate('05.09.2026')).toBe(false)
    expect(core.isBusinessDate(undefined)).toBe(false)
  })
})
