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

export function emptyCart(): CartState {
  return {
    items: [],
    expiresAt: 0,
    pickupPlace: ORDER_CONFIG.pickupPlace,
    name: '',
    rememberName: ORDER_CONFIG.rememberNameByDefault,
  }
}

export function readCart(now = Date.now()): CartState {
  const empty = emptyCart()
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return empty
    const saved = JSON.parse(raw)
    if (saved?.version !== VERSION) return empty

    const rememberName =
      typeof saved.rememberName === 'boolean'
        ? saved.rememberName
        : empty.rememberName
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

    const restored = {
      items,
      expiresAt: items.length ? expiresAt : 0,
      pickupPlace:
        saved.pickupPlace === ORDER_CONFIG.pickupPlace
          ? saved.pickupPlace
          : empty.pickupPlace,
      rememberName,
      name: rememberName && typeof saved.name === 'string' ? saved.name : '',
    }
    if (!expiresAt && Array.isArray(saved.items) && saved.items.length) {
      saveCart(restored)
    }
    return restored
  } catch {
    return empty
  }
}

export function saveCart(cart: CartState): void {
  try {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({
        version: VERSION,
        ...cart,
        name: cart.rememberName ? cart.name : '',
      })
    )
  } catch {
    // Der Korb bleibt für diese Sitzung im Arbeitsspeicher.
  }
}

export function forgetCart(): void {
  try {
    window.localStorage.removeItem(CART_STORAGE_KEY)
  } catch {
    // Die Angaben im Arbeitsspeicher werden unabhängig davon gelöscht.
  }
}
