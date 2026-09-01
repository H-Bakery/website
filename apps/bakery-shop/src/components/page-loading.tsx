'use client'

import React from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

/**
 * Ladeanzeige für Seiten, die auf Daten oder Query-Parameter warten.
 * Hält die Höhe stabil, damit die Fußzeile nicht hochspringt.
 */
export function PageLoading({ label = 'Wird geladen …' }: { label?: string }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      data-testid="page-loading"
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '50vh',
      }}
    >
      <CircularProgress aria-label={label} />
    </Box>
  )
}

export default PageLoading
