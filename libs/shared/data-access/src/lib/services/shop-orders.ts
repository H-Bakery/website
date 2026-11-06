/**
 * @fileoverview Real order submission for the customer shop (apps/bakery-shop).
 * @module @bakery/shared/data-access/shop-orders
 *
 * The shop places genuine orders against `POST /api/orders`. There is no
 * WhatsApp/phone fallback in the shop — that path belongs to the landing page.
 */

import { resolveShopApiBaseUrl } from './shop-products'

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/** One line of an order as sent to the API. */
export interface ShopOrderItem {
  /** Slug id (`'kornbrot-500g'`) when known, else the numeric id as a string. */
  productId: string
  name: string
  quantity: number
  /** Gross unit price in EUR (German retail prices are inkl. MwSt.). */
  price: number
}

/** The payload the checkout form submits. */
export interface ShopOrderInput {
  customerName: string
  phone: string
  email?: string
  /** ISO date, `YYYY-MM-DD`. */
  pickupDate: string
  /** `HH:mm`. */
  pickupTime: string
  notes?: string
  items: ShopOrderItem[]
  /** Gross order total in EUR. */
  total: number
}

/** An order as returned by the API after it has been created. */
export interface ShopOrder extends ShopOrderInput {
  /**
   * Bestellcode, z.B. `'8QMZ-QXS5-HM0W'`. Zufaellig und nicht erratbar, weil
   * `GET /api/orders/:id` offen ist - eine fortlaufende Nummer haette es
   * erlaubt, fremde Bestellungen durch Hochzaehlen der URL zu lesen.
   * Crockford-Base32 ohne I/L/O/U, damit er am Telefon vorlesbar bleibt.
   */
  id: string
  /** Interne fortlaufende Nummer fuer die Baeckerei. Nicht in der URL. */
  orderNumber?: number
  status: string
  createdAt: string
}

/**
 * Structural shape of a cart item — `CartItem` from `@bakery/shared/contexts`
 * satisfies it. Declared structurally so this data-access lib does not depend
 * on the React context lib.
 */
export interface ShopCartLineItem {
  /** Numeric product id (the cart key). */
  id: number
  name: string
  price: number
  quantity: number
  /** Slug id, present when the item was created via `toCartProduct()`. */
  slug?: string
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const SUBMIT_ERROR = 'Bestellung konnte nicht übermittelt werden.'
const LOAD_ORDER_ERROR = 'Bestellung konnte nicht geladen werden.'
/**
 * B12: the shop talks to the real API, whose `/api/orders` sits behind the
 * login until a public order path is decided (owner question). Its 401 text
 * („Bitte melden Sie sich an.“) would tell a customer to log in somewhere
 * they cannot - so 401/403 get this instead.
 */
export const ORDERING_UNAVAILABLE_ERROR =
  'Online-Bestellung ist derzeit nicht möglich. Bitte bestellen Sie telefonisch oder im Laden.'

/**
 * Thrown by `fetchShopOrder` on 401/403: the lookup is closed to the public,
 * so nothing is known about the code - neither that it exists nor that it
 * does not. The confirmation page must not turn that into a success page
 * (Abschluss-Verifikation next: any code got a green tick and „Danke“).
 */
export class OrderLookupClosedError extends Error {
  constructor() {
    super(LOAD_ORDER_ERROR)
    Object.setPrototypeOf(this, OrderLookupClosedError.prototype)
    this.name = 'OrderLookupClosedError'
  }
}

/** 401/403: the order endpoint is not open to the public (yet). */
function isClosedToPublic(response: Response): boolean {
  return response.status === 401 || response.status === 403
}

/**
 * Maps cart items to order lines so the checkout page does not reimplement it.
 * Falls back to the numeric id for legacy cart entries (persisted in
 * localStorage before `slug` existed).
 */
export function buildOrderItems(
  items: ReadonlyArray<ShopCartLineItem>
): ShopOrderItem[] {
  return items.map((item) => {
    const slug = typeof item.slug === 'string' ? item.slug.trim() : ''
    return {
      productId: slug.length > 0 ? slug : String(item.id),
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    }
  })
}

/** Reads `{ data }` when present, otherwise treats the body itself as the payload. */
function unwrapData(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const data = (payload as { data?: unknown }).data
    if (data !== undefined && data !== null) return data
  }
  return payload
}

/** Pulls a human-readable German error out of an error body, if the server sent one. */
function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const body = payload as { message?: unknown; error?: unknown }
  if (typeof body.message === 'string' && body.message.trim().length > 0) {
    return body.message.trim()
  }
  if (typeof body.error === 'string' && body.error.trim().length > 0) {
    return body.error.trim()
  }
  return null
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */
/* Requests                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Submits an order. Returns the created order including its id, which the
 * confirmation page shows as the order number.
 *
 * @throws {Error} carrying the server's message when present, otherwise
 * `'Bestellung konnte nicht übermittelt werden.'`
 */
export async function submitOrder(input: ShopOrderInput): Promise<ShopOrder> {
  let response: Response
  try {
    response = await fetch(`${resolveShopApiBaseUrl()}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(input),
    })
  } catch {
    throw new Error(SUBMIT_ERROR)
  }

  if (isClosedToPublic(response)) throw new Error(ORDERING_UNAVAILABLE_ERROR)

  const payload = await readJson(response)

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload) ?? SUBMIT_ERROR)
  }

  const data = unwrapData(payload)
  if (!data || typeof data !== 'object') {
    throw new Error(SUBMIT_ERROR)
  }

  return data as ShopOrder
}

/**
 * Loads a previously placed order, e.g. when the confirmation page is reloaded.
 * The real API has no public `GET /api/orders/:code` yet (B12, see
 * `ORDERING_UNAVAILABLE_ERROR`); a 401/403 throws `OrderLookupClosedError`
 * (message: the plain load error), never the API's „Bitte melden Sie sich an.“
 *
 * @returns the order, or `null` when it does not exist.
 * @throws {Error} `'Bestellung konnte nicht geladen werden.'` on network/HTTP failure.
 */
export async function fetchShopOrder(id: string): Promise<ShopOrder | null> {
  const orderId = typeof id === 'string' ? id.trim() : ''
  if (!orderId) return null

  let response: Response
  try {
    response = await fetch(
      `${resolveShopApiBaseUrl()}/api/orders/${encodeURIComponent(orderId)}`,
      { headers: { Accept: 'application/json' }, cache: 'no-store' }
    )
  } catch {
    throw new Error(LOAD_ORDER_ERROR)
  }

  if (response.status === 404) return null
  if (isClosedToPublic(response)) throw new OrderLookupClosedError()

  const payload = await readJson(response)

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload) ?? LOAD_ORDER_ERROR)
  }

  const data = unwrapData(payload)
  if (!data || typeof data !== 'object') return null

  return data as ShopOrder
}
