'use client'

/**
 * @fileoverview „Kann ich das jetzt überhaupt holen?“ — beantwortet auf der
 * Startseite, nicht erst an der Kasse.
 *
 * Das ist der einzige ehrliche Dringlichkeitshebel, den dieser Shop hat. Er
 * rechnet mit {@link pickupStatusAt} über dasselbe Wochenraster wie die Kasse,
 * kann also keinen Termin versprechen, den die Kasse danach ablehnt. Erfundene
 * Knappheit („nur noch 3 verfügbar“, Countdown) gibt es hier bewusst nicht:
 * es existieren keine Bestandsdaten, und ausgedachte Kaufanreize sind
 * unlauter (§ 5 UWG).
 */

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { pickupStatusAt, type PickupStatus } from '@bakery/shop/feature-cart'

import { SURFACE_RADIUS } from './storefront-rhythm'

/**
 * Liest den Abholstatus **nach** dem Mount.
 *
 * `new Date()` während des Renderns liefert auf Server und Client verschiedene
 * Werte — das bricht die Hydration. Vor dem Mount also `null`.
 */
export function usePickupStatus(): PickupStatus | null {
  const [status, setStatus] = React.useState<PickupStatus | null>(null)

  React.useEffect(() => {
    const update = () => setStatus(pickupStatusAt(new Date()))
    update()
    // Eine Minute Takt: der Wechsel „geöffnet → geschlossen“ soll auf einer
    // offen liegenden Seite nicht stehen bleiben.
    const timer = setInterval(update, 60_000)
    return () => clearInterval(timer)
  }, [])

  return status
}

/** Die Statuszeile in Worten. */
export function pickupStatusText(status: PickupStatus): {
  headline: string
  detail: string
} {
  const headline = status.isOpenNow
    ? `Jetzt geöffnet – noch bis ${status.closesAt} Uhr`
    : 'Gerade geschlossen'

  if (!status.next) {
    return { headline, detail: 'Abholtermine finden Sie an der Kasse.' }
  }

  const when = status.next.isToday
    ? `heute ab ${status.next.time} Uhr`
    : `${status.next.weekday} ab ${status.next.time} Uhr`

  return { headline, detail: `Nächste Abholung: ${when}` }
}

/**
 * Der Punkt links vom Status. Die Farbe ist **nicht** das einzige Signal —
 * der Text daneben sagt dasselbe in Worten (WCAG 1.4.1).
 */
const DOT_SIZE = 9

/**
 * Schwebende Statuskarte über dem Hero-Foto.
 *
 * Hält vor dem Mount ihre Höhe frei, damit das Foto nicht springt, wenn die
 * Zeit nachgereicht wird. Die Höhe unten ist gerechnet, nicht geraten:
 * 2 × 14 px Innenabstand + 24 px `subtitle1` + 2 px + 24 px `body2` = 78.
 */
export function PickupStatusCard() {
  const status = usePickupStatus()
  const text = status ? pickupStatusText(status) : null

  return (
    <Box
      data-testid="pickup-status"
      aria-live="polite"
      sx={{
        minHeight: 78,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        px: 2.25,
        py: 1.75,
        borderRadius: SURFACE_RADIUS,
        bgcolor: 'background.paper',
        boxShadow: 8,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {text ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              aria-hidden="true"
              sx={{
                width: DOT_SIZE,
                height: DOT_SIZE,
                borderRadius: '50%',
                flexShrink: 0,
                bgcolor: status?.isOpenNow ? 'success.main' : 'text.disabled',
              }}
            />
            {/* Fließschrift, nicht Cinzel: die Kapitälchen der Display-Serife
                sind bei 1 rem schlechter zu erfassen als eine Fließzeile. */}
            <Typography
              variant="subtitle1"
              component="p"
              sx={{ color: 'text.primary' }}
            >
              {text.headline}
            </Typography>
          </Box>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mt: 0.25,
              // Fluchtet mit der Überschrift: Punkt + Abstand.
              pl: `${DOT_SIZE + 10}px`,
            }}
          >
            {text.detail}
          </Typography>
        </>
      ) : null}
    </Box>
  )
}

export default PickupStatusCard
