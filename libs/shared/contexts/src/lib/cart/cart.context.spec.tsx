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

    // addToCart kappt auf maxQuantityPerItem – die Validierung meldet dann nichts
    expect(result.current.items[0].quantity).toBe(5)
    expect(result.current.validation.errors[mockProduct.id]).toBeUndefined()
    expect(result.current.validation.isValid).toBe(true)
  })

  it('should flag persisted quantities above the limit', () => {
    localStorageMock.getItem.mockReturnValueOnce(
      JSON.stringify({ items: [{ ...mockProduct, quantity: 10 }] })
    )

    const { result } = renderHook(() => useCart(), {
      wrapper: ({ children }) => (
        <CartProvider enablePersistence maxQuantityPerItem={5}>
          {children}
        </CartProvider>
      ),
    })

    expect(result.current.items[0].quantity).toBe(10)
    expect(result.current.validation.isValid).toBe(false)
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

  it('should persist cart to localStorage', async () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: ({ children }) => (
        <CartProvider enablePersistence autoSaveDelay={0}>
          {children}
        </CartProvider>
      ),
    })

    act(() => {
      result.current.addToCart(mockProduct)
    })

    // Wait for save
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'bakery-cart',
      expect.stringContaining('"items"')
    )
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

describe('CartContext.refreshItems', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('übernimmt Preis und Name aus den frischen Produkten — Menge und Notiz bleiben', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider })
    act(() => {
      result.current.addToCart(mockProduct, 3, 'ungeschnitten')
    })

    let changed = false
    act(() => {
      changed = result.current.refreshItems([
        { ...mockProduct, price: 9.99, name: 'Bauernbrot groß' },
      ])
    })

    expect(changed).toBe(true)
    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0]).toMatchObject({
      id: 1,
      price: 9.99,
      name: 'Bauernbrot groß',
      quantity: 3,
      notes: 'ungeschnitten',
    })
    expect(result.current.summary.subtotal).toBeCloseTo(29.97)
  })

  it('meldet keine Änderung, wenn nur der Name anders ist', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider })
    act(() => {
      result.current.addToCart(mockProduct)
    })

    let changed = true
    act(() => {
      changed = result.current.refreshItems([
        { ...mockProduct, name: 'Bauernbrot groß' },
      ])
    })

    expect(changed).toBe(false)
    expect(result.current.items[0].name).toBe('Bauernbrot groß')
    expect(result.current.items[0].price).toBe(3.5)
  })

  it('lässt Artikel ohne passendes Produkt unangetastet', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider })
    act(() => {
      result.current.addToCart(mockProduct)
      result.current.addToCart(mockProduct2, 2)
    })

    let changed = false
    act(() => {
      changed = result.current.refreshItems([{ ...mockProduct2, price: 1 }])
    })

    expect(changed).toBe(true)
    expect(result.current.items[0]).toEqual({ ...mockProduct, quantity: 1 })
    expect(result.current.items[1]).toMatchObject({
      id: 2,
      price: 1,
      quantity: 2,
    })
  })

  it('wertet Rundungsrauschen und eine leere Liste nicht als Preisänderung', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider })
    act(() => {
      result.current.addToCart(mockProduct)
    })

    let changed = true
    act(() => {
      changed = result.current.refreshItems([
        { ...mockProduct, price: 3.5 + 1e-9 },
      ])
    })
    expect(changed).toBe(false)

    // Ohne Produkte gibt es nichts abzugleichen — die Liste bleibt dieselbe.
    const before = result.current.items
    act(() => {
      changed = result.current.refreshItems([])
    })
    expect(changed).toBe(false)
    expect(result.current.items).toBe(before)
  })
})
