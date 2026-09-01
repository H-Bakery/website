/**
 * @fileoverview Public API of `@bakery/shop/feature-cart`.
 *
 * Exactly three page components — the shop's cart, its real checkout and the
 * order confirmation. None of them renders Header/Footer; the app layout owns
 * the shop chrome.
 */

export { default as CartPage } from './lib/cart-page'
export { default as CheckoutPage } from './lib/checkout-page'
export { default as OrderConfirmation } from './lib/order-confirmation'
export type { OrderConfirmationProps } from './lib/order-confirmation'

/**
 * Öffnungszeiten der Bäckerei, abgeleitet aus demselben Wochenraster, das die
 * Kasse für die Abholzeiten benutzt. Wer sie anzeigt, importiert sie hier —
 * keine zweite Liste im Shop.
 */
export {
  OPENING_HOURS_ROWS,
  pickupStatusAt,
  type OpeningHoursRow,
  type NextPickup,
  type PickupStatus,
} from './lib/pickup'

/**
 * Vorbestellfrist. Ganze Torten und Kuchen werden auf Bestellung gebacken und
 * können nicht wie Thekenware in 60 Minuten abgeholt werden.
 */
export {
  earliestPickupIsoDate,
  isPortion,
  leadTimeRuleFor,
  leadTimeRuleForItems,
  type LeadTimeProduct,
  type LeadTimeRule,
} from './lib/lead-time'
