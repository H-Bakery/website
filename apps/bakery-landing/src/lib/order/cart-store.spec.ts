import {
  CART_LIFETIME_MS,
  CART_STORAGE_KEY,
  emptyCart,
  readCart,
  writeCart,
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
  writeCart(cart, null)
  expect(readCart(now)?.cart).toEqual(cart)
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? 'null')).toEqual({
    version: 1,
    ...cart,
  })
})

it('verwirft einen abgelaufenen Korb und behält den gemerkten Namen', () => {
  writeCart(cart, null)
  expect(readCart(cart.expiresAt)?.cart).toEqual({
    ...cart,
    items: [],
    expiresAt: 0,
  })
  expect(
    JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? 'null').items
  ).toEqual([])
})

it('speichert ohne Häkchen keinen Namen und kann die Angaben löschen', () => {
  writeCart({ ...cart, rememberName: false }, null)
  expect(readCart(now)?.cart).toEqual({
    ...cart,
    rememberName: false,
    name: '',
  })
  expect(localStorage.getItem(CART_STORAGE_KEY)).not.toContain(cart.name)
  writeCart(null, localStorage.getItem(CART_STORAGE_KEY))
  expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull()
})

it.each(['kaputtes JSON', 'null', JSON.stringify({ ...cart, version: 2 })])(
  'fällt bei einem ungültigen Speicherstand (%s) auf einen leeren Korb zurück',
  (data) => {
    localStorage.setItem(CART_STORAGE_KEY, data)
    expect(readCart(now)?.cart).toEqual(emptyCart())
  }
)

it('funktioniert bei einem blockierten localStorage-Zugriff', () => {
  jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('Speicher gesperrt', 'SecurityError')
  })
  expect(readCart(now)).toBeUndefined()
  expect(() => writeCart(cart, null)).not.toThrow()
  expect(() => writeCart(null, null)).not.toThrow()
})

it('bewahrt Änderungen zwischen dem Lesen eines abgelaufenen Korbs und der Bereinigung', () => {
  const old = writeCart(cart, null)
  if (old?.status !== 'saved')
    throw new Error('Korb konnte nicht gespeichert werden')
  const actual = {
    ...cart,
    expiresAt: cart.expiresAt + CART_LIFETIME_MS,
    name: 'Alex Beispiel',
  }
  writeCart(actual, old.raw)
  jest.spyOn(Storage.prototype, 'getItem').mockReturnValueOnce(old.raw)

  expect(readCart(cart.expiresAt)?.cart).toEqual(actual)
  expect(readCart(cart.expiresAt)?.cart).toEqual(actual)
})
