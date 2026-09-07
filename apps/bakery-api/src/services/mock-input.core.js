/**
 * Feldauswahl und Prüfung für die mutierenden Mock-Routen des `simple-server.js`
 * (Bestellungen, Personal, Kasse, Inventar, Produktion, Benachrichtigungen)
 * sowie die JSON-Fehlerantworten des Servers.
 *
 * Dependency-freies CommonJS, gleiche Konvention wie `shop-orders.core.js`:
 * der Mock-Server und die Tests (`tests/unit/simpleServerHardening.test.js`)
 * benutzen dieselbe Implementierung.
 *
 * Warum es diese Datei gibt: die Routen haben den Body vorher mit `...req.body`
 * übernommen. `PUT /api/orders/:id` mit `{ "createdAt": 1999 }` zeigte im Admin
 * „1999" als Datum, `status: "foo"` wurde gespeichert, ein mitgeschickter
 * `total` geglaubt, und jedes fremde Feld landete im Speicher. Jetzt gilt:
 *
 *   - Jede Route übernimmt genau die Felder aus ihrer Liste, nichts sonst.
 *     Was die Management-App tatsächlich schickt, steht je Validator im
 *     Kommentar - diese Felder dürfen nicht abgelehnt werden.
 *   - Status-Werte sind je Route eine Whitelist.
 *   - Zahlen müssen endlich sein; `Number(null)` ist `0` und zählt nicht.
 *   - Ein Fehler kommt als `{ ok: false, error, field, message }` zurück, mit
 *     deutschem `message` - `ApiClient` wirft `new Error(data.message)`.
 *
 * Kalenderdatum und „heute" kommen aus `shop-orders.core.js`, damit die Regel
 * nur einmal im Code steht.
 */

'use strict'

const { berlinToday, isCalendarDate } = require('./shop-orders.core')

const MAX_TEXT_LENGTH = 200
const MAX_NOTES_LENGTH = 500
const MAX_MESSAGE_LENGTH = 1000
const MAX_AMOUNT = 1000000
const MAX_QUANTITY = 100000
const MAX_STOCK = 1000000
/** Obergrenze für JSON-Bodies. Der größte legitime Body ist ein Produkttext. */
const JSON_BODY_LIMIT = '200kb'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const USERNAME_PATTERN = /^[a-z0-9._-]{2,50}$/i
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

/**
 * Status-Werte, die die Bestellliste im Admin kennt (`admin/orders/page.tsx`,
 * `STATUS_OPTIONS`) plus die des `OrderStatus`-Enums in `@bakery/shared/types`.
 */
const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'in_progress',
  'ready',
  'completed',
  'delivered',
  'cancelled',
]
/** `admin/production/page.tsx`, `ProductionStatus`. */
const PRODUCTION_STATUSES = ['planned', 'in-progress', 'completed']
/** `StaffMember.role` in `@bakery/shared/data-access` plus `UserRole.Manager`. */
const STAFF_ROLES = ['admin', 'manager', 'staff', 'user']
const CASH_TYPES = ['income', 'expense']
/** `NotificationType`, `NotificationCategory`, `NotificationPriority`. */
const NOTIFICATION_TYPES = ['success', 'error', 'warning', 'info']
const NOTIFICATION_CATEGORIES = [
  'order',
  'inventory',
  'staff',
  'system',
  'customer',
  'general',
]
const NOTIFICATION_PRIORITIES = ['low', 'medium', 'high', 'urgent']

// --- Grundbausteine -----------------------------------------------------------

function reject(field, message, error) {
  return { ok: false, error: error || 'invalid_input', field, message }
}

function accept(value) {
  return { ok: true, value }
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

/** Body muss ein JSON-Objekt sein - `[]`, `null` und `"text"` sind keines. */
function requireObject(body) {
  if (!isPlainObject(body)) {
    return reject(
      null,
      'Der Request-Body muss ein JSON-Objekt sein.',
      'invalid_body'
    )
  }
  return null
}

function hasField(body, field) {
  return (
    Object.prototype.hasOwnProperty.call(body, field) &&
    body[field] !== undefined
  )
}

/**
 * Text: getrimmt, optional Pflicht, Längenobergrenze. `null` gilt bei
 * optionalen Feldern als „leer".
 */
function readText(
  body,
  field,
  { required = false, max = MAX_TEXT_LENGTH, label }
) {
  const raw = body[field]
  if (raw === undefined || raw === null) {
    if (required) return reject(field, `${label} fehlt.`)
    return accept(undefined)
  }
  if (typeof raw !== 'string') {
    return reject(field, `${label} muss ein Text sein.`)
  }
  const text = raw.trim()
  if (required && !text) return reject(field, `${label} fehlt.`)
  if (text.length > max) {
    return reject(field, `${label} darf höchstens ${max} Zeichen lang sein.`)
  }
  return accept(text)
}

/** Zahl: endlich, optional ganzzahlig, innerhalb `[min, max]`. */
function readNumber(
  body,
  field,
  { required = false, integer = false, min, max, label }
) {
  const raw = body[field]
  if (raw === undefined || raw === null) {
    if (required) return reject(field, `${label} fehlt.`)
    return accept(undefined)
  }
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return reject(field, `${label} muss eine Zahl sein.`)
  }
  if (integer && !Number.isInteger(raw)) {
    return reject(field, `${label} muss eine ganze Zahl sein.`)
  }
  if (min !== undefined && raw < min) {
    return reject(field, `${label} darf nicht kleiner als ${min} sein.`)
  }
  if (max !== undefined && raw > max) {
    return reject(field, `${label} darf nicht größer als ${max} sein.`)
  }
  return accept(raw)
}

function readBoolean(body, field, { label }) {
  const raw = body[field]
  if (raw === undefined || raw === null) return accept(undefined)
  if (typeof raw !== 'boolean') {
    return reject(field, `${label} muss true oder false sein.`)
  }
  return accept(raw)
}

/** Whitelist-Wert; `allowed.join` landet in der Meldung, damit man den Tippfehler sieht. */
function readChoice(body, field, allowed, { required = false, label }) {
  const raw = body[field]
  if (raw === undefined || raw === null) {
    if (required) return reject(field, `${label} fehlt.`)
    return accept(undefined)
  }
  if (typeof raw !== 'string' || !allowed.includes(raw)) {
    return reject(
      field,
      `${label} ist ungültig. Erlaubt: ${allowed.join(', ')}.`,
      field === 'status' ? 'invalid_status' : 'invalid_choice'
    )
  }
  return accept(raw)
}

function readDate(body, field, { required = false, label }) {
  const raw = body[field]
  if (raw === undefined || raw === null) {
    if (required) return reject(field, `${label} fehlt.`)
    return accept(undefined)
  }
  if (!isCalendarDate(raw)) {
    return reject(field, `${label} muss ein gültiges Datum (JJJJ-MM-TT) sein.`)
  }
  return accept(raw)
}

/**
 * Führt die Feldleser der Reihe nach aus. Der erste Fehler gewinnt; sonst
 * kommt ein Objekt mit genau den gelesenen, gesetzten Feldern zurück.
 */
function collect(body, readers) {
  const bodyError = requireObject(body)
  if (bodyError) return bodyError
  const value = {}
  for (const [field, read] of Object.entries(readers)) {
    const result = read(body, field)
    if (!result.ok) return result
    if (result.value !== undefined) value[field] = result.value
  }
  return accept(value)
}

/** Ein Update ohne ein einziges bekanntes Feld ist ein Fehler, kein No-op. */
function requireAnyField(result, fields) {
  if (!result.ok) return result
  if (!fields.some((field) => hasField(result.value, field))) {
    return reject(
      null,
      `Keine änderbaren Felder angegeben. Erlaubt: ${fields.join(', ')}.`,
      'no_fields'
    )
  }
  return result
}

// --- Bestellungen ---------------------------------------------------------------

/**
 * `PUT /api/orders/:id`. Der Admin schickt `{ status }` (`admin/orders/page.tsx`).
 * Artikel, Summe, Kundendaten und Zeitstempel sind nicht änderbar - die Summe
 * rechnet der Server, siehe `shop-orders.core.js`.
 */
function validateOrderUpdate(body) {
  return requireAnyField(
    collect(body, {
      status: (b, f) =>
        readChoice(b, f, ORDER_STATUSES, { label: 'Der Status' }),
      notes: (b, f) =>
        readText(b, f, { max: MAX_NOTES_LENGTH, label: 'Die Anmerkung' }),
    }),
    ['status', 'notes']
  )
}

// --- Personal --------------------------------------------------------------------

function readEmail(body, field, { required }) {
  const result = readText(body, field, {
    required,
    max: 254,
    label: 'Die E-Mail-Adresse',
  })
  if (!result.ok || result.value === undefined) return result
  if (!EMAIL_PATTERN.test(result.value)) {
    return reject(field, 'Die E-Mail-Adresse ist ungültig.')
  }
  return accept(result.value.toLowerCase())
}

function readUsername(body, field, { required }) {
  const result = readText(body, field, {
    required,
    max: 50,
    label: 'Der Benutzername',
  })
  if (!result.ok || result.value === undefined) return result
  if (!USERNAME_PATTERN.test(result.value)) {
    return reject(
      field,
      'Der Benutzername darf nur Buchstaben, Ziffern, Punkt, Bindestrich und Unterstrich enthalten (2-50 Zeichen).'
    )
  }
  return accept(result.value.toLowerCase())
}

function staffReaders(required) {
  return {
    username: (b, f) => readUsername(b, f, { required }),
    email: (b, f) => readEmail(b, f, { required }),
    firstName: (b, f) =>
      readText(b, f, { required, max: 100, label: 'Der Vorname' }),
    lastName: (b, f) =>
      readText(b, f, { required, max: 100, label: 'Der Nachname' }),
    role: (b, f) => readChoice(b, f, STAFF_ROLES, { label: 'Die Rolle' }),
  }
}

/**
 * `POST /api/staff`: `username`, `email`, `firstName`, `lastName` Pflicht,
 * `role` optional (Standard `staff`). `isActive`, `lastLogin` und Zeitstempel
 * setzt der Server.
 */
function validateStaffCreate(body) {
  const result = collect(body, staffReaders(true))
  if (!result.ok) return result
  if (!result.value.role) result.value.role = 'staff'
  return result
}

/** `PUT /api/staff/:id`: dieselben Felder optional, dazu `isActive`. */
function validateStaffUpdate(body) {
  const fields = [...Object.keys(staffReaders(false)), 'isActive']
  return requireAnyField(
    collect(body, {
      ...staffReaders(false),
      isActive: (b, f) => readBoolean(b, f, { label: 'Aktiv' }),
    }),
    fields
  )
}

// --- Kasse -----------------------------------------------------------------------

/**
 * `POST /api/cash`: `type` und `amount` Pflicht, `description`, `category`
 * optional, `date` optional (Standard: heute in Berlin). Der Betrag ist
 * immer positiv - die Richtung steckt im `type`.
 */
function validateCashEntry(body, options) {
  const result = collect(body, {
    type: (b, f) =>
      readChoice(b, f, CASH_TYPES, {
        required: true,
        label: 'Die Buchungsart',
      }),
    amount: (b, f) =>
      readNumber(b, f, {
        required: true,
        min: 0.01,
        max: MAX_AMOUNT,
        label: 'Der Betrag',
      }),
    description: (b, f) => readText(b, f, { label: 'Die Beschreibung' }),
    category: (b, f) => readText(b, f, { max: 50, label: 'Die Kategorie' }),
    date: (b, f) => readDate(b, f, { label: 'Das Datum' }),
  })
  if (!result.ok) return result
  const value = result.value
  value.amount = Math.round(value.amount * 100) / 100
  if (!value.description) value.description = ''
  if (!value.category) value.category = 'other'
  if (!value.date) value.date = berlinToday(options && options.now)
  return result
}

// --- Inventar --------------------------------------------------------------------

/**
 * `POST /api/inventory/:id/adjust`. Der Admin schickt
 * `{ adjustment: delta, reason }` (`admin/inventory/page.tsx`); `reason` darf
 * leer sein. Das Ergebnis darf den Bestand nicht unter null bringen.
 *
 * @param {unknown} body
 * @param {{ stock: number }} item der vorhandene Artikel.
 */
function validateInventoryAdjustment(body, item) {
  const result = collect(body, {
    adjustment: (b, f) =>
      readNumber(b, f, {
        required: true,
        min: -MAX_STOCK,
        max: MAX_STOCK,
        label: 'Die Änderung',
      }),
    reason: (b, f) => readText(b, f, { label: 'Der Grund' }),
  })
  if (!result.ok) return result
  if (result.value.adjustment === 0) {
    return reject('adjustment', 'Die Änderung darf nicht 0 sein.')
  }
  const stock = Number(item && item.stock) || 0
  if (stock + result.value.adjustment < 0) {
    return reject(
      'adjustment',
      `Der Bestand kann nicht negativ werden (aktuell ${stock}).`
    )
  }
  if (!result.value.reason) result.value.reason = ''
  return result
}

function inventoryReaders(required) {
  return {
    name: (b, f) => readText(b, f, { required, max: 100, label: 'Der Name' }),
    category: (b, f) => readText(b, f, { max: 50, label: 'Die Kategorie' }),
    unit: (b, f) => readText(b, f, { max: 20, label: 'Die Einheit' }),
    stock: (b, f) =>
      readNumber(b, f, { min: 0, max: MAX_STOCK, label: 'Der Bestand' }),
    minStock: (b, f) =>
      readNumber(b, f, { min: 0, max: MAX_STOCK, label: 'Der Mindestbestand' }),
    supplier: (b, f) => readText(b, f, { max: 100, label: 'Der Lieferant' }),
  }
}

/**
 * `POST /api/inventory`: der Admin schickt `name`, `category`, `unit`, `stock`,
 * `minStock`, `supplier`. Nur `name` ist Pflicht.
 */
function validateInventoryCreate(body) {
  const result = collect(body, inventoryReaders(true))
  if (!result.ok) return result
  const value = result.value
  if (!value.category) value.category = 'Sonstiges'
  if (!value.unit) value.unit = 'kg'
  if (value.stock === undefined) value.stock = 0
  if (value.minStock === undefined) value.minStock = 0
  if (!value.supplier) value.supplier = ''
  return result
}

function validateInventoryUpdate(body) {
  const readers = inventoryReaders(false)
  return requireAnyField(collect(body, readers), Object.keys(readers))
}

// --- Produktion ------------------------------------------------------------------

function productionReaders(required) {
  return {
    product: (b, f) =>
      readText(b, f, { required, max: 100, label: 'Das Produkt' }),
    quantity: (b, f) =>
      readNumber(b, f, {
        required,
        integer: true,
        min: 1,
        max: MAX_QUANTITY,
        label: 'Die Menge',
      }),
    date: (b, f) => readDate(b, f, { required, label: 'Das Datum' }),
    status: (b, f) =>
      readChoice(b, f, PRODUCTION_STATUSES, { label: 'Der Status' }),
  }
}

/**
 * `POST /api/production`: der Admin schickt `product`, `quantity`, `date`,
 * `status: 'planned'` (`admin/production/page.tsx`). `status` ist optional.
 */
function validateProductionCreate(body) {
  const result = collect(body, productionReaders(true))
  if (!result.ok) return result
  if (!result.value.status) result.value.status = 'planned'
  return result
}

/** `PUT /api/production/:id`: der Admin schickt `{ status }`. */
function validateProductionUpdate(body) {
  const readers = productionReaders(false)
  return requireAnyField(collect(body, readers), Object.keys(readers))
}

// --- Benachrichtigungen ----------------------------------------------------------

function readIsoDateTime(body, field, { label }) {
  const raw = body[field]
  if (raw === undefined || raw === null) return accept(undefined)
  if (
    typeof raw !== 'string' ||
    !ISO_DATETIME_PATTERN.test(raw) ||
    Number.isNaN(new Date(raw).getTime())
  ) {
    return reject(field, `${label} muss ein ISO-Zeitstempel sein.`)
  }
  return accept(raw)
}

function readMetadata(body, field, { label }) {
  const raw = body[field]
  if (raw === undefined || raw === null) return accept(undefined)
  if (!isPlainObject(raw))
    return reject(field, `${label} muss ein Objekt sein.`)
  if (JSON.stringify(raw).length > MAX_MESSAGE_LENGTH * 4) {
    return reject(field, `${label} ist zu groß.`)
  }
  return accept(raw)
}

/**
 * `POST /api/notifications`. `feature-notifications` schickt eine
 * `Notification` ohne `id`, `createdAt`, `read`, `archived`: `title` und
 * `message` Pflicht, `type`/`category`/`priority` mit Standardwerten, dazu
 * optional `userId`, `relatedId`, `relatedType`, `expiresAt`, `metadata`.
 * `read`, `channel` und `createdAt` setzt der Server.
 */
function validateNotification(body) {
  const result = collect(body, {
    title: (b, f) =>
      readText(b, f, { required: true, max: 120, label: 'Der Titel' }),
    message: (b, f) =>
      readText(b, f, {
        required: true,
        max: MAX_MESSAGE_LENGTH,
        label: 'Die Nachricht',
      }),
    type: (b, f) => readChoice(b, f, NOTIFICATION_TYPES, { label: 'Der Typ' }),
    category: (b, f) =>
      readChoice(b, f, NOTIFICATION_CATEGORIES, { label: 'Die Kategorie' }),
    priority: (b, f) =>
      readChoice(b, f, NOTIFICATION_PRIORITIES, { label: 'Die Priorität' }),
    userId: (b, f) => readText(b, f, { max: 100, label: 'Die Benutzer-ID' }),
    relatedId: (b, f) => readText(b, f, { max: 100, label: 'Die Referenz-ID' }),
    relatedType: (b, f) =>
      readText(b, f, { max: 50, label: 'Der Referenztyp' }),
    expiresAt: (b, f) => readIsoDateTime(b, f, { label: 'Das Ablaufdatum' }),
    metadata: (b, f) => readMetadata(b, f, { label: 'Die Metadaten' }),
  })
  if (!result.ok) return result
  const value = result.value
  if (!value.type) value.type = 'info'
  if (!value.category) value.category = 'general'
  if (!value.priority) value.priority = 'medium'
  return result
}

// --- Fehlerantworten des Servers ---------------------------------------------------

/**
 * Übersetzt einen Fehler aus der Express-Kette in `{ status, error, message }`.
 *
 * `body-parser` wirft typisierte Fehler (`err.type`): kaputtes JSON ist
 * `entity.parse.failed` (400), ein zu großer Body `entity.too.large` (413),
 * eine unbekannte Zeichenkodierung `encoding.unsupported` (415). Alles andere
 * ist ein Programmfehler und wird zu 500 - ohne Stacktrace, ohne Pfade, denn
 * `err.message` kann bei fremden Fehlern absolute Pfade enthalten.
 */
function describeError(err) {
  const type = err && err.type
  if (type === 'entity.parse.failed') {
    return {
      status: 400,
      error: 'invalid_json',
      message: 'Der Request-Body ist kein gültiges JSON.',
    }
  }
  if (type === 'entity.too.large') {
    return {
      status: 413,
      error: 'payload_too_large',
      message: `Der Request-Body ist zu groß (höchstens ${JSON_BODY_LIMIT}).`,
    }
  }
  if (type === 'encoding.unsupported' || type === 'charset.unsupported') {
    return {
      status: 415,
      error: 'unsupported_encoding',
      message: 'Die Zeichenkodierung des Request-Bodys wird nicht unterstützt.',
    }
  }
  if (type === 'request.aborted') {
    return {
      status: 400,
      error: 'request_aborted',
      message: 'Die Anfrage wurde abgebrochen, bevor der Body vollständig war.',
    }
  }
  const status =
    Number.isInteger(err && err.status) && err.status >= 400 && err.status < 600
      ? err.status
      : 500
  return {
    status,
    error: status === 500 ? 'internal_error' : 'request_error',
    message:
      status === 500
        ? 'Interner Serverfehler.'
        : 'Die Anfrage konnte nicht verarbeitet werden.',
  }
}

/** Der Pfad wird gekuerzt zurueckgegeben - er ist Client-Eingabe und kann beliebig lang sein. */
function notFound(method, path) {
  const shown = String(path || '/').slice(0, 120)
  return {
    status: 404,
    error: 'not_found',
    message: `Unbekannte Route: ${method} ${shown}`,
  }
}

module.exports = {
  CASH_TYPES,
  JSON_BODY_LIMIT,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES,
  ORDER_STATUSES,
  PRODUCTION_STATUSES,
  STAFF_ROLES,
  describeError,
  notFound,
  validateCashEntry,
  validateInventoryAdjustment,
  validateInventoryCreate,
  validateInventoryUpdate,
  validateNotification,
  validateOrderUpdate,
  validateProductionCreate,
  validateProductionUpdate,
  validateStaffCreate,
  validateStaffUpdate,
}
