/**
 * Rechenkern der Liefertouren - dependency-freies CommonJS.
 *
 * Wie bei `partner-stats.core.js` steht jede Formel genau einmal hier und wird
 * vom Mock-Server (`simple-server.js`) und den Tests benutzt. Nichts in dieser
 * Datei macht Netzwerk oder Dateizugriffe, damit sie ueberall laeuft.
 *
 * Das Frontend hat seine eigene TypeScript-Fassung der Geometrie in
 * `@bakery/delivery/routing`; die Grenze CommonJS <-> ESM laesst sich nicht
 * ohne Build-Umbau ueberbruecken. Beide Seiten benutzen dieselbe Haversine-
 * Formel und denselben Umwegfaktor - wer einen davon aendert, muss beide
 * anfassen.
 */

/** Umwegfaktor Luftlinie -> Strasse, identisch mit dem Frontend. */
const ROAD_DETOUR_FACTOR = 1.35

/** Durchschnittsgeschwindigkeit je Fahrzeug in m/s. */
const AVERAGE_SPEED_MS = { bike: 4.2, car: 8.3, van: 7.5 }

/** Standzeit pro Stopp in Sekunden. */
const STOP_SERVICE_TIME = 180

const STOP_STATUS = ['open', 'done', 'failed']
const TOUR_STATUS = ['planned', 'active', 'done']

/** Entfernung zweier Punkte in Metern (Haversine). */
function haversineMeters(a, b) {
  const R = 6371e3
  const phi1 = (a.lat * Math.PI) / 180
  const phi2 = (b.lat * Math.PI) / 180
  const dPhi = ((b.lat - a.lat) * Math.PI) / 180
  const dLambda = ((b.lon - a.lon) * Math.PI) / 180

  const s =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(dLambda / 2) *
      Math.sin(dLambda / 2)
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

/** Adressen vergleichbar machen - Schluessel des Geocoding-Caches. */
function normalizeAddress(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Einzeilige Adresse aus den Feldern eines Stopps. */
function formatAddress(stop) {
  const street = String((stop && stop.street) || '').trim()
  const zip = String((stop && stop.zip) || '').trim()
  const city = String((stop && stop.city) || '').trim()
  const place = [zip, city].filter(Boolean).join(' ')
  return [street, place].filter(Boolean).join(', ')
}

/**
 * Hat der Stopp brauchbare Koordinaten?
 *
 * `Number(null)` ist 0 - ein noch nicht gefundener Stopp laege damit im
 * Atlantik vor Afrika und zoege die ganze Tour dorthin. Deshalb werden
 * `null`, `undefined` und Leerstring vorher aussortiert.
 */
function isNumber(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== '' &&
    Number.isFinite(Number(value))
  )
}

function hasCoordinates(stop) {
  return stop != null && isNumber(stop.lat) && isNumber(stop.lon)
}

function point(stop) {
  return { lat: Number(stop.lat), lon: Number(stop.lon) }
}

/**
 * Bringt Stopps per Nearest Neighbour ab dem Startpunkt in Reihenfolge.
 *
 * Stopps ohne Koordinaten koennen nicht sortiert werden - sie behalten ihre
 * Eingabereihenfolge und haengen hinten an, statt die Tour zu verfaelschen.
 */
function orderStopsNearestNeighbour(origin, stops) {
  const locatable = stops.filter(hasCoordinates)
  const unlocatable = stops.filter((s) => !hasCoordinates(s))
  if (locatable.length <= 1) return [...locatable, ...unlocatable]

  const remaining = [...locatable]
  const ordered = []
  let current = point(origin)

  while (remaining.length > 0) {
    let nearestIndex = 0
    let nearestDistance = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const distance = haversineMeters(current, point(remaining[i]))
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = i
      }
    }
    const next = remaining.splice(nearestIndex, 1)[0]
    ordered.push(next)
    current = point(next)
  }

  return [...ordered, ...unlocatable]
}

/** Geschaetzte Fahrstrecke und -zeit einer Etappe. */
function estimateLeg(from, to, vehicleType) {
  const speed = AVERAGE_SPEED_MS[vehicleType] || AVERAGE_SPEED_MS.car
  const distance = haversineMeters(from, to) * ROAD_DETOUR_FACTOR
  return { distance, duration: distance / speed }
}

/**
 * Summiert die Tour ab dem Depot. Rueckgabe ist immer eine Schaetzung -
 * echte Strassenwerte liefert der Router in `delivery-geo.core.js`.
 */
function estimateTour(depot, stops, vehicleType) {
  const locatable = stops.filter(hasCoordinates)
  let distance = 0
  let duration = 0
  let previous = point(depot)

  for (let i = 0; i < locatable.length; i++) {
    const leg = estimateLeg(previous, point(locatable[i]), vehicleType)
    distance += leg.distance
    duration += leg.duration + STOP_SERVICE_TIME
    previous = point(locatable[i])
  }

  return { distance, duration, isEstimate: true, legs: locatable.length }
}

/**
 * Voraussichtliche Ankunft je Stopp ab `startedAt` (ISO-Strings).
 * Bereits erledigte Stopps bekommen keine Prognose mehr.
 */
function estimateArrivals(depot, stops, startedAt, vehicleType) {
  let cursor = new Date(startedAt).getTime()
  if (!Number.isFinite(cursor)) cursor = Date.now()
  let previous = point(depot)
  const arrivals = {}

  for (const stop of stops) {
    if (!hasCoordinates(stop)) continue
    const leg = estimateLeg(previous, point(stop), vehicleType)
    cursor += leg.duration * 1000
    arrivals[stop.id] = new Date(cursor).toISOString()
    cursor += STOP_SERVICE_TIME * 1000
    previous = point(stop)
  }

  return arrivals
}

/** Zaehlt den Stand einer Tour. */
function tourProgress(tour) {
  const stops = (tour && tour.stops) || []
  const done = stops.filter((s) => s.status === 'done').length
  const failed = stops.filter((s) => s.status === 'failed').length
  return {
    total: stops.length,
    done,
    failed,
    open: stops.length - done - failed,
    isComplete: stops.length > 0 && done + failed === stops.length,
  }
}

/** Erster noch offener Stopp in Tourreihenfolge, sonst `null`. */
function nextOpenStop(tour) {
  const stops = (tour && tour.stops) || []
  return stops.find((s) => s.status === 'open') || null
}

function wholeNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function isBusinessDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** Nächstes Datum eines Wochentags (0 = Sonntag ... 6 = Samstag) als YYYY-MM-DD. */
function nextWeekday(from, weekday) {
  const date = new Date(from)
  date.setHours(12, 0, 0, 0)
  const delta = (weekday - date.getDay() + 7) % 7
  date.setDate(date.getDate() + delta)
  return toBusinessDate(date)
}

/** Lokales Datum als YYYY-MM-DD - `toISOString()` waere UTC und schoebe den Tag. */
function toBusinessDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Prueft und normalisiert einen Stopp aus dem Request-Body.
 * Rueckgabe: `{ stop }` oder `{ error, message }` mit deutschem Text.
 */
function normalizeStopInput(body, existing) {
  const source = body || {}
  const base = existing || {}

  const customer = String(
    source.customer === undefined ? base.customer || '' : source.customer
  ).trim()
  if (!customer) {
    return {
      error: 'Customer is required',
      message: 'Der Name des Kunden ist erforderlich.',
    }
  }

  const street = String(
    source.street === undefined ? base.street || '' : source.street
  ).trim()
  if (!street) {
    return {
      error: 'Street is required',
      message: 'Straße und Hausnummer sind erforderlich.',
    }
  }

  const status =
    source.status === undefined ? base.status || 'open' : String(source.status)
  if (!STOP_STATUS.includes(status)) {
    return {
      error: 'Invalid status',
      message: 'Status muss "open", "done" oder "failed" sein.',
    }
  }

  const items = Array.isArray(source.items)
    ? source.items
        .map((item) => ({
          name: String((item && item.name) || '').trim(),
          qty: Math.max(0, wholeNumber(item && item.qty, 1)),
          unit: String((item && item.unit) || 'Stück').trim() || 'Stück',
        }))
        .filter((item) => item.name)
    : Array.isArray(base.items)
    ? base.items
    : []

  const stop = {
    ...base,
    customer,
    street,
    zip: String(source.zip === undefined ? base.zip || '' : source.zip).trim(),
    city: String(
      source.city === undefined ? base.city || 'Homburg' : source.city
    ).trim(),
    phone: normalizePhone(
      source.phone === undefined ? base.phone : source.phone
    ),
    notes:
      source.notes === undefined
        ? base.notes || null
        : String(source.notes || '').trim() || null,
    timeWindow:
      source.timeWindow === undefined
        ? base.timeWindow || null
        : String(source.timeWindow || '').trim() || null,
    items,
    status,
  }

  // Koordinaten duerfen manuell gesetzt werden, wenn die Adresssuche daneben
  // liegt. `null` loescht sie und stoesst eine neue Suche an.
  if (source.lat !== undefined || source.lon !== undefined) {
    // `isNumber` statt `Number.isFinite(Number(x))`: `null` waere sonst 0 und
    // ein Loeschen der Koordinaten setzte den Stopp auf den Nullmeridian.
    if (isNumber(source.lat) && isNumber(source.lon)) {
      stop.lat = Number(source.lat)
      stop.lon = Number(source.lon)
      stop.geocodeSource = 'manual'
    } else {
      stop.lat = null
      stop.lon = null
      stop.geocodeSource = null
    }
  }

  if (status === 'done' && base.status !== 'done') {
    stop.completedAt = source.completedAt || new Date().toISOString()
    stop.failureReason = null
  }
  if (status === 'failed') {
    stop.completedAt = source.completedAt || new Date().toISOString()
    stop.failureReason =
      String(source.failureReason || base.failureReason || '').trim() ||
      'Nicht angetroffen'
  }
  if (status === 'open') {
    stop.completedAt = null
    stop.failureReason = null
  }

  return { stop }
}

/** Telefonnummern auf Ziffern und fuehrendes + reduzieren; Unsinn wird `null`. */
function normalizePhone(value) {
  if (value === null || value === undefined || value === '') return null
  const cleaned = String(value).replace(/[^\d+]/g, '')
  return cleaned.replace(/\D/g, '').length >= 5 ? cleaned : null
}

module.exports = {
  ROAD_DETOUR_FACTOR,
  AVERAGE_SPEED_MS,
  STOP_SERVICE_TIME,
  STOP_STATUS,
  TOUR_STATUS,
  haversineMeters,
  normalizeAddress,
  formatAddress,
  hasCoordinates,
  isNumber,
  orderStopsNearestNeighbour,
  estimateLeg,
  estimateTour,
  estimateArrivals,
  tourProgress,
  nextOpenStop,
  normalizeStopInput,
  normalizePhone,
  wholeNumber,
  isBusinessDate,
  nextWeekday,
  toBusinessDate,
}
