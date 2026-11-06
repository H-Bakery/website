/**
 * Regeln fuer `cli.js import-deliveries` (B8): der Liefer-Store des
 * Mock-Servers (`apps/bakery-api/data/delivery-store.json`) -> Plan fuer die
 * Tabellen `delivery_*`. Abhaengigkeitsfreies CommonJS wie
 * `partner-import.core.js`; geschrieben wird in
 * `delivery-import.service.ts`.
 *
 * Uebernommen werden Fahrer, Touren mit ihren Stopps, das Depot (nur auf
 * Wunsch) und der Adress-Cache. Sammelstellen und Vorbestellungen hat
 * `import-preorders` (B7) schon uebernommen - hier nicht noch einmal.
 *
 * Idempotent ueber natuerliche Schluessel (`import_key`), die aus den IDs
 * des Mocks entstehen: `mock:driver:<id>`, `mock:tour:<id>:<datum>`,
 * `mock:tour:<id>:<datum>:stop:<id>`. Das Datum steckt im Tour-Schluessel,
 * weil der Mock nach dem Loeschen einer Tour deren Nummer wieder vergibt.
 *
 * Geprueft wird mit den Regeln der Erfassung (`delivery-tours.core.js`):
 * was nicht passt, wird uebersprungen und als Problem gemeldet, nie
 * stillschweigend umgedeutet.
 */
const tours = require('./delivery-tours.core')

const VEHICLES = ['bike', 'car', 'van']

class DeliveryImportInputError extends Error {}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Unbrauchbare Datei -> Fehler, bevor die Datenbank geoeffnet wird. */
function assertDeliveryStore(store) {
  if (!isPlainObject(store)) {
    throw new DeliveryImportInputError(
      'Die Datei ist kein Liefer-Store (kein JSON-Objekt).'
    )
  }
  if (!Array.isArray(store.tours)) {
    throw new DeliveryImportInputError(
      'Die Datei ist kein Liefer-Store: "tours" fehlt oder ist keine Liste.'
    )
  }
  if (store.drivers !== undefined && !Array.isArray(store.drivers)) {
    throw new DeliveryImportInputError(
      'Die Datei ist kein Liefer-Store: "drivers" ist keine Liste.'
    )
  }
}

function isoOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function numberOrNull(value) {
  return tours.isNumber(value) ? Number(value) : null
}

function wholeId(value) {
  const n = Number(value)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

function planDriver(raw, problems) {
  const id = wholeId(raw && raw.id)
  if (id === null) {
    problems.push({
      entity: 'driver',
      key: null,
      message: 'Fahrer ohne gültige ID übersprungen.',
    })
    return null
  }
  const key = `mock:driver:${id}`
  const name = String((raw && raw.name) || '').trim()
  if (!name) {
    problems.push({
      entity: 'driver',
      key,
      message: `Fahrer ${id} hat keinen Namen und wurde übersprungen.`,
    })
    return null
  }
  return {
    key,
    mockId: id,
    data: {
      name,
      phone: tours.normalizePhone(raw.phone),
      vehicle: VEHICLES.includes(raw.vehicle) ? raw.vehicle : 'car',
      active: raw.active === undefined ? true : Boolean(raw.active),
    },
  }
}

function planStop(raw, tourKey, problems) {
  const id = wholeId(raw && raw.id)
  if (id === null) {
    problems.push({
      entity: 'stop',
      key: tourKey,
      message: 'Stopp ohne gültige ID übersprungen.',
    })
    return null
  }
  const key = `${tourKey}:stop:${id}`
  // Koordinaten nicht durch die Eingabepruefung schicken - sie machte daraus
  // eine manuelle Angabe. Gueltige werden mit ihrer Quelle uebernommen,
  // ungueltige verworfen (der Server sucht sie beim Lesen neu).
  const input = { ...raw }
  delete input.lat
  delete input.lon
  const result = tours.normalizeStopInput(input, null)
  if (result.error) {
    problems.push({
      entity: 'stop',
      key,
      message: `Stopp ${id}: ${result.message}`,
    })
    return null
  }
  const stop = result.stop
  const located = tours.hasCoordinates(raw)
  const completedAt = isoOrNull(raw.completedAt)
  if (completedAt === undefined) {
    problems.push({
      entity: 'stop',
      key,
      message: `Stopp ${id}: ungültiger Zeitpunkt "${raw.completedAt}".`,
    })
    return null
  }
  return {
    key,
    data: {
      customer: stop.customer,
      street: stop.street,
      zip: stop.zip,
      city: stop.city,
      phone: stop.phone,
      timeWindow: stop.timeWindow,
      notes: stop.notes,
      items: stop.items,
      pickupPointId: stop.pickupPointId || null,
      status: stop.status,
      completedAt: stop.status === 'open' ? null : completedAt,
      failureReason:
        stop.status === 'failed' ? stop.failureReason || null : null,
      goodsDisposition:
        stop.status === 'failed' ? stop.goodsDisposition || null : null,
      lat: located ? Number(raw.lat) : null,
      lon: located ? Number(raw.lon) : null,
      geocodeSource: located ? raw.geocodeSource || null : null,
      geocodePrecision: located ? raw.geocodePrecision || null : null,
    },
  }
}

function planTour(raw, driverKeys, problems) {
  const id = wholeId(raw && raw.id)
  if (id === null) {
    problems.push({
      entity: 'tour',
      key: null,
      message: 'Tour ohne gültige ID übersprungen.',
    })
    return null
  }
  const date = raw.date
  if (!tours.isBusinessDate(date)) {
    problems.push({
      entity: 'tour',
      key: `mock:tour:${id}`,
      message: `Tour ${id}: ungültiges Datum "${date}".`,
    })
    return null
  }
  const key = `mock:tour:${id}:${date}`
  const status = tours.TOUR_STATUS.includes(raw.status) ? raw.status : null
  if (!status) {
    problems.push({
      entity: 'tour',
      key,
      message: `Tour ${id}: ungültiger Status "${raw.status}".`,
    })
    return null
  }
  let driverKey = null
  const driverId = wholeId(raw.driverId)
  if (driverId !== null) {
    driverKey = `mock:driver:${driverId}`
    if (!driverKeys.has(driverKey)) {
      problems.push({
        entity: 'tour',
        key,
        message: `Tour ${id}: Fahrer ${driverId} fehlt in der Datei - die Tour wird ohne Fahrer übernommen.`,
      })
      driverKey = null
    }
  }
  let plannedStart = '06:30'
  if (raw.plannedStart !== undefined && raw.plannedStart !== null) {
    if (tours.isClockTime(raw.plannedStart)) plannedStart = raw.plannedStart
    else
      problems.push({
        entity: 'tour',
        key,
        message: `Tour ${id}: Abfahrt "${raw.plannedStart}" ist keine Uhrzeit - 06:30 übernommen.`,
      })
  }
  const times = {}
  for (const field of ['startedAt', 'finishedAt', 'routedAt']) {
    const value = isoOrNull(raw[field])
    times[field] = value === undefined ? null : value
  }
  const position =
    isPlainObject(raw.lastPosition) && tours.hasCoordinates(raw.lastPosition)
      ? {
          lat: Number(raw.lastPosition.lat),
          lon: Number(raw.lastPosition.lon),
          accuracy: numberOrNull(raw.lastPosition.accuracy),
          speed: numberOrNull(raw.lastPosition.speed),
          at: isoOrNull(raw.lastPosition.at) || null,
        }
      : null

  const stops = []
  const seen = new Set()
  for (const rawStop of Array.isArray(raw.stops) ? raw.stops : []) {
    const stop = planStop(rawStop, key, problems)
    if (!stop) continue
    if (seen.has(stop.key)) {
      problems.push({
        entity: 'stop',
        key: stop.key,
        message:
          'Doppelte Stopp-ID in der Tour - der zweite wurde übersprungen.',
      })
      continue
    }
    seen.add(stop.key)
    stops.push(stop)
  }

  return {
    key,
    date,
    driverKey,
    data: {
      date,
      name: String(raw.name || 'Tour').trim() || 'Tour',
      status,
      vehicleType: VEHICLES.includes(raw.vehicleType) ? raw.vehicleType : 'car',
      plannedStart,
      startedAt: times.startedAt,
      finishedAt: times.finishedAt,
      distance: numberOrNull(raw.distance),
      duration: numberOrNull(raw.duration),
      isEstimate: raw.isEstimate === undefined ? true : Boolean(raw.isEstimate),
      geometry: Array.isArray(raw.geometry) ? raw.geometry : null,
      routedAt: times.routedAt,
      lastPosition: position,
    },
    stops,
  }
}

function planDepot(raw) {
  if (!isPlainObject(raw) || !String(raw.street || '').trim()) return null
  const located = tours.hasCoordinates(raw)
  return {
    name: String(raw.name || '').trim() || 'Backstube',
    street: String(raw.street).trim(),
    zip: String(raw.zip || '').trim(),
    city: String(raw.city || '').trim(),
    phone: tours.normalizePhone(raw.phone),
    lat: located ? Number(raw.lat) : null,
    lon: located ? Number(raw.lon) : null,
    geocodeSource: located ? raw.geocodeSource || null : null,
    geocodePrecision: located ? raw.geocodePrecision || null : null,
  }
}

function planGeocache(raw) {
  if (!isPlainObject(raw)) return []
  const out = []
  for (const [address, hit] of Object.entries(raw)) {
    if (!isPlainObject(hit) || !tours.hasCoordinates(hit)) continue
    const key = String(tours.normalizeAddress(address)).slice(0, 300)
    if (!key) continue
    out.push({
      key,
      lat: Number(hit.lat),
      lon: Number(hit.lon),
      displayName: hit.displayName ? String(hit.displayName) : null,
      precision: hit.precision ? String(hit.precision) : null,
    })
  }
  return out
}

/**
 * Der ganze Plan: `{ depot, drivers, tours, geocache, problems }`. Der Plan
 * kennt die Datenbank nicht - was dort schon steht, entscheidet der Service.
 */
function planDeliveryImport(store) {
  assertDeliveryStore(store)
  const problems = []
  const drivers = []
  const driverKeys = new Set()
  for (const raw of store.drivers || []) {
    const driver = planDriver(raw, problems)
    if (!driver) continue
    if (driverKeys.has(driver.key)) {
      problems.push({
        entity: 'driver',
        key: driver.key,
        message: 'Doppelte Fahrer-ID - der zweite wurde übersprungen.',
      })
      continue
    }
    driverKeys.add(driver.key)
    drivers.push(driver)
  }
  const planned = []
  const tourKeys = new Set()
  for (const raw of store.tours) {
    const tour = planTour(raw, driverKeys, problems)
    if (!tour) continue
    if (tourKeys.has(tour.key)) {
      problems.push({
        entity: 'tour',
        key: tour.key,
        message: 'Doppelte Tour - die zweite wurde übersprungen.',
      })
      continue
    }
    tourKeys.add(tour.key)
    planned.push(tour)
  }
  return {
    depot: planDepot(store.depot),
    drivers,
    tours: planned,
    geocache: planGeocache(store.geocache),
    problems,
  }
}

module.exports = {
  DeliveryImportInputError,
  assertDeliveryStore,
  planDeliveryImport,
}
