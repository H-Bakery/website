'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { estimateCart } from '../../lib/order/cart-estimate'
import {
  CART_LIFETIME_MS,
  CART_STORAGE_KEY,
  emptyCart,
  readCart,
  writeCart,
  type CartState,
  type StoredCart,
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
  const storedRaw = useRef<string | null>(null)
  const [ready, setReady] = useState(false)
  const [notes, setNotes] = useState(() => new Map<string, string>())
  const [open, setOpen] = useState<boolean | null>(null)
  const [reference, setReference] = useState('')
  const [announcement, setAnnouncement] = useState<{
    text: string
    inDialog: boolean
  } | null>(null)
  const [expired, setExpired] = useState(false)
  const [draftVersion, setDraftVersion] = useState(0)

  const replaceCart = useCallback((next: CartState) => {
    cartRef.current = next
    setCart(next)
  }, [])

  const discardDraft = useCallback(() => {
    setNotes(new Map())
    setAnnouncement(null)
    setDraftVersion((version) => version + 1)
  }, [])

  const adoptStoredCart = useCallback(
    (stored: StoredCart) => {
      storedRaw.current = stored.raw
      replaceCart(stored.cart)
      discardDraft()
      setExpired(stored.expired)
      setReference(stored.cart.items.length ? newOrderReference() : '')
    },
    [discardDraft, replaceCart]
  )

  const refreshCart = useCallback(() => {
    const now = Date.now()
    const stored = readCart(now)
    if (stored && stored.raw !== storedRaw.current) {
      adoptStoredCart(stored)
      return true
    }

    const current = cartRef.current
    if (!current.items.length || current.expiresAt > now) return false
    // Eine Bereinigung im Speicher benutzt ausschließlich den dort gelesenen Stand.
    replaceCart({ ...current, items: [], expiresAt: 0 })
    discardDraft()
    setReference('')
    setExpired(true)
    return true
  }, [adoptStoredCart, discardDraft, replaceCart])

  useEffect(() => {
    const saved = readCart()
    if (saved) adoptStoredCart(saved)
    setReady(true)

    const onStorage = ({ key }: StorageEvent) => {
      if (key === CART_STORAGE_KEY || key === null) refreshCart()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', refreshCart)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', refreshCart)
    }
  }, [adoptStoredCart, refreshCart])

  useEffect(() => {
    if (!cart.expiresAt) return undefined

    let timer: number
    const scheduleExpiry = () => {
      const { expiresAt } = cartRef.current
      if (!expiresAt) return
      timer = window.setTimeout(() => {
        refreshCart()
        scheduleExpiry()
      }, Math.min(CART_LIFETIME_MS, Math.max(0, expiresAt - Date.now())))
    }
    scheduleExpiry()
    return () => window.clearTimeout(timer)
  }, [cart.expiresAt, refreshCart])

  function commit(next: CartState | null): boolean {
    const result = writeCart(next, storedRaw.current)
    if (result?.status === 'changed') {
      adoptStoredCart(result.snapshot)
      return false
    }
    if (result) storedRaw.current = result.raw
    replaceCart(next ?? emptyCart())
    return true
  }

  function announce(text: string, inDialog = Boolean(open)) {
    setAnnouncement({ text, inDialog })
  }

  function changeQuantity(id: string, change: number | 'remove') {
    if (refreshCart()) return
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
    if (
      !commit({
        ...current,
        items,
        expiresAt: items.length ? Date.now() + CART_LIFETIME_MS : 0,
      })
    )
      return

    setExpired(false)
    if (!quantity)
      setNotes((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    if (!items.length) setReference('')
    announce(
      quantity
        ? `${product?.name ?? 'Artikel'} im Korb, ${quantity} Stück`
        : `${product?.name ?? 'Artikel'} aus dem Korb entfernt`
    )
  }

  function clearCart() {
    if (!commit({ ...cartRef.current, items: [], expiresAt: 0 })) return false
    setNotes(new Map())
    setReference('')
    announce('Korb geleert', false)
    setExpired(false)
    return true
  }

  function forget() {
    if (!commit(null)) return false
    setNotes(new Map())
    setReference('')
    announce('Korb und Angaben gelöscht')
    setExpired(false)
    return true
  }

  function openCart() {
    refreshCart()
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
        draftVersion,
        refreshCart,
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
