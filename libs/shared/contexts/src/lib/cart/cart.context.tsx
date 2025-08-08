'use client'

/**
 * @fileoverview Enhanced cart context with persistence, validation, and optimizations
 * @module @bakery/shared/contexts/cart
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { Product, ProductStatus } from '@bakery/shared/types'

/**
 * Cart item with quantity
 */
export interface CartItem extends Product {
  /** Quantity in cart */
  quantity: number
  /** Additional notes or customizations */
  notes?: string
  /** Selected options/variants */
  selectedOptions?: Record<string, string>
}

/**
 * Cart summary statistics
 */
export interface CartSummary {
  /** Total number of items */
  totalCount: number
  /** Total price before discounts */
  subtotal: number
  /** Applied discount amount */
  discount: number
  /** Tax amount */
  tax: number
  /** Total price after discounts and tax */
  total: number
  /** Estimated weight in grams */
  totalWeight?: number
}

/**
 * Cart validation result
 */
export interface CartValidation {
  /** Whether cart is valid */
  isValid: boolean
  /** Validation errors by item ID */
  errors: Record<number, string[]>
  /** Global cart errors */
  globalErrors: string[]
}

/**
 * Cart context type
 */
export interface CartContextType {
  /** Cart items */
  items: CartItem[]
  /** Cart summary */
  summary: CartSummary
  /** Cart validation */
  validation: CartValidation
  /** Whether cart is loading from storage */
  isLoading: boolean
  /** Add product to cart */
  addToCart: (product: Product, quantity?: number, notes?: string) => void
  /** Remove item from cart */
  removeFromCart: (id: number) => void
  /** Update item quantity */
  updateQuantity: (id: number, quantity: number) => void
  /** Update item notes */
  updateNotes: (id: number, notes: string) => void
  /** Clear all items from cart */
  clearCart: () => void
  /** Check if product is in cart */
  isInCart: (productId: number) => boolean
  /** Get quantity of product in cart */
  getQuantity: (productId: number) => number
  /** Apply discount code */
  applyDiscount: (code: string) => Promise<boolean>
  /** Remove discount */
  removeDiscount: () => void
  /** Validate cart contents */
  validateCart: () => Promise<CartValidation>
  /** Export cart as JSON */
  exportCart: () => string
  /** Import cart from JSON */
  importCart: (data: string) => boolean
}

/**
 * Cart provider props
 */
export interface CartProviderProps {
  /** Child components */
  children: React.ReactNode
  /** Storage key for persistence */
  storageKey?: string
  /** Whether to persist cart to storage */
  enablePersistence?: boolean
  /** Tax rate (0-1) */
  taxRate?: number
  /** Maximum items allowed in cart */
  maxItems?: number
  /** Maximum quantity per item */
  maxQuantityPerItem?: number
  /** Auto-save delay in ms */
  autoSaveDelay?: number
  /** Validation function */
  validateItem?: (item: CartItem) => string[]
}

/**
 * Cart context
 */
export const CartContext = createContext<CartContextType | undefined>(undefined)

/**
 * Default cart summary
 */
const DEFAULT_SUMMARY: CartSummary = {
  totalCount: 0,
  subtotal: 0,
  discount: 0,
  tax: 0,
  total: 0,
  totalWeight: 0,
}

/**
 * Enhanced cart provider component
 */
export const CartProvider: React.FC<CartProviderProps> = ({
  children,
  storageKey = 'bakery-cart',
  enablePersistence = true,
  taxRate = 0.19, // 19% German VAT
  maxItems = 100,
  maxQuantityPerItem = 99,
  autoSaveDelay = 1000,
  validateItem,
}) => {
  const [items, setItems] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [discountCode, setDiscountCode] = useState<string | null>(null)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  // Calculate cart summary
  const summary = useMemo((): CartSummary => {
    if (items.length === 0) return DEFAULT_SUMMARY

    const totalCount = items.reduce((sum, item) => sum + item.quantity, 0)
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const tax = subtotal * taxRate
    const total = subtotal - discountAmount + tax
    const totalWeight = items.reduce(
      (sum, item) => sum + ((item.weight || 0) * item.quantity),
      0
    )

    return {
      totalCount,
      subtotal,
      discount: discountAmount,
      tax,
      total,
      totalWeight,
    }
  }, [items, discountAmount, taxRate])

  // Validate cart
  const validateCart = useCallback(async (): Promise<CartValidation> => {
    const errors: Record<number, string[]> = {}
    const globalErrors: string[] = []

    // Check total items limit
    if (items.length > maxItems) {
      globalErrors.push(`Cart cannot contain more than ${maxItems} different items`)
    }

    // Validate each item
    for (const item of items) {
      const itemErrors: string[] = []

      // Check quantity limits
      if (item.quantity > maxQuantityPerItem) {
        itemErrors.push(`Maximum quantity is ${maxQuantityPerItem}`)
      }
      if (item.quantity < 1) {
        itemErrors.push('Quantity must be at least 1')
      }

      // Check stock if available
      if (item.stock !== undefined && item.quantity > item.stock) {
        itemErrors.push(`Only ${item.stock} items available`)
      }

      // Check if product is active
      if (item.status === ProductStatus.Discontinued || item.status === ProductStatus.OutOfStock) {
        itemErrors.push('Product is no longer available')
      }

      // Custom validation
      if (validateItem) {
        itemErrors.push(...validateItem(item))
      }

      if (itemErrors.length > 0) {
        errors[item.id] = itemErrors
      }
    }

    const isValid = Object.keys(errors).length === 0 && globalErrors.length === 0

    return { isValid, errors, globalErrors }
  }, [items, maxItems, maxQuantityPerItem, validateItem])

  // Current validation state
  const validation = useMemo(() => {
    // Run synchronous validation for immediate feedback
    const errors: Record<number, string[]> = {}
    const globalErrors: string[] = []

    if (items.length > maxItems) {
      globalErrors.push(`Cart cannot contain more than ${maxItems} different items`)
    }

    for (const item of items) {
      const itemErrors: string[] = []
      if (item.quantity > maxQuantityPerItem) {
        itemErrors.push(`Maximum quantity is ${maxQuantityPerItem}`)
      }
      if (itemErrors.length > 0) {
        errors[item.id] = itemErrors
      }
    }

    return {
      isValid: Object.keys(errors).length === 0 && globalErrors.length === 0,
      errors,
      globalErrors,
    }
  }, [items, maxItems, maxQuantityPerItem])

  // Load cart from storage
  useEffect(() => {
    if (!enablePersistence || typeof window === 'undefined') {
      setIsLoading(false)
      return
    }

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const data = JSON.parse(stored)
        if (Array.isArray(data.items)) {
          setItems(data.items)
        }
        if (data.discountCode) {
          setDiscountCode(data.discountCode)
          setDiscountAmount(data.discountAmount || 0)
        }
      }
    } catch (error) {
      console.warn('Failed to load cart from storage:', error)
    } finally {
      setIsLoading(false)
    }
  }, [storageKey, enablePersistence])

  // Save cart to storage with debouncing
  useEffect(() => {
    if (!enablePersistence || typeof window === 'undefined' || isLoading) return

    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      try {
        const data = {
          items,
          discountCode,
          discountAmount,
          savedAt: new Date().toISOString(),
        }
        localStorage.setItem(storageKey, JSON.stringify(data))
      } catch (error) {
        console.warn('Failed to save cart to storage:', error)
      }
    }, autoSaveDelay)

    setSaveTimeout(timeout)

    return () => {
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }, [items, discountCode, discountAmount, storageKey, enablePersistence, autoSaveDelay, isLoading])

  // Add to cart handler
  const addToCart = useCallback((
    product: Product,
    quantity: number = 1,
    notes?: string
  ) => {
    setItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id)

      if (existingItem) {
        // Update quantity if item exists
        const newQuantity = Math.min(
          existingItem.quantity + quantity,
          maxQuantityPerItem
        )
        return prevItems.map(item =>
          item.id === product.id
            ? { ...item, quantity: newQuantity, notes: notes || item.notes }
            : item
        )
      } else {
        // Add new item
        if (prevItems.length >= maxItems) {
          console.warn(`Cannot add more than ${maxItems} different items to cart`)
          return prevItems
        }
        return [...prevItems, { ...product, quantity, notes }]
      }
    })
  }, [maxItems, maxQuantityPerItem])

  // Remove from cart handler
  const removeFromCart = useCallback((id: number) => {
    setItems(prevItems => prevItems.filter(item => item.id !== id))
  }, [])

  // Update quantity handler
  const updateQuantity = useCallback((id: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id)
      return
    }

    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id
          ? { ...item, quantity: Math.min(quantity, maxQuantityPerItem) }
          : item
      )
    )
  }, [maxQuantityPerItem, removeFromCart])

  // Update notes handler
  const updateNotes = useCallback((id: number, notes: string) => {
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, notes } : item
      )
    )
  }, [])

  // Clear cart handler
  const clearCart = useCallback(() => {
    setItems([])
    setDiscountCode(null)
    setDiscountAmount(0)
  }, [])

  // Check if in cart
  const isInCart = useCallback((productId: number): boolean => {
    return items.some(item => item.id === productId)
  }, [items])

  // Get quantity in cart
  const getQuantity = useCallback((productId: number): number => {
    const item = items.find(item => item.id === productId)
    return item?.quantity || 0
  }, [items])

  // Apply discount code
  const applyDiscount = useCallback(async (code: string): Promise<boolean> => {
    try {
      // TODO: Validate discount code with API
      // For now, simulate some discount codes
      const discounts: Record<string, number> = {
        'SAVE10': 0.1,
        'SAVE20': 0.2,
        'WELCOME': 0.15,
      }

      const discountRate = discounts[code.toUpperCase()]
      if (discountRate) {
        setDiscountCode(code)
        setDiscountAmount(summary.subtotal * discountRate)
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to apply discount:', error)
      return false
    }
  }, [summary.subtotal])

  // Remove discount
  const removeDiscount = useCallback(() => {
    setDiscountCode(null)
    setDiscountAmount(0)
  }, [])

  // Export cart as JSON
  const exportCart = useCallback((): string => {
    return JSON.stringify({
      items,
      discountCode,
      exportedAt: new Date().toISOString(),
    }, null, 2)
  }, [items, discountCode])

  // Import cart from JSON
  const importCart = useCallback((data: string): boolean => {
    try {
      const parsed = JSON.parse(data)
      if (Array.isArray(parsed.items)) {
        setItems(parsed.items)
        if (parsed.discountCode) {
          applyDiscount(parsed.discountCode)
        }
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to import cart:', error)
      return false
    }
  }, [applyDiscount])

  // Context value
  const value = useMemo<CartContextType>(
    () => ({
      items,
      summary,
      validation,
      isLoading,
      addToCart,
      removeFromCart,
      updateQuantity,
      updateNotes,
      clearCart,
      isInCart,
      getQuantity,
      applyDiscount,
      removeDiscount,
      validateCart,
      exportCart,
      importCart,
    }),
    [
      items,
      summary,
      validation,
      isLoading,
      addToCart,
      removeFromCart,
      updateQuantity,
      updateNotes,
      clearCart,
      isInCart,
      getQuantity,
      applyDiscount,
      removeDiscount,
      validateCart,
      exportCart,
      importCart,
    ]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

/**
 * Hook to use cart context
 * @throws {Error} If used outside of CartProvider
 */
export const useCart = (): CartContextType => {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}

/**
 * Hook to get cart summary only
 */
export const useCartSummary = (): CartSummary => {
  const { summary } = useCart()
  return summary
}

/**
 * Hook to check if cart is empty
 */
export const useIsCartEmpty = (): boolean => {
  const { items } = useCart()
  return items.length === 0
}