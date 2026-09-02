'use client'

/**
 * @fileoverview Warenkorb-Preise beim Öffnen gegen die API abgleichen.
 * @module @bakery/shop/feature-cart/use-fresh-cart-prices
 *
 * Der Warenkorb liegt mit Preis und Name im `localStorage` — so lange, bis die
 * Kundschaft ihn leert. Ändert sich in `hq` inzwischen ein Preis, zeigte die
 * Kasse den alten und der Server buchte den neuen; die Bestätigung nannte dann
 * ohne ein Wort eine andere Summe. Dieser Hook holt beim Öffnen von Warenkorb
 * und Kasse einmal die aktuellen Produkte, schreibt die Momentaufnahmen nach
 * und meldet, ob sich dabei ein Preis geändert hat.
 */

import React from 'react'

import { useCart } from '@bakery/shared/contexts'
import { fetchShopProducts, toCartProduct } from '@bakery/shared/data-access'

/** Der Hinweis, den Warenkorb und Kasse bei einer Preisänderung zeigen. */
export const PRICES_UPDATED_NOTICE =
  'Seit Ihrem letzten Besuch hat sich ein Preis geändert. Wir zeigen hier die aktuellen Preise.'

/**
 * Gleicht die Warenkorbzeilen einmal pro Seitenaufruf mit `GET /api/products`
 * ab. Ohne API bleibt es bei der Momentaufnahme — der Server prüft beim
 * Absenden ohnehin, und die Kasse meldet eine abweichende Summe dann über den
 * Bestätigungslink.
 *
 * @returns ob sich seit der Momentaufnahme ein Preis geändert hat
 */
export function useFreshCartPrices(): boolean {
  const { items, isLoading, refreshItems } = useCart()
  const [pricesUpdated, setPricesUpdated] = React.useState(false)
  /** Einmal je Seitenaufruf — sonst zöge jede Mengenänderung einen Request nach sich. */
  const started = React.useRef(false)
  const mounted = React.useRef(true)

  React.useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  React.useEffect(() => {
    if (started.current || isLoading || items.length === 0) return
    started.current = true

    fetchShopProducts()
      .then((products) => {
        if (!mounted.current) return
        setPricesUpdated(refreshItems(products.map(toCartProduct)))
      })
      .catch(() => undefined)
  }, [isLoading, items.length, refreshItems])

  return pricesUpdated
}
