import {
  calculateDistance,
  clearLocationWatch,
  formatDistance,
  getCurrentLocation,
  watchLocation,
} from './delivery-tracking'

const BACKSTUBE = {
  latitude: 49.3015165,
  longitude: 7.3695327,
  timestamp: new Date('2026-09-05T06:00:00Z'),
}
const HOMBURG_MITTE = {
  latitude: 49.3226,
  longitude: 7.3389,
  timestamp: new Date('2026-09-05T06:00:00Z'),
}

function position(overrides: Partial<GeolocationCoordinates> = {}) {
  return {
    coords: {
      latitude: 49.3015165,
      longitude: 7.3695327,
      accuracy: 12,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      ...overrides,
    },
    timestamp: Date.parse('2026-09-05T06:00:00Z'),
  }
}

describe('calculateDistance', () => {
  it('misst Kirrberg -> Homburg Mitte auf etwa 3,8 km', () => {
    const meters = calculateDistance(BACKSTUBE, HOMBURG_MITTE)
    expect(meters).toBeGreaterThan(3000)
    expect(meters).toBeLessThan(4500)
  })

  it('ist null fuer denselben Punkt', () => {
    expect(calculateDistance(BACKSTUBE, BACKSTUBE)).toBe(0)
  })
})

describe('formatDistance', () => {
  it('wechselt bei einem Kilometer die Einheit', () => {
    expect(formatDistance(999)).toBe('999m')
    expect(formatDistance(1500)).toBe('1.5km')
  })
})

describe('Geolocation-Wrapper', () => {
  const geolocation = {
    getCurrentPosition: jest.fn(),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(globalThis as unknown as { navigator: unknown }).navigator = {
      geolocation,
    }
  })

  it('reicht Koordinaten und Genauigkeit durch', async () => {
    geolocation.getCurrentPosition.mockImplementation(
      (onSuccess: (p: unknown) => void) => onSuccess(position())
    )

    const location = await getCurrentLocation()
    expect(location.latitude).toBeCloseTo(49.3015165, 6)
    expect(location.accuracy).toBe(12)
    expect(location.timestamp).toBeInstanceOf(Date)
  })

  // `speed: 0` heisst "steht", nicht "unbekannt". Das darf nicht zu undefined
  // werden - die Oberflaeche unterscheidet beides.
  it('behaelt eine Geschwindigkeit von 0 als 0', async () => {
    geolocation.getCurrentPosition.mockImplementation(
      (onSuccess: (p: unknown) => void) =>
        onSuccess(position({ speed: 0, heading: 0 }))
    )

    const location = await getCurrentLocation()
    expect(location.speed).toBe(0)
    expect(location.heading).toBe(0)
  })

  it('meldet Fehler der Geolocation weiter', async () => {
    geolocation.getCurrentPosition.mockImplementation(
      (_ok: unknown, onError: (e: unknown) => void) =>
        onError(new Error('Standort verweigert'))
    )

    await expect(getCurrentLocation()).rejects.toThrow('Standort verweigert')
  })

  it('gibt die Watch-ID zurueck und raeumt sie wieder ab', () => {
    geolocation.watchPosition.mockReturnValue(7)
    const id = watchLocation(() => undefined)
    expect(id).toBe(7)

    clearLocationWatch(id)
    expect(geolocation.clearWatch).toHaveBeenCalledWith(7)
  })
})
