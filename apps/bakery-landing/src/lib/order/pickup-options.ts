import {
  earliestPickupIsoDate,
  leadTimeRuleForItems,
  type LeadTimeProduct,
} from '@bakery/shop/feature-cart/lead-time'
import {
  openingWindowFor,
  PICKUP_LEAD_MINUTES,
  pickupTimeSlots,
  timeToMinutes,
  toIsoDate,
} from '@bakery/shop/feature-cart/pickup'
import { addDays, holidayName } from '../../config/holidays'
import { ORDER_CONFIG } from './order-config'

export interface PickupDay {
  date: string
  reason?: string
  timeHint?: string
  times: string[]
}

export type PickupClosures = Record<string, 'geschlossen' | 'sonderzeiten'>

// Terminangaben gelten am Laden, auch wenn das Gerät in einer anderen Zeitzone ist.
const storeClock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Berlin',
  dateStyle: 'short',
  timeStyle: 'medium',
})

export function pickupDays(
  now: Date,
  items: readonly LeadTimeProduct[],
  closures: PickupClosures
): PickupDay[] {
  const parts = storeClock.formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((entry) => entry.type === type)?.value)
  // Kalenderdatum als neutralen Träger für die Shop-Helfer mit lokalen Date-Gettern.
  const localDay = new Date(part('year'), part('month') - 1, part('day'), 12)
  const today = toIsoDate(localDay)
  const earliest = earliestPickupIsoDate(items, localDay)
  const lead = leadTimeRuleForItems(items)
  const currentTime = parts
    .filter(({ type }) => type === 'hour' || type === 'minute')
    .map(({ value }) => value)
    .join(':')
  const minutes = timeToMinutes(currentTime) ?? 0
  const cutoff = timeToMinutes(ORDER_CONFIG.nextDayCutoff ?? '')
  const firstMinute =
    minutes +
    (part('second') || now.getMilliseconds() ? 1 : 0) +
    PICKUP_LEAD_MINUTES

  return Array.from({ length: ORDER_CONFIG.pickupDays }, (_, offset) => {
    const date = addDays(today, offset)
    const holiday = holidayName(date)
    let reason: string | undefined
    if (holiday) reason = `Feiertag: ${holiday}`
    else if (closures[date] === 'geschlossen') reason = 'Laden geschlossen'
    else if (closures[date] === 'sonderzeiten')
      reason = 'Sonderöffnungszeiten. Bitte rufen Sie an.'
    else if (!openingWindowFor(date)) reason = 'Ruhetag'
    else if (date < earliest) reason = lead.reason
    else if (offset === 1 && cutoff !== null && minutes >= cutoff) {
      reason = `Bestellschluss für morgen war um ${ORDER_CONFIG.nextDayCutoff} Uhr.`
    }

    const times = reason
      ? []
      : pickupTimeSlots(date, offset === 0 ? firstMinute : 0)
    if (!reason && !times.length)
      reason = `Heute keine Abholzeit mehr verfügbar. Wir brauchen ${PICKUP_LEAD_MINUTES} Minuten Vorlauf.`
    const firstTime = times[0]
    const timeHint =
      offset === 0 && firstTime && firstTime !== pickupTimeSlots(date)[0]
        ? `Heute ab ${firstTime} Uhr – wir brauchen ${PICKUP_LEAD_MINUTES} Minuten Vorlauf.`
        : undefined
    return { date, reason, timeHint, times }
  })
}
