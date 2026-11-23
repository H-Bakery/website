import type { CartItem } from './cart-store'
import { isOrderable, type OrderProduct } from './order-config'

export function estimateCart(
  items: readonly CartItem[],
  products: ReadonlyMap<string, OrderProduct>
): number | null {
  let total = 0
  for (const { id, quantity } of items) {
    const product = products.get(id)
    if (!isOrderable(product) || product.price === null) return null

    // Wie orderTotal in delivery-preorders.core.js: erst die Zeile runden.
    total += Math.round(quantity * product.price * 100) / 100
  }
  return Math.round(total * 100) / 100
}
