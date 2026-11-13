'use client'
import React, { useId, useState } from 'react'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { TOUCH_TARGET } from './theme'

export const RAUM_WECHSELN_TEXT = 'Raum wechseln'

/** Ein Raum, in den man wechseln kann: id und die Beschriftung seines Knopfs. */
export interface RaumZiel {
  id: string
  /** z. B. „In die Backstube“ (`wechsel` in raeume.ts) */
  wechsel: string
}

export interface RaumWechselProps {
  /** Die anderen Räume - ohne den, in dem man steht. Leer: kein Knopf. */
  ziele: readonly RaumZiel[]
  onWechsel: (id: string) => void
}

// Die Beschriftung darf umbrechen und der Knopf in die nächste Zeile der
// Leiste rutschen (BlickpunktLeiste): Auf schmalen Handys (320-360 px) passt
// „In die Backstube“ nicht neben „Alles hier“ und „Quellen“.
const KNOPF = {
  borderRadius: 999,
  px: 2,
  minHeight: TOUCH_TARGET,
  minWidth: 0,
  maxWidth: '100%',
  lineHeight: 1.2,
  textAlign: 'left',
} as const

/**
 * Der Wechsel in einen anderen Raum, unten in der Leiste (Daumenreichweite).
 * Gibt es genau einen anderen Raum, führt der Knopf direkt hinein („In die
 * Backstube“); bei mehreren öffnet „Raum wechseln“ die Auswahl. Ohne anderen
 * Raum gibt es ihn nicht.
 */
export default function RaumWechsel({ ziele, onWechsel }: RaumWechselProps) {
  const menueId = useId()
  const [anker, setAnker] = useState<HTMLElement | null>(null)

  if (ziele.length === 0) return null

  if (ziele.length === 1) {
    const [ziel] = ziele
    return (
      <Button
        variant="outlined"
        data-testid="raum-wechsel"
        onClick={() => onWechsel(ziel.id)}
        startIcon={<MeetingRoomIcon aria-hidden />}
        sx={KNOPF}
      >
        {ziel.wechsel}
      </Button>
    )
  }

  return (
    <>
      <Button
        variant="outlined"
        data-testid="raum-wechsel"
        onClick={(event) => setAnker(event.currentTarget)}
        aria-haspopup="menu"
        aria-controls={anker ? menueId : undefined}
        aria-expanded={anker ? 'true' : undefined}
        startIcon={<MeetingRoomIcon aria-hidden />}
        sx={KNOPF}
      >
        {RAUM_WECHSELN_TEXT}
      </Button>
      <Menu
        id={menueId}
        anchorEl={anker}
        open={anker !== null}
        onClose={() => setAnker(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {ziele.map((ziel) => (
          <MenuItem
            key={ziel.id}
            onClick={() => {
              setAnker(null)
              onWechsel(ziel.id)
            }}
            sx={{ minHeight: 48 }}
          >
            {ziel.wechsel}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
