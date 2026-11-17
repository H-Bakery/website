'use client'
import React from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import { BEWEGUNG_OK, EBENE, MIT_MAUS, ueberDerLeiste } from './theme'

/** Der Bedienhinweis auf dem Handy (Touch) - und überall, wo keine Maus ist. */
export const HINWEIS_TEXT = 'Ziehen zum Umschauen · Tippen für Infos'
/** Derselbe Hinweis mit der Maus: Dort tippt man nicht, man klickt. */
export const HINWEIS_TEXT_MAUS = 'Ziehen zum Umschauen · Klicken für Infos'

export interface HinweisProps {
  /** `false` nach der ersten Geste: der Hinweis blendet aus */
  sichtbar: boolean
  /** Anderer Text als der Bedienhinweis, z. B. für einen Bereich ohne Produktinfos. */
  text?: string
}

/**
 * Kurzer Bedienhinweis über der Blickpunkt-Leiste (über ihrer gemessenen
 * Höhe, wie viele Zeilen sie auch hat). Fängt keine Berührungen ab; blendet
 * weich aus (ohne Bewegung: sofort). Ohne eigenen Text nennt er die
 * Bedienung des Geräts: Tippen, mit der Maus Klicken - allein per CSS.
 */
export default function Hinweis({ sichtbar, text }: HinweisProps) {
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
        bottom: ueberDerLeiste(16),
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
      }}
    >
      {text ?? (
        <>
          <Box
            component="span"
            data-testid="hinweis-touch"
            sx={{ [MIT_MAUS]: { display: 'none' } }}
          >
            {HINWEIS_TEXT}
          </Box>
          <Box
            component="span"
            data-testid="hinweis-maus"
            sx={{ display: 'none', [MIT_MAUS]: { display: 'inline' } }}
          >
            {HINWEIS_TEXT_MAUS}
          </Box>
        </>
      )}
    </Paper>
  )
}
