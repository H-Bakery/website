'use client'
import React, { useId } from 'react'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import LadebildIllustration from './LadebildIllustration'
import { EBENE, rand } from './theme'

export const APP_NAME = 'Digitale Bäckerei'
export const LADE_TEXT = 'Der Laden wird geladen …'

export interface LadebildProps {
  /** 0…1; ohne Wert läuft die Anzeige ohne Prozentangabe */
  fortschritt?: number
}

/**
 * Deckt die Szene ab, bis das Modell steht: eine gezeichnete Theke, der Name
 * der App und der Fortschritt.
 */
export default function Ladebild({ fortschritt }: LadebildProps) {
  const textId = useId()
  const bekannt = typeof fortschritt === 'number' && !Number.isNaN(fortschritt)
  const prozent = bekannt
    ? Math.round(Math.min(Math.max(fortschritt, 0), 1) * 100)
    : undefined

  return (
    <Box
      data-testid="ladebild"
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: EBENE.ladebild,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        pt: rand('top', 16),
        pb: rand('bottom', 16),
        pl: rand('left', 16),
        pr: rand('right', 16),
        bgcolor: 'background.default',
        color: 'text.primary',
        textAlign: 'center',
        '@media (orientation: landscape) and (max-height: 500px)': {
          flexDirection: 'row',
          gap: 4,
        },
      }}
    >
      <Box
        sx={{
          width: 'min(100%, 420px)',
          aspectRatio: '400 / 260',
          flexShrink: 1,
          minHeight: 0,
          borderRadius: '20px',
          boxShadow: 3,
          lineHeight: 0,
          '@media (orientation: landscape) and (max-height: 500px)': {
            width: 'auto',
            height: 'min(100%, 260px)',
          },
        }}
      >
        <LadebildIllustration />
      </Box>

      <Box sx={{ width: 'min(100%, 320px)', flexShrink: 0 }}>
        <Typography
          component="p"
          sx={{ fontSize: '1.35rem', fontWeight: 700, lineHeight: 1.2 }}
        >
          {APP_NAME}
        </Typography>
        <Typography
          id={textId}
          role="status"
          component="p"
          color="text.secondary"
          sx={{ mt: 0.5, mb: 1.5 }}
        >
          {LADE_TEXT}
        </Typography>
        <LinearProgress
          variant={bekannt ? 'determinate' : 'indeterminate'}
          value={prozent}
          aria-labelledby={textId}
          sx={{
            height: 8,
            borderRadius: 4,
            // Ohne Bewegung: ein ruhiger, halb gefüllter Balken statt des Laufbands.
            '@media (prefers-reduced-motion: reduce)': bekannt
              ? { '& .MuiLinearProgress-bar': { transition: 'none' } }
              : {
                  '& .MuiLinearProgress-bar': { animation: 'none' },
                  '& .MuiLinearProgress-bar1Indeterminate': {
                    left: 0,
                    right: 0,
                    opacity: 0.5,
                  },
                  '& .MuiLinearProgress-bar2Indeterminate': { display: 'none' },
                },
          }}
        />
        {/* Der Balken trägt den Wert schon für Screenreader. */}
        <Typography
          component="p"
          variant="body2"
          color="text.secondary"
          aria-hidden
          data-testid="lade-prozent"
          sx={{ mt: 1, minHeight: '1.5em', fontVariantNumeric: 'tabular-nums' }}
        >
          {prozent === undefined ? '' : `${prozent} %`}
        </Typography>
      </Box>
    </Box>
  )
}
