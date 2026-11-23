'use client'

import { createContext, useContext } from 'react'
import type { CartState } from '../../lib/order/cart-store'
import type { OrderProduct } from '../../lib/order/order-config'

interface OrderContextValue {
  cart: CartState
  ready: boolean
  products: ReadonlyMap<string, OrderProduct>
  notes: ReadonlyMap<string, string>
  estimate: number | null
  reference: string
  expired: boolean
  draftVersion: number
  refreshCart: () => boolean
  changeQuantity: (id: string, change: number | 'remove') => void
  setNote: (id: string, note: string) => void
  setName: (name: string) => void
  setRememberName: (rememberName: boolean) => void
  clearCart: () => boolean
  forget: () => boolean
  openCart: () => void
}

export const OrderContext = createContext<OrderContextValue | null>(null)
export const useOrder = () => useContext(OrderContext)
