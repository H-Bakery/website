'use client'
import React from 'react'
import Paper from '@mui/material/Paper'
import { BEWEGUNG_OK, EBENE, LEISTE_EINZEILIG } from './theme'

export const HINWEIS_TEXT = 'Ziehen zum Umschauen · Tippen für Infos'

export interface HinweisProps {
  /** `false` nach der ersten Geste: der Hinweis blendet aus */
  sichtbar: boolean
}

/**
 * Kurzer Bedienhinweis über der Blickpunkt-Leiste. Fängt keine Berührungen
 * ab; blendet weich aus (ohne Bewegung: sofort).
 */
export default function Hinweis({ sichtbar }: HinweisProps) {
  return (
    <Paper
      elevation={3}
      data-testid="hinweis"
      data-sichtbar={sichtbar}
      aria-hidden={!sichtbar}
      sx={{
        position: 'fixed',
        zIndex: EBENE.hinweis,
        left: 0,
        right: 0,
        // über der zweizeiligen Leiste (Handy hochkant)
        bottom: 'calc(max(8px, env(safe-area-inset-bottom)) + 120px)',
        mx: 'auto',
        width: 'fit-content',
        maxWidth: 'calc(100% - 24px)',
        px: 2,
        py: 1,
        borderRadius: 999,
        fontSize: '0.9375rem',
        fontWeight: 500,
        textAlign: 'center',
        pointerEvents: 'none',
        opacity: sichtbar ? 1 : 0,
        visibility: sichtbar ? 'visible' : 'hidden',
        [BEWEGUNG_OK]: {
          transition: sichtbar
            ? 'opacity 300ms ease'
            : 'opacity 400ms ease, visibility 0s linear 400ms',
        },
        [LEISTE_EINZEILIG]: {
          bottom: 'calc(max(8px, env(safe-area-inset-bottom)) + 72px)',
        },
      }}
    >
      {HINWEIS_TEXT}
    </Paper>
  )
}
