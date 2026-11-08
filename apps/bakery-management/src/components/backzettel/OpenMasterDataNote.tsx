'use client'

import React from 'react'
import { Box, Button, Paper, Typography } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import type { OpenMasterData } from '../../lib/backzettelApi'

export interface OpenMasterDataNoteProps {
  open: OpenMasterData[] | null | undefined
  /** Eindeutiger Präfix für die Testkennungen (Zettel, Grundmengen). */
  id?: string
  /** Zu Beginn aufgeklappt. */
  defaultExpanded?: boolean
}

/**
 * „Offene Stammdaten (n)“ (Z10): welche Werte in `hq/config/backzettel.yaml`
 * noch `null` sind und deshalb auf dem Zettel als „unbekannt“/„–“ stehen.
 * Information, keine Warnung - die App rechnet nichts davon aus, und
 * eintragen lässt es sich nur in hq (der Fragebogen füllt sie).
 */
export function OpenMasterDataNote({
  open,
  id = 'open-master-data',
  defaultExpanded = false,
}: OpenMasterDataNoteProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded)
  const list = open ?? []
  if (list.length === 0) return null
  const panelId = `${id}-list`
  return (
    <Paper variant="outlined" data-testid={id} sx={{ mb: 2, px: 2, py: 1 }}>
      <Button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
        color="inherit"
        startIcon={<InfoOutlinedIcon />}
        endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{
          minHeight: 44,
          textTransform: 'none',
          fontWeight: 600,
          px: 0.5,
          justifyContent: 'flex-start',
        }}
      >
        Offene Stammdaten ({list.length})
      </Button>
      {expanded && (
        <Box id={panelId}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Diese Werte stehen in den Stammdaten noch nicht fest. Was davon
            abhängt, zeigt der Zettel als „unbekannt“ bzw. „–“ – geschätzt wird
            nichts. Eintragen lassen sie sich nur in hq.
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {list.map((o) => (
              <li key={o.path}>
                <Typography variant="body2" component="span">
                  {o.message}
                </Typography>
              </li>
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  )
}

export default OpenMasterDataNote
