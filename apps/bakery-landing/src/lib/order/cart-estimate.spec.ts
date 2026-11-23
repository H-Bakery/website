import { estimateCart } from './cart-estimate'
import type { OrderProduct } from './order-config'

// Testorakel für die Rundung der Vorbestellungs-API.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  orderTotal,
}: {
  orderTotal: (items: { qty: number; unitPrice: number }[]) => number
} = require('../../../../bakery-api/src/services/delivery-preorders.core')

function cartForPrices(prices: (number | null)[], quantities: number[]) {
  const items = quantities.map((quantity, index) => ({
    id: `beispiel-${index}`,
    quantity,
  }))
  const catalogue = new Map<string, OrderProduct>(
    items.map(({ id }, index) => [
      id,
      {
        id,
        name: 'Beispielbrot',
        category: 'brot',
        available: true,
        price: prices[index],
        image: null,
      },
    ])
  )
  return estimateCart(items, catalogue)
}

it.each([
  { prices: [1.234], quantities: [2], total: 2.47 },
  { prices: [0.006, 0.006], quantities: [1, 1], total: 0.02 },
  { prices: [4.1, 1.234, 0], quantities: [3, 2, 2], total: 14.77 },
  { prices: [], quantities: [], total: 0 },
])(
  'rundet wie der Vorbestellungskern auf $total €',
  ({ prices, quantities, total }) => {
    const recorded = orderTotal(
      prices.map((unitPrice, index) => ({ qty: quantities[index], unitPrice }))
    )
    expect(recorded).toBe(total)
    expect(cartForPrices(prices, quantities)).toBe(recorded)
  }
)

it('lässt bei fehlendem Preis die Summe offen', () => {
  expect(cartForPrices([1.234, null], [2, 1])).toBeNull()
})
