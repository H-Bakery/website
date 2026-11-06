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

/**
 * Hoechstlaengen der Sammelstellen-Stammdaten (`PUT /pickup-points/:id`,
 * W4). Ohne Grenze landete ein beliebig langer Text in der Datenbank und auf
 * jeder Abholliste; die 200-kB-Grenze des JSON-Parsers ist dafuer zu grob.
 */
const PICKUP_POINT_LIMITS = {
  name: { max: 100, label: 'Der Name darf' },
  street: { max: 200, label: 'Die Straße darf' },
  zip: { max: 10, label: 'Die PLZ darf' },
  city: { max: 100, label: 'Der Ort darf' },
  notes: { max: 2000, label: 'Die Notizen dürfen' },
}

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

/** Tage zwischen zwei Geschaeftsdaten (b - a), kalendarisch. */
function daysBetween(a, b) {
  const [ya, ma, da] = a.split('-').map(Number)
  const [yb, mb, db] = b.split('-').map(Number)
  return Math.round(
    (Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000
  )
}

/**
 * Steuerzeichen, die in einem Namen nichts verloren haben: C0/C1 (auch NUL),
 * DEL und die Bidi-Steuerzeichen (LRM/RLM, LRE…RLO, LRI…PDI), mit denen sich
 * ein Name in der Abholliste optisch umdrehen liesse. Die Anmerkung darf
 * Zeilenumbrueche und Tabs behalten.
 */
const {
  NAME_CONTROL_CHARS,
  TEXT_CONTROL_CHARS: NOTE_CONTROL_CHARS,
} = require('./control-chars.core')

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
  const codes = []
  for (const entry of Array.isArray(list) ? list : []) {
    if (!entry || entry.pickupPointId !== pickupPointId) continue
    if (entry.date !== date) continue
    codes.push(entry.reference)
  }
  return nextCode(codes, referencePrefix(pickupPointId), date)
}

/**
 * Naechster Code `<PREFIX>-<date>-<nn>` zu einer Liste schon vergebener Codes
 * (B7). Gezaehlt wird ueber alle Codes mit diesem Anfang - auch die
 * stornierter Bestellungen, s. `nextReference()`.
 */
function nextCode(codes, prefix, date) {
  const base = `${prefix}-${date}-`
  let max = 0
  for (const code of Array.isArray(codes) ? codes : []) {
    const text = String(code || '')
    const seq = text.startsWith(base) ? Number(text.slice(base.length)) : 0
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

  const notes =
    source.notes === undefined
      ? base.notes || null
      : trimmed(source.notes) || null

  // Nur was der Aufrufer schickt, wird gemessen - ein Altbestand ueber der
  // Grenze bleibt speicherbar, solange niemand das Feld anfasst.
  const texts = { name, street, zip, city, notes: notes || '' }
  for (const key of Object.keys(PICKUP_POINT_LIMITS)) {
    if (source[key] === undefined) continue
    const limit = PICKUP_POINT_LIMITS[key]
    if (texts[key].length > limit.max) {
      return fail(
        'Text too long',
        `${limit.label} höchstens ${limit.max} Zeichen lang sein.`
      )
    }
  }

  const pickupPoint = {
    ...base,
    name,
    street,
    zip,
    city,
    weekday,
    window: window || null,
    orderDeadline,
    notes,
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
    const blank = (v) => v === undefined || v === null || v === ''
    if (blank(source.lat) && blank(source.lon)) {
      pickupPoint.lat = null
      pickupPoint.lon = null
      pickupPoint.geocodeSource = null
    } else {
      // Dieselbe Regel wie bei den Stopps (`validateCoordinates`): ein halbes
      // Paar, 999 oder (0, 0) ist ein Fehler. Vorher galt `isNumber` allein,
      // und `hasCoordinates` verwarf den Wert spaeter stillschweigend - bei
      // einer Sammelstelle ohne Strasse blieb er bis zum naechsten Neustart
      // im Store.
      const coords = tours.validateCoordinates(source.lat, source.lon)
      if (coords.error) return fail(coords.error, coords.message)
      pickupPoint.lat = coords.lat
      pickupPoint.lon = coords.lon
      pickupPoint.geocodeSource = 'manual'
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
    goodsDisposition: null,
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

// ===========================================================================
// B7: das allgemeine Vorbestell-Modell der echten API
// ===========================================================================
//
// Die Sammelstelle oben ist ein Sonderfall: jede Vorbestellung - am Telefon,
// per WhatsApp, an der Theke, aus dem Shop oder fuer Moersbach - wird
// entweder **im Laden** (Datum + optional Uhrzeit) oder an einer
// **Sammelstelle** (Datum = ihr Liefertag, ihr Fenster gilt) abgeholt.
//
//   Status   offen -> bereit -> abgeholt, oder storniert
//   gesperrt abgeholt -> storniert   (Ware raus, Geld kassiert)
//            storniert -> bereit | abgeholt (Nachlauf kennt das Storno nicht)
//   "Nicht abgeholt" ist kein eigener Status, sondern `bereit` +
//   `notCollectedAt` - die Ware liegt da, die Kundschaft kam nicht.
//
// Abbildung der Mock-Status (Alias `/api/deliveries/preorders`):
//
//   open          <-> offen, bereit (ohne notCollectedAt)
//   handed_over   <-> abgeholt
//   not_collected <-> bereit + notCollectedAt
//   cancelled     <-> storniert
//
// Die Uebergaenge sind auf beiden Seiten dieselben, deshalb kann der Alias die
// alte Pruefung (`checkStatusTransition`) mit ihren Meldungen behalten.

const CHANNELS = ['laden', 'telefon', 'whatsapp', 'shop', 'sammelstelle']

const CHANNEL_LABELS = {
  laden: 'Laden',
  telefon: 'Telefon',
  whatsapp: 'WhatsApp',
  shop: 'Online-Shop',
  sammelstelle: 'Sammelstelle',
}

const STATUS = ['offen', 'bereit', 'abgeholt', 'storniert']

const STATUS_LABELS = {
  offen: 'Offen',
  bereit: 'Bereit',
  abgeholt: 'Abgeholt',
  storniert: 'Storniert',
}

/** Filterwert fuer "Abholung im Laden" - darf keine Sammelstellen-ID sein. */
const LADEN_PICKUP = 'laden'

/** Code-Kuerzel einer Abholung im Laden: `LA-2026-11-21-03`. */
const LADEN_CODE_PREFIX = 'LA'

const MAX_PHONE_LENGTH = 40
const MAX_VARIANT_LENGTH = 64
const VARIANT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/** P4: Name und Telefon verschwinden 90 Tage nach dem Abholtag. */
const ANONYMIZE_AFTER_DAYS = 90
const ANONYMIZED_NAME = 'anonymisiert'

const LEGACY_STATUS_FROM = {
  open: 'offen',
  handed_over: 'abgeholt',
  not_collected: 'bereit',
  cancelled: 'storniert',
}

function nowIso(now) {
  if (now === undefined || now === null) return new Date().toISOString()
  const d = now instanceof Date ? now : new Date(now)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

/**
 * Erlaubte Statuswechsel im neuen Modell - dieselben zwei Sperren wie
 * `checkStatusTransition()`, mit Codes statt Mock-Texten.
 */
function checkTransition(from, to) {
  if (!from || from === to) return null
  if (from === 'abgeholt' && to === 'storniert') {
    return fail(
      'already_picked_up',
      'Diese Vorbestellung wurde bereits abgeholt und kann nicht storniert werden — bitte zuerst auf „Offen" zurücksetzen.',
      409
    )
  }
  if (from === 'storniert' && (to === 'bereit' || to === 'abgeholt')) {
    return fail(
      'cancelled',
      'Diese Vorbestellung wurde storniert — bitte zuerst auf „Offen" zurücksetzen.',
      409
    )
  }
  return null
}

/**
 * Setzt Status, Abholzeitpunkt und "nicht abgeholt" konsistent.
 *
 * @param {object} base bisheriger Stand (`status`, `pickedUpAt`, `notCollectedAt`)
 * @param {string} status Zielstatus (schon geprueft)
 * @param {boolean|undefined} notCollected `true` markiert "nicht abgeholt"
 *   (nur mit `bereit`), `false` nimmt es zurueck, `undefined` laesst es,
 *   solange der Status `bereit` bleibt.
 */
function statusFields(base, status, notCollected, now) {
  const at = nowIso(now)
  const pickedUpAt =
    status === 'abgeholt'
      ? base.status === 'abgeholt' && base.pickedUpAt
        ? base.pickedUpAt
        : at
      : null
  let notCollectedAt = null
  if (status === 'bereit') {
    if (notCollected === true) notCollectedAt = base.notCollectedAt || at
    else if (notCollected === undefined && base.status === 'bereit') {
      notCollectedAt = base.notCollectedAt || null
    }
  }
  return { status, pickedUpAt, notCollectedAt }
}

/**
 * Prueft einen Statuswechsel (`POST /api/preorders/:id/status`).
 *
 * @param {object} existing bisherige Vorbestellung
 * @param {object} body `{ status, notCollected?, paid? }`
 * @param {object} [options] `{ allowedTargets?: string[], now? }` - der Fahrer
 *   darf nur `abgeholt` und "nicht abgeholt" setzen; `notCollectedFrom`
 *   (heute, JJJJ-MM-TT) verbietet "nicht abgeholt" vor dem Abholtag (409).
 * @returns {{ changes: object } | { error, message, status }}
 */
function normalizeStatusChange(existing, body, options) {
  const base = existing || {}
  const source = body || {}
  const opts = options || {}
  if (base.anonymizedAt) return anonymizedError()

  let status = source.status === undefined ? base.status : source.status
  if (!STATUS.includes(status)) {
    return fail(
      'invalid_status',
      'Status muss „offen", „bereit", „abgeholt" oder „storniert" sein.'
    )
  }
  let notCollected
  if (source.notCollected !== undefined) {
    if (typeof source.notCollected !== 'boolean') {
      return fail('invalid_not_collected', '„Nicht abgeholt" ist ungültig.')
    }
    notCollected = source.notCollected
    if (notCollected && source.status === undefined) status = 'bereit'
    if (notCollected && status !== 'bereit') {
      return fail(
        'invalid_not_collected',
        '„Nicht abgeholt" geht nur zusammen mit dem Status „bereit".'
      )
    }
  }
  if (source.paid !== undefined && typeof source.paid !== 'boolean') {
    return fail('invalid_paid', '„Bezahlt" muss ja oder nein sein.')
  }
  // „Nicht abgeholt" erst ab dem Abholtag (W4): vorher kann die Kundschaft
  // noch kommen, und ein vorschnelles Markieren sieht in der Liste aus wie
  // ein Tagesabschluss. Nur wenn der Aufrufer `notCollectedFrom` (heute,
  // JJJJ-MM-TT) mitgibt - der Mock-Alias kennt die Regel nicht (D3).
  if (
    notCollected === true &&
    !base.notCollectedAt &&
    typeof opts.notCollectedFrom === 'string' &&
    typeof base.pickupDate === 'string' &&
    base.pickupDate > opts.notCollectedFrom
  ) {
    return fail(
      'not_collected_too_early',
      `„Nicht abgeholt" geht erst ab dem Abholtag (${formatGermanDate(
        base.pickupDate
      )}) - bis dahin kann noch jemand kommen.`,
      409
    )
  }
  if (Array.isArray(opts.allowedTargets)) {
    const target = notCollected ? 'nicht_abgeholt' : status
    if (status !== base.status || notCollected !== undefined) {
      if (!opts.allowedTargets.includes(target)) {
        return fail(
          'forbidden',
          'Für diesen Statuswechsel fehlt die Berechtigung.',
          403
        )
      }
    }
  }
  // Der Fahrer (allowedTargets gesetzt) darf eine Zahlung erfassen, aber nie
  // zurücknehmen - sonst ließe sich kassiertes Geld wieder auf „unbezahlt“
  // setzen (W4-Verifikation Runde 2). Zurücknehmen kann der Verkauf.
  if (
    Array.isArray(opts.allowedTargets) &&
    source.paid === false &&
    base.paid
  ) {
    return fail(
      'paid_undo_forbidden',
      'Eine erfasste Zahlung zurücknehmen kann nur der Verkauf.',
      403
    )
  }
  const blocked = checkTransition(base.status, status)
  if (blocked) return blocked

  const changes = statusFields(base, status, notCollected, opts.now)
  if (source.paid !== undefined) changes.paid = source.paid
  return { changes }
}

function anonymizedError() {
  return fail(
    'anonymized',
    'Diese Vorbestellung ist anonymisiert und kann nicht mehr geändert werden.',
    409
  )
}

/** `''` (keine Variante) oder ein Slug wie `nuss`; sonst `null` (ungueltig). */
function cleanVariantInput(value) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  if (v === '') return ''
  if (v.length > MAX_VARIANT_LENGTH || !VARIANT_PATTERN.test(v)) return null
  return v
}

/**
 * Prueft die Variante einer neuen Position gegen die Backzettel-Stammdaten.
 *
 * `variantsForProduct(productId)` liefert `null`, wenn es keine Stammdaten
 * gibt oder das Produkt dort nicht vorkommt - dann gilt jeder Slug (es gibt
 * nichts, wogegen man pruefen koennte; der Backzettel warnt selbst). Sonst
 * `{ variants: [...] }`: leer heisst "keine Variante", sonst muss eine davon
 * gewaehlt sein (ausser `requireVariant: false`, Alias der alten Maske).
 */
function checkVariant(name, variant, info, requireVariant) {
  if (!info || !Array.isArray(info.variants)) return null
  const allowed = info.variants
  if (allowed.length === 0) {
    if (variant !== '') {
      return fail(
        'invalid_variant',
        `„${name}“ gibt es nicht in Sorten - bitte ohne Sorte bestellen.`
      )
    }
    return null
  }
  if (variant === '') {
    if (!requireVariant) return null
    return fail(
      'variant_required',
      `Bitte für „${name}“ eine Sorte wählen: ${allowed.join(', ')}.`
    )
  }
  if (!allowed.includes(variant)) {
    return fail(
      'invalid_variant',
      `„${variant}“ ist keine Sorte von „${name}“ (möglich: ${allowed.join(
        ', '
      )}).`
    )
  }
  return null
}

function itemKey(productId, variant) {
  return `${productId}|${variant || ''}`
}

/**
 * Menge einer Position im neuen Modell: ganze Zahl >= 0 (Zahl oder
 * Ziffernfolge), sonst `null` = ungueltig. Anders als `tours.wholeNumber`
 * wird nichts still abgeschnitten - `"abc"` waere sonst eine gestrichene
 * Zeile und `2.7` zwei Stueck (gleiche Regel wie `validateVisitItems` bei
 * den Verkaufspartnern).
 */
function parseQuantity(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 ? value : null
  }
  if (typeof value === 'string' && /^\s*\d+\s*$/.test(value)) {
    return Number(value.trim())
  }
  return null
}

/** Positionen als vergleichbarer Schluessel (Produkt, Variante, Menge). */
function itemsSignature(items) {
  return (Array.isArray(items) ? items : [])
    .map((i) => `${itemKey(i.productId, i.variant)}|${Number(i.quantity)}`)
    .sort()
    .join(';')
}

/**
 * Prueft und normalisiert eine Vorbestellung des allgemeinen Modells.
 *
 * @param {object} body Request-Body: `{ channel, customerName, customerPhone?,
 *   pickupDate, pickupTime?, pickupPointId?, note?, paid?, status?,
 *   notCollected?, items: [{ productId, quantity | qty, variant? }] }`
 * @param {object|null} existing bestehende Vorbestellung (PATCH), sonst null
 * @param {object} options
 * @param {(id: string) => object|null} options.lookupProduct hq-Produkt per
 *   Slug oder numerischer ID (`{ id, name, price }`)
 * @param {(id: string) => object|null} options.findPickupPoint Sammelstelle
 * @param {(productId: string) => ({variants: string[]}|null)} [options.variantsForProduct]
 * @param {boolean} [options.requireVariant=true]
 * @param {boolean} [options.lockCancelled=false] `true` sperrt bei einer
 *   stornierten Bestellung Positionen, Abholtag, -ort und -zeit sowie den
 *   Bestellweg (409 `cancelled`), solange der Request sie nicht im selben
 *   Zug auf „Offen" zuruecksetzt. `/api/preorders` setzt es; der
 *   Moersbach-Alias nicht (Mock-Vertrag).
 * @param {Date|string} [options.now]
 * @returns {{ preorder: object } | { error, message, status }}
 */
function normalizeOrderInput(body, existing, options) {
  const source = body && typeof body === 'object' ? body : {}
  const base = existing || {}
  const opts = options || {}
  const requireVariant = opts.requireVariant !== false
  if (base.anonymizedAt) return anonymizedError()

  const pick = (key) => (source[key] === undefined ? base[key] : source[key])

  // --- Kanal
  const channel = pick('channel')
  if (!CHANNELS.includes(channel)) {
    return fail(
      'invalid_channel',
      'Bitte den Bestellweg wählen: Laden, Telefon, WhatsApp, Shop oder Sammelstelle.'
    )
  }

  // --- Kundschaft
  const rawName = pick('customerName')
  if (
    rawName !== undefined &&
    rawName !== null &&
    typeof rawName !== 'string'
  ) {
    return fail('invalid_customer', 'Der Name des Kunden ist ungültig.')
  }
  const customerName = trimmed(rawName)
  if (!customerName) {
    return fail('customer_required', 'Der Name des Kunden ist erforderlich.')
  }
  if (customerName.length > MAX_TEXT_LENGTH) {
    return fail('customer_too_long', 'Der Name des Kunden ist zu lang.')
  }
  if (NAME_CONTROL_CHARS.test(customerName)) {
    return fail(
      'invalid_customer',
      'Der Name des Kunden enthält unzulässige Steuerzeichen.'
    )
  }
  const rawPhone = pick('customerPhone')
  if (
    rawPhone !== undefined &&
    rawPhone !== null &&
    typeof rawPhone !== 'string'
  ) {
    return fail('invalid_phone', 'Die Telefonnummer ist ungültig.')
  }
  const customerPhone = tours.normalizePhone(rawPhone)
  // Eine eingegebene, aber unbrauchbare Nummer (keine 5 Ziffern) nicht
  // stillschweigend verwerfen - die Kundschaft waere sonst nicht erreichbar,
  // ohne dass es jemand merkt (W4-Verifikation).
  if (
    !customerPhone &&
    typeof rawPhone === 'string' &&
    rawPhone.trim() !== '' &&
    source.customerPhone !== undefined
  ) {
    return fail(
      'invalid_phone',
      'Die Telefonnummer ist ungültig - bitte mindestens 5 Ziffern angeben oder das Feld leeren.'
    )
  }
  if (customerPhone && customerPhone.length > MAX_PHONE_LENGTH) {
    return fail('invalid_phone', 'Die Telefonnummer ist zu lang.')
  }

  // --- Abholung: Laden oder Sammelstelle
  const pickupDate = trimmed(pick('pickupDate'))
  if (!tours.isBusinessDate(pickupDate)) {
    return fail(
      'invalid_date',
      'Das Abholdatum muss im Format JJJJ-MM-TT angegeben werden.'
    )
  }
  const rawPoint =
    source.pickupPointId === undefined
      ? base.pickupPointId
      : source.pickupPointId
  if (
    rawPoint !== undefined &&
    rawPoint !== null &&
    typeof rawPoint !== 'string'
  ) {
    return fail('invalid_pickup_point', 'Diese Sammelstelle existiert nicht.')
  }
  const pickupPointId = trimmed(rawPoint) || null
  let pickupPoint = null
  if (pickupPointId) {
    pickupPoint =
      typeof opts.findPickupPoint === 'function'
        ? opts.findPickupPoint(pickupPointId)
        : null
    if (!pickupPoint) {
      return fail('unknown_pickup_point', 'Diese Sammelstelle existiert nicht.')
    }
    if (pickupPoint.active === false && base.pickupPointId !== pickupPointId) {
      return fail(
        'inactive_pickup_point',
        `Die Sammelstelle „${pickupPoint.name}“ ist nicht aktiv.`
      )
    }
  }
  if (channel === 'sammelstelle' && !pickupPoint) {
    return fail(
      'pickup_point_required',
      'Für eine Sammelstellen-Bestellung bitte die Sammelstelle wählen.'
    )
  }
  let pickupTime = null
  const rawTime = source.pickupTime
  if (pickupPoint) {
    if (
      rawTime !== undefined &&
      rawTime !== null &&
      (typeof rawTime !== 'string' || rawTime.trim() !== '')
    ) {
      return fail(
        'pickup_time_not_allowed',
        'An einer Sammelstelle gilt ihr Übergabefenster - bitte keine Abholzeit angeben.'
      )
    }
    if (tours.isNumber(pickupPoint.weekday)) {
      const weekday = Number(pickupPoint.weekday)
      if (weekdayOf(pickupDate) !== weekday) {
        return fail(
          'invalid_delivery_day',
          `Der ${formatGermanDate(pickupDate)} ist kein ${
            WEEKDAY_LABELS[weekday] || 'Liefertag'
          } — an diesem Tag wird nicht nach ${placeLabel(
            pickupPoint
          )} geliefert.`
        )
      }
    }
  } else {
    const time = rawTime === undefined ? base.pickupTime : rawTime
    if (time !== undefined && time !== null && time !== '') {
      if (typeof time !== 'string' || !TIME_PATTERN.test(time.trim())) {
        return fail(
          'invalid_time',
          'Die Abholzeit muss im Format HH:MM angegeben werden.'
        )
      }
      pickupTime = time.trim()
    }
  }

  // --- Anmerkung, bezahlt
  if (
    source.note !== undefined &&
    source.note !== null &&
    typeof source.note !== 'string'
  ) {
    return fail('invalid_note', 'Die Anmerkung ist ungültig.')
  }
  const note =
    source.note === undefined ? base.note || null : trimmed(source.note) || null
  if (note && note.length > MAX_TEXT_LENGTH) {
    return fail('note_too_long', 'Bitte fassen Sie die Anmerkung kürzer.')
  }
  if (note && source.note !== undefined && NOTE_CONTROL_CHARS.test(note)) {
    return fail(
      'invalid_note',
      'Die Anmerkung enthält unzulässige Steuerzeichen.'
    )
  }
  if (source.paid !== undefined && typeof source.paid !== 'boolean') {
    return fail('invalid_paid', '„Bezahlt" muss ja oder nein sein.')
  }
  const paid = source.paid === undefined ? !!base.paid : source.paid

  // --- Status
  const statusResult = normalizeStatusChange(
    { ...base, status: base.status || 'offen', pickupDate },
    {
      status: source.status === undefined ? undefined : source.status,
      notCollected: source.notCollected,
    },
    // `notCollectedFrom` (heute): „nicht abgeholt“ auch beim Anlegen und
    // Bearbeiten erst ab dem Abholtag - wie bei `POST /:id/status`.
    { now: opts.now, notCollectedFrom: opts.notCollectedFrom }
  )
  if (statusResult.error) return statusResult
  // Neu angelegt: kein Uebergang, aber ein Status ausser `offen` ist erlaubt
  // (z. B. nachgetragene, schon abgeholte Papierbestellung).

  // --- Positionen
  let items
  if (source.items === undefined) {
    items = Array.isArray(base.items) ? base.items : []
  } else {
    if (!Array.isArray(source.items)) {
      return fail('invalid_items', 'Die Artikelliste ist ungültig.')
    }
    if (source.items.length > MAX_ITEMS) {
      return fail(
        'too_many_items',
        `Eine Vorbestellung darf höchstens ${MAX_ITEMS} verschiedene Artikel enthalten.`
      )
    }
    // Snapshots bestehender Positionen bleiben (Preis wie zugesagt) - wie
    // in `normalizePreorderInput`, nur je Produkt *und* Variante.
    const snapshots = new Map()
    for (const item of Array.isArray(base.items) ? base.items : []) {
      if (item && item.productId != null) {
        snapshots.set(itemKey(item.productId, item.variant), item)
      }
    }

    const merged = new Map()
    for (const raw of source.items) {
      if (!raw || typeof raw !== 'object') {
        return fail('invalid_items', 'Eine Position ist unvollständig.')
      }
      const requested =
        typeof raw.productId === 'number'
          ? String(raw.productId)
          : trimmed(raw.productId)
      if (!requested) {
        return fail('invalid_items', 'Eine Position ist unvollständig.')
      }
      const qty = parseQuantity(
        raw.quantity === undefined ? raw.qty : raw.quantity
      )
      if (qty === null) {
        return fail(
          'invalid_quantity',
          `Die Menge von „${
            trimmed(raw.name) || requested
          }“ muss eine ganze Zahl zwischen 0 und ${MAX_QTY_PER_ITEM} sein.`
        )
      }
      if (qty === 0) continue // ausdrueckliche 0 = Zeile gestrichen
      const variant = cleanVariantInput(raw.variant)
      if (variant === null) {
        return fail(
          'invalid_variant',
          'Die Sorte ist ungültig (nur Kleinbuchstaben, Ziffern und Bindestriche).'
        )
      }

      let snapshot = snapshots.get(itemKey(requested, variant))
      let product = null
      if (!snapshot && typeof opts.lookupProduct === 'function') {
        product = opts.lookupProduct(requested)
        if (!product) {
          return fail(
            'unknown_product',
            `„${trimmed(raw.name) || requested}“ steht nicht im Sortiment.`
          )
        }
        snapshot = snapshots.get(itemKey(product.id, variant))
      }

      let entry
      if (snapshot) {
        entry = {
          productId: String(snapshot.productId),
          name: snapshot.name,
          variant,
          unit: snapshot.unit || 'Stück',
          unitPrice: Number(snapshot.unitPrice),
        }
      } else {
        if (!product) {
          return fail(
            'unknown_product',
            `„${trimmed(raw.name) || requested}“ steht nicht im Sortiment.`
          )
        }
        const name = trimmed(product.name) || String(product.id)
        const info =
          typeof opts.variantsForProduct === 'function'
            ? opts.variantsForProduct(String(product.id))
            : null
        const variantError = checkVariant(name, variant, info, requireVariant)
        if (variantError) return variantError
        // `Number(null)` ist 0 - ein fehlender Preis darf nicht 0 € werden.
        const price =
          product.price === null || product.price === undefined
            ? NaN
            : Number(product.price)
        if (!Number.isFinite(price) || price < 0) {
          return fail(
            'invalid_price',
            `Für „${name}“ ist kein Preis hinterlegt.`
          )
        }
        entry = {
          productId: String(product.id),
          name,
          variant,
          unit: trimmed(product.unit) || 'Stück',
          unitPrice: roundCents(price),
        }
      }

      const key = itemKey(entry.productId, entry.variant)
      const previous = merged.get(key)
      const quantity = (previous ? previous.quantity : 0) + qty
      if (quantity > MAX_QTY_PER_ITEM) {
        return fail(
          'invalid_quantity',
          `Bitte wählen Sie je Artikel eine Menge zwischen 1 und ${MAX_QTY_PER_ITEM}.`
        )
      }
      merged.set(key, { ...entry, quantity })
    }
    items = [...merged.values()].map((item) => ({
      ...item,
      lineTotal: lineTotal(item.quantity, item.unitPrice),
    }))
  }

  if (items.length === 0) {
    return fail(
      'items_required',
      'Eine Vorbestellung braucht mindestens eine Position.'
    )
  }

  // Nach der Uebergabe ist die Bestellung Geschichte: Positionen, Abholtag
  // und Abholort bleiben, solange sie `abgeholt` ist - sonst aenderten sich
  // Summen und Tageszahlen rueckwirkend. Wie beim Stornieren: erst auf
  // „Offen" zuruecksetzen (im selben Request erlaubt).
  if (
    base.status === 'abgeholt' &&
    statusResult.changes.status === 'abgeholt'
  ) {
    const moved =
      pickupDate !== base.pickupDate ||
      (pickupPoint ? pickupPoint.id : null) !== (base.pickupPointId || null)
    if (moved || itemsSignature(items) !== itemsSignature(base.items)) {
      return fail(
        'already_picked_up',
        'Diese Vorbestellung wurde bereits abgeholt — Positionen, Abholtag und Abholort lassen sich nicht mehr ändern. Bitte zuerst auf „Offen" zurücksetzen.',
        409
      )
    }
  }

  // Storniert: zaehlt fuer niemanden mehr - eine Aenderung an Positionen,
  // Tag oder Ort waere unsichtbar und kaeme beim Zuruecksetzen ueberraschend
  // in die Backstuben-Summen. Erst auf „Offen" zuruecksetzen (im selben
  // Request erlaubt). Name, Telefon, Anmerkung und bezahlt bleiben aenderbar.
  if (
    opts.lockCancelled === true &&
    base.status === 'storniert' &&
    statusResult.changes.status === 'storniert'
  ) {
    const moved =
      channel !== base.channel ||
      pickupDate !== base.pickupDate ||
      (pickupPoint ? pickupPoint.id : null) !== (base.pickupPointId || null) ||
      (pickupTime || null) !== (base.pickupTime || null)
    if (moved || itemsSignature(items) !== itemsSignature(base.items)) {
      return fail(
        'cancelled',
        'Diese Vorbestellung ist storniert — Positionen, Abholtag und Abholort lassen sich nicht mehr ändern. Bitte zuerst auf „Offen" zurücksetzen.',
        409
      )
    }
  }

  // Abholtag plausibel (nur `/api/preorders`, `opts.pickupRules`; der
  // Moersbach-Alias haelt den Mock-Vertrag). Geprueft nur, wenn der Tag neu
  // ist - eine alte Bestellung bleibt bearbeitbar - und erst nach den
  // Sperren oben (abgeholt/storniert antworten 409, nicht 400).
  const rules = opts.pickupRules
  if (
    rules &&
    typeof rules.today === 'string' &&
    tours.isBusinessDate(rules.today) &&
    pickupDate !== base.pickupDate
  ) {
    const offset = daysBetween(rules.today, pickupDate)
    if (tours.isNumber(rules.maxDaysAhead) && offset > rules.maxDaysAhead) {
      return fail(
        'date_out_of_range',
        `Der ${formatGermanDate(
          pickupDate
        )} liegt zu weit in der Zukunft - Vorbestellungen gehen höchstens ${
          rules.maxDaysAhead
        } Tage im Voraus.`
      )
    }
    if (tours.isNumber(rules.maxDaysBack) && -offset > rules.maxDaysBack) {
      return fail(
        'date_out_of_range',
        `Der ${formatGermanDate(
          pickupDate
        )} liegt zu weit zurück - nachtragen lassen sich höchstens ${
          rules.maxDaysBack
        } Tage.`
      )
    }
  }

  // Abholung im Laden nicht an einem Ruhetag (Sammelstellen haben ihren
  // eigenen Liefertag, der oben geprueft wird).
  if (
    rules &&
    !pickupPoint &&
    Array.isArray(rules.closedWeekdays) &&
    pickupDate !== base.pickupDate &&
    rules.closedWeekdays.includes(weekdayOf(pickupDate))
  ) {
    return fail(
      'ruhetag',
      `Am ${WEEKDAY_LABELS[weekdayOf(pickupDate)]}, ${formatGermanDate(
        pickupDate
      )}, ist Ruhetag - bitte einen anderen Abholtag wählen.`
    )
  }

  return {
    preorder: {
      channel,
      customerName,
      customerPhone,
      pickupDate,
      pickupTime,
      pickupPointId: pickupPoint ? pickupPoint.id : null,
      paid,
      note,
      ...statusResult.changes,
      items,
      total: orderTotal(items.map((i) => ({ lineTotal: i.lineTotal }))),
    },
  }
}

/** Code-Kuerzel: Sammelstelle (`MO`) oder Laden (`LA`). */
function codePrefixFor(pickupPointId) {
  return pickupPointId ? referencePrefix(pickupPointId) : LADEN_CODE_PREFIX
}

/** Muss eine Vorbestellung nach einer Aenderung einen neuen Code bekommen? */
function codeNeedsRenewal(code, pickupPointId, pickupDate) {
  return !String(code || '').startsWith(
    `${codePrefixFor(pickupPointId)}-${pickupDate}-`
  )
}

/**
 * Summen je Produkt und Variante (Backzettel, `GET /api/preorders/sums`).
 * Stornierte zaehlen nicht; Mengen bleiben Stueck des Produkts - die
 * Umrechnung auf Backzettel-Posten (Viertel, Faktoren) macht Z2.
 */
function sumByProductVariant(list) {
  const active = (Array.isArray(list) ? list : []).filter(
    (p) => p && p.status !== 'storniert'
  )
  const sums = new Map()
  for (const preorder of active) {
    const seen = new Set()
    for (const item of preorder.items || []) {
      const variant = item.variant || ''
      const key = itemKey(item.productId, variant)
      const entry = sums.get(key) || {
        productId: String(item.productId),
        variant,
        name: item.name,
        unit: item.unit || 'Stück',
        quantity: 0,
        preorders: 0,
      }
      entry.quantity += tours.wholeNumber(item.quantity, 0)
      if (!seen.has(key)) {
        entry.preorders += 1
        seen.add(key)
      }
      sums.set(key, entry)
    }
  }
  return [...sums.values()].sort(
    (a, b) =>
      String(a.name).localeCompare(String(b.name), 'de') ||
      a.variant.localeCompare(b.variant, 'de')
  )
}

/** Summe von Positionen `{ quantity|qty, unitPrice }` (oder `lineTotal`). */
function itemsTotal(items) {
  return orderTotal(
    (Array.isArray(items) ? items : []).map((item) =>
      item && item.lineTotal !== undefined
        ? item
        : {
            qty:
              item && (item.quantity !== undefined ? item.quantity : item.qty),
            unitPrice: item && item.unitPrice,
          }
    )
  )
}

/**
 * Offener Betrag einer bezahlten Bestellung (W4-Verifikation Runde 2):
 * `> 0` noch zu kassieren (nach einer Änderung ist sie teurer geworden),
 * `< 0` zu erstatten (billiger geworden oder storniert). Unbezahlt: 0 - der
 * ganze Betrag steht dann ohnehin in `unpaidTotal`. `paidAmount: null` bei
 * `paid` heisst „voll bezahlt“ (Bestand vor der Spalte).
 */
function paymentBalance(p) {
  if (!p || !p.paid) return 0
  const total = roundCents(p.total)
  const paid =
    p.paidAmount == null || p.paidAmount === ''
      ? total
      : roundCents(p.paidAmount)
  if (p.status === 'storniert') return roundCents(-paid)
  return roundCents(total - paid)
}

/** Kopfzahlen eines Tages (`GET /api/preorders/day`). */
function summarizeDay(list) {
  const all = Array.isArray(list) ? list : []
  const active = all.filter((p) => p && p.status !== 'storniert')
  const byStatus = { offen: 0, bereit: 0, abgeholt: 0, storniert: 0 }
  const byChannel = {}
  for (const p of all) {
    if (byStatus[p.status] !== undefined) byStatus[p.status] += 1
  }
  for (const p of active) {
    byChannel[p.channel] = (byChannel[p.channel] || 0) + 1
  }
  return {
    count: active.length,
    total: roundCents(active.reduce((sum, p) => sum + roundCents(p.total), 0)),
    byStatus,
    notCollected: active.filter((p) => p.notCollectedAt).length,
    paid: active.filter((p) => p.paid).length,
    // Noch zu kassieren: unbezahlte Bestellungen plus der Rest bezahlter, die
    // seit der Zahlung teurer geworden sind (W4-Verifikation Runde 2).
    unpaidTotal: roundCents(
      active
        .filter((p) => !p.paid && p.status !== 'abgeholt')
        .reduce((sum, p) => sum + roundCents(p.total), 0) +
        active
          .filter((p) => p.status !== 'abgeholt')
          .reduce((sum, p) => sum + Math.max(0, paymentBalance(p)), 0)
    ),
    // Davon Nachzahlungen bezahlter Bestellungen
    topUpCount: active.filter(
      (p) => p.status !== 'abgeholt' && paymentBalance(p) > 0
    ).length,
    topUpTotal: roundCents(
      active
        .filter((p) => p.status !== 'abgeholt')
        .reduce((sum, p) => sum + Math.max(0, paymentBalance(p)), 0)
    ),
    // Zu erstatten: bezahlt und storniert oder billiger geworden - auch
    // stornierte zählen hier, sonst stünde vorab Bezahltes in keiner Summe.
    refundCount: all.filter((p) => p && paymentBalance(p) < 0).length,
    refundTotal: roundCents(
      all
        .filter((p) => p)
        .reduce((sum, p) => sum + Math.max(0, -paymentBalance(p)), 0)
    ),
    // „Ohne Zahlung übergeben“: die Ware ist weg, das Geld fehlt. Steht für
    // sich, damit es nicht aus jeder Summe verschwindet (W4-Verifikation).
    // Eine bezahlte, danach teurer gewordene Bestellung, die ohne den Rest
    // übergeben wurde, zählt mit ihrem Rest dazu.
    handedOverUnpaid: active.filter(
      (p) => p.status === 'abgeholt' && (!p.paid || paymentBalance(p) > 0)
    ).length,
    handedOverUnpaidTotal: roundCents(
      active
        .filter((p) => p.status === 'abgeholt')
        .reduce(
          (sum, p) =>
            sum +
            (!p.paid ? roundCents(p.total) : Math.max(0, paymentBalance(p))),
          0
        )
    ),
    byChannel,
  }
}

/**
 * Sortierung der Abholliste: Sammelstellen-/Ladenabholung, dann Uhrzeit
 * (ohne Uhrzeit zuletzt), dann Code.
 */
function comparePickup(a, b) {
  return (
    String(a.pickupDate).localeCompare(String(b.pickupDate)) ||
    String(a.pickupPointId || '').localeCompare(
      String(b.pickupPointId || '')
    ) ||
    String(a.pickupTime || '99:99').localeCompare(
      String(b.pickupTime || '99:99')
    ) ||
    String(a.code).localeCompare(String(b.code))
  )
}

// --- Alias: altes Mock-Format ------------------------------------------------

/** Neuer Status -> Mock-Status (`open`/`handed_over`/`not_collected`/`cancelled`). */
function toLegacyStatus(preorder) {
  const p = preorder || {}
  if (p.status === 'storniert') return 'cancelled'
  if (p.status === 'abgeholt') return 'handed_over'
  if (p.status === 'bereit' && p.notCollectedAt) return 'not_collected'
  return 'open'
}

/**
 * Mock-Status aus dem Body -> `{ status, notCollected }` des neuen Modells.
 * `open` laesst eine `bereit` gemeldete Bestellung auf `bereit` - sonst setzte
 * jedes Speichern der alten Maske (sie schickt den Status immer mit) eine
 * gepackte Bestellung zurueck auf `offen`.
 */
function fromLegacyStatus(legacy, current) {
  const cur = current || {}
  if (legacy === 'open') {
    if (cur.status === 'bereit')
      return { status: 'bereit', notCollected: false }
    return { status: 'offen', notCollected: undefined }
  }
  if (legacy === 'not_collected')
    return { status: 'bereit', notCollected: true }
  return { status: LEGACY_STATUS_FROM[legacy], notCollected: undefined }
}

/**
 * Body der alten Moersbach-Maske -> Body des neuen Modells. Felder, die der
 * Body nicht nennt, bleiben `undefined` (PATCH laesst sie stehen).
 */
function fromLegacyInput(body, current) {
  const source = body && typeof body === 'object' ? body : {}
  const out = {}
  if (!current) out.channel = 'sammelstelle'
  if (source.customer !== undefined) out.customerName = source.customer
  if (source.phone !== undefined) out.customerPhone = source.phone
  if (source.date !== undefined) out.pickupDate = source.date
  if (source.note !== undefined) out.note = source.note
  if (source.pickupPointId !== undefined) {
    out.pickupPointId = source.pickupPointId
  }
  if (source.items !== undefined) {
    out.items = Array.isArray(source.items)
      ? source.items.map((raw) =>
          raw && typeof raw === 'object'
            ? {
                productId: raw.productId,
                quantity: raw.qty,
                variant: raw.variant,
                name: raw.name,
              }
            : raw
        )
      : source.items
  }
  if (source.status !== undefined) {
    const mapped = fromLegacyStatus(String(source.status), current)
    out.status = mapped.status
    if (mapped.notCollected !== undefined)
      out.notCollected = mapped.notCollected
    // Mörsbach kassiert bei der Übergabe, und die alte Maske hat keinen
    // Bezahlt-Schalter: übergeben heißt bezahlt - dieselbe Regel wie der
    // Import (`legacyPreorderToRecord`).
    if (
      out.status === 'abgeholt' &&
      (!current || current.status !== 'abgeholt')
    ) {
      out.paid = true
    }
  }
  return out
}

/**
 * Die alte Moersbach-Maske kennt keine Sorten: sie fuehrt eine Zeile je
 * Produkt und schickt `{ productId, qty }` ohne `variant`. Hat die Bestellung
 * schon Positionen mit Sorte (aus der neuen Maske), wuerde ein Speichern dort
 * die Sorten verlieren oder Zeilen zusammenlegen. Der Alias lehnt das ab.
 */
function legacyItemsLoseVariants(currentItems, incomingItems) {
  if (!Array.isArray(incomingItems)) return false
  const withVariant = new Set(
    (Array.isArray(currentItems) ? currentItems : [])
      .filter((item) => item && item.variant)
      .map((item) => String(item.productId))
  )
  if (withVariant.size === 0) return false
  return incomingItems.some(
    (raw) =>
      raw &&
      typeof raw === 'object' &&
      raw.variant === undefined &&
      withVariant.has(String(raw.productId))
  )
}

function isoOrNull(value) {
  if (value === null || value === undefined) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Vorbestellung des neuen Modells -> Mock-Form (`decoratePreorder`), fuer
 * den Alias. Eine Variante steht im Namen (`Zopf gefüllt (nuss)`) und als
 * Zusatzfeld `variant`; `code`, `channel` und `paid` kommen als Zusatzfelder
 * mit - die alte Oberflaeche liest sie nicht.
 */
function toLegacyPreorder(preorder, pickupPoint, now) {
  const p = preorder || {}
  const legacy = {
    id: p.id,
    reference: p.code,
    pickupPointId: p.pickupPointId,
    date: p.pickupDate,
    customer: p.customerName || '',
    phone: p.customerPhone || null,
    items: (p.items || []).map((item) => {
      const out = {
        productId: item.productId,
        name: item.variant ? `${item.name} (${item.variant})` : item.name,
        qty: item.quantity,
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        lineTotal: lineTotal(item.quantity, item.unitPrice),
      }
      if (item.variant) out.variant = item.variant
      return out
    }),
    total: roundCents(p.total),
    note: p.note || null,
    status: toLegacyStatus(p),
    handedOverAt: isoOrNull(p.pickedUpAt),
    createdAt: isoOrNull(p.createdAt),
    updatedAt: isoOrNull(p.updatedAt),
    code: p.code,
    channel: p.channel,
    paid: !!p.paid,
  }
  return decoratePreorder(legacy, pickupPoint, now)
}

// --- Import aus dem Mock-Store -------------------------------------------------

/**
 * Eine Vorbestellung aus `delivery-store.json` -> Datensatz des neuen Modells,
 * oder `{ skip: Grund }`. Kanal `sammelstelle`; uebergeben heisst bezahlt
 * (in Moersbach wird bei der Uebergabe kassiert). Preise und Namen bleiben,
 * wie sie im Store stehen (Snapshots).
 */
function legacyPreorderToRecord(legacy) {
  const p = legacy || {}
  const code = trimmed(p.reference)
  if (!code || code.length > 32) return { skip: 'ohne gültige Referenz' }
  if (!tours.isBusinessDate(p.date)) return { skip: 'ohne gültiges Datum' }
  if (!trimmed(p.pickupPointId)) return { skip: 'ohne Sammelstelle' }
  const status = LEGACY_STATUS_FROM[p.status]
  if (!status) return { skip: `unbekannter Status „${p.status}“` }
  const items = []
  for (const raw of Array.isArray(p.items) ? p.items : []) {
    const quantity = tours.wholeNumber(raw && raw.qty, 0)
    const price = Number(raw && raw.unitPrice)
    if (!raw || !trimmed(String(raw.productId == null ? '' : raw.productId)))
      continue
    if (quantity <= 0 || !Number.isFinite(price) || price < 0) continue
    items.push({
      productId: String(raw.productId),
      name: trimmed(raw.name) || String(raw.productId),
      variant: '',
      unit: trimmed(raw.unit) || 'Stück',
      unitPrice: roundCents(price),
      quantity: Math.min(quantity, MAX_QTY_PER_ITEM),
    })
  }
  if (items.length === 0) return { skip: 'ohne Positionen' }
  const updatedAt = isoOrNull(p.updatedAt)
  return {
    record: {
      code,
      channel: 'sammelstelle',
      customerName: trimmed(p.customer) || ANONYMIZED_NAME,
      customerPhone: tours.normalizePhone(p.phone),
      pickupDate: p.date,
      pickupTime: null,
      pickupPointId: trimmed(p.pickupPointId),
      status,
      paid: status === 'abgeholt',
      note: trimmed(p.note) || null,
      pickedUpAt: status === 'abgeholt' ? isoOrNull(p.handedOverAt) : null,
      notCollectedAt:
        p.status === 'not_collected' ? updatedAt || nowIso() : null,
      createdAt: isoOrNull(p.createdAt) || updatedAt || nowIso(),
      updatedAt: updatedAt || isoOrNull(p.createdAt) || nowIso(),
      items,
    },
  }
}

// --- P4: Anonymisierung (DSGVO) -----------------------------------------------

/** Erster Abholtag, der noch *nicht* anonymisiert wird: heute − 90 Tage. */
function anonymizeCutoff(todayIso, days) {
  const span = days === undefined ? ANONYMIZE_AFTER_DAYS : days
  if (!tours.isBusinessDate(todayIso)) return null
  if (!Number.isInteger(span) || span < 1) return null
  const [y, m, d] = todayIso.split('-').map(Number)
  const at = new Date(Date.UTC(y, m - 1, d))
  at.setUTCDate(at.getUTCDate() - span)
  return at.toISOString().slice(0, 10)
}

/**
 * Faellig: noch nicht anonymisiert und Abholtag vor dem Stichtag - **egal in
 * welchem Status**. 90 Tage nach dem Abholtag ist der Status nicht mehr
 * entscheidend; eine Uebergabe, die niemand abgehakt hat (an der Ladentheke
 * in der Spitzenwoche wahrscheinlich), darf Name und Telefon nicht unbegrenzt
 * aufbewahren (roadmap P4).
 */
function isDueForAnonymization(preorder, cutoff) {
  const p = preorder || {}
  if (!cutoff || p.anonymizedAt) return false
  return String(p.pickupDate) < cutoff
}

/**
 * War die Vorbestellung beim Anonymisieren noch nicht abgeschlossen (`offen`
 * oder `bereit` ohne "nicht abgeholt")? Nur fuer den Bericht - ein Hinweis,
 * dass dort nie abgehakt wurde.
 */
function wasUnfinished(preorder) {
  const p = preorder || {}
  return p.status === 'offen' || (p.status === 'bereit' && !p.notCollectedAt)
}

module.exports = {
  PREORDER_STATUS,
  PREORDER_STATUS_LABELS,
  WEEKDAY_LABELS,
  MAX_ITEMS,
  MAX_QTY_PER_ITEM,
  PICKUP_POINT_LIMITS,
  roundCents,
  lineTotal,
  orderTotal,
  formatGermanDate,
  weekdayOf,
  placeLabel,
  referencePrefix,
  nextReference,
  nextCode,
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
  // B7
  CHANNELS,
  CHANNEL_LABELS,
  STATUS,
  STATUS_LABELS,
  LADEN_PICKUP,
  LADEN_CODE_PREFIX,
  ANONYMIZE_AFTER_DAYS,
  ANONYMIZED_NAME,
  checkTransition,
  normalizeStatusChange,
  normalizeOrderInput,
  cleanVariantInput,
  parseQuantity,
  checkVariant,
  codePrefixFor,
  codeNeedsRenewal,
  sumByProductVariant,
  summarizeDay,
  itemsTotal,
  paymentBalance,
  comparePickup,
  toLegacyStatus,
  fromLegacyStatus,
  fromLegacyInput,
  legacyItemsLoseVariants,
  toLegacyPreorder,
  legacyPreorderToRecord,
  anonymizeCutoff,
  isDueForAnonymization,
  wasUnfinished,
}
