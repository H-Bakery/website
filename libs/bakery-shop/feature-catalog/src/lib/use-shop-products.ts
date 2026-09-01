'use client'

/**
 * @fileoverview Laden der echten Produktdaten (API, ~103 hq-Produkte).
 *
 * Alle Katalogflächen benutzen diese Hooks – nie den `bakeryAPI`-Mock.
 */

import * as React from 'react'

import {
  fetchShopProduct,
  fetchShopProducts,
  type ShopProduct,
} from '@bakery/shared/data-access'

export type LoadStatus = 'loading' | 'ready' | 'error'

const FALLBACK_ERROR = 'Produkte konnten nicht geladen werden.'

function messageOf(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : FALLBACK_ERROR
}

export interface ShopProductsState {
  products: ShopProduct[]
  status: LoadStatus
  error: string | null
  /** Erneuter Versuch nach einem Fehler. */
  reload: () => void
}

/** Lädt das gesamte Sortiment. */
export function useShopProducts(): ShopProductsState {
  const [products, setProducts] = React.useState<ShopProduct[]>([])
  const [status, setStatus] = React.useState<LoadStatus>('loading')
  const [error, setError] = React.useState<string | null>(null)
  const [attempt, setAttempt] = React.useState(0)

  React.useEffect(() => {
    let active = true
    setStatus('loading')
    setError(null)

    fetchShopProducts()
      .then((list) => {
        if (!active) return
        setProducts(list)
        setStatus('ready')
      })
      .catch((err) => {
        if (!active) return
        setProducts([])
        setError(messageOf(err))
        setStatus('error')
      })

    return () => {
      active = false
    }
  }, [attempt])

  const reload = React.useCallback(() => setAttempt((n) => n + 1), [])

  return { products, status, error, reload }
}

export interface ShopProductState {
  product: ShopProduct | null
  status: LoadStatus
  /** `true`, wenn geladen wurde, es das Produkt aber nicht gibt. */
  notFound: boolean
  error: string | null
  reload: () => void
}

/** Lädt ein einzelnes Produkt über Slug-Id oder numerische Id. */
export function useShopProduct(idOrNumericId: string): ShopProductState {
  const [product, setProduct] = React.useState<ShopProduct | null>(null)
  const [status, setStatus] = React.useState<LoadStatus>('loading')
  const [notFound, setNotFound] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [attempt, setAttempt] = React.useState(0)

  React.useEffect(() => {
    let active = true
    setStatus('loading')
    setError(null)
    setNotFound(false)

    fetchShopProduct(idOrNumericId)
      .then((found) => {
        if (!active) return
        setProduct(found)
        setNotFound(found === null)
        setStatus('ready')
      })
      .catch((err) => {
        if (!active) return
        setProduct(null)
        setError(messageOf(err))
        setStatus('error')
      })

    return () => {
      active = false
    }
  }, [idOrNumericId, attempt])

  const reload = React.useCallback(() => setAttempt((n) => n + 1), [])

  return { product, status, notFound, error, reload }
}
