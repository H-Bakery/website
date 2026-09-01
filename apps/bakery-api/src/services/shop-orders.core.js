/**
 * Prüfung und Normalisierung einer Shop-Bestellung (`POST /api/orders`).
 *
 * Dependency-freies CommonJS, gleiche Konvention wie `partner-stats.core.js`:
 * der Mock-Server (`simple-server.js`) und die Tests
 * (`tests/unit/shopOrders.test.js`) benutzen dieselbe Implementierung.
 *
 * Warum es diese Datei gibt: der Mock-Server hat den Request-Body vorher
 * ungeprüft mit `...req.body` übernommen. Ein leerer Body ergab eine Bestellung
 * ohne Namen, Telefonnummer und Artikel; ein mitgeschickter `total` wurde
 * geglaubt, ein mitgeschickter Preis ebenso, und jedes fremde Feld landete im
 * Speicher. Jetzt gilt:
 *
 *   - Es werden genau die bekannten Felder übernommen, nichts sonst.
 *   - Preis und Name eines Artikels kommen aus `hq` (über `lookupProduct`),
 *     nicht aus dem Warenkorb. Ein unbekanntes oder nicht verfügbares Produkt
 *     lehnt die Bestellung ab.
 *   - Die Summe rechnet der Server; ein mitgeschickter `total` wird ignoriert.
 *
 * Die Feldregeln spiegeln die Client-Prüfung in
 * `libs/bakery-shop/feature-cart/src/lib/checkout-validation.ts`. Öffnungszeiten
 * und Ruhetag werden hier bewusst **nicht** geprüft - die Tabelle stünde sonst
 * ein weiteres Mal im Code (siehe `apps/bakery-shop/CLAUDE.md`). Geprüft wird
 * nur, dass das Datum existiert und nicht in der Vergangenheit liegt.
 *
 * Alle Meldungen sind deutsch und landen über `message` beim Kunden:
 * `ApiClient` wie `submitOrder()` zeigen genau diesen Text an.
 */

'use strict'

const MAX_NAME_LENGTH = 100
const MAX_NOTES_LENGTH = 500
const MAX_PHONE_LENGTH = 40
const MAX_EMAIL_LENGTH = 254
const MAX_ITEMS = 50
/** Spiegelt `maxQuantityPerItem` des `CartProvider`. */
const MAX_QUANTITY_PER_ITEM = 99
const MIN_PHONE_DIGITS = 6

const PHONE_ALLOWED_PATTERN = /^[\d\s+/().-]+$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Heutiges Datum in Europa/Berlin als `YYYY-MM-DD`.
 *
 * Der Server läuft auf Cloud Run und Vercel in UTC; `new Date().getDate()`
 * wäre dort ab 22:00 Uhr deutscher Sommerzeit schon der Vortag. Die Bäckerei
 * steht in Homburg, also zählt die Berliner Uhr.
 *
 * @param {Date} [now]
 * @returns {string}
 */
function berlinToday(now) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(now || new Date())
}

/** `2026-02-31` sieht wie ein Datum aus und ist keines. */
function isCalendarDate(iso) {
  if (typeof iso !== 'string' || !ISO_DATE_PATTERN.test(iso)) return false
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/** Rundet auf ganze Cent - `2.5 * 3` ist in Fließkomma nicht exakt `7.5`. */
function roundCents(value) {
  return Math.round(value * 100) / 100
}

function trimmedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function reject(field, message) {
  return { ok: false, field, message }
}

/**
 * Prüft einen Bestell-Body und gibt die bereinigte Bestellung zurück.
 *
 * @param {unknown} body der geparste JSON-Body.
 * @param {object} [options]
 * @param {(productId: string) => (object|null|undefined)} [options.lookupProduct]
 *   Löst eine Produkt-ID (Slug oder numerische ID als String) auf ein
 *   `hq`-Produkt `{ id, name, price, available }` auf. Ohne diese Funktion
 *   werden Name und Preis aus dem Body übernommen - nur für Tests gedacht.
 * @param {string} [options.todayIso] heutiges Datum `YYYY-MM-DD`; Standard ist
 *   {@link berlinToday}.
 * @returns {{ ok: true, order: object } | { ok: false, field: string, message: string }}
 */
function validateShopOrder(body, options) {
  const opts = options || {}
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return reject('body', 'Die Bestellung ist unvollständig.')
  }

  const customerName = trimmedString(body.customerName)
  if (!customerName)
    return reject('customerName', 'Bitte geben Sie Ihren Namen ein.')
  if (customerName.length < 2) {
    return reject(
      'customerName',
      'Bitte geben Sie Ihren vollständigen Namen ein.'
    )
  }
  if (customerName.length > MAX_NAME_LENGTH) {
    return reject(
      'customerName',
      `Der Name darf höchstens ${MAX_NAME_LENGTH} Zeichen lang sein.`
    )
  }

  const phone = trimmedString(body.phone)
  if (!phone) return reject('phone', 'Bitte geben Sie Ihre Telefonnummer ein.')
  if (
    phone.length > MAX_PHONE_LENGTH ||
    !PHONE_ALLOWED_PATTERN.test(phone) ||
    phone.replace(/\D/g, '').length < MIN_PHONE_DIGITS
  ) {
    return reject('phone', 'Bitte geben Sie eine gültige Telefonnummer ein.')
  }

  const email = trimmedString(body.email)
  if (
    body.email !== undefined &&
    body.email !== null &&
    typeof body.email !== 'string'
  ) {
    return reject('email', 'Bitte geben Sie eine gültige E-Mail-Adresse ein.')
  }
  if (
    email &&
    (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email))
  ) {
    return reject('email', 'Bitte geben Sie eine gültige E-Mail-Adresse ein.')
  }

  const pickupDate = trimmedString(body.pickupDate)
  if (!pickupDate)
    return reject('pickupDate', 'Bitte wählen Sie ein Abholdatum.')
  if (!isCalendarDate(pickupDate)) {
    return reject('pickupDate', 'Bitte geben Sie ein gültiges Datum an.')
  }
  const todayIso = opts.todayIso || berlinToday()
  if (pickupDate < todayIso) {
    return reject(
      'pickupDate',
      'Das Abholdatum darf nicht in der Vergangenheit liegen.'
    )
  }

  const pickupTime = trimmedString(body.pickupTime)
  if (!pickupTime)
    return reject('pickupTime', 'Bitte wählen Sie eine Abholzeit.')
  if (!TIME_PATTERN.test(pickupTime)) {
    return reject('pickupTime', 'Bitte geben Sie eine gültige Abholzeit an.')
  }

  if (
    body.notes !== undefined &&
    body.notes !== null &&
    typeof body.notes !== 'string'
  ) {
    return reject('notes', 'Bitte fassen Sie sich etwas kürzer.')
  }
  const notes = trimmedString(body.notes)
  if (notes.length > MAX_NOTES_LENGTH) {
    return reject(
      'notes',
      `Bitte fassen Sie sich etwas kürzer (höchstens ${MAX_NOTES_LENGTH} Zeichen).`
    )
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return reject('items', 'Ihr Warenkorb ist leer.')
  }
  if (body.items.length > MAX_ITEMS) {
    return reject(
      'items',
      `Eine Bestellung darf höchstens ${MAX_ITEMS} verschiedene Artikel enthalten.`
    )
  }

  const items = []
  for (const raw of body.items) {
    if (!raw || typeof raw !== 'object') {
      return reject('items', 'Ein Artikel im Warenkorb ist unvollständig.')
    }
    const productId =
      typeof raw.productId === 'number'
        ? String(raw.productId)
        : trimmedString(raw.productId)
    if (!productId) {
      return reject('items', 'Ein Artikel im Warenkorb ist unvollständig.')
    }

    const quantity = raw.quantity
    if (
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY_PER_ITEM
    ) {
      return reject(
        'items',
        `Bitte wählen Sie je Artikel eine Menge zwischen 1 und ${MAX_QUANTITY_PER_ITEM}.`
      )
    }

    let name = trimmedString(raw.name)
    let price = raw.price

    if (typeof opts.lookupProduct === 'function') {
      const product = opts.lookupProduct(productId)
      const label = name || productId
      if (!product) {
        return reject(
          'items',
          `„${label}“ gibt es bei uns nicht mehr. Bitte entfernen Sie den Artikel aus dem Warenkorb.`
        )
      }
      if (product.available === false) {
        return reject(
          'items',
          `„${
            trimmedString(product.name) || label
          }“ ist zur Zeit nicht verfügbar. Bitte entfernen Sie den Artikel aus dem Warenkorb.`
        )
      }
      // Preis und Name kommen aus hq - der Warenkorb ist nur ein Wunsch.
      name = trimmedString(product.name) || name
      price = product.price
    }

    if (!name) {
      return reject('items', 'Ein Artikel im Warenkorb ist unvollständig.')
    }
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
      return reject(
        'items',
        'Ein Artikel im Warenkorb hat keinen gültigen Preis.'
      )
    }

    items.push({ productId, name, quantity, price: roundCents(price) })
  }

  const total = roundCents(
    items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  )

  const order = { customerName, phone, pickupDate, pickupTime, items, total }
  if (email) order.email = email
  if (notes) order.notes = notes

  return { ok: true, order }
}

module.exports = {
  MAX_ITEMS,
  MAX_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_QUANTITY_PER_ITEM,
  berlinToday,
  isCalendarDate,
  roundCents,
  validateShopOrder,
}
