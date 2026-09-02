/**
 * @fileoverview Money helpers shared by the cart and the checkout.
 * @module @bakery/shop/feature-cart/order-totals
 */

import type { CartSummary } from '@bakery/shared/contexts'

/**
 * The amount the customer actually pays.
 *
 * German retail prices are **gross** — every price in `hq/products/*.md` is
 * already inkl. MwSt. The shop therefore mounts `CartProvider` with
 * `taxRate={0}`, which makes `summary.tax` zero and `summary.total` correct.
 * We still derive the total from `subtotal - discount` rather than reading
 * `summary.total`, so that a provider misconfigured with a tax rate could never
 * silently add 19 % on top of prices that already contain it.
 */
export function grossTotal(summary: CartSummary): number {
  return Math.max(0, summary.subtotal - summary.discount)
}

/** Beträge sind Cent — Gleitkomma-Rauschen unter einem halben Cent ist keine Abweichung. */
export function sameCents(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005
}
