'use client'
import React from 'react'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import PlaceIcon from '@mui/icons-material/Place'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import type { BlickpunktKurz } from '../config/raeume'
import Quellen from './Quellen'
import { EBENE, LEISTE_EINZEILIG, TOUCH_TARGET, rand } from './theme'

export const ALLES_HIER_TEXT = 'Alles hier'

export interface BlickpunktLeisteProps {
  blickpunkte: BlickpunktKurz[]
  /** id des aktiven Blickpunkts */
  aktiv: string
  onWechsel: (id: string) => void
  /** Öffnet die Liste „Alles hier“. Ohne diese Funktion fehlt der Knopf. */
  onAllesHier?: () => void
}

/**
 * Die Bedienung unten in Daumenreichweite: ein Chip je Blickpunkt, „Alles
 * hier“ und „Quellen“; dazu Pfeile am linken und rechten Rand. Die Pfeile
 * laufen im Kreis (nach dem letzten Blickpunkt kommt wieder der erste).
 */
export default function BlickpunktLeiste({
  blickpunkte,
  aktiv,
  onWechsel,
  onAllesHier,
}: BlickpunktLeisteProps) {
  const index = blickpunkte.findIndex((b) => b.id === aktiv)
  const n = blickpunkte.length
  const nachbar = (schritt: number): BlickpunktKurz | undefined =>
    n > 1 && index >= 0 ? blickpunkte[(index + schritt + n) % n] : undefined
  const davor = nachbar(-1)
  const danach = nachbar(1)

  return (
    <>
      {davor && (
        <Pfeil
          seite="left"
          label={`Vorheriger Blickpunkt: ${davor.name}`}
          onClick={() => onWechsel(davor.id)}
        />
      )}
      {danach && (
        <Pfeil
          seite="right"
          label={`Nächster Blickpunkt: ${danach.name}`}
          onClick={() => onWechsel(danach.id)}
        />
      )}

      <Paper
        elevation={4}
        data-testid="blickpunkt-leiste"
        sx={{
          position: 'fixed',
          zIndex: EBENE.leiste,
          left: rand('left', 8),
          right: rand('right', 8),
          bottom: rand('bottom', 8),
          p: 0.75,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          borderRadius: 3,
          [LEISTE_EINZEILIG]: {
            flexDirection: 'row',
            alignItems: 'center',
            width: 'fit-content',
            maxWidth: 'calc(100% - 16px)',
            mx: 'auto',
            gap: 1,
          },
        }}
      >
        <Box component="nav" aria-label="Blickpunkte" sx={{ minWidth: 0 }}>
          <Box
            component="ul"
            sx={{ display: 'flex', gap: 0.5, m: 0, p: 0, listStyle: 'none' }}
          >
            {blickpunkte.map((b) => {
              const istAktiv = b.id === aktiv
              return (
                <Box
                  component="li"
                  key={b.id}
                  sx={{ flex: '1 1 0', minWidth: 0 }}
                >
                  <ButtonBase
                    onClick={() => onWechsel(b.id)}
                    aria-current={istAktiv ? 'true' : undefined}
                    focusRipple
                    sx={{
                      width: '100%',
                      minHeight: TOUCH_TARGET,
                      px: 1.25,
                      gap: 0.25,
                      borderRadius: 999,
                      border: '1px solid',
                      borderColor: istAktiv ? 'primary.main' : 'text.secondary',
                      bgcolor: istAktiv ? 'primary.main' : 'transparent',
                      color: istAktiv ? 'primary.contrastText' : 'text.primary',
                      fontSize: '0.9375rem',
                      fontWeight: istAktiv ? 700 : 500,
                      whiteSpace: 'nowrap',
                      '&:hover': istAktiv ? {} : { bgcolor: 'action.hover' },
                      '&.Mui-focusVisible': {
                        outline: '3px solid',
                        outlineColor: 'text.primary',
                        outlineOffset: 2,
                      },
                      [LEISTE_EINZEILIG]: { px: 2 },
                    }}
                  >
                    {/* Der aktive Chip ist nicht nur an der Farbe zu erkennen. */}
                    {istAktiv && (
                      <PlaceIcon aria-hidden sx={{ fontSize: 18, ml: -0.5 }} />
                    )}
                    {b.name}
                  </ButtonBase>
                </Box>
              )
            })}
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 0.5,
          }}
        >
          {onAllesHier && (
            <Button
              variant="outlined"
              onClick={onAllesHier}
              aria-haspopup="dialog"
              startIcon={<FormatListBulletedIcon aria-hidden />}
              sx={{ borderRadius: 999, whiteSpace: 'nowrap', px: 2 }}
            >
              {ALLES_HIER_TEXT}
            </Button>
          )}
          <Box sx={{ ml: 'auto' }}>
            <Quellen />
          </Box>
        </Box>
      </Paper>
    </>
  )
}

function Pfeil({
  seite,
  label,
  onClick,
}: {
  seite: 'left' | 'right'
  label: string
  onClick: () => void
}) {
  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        zIndex: EBENE.pfeile,
        top: '42%',
        [seite]: rand(seite, 8),
        transform: 'translateY(-50%)',
        borderRadius: '50%',
      }}
    >
      <IconButton
        aria-label={label}
        onClick={onClick}
        sx={{ width: 48, height: 48, color: 'text.primary' }}
      >
        {seite === 'left' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      </IconButton>
    </Paper>
  )
}
