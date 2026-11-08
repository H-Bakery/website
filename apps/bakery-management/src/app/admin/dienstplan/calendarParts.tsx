'use client'
import React from 'react'
import Link from 'next/link'
import { Box, Chip, TableCell, TableRow, Typography } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import {
  ABSENCE_TYPES,
  ABSENCE_TYPE_LABELS,
  formatDays,
  type AbsenceType,
  type Employee,
  type PlannedHours,
} from '../../../lib/dienstplanApi'
import { hoursTexts } from '../../../lib/dienstplanCalendar'
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

/**
 * Breite der Stundenspalte (px) in Woche und Monat - ganz rechts, damit das
 * Raster vorne bleibt; am Handy steht die Differenz zusätzlich unter dem
 * Namen (`PhoneHours`).
 */
export const HOURS_COLUMN_WIDTH = 112

/** Kopf der Stundenspalte. */
export function HoursHeaderCell({ periodLabel }: { periodLabel: string }) {
  return (
    <TableCell
      data-testid="hours-header"
      sx={{ verticalAlign: 'top', width: HOURS_COLUMN_WIDTH }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        Stunden
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {periodLabel}: Plan, Soll, Plan − Soll
      </Typography>
    </TableCell>
  )
}

/**
 * Stunden einer Person im Zeitraum: Plan, Soll („offen“ ohne
 * Wochenstunden, nie 0) und die Differenz mit Vorzeichen - als Text.
 * Gerechnet hat die API (`plannedHours` in `vacation.core.js`).
 */
export function HoursCell({
  employeeId,
  hours,
}: {
  employeeId: number
  hours: PlannedHours | undefined
}) {
  if (!hours) {
    return <TableCell data-testid={`hours-${employeeId}`}>–</TableCell>
  }
  const t = hoursTexts(hours)
  const credited =
    hours.targetMinutes !== null && hours.creditedDays > 0
      ? `ohne ${formatDays(hours.creditedDays)} ${
          hours.creditedDays === 1 ? 'Tag' : 'Tage'
        } Urlaub/abwesend`
      : null
  return (
    <TableCell
      data-testid={`hours-${employeeId}`}
      sx={{
        verticalAlign: 'top',
        py: 0.5,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <Typography variant="caption" display="block">
        Plan {t.plan}
      </Typography>
      <Typography variant="caption" display="block" color="text.secondary">
        Soll {t.target}
      </Typography>
      {credited && (
        <Typography
          variant="caption"
          display="block"
          color="text.secondary"
          sx={{ overflowWrap: 'anywhere' }}
        >
          {credited}
        </Typography>
      )}
      {t.diff && (
        <Typography
          variant="caption"
          display="block"
          data-sign={t.sign}
          aria-label={`Plan − Soll ${t.diff}`}
          sx={{ fontWeight: 600 }}
        >
          {t.diff}
        </Typography>
      )}
    </TableCell>
  )
}

/** Am Handy (unter `sm`) Plan und Differenz unter dem Namen. */
export function PhoneHours({
  employeeId,
  hours,
}: {
  employeeId: number
  hours: PlannedHours | undefined
}) {
  if (!hours) return null
  const t = hoursTexts(hours)
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      data-testid={`phone-hours-${employeeId}`}
      sx={{ display: { xs: 'block', sm: 'none' } }}
    >
      Plan {t.plan} · {t.diff ?? 'Soll offen'}
    </Typography>
  )
}
