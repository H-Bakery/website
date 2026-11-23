'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Box } from '@mui/material'
import {
  CART_LIFETIME_MS,
  emptyCart,
  forgetCart,
  readCart,
  saveCart,
  type CartState,
} from '../../lib/order/cart-store'
import {
  isOrderable,
  ORDER_CONFIG,
  type OrderProduct,
} from '../../lib/order/order-config'
import { newOrderReference } from '../../lib/order/order-message'
import { formatPrice } from '../../utils/formatPrice'
import { CartBar } from './CartBar'
import { CartSheet } from './CartSheet'

import { OrderContext } from './OrderContext'

export function OrderProvider({
  catalogue,
  children,
}: {
  catalogue: OrderProduct[]
  children: ReactNode
}) {
  const [products] = useState(
    () => new Map(catalogue.map((product) => [product.id, product]))
  )
  const [cart, setCart] = useState(emptyCart)
  const cartRef = useRef(cart)
  const [ready, setReady] = useState(false)
  const [notes, setNotes] = useState(() => new Map<string, string>())
  const [open, setOpen] = useState<boolean | null>(null)
  const [reference, setReference] = useState('')
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const saved = readCart()
    cartRef.current = saved
    setCart(saved)
    setReady(true)
  }, [])

  function commit(next: CartState) {
    cartRef.current = next
    setCart(next)
    saveCart(next)
  }

  function changeQuantity(id: string, change: number | 'remove') {
    const product = products.get(id)
    if (typeof change === 'number' && change > 0 && !isOrderable(product))
      return

    const current = cartRef.current
    const old = current.items.find((item) => item.id === id)?.quantity ?? 0
    const quantity =
      change === 'remove'
        ? 0
        : Math.max(0, Math.min(ORDER_CONFIG.maxQuantity, old + change))
    if (quantity === old) return
    const items = current.items.filter((item) => item.id !== id)
    if (quantity) items.push({ id, quantity })
    else
      setNotes((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    if (!items.length) setReference('')
    commit({
      ...current,
      items,
      expiresAt: items.length ? Date.now() + CART_LIFETIME_MS : 0,
    })
    setAnnouncement(
      quantity
        ? `${product?.name ?? 'Artikel'} im Korb, ${quantity} Stück`
        : `${product?.name ?? 'Artikel'} aus dem Korb entfernt`
    )
  }

  function clearCart() {
    commit({ ...cartRef.current, items: [], expiresAt: 0 })
    setNotes(new Map())
    setReference('')
    setAnnouncement('Korb geleert')
  }

  function forget() {
    const empty = emptyCart()
    forgetCart()
    cartRef.current = empty
    setCart(empty)
    setNotes(new Map())
    setReference('')
    setAnnouncement('Korb und Angaben gelöscht')
  }

  function openCart() {
    setReference((previous) => previous || newOrderReference())
    setOpen(true)
  }

  const count = cart.items.reduce((sum, item) => sum + item.quantity, 0)
  let cents = 0
  let priceKnown = true
  for (const item of cart.items) {
    const product = products.get(item.id)
    if (!isOrderable(product) || product.price === null) priceKnown = false
    else cents += Math.round(product.price * 100) * item.quantity
  }
  const estimate = priceKnown ? cents / 100 : null

  return (
    <OrderContext.Provider
      value={{
        cart,
        ready,
        products,
        notes,
        estimate,
        reference,
        changeQuantity,
        setNote: (id, note) => setNotes((prev) => new Map(prev).set(id, note)),
        setName: (name) => commit({ ...cartRef.current, name }),
        setRememberName: (rememberName) =>
          commit({ ...cartRef.current, rememberName }),
        openCart,
        clearCart,
        forget,
      }}
    >
      {children}
      <Box
        role="status"
        aria-live="polite"
        sx={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          p: 0,
          overflow: 'hidden',
          clipPath: 'inset(50%)',
          whiteSpace: 'nowrap',
        }}
      >
        {announcement}
      </Box>
      {count > 0 && (
        <CartBar
          count={count}
          estimate={
            estimate === null ? 'Summe offen' : `ca. ${formatPrice(estimate)}`
          }
          onOpen={openCart}
        />
      )}
      {open !== null && (
        <CartSheet open={open} onClose={() => setOpen(false)} />
      )}
    </OrderContext.Provider>
  )
}
