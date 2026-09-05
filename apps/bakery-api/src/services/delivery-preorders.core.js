/**
 * Rechenkern der Vorbestellungen an einer Sammelstelle - dependency-freies
 * CommonJS, gleiche Konvention wie `delivery-tours.core.js` und
 * `partner-stats.core.js`. Einziges `require`: der Tour-Kern nebenan, damit
 * `wholeNumber`, `isBusinessDate` und `normalizePhone` nicht ein zweites Mal
 * im Code stehen.
 *
 * Modell: samstags faehrt die Baeckerei an eine *Sammelstelle* (den
 * Kindergarten in Moersbach). Die Kundschaft bestellt vorher vor, die Ware
 * wird gesammelt hingebracht und dort in einem Zeitfenster uebergeben. Fuer den
 * Fahrer ist das *ein* Stopp der Tour - aber einer mit Uebergabeliste.
 *
 *   Zeilensumme = runde(Menge x Preis-Snapshot)
 *   Bestellsumme = runde(Summe der Zeilensummen)
 *
 * Zweimal gerundet, weil Fliesskomma sonst driftet: 3 x 4,10 EUR ist in
 * JavaScript 12.299999999999999.
 *
 * Preis, Name und Einheit sind ein **Snapshot aus `hq`** - dieselbe Regel wie
 * bei `PartnerVisitItem`: eine spaetere Preisaenderung darf eine alte
 * Abrechnung nicht rueckwirkend veraendern. Der Client schickt deshalb nur
 * `productId` und `qty`; ein mitgeschickter Preis wird ignoriert (wie in
 * `shop-orders.core.js`).
 */

'use strict'

const tours = require('./delivery-tours.core')

/**
 * Zustaende einer Vorbestellung. `cancelled` statt Loeschen: die Vorbestellung
 * ist die einzige Aufzeichnung dessen, was jemand bestellt hat.
 */
const PREORDER_STATUS = ['open', 'handed_over', 'not_collected', 'cancelled']

const PREORDER_STATUS_LABELS = {
  open: 'Offen',
  handed_over: 'Übergeben',
  not_collected: 'Nicht abgeholt',
  cancelled: 'Storniert',
}

/** Wochentage nach `Date.getDay()` - 0 = Sonntag, wie in `nextWeekday()`. */
const WEEKDAY_LABELS = {
  0: 'Sonntag',
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
}

const MAX_ITEMS = 50
const MAX_QTY_PER_ITEM = 99
const MAX_TEXT_LENGTH = 500

/** Rundet auf ganze Cent - `3 * 4.1` ist in Fliesskomma nicht exakt `12.3`. */
function roundCents(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

/** Zeilensumme einer Position. */
function lineTotal(qty, unitPrice) {
  const menge = tours.wholeNumber(qty, 0)
  const preis = Number(unitPrice)
  if (menge <= 0 || !Number.isFinite(preis) || preis < 0) return 0
  return roundCents(menge * preis)
}

/**
 * Summe einer Bestellung. Erst jede Zeile runden, dann die gerundeten Zeilen
 * addieren und noch einmal runden - sonst summieren sich die Fliesskomma-Reste.
 */
function orderTotal(items) {
  const list = Array.isArray(items) ? items : []
  return roundCents(
    list.reduce(
      (sum, item) =>
        sum +
        (item && item.lineTotal !== undefined
          ? roundCents(item.lineTotal)
          : lineTotal(item && item.qty, item && item.unitPrice)),
      0
    )
  )
}

/** `2026-09-12` -> `12.09.2026`, fuer die Fehlertexte. */
function formatGermanDate(iso) {
  if (!tours.isBusinessDate(iso)) return String(iso == null ? '' : iso)
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

/** Wochentag eines Geschaeftsdatums nach `Date.getDay()`, sonst `null`. */
function weekdayOf(iso) {
  if (!tours.isBusinessDate(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay()
}

/**
 * Ortsname der Sammelstelle fuer die Fehlermeldung - der letzte Teil des Orts
 * ("Zweibrücken-Mörsbach" -> "Mörsbach"), sonst der Name der Stelle. Bewusst
 * abgeleitet und nicht als weiteres Feld gepflegt: es gibt sonst zwei
 * Wahrheiten ueber denselben Ort.
 */
function placeLabel(pickupPoint) {
  const city = String((pickupPoint && pickupPoint.city) || '').trim()
  if (city) {
    const parts = city.split('-').filter(Boolean)
    return parts[parts.length - 1].trim()
  }
  return String((pickupPoint && pickupPoint.name) || 'die Sammelstelle').trim()
}

/**
 * Kuerzel einer Sammelstelle fuer die Referenz: die ersten beiden Buchstaben
 * des letzten Slug-Teils, also `kindergarten-moersbach` -> `MO`.
 */
function referencePrefix(pickupPointId) {
  const slug = String(pickupPointId == null ? '' : pickupPointId)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
  const parts = slug.split('-').filter(Boolean)
  const last = parts.length ? parts[parts.length - 1] : ''
  const letters = last.replace(/[^a-z]/g, '').slice(0, 2)
  return (letters || 'vb').toUpperCase()
}

/**
 * Naechste Referenz je Sammelstelle und Tag: `MO-2026-09-12-03`.
 *
 * Gezaehlt wird ueber *alle* Vorbestellungen des Tages, auch stornierte - eine
 * einmal ausgesprochene Nummer darf nicht ein zweites Mal vergeben werden,
 * sonst rufen vor Ort zwei Leute auf dieselbe Nummer.
 */
function nextReference(list, pickupPointId, date) {
  const prefix = referencePrefix(pickupPointId)
  const base = `${prefix}-${date}-`
  let max = 0
  for (const entry of Array.isArray(list) ? list : []) {
    if (!entry || entry.pickupPointId !== pickupPointId) continue
    if (entry.date !== date) continue
    const reference = String(entry.reference || '')
    const seq = reference.startsWith(base)
      ? Number(reference.slice(base.length))
      : 0
    if (Number.isFinite(seq) && seq > max) max = seq
  }
  return `${base}${String(max + 1).padStart(2, '0')}`
}

/**
 * Zeitpunkt des Bestellschlusses zu einem Liefertag als ISO-Zeitpunkt.
 *
 * `orderDeadline` ist `{ weekday, time }` - der letzte Wochentag dieser Art
 * *vor oder an* dem Liefertag. Fuer die Samstagstour mit `weekday: 5` ist das
 * der Freitag davor. Gerechnet wird in lokaler Zeit: die Baeckerei steht in
 * Homburg, und "Freitag 12 Uhr" meint die Uhr an der Wand.
 */
function deadlineFor(date, orderDeadline) {
  if (!tours.isBusinessDate(date) || !orderDeadline) return null
  const weekday = tours.wholeNumber(orderDeadline.weekday, -1)
  if (weekday < 0 || weekday > 6) return null
  const time = String(orderDeadline.time || '')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null

  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const at = new Date(y, m - 1, d, hh, mm, 0, 0)
  // Rueckwaerts bis zum passenden Wochentag; 0 heisst "am Liefertag selbst".
  const delta = (at.getDay() - weekday + 7) % 7
  at.setDate(at.getDate() - delta)
  return at.toISOString()
}

/** Ist der Bestellschluss zu diesem Liefertag schon vorbei? */
function isAfterDeadline(date, orderDeadline, now) {
  const deadline = deadlineFor(date, orderDeadline)
  if (!deadline) return false
  const at = Date.parse(deadline)
  if (!Number.isFinite(at)) return false
  const current = now === undefined ? Date.now() : new Date(now).getTime()
  return Number.isFinite(current) ? current > at : false
}

/**
 * Zaehlt einen Stapel Vorbestellungen aus: Anzahl, Summe, Stand je Status und
 * die Backliste (Menge je Produkt).
 *
 * Stornierte Bestellungen zaehlen nirgends mit - sie bleiben nur sichtbar.
 */
function summarizePreorders(list) {
  const all = Array.isArray(list) ? list : []
  const active = all.filter((p) => p && p.status !== 'cancelled')
  const byProduct = new Map()

  for (const preorder of active) {
    for (const item of preorder.items || []) {
      const key = String(item.productId)
      const entry = byProduct.get(key) || {
        productId: item.productId,
        name: item.name,
        unit: item.unit,
        qty: 0,
      }
      entry.qty += tours.wholeNumber(item.qty, 0)
      byProduct.set(key, entry)
    }
  }

  return {
    count: active.length,
    total: roundCents(active.reduce((sum, p) => sum + roundCents(p.total), 0)),
    open: active.filter((p) => p.status === 'open').length,
    handedOver: active.filter((p) => p.status === 'handed_over').length,
    notCollected: active.filter((p) => p.status === 'not_collected').length,
    cancelled: all.length - active.length,
    byProduct: [...byProduct.values()].sort((a, b) =>
      String(a.name).localeCompare(String(b.name), 'de')
    ),
  }
}

/**
 * Haengt die berechneten Felder an eine Vorbestellung - nie im Store
 * gespeichert, weil `afterDeadline` mit der Uhr wandert.
 */
function decoratePreorder(preorder, pickupPoint, now) {
  const orderDeadline = pickupPoint && pickupPoint.orderDeadline
  return {
    ...preorder,
    deadline: deadlineFor(preorder.date, orderDeadline),
    afterDeadline: isAfterDeadline(preorder.date, orderDeadline, now),
  }
}

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function fail(error, message, status) {
  return { error, message, status: status || 400 }
}

/**
 * Erlaubte Statuswechsel. Zwei Wege sind gesperrt, beide, weil sonst eine
 * Aufzeichnung verschwindet:
 *
 * - `handed_over` -> `cancelled`: die Ware ist raus und das Geld kassiert. Ein
 *   Storno loeschte den Uebergabezeitpunkt und den Betrag aus der Abrechnung -
 *   das Bargeld in der Kasse haette danach keinen Beleg mehr.
 * - `cancelled` -> `handed_over` / `not_collected`: so kommt ein Nachlauf aus
 *   der Offline-Warteschlange des Fahrers an, der die Stornierung von gestern
 *   noch nicht kennt. Die Fahrer-App wirft 4xx aus der Schlange und zeigt den
 *   Hinweis - besser als eine lautlos wiederbelebte Bestellung.
 *
 * Zurueck auf `open` bleibt in beiden Faellen moeglich: das ist der Weg, den
 * die Meldung vorschlaegt, und er laesst sich vom Team bewusst gehen.
 */
function checkStatusTransition(from, to) {
  if (!from || from === to) return null
  if (from === 'handed_over' && to === 'cancelled') {
    return fail(
      'Preorder already handed over',
      'Diese Vorbestellung wurde bereits übergeben und kann nicht storniert werden — bitte zuerst auf „Offen" zurücksetzen.',
      409
    )
  }
  if (
    from === 'cancelled' &&
    (to === 'handed_over' || to === 'not_collected')
  ) {
    return fail(
      'Preorder cancelled',
      'Diese Vorbestellung wurde storniert — bitte zuerst auf „Offen" zurücksetzen.',
      409
    )
  }
  return null
}

/**
 * Storniert eine Vorbestellung (`DELETE`). Geloescht wird nichts: sie ist die
 * einzige Aufzeichnung dessen, was jemand bestellt hat. Eine bereits
 * uebergebene Bestellung laesst sich nicht stornieren - siehe
 * `checkStatusTransition()`.
 */
function cancelPreorder(existing) {
  const base = existing || {}
  const blocked = checkStatusTransition(base.status, 'cancelled')
  if (blocked) return blocked
  return {
    preorder: {
      ...base,
      status: 'cancelled',
      handedOverAt: null,
      updatedAt: new Date().toISOString(),
    },
  }
}

/**
 * Prueft und normalisiert eine Vorbestellung aus dem Request-Body.
 *
 * @param {object} body geparster Request-Body.
 * @param {object|null} existing bestehende Vorbestellung bei `PATCH`.
 * @param {object} options
 * @param {(productId: string) => (object|null)} options.lookupProduct loest eine
 *   Produkt-ID (Slug oder numerische ID) auf ein `hq`-Produkt auf. Name,
 *   Einheit und Preis kommen von dort, nicht aus dem Body.
 * @param {object} options.pickupPoint die Sammelstelle - ihr `weekday` legt
 *   fest, an welchen Tagen ueberhaupt geliefert wird.
 * @returns {{ preorder: object } | { error: string, message: string }}
 */
function normalizePreorderInput(body, existing, options) {
  const source = body || {}
  const base = existing || {}
  const opts = options || {}
  const pickupPoint = opts.pickupPoint || null

  const customer = trimmed(
    source.customer === undefined ? base.customer || '' : source.customer
  )
  if (!customer) {
    return fail('Customer is required', 'Der Name des Kunden ist erforderlich.')
  }
  if (customer.length > MAX_TEXT_LENGTH) {
    return fail('Customer too long', 'Der Name des Kunden ist zu lang.')
  }

  const date = trimmed(
    source.date === undefined ? base.date || '' : source.date
  )
  if (!tours.isBusinessDate(date)) {
    return fail(
      'Invalid date',
      'Das Datum muss im Format JJJJ-MM-TT angegeben werden.'
    )
  }
  if (pickupPoint && tours.isNumber(pickupPoint.weekday)) {
    const weekday = Number(pickupPoint.weekday)
    if (weekdayOf(date) !== weekday) {
      return fail(
        'Invalid delivery day',
        `Der ${formatGermanDate(date)} ist kein ${
          WEEKDAY_LABELS[weekday] || 'Liefertag'
        } — an diesem Tag wird nicht nach ${placeLabel(pickupPoint)} geliefert.`
      )
    }
  }

  const status =
    source.status === undefined ? base.status || 'open' : String(source.status)
  if (!PREORDER_STATUS.includes(status)) {
    return fail(
      'Invalid status',
      'Status muss "open", "handed_over", "not_collected" oder "cancelled" sein.'
    )
  }
  const blocked = checkStatusTransition(base.status, status)
  if (blocked) return blocked

  if (
    source.note !== undefined &&
    source.note !== null &&
    typeof source.note !== 'string'
  ) {
    return fail('Invalid note', 'Die Anmerkung ist ungültig.')
  }
  const note =
    source.note === undefined ? base.note || null : trimmed(source.note) || null
  if (note && note.length > MAX_TEXT_LENGTH) {
    return fail('Note too long', 'Bitte fassen Sie die Anmerkung kürzer.')
  }

  // Positionen: fehlen sie im Body (reines Abhaken per PATCH), bleiben die
  // bestehenden stehen - inklusive ihrer Preis-Snapshots.
  let items
  if (source.items === undefined) {
    items = Array.isArray(base.items) ? base.items : []
  } else {
    if (!Array.isArray(source.items)) {
      return fail('Invalid items', 'Die Artikelliste ist ungültig.')
    }
    if (source.items.length > MAX_ITEMS) {
      return fail(
        'Too many items',
        `Eine Vorbestellung darf höchstens ${MAX_ITEMS} verschiedene Artikel enthalten.`
      )
    }
    // Die Snapshots der schon erfassten Positionen. Die Erfassungsmaske
    // schickt bei jeder Aenderung die komplette Positionsliste mit; wuerde der
    // Preis dabei erneut aus `hq` geholt, machte eine Preisaenderung von
    // gestern die Bestellung von vorgestern rueckwirkend teurer - genau das,
    // was der Snapshot verhindern soll. Nur wirklich neue Positionen fragen
    // `lookupProduct()`.
    const snapshots = new Map()
    for (const item of Array.isArray(base.items) ? base.items : []) {
      if (item && item.productId != null) {
        snapshots.set(String(item.productId), item)
      }
    }

    items = []
    for (const raw of source.items) {
      if (!raw || typeof raw !== 'object') {
        return fail('Invalid items', 'Eine Position ist unvollständig.')
      }
      const productId =
        typeof raw.productId === 'number'
          ? String(raw.productId)
          : trimmed(raw.productId)
      if (!productId) {
        return fail('Invalid items', 'Eine Position ist unvollständig.')
      }
      const qty = tours.wholeNumber(raw.qty, 0)
      // Menge 0 heisst "Zeile gestrichen" - die Maske schickt beim Loeschen
      // gerne eine 0 statt die Zeile wegzulassen.
      if (qty <= 0) continue
      if (qty > MAX_QTY_PER_ITEM) {
        return fail(
          'Invalid quantity',
          `Bitte wählen Sie je Artikel eine Menge zwischen 1 und ${MAX_QTY_PER_ITEM}.`
        )
      }

      let name = trimmed(raw.name)
      let unit = trimmed(raw.unit) || 'Stück'
      let unitPrice = raw.unitPrice

      const snapshot = snapshots.get(productId)
      if (snapshot) {
        // Bestehende Position: Name, Einheit und Preis bleiben, wie sie beim
        // Erfassen zugesagt wurden. Geaendert wird nur die Menge.
        name = trimmed(snapshot.name) || name
        unit = trimmed(snapshot.unit) || unit
        unitPrice = snapshot.unitPrice
      } else if (typeof opts.lookupProduct === 'function') {
        const product = opts.lookupProduct(productId)
        if (!product) {
          return fail(
            'Unknown product',
            `„${name || productId}“ steht nicht im Sortiment.`
          )
        }
        // Name, Einheit und Preis kommen aus hq - der Body ist nur ein Wunsch.
        name = trimmed(product.name) || name
        unit = trimmed(product.unit) || unit
        unitPrice = product.price
      }

      if (!name) {
        return fail('Invalid items', 'Eine Position ist unvollständig.')
      }
      const price = Number(unitPrice)
      if (!Number.isFinite(price) || price < 0) {
        return fail('Invalid price', `Für „${name}“ ist kein Preis hinterlegt.`)
      }

      items.push({
        productId,
        name,
        qty,
        unit,
        unitPrice: roundCents(price),
        lineTotal: lineTotal(qty, price),
      })
    }
  }

  if (items.length === 0) {
    return fail(
      'Items are required',
      'Eine Vorbestellung braucht mindestens eine Position.'
    )
  }

  const preorder = {
    ...base,
    pickupPointId: pickupPoint
      ? pickupPoint.id
      : base.pickupPointId || trimmed(source.pickupPointId) || null,
    date,
    customer,
    phone: tours.normalizePhone(
      source.phone === undefined ? base.phone : source.phone
    ),
    items,
    total: orderTotal(items),
    note,
    status,
    // Nur eine tatsaechliche Uebergabe traegt einen Zeitpunkt; wird der Kunde
    // wieder auf "offen" gesetzt, muss er verschwinden, sonst stuende in der
    // Liste "übergeben um 09:12" an einer offenen Bestellung.
    handedOverAt:
      status === 'handed_over'
        ? base.handedOverAt || new Date().toISOString()
        : null,
    updatedAt: new Date().toISOString(),
  }

  return { preorder }
}

/**
 * Prueft und normalisiert eine Sammelstelle (`PUT /pickup-points/:id`).
 * Die Adresse des Kindergartens ist noch nicht bekannt - eine leere Strasse
 * ist deshalb erlaubt, der Ort bleibt dann ohne Kartenpunkt.
 */
function normalizePickupPointInput(body, existing) {
  const source = body || {}
  const base = existing || {}

  const name = trimmed(
    source.name === undefined ? base.name || '' : source.name
  )
  if (!name) {
    return fail(
      'Name is required',
      'Der Name der Lieferstelle ist erforderlich.'
    )
  }

  const weekday = tours.wholeNumber(
    source.weekday === undefined ? base.weekday : source.weekday,
    -1
  )
  if (weekday < 0 || weekday > 6) {
    return fail(
      'Invalid weekday',
      'Der Liefertag muss ein Wochentag von 0 (Sonntag) bis 6 (Samstag) sein.'
    )
  }

  const window = trimmed(
    source.window === undefined ? base.window || '' : source.window
  )
  if (
    window &&
    !/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(window)
  ) {
    return fail(
      'Invalid window',
      'Das Übergabefenster muss im Format HH:MM-HH:MM angegeben werden.'
    )
  }

  const deadlineSource =
    source.orderDeadline === undefined
      ? base.orderDeadline || null
      : source.orderDeadline
  let orderDeadline = null
  if (deadlineSource) {
    const deadlineWeekday = tours.wholeNumber(deadlineSource.weekday, -1)
    const time = trimmed(deadlineSource.time)
    if (
      deadlineWeekday < 0 ||
      deadlineWeekday > 6 ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    ) {
      return fail(
        'Invalid order deadline',
        'Der Bestellschluss braucht einen Wochentag (0-6) und eine Uhrzeit im Format HH:MM.'
      )
    }
    orderDeadline = { weekday: deadlineWeekday, time }
  }

  const street = trimmed(
    source.street === undefined ? base.street || '' : source.street
  )
  const zip = trimmed(source.zip === undefined ? base.zip || '' : source.zip)
  const city = trimmed(
    source.city === undefined ? base.city || '' : source.city
  )

  const pickupPoint = {
    ...base,
    name,
    street,
    zip,
    city,
    weekday,
    window: window || null,
    orderDeadline,
    notes:
      source.notes === undefined
        ? base.notes || null
        : trimmed(source.notes) || null,
    active:
      source.active === undefined ? base.active !== false : !!source.active,
  }

  // Aendert sich die Adresse, sind die alten Koordinaten falsch - sie werden
  // geloescht, damit der Aufrufer neu sucht. Von Hand gesetzte Koordinaten
  // gewinnen, wie bei den Stopps.
  const addressChanged =
    street !== trimmed(base.street) ||
    zip !== trimmed(base.zip) ||
    city !== trimmed(base.city)
  if (source.lat !== undefined || source.lon !== undefined) {
    if (tours.isNumber(source.lat) && tours.isNumber(source.lon)) {
      pickupPoint.lat = Number(source.lat)
      pickupPoint.lon = Number(source.lon)
      pickupPoint.geocodeSource = 'manual'
    } else {
      pickupPoint.lat = null
      pickupPoint.lon = null
      pickupPoint.geocodeSource = null
    }
    pickupPoint.geocodePrecision = null
  } else if (addressChanged) {
    pickupPoint.lat = null
    pickupPoint.lon = null
    pickupPoint.geocodeSource = null
    pickupPoint.geocodePrecision = null
  }

  return { pickupPoint }
}

/**
 * Migration nach vorne: ein Liefer-Store aus der Zeit vor den Sammelstellen
 * kennt `pickupPoints` und `preorders` nicht. Sie kommen dann aus dem Seed
 * bzw. leer dazu - alles andere am Store, insbesondere die Touren, bleibt
 * unangetastet.
 */
function migratePickupKeys(parsed, seed) {
  const source = parsed || {}
  const fallback = seed || {}
  return {
    pickupPoints: Array.isArray(source.pickupPoints)
      ? source.pickupPoints
      : Array.isArray(fallback.pickupPoints)
      ? fallback.pickupPoints
      : [],
    preorders: Array.isArray(source.preorders) ? source.preorders : [],
  }
}

/** Vorbestellungen eines Tages an einer Sammelstelle, ohne stornierte. */
function preordersForStop(preorders, pickupPointId, date) {
  return (Array.isArray(preorders) ? preorders : []).filter(
    (p) =>
      p &&
      p.pickupPointId === pickupPointId &&
      p.date === date &&
      p.status !== 'cancelled'
  )
}

/** Die aktiven Sammelstellen, an die an diesem Datum geliefert wird. */
function pickupPointsForDate(pickupPoints, date) {
  const weekday = weekdayOf(date)
  if (weekday === null) return []
  return (Array.isArray(pickupPoints) ? pickupPoints : []).filter(
    (point) =>
      point && point.active !== false && Number(point.weekday) === weekday
  )
}

/**
 * Der Stopp, der aus einer Sammelstelle wird - ohne `id`, die vergibt der
 * Aufrufer. Koordinaten kommen mit, wenn die Sammelstelle welche hat; sonst
 * bleibt der Stopp ohne Kartenpunkt, statt in der Ortsmitte zu landen.
 */
function buildPickupStop(pickupPoint) {
  const point = pickupPoint || {}
  const located = tours.hasCoordinates(point)
  return {
    customer: String(point.name || 'Sammelstelle'),
    street: String(point.street || ''),
    zip: String(point.zip || ''),
    city: String(point.city || ''),
    phone: null,
    timeWindow: point.window || null,
    notes: 'Sammelstelle: Vorbestellungen übergeben.',
    items: [],
    pickupPointId: point.id,
    status: 'open',
    completedAt: null,
    failureReason: null,
    lat: located ? Number(point.lat) : null,
    lon: located ? Number(point.lon) : null,
    geocodeSource: located ? point.geocodeSource || null : null,
    geocodePrecision: located ? point.geocodePrecision || null : null,
  }
}

/**
 * Gibt es an diesem Tag ueberhaupt eine Tour mit dem Stopp der Sammelstelle?
 *
 * Ohne ihn haengt die Uebergabeliste an nichts: die Vorbestellungen erreichen
 * den Fahrer nie und blieben fuer immer offen. Die Management-Oberflaeche
 * warnt damit, statt das lautlos geschehen zu lassen.
 */
function hasPickupStop(tourList, pickupPointId, date) {
  return (Array.isArray(tourList) ? tourList : []).some(
    (tour) =>
      tour &&
      tour.date === date &&
      (Array.isArray(tour.stops) ? tour.stops : []).some(
        (stop) => stop && stop.pickupPointId === pickupPointId
      )
  )
}

module.exports = {
  PREORDER_STATUS,
  PREORDER_STATUS_LABELS,
  WEEKDAY_LABELS,
  MAX_ITEMS,
  MAX_QTY_PER_ITEM,
  roundCents,
  lineTotal,
  orderTotal,
  formatGermanDate,
  weekdayOf,
  placeLabel,
  referencePrefix,
  nextReference,
  deadlineFor,
  isAfterDeadline,
  summarizePreorders,
  decoratePreorder,
  checkStatusTransition,
  cancelPreorder,
  pickupPointsForDate,
  buildPickupStop,
  hasPickupStop,
  normalizePreorderInput,
  normalizePickupPointInput,
  migratePickupKeys,
  preordersForStop,
}
