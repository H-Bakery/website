/**
 * @fileoverview Tests for enhanced cart context
 * @module @bakery/shared/contexts/cart/tests
 */

import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { CartProvider, useCart } from './cart.context'
import { Product } from '@bakery/shared/types'

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

/** The `[key, value]` of the most recent `localStorage.setItem` call. */
function lastSetItemCall(): [string, string] {
  const calls = localStorageMock.setItem.mock.calls
  expect(calls.length).toBeGreaterThan(0)
  return calls[calls.length - 1] as [string, string]
}

// Mock product data
const mockProduct: Product = {
  id: 1,
  name: 'Bauernbrot',
  description: 'Traditional German bread',
  price: 3.5,
  category: 'Brot',
  image: '/images/bread.jpg',
  type: 'bread',
  isActive: true,
  stock: 10,
}

const mockProduct2: Product = {
  id: 2,
  name: 'Croissant',
  description: 'French pastry',
  price: 2.5,
  category: 'Gebäck',
  image: '/images/croissant.jpg',
  type: 'pastry',
  isActive: true,
  stock: 20,
}

describe('CartContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('should provide initial empty cart', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: CartProvider,
    })

    expect(result.current.items).toEqual([])
    expect(result.current.summary.totalCount).toBe(0)
    expect(result.current.summary.total).toBe(0)
    expect(result.current.isLoading).toBe(false)
  })

  it('should add product to cart', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: CartProvider,
    })

    act(() => {
      result.current.addToCart(mockProduct)
    })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0]).toEqual({
      ...mockProduct,
      quantity: 1,
    })
    expect(result.current.summary.totalCount).toBe(1)
    expect(result.current.summary.subtotal).toBe(3.5)
  })

  it('should increase quantity when adding existing product', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: CartProvider,
    })

    act(() => {
      result.current.addToCart(mockProduct)
      result.current.addToCart(mockProduct)
    })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].quantity).toBe(2)
    expect(result.current.summary.totalCount).toBe(2)
    expect(result.current.summary.subtotal).toBe(7.0)
  })

  it('should remove item from cart', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: CartProvider,
    })

    act(() => {
      result.current.addToCart(mockProduct)
      result.current.addToCart(mockProduct2)
    })

    expect(result.current.items).toHaveLength(2)

    act(() => {
      result.current.removeFromCart(mockProduct.id)
    })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].id).toBe(mockProduct2.id)
  })

  it('should update quantity', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: CartProvider,
    })

    act(() => {
      result.current.addToCart(mockProduct)
    })

    act(() => {
      result.current.updateQuantity(mockProduct.id, 5)
    })

    expect(result.current.items[0].quantity).toBe(5)
    expect(result.current.summary.totalCount).toBe(5)
    expect(result.current.summary.subtotal).toBe(17.5)
  })

  it('should remove item when quantity is set to 0', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: CartProvider,
    })

    act(() => {
      result.current.addToCart(mockProduct)
    })

    act(() => {
      result.current.updateQuantity(mockProduct.id, 0)
    })

    expect(result.current.items).toHaveLength(0)
  })

  it('should clear cart', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: CartProvider,
    })

    act(() => {
      result.current.addToCart(mockProduct)
      result.current.addToCart(mockProduct2)
    })

    expect(result.current.items).toHaveLength(2)

    act(() => {
      result.current.clearCart()
    })

    expect(result.current.items).toHaveLength(0)
    expect(result.current.summary.totalCount).toBe(0)
  })

  it('should calculate cart summary with tax', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: ({ children }) => (
        <CartProvider taxRate={0.19}>{children}</CartProvider>
      ),
    })

    act(() => {
      result.current.addToCart(mockProduct, 2)
    })

    const { summary } = result.current
    expect(summary.subtotal).toBe(7.0)
    expect(summary.tax).toBe(1.33) // 7 * 0.19
    expect(summary.total).toBe(8.33) // 7 + 1.33
  })

  it('should validate cart items', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: ({ children }) => (
        <CartProvider maxQuantityPerItem={5}>{children}</CartProvider>
      ),
    })

    act(() => {
      result.current.addToCart(mockProduct, 10)
    })

    // Quantity should be capped at max
    expect(result.current.items[0].quantity).toBe(5)
    expect(result.current.validation.errors[mockProduct.id]).toContain(
      'Maximum quantity is 5'
    )
  })

  it('should check if product is in cart', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: CartProvider,
    })

    expect(result.current.isInCart(mockProduct.id)).toBe(false)

    act(() => {
      result.current.addToCart(mockProduct)
    })

    expect(result.current.isInCart(mockProduct.id)).toBe(true)
    expect(result.current.isInCart(mockProduct2.id)).toBe(false)
  })

  it('should get product quantity', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: CartProvider,
    })

    expect(result.current.getQuantity(mockProduct.id)).toBe(0)

    act(() => {
      result.current.addToCart(mockProduct, 3)
    })

    expect(result.current.getQuantity(mockProduct.id)).toBe(3)
    expect(result.current.getQuantity(mockProduct2.id)).toBe(0)
  })

  it('should persist cart to localStorage', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: ({ children }) => (
        <CartProvider enablePersistence>{children}</CartProvider>
      ),
    })

    act(() => {
      result.current.addToCart(mockProduct)
    })

    // No debounce: the write has happened once the state update is committed,
    // without any awaited delay — a reload right after the click keeps the item.
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'bakery-cart',
      expect.stringContaining('"items"')
    )
    const [, payload] = lastSetItemCall()
    expect(JSON.parse(payload).items).toEqual([{ ...mockProduct, quantity: 1 }])
  })

  it('should write the cleared cart synchronously after clearCart', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: ({ children }) => (
        <CartProvider enablePersistence>{children}</CartProvider>
      ),
    })

    act(() => {
      result.current.addToCart(mockProduct)
    })
    act(() => {
      result.current.clearCart()
    })

    // The checkout calls clearCart() and navigates right away; a reload on the
    // confirmation page must not bring the ordered basket back.
    const [key, payload] = lastSetItemCall()
    expect(key).toBe('bakery-cart')
    expect(JSON.parse(payload)).toMatchObject({
      items: [],
      discountCode: null,
      discountAmount: 0,
    })
  })

  it('should never overwrite a stored cart with the initial empty state', () => {
    const savedCart = {
      items: [{ ...mockProduct, quantity: 2 }],
      savedAt: new Date().toISOString(),
    }
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedCart))

    renderHook(() => useCart(), {
      wrapper: ({ children }) => (
        <CartProvider enablePersistence>{children}</CartProvider>
      ),
    })

    // Every write during mount carries the stored line; the `isLoading` gate
    // is what keeps the empty initial state from clobbering it.
    const payloads = localStorageMock.setItem.mock.calls.map(([, value]) =>
      JSON.parse(value as string)
    )
    expect(payloads.length).toBeGreaterThan(0)
    for (const payload of payloads) {
      expect(payload.items).toEqual(savedCart.items)
    }
  })

  it('should load cart from localStorage', () => {
    const savedCart = {
      items: [{ ...mockProduct, quantity: 2 }],
      savedAt: new Date().toISOString(),
    }

    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedCart))

    const { result } = renderHook(() => useCart(), {
      wrapper: CartProvider,
    })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].quantity).toBe(2)
  })

  it('should export and import cart', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: CartProvider,
    })

    act(() => {
      result.current.addToCart(mockProduct, 2)
      result.current.addToCart(mockProduct2, 3)
    })

    let exportedData: string
    act(() => {
      exportedData = result.current.exportCart()
    })

    // Clear cart
    act(() => {
      result.current.clearCart()
    })
    expect(result.current.items).toHaveLength(0)

    // Import back
    act(() => {
      result.current.importCart(exportedData!)
    })

    expect(result.current.items).toHaveLength(2)
    expect(result.current.items[0].quantity).toBe(2)
    expect(result.current.items[1].quantity).toBe(3)
  })
})
