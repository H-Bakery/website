'use client'
import React from 'react'
import Button from '@mui/material/Button'
import { EBENE, rand } from './theme'

export const UEBERSPRINGEN_TEXT = 'Überspringen'

export interface IntroKnopfProps {
  onClick: () => void
}

/**
 * Der eine Knopf während des Flugs zum Start: unten in der Mitte, in
 * Daumenreichweite - dort, wo danach die Blickpunkt-Leiste steht.
 */
export default function IntroKnopf({ onClick }: IntroKnopfProps) {
  return (
    <Button
      variant="contained"
      onClick={onClick}
      data-testid="intro-ueberspringen"
      sx={{
        position: 'fixed',
        zIndex: EBENE.leiste,
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: rand('bottom', 20),
        minHeight: 48,
        minWidth: 160,
        px: 3,
        borderRadius: 999,
        fontSize: '1rem',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        boxShadow: 4,
      }}
    >
      {UEBERSPRINGEN_TEXT}
    </Button>
  )
}
