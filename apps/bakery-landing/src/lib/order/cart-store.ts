import { ORDER_CONFIG } from './order-config'

export const CART_STORAGE_KEY = 'heusser-korb-v1'
export const CART_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000
const VERSION = 1

export interface CartItem {
  id: string
  quantity: number
}

export interface CartState {
  items: CartItem[]
  expiresAt: number
  pickupPlace: string
  name: string
  rememberName: boolean
}

export interface StoredCart {
  raw: string | null
  cart: CartState
  expired: boolean
}

export function emptyCart(): CartState {
  return {
    items: [],
    expiresAt: 0,
    pickupPlace: ORDER_CONFIG.pickupPlace,
    name: '',
    rememberName: ORDER_CONFIG.rememberNameByDefault,
  }
}

function decodeCart(raw: string | null, now: number): StoredCart {
  const empty = { raw, cart: emptyCart(), expired: false }
  if (raw === null) return empty

  let saved
  try {
    saved = JSON.parse(raw)
  } catch {
    return empty
  }
  if (saved?.version !== VERSION) return empty

  const rememberName =
    typeof saved.rememberName === 'boolean'
      ? saved.rememberName
      : empty.cart.rememberName
  const expiresAt =
    Number.isFinite(saved.expiresAt) && saved.expiresAt > now
      ? saved.expiresAt
      : 0
  const items: CartItem[] = []
  if (expiresAt && Array.isArray(saved.items)) {
    const seen = new Set<string>()
    for (const item of saved.items) {
      if (
        typeof item?.id !== 'string' ||
        !item.id ||
        seen.has(item.id) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
      )
        continue
      seen.add(item.id)
      items.push({
        id: item.id,
        quantity: Math.min(item.quantity, ORDER_CONFIG.maxQuantity),
      })
    }
  }

  return {
    raw,
    expired: !expiresAt && Array.isArray(saved.items) && saved.items.length > 0,
    cart: {
      items,
      expiresAt: items.length ? expiresAt : 0,
      pickupPlace:
        saved.pickupPlace === ORDER_CONFIG.pickupPlace
          ? saved.pickupPlace
          : empty.cart.pickupPlace,
      rememberName,
      name: rememberName && typeof saved.name === 'string' ? saved.name : '',
    },
  }
}

/** Nur der gerade gelesene, selbst abgelaufene Speicherstand wird bereinigt. */
export function readCart(now = Date.now()): StoredCart | undefined {
  try {
    const snapshot = decodeCart(
      window.localStorage.getItem(CART_STORAGE_KEY),
      now
    )
    if (!snapshot.expired) return snapshot

    const result = writeCart(snapshot.cart, snapshot.raw, now)
    if (result?.status === 'changed') return result.snapshot
    return { ...snapshot, raw: result ? result.raw : snapshot.raw }
  } catch {
    return undefined
  }
}

type CartWrite =
  | { status: 'saved'; raw: string | null }
  | { status: 'changed'; snapshot: StoredCart }

/** Änderungen nur auf den zuletzt bekannten Stand anwenden. */
export function writeCart(
  cart: CartState | null,
  expected: string | null,
  now = Date.now()
): CartWrite | undefined {
  try {
    const raw =
      cart === null
        ? null
        : JSON.stringify({
            version: VERSION,
            ...cart,
            name: cart.rememberName ? cart.name : '',
          })
    const storage = window.localStorage
    const current = storage.getItem(CART_STORAGE_KEY)
    if (current !== expected) {
      return { status: 'changed', snapshot: decodeCart(current, now) }
    }

    if (raw === null) storage.removeItem(CART_STORAGE_KEY)
    else storage.setItem(CART_STORAGE_KEY, raw)
    return { status: 'saved', raw }
  } catch {
    // Der Korb bleibt für diese Sitzung im Arbeitsspeicher.
    return undefined
  }
}
