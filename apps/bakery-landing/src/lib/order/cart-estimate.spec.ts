import { estimateCart } from './cart-estimate'
import type { OrderProduct } from './order-config'

function cartForPrices(
  prices: (number | null)[],
  quantities: number[],
  available = true
) {
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
        available,
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
  'gibt die Bestellsumme von $total € aus',
  ({ prices, quantities, total }) => {
    expect(cartForPrices(prices, quantities)).toBe(total)
  }
)

it('lässt bei fehlendem Preis die Summe offen', () => {
  expect(cartForPrices([1.234, null], [2, 1])).toBeNull()
})

it('lässt bei nicht bestellbaren Artikeln die Summe offen', () => {
  expect(cartForPrices([1.234], [2], false)).toBeNull()
})
