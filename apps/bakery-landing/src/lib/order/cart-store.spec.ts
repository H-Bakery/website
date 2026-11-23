import {
  CART_LIFETIME_MS,
  CART_STORAGE_KEY,
  emptyCart,
  forgetCart,
  readCart,
  saveCart,
} from './cart-store'

const now = 100_000
const cart = {
  ...emptyCart(),
  items: [{ id: 'beispielbrot', quantity: 2 }],
  expiresAt: now + CART_LIFETIME_MS,
  name: 'Erika Beispielfrau',
}

afterEach(() => {
  jest.restoreAllMocks()
  localStorage.clear()
})

it('speichert Artikel nur als IDs und Mengen und behält den Namen mit Häkchen', () => {
  saveCart(cart)
  expect(readCart(now)).toEqual(cart)
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? 'null')).toEqual({
    version: 1,
    ...cart,
  })
})

it('verwirft einen abgelaufenen Korb und behält den gemerkten Namen', () => {
  saveCart(cart)
  expect(readCart(cart.expiresAt)).toEqual({ ...cart, items: [], expiresAt: 0 })
  expect(
    JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? 'null').items
  ).toEqual([])
})

it('speichert ohne Häkchen keinen Namen und kann die Angaben löschen', () => {
  saveCart({ ...cart, rememberName: false })
  expect(readCart(now)).toEqual({ ...cart, rememberName: false, name: '' })
  expect(localStorage.getItem(CART_STORAGE_KEY)).not.toContain(cart.name)
  forgetCart()
  expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull()
})

it.each(['kaputtes JSON', 'null', JSON.stringify({ ...cart, version: 2 })])(
  'fällt bei einem ungültigen Speicherstand (%s) auf einen leeren Korb zurück',
  (data) => {
    localStorage.setItem(CART_STORAGE_KEY, data)
    expect(readCart(now)).toEqual(emptyCart())
  }
)

it('funktioniert bei einem blockierten localStorage-Zugriff', () => {
  jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('Speicher gesperrt', 'SecurityError')
  })
  expect(readCart(now)).toEqual(emptyCart())
  expect(() => saveCart(cart)).not.toThrow()
  expect(() => forgetCart()).not.toThrow()
})
