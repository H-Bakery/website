import { default as React } from 'react'
import { Product } from '@bakery/shared/types'
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
 * Enhanced cart provider component
 */
export declare const CartProvider: React.FC<CartProviderProps>
/**
 * Hook to use cart context
 * @throws {Error} If used outside of CartProvider
 */
export declare const useCart: () => CartContextType
/**
 * Hook to get cart summary only
 */
export declare const useCartSummary: () => CartSummary
/**
 * Hook to check if cart is empty
 */
export declare const useIsCartEmpty: () => boolean
