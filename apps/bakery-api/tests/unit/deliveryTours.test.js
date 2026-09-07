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
    expect(core.hasCoordinates({ lat: -33.9, lon: 151.2 })).toBe(true)
    expect(core.hasCoordinates({ lat: 90, lon: -180 })).toBe(true)
  })

  // (0, 0) liegt im Golf von Guinea und ist das klassische Ergebnis von
  // `Number(null)` - als Depot- oder Stopp-Koordinate immer ein Fehler.
  test('lehnt (0, 0) und Werte ausserhalb des Wertebereichs ab', () => {
    expect(core.hasCoordinates({ lat: 0, lon: 0 })).toBe(false)
    expect(core.hasCoordinates({ lat: '0', lon: '0' })).toBe(false)
    expect(core.hasCoordinates({ lat: 999, lon: 7.36 })).toBe(false)
    expect(core.hasCoordinates({ lat: 49.3, lon: -181 })).toBe(false)
    expect(core.hasCoordinates({ lat: 90.0001, lon: 7 })).toBe(false)
    // Ein einzelner Nullwert ist erlaubt - der Aequator und der Nullmeridian
    // existieren, nur ihr Schnittpunkt ist verdaechtig.
    expect(core.hasCoordinates({ lat: 0, lon: 7.36 })).toBe(true)
    expect(core.hasCoordinates({ lat: 49.3, lon: 0 })).toBe(true)
    expect(core.isLatitude(-90)).toBe(true)
    expect(core.isLatitude(-90.5)).toBe(false)
    expect(core.isLongitude('180')).toBe(true)
    expect(core.isLongitude(180.5)).toBe(false)
  })

  // `Number(true)` ist 1, `Number([])` und `Number(' ')` sind 0 - aus einem
  // JSON-Body waeren das alles "gueltige" Koordinaten gewesen.
  test('laesst sich von Booleans, Arrays und Leerraum nicht taeuschen', () => {
    expect(core.isNumber(true)).toBe(false)
    expect(core.isNumber([])).toBe(false)
    expect(core.isNumber([49.3])).toBe(false)
    expect(core.isNumber(' ')).toBe(false)
    expect(core.isNumber({})).toBe(false)
    expect(core.isNumber(NaN)).toBe(false)
  })
})

describe('validateCoordinates', () => {
  test('gibt gueltige Paare als Zahlen zurueck', () => {
    expect(core.validateCoordinates('49.3', 7.36)).toEqual({
      lat: 49.3,
      lon: 7.36,
    })
  })

  test('meldet fehlende, halbe und unsinnige Paare mit deutschem Text', () => {
    for (const [lat, lon] of [
      [null, null],
      [49.3, null],
      [undefined, 7.36],
      ['abc', 7.36],
      [true, 7.36],
    ]) {
      const result = core.validateCoordinates(lat, lon)
      expect(result.error).toBe('Invalid coordinates')
      expect(result.message).toMatch(/Zahlen/)
    }
  })

  test('meldet Werte ausserhalb des Wertebereichs und (0, 0)', () => {
    expect(core.validateCoordinates(999, 7.36).error).toBe(
      'Coordinates out of range'
    )
    expect(core.validateCoordinates(49.3, -500).error).toBe(
      'Coordinates out of range'
    )
    const island = core.validateCoordinates(0, 0)
    expect(island.error).toBe('Coordinates out of range')
    expect(island.message).toMatch(/\(0, 0\)/)
  })
})

describe('scrubCoordinates', () => {
  test('setzt (0, 0) und Werte ausserhalb des Bereichs auf null', () => {
    const stop = {
      lat: 0,
      lon: 0,
      geocodeSource: 'manual',
      geocodePrecision: null,
    }
    expect(core.scrubCoordinates(stop)).toBe(true)
    expect(stop).toEqual({
      lat: null,
      lon: null,
      geocodeSource: null,
      geocodePrecision: null,
    })

    const depot = { lat: 999, lon: 7.36 }
    expect(core.scrubCoordinates(depot)).toBe(true)
    expect(depot).toEqual({ lat: null, lon: null })
  })

  test('laesst gueltige und bereits leere Punkte in Ruhe', () => {
    const ok = { lat: 49.3, lon: 7.36, geocodeSource: 'nominatim' }
    expect(core.scrubCoordinates(ok)).toBe(false)
    expect(ok.geocodeSource).toBe('nominatim')
    expect(core.scrubCoordinates({ lat: null, lon: null })).toBe(false)
    expect(core.scrubCoordinates({ street: 'Talstraße 5' })).toBe(false)
    expect(core.scrubCoordinates(null)).toBe(false)
  })
})

describe('isClockTime', () => {
  test('akzeptiert nur HH:MM mit 00-23 und 00-59', () => {
    for (const ok of ['00:00', '06:30', '23:59', '09:05']) {
      expect(core.isClockTime(ok)).toBe(true)
    }
    for (const bad of [
      '99:99',
      '24:00',
      '25:61',
      '6:30',
      '06:3',
      '06.30',
      '',
      null,
      undefined,
      630,
      '06:30:00',
    ]) {
      expect(core.isClockTime(bad)).toBe(false)
    }
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

  // Dieselbe Falle wie bei den Stopps, eine Ebene hoeher: ein Depot ohne
  // Koordinaten darf nicht als (0, 0) den Startpunkt in den Atlantik legen.
  test('laesst die Reihenfolge stehen, wenn das Depot keine Koordinaten hat', () => {
    const ohneDepot = { lat: null, lon: null }
    const order = core
      .orderStopsNearestNeighbour(ohneDepot, [
        KAISERSTRASSE,
        TALSTRASSE,
        CAP_MARKT,
      ])
      .map((s) => s.id)
    expect(order).toEqual([KAISERSTRASSE.id, TALSTRASSE.id, CAP_MARKT.id])
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

  test('kennt ohne Depot-Koordinaten keine Strecke, statt ab (0, 0) zu rechnen', () => {
    const estimate = core.estimateTour(
      { lat: null, lon: null },
      [CAP_MARKT],
      'car'
    )
    expect(estimate.distance).toBeNull()
    expect(estimate.duration).toBeNull()
    expect(estimate.isEstimate).toBe(true)
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

  test('sagt ohne Depot-Koordinaten gar nichts vorher', () => {
    const arrivals = core.estimateArrivals(
      { lat: null, lon: null },
      [CAP_MARKT],
      '2026-09-05T05:00:00.000Z',
      'car'
    )
    expect(arrivals).toEqual({})
  })
})

describe('arrivalBaseline', () => {
  const NOW = Date.parse('2026-09-05T07:00:00.000Z')
  // Die geplante Abfahrt ist eine Ortszeit ohne Zeitzone - so wie sie
  // `arrivalBaseline` aus `date + plannedStart` baut.
  const localIso = (date, time) => new Date(`${date}T${time}:00`).toISOString()

  test('rechnet eine geplante Tour ab Datum und geplanter Abfahrt', () => {
    // Zwei Tage vor der Tour: die Abfahrt liegt in der Zukunft.
    const twoDaysBefore = Date.parse('2026-09-03T07:00:00.000Z')
    const baseline = core.arrivalBaseline(
      DEPOT,
      { date: '2026-09-05', plannedStart: '06:30', startedAt: null, stops: [] },
      twoDaysBefore
    )
    expect(baseline.origin).toBe(DEPOT)
    expect(baseline.startedAt).toBe(localIso('2026-09-05', '06:30'))
  })

  test('nimmt 06:30 als Abfahrt, wenn keine geplant ist', () => {
    const twoDaysBefore = Date.parse('2026-09-03T07:00:00.000Z')
    const baseline = core.arrivalBaseline(
      DEPOT,
      { date: '2026-09-05', startedAt: null, stops: [] },
      twoDaysBefore
    )
    expect(baseline.startedAt).toBe(localIso('2026-09-05', '06:30'))
  })

  // Regression: am Tourtag um 10:48 stand an einer geplanten Tour "Ankunft
  // ca. 06:38" - die Abfahrt war laengst vorbei, der Fahrer hatte nur noch
  // nichts abgehakt.
  test('rechnet eine geplante Tour nie frueher als jetzt', () => {
    const lateMorning = Date.parse(localIso('2026-09-05', '10:48'))
    const baseline = core.arrivalBaseline(
      DEPOT,
      { date: '2026-09-05', plannedStart: '06:30', startedAt: null, stops: [] },
      lateMorning
    )
    expect(baseline.origin).toBe(DEPOT)
    expect(baseline.startedAt).toBe(new Date(lateMorning).toISOString())
  })

  test('faellt bei kaputter Abfahrtszeit auf 06:30 zurueck', () => {
    const twoDaysBefore = Date.parse('2026-09-03T07:00:00.000Z')
    const baseline = core.arrivalBaseline(
      DEPOT,
      { date: '2026-09-05', plannedStart: '99:99', startedAt: null, stops: [] },
      twoDaysBefore
    )
    expect(baseline.startedAt).toBe(localIso('2026-09-05', '06:30'))
  })

  test('rechnet eine laufende Tour ab dem zuletzt erledigten Stopp', () => {
    const tour = {
      date: '2026-09-05',
      startedAt: '2026-09-05T04:30:00.000Z',
      lastPosition: null,
      stops: [
        {
          ...CAP_MARKT,
          status: 'done',
          completedAt: '2026-09-05T05:00:00.000Z',
        },
        {
          ...TALSTRASSE,
          status: 'failed',
          completedAt: '2026-09-05T06:40:00.000Z',
        },
        { ...KAISERSTRASSE, status: 'open' },
      ],
    }
    const baseline = core.arrivalBaseline(DEPOT, tour, NOW)
    expect(baseline.origin.id).toBe(TALSTRASSE.id)
    // Der letzte Stopp war um 06:40, jetzt ist 07:00 - eine Ankunft in der
    // Vergangenheit gibt es nicht.
    expect(baseline.startedAt).toBe('2026-09-05T07:00:00.000Z')
  })

  test('zieht eine juengere Fahrerposition dem letzten Stopp vor', () => {
    const tour = {
      date: '2026-09-05',
      startedAt: '2026-09-05T04:30:00.000Z',
      lastPosition: { lat: 49.31, lon: 7.35, at: '2026-09-05T06:50:00.000Z' },
      stops: [
        {
          ...CAP_MARKT,
          status: 'done',
          completedAt: '2026-09-05T06:40:00.000Z',
        },
        { ...KAISERSTRASSE, status: 'open' },
      ],
    }
    const baseline = core.arrivalBaseline(DEPOT, tour, NOW)
    expect(baseline.origin).toBe(tour.lastPosition)
  })

  test('faellt ohne erledigte Stopps auf Depot und Startzeit zurueck', () => {
    const tour = {
      date: '2026-09-05',
      startedAt: '2026-09-05T07:15:00.000Z',
      lastPosition: null,
      stops: [{ ...CAP_MARKT, status: 'open' }],
    }
    const baseline = core.arrivalBaseline(DEPOT, tour, NOW)
    expect(baseline.origin).toBe(DEPOT)
    expect(baseline.startedAt).toBe('2026-09-05T07:15:00.000Z')
  })
})

describe('applyOpenStopOrder', () => {
  const stops = [
    { id: 1, status: 'done' },
    { id: 2, status: 'open' },
    { id: 3, status: 'open' },
    { id: 4, status: 'failed' },
    { id: 5, status: 'open' },
  ]

  // Regression: "Route berechnen" auf einer laufenden Tour schob den um
  // sieben Uhr gelieferten CAP-Markt ans Ende und nummerierte alles neu.
  test('laesst erledigte Stopps auf ihrem Platz und sortiert nur offene', () => {
    const result = core.applyOpenStopOrder(stops, [5, 3, 2])
    expect(result.map((s) => s.id)).toEqual([1, 5, 3, 4, 2])
    // Dieselben Objekte, kein Kopieren.
    expect(result[0]).toBe(stops[0])
    expect(result[1]).toBe(stops[4])
  })

  test('haengt offene Stopps ohne Platz in der Reihenfolge hinten an', () => {
    // Stopp 2 hat keine Koordinaten und fehlt in der Router-Antwort.
    const result = core.applyOpenStopOrder(stops, [5, 3])
    expect(result.map((s) => s.id)).toEqual([1, 5, 3, 4, 2])
  })

  test('aendert ohne offene Stopps nichts', () => {
    const finished = [
      { id: 1, status: 'done' },
      { id: 2, status: 'failed' },
    ]
    expect(core.applyOpenStopOrder(finished, [2, 1]).map((s) => s.id)).toEqual([
      1, 2,
    ])
    expect(core.applyOpenStopOrder([], [1])).toEqual([])
  })

  test('nimmt IDs auch als Strings', () => {
    const result = core.applyOpenStopOrder(stops, ['3', '2', '5'])
    expect(result.map((s) => s.id)).toEqual([1, 3, 2, 4, 5])
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

describe('syncTourStatus', () => {
  const NOW = '2026-09-05T05:00:00.000Z'

  test('startet eine geplante Tour mit dem ersten abgehakten Stopp', () => {
    const tour = {
      status: 'planned',
      startedAt: null,
      finishedAt: null,
      stops: [{ status: 'done' }, { status: 'open' }],
    }
    core.syncTourStatus(tour, NOW)
    expect(tour.status).toBe('active')
    expect(tour.startedAt).toBe(NOW)
    expect(tour.finishedAt).toBeNull()
  })

  test('schliesst die Tour ab, wenn kein Stopp mehr offen ist', () => {
    const tour = {
      status: 'active',
      startedAt: '2026-09-05T04:30:00.000Z',
      finishedAt: null,
      stops: [{ status: 'done' }, { status: 'failed' }],
    }
    core.syncTourStatus(tour, NOW)
    expect(tour.status).toBe('done')
    expect(tour.finishedAt).toBe(NOW)
  })

  // Vorher blieb eine Tour "abgeschlossen", obwohl der Fahrer einen Stopp
  // zurueckgesetzt oder die Backstube einen nachgeschoben hatte.
  test('oeffnet eine abgeschlossene Tour wieder, wenn ein Stopp offen wird', () => {
    const tour = {
      status: 'done',
      startedAt: '2026-09-05T04:30:00.000Z',
      finishedAt: '2026-09-05T04:50:00.000Z',
      stops: [{ status: 'done' }, { status: 'open' }],
    }
    core.syncTourStatus(tour, NOW)
    expect(tour.status).toBe('active')
    expect(tour.finishedAt).toBeNull()
    expect(tour.startedAt).toBe('2026-09-05T04:30:00.000Z')
  })

  test('laesst eine Tour ohne Stopps in Ruhe', () => {
    const tour = {
      status: 'planned',
      startedAt: null,
      finishedAt: null,
      stops: [],
    }
    core.syncTourStatus(tour, NOW)
    expect(tour.status).toBe('planned')
    expect(tour.startedAt).toBeNull()
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

  test('haelt Grund und Verbleib der Ware bei "nicht angetroffen" fest', () => {
    const bestehend = {
      customer: 'Müller',
      street: 'Talstraße 5',
      status: 'open',
    }
    const { stop } = core.normalizeStopInput(
      {
        status: 'failed',
        failureReason: '  Annahme verweigert ',
        goodsDisposition: 'left_at_address',
      },
      bestehend
    )
    expect(stop.failureReason).toBe('Annahme verweigert')
    expect(stop.goodsDisposition).toBe('left_at_address')

    // Ohne Angabe bleibt der Verbleib offen - er wird nicht erfunden.
    const ohne = core.normalizeStopInput({ status: 'failed' }, bestehend).stop
    expect(ohne.goodsDisposition).toBeNull()

    // Ein spaeteres PATCH ohne die Felder laesst die Angaben stehen.
    const nochmal = core.normalizeStopInput({ notes: 'Hund' }, stop).stop
    expect(nochmal.failureReason).toBe('Annahme verweigert')
    expect(nochmal.goodsDisposition).toBe('left_at_address')
  })

  test('lehnt einen unbekannten Verbleib und einen zu langen Grund ab', () => {
    const bestehend = { customer: 'Müller', street: 'Talstraße 5' }
    const verbleib = core.normalizeStopInput(
      { status: 'failed', goodsDisposition: 'eaten' },
      bestehend
    )
    expect(verbleib.error).toBe('Invalid goods disposition')
    expect(verbleib.message).toMatch(/Verbleib der Ware/)

    const grund = core.normalizeStopInput(
      {
        status: 'failed',
        failureReason: 'x'.repeat(core.FAILURE_REASON_MAX_LENGTH + 1),
      },
      bestehend
    )
    expect(grund.error).toBe('Failure reason too long')
    expect(grund.message).toMatch(/Zeichen/)

    // Leer und `null` sind kein Fehler, sondern "keine Angabe".
    expect(
      core.normalizeStopInput(
        { status: 'failed', goodsDisposition: '' },
        bestehend
      ).stop.goodsDisposition
    ).toBeNull()
  })

  test('raeumt Grund und Verbleib beim Zuruecksetzen und beim Liefern weg', () => {
    const gescheitert = {
      customer: 'Müller',
      street: 'Talstraße 5',
      status: 'failed',
      completedAt: '2026-09-05T06:00:00.000Z',
      failureReason: 'Nicht angetroffen',
      goodsDisposition: 'taken_back',
    }
    const offen = core.normalizeStopInput({ status: 'open' }, gescheitert).stop
    expect(offen.failureReason).toBeNull()
    expect(offen.goodsDisposition).toBeNull()

    // Zweiter Versuch geklappt: die Ware ist angekommen, der Verbleib von
    // vorhin stimmt nicht mehr.
    const geliefert = core.normalizeStopInput(
      { status: 'done' },
      gescheitert
    ).stop
    expect(geliefert.failureReason).toBeNull()
    expect(geliefert.goodsDisposition).toBeNull()
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
      geocodePrecision: 'street',
    }
    const gesetzt = core.normalizeStopInput(
      { lat: 49.32, lon: 7.34 },
      bestehend
    ).stop
    expect(gesetzt.geocodeSource).toBe('manual')
    // Von Hand gesetzte Koordinaten sind kein Strassen-Treffer mehr.
    expect(gesetzt.geocodePrecision).toBeNull()

    const geloescht = core.normalizeStopInput(
      { lat: null, lon: null },
      gesetzt
    ).stop
    expect(geloescht.lat).toBeNull()
    expect(geloescht.geocodeSource).toBeNull()
    expect(geloescht.geocodePrecision).toBeNull()
  })

  test('lehnt unbekannte Status ab', () => {
    expect(
      core.normalizeStopInput(
        { customer: 'Müller', street: 'Talstraße 5', status: 'unterwegs' },
        null
      ).error
    ).toBe('Invalid status')
  })

  test('lehnt Koordinaten ausserhalb des Wertebereichs und (0, 0) ab', () => {
    const base = { customer: 'Müller', street: 'Talstraße 5' }
    expect(
      core.normalizeStopInput({ ...base, lat: 999, lon: 7.3 }, null).error
    ).toBe('Coordinates out of range')
    expect(
      core.normalizeStopInput({ ...base, lat: 49.3, lon: -181 }, null).error
    ).toBe('Coordinates out of range')
    const island = core.normalizeStopInput({ ...base, lat: 0, lon: 0 }, null)
    expect(island.error).toBe('Coordinates out of range')
    expect(island.message).toMatch(/\(0, 0\)/)
  })

  test('lehnt ein halbes Koordinatenpaar ab, statt es stumm zu loeschen', () => {
    const base = { customer: 'Müller', street: 'Talstraße 5' }
    expect(core.normalizeStopInput({ ...base, lat: 49.3 }, null).error).toBe(
      'Invalid coordinates'
    )
    expect(
      core.normalizeStopInput({ ...base, lat: 49.3, lon: null }, null).error
    ).toBe('Invalid coordinates')
    // Beide leer heisst weiterhin "loeschen und neu suchen".
    const geloescht = core.normalizeStopInput(
      { ...base, lat: '', lon: '' },
      { ...base, lat: 49.3, lon: 7.3, geocodeSource: 'manual' }
    ).stop
    expect(geloescht.lat).toBeNull()
    expect(geloescht.geocodeSource).toBeNull()
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

  test('lehnt Tage ab, die es nicht gibt', () => {
    expect(core.isBusinessDate('2026-13-45')).toBe(false)
    expect(core.isBusinessDate('2026-02-30')).toBe(false)
    expect(core.isBusinessDate('2028-02-29')).toBe(true)
  })
})
