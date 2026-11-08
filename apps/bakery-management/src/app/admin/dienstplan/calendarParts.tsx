'use client'
import React from 'react'
import Link from 'next/link'
import { Box, Chip, TableCell, TableRow, Typography } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import {
  ABSENCE_TYPES,
  ABSENCE_TYPE_LABELS,
  type AbsenceType,
  type Employee,
} from '../../../lib/dienstplanApi'
import { ColorDot } from './mitarbeiter/EmployeeDialog'
import { profileHref } from './mitarbeiter/MitarbeiterClient'
import { TOUCH_MEDIA } from '../../../lib/muiTheme'

/**
 * Bausteine, die Woche, Monat und Jahr des Dienstplans teilen: Farben der
 * Abwesenheiten, die stehenbleibende Namensspalte und die Legende.
 */

/** Farbe je Abwesenheitsart (Palette, damit Hell/Dunkel stimmen). */
export const ABSENCE_COLORS: Record<
  AbsenceType,
  'info' | 'success' | 'warning'
> = {
  urlaub: 'info',
  frei: 'success',
  abwesend: 'warning',
}

/** Kürzel je Art in den schmalen Tageszellen der Monatsansicht. */
export const ABSENCE_LETTERS: Record<AbsenceType, string> = {
  urlaub: 'U',
  frei: 'F',
  abwesend: 'A',
}

/**
 * Breite der Namensspalte (px): Handy schmaler, damit daneben noch etwas
 * vom Raster sichtbar ist.
 */
export const NAME_COLUMN_WIDTH = { xs: 116, sm: 170 } as const

/** MUI-Schleier für Elevation 1 im Dunkelmodus (`getOverlayAlpha(1)`). */
const PAPER_OVERLAY = 'rgba(255, 255, 255, 0.051)'

/**
 * Stehenbleibende Namensspalte. Sie braucht einen deckenden Grund; im
 * Dunkelmodus legt MUI über `Paper` (Elevation 1, die Fläche von
 * `PageSection`) einen hellen Schleier - den bekommt die Zelle auch, sonst
 * wäre sie dunkler als das Raster daneben.
 */
export function stickyName(theme: Theme) {
  return {
    position: 'sticky',
    left: 0,
    zIndex: 2,
    verticalAlign: 'top',
    bgcolor: 'background.paper',
    backgroundImage:
      theme.palette.mode === 'dark'
        ? `linear-gradient(${PAPER_OVERLAY}, ${PAPER_OVERLAY})`
        : 'none',
  } as const
}

/**
 * Zeilenkopf einer Person: Farbpunkt, Name als Link aufs Profil; `extra`
 * steht darunter (Jahr: der Rest am Handy).
 */
export function EmployeeNameCell({
  employee,
  extra,
}: {
  employee: Employee
  extra?: React.ReactNode
}) {
  return (
    <TableCell component="th" scope="row" sx={stickyName}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <ColorDot color={employee.color} />
        <Box
          component={Link}
          href={profileHref(employee.id)}
          sx={{
            typography: 'body2',
            color: 'text.primary',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            // Eigenes Touch-Ziel (Weg zum Profil): 44 px hoch, eine Zeile,
            // damit das Abschneiden mit „…“ bleibt.
            [TOUCH_MEDIA]: { minHeight: 44, lineHeight: '44px' },
          }}
        >
          {employee.displayName}
        </Box>
      </Box>
      {!employee.active && (
        <Chip
          size="small"
          variant="outlined"
          label="ausgeschieden"
          sx={{ mt: 0.5 }}
        />
      )}
      {extra}
    </TableCell>
  )
}

/** Gruppenzeile eines Bereichs („Verkauf (2)“), bleibt links stehen. */
export function AreaGroupRow({
  label,
  count,
  colSpan,
}: {
  label: string
  count: number
  colSpan: number
}) {
  return (
    <TableRow>
      <TableCell
        component="th"
        scope="rowgroup"
        colSpan={colSpan}
        sx={{
          typography: 'subtitle2',
          fontWeight: 600,
          py: 0.75,
          bgcolor: 'action.hover',
        }}
      >
        <Box
          component="span"
          sx={{ position: 'sticky', left: 8, display: 'inline-block' }}
        >
          {label} ({count})
        </Box>
      </TableCell>
    </TableRow>
  )
}

/**
 * Legende der Abwesenheiten (Farbe ist nie der einzige Träger: Kürzel,
 * Name und gestrichelt/gefüllt stehen dabei).
 */
export function AbsenceLegend({ letters = false }: { letters?: boolean }) {
  return (
    <Box
      data-testid="absence-legend"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1.5,
        px: { xs: 2, md: 3 },
        py: 1.5,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      {ABSENCE_TYPES.map((type) => (
        <LegendItem
          key={type}
          type={type}
          planned={false}
          text={`${letters ? `${ABSENCE_LETTERS[type]} = ` : ''}${
            ABSENCE_TYPE_LABELS[type]
          }`}
        />
      ))}
      <LegendItem type="urlaub" planned text="gestrichelt = geplant" />
    </Box>
  )
}

function LegendItem({
  type,
  planned,
  text,
}: {
  type: AbsenceType
  planned: boolean
  text: string
}) {
  const color = ABSENCE_COLORS[type]
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box
        aria-hidden
        sx={{
          width: 20,
          height: 12,
          borderRadius: 0.5,
          border: 2,
          borderStyle: planned ? 'dashed' : 'solid',
          borderColor: `${color}.main`,
          bgcolor: planned ? 'transparent' : `${color}.main`,
        }}
      />
      <Typography variant="caption">{text}</Typography>
    </Box>
  )
}
