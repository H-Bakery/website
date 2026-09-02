/**
 * Adresssuche und Strassenrouting fuer die Liefertouren.
 *
 * Zwei oeffentliche OSM-Dienste, beide ohne Schluessel:
 *   - Nominatim  (Adresse -> Koordinaten)
 *   - OSRM       (Reihenfolge, Fahrstrecke, Fahrzeit, Streckenverlauf)
 *
 * Beide sind *optional*. Faellt einer aus - kein Netz, Rate-Limit, Wartung -
 * gibt die jeweilige Funktion `null` zurueck und der Aufrufer rechnet mit den
 * Schaetzformeln aus `delivery-tours.core.js` weiter. Die Tour darf nie an
 * einem fremden Server haengen: samstags frueh um sechs muss die Liste da sein.
 *
 * Nominatims Nutzungsbedingungen verlangen einen aussagekraeftigen User-Agent
 * und hoechstens eine Anfrage pro Sekunde. Beides steckt hier drin; Treffer
 * werden ausserdem dauerhaft im Store zwischengespeichert, sodass eine Adresse
 * genau einmal gesucht wird.
 */

const core = require('./delivery-tours.core')

const NOMINATIM_URL =
  process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search'
const OSRM_URL = process.env.OSRM_URL || 'https://router.project-osrm.org'
const USER_AGENT =
  process.env.GEOCODER_USER_AGENT ||
  'bakery-delivery/1.0 (Baeckerei Heusser, Homburg)'
const REQUEST_TIMEOUT_MS = Number(process.env.GEO_TIMEOUT_MS || 8000)
const NOMINATIM_MIN_INTERVAL_MS = 1100

/** Serialisiert Nominatim-Anfragen auf eine pro Sekunde. */
let nominatimChain = Promise.resolve()
let lastNominatimCall = 0

function throttleNominatim(task) {
  const run = async () => {
    const wait = Math.max(
      0,
      lastNominatimCall + NOMINATIM_MIN_INTERVAL_MS - Date.now()
    )
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    lastNominatimCall = Date.now()
    return task()
  }
  nominatimChain = nominatimChain.then(run, run)
  return nominatimChain
}

async function fetchJson(url, headers) {
  if (typeof fetch !== 'function') return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, ...(headers || {}) },
      signal: controller.signal,
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Sucht eine Adresse. Rueckgabe `{ lat, lon, displayName, precision }` oder
 * `null`.
 *
 * Erst wird die volle Adresse probiert, dann - falls die Hausnummer einen
 * Bereich enthaelt wie "36-38" - nur die erste Nummer, zuletzt die Strasse
 * ohne Nummer. Genau daran scheitert Nominatim bei den hiesigen Adressen sonst.
 *
 * `precision` sagt, was der Treffer wert ist: `'house'`, wenn er eine
 * Hausnummer traegt, sonst `'street'`. Nominatim antwortet auf "Talstraße 5"
 * ohne Fehler mit der Strassenmitte, wenn es die Nummer nicht kennt - ohne
 * diese Kennzeichnung liest sich das wie ein Haus, und der Fahrer wird
 * dorthin navigiert.
 */
async function geocodeAddress(address) {
  const query = String(address || '').trim()
  if (!query) return null

  const streetOnly = stripHouseNumber(query)
  for (const candidate of addressCandidates(query)) {
    const url = `${NOMINATIM_URL}?${new URLSearchParams({
      q: candidate,
      format: 'jsonv2',
      limit: '1',
      countrycodes: 'de',
      addressdetails: '1',
    })}`

    const result = await throttleNominatim(() => fetchJson(url))
    const hit = Array.isArray(result) && result.length > 0 ? result[0] : null
    if (!hit) continue

    const lat = Number(hit.lat)
    const lon = Number(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

    // Der Kandidat ohne Hausnummer findet bestenfalls die Strasse - gibt
    // Nominatim dafuer doch irgendein Haus zurueck, ist es nicht das gesuchte.
    const houseNumber = hit.address && hit.address.house_number
    const precision =
      candidate !== streetOnly && houseNumber ? 'house' : 'street'

    return { lat, lon, displayName: hit.display_name || candidate, precision }
  }

  return null
}

/** Abgeschwaechte Varianten einer Adresse, von genau nach grob. */
function addressCandidates(address) {
  const candidates = [address]

  // "Ortsstraße 36-38" -> "Ortsstraße 36"
  const singleNumber = address.replace(/(\d+)\s*[-–/]\s*\d+/, '$1')
  if (singleNumber !== address) candidates.push(singleNumber)

  // Ohne Hausnummer - liefert die Strasse, besser als gar nichts.
  const withoutNumber = stripHouseNumber(address)
  if (withoutNumber !== address && !candidates.includes(withoutNumber)) {
    candidates.push(withoutNumber)
  }

  return candidates
}

/**
 * "Talstraße 5, 66424 Homburg" -> "Talstraße, 66424 Homburg". Ohne Hausnummer
 * (oder ohne den Trenner zum Ort) kommt die Adresse unveraendert zurueck.
 */
function stripHouseNumber(address) {
  return address.replace(/\s*\d+[a-zA-Z]?(\s*[-–/]\s*\d+)?\s*,/, ',')
}

/**
 * Berechnet die Tour ueber OSRM.
 *
 * `optimize: true` benutzt den Trip-Endpunkt (offenes TSP ab Depot), sonst
 * bleibt die uebergebene Reihenfolge stehen und es wird nur gemessen.
 *
 * Rueckgabe: `{ order, distance, duration, geometry, isEstimate: false }`
 * oder `null`, wenn OSRM nicht antwortet.
 */
async function routeTour(depot, stops, options) {
  const opts = options || {}
  // Ohne Depot-Koordinaten gibt es keinen Startpunkt - `Number(null)` waere 0
  // und die Route beginne im Atlantik.
  if (!core.hasCoordinates(depot)) return null
  const locatable = stops.filter(core.hasCoordinates)
  if (locatable.length === 0) return null

  const coords = [depot, ...locatable]
    .map((p) => `${Number(p.lon).toFixed(6)},${Number(p.lat).toFixed(6)}`)
    .join(';')

  const profile = opts.vehicleType === 'bike' ? 'bike' : 'driving'
  const query = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
  })

  let url
  if (opts.optimize && locatable.length > 1) {
    query.set('source', 'first')
    query.set('roundtrip', 'false')
    url = `${OSRM_URL}/trip/v1/${profile}/${coords}?${query}`
  } else {
    url = `${OSRM_URL}/route/v1/${profile}/${coords}?${query}`
  }

  const result = await fetchJson(url)
  if (!result || result.code !== 'Ok') return null

  const trip = (result.trips || result.routes || [])[0]
  if (!trip) return null

  // Beim Trip-Endpunkt sagt `waypoint_index` die neue Reihenfolge; Index 0 ist
  // immer das Depot und faellt raus.
  let order = locatable.map((stop) => stop.id)
  if (opts.optimize && Array.isArray(result.waypoints)) {
    const ranked = result.waypoints
      .map((wp, index) => ({ index, position: wp.waypoint_index }))
      .filter((entry) => entry.index > 0)
      .sort((a, b) => a.position - b.position)
    if (ranked.length === locatable.length) {
      order = ranked.map((entry) => locatable[entry.index - 1].id)
    }
  }

  const geometry = Array.isArray(trip.geometry && trip.geometry.coordinates)
    ? trip.geometry.coordinates.map(([lon, lat]) => [lat, lon])
    : null

  return {
    order,
    distance: Number(trip.distance) || 0,
    // OSRM rechnet reine Fahrzeit; die Standzeit je Stopp kommt dazu, sonst
    // ist die Tour auf dem Papier eine halbe Stunde zu kurz.
    duration:
      (Number(trip.duration) || 0) + locatable.length * core.STOP_SERVICE_TIME,
    geometry,
    isEstimate: false,
  }
}

module.exports = { geocodeAddress, routeTour, addressCandidates }
