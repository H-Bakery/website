import { formatGermanDate } from '@bakery/shop/feature-cart/pickup'
import { createWhatsAppLink } from '../../config/contact'
import { formatPrice } from '../../utils/formatPrice'
import { ORDER_CONFIG } from './order-config'

interface OrderMessage {
  items: ReadonlyArray<{ name: string; quantity: number; note?: string }>
  day: string
  time: string
  place: string
  name: string
  note?: string
  estimate: number | null
  reference: string
}

const invisible = new RegExp('[\\p{Default_Ignorable_Code_Point}\\p{Cs}]', 'gu')
const controls = new RegExp('[\\p{Cc}\\p{Zl}\\p{Zp}]+', 'gu')

function singleLine(value: string): string {
  return value.replace(invisible, '').replace(controls, ' ').trim()
}

/** Freitext auf eine Zeile bringen, damit die Feldgrenzen erhalten bleiben. */
export function orderLine(value: string): string {
  return singleLine(value).replace(/\s+/g, ' ')
}

export function buildOrderMessage(order: OrderMessage): string {
  const items = order.items.map(({ name, quantity, note }) => {
    const detail = orderLine(note ?? '')
    return `${quantity}× ${singleLine(name)}${detail ? ` – ${detail}` : ''}`
  })
  const note = orderLine(order.note ?? '')
  const estimate =
    order.estimate === null
      ? 'Summe offen (bezahlt wird bei Abholung)'
      : `Summe ca. ${orderLine(
          formatPrice(order.estimate)
        )} (bezahlt wird bei Abholung)`
  return [
    'Hallo, ich möchte vorbestellen:',
    '',
    ...items,
    '',
    `Abholung: ${formatGermanDate(order.day)}, ${order.time} Uhr`,
    `Abholort: ${orderLine(order.place)}`,
    `Name: ${orderLine(order.name)}`,
    ...(note ? [`Anmerkung: ${note}`] : []),
    '',
    ...(ORDER_CONFIG.showEstimate ? [estimate] : []),
    `Bestell-Nr. ${order.reference}`,
  ].join('\n')
}

export function orderWhatsAppLink(
  message: string,
  number?: string
): string | null {
  const url = createWhatsAppLink(message, number)
  return url.length < ORDER_CONFIG.maxWhatsAppUrlLength ? url : null
}

export function newOrderReference(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return `W-${Array.from(
    bytes,
    (byte) => alphabet[byte % alphabet.length]
  ).join('')}`
}
