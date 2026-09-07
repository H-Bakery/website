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
/**
 * Verbleib der Ware bei "nicht angetroffen": wieder mitgenommen oder vor Ort
 * abgestellt. Ohne diese Angabe weiss die Backstube am Montag nicht, ob die
 * Tuete zurueckkam oder beim Kunden liegt.
 */
const GOODS_DISPOSITION = ['taken_back', 'left_at_address']
/** Ein Grund ist eine Zeile, kein Aufsatz. */
const FAILURE_REASON_MAX_LENGTH = 200

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
  if (typeof value === 'number') return Number.isFinite(value)
  // Nur Zahlen und nicht-leere Zahl-Strings. `Number(true)`, `Number([])` und
  // `Number(' ')` waeren sonst alle gueltige Koordinaten.
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    Number.isFinite(Number(value))
  )
}

/** Breitengrad -90..90, Laengengrad -180..180 - alles andere ist Tippfehler. */
function isLatitude(value) {
  return isNumber(value) && Math.abs(Number(value)) <= 90
}

function isLongitude(value) {
  return isNumber(value) && Math.abs(Number(value)) <= 180
}

/**
 * (0, 0) - "Null Island" im Golf von Guinea - ist das klassische Ergebnis von
 * `Number(null)` oder einem leeren Formular und nie eine Lieferadresse. Wer
 * es als Koordinate durchliesse, zoege Karte, Reihenfolge und Kilometer der
 * Tour in den Atlantik.
 */
function isNullIsland(lat, lon) {
  return Number(lat) === 0 && Number(lon) === 0
}

function hasCoordinates(stop) {
  return (
    stop != null &&
    isLatitude(stop.lat) &&
    isLongitude(stop.lon) &&
    !isNullIsland(stop.lat, stop.lon)
  )
}

/**
 * Prueft ein Koordinatenpaar aus einem Request-Body.
 * Rueckgabe: `{ lat, lon }` als Zahlen oder `{ error, message }`.
 */
function validateCoordinates(lat, lon) {
  if (!isNumber(lat) || !isNumber(lon)) {
    return {
      error: 'Invalid coordinates',
      message: 'Koordinaten müssen als Zahlen (lat und lon) angegeben werden.',
    }
  }
  if (!isLatitude(lat) || !isLongitude(lon)) {
    return {
      error: 'Coordinates out of range',
      message:
        'Koordinaten außerhalb des gültigen Bereichs: Breite -90 bis 90, Länge -180 bis 180.',
    }
  }
  if (isNullIsland(lat, lon)) {
    return {
      error: 'Coordinates out of range',
      message:
        'Die Koordinate (0, 0) liegt im Atlantik und ist keine Adresse. Koordinaten weglassen oder auf null setzen, damit die Adresse gesucht wird.',
    }
  }
  return { lat: Number(lat), lon: Number(lon) }
}

/**
 * Setzt unbrauchbare Koordinaten eines gespeicherten Punkts auf `null`, damit
 * die Adresse neu gesucht wird. Gebraucht beim Laden eines Stores aus der Zeit,
 * als (0, 0) und Werte ausserhalb des Wertebereichs noch durchkamen.
 * Rueckgabe: true, wenn etwas geaendert wurde.
 */
function scrubCoordinates(point) {
  if (point == null || typeof point !== 'object') return false
  if (point.lat == null && point.lon == null) return false
  if (hasCoordinates(point)) return false
  point.lat = null
  point.lon = null
  if ('geocodeSource' in point) point.geocodeSource = null
  if ('geocodePrecision' in point) point.geocodePrecision = null
  return true
}

/** Uhrzeit als "HH:MM" mit 00-23 Stunden und 00-59 Minuten. */
function isClockTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function point(stop) {
  return { lat: Number(stop.lat), lon: Number(stop.lon) }
}

/** Praefixe, mit denen eine einzelne Uhrzeit als Fensterbeginn bzw. -ende gilt. */
const SINGLE_TIME_START = /^(ab|nicht vor|fr(ü|ue)hestens)\b/i
const SINGLE_TIME_END = /^(bis|sp(ä|ae)testens|vor)\b/i

/**
 * Liest das Zeitfenster eines Stopps: "09:00-09:30", "9:00 – 9:30",
 * "08.00-09.00", "ab 09:00" (nur Beginn), "bis 09:30" (nur Ende).
 *
 * Eine einzelne Uhrzeit zaehlt nur mit erkennbarem Praefix: "ab", "nicht vor",
 * "fruehestens" ergeben einen Beginn, "bis", "spaetestens", "vor" ein Ende.
 * Ohne Praefix ("09:00 Uhr", "ca. 12:30") bleibt sie Freitext - sonst wuerde
 * "spaetestens 09:30" als Beginn gelesen und die ETA-Kette wartete bis 09:30,
 * das Gegenteil der Absicht.
 *
 * Rueckgabe `{ start, end }` als "HH:MM" oder `null` je Grenze; `null`
 * insgesamt, wenn kein Fenster lesbar ist ("vormittags") oder das Ende vor
 * dem Beginn liegt. Freitext bleibt erlaubt - er wirkt dann nur nicht auf
 * die Ankunftszeiten. Identisch mit `parseTimeWindow()` im Frontend.
 */
function parseTimeWindow(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null

  const times = []
  // "HH:MM" oder deutsch "HH.MM"; ein Datum wie "19.09.2026" ist keine Uhrzeit.
  const pattern = /(?<![\d.])(\d{1,2})[:.](\d{2})(?![\d.])/g
  let match
  while ((match = pattern.exec(text)) !== null && times.length < 2) {
    const clock = `${match[1].padStart(2, '0')}:${match[2]}`
    if (!isClockTime(clock)) return null
    times.push(clock)
  }
  if (times.length === 0) return null
  if (times.length === 2) {
    // "HH:MM" vergleicht sich als String korrekt.
    if (times[1] < times[0]) return null
    return { start: times[0], end: times[1] }
  }
  if (SINGLE_TIME_START.test(text)) return { start: times[0], end: null }
  if (SINGLE_TIME_END.test(text)) return { start: null, end: times[0] }
  return null
}

/**
 * Fensterbeginn und -ende als Zeitstempel (ms) am Tourtag, fehlende Grenzen
 * `null`. Rechnet wie `arrivalBaseline()` in lokaler Zeit.
 */
function timeWindowBounds(date, timeWindow) {
  const window = parseTimeWindow(timeWindow)
  if (!window || !isBusinessDate(date)) return { start: null, end: null }
  const at = (clock) => {
    if (!clock) return null
    const ms = Date.parse(`${date}T${clock}:00`)
    return Number.isFinite(ms) ? ms : null
  }
  return { start: at(window.start), end: at(window.end) }
}

/**
 * Tourtag fuer die Zeitfenster: das uebergebene Datum, sonst der lokale Tag
 * der Startzeit - ein Fenster "09:00-09:30" gilt an dem Tag, an dem gefahren
 * wird.
 */
function windowDate(date, startedAtMs) {
  if (isBusinessDate(date)) return date
  return Number.isFinite(startedAtMs)
    ? toBusinessDate(new Date(startedAtMs))
    : null
}

/**
 * Ankunft an `stop`, wenn man `from` zur Zeit `at` (ms) verlaesst.
 * Vor Fensterbeginn wird gewartet: `arrival = max(eta, start)`. `late` heisst,
 * dass selbst die Ankunft nach dem Fensterende liegt.
 */
function arrivalAt(from, stop, at, vehicleType, window) {
  const leg = estimateLeg(from, point(stop), vehicleType)
  const eta = at + leg.duration * 1000
  const arrival = window.start != null ? Math.max(eta, window.start) : eta
  return {
    distance: leg.distance,
    eta,
    arrival,
    waitSeconds: Math.max(0, (arrival - eta) / 1000),
    late: window.end != null && arrival > window.end,
  }
}

/**
 * Bringt Stopps per Nearest Neighbour ab dem Startpunkt in Reihenfolge.
 *
 * Mit `options.startedAt` (ISO) und `options.date` (YYYY-MM-DD) werden die
 * Zeitfenster der Stopps beruecksichtigt - Heuristik "Nearest Neighbour mit
 * Zeitfenstern", identisch mit `optimizeRouteOrder()` im Frontend:
 *
 *   1. Je Kandidat wird die fruehestmoegliche Bedienung gerechnet:
 *      `max(Ankunft, Fensterbeginn)`. Ohne Fenster ist das die Ankunft, und
 *      die Sortierung faellt auf das gewoehnliche Nearest Neighbour zurueck.
 *   2. Kandidaten, deren Fenster schon verpasst waere, kommen nach allen
 *      anderen; ebenso Kandidaten, nach denen ein anderer Stopp mit Ende sein
 *      Fenster verloere, den man jetzt noch puenktlich erreichte (ein Schritt
 *      Vorausschau, direkter Weg).
 *   3. Bei gleicher Bedienzeit (beide warten auf denselben Fensterbeginn)
 *      entscheidet die kuerzere Etappe.
 *
 * Das ist keine exakte Loesung des Tourenproblems mit Zeitfenstern, aber
 * nachvollziehbar: "07:00-08:00" vor "08:00-09:00" vor "09:00-09:30", und ein
 * Stopp ohne Fenster wird dazwischen bedient, wo er ohne Wartezeit passt.
 *
 * Stopps ohne Koordinaten koennen nicht sortiert werden - sie behalten ihre
 * Eingabereihenfolge und haengen hinten an, statt die Tour zu verfaelschen.
 * Ohne Startpunkt (Depot nicht gefunden) bleibt die Reihenfolge, wie sie ist.
 */
function orderStopsNearestNeighbour(origin, stops, options) {
  if (!hasCoordinates(origin)) return [...stops]
  const locatable = stops.filter(hasCoordinates)
  const unlocatable = stops.filter((s) => !hasCoordinates(s))
  if (locatable.length <= 1) return [...locatable, ...unlocatable]

  const opts = options || {}
  const vehicleType = opts.vehicleType
  let cursor = Date.parse(opts.startedAt)
  const timed = Number.isFinite(cursor)
  // Ohne Startzeit zaehlt nur die Fahrzeit ab 0 - dieselbe Reihenfolge wie
  // die reine Entfernung, weil die Geschwindigkeit je Tour konstant ist.
  if (!timed) cursor = 0
  const date = timed ? windowDate(opts.date, cursor) : null
  const noWindow = { start: null, end: null }
  const windows = new Map(
    locatable.map((s) => [
      s,
      timed ? timeWindowBounds(date, s.timeWindow) : noWindow,
    ])
  )

  const remaining = [...locatable]
  const ordered = []
  let current = point(origin)

  while (remaining.length > 0) {
    let best = null
    for (const candidate of remaining) {
      const here = arrivalAt(
        current,
        candidate,
        cursor,
        vehicleType,
        windows.get(candidate)
      )

      let harms = false
      if (timed) {
        const depart = here.arrival + STOP_SERVICE_TIME * 1000
        for (const other of remaining) {
          if (other === candidate) continue
          const window = windows.get(other)
          if (window.end == null) continue
          const now = arrivalAt(current, other, cursor, vehicleType, window)
          // Schon jetzt nicht mehr zu schaffen - dann kann der Kandidat nichts
          // mehr verderben.
          if (now.late) continue
          const after = arrivalAt(
            point(candidate),
            other,
            depart,
            vehicleType,
            window
          )
          if (after.late) {
            harms = true
            break
          }
        }
      }

      const rank = [
        here.late ? 1 : 0,
        harms ? 1 : 0,
        here.arrival,
        here.distance,
      ]
      if (best === null || compareRank(rank, best.rank) < 0) {
        best = { stop: candidate, rank, arrival: here.arrival }
      }
    }

    remaining.splice(remaining.indexOf(best.stop), 1)
    ordered.push(best.stop)
    current = point(best.stop)
    cursor = best.arrival + STOP_SERVICE_TIME * 1000
  }

  return [...ordered, ...unlocatable]
}

function compareRank(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  }
  return 0
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
 * Ohne Depot-Koordinaten gibt es keine Strecke (`null`), keine Null.
 */
function estimateTour(depot, stops, vehicleType) {
  if (!hasCoordinates(depot)) {
    return { distance: null, duration: null, isEstimate: true, legs: 0 }
  }
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
 * Voraussichtliche Ankunft je Stopp ab `startedAt` (ISO) in Tourreihenfolge.
 *
 * Ein Stopp mit Zeitfenster wird nicht vor dem Fensterbeginn bedient:
 * `arrival = max(eta, Fensterbeginn)`. Die Wartezeit steht in `waitSeconds`
 * und schiebt alle folgenden Ankuenfte nach hinten - sonst stuende an der
 * Sammelstelle mit Fenster 09:00-09:30 "Ankunft ca. 06:34". Liegt selbst die
 * Ankunft nach dem Fensterende, ist `missesTimeWindow` gesetzt; die
 * Oberflaeche zeigt das als Hinweis. `date` ist der Tourtag der Fenster
 * (sonst der lokale Tag von `startedAt`).
 *
 * Rueckgabe je Stopp-ID: `{ arrival, waitSeconds, missesTimeWindow }`.
 * Stopps ohne Koordinaten bekommen keine Prognose; ohne Depot-Koordinaten
 * bleibt das Ergebnis leer.
 */
function estimateArrivalDetails(depot, stops, startedAt, vehicleType, date) {
  const arrivals = {}
  if (!hasCoordinates(depot)) return arrivals
  let cursor = new Date(startedAt).getTime()
  if (!Number.isFinite(cursor)) cursor = Date.now()
  const day = windowDate(date, cursor)
  let previous = point(depot)

  for (const stop of stops) {
    if (!hasCoordinates(stop)) continue
    const window = timeWindowBounds(day, stop.timeWindow)
    const here = arrivalAt(previous, stop, cursor, vehicleType, window)
    arrivals[stop.id] = {
      arrival: new Date(here.arrival).toISOString(),
      waitSeconds: here.waitSeconds,
      missesTimeWindow: here.late,
    }
    cursor = here.arrival + STOP_SERVICE_TIME * 1000
    previous = point(stop)
  }

  return arrivals
}

/** Wie `estimateArrivalDetails`, nur die Ankunft je Stopp-ID als ISO-String. */
function estimateArrivals(depot, stops, startedAt, vehicleType, date) {
  const details = estimateArrivalDetails(
    depot,
    stops,
    startedAt,
    vehicleType,
    date
  )
  const arrivals = {}
  for (const id of Object.keys(details)) arrivals[id] = details[id].arrival
  return arrivals
}

/**
 * Ausgangspunkt und -zeit der Ankunftsprognose.
 *
 * Geplante Tour: Depot ab Datum + geplanter Abfahrt (Default 06:30) - sonst
 * stuenden an der Samstagstour die Uhrzeiten von heute Nachmittag.
 *
 * Laufende Tour: ab dem zuletzt erledigten Stopp (Ort und Zeit) oder der
 * juengeren gemeldeten Fahrerposition, nie frueher als jetzt. Wuerde weiter ab
 * Depot und `startedAt` gerechnet, laege die Ankunft am sechsten Stopp um
 * neun Uhr noch bei 06:41.
 */
function arrivalBaseline(depot, tour, now) {
  const current = now === undefined ? Date.now() : now
  if (!tour.startedAt) {
    // Ist die geplante Abfahrt schon vorbei - Tourtag, der Fahrer hat noch
    // nicht abgehakt -, stuende sonst am ersten Stopp "Ankunft ca. 06:38",
    // waehrend die Uhr 10:48 zeigt. Frueher als jetzt geht es nicht.
    let planned = Date.parse(
      `${tour.date}T${
        isClockTime(tour.plannedStart) ? tour.plannedStart : '06:30'
      }:00`
    )
    if (!Number.isFinite(planned)) planned = current
    return {
      origin: depot,
      startedAt: new Date(Math.max(planned, current)).toISOString(),
    }
  }

  let origin = depot
  let at = Date.parse(tour.startedAt)
  if (!Number.isFinite(at)) at = 0

  for (const stop of tour.stops || []) {
    if (stop.status === 'open' || !hasCoordinates(stop)) continue
    const completed = Date.parse(stop.completedAt)
    if (Number.isFinite(completed) && completed >= at) {
      at = completed
      origin = stop
    }
  }

  const position = tour.lastPosition
  if (hasCoordinates(position)) {
    const reported = Date.parse(position.at)
    if (Number.isFinite(reported) && reported > at) {
      at = reported
      origin = position
    }
  }

  return { origin, startedAt: new Date(Math.max(at, current)).toISOString() }
}

/**
 * Neue Reihenfolge fuer "Route berechnen" auf einer laufenden Tour.
 *
 * Nur die offenen Stopps werden nach `orderIds` umsortiert, und zwar auf den
 * Plaetzen, die offene Stopps schon belegen; zugestellte und nicht
 * angetroffene bleiben, wo sie sind. Sonst rutschte der um sieben Uhr
 * gelieferte CAP-Markt ans Ende der Liste und hiesse ploetzlich "Stopp 6".
 * Offene Stopps, die in `orderIds` fehlen (keine Koordinaten), haengen in
 * ihrer bisherigen Reihenfolge hinter den sortierten. Gibt ein neues Array
 * zurueck; die Stopp-Objekte selbst bleiben dieselben.
 */
function applyOpenStopOrder(stops, orderIds) {
  const rank = new Map((orderIds || []).map((id, index) => [Number(id), index]))
  const rankOf = (stop) =>
    rank.has(Number(stop.id))
      ? rank.get(Number(stop.id))
      : Number.MAX_SAFE_INTEGER
  const open = stops
    .filter((s) => s.status === 'open')
    .sort((a, b) => rankOf(a) - rankOf(b))
  let next = 0
  return stops.map((s) => (s.status === 'open' ? open[next++] : s))
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

/**
 * Zieht den Tourstatus nach den Stopps nach - der Fahrer soll dafuer keinen
 * zweiten Knopf druecken muessen:
 *   - der erste abgehakte Stopp startet eine geplante Tour,
 *   - der letzte schliesst sie ab,
 *   - ein wieder geoeffneter oder nachtraeglich angelegter Stopp macht eine
 *     abgeschlossene Tour wieder zur laufenden.
 * Eine Tour ohne Stopps bleibt, wie sie ist.
 */
function syncTourStatus(tour, nowIso) {
  const now = nowIso || new Date().toISOString()
  const progress = tourProgress(tour)
  if (progress.total === 0) return tour

  if (tour.status === 'planned' && progress.done + progress.failed > 0) {
    tour.status = 'active'
    tour.startedAt = tour.startedAt || now
  }
  if (progress.isComplete) {
    if (tour.status !== 'done') {
      tour.status = 'done'
      tour.startedAt = tour.startedAt || now
      tour.finishedAt = now
    }
  } else if (tour.status === 'done') {
    tour.status = 'active'
    tour.finishedAt = null
    tour.startedAt = tour.startedAt || now
  }
  return tour
}

function wholeNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function isBusinessDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  // "2026-13-45" passt zum Muster, ist aber kein Tag.
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  )
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

  // Optionale Sammelstelle. Ist sie gesetzt, ist der Stopp eine Uebergabe-
  // stelle: der Server haengt beim Lesen die Vorbestellungen des Tourtags an
  // (siehe `decorateTour` in `simple-server.js`).
  const pickupPointId =
    source.pickupPointId === undefined
      ? base.pickupPointId || null
      : String(source.pickupPointId || '').trim() || null

  const street = String(
    source.street === undefined ? base.street || '' : source.street
  ).trim()
  // Eine Sammelstelle darf ohne Strasse stehen: die Adresse des Kindergartens
  // ist noch nicht bekannt und wird nicht erfunden. Sonst liesse sich so ein
  // Stopp nicht einmal abhaken.
  if (!street && !pickupPointId) {
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

  if (pickupPointId) stop.pickupPointId = pickupPointId

  // Koordinaten duerfen manuell gesetzt werden, wenn die Adresssuche daneben
  // liegt. `null` loescht sie und stoesst eine neue Suche an.
  if (source.lat !== undefined || source.lon !== undefined) {
    const blank = (v) => v === undefined || v === null || v === ''
    if (blank(source.lat) && blank(source.lon)) {
      stop.lat = null
      stop.lon = null
      stop.geocodeSource = null
    } else {
      // `validateCoordinates` statt `Number.isFinite(Number(x))`: `null`
      // waere sonst 0, und ein halbes Paar oder (0, 0) setzte den Stopp auf
      // den Nullmeridian statt eine Fehlermeldung auszuloesen.
      const coords = validateCoordinates(source.lat, source.lon)
      if (coords.error) return coords
      stop.lat = coords.lat
      stop.lon = coords.lon
      stop.geocodeSource = 'manual'
    }
    // Die Genauigkeit gehoert zum Suchtreffer; von Hand gesetzte oder
    // geloeschte Koordinaten haben keine.
    stop.geocodePrecision = null
  }

  // Grund und Verbleib der Ware gehoeren zu "nicht angetroffen". Sie kommen
  // auch aus der Offline-Warteschlange der Fahrer-App, deshalb werden sie
  // geprueft wie jedes andere Feld - ein Tippfehler im Body soll eine 400
  // geben, nicht lautlos eine leere Angabe.
  if (
    source.failureReason !== undefined &&
    source.failureReason !== null &&
    String(source.failureReason).trim().length > FAILURE_REASON_MAX_LENGTH
  ) {
    return {
      error: 'Failure reason too long',
      message: `Der Grund darf höchstens ${FAILURE_REASON_MAX_LENGTH} Zeichen lang sein.`,
    }
  }
  const goodsDisposition =
    source.goodsDisposition === undefined
      ? base.goodsDisposition || null
      : source.goodsDisposition || null
  if (
    goodsDisposition !== null &&
    !GOODS_DISPOSITION.includes(goodsDisposition)
  ) {
    return {
      error: 'Invalid goods disposition',
      message:
        'Verbleib der Ware muss "taken_back" (mitgenommen) oder "left_at_address" (abgestellt) sein.',
    }
  }

  if (status === 'done' && base.status !== 'done') {
    stop.completedAt = source.completedAt || new Date().toISOString()
    stop.failureReason = null
    stop.goodsDisposition = null
  }
  if (status === 'failed') {
    stop.completedAt = source.completedAt || new Date().toISOString()
    stop.failureReason =
      String(source.failureReason || base.failureReason || '').trim() ||
      'Nicht angetroffen'
    stop.goodsDisposition = goodsDisposition
  }
  if (status === 'open') {
    stop.completedAt = null
    stop.failureReason = null
    stop.goodsDisposition = null
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
  GOODS_DISPOSITION,
  FAILURE_REASON_MAX_LENGTH,
  haversineMeters,
  normalizeAddress,
  formatAddress,
  hasCoordinates,
  isNumber,
  isLatitude,
  isLongitude,
  validateCoordinates,
  scrubCoordinates,
  isClockTime,
  applyOpenStopOrder,
  parseTimeWindow,
  timeWindowBounds,
  orderStopsNearestNeighbour,
  estimateLeg,
  estimateTour,
  estimateArrivals,
  estimateArrivalDetails,
  arrivalBaseline,
  tourProgress,
  nextOpenStop,
  syncTourStatus,
  normalizeStopInput,
  normalizePhone,
  wholeNumber,
  isBusinessDate,
  nextWeekday,
  toBusinessDate,
}
