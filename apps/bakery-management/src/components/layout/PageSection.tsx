'use client'
import React from 'react'
import { Box, Button, Collapse, Paper, Typography } from '@mui/material'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'

/**
 * Ein Abschnitt einer Seite (Layout-Kit, README.md): Überschrift (h2, bei
 * verschachtelten Abschnitten h3), höchstens eine Zeile Beschreibung,
 * optional Aktionen rechts und ein zuklappbarer „Details“-Teil für
 * Nebensächliches (Erklärungen, Annahmen, Rechenweg).
 *
 * `variant="card"` (Standard) setzt den Inhalt auf eine Fläche,
 * `variant="plain"` nur auf den Seitengrund (z. B. für eine Kartenliste, die
 * selbst Flächen hat). `disablePadding` lässt Tabellen bis an den Rand der
 * Karte laufen.
 */
export interface PageSectionProps {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  variant?: 'card' | 'plain'
  /** 2 = Abschnitt der Seite, 3 = Unterabschnitt in einem Abschnitt. */
  level?: 2 | 3
  /** Inhalt ohne Innenabstand (Tabellen, Listen bis an den Rand). */
  disablePadding?: boolean
  /** Nebensächliches - zugeklappt, öffnet sich auf Tipp. */
  details?: React.ReactNode
  /** Beschriftung des Details-Knopfs. Standard: „Details“. */
  detailsLabel?: string
  defaultDetailsOpen?: boolean
  children?: React.ReactNode
  id?: string
  'data-testid'?: string
}

export function PageSection({
  title,
  description,
  actions,
  variant = 'card',
  level = 2,
  disablePadding = false,
  details,
  detailsLabel = 'Details',
  defaultDetailsOpen = false,
  children,
  id,
  'data-testid': testId,
}: PageSectionProps) {
  const autoId = React.useId()
  const baseId = id ?? `section-${autoId.replace(/:/g, '')}`
  const headingId = `${baseId}-title`
  const detailsId = `${baseId}-details`
  const [detailsOpen, setDetailsOpen] = React.useState(defaultDetailsOpen)
  const card = variant === 'card'
  const pad = card ? { xs: 2, md: 3 } : 0
  const hasHead = Boolean(title || description || actions)

  const head = hasHead && (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        columnGap: 2,
        rowGap: 1,
        px: pad,
        pt: pad,
        pb: children || details ? (card ? 2 : 1.5) : pad,
      }}
    >
      <Box sx={{ minWidth: 0, flex: '1 1 16rem' }}>
        {title && (
          <Typography
            id={headingId}
            variant={level === 2 ? 'h2' : 'subtitle1'}
            component={level === 2 ? 'h2' : 'h3'}
            sx={level === 3 ? { fontWeight: 600 } : undefined}
          >
            {title}
          </Typography>
        )}
        {description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: title ? 0.5 : 0 }}
          >
            {description}
          </Typography>
        )}
      </Box>
      {actions && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
            '@media print': { display: 'none' },
          }}
        >
          {actions}
        </Box>
      )}
    </Box>
  )

  const body = (
    <>
      {head}
      {children !== undefined && children !== null && children !== false && (
        <Box
          sx={{
            px: disablePadding ? 0 : pad,
            pb: disablePadding ? 0 : pad,
            pt: hasHead || disablePadding ? 0 : pad,
            minWidth: 0,
          }}
        >
          {children}
        </Box>
      )}
      {details && (
        <Box
          sx={{
            px: pad,
            pb: card ? 1.5 : 0,
            pt: card ? 1 : 1,
            borderTop: card ? 1 : 0,
            borderColor: 'divider',
          }}
        >
          <Button
            size="small"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            aria-controls={detailsId}
            endIcon={
              <ExpandMoreIcon
                sx={{
                  transition: 'transform 0.2s',
                  transform: detailsOpen ? 'rotate(180deg)' : 'none',
                }}
              />
            }
            sx={{ ml: -1, '@media print': { display: 'none' } }}
          >
            {detailsLabel}
          </Button>
          <Collapse in={detailsOpen} id={detailsId}>
            <Box sx={{ pt: 1, pb: card ? 1 : 0 }}>{details}</Box>
          </Collapse>
        </Box>
      )}
    </>
  )

  return (
    <Box
      component="section"
      aria-labelledby={title ? headingId : undefined}
      data-testid={testId}
      sx={{ minWidth: 0 }}
    >
      {card ? <Paper sx={{ overflow: 'hidden' }}>{body}</Paper> : body}
    </Box>
  )
}

export default PageSection
