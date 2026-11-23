import type { CartItem } from './cart-store'
import { isOrderable, type OrderProduct } from './order-config'

interface PreorderLine {
  qty: number
  unitPrice: number
}

interface PreorderTotals {
  orderTotal: (items: PreorderLine[]) => number
}

// Wie in der Verwaltung: Nur den reinen CommonJS-Kern im Browser verwenden.
// nx-ignore-next-line
const core: PreorderTotals = require('../../../../bakery-api/src/services/delivery-preorders.core') // eslint-disable-line @typescript-eslint/no-var-requires, @nx/enforce-module-boundaries

export function estimateCart(
  items: readonly CartItem[],
  products: ReadonlyMap<string, OrderProduct>
): number | null {
  const lines: PreorderLine[] = []
  for (const { id, quantity } of items) {
    const product = products.get(id)
    if (!isOrderable(product) || product.price === null) return null
    lines.push({ qty: quantity, unitPrice: product.price })
  }
  return core.orderTotal(lines)
}
