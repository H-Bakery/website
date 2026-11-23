'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { estimateCart } from '../../lib/order/cart-estimate'
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
import { CartAnnouncement } from './CartAnnouncement'
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
  const [announcement, setAnnouncement] = useState<{
    text: string
    inDialog: boolean
  } | null>(null)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const saved = readCart()
    cartRef.current = saved
    setCart(saved)
    setReady(true)
  }, [])

  const commit = useCallback((next: CartState) => {
    cartRef.current = next
    setCart(next)
    saveCart(next)
  }, [])

  const expireCart = useCallback(() => {
    const current = cartRef.current
    if (!current.items.length || current.expiresAt > Date.now()) return false

    commit({ ...current, items: [], expiresAt: 0 })
    setNotes(new Map())
    setReference('')
    setAnnouncement(null)
    setExpired(true)
    return true
  }, [commit])

  useEffect(() => {
    if (!cart.expiresAt) return undefined

    const checkExpiry = () => {
      // Prüft den aktuellen Stand auch dann, wenn der Browser einen Timer verspätet ausführt.
      if (expireCart()) return
      const { expiresAt } = cartRef.current
      if (expiresAt) {
        timer = window.setTimeout(
          checkExpiry,
          Math.min(CART_LIFETIME_MS, Math.max(0, expiresAt - Date.now()))
        )
      }
    }

    let timer: number | undefined
    checkExpiry()
    window.addEventListener('focus', expireCart)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', expireCart)
    }
  }, [cart.expiresAt, expireCart])

  function announce(text: string, inDialog = Boolean(open)) {
    setAnnouncement({ text, inDialog })
  }

  function changeQuantity(id: string, change: number | 'remove') {
    if (expireCart()) return
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
    setExpired(false)
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
    announce(
      quantity
        ? `${product?.name ?? 'Artikel'} im Korb, ${quantity} Stück`
        : `${product?.name ?? 'Artikel'} aus dem Korb entfernt`
    )
  }

  function clearCart() {
    commit({ ...cartRef.current, items: [], expiresAt: 0 })
    setNotes(new Map())
    setReference('')
    announce('Korb geleert', false)
    setExpired(false)
  }

  function forget() {
    const empty = emptyCart()
    forgetCart()
    cartRef.current = empty
    setCart(empty)
    setNotes(new Map())
    setReference('')
    announce('Korb und Angaben gelöscht')
    setExpired(false)
  }

  function openCart() {
    expireCart()
    setAnnouncement(null)
    setReference((previous) => previous || newOrderReference())
    setOpen(true)
  }

  const count = cart.items.reduce((sum, item) => sum + item.quantity, 0)
  const estimate = estimateCart(cart.items, products)

  return (
    <OrderContext.Provider
      value={{
        cart,
        ready,
        products,
        notes,
        estimate,
        reference,
        expired,
        expireCart,
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
      <CartAnnouncement>
        {!open && !announcement?.inDialog ? announcement?.text ?? '' : ''}
      </CartAnnouncement>
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
        <CartSheet
          open={open}
          announcement={open && announcement?.inDialog ? announcement.text : ''}
          onClose={() => setOpen(false)}
        />
      )}
    </OrderContext.Provider>
  )
}
