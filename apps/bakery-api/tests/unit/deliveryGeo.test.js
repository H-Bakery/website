/**
 * Adresssuche der Liefertouren - ohne Netz: `fetch` wird durch einen Stub
 * ersetzt, der vorgibt, Nominatim zu sein. Geprueft wird, was aus einem
 * Treffer wird, nicht, was Nominatim zu einer Adresse sagt.
 */
const geo = require('../../src/services/delivery-geo.core')

/** Eine Nominatim-Antwort (jsonv2, addressdetails=1) in Kurzform. */
function hit(lat, lon, address, displayName) {
  return {
    lat: String(lat),
    lon: String(lon),
    display_name: displayName || 'irgendwo',
    addresstype: address && address.house_number ? 'building' : 'road',
    address,
  }
}

function respondWith(...pages) {
  const calls = []
  const fetch = jest.fn(async (url) => {
    calls.push(String(url))
    const body = pages.length > 0 ? pages.shift() : []
    return { ok: true, json: async () => body }
  })
  global.fetch = fetch
  return calls
}

/**
 * Nominatim darf nur einmal pro Sekunde gefragt werden; der Core wartet
 * zwischen zwei Kandidaten. Mit falschen Timern muss dafuer niemand warten.
 */
async function geocode(address) {
  const pending = geo.geocodeAddress(address)
  await jest.advanceTimersByTimeAsync(30_000)
  return pending
}

describe('geocodeAddress', () => {
  const realFetch = global.fetch

  beforeEach(() => jest.useFakeTimers())
  afterEach(() => {
    jest.useRealTimers()
    global.fetch = realFetch
  })

  test('fragt Nominatim mit Adressdetails, sonst fehlt die Hausnummer', async () => {
    const calls = respondWith([
      hit(49.3223, 7.3391, { house_number: '5', road: 'Talstraße' }),
    ])

    await geocode('Talstraße 5, 66424 Homburg')

    expect(calls).toHaveLength(1)
    const params = new URL(calls[0]).searchParams
    expect(params.get('addressdetails')).toBe('1')
    expect(params.get('q')).toBe('Talstraße 5, 66424 Homburg')
  })

  test('markiert einen Treffer mit Hausnummer als "house"', async () => {
    respondWith([
      hit(
        49.3223,
        7.3391,
        { house_number: '5', road: 'Talstraße' },
        '5, Talstraße, Homburg'
      ),
    ])

    expect(await geocode('Talstraße 5, 66424 Homburg')).toEqual({
      lat: 49.3223,
      lon: 7.3391,
      displayName: '5, Talstraße, Homburg',
      precision: 'house',
    })
  })

  // Genau der Fall aus der Praxis: Nominatim kennt "Talstraße 5" nicht,
  // antwortet aber ohne Fehler mit der Strassenmitte. Frueher hiess das
  // "gefunden", und der Fahrer wurde dorthin navigiert.
  test('markiert die Strassenmitte als "street", auch beim ersten Kandidaten', async () => {
    respondWith([hit(49.3251, 7.3444, { road: 'Talstraße', town: 'Homburg' })])

    const found = await geocode('Talstraße 5, 66424 Homburg')
    expect(found.precision).toBe('street')
    expect(found.lat).toBe(49.3251)
  })

  test('der Kandidat ohne Hausnummer ist immer "street", auch wenn ein Haus zurueckkommt', async () => {
    // Kandidaten: "Ortsstraße 36-38, …", "Ortsstraße 36, …", "Ortsstraße, …".
    const calls = respondWith(
      [],
      [],
      [hit(49.3006, 7.3663, { house_number: '12', road: 'Ortsstraße' })]
    )

    const found = await geocode('Ortsstraße 36-38, 66424 Homburg')

    expect(calls.map((url) => new URL(url).searchParams.get('q'))).toEqual([
      'Ortsstraße 36-38, 66424 Homburg',
      'Ortsstraße 36, 66424 Homburg',
      'Ortsstraße, 66424 Homburg',
    ])
    expect(found.precision).toBe('street')
  })

  // "Kaiserstraße 60-62" kennt Nominatim nur als Strasse, "Kaiserstraße 60"
  // als Haus. Frueher gewann der erste Treffer - die Strassenmitte.
  test('sucht nach einem Strassen-Treffer noch den genaueren Kandidaten', async () => {
    const calls = respondWith(
      [hit(49.3214, 7.3341, { road: 'Kaiserstraße' })],
      [hit(49.3212, 7.3337, { house_number: '60', road: 'Kaiserstraße' })]
    )

    const found = await geocode('Kaiserstraße 60-62, 66424 Homburg')

    expect(calls).toHaveLength(2)
    expect(found.precision).toBe('house')
    expect(found.lat).toBe(49.3212)
  })

  test('behaelt den Strassen-Treffer, wenn kein genauerer Kandidat trifft', async () => {
    const calls = respondWith(
      [hit(49.3214, 7.3341, { road: 'Kaiserstraße' })],
      []
    )

    const found = await geocode('Kaiserstraße 60-62, 66424 Homburg')

    // Der Kandidat ohne Hausnummer wird nicht mehr gefragt: mehr als die
    // Strasse kann er nicht finden, und die liegt schon vor.
    expect(calls.map((url) => new URL(url).searchParams.get('q'))).toEqual([
      'Kaiserstraße 60-62, 66424 Homburg',
      'Kaiserstraße 60, 66424 Homburg',
    ])
    expect(found).toMatchObject({ lat: 49.3214, precision: 'street' })
  })

  test('die verkuerzte Hausnummer "36" zaehlt noch als Haus', async () => {
    respondWith(
      [],
      [hit(49.3006, 7.3663, { house_number: '36-38', road: 'Ortsstraße' })]
    )

    const found = await geocode('Ortsstraße 36-38, 66424 Homburg')
    expect(found.precision).toBe('house')
  })

  test('eine Adresse ohne Hausnummer ist hoechstens "street"', async () => {
    respondWith([hit(49.3251, 7.3444, { road: 'Talstraße' })])

    const found = await geocode('Talstraße, 66424 Homburg')
    expect(found.precision).toBe('street')
  })

  test('gibt null zurueck, wenn kein Kandidat trifft', async () => {
    const calls = respondWith([], [])

    expect(await geocode('Gibtsnichtweg 999, 66424 Homburg')).toBeNull()
    expect(calls).toHaveLength(2)
  })

  test('gibt null zurueck, wenn Nominatim nicht antwortet', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('ENOTFOUND')
    })

    expect(await geocode('Talstraße 5, 66424 Homburg')).toBeNull()
  })
})

describe('addressCandidates', () => {
  test('probiert von genau nach grob', () => {
    expect(geo.addressCandidates('Ortsstraße 36-38, 66424 Homburg')).toEqual([
      'Ortsstraße 36-38, 66424 Homburg',
      'Ortsstraße 36, 66424 Homburg',
      'Ortsstraße, 66424 Homburg',
    ])
    expect(geo.addressCandidates('Talstraße 5a, 66424 Homburg')).toEqual([
      'Talstraße 5a, 66424 Homburg',
      'Talstraße, 66424 Homburg',
    ])
  })

  test('laesst eine Adresse ohne Hausnummer, wie sie ist', () => {
    expect(geo.addressCandidates('Talstraße, 66424 Homburg')).toEqual([
      'Talstraße, 66424 Homburg',
    ])
  })
})
