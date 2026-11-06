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

/** Der Hinweis, wenn eine Zeile des Warenkorbs nicht mehr bestellbar ist. */
export const ITEMS_UNAVAILABLE_NOTICE =
  'Mindestens ein Artikel ist derzeit nicht erhältlich. Bitte entfernen Sie ihn - er ist in der Summe nicht enthalten.'

export interface FreshCartState {
  /** Seit der Momentaufnahme hat sich ein Preis geändert. */
  pricesUpdated: boolean
  /**
   * Warenkorbzeilen (Produkt-id), die laut API nicht mehr bestellbar sind:
   * `available: false` oder ganz aus dem Sortiment. Leer, solange die API
   * nicht geantwortet hat (Abschluss-Verifikation next: sie zählten sonst
   * in der Summe mit und gingen mit in die Bestellung).
   */
  unavailableIds: ReadonlySet<number>
}

const NONE: ReadonlySet<number> = new Set()

/**
 * Gleicht die Warenkorbzeilen einmal pro Seitenaufruf mit `GET /api/products`
 * ab. Ohne API bleibt es bei der Momentaufnahme — der Server prüft beim
 * Absenden ohnehin, und die Kasse meldet eine abweichende Summe dann über den
 * Bestätigungslink.
 *
 * @returns ob sich ein Preis geändert hat und welche Zeilen nicht mehr
 * erhältlich sind
 */
export function useFreshCartPrices(): FreshCartState {
  const { items, isLoading, refreshItems } = useCart()
  const [pricesUpdated, setPricesUpdated] = React.useState(false)
  const [unavailableIds, setUnavailableIds] =
    React.useState<ReadonlySet<number>>(NONE)
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
        const cartProducts = products.map(toCartProduct)
        const byId = new Map(cartProducts.map((p) => [p.id, p]))
        // Eine leere Liste ist eher ein Fehler als ein leeres Sortiment.
        if (byId.size > 0) {
          setUnavailableIds(
            new Set(
              items
                .filter((item) => {
                  const product = byId.get(item.id)
                  return !product || product.isActive === false
                })
                .map((item) => item.id)
            )
          )
        }
        setPricesUpdated(refreshItems(cartProducts))
      })
      .catch(() => undefined)
  }, [isLoading, items, refreshItems])

  return { pricesUpdated, unavailableIds }
}

/**
 * Summe ohne die nicht mehr erhältlichen Zeilen - was die Kundschaft
 * tatsächlich bestellen kann.
 */
export function availableTotal(
  total: number,
  items: ReadonlyArray<{ id: number; price: number; quantity: number }>,
  unavailableIds: ReadonlySet<number>
): number {
  const removed = items
    .filter((item) => unavailableIds.has(item.id))
    .reduce((sum, item) => sum + item.price * item.quantity, 0)
  return Math.max(0, Math.round((total - removed) * 100) / 100)
}
