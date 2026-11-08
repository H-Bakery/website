'use client'

import React from 'react'
import { Alert, AlertTitle, Box, Button, Collapse } from '@mui/material'

/** So viele Hinweise stehen offen da; der Rest hinter „Alle anzeigen“. */
export const WARNINGS_SHOWN = 2

export interface BackzettelWarningsProps {
  warnings: { code: string; message: string }[]
  /** Tablet (`/backstube`): größere Schrift, 56-px-Knopf. */
  large?: boolean
  'data-testid'?: string
}

/**
 * Hinweise des Tages (offene Grundmengen, Vorbestellungen ohne Posten …):
 * die ersten zwei sichtbar, der Rest aufklappbar - sechs Zeilen Gelb über dem
 * Zettel drängten die Mengen am Handy aus dem Bild (Layout-Kit: höchstens
 * zwei Hinweise oben). Weg ist keiner: die Zahl steht im Titel.
 *
 * Immer `warning`, auf der Planungsseite wie am Tablet (UI-Runde 1: dort
 * standen sie blau als „Info“ ganz unten - 52 vorbestellte Brötchen ohne
 * Posten backt sonst niemand).
 */
export function BackzettelWarnings({
  warnings,
  large = false,
  'data-testid': testId = 'warnings',
}: BackzettelWarningsProps) {
  const [open, setOpen] = React.useState(false)
  const id = React.useId()
  if (warnings.length === 0) return null
  const first = warnings.slice(0, WARNINGS_SHOWN)
  const rest = warnings.slice(WARNINGS_SHOWN)
  return (
    <Alert
      severity="warning"
      data-testid={testId}
      sx={large ? { fontSize: '1.05rem' } : undefined}
    >
      <AlertTitle sx={large ? { fontSize: '1.2rem', fontWeight: 700 } : {}}>
        {warnings.length === 1 ? 'Hinweis' : `Hinweise (${warnings.length})`}
      </AlertTitle>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {first.map((w, i) => (
          <li key={`${w.code}-${i}`}>{w.message}</li>
        ))}
      </Box>
      {rest.length > 0 && (
        <>
          <Collapse in={open} id={id}>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {rest.map((w, i) => (
                <li key={`${w.code}-more-${i}`}>{w.message}</li>
              ))}
            </Box>
          </Collapse>
          <Button
            size={large ? 'large' : 'small'}
            color="inherit"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={id}
            data-print="hide"
            sx={{
              mt: 0.5,
              px: 0,
              minHeight: large ? 56 : 36,
              fontSize: large ? '1.05rem' : undefined,
              textTransform: 'none',
              textDecoration: 'underline',
            }}
          >
            {open ? 'Weniger anzeigen' : `Alle ${warnings.length} anzeigen`}
          </Button>
        </>
      )}
    </Alert>
  )
}

export default BackzettelWarnings
