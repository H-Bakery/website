/**
 * Unit tests for the real shop order submission layer
 */

import {
  ShopOrderInput,
  buildOrderItems,
  fetchShopOrder,
  submitOrder,
} from './shop-orders'

const mockFetch = jest.fn()

/** Builds a minimal Response-like object; only `ok`/`status`/`json` are used. */
function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number } = {}
): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response
}

const ORDER_INPUT: ShopOrderInput = {
  customerName: 'Max Mustermann',
  phone: '06841 123456',
  email: 'max@example.com',
  pickupDate: '2026-09-01',
  pickupTime: '08:30',
  notes: 'Bitte gut durchgebacken.',
  items: [
    {
      productId: 'kornbrot-500g',
      name: 'Kornbrot 500g',
      quantity: 2,
      price: 2.5,
    },
  ],
  total: 5,
}

describe('shop-orders', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env['NEXT_PUBLIC_API_URL']
    global.fetch = mockFetch as unknown as typeof fetch
  })

  describe('buildOrderItems', () => {
    it('maps cart items to order lines using the slug id', () => {
      expect(
        buildOrderItems([
          {
            id: 1,
            slug: 'kornbrot-500g',
            name: 'Kornbrot 500g',
            price: 2.5,
            quantity: 2,
          },
        ])
      ).toEqual([
        {
          productId: 'kornbrot-500g',
          name: 'Kornbrot 500g',
          quantity: 2,
          price: 2.5,
        },
      ])
    })

    it('falls back to the numeric id when no slug was stored', () => {
      const [line] = buildOrderItems([
        { id: 42, name: 'Erdbeertorte', price: 18, quantity: 1 },
      ])
      expect(line.productId).toBe('42')
    })

    it('ignores blank slugs and returns an empty list for an empty cart', () => {
      const [line] = buildOrderItems([
        { id: 7, slug: '   ', name: 'Brezel', price: 1.2, quantity: 3 },
      ])
      expect(line.productId).toBe('7')
      expect(buildOrderItems([])).toEqual([])
    })
  })

  describe('submitOrder', () => {
    it('POSTs JSON and returns the created order', async () => {
      const created = {
        ...ORDER_INPUT,
        id: '3',
        status: 'pending',
        createdAt: '2026-08-30T07:00:00.000Z',
      }
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: created }, { status: 201 })
      )

      const order = await submitOrder(ORDER_INPUT)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe('http://localhost:5000/api/orders')
      expect(init.method).toBe('POST')
      expect(init.headers['Content-Type']).toBe('application/json')
      expect(JSON.parse(init.body)).toEqual(ORDER_INPUT)
      expect(order).toEqual(created)
      expect(order.id).toBe('3')
    })

    it('honours NEXT_PUBLIC_API_URL', async () => {
      process.env['NEXT_PUBLIC_API_URL'] = 'https://api.example.com'
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { id: '1' } }, { status: 201 })
      )

      await submitOrder(ORDER_INPUT)

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://api.example.com/api/orders'
      )
    })

    it('accepts a bare order object without a data envelope', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          { ...ORDER_INPUT, id: '9', status: 'pending' },
          { status: 201 }
        )
      )

      await expect(submitOrder(ORDER_INPUT)).resolves.toMatchObject({ id: '9' })
    })

    it("throws the server's message on a non-2xx response", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          { success: false, message: 'Abholzeit liegt in der Vergangenheit.' },
          { ok: false, status: 400 }
        )
      )

      await expect(submitOrder(ORDER_INPUT)).rejects.toThrow(
        'Abholzeit liegt in der Vergangenheit.'
      )
    })

    it('falls back to the error field when there is no message', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          { error: 'Warenkorb ist leer.' },
          { ok: false, status: 422 }
        )
      )

      await expect(submitOrder(ORDER_INPUT)).rejects.toThrow(
        'Warenkorb ist leer.'
      )
    })

    it('throws a German fallback when the server sends no message', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(null, { ok: false, status: 500 })
      )

      await expect(submitOrder(ORDER_INPUT)).rejects.toThrow(
        'Bestellung konnte nicht übermittelt werden.'
      )
    })

    it('throws a German fallback on a network failure', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      await expect(submitOrder(ORDER_INPUT)).rejects.toThrow(
        'Bestellung konnte nicht übermittelt werden.'
      )
    })

    it('throws when a 2xx response carries no order payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => {
          throw new SyntaxError('Unexpected end of JSON input')
        },
      } as unknown as Response)

      await expect(submitOrder(ORDER_INPUT)).rejects.toThrow(
        'Bestellung konnte nicht übermittelt werden.'
      )
    })
  })

  describe('fetchShopOrder', () => {
    it('loads an order by id', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { ...ORDER_INPUT, id: '3' } })
      )

      const order = await fetchShopOrder('3')

      expect(mockFetch.mock.calls[0][0]).toBe(
        'http://localhost:5000/api/orders/3'
      )
      expect(order?.id).toBe('3')
    })

    it('returns null for an unknown order', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          { success: false, error: 'Order not found' },
          {
            ok: false,
            status: 404,
          }
        )
      )

      await expect(fetchShopOrder('999')).resolves.toBeNull()
    })

    it('returns null for an empty id without hitting the API', async () => {
      await expect(fetchShopOrder(' ')).resolves.toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('throws a German error on a network failure', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      await expect(fetchShopOrder('3')).rejects.toThrow(
        'Bestellung konnte nicht geladen werden.'
      )
    })
  })
})
