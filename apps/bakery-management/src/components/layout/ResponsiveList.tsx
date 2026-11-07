'use client'
import React from 'react'
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme, type Breakpoint } from '@mui/material/styles'

/**
 * Tabelle am PC, Karten am Handy (Layout-Kit, README.md).
 *
 * Breite Tabellen scrollten am Handy seitlich - die Aktionen am Zeilenende
 * lagen außer Sicht (Benutzer, Stationen, Sammelstelle). Unter `breakpoint`
 * (Standard `sm`, 600 px) steht deshalb je Zeile eine Karte: oben die
 * `primary`-Spalte mit den Aktionen rechts daneben, darunter in einer
 * umbrechenden Zeile die `inline`-Spalten (Chips, „PIN gesetzt“) und zuletzt
 * die übrigen als „Bezeichnung: Wert“. Es wird immer nur eine Form gerendert - `rowTestId`
 * gilt also für Zeile und Karte, Specs (jsdom: Desktop) bleiben gleich.
 *
 * Gedacht für den Inhalt einer `PageSection disablePadding`.
 */
export interface ResponsiveColumn<T> {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  align?: 'left' | 'right'
  /** Titel der Karte (genau eine Spalte). */
  primary?: boolean
  /** In der Karte weglassen (z. B. weil schon im Titel enthalten). */
  hideInCard?: boolean
  /**
   * In der Karte ohne Bezeichnung in einer Zeile neben den anderen
   * `inline`-Spalten - für selbsterklärende Werte (Chips).
   */
  inline?: boolean
  /** Eigener Inhalt in der Karte (z. B. „PIN gesetzt“ statt „gesetzt“). */
  cardCell?: (row: T) => React.ReactNode
}

export interface ResponsiveListProps<T> {
  rows: T[]
  columns: ResponsiveColumn<T>[]
  rowKey: (row: T) => React.Key
  rowTestId?: (row: T) => string
  /** Aktionen je Zeile (Tabelle: letzte Spalte, Karte: unten). */
  actions?: (row: T) => React.ReactNode
  actionsHeader?: React.ReactNode
  /** Text, wenn `rows` leer ist. */
  empty?: React.ReactNode
  /** Name der Tabelle für Screenreader. */
  'aria-label': string
  /** Unterhalb dieser Breite Karten. Standard `sm`. */
  breakpoint?: Breakpoint
  /** Gedimmte Zeile (z. B. deaktiviert, widerrufen) - mit `text.secondary`. */
  muted?: (row: T) => boolean
}

export function ResponsiveList<T>({
  rows,
  columns,
  rowKey,
  rowTestId,
  actions,
  actionsHeader = 'Aktionen',
  empty,
  'aria-label': ariaLabel,
  breakpoint = 'sm',
  muted,
}: ResponsiveListProps<T>) {
  const theme = useTheme()
  const compact = useMediaQuery(theme.breakpoints.down(breakpoint))

  if (compact) {
    if (rows.length === 0) {
      return (
        <Typography color="text.secondary" sx={{ p: 2 }}>
          {empty}
        </Typography>
      )
    }
    const primary = columns.find((c) => c.primary) ?? columns[0]
    const visible = columns.filter((c) => c !== primary && !c.hideInCard)
    const inline = visible.filter((c) => c.inline)
    const labelled = visible.filter((c) => !c.inline)
    const cardCell = (col: ResponsiveColumn<T>, row: T) =>
      (col.cardCell ?? col.cell)(row)
    return (
      <Box component="ul" aria-label={ariaLabel} sx={{ m: 0, p: 0 }}>
        {rows.map((row) => (
          <Box
            component="li"
            key={rowKey(row)}
            data-testid={rowTestId?.(row)}
            sx={{
              listStyle: 'none',
              px: 2,
              py: 1.5,
              '&:not(:last-of-type)': {
                borderBottom: 1,
                borderColor: 'divider',
              },
              color: muted?.(row) ? 'text.secondary' : undefined,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Box sx={{ minWidth: 0, pt: 0.5 }}>{primary.cell(row)}</Box>
              {actions && (
                <Box
                  sx={{
                    display: 'flex',
                    flexShrink: 0,
                    alignItems: 'center',
                    mr: -1,
                    mt: -0.5,
                  }}
                >
                  {actions(row)}
                </Box>
              )}
            </Box>
            {inline.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 1,
                  mt: 1,
                }}
              >
                {inline.map((col) => (
                  <Box key={col.key} sx={{ minWidth: 0 }}>
                    {cardCell(col, row)}
                  </Box>
                ))}
              </Box>
            )}
            {labelled.length > 0 && (
              <Box
                component="dl"
                sx={{
                  m: 0,
                  mt: 1,
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  columnGap: 1.5,
                  rowGap: 0.5,
                  alignItems: 'center',
                }}
              >
                {labelled.map((col) => (
                  <React.Fragment key={col.key}>
                    <Typography
                      component="dt"
                      variant="body2"
                      color="text.secondary"
                    >
                      {col.header}
                    </Typography>
                    <Typography
                      component="dd"
                      variant="body2"
                      sx={{ m: 0, minWidth: 0 }}
                    >
                      {cardCell(col, row)}
                    </Typography>
                  </React.Fragment>
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    )
  }

  const colSpan = columns.length + (actions ? 1 : 0)
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" aria-label={ariaLabel}>
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.key} align={col.align}>
                {col.header}
              </TableCell>
            ))}
            {actions && <TableCell align="right">{actionsHeader}</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan}>
                <Typography variant="body2" color="text.secondary">
                  {empty}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={rowKey(row)}
                data-testid={rowTestId?.(row)}
                sx={
                  muted?.(row)
                    ? { '& > td': { color: 'text.secondary' } }
                    : undefined
                }
              >
                {columns.map((col) => (
                  <TableCell key={col.key} align={col.align}>
                    {col.cell(row)}
                  </TableCell>
                ))}
                {actions && (
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {actions(row)}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default ResponsiveList
