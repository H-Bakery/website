import {
  buildAddressNavigationUrl,
  buildMultiStopNavigationUrl,
  buildNavigationUrl,
  buildPhoneLink,
  MAX_GOOGLE_WAYPOINTS,
  prefersAppleMaps,
} from './navigation'

const IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36'

const stop = (latitude: number, longitude: number, address?: string) => ({
  latitude,
  longitude,
  address,
})

describe('prefersAppleMaps', () => {
  it('erkennt iOS und macOS', () => {
    expect(prefersAppleMaps(IOS)).toBe(true)
    expect(prefersAppleMaps(ANDROID)).toBe(false)
  })
})

describe('buildNavigationUrl', () => {
  it('nutzt Google Maps auf Android', () => {
    const url = buildNavigationUrl(stop(49.3226, 7.3389), ANDROID)
    expect(url).toContain('google.com/maps/dir/')
    expect(url).toContain('destination=49.3226,7.3389')
    expect(url).toContain('travelmode=driving')
  })

  it('nutzt Apple Maps auf dem iPhone', () => {
    const url = buildNavigationUrl(stop(49.3226, 7.3389, 'Talstraße 5'), IOS)
    expect(url).toContain('maps.apple.com')
    expect(url).toContain('daddr=49.3226,7.3389')
  })

  it('uebergibt bei einem Strassen-Treffer die Adresse statt der Strassenmitte', () => {
    const target = { ...stop(49.3251, 7.3444, 'Talstraße 5'), streetOnly: true }
    expect(buildNavigationUrl(target, ANDROID)).toBe(
      buildAddressNavigationUrl('Talstraße 5', ANDROID)
    )
    expect(buildNavigationUrl(target, IOS)).toBe(
      buildAddressNavigationUrl('Talstraße 5', IOS)
    )
    expect(buildNavigationUrl(target, ANDROID)).not.toContain('49.3251')
  })

  it('bleibt ohne Adresse auch bei einem Strassen-Treffer bei den Koordinaten', () => {
    const url = buildNavigationUrl(
      { ...stop(49.3251, 7.3444), streetOnly: true },
      ANDROID
    )
    expect(url).toContain('destination=49.3251,7.3444')
  })
})

describe('buildAddressNavigationUrl', () => {
  // Fuer Stopps, die nur bis zur Strasse oder gar nicht gefunden wurden:
  // die Navi-App bekommt den Adresstext, nicht die Strassenmitte.
  const ADDRESS = 'Talstraße 5, 66424 Homburg'
  const ENCODED = 'Talstra%C3%9Fe%205%2C%2066424%20Homburg'

  it('uebergibt die Adresse an Google Maps auf Android', () => {
    const url = buildAddressNavigationUrl(ADDRESS, ANDROID)
    expect(url).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=${ENCODED}&travelmode=driving`
    )
  })

  it('uebergibt die Adresse an Apple Maps auf dem iPhone', () => {
    const url = buildAddressNavigationUrl(ADDRESS, IOS)
    expect(url).toBe(`https://maps.apple.com/?daddr=${ENCODED}&dirflg=d`)
  })

  it('enthaelt keine Koordinaten', () => {
    expect(buildAddressNavigationUrl(ADDRESS, ANDROID)).not.toMatch(/\d+\.\d+,/)
  })
})

describe('buildMultiStopNavigationUrl', () => {
  const stops = [stop(49.31, 7.36), stop(49.32, 7.35), stop(49.33, 7.34)]

  it('haengt Zwischenziele an und nimmt den letzten Stopp als Ziel', () => {
    const url = buildMultiStopNavigationUrl(
      stops,
      stop(49.3015, 7.3695),
      ANDROID
    )
    expect(url).not.toBeNull()
    expect(url).toContain('origin=49.3015%2C7.3695')
    expect(url).toContain('destination=49.33%2C7.34')
    expect(url).toContain('waypoints=49.31%2C7.36%7C49.32%2C7.35')
  })

  it('schneidet bei mehr als neun Zwischenzielen ab, statt kaputtzugehen', () => {
    const many = Array.from({ length: 14 }, (_, i) => stop(49.3 + i / 100, 7.3))
    const url = buildMultiStopNavigationUrl(many, undefined, ANDROID)
    expect(url).not.toBeNull()
    const waypoints = new URL(String(url)).searchParams.get('waypoints')
    expect(waypoints?.split('|')).toHaveLength(MAX_GOOGLE_WAYPOINTS)
  })

  it('gibt Strassen-Treffer als Adresse mit, die anderen als Koordinaten', () => {
    const mixed = [
      stop(49.31, 7.36),
      { ...stop(49.32, 7.35, 'Talstraße 5, 66424 Homburg'), streetOnly: true },
      {
        ...stop(49.33, 7.34, 'Kaiserstraße 60-62, 66424 Homburg'),
        streetOnly: true,
      },
    ]
    const url = new URL(
      String(buildMultiStopNavigationUrl(mixed, undefined, ANDROID))
    )
    expect(url.searchParams.get('waypoints')).toBe(
      '49.31,7.36|Talstraße 5, 66424 Homburg'
    )
    expect(url.searchParams.get('destination')).toBe(
      'Kaiserstraße 60-62, 66424 Homburg'
    )
  })

  it('faellt auf dem iPhone auf das naechste Ziel zurueck', () => {
    const url = buildMultiStopNavigationUrl(stops, undefined, IOS)
    expect(url).toContain('maps.apple.com')
    expect(url).toContain('daddr=49.31,7.36')
  })

  it('gibt ohne Stopps null zurueck', () => {
    expect(buildMultiStopNavigationUrl([], undefined, ANDROID)).toBeNull()
  })
})

describe('buildPhoneLink', () => {
  it('raeumt die Nummer auf', () => {
    expect(buildPhoneLink('+49 6841 2229')).toBe('tel:+4968412229')
    expect(buildPhoneLink('06841 / 22-29')).toBe('tel:068412229')
  })

  it('gibt fuer fehlende oder unbrauchbare Nummern null zurueck', () => {
    expect(buildPhoneLink(null)).toBeNull()
    expect(buildPhoneLink('')).toBeNull()
    expect(buildPhoneLink('k. A.')).toBeNull()
  })
})
