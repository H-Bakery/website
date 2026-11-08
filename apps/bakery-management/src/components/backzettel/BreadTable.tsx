'use client'

import React from 'react'
import {
  Box,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import type {
  BackzettelConfigData,
  BackzettelLine,
  BackzettelUnit,
  BreadCell,
  BreadRow,
  BreadView,
} from '../../lib/backzettelApi'
import {
  bakeDayLabel,
  formatNumber,
  formatQty,
  formatSigned,
  kgText,
  lineLabel,
} from '../../lib/backzettelFormat'
import { CorrectionEditor } from './CorrectionEditor'
import { DeltaChip } from './BackzettelSectionView'

export interface V2EditProps {
  config: BackzettelConfigData | null
  /** Datum des Zettels (Teigtag). */
  sheetDate: string
  /** Alle Zeilen des Zettels nach Schlüssel (für Korrektur und Anzeige). */
  lineByKey: Map<string, BackzettelLine>
  editable: boolean
  editingKey: string | null
  /** Vorbelegung des Editors (z. B. „+1 Bruch“). */
  prefill?: number | null
  onEdit: (key: string | null, prefill?: number) => void
  onSaveCorrection: (
    line: BackzettelLine,
    correction: number,
    reason: string | null
  ) => Promise<void>
}

export interface BreadTableProps extends V2EditProps {
  bread: BreadView | null | undefined
}

const NUM = { textAlign: 'right' as const, whiteSpace: 'nowrap' as const }

function rowKg(row: BreadRow): string {
  // Alte Liter-Posten haben keinen Teig: keine kg-Angabe statt „unbekannt“.
  if (row.complete && row.kg === null) return ''
  return kgText(row)
}

/**
 * Menge ohne Größe mit Einheit: „26 Stück“, „7,25 l“ - eine Zahl ohne
 * Einheit unter einer Größenspalte läse sich wie Laibe dieser Größe.
 */
function singleQty(total: number, unit: string): string {
  const text = formatQty(total, unit as BackzettelUnit)
  return text === formatNumber(total) ? `${text} ${unit}` : text
}

function CellValue({
  cell,
  line,
  unit,
  label,
  editable,
  onEdit,
  single = false,
}: {
  cell: BreadCell
  line: BackzettelLine | undefined
  unit: string
  label: string
  editable: boolean
  onEdit: () => void
  /** Zeile ohne Größen: links, mit Einheit, über alle Größenspalten. */
  single?: boolean
}) {
  const correction = line?.correction ?? 0
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: single ? 'flex-start' : 'flex-end',
        flexWrap: 'wrap',
        gap: 0.5,
      }}
    >
      <Box sx={{ textAlign: single ? 'left' : 'right' }}>
        <Typography
          component="div"
          variant="h6"
          fontWeight={700}
          data-testid={`bread-cell-${cell.key}`}
        >
          {single
            ? singleQty(cell.total, unit)
            : formatQty(cell.total, unit as BackzettelUnit)}
        </Typography>
        {cell.baseUnset && (
          <Chip
            size="small"
            variant="outlined"
            label="offen"
            title="Grundmenge noch nicht festgelegt"
          />
        )}
        {correction !== 0 && (
          <Typography variant="caption" component="div" color="text.secondary">
            Korr. {formatSigned(correction)}
            {line?.correctionReason ? ` (${line.correctionReason})` : ''}
          </Typography>
        )}
        {line && <DeltaChip line={line} />}
      </Box>
      {editable && (
        <IconButton
          onClick={onEdit}
          aria-label={`Korrektur ${label} bearbeiten`}
          sx={{ width: 44, height: 44 }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  )
}

/**
 * Brot-Tabelle des Teigtag-Zettels (Z10, §7.2 Nr. 4): Zeilen = Brote,
 * Spalten = Laibgrößen, je Zelle die Laibe vom Server, korrigierbar mit dem
 * gewohnten Editor (Zeilenschlüssel). Dazu kg je Brot und der Hinweis des
 * Servers (gemeinsamer Teig, Anteil aus anderem Teig). Alte Liter-Posten und
 * Brote ohne Größe stehen als Zeile mit einer Zelle über alle Größenspalten,
 * links und mit Einheit („26 Stück“, „7,25 l“) - so steht die Zahl auch am
 * Handy ohne Wischen da und hängt an keiner Größe. Nachträge stehen als
 * Abzeichen an der Zelle.
 */
export function BreadTable({
  bread,
  config,
  sheetDate,
  lineByKey,
  editable,
  editingKey,
  prefill,
  onEdit,
  onSaveCorrection,
}: BreadTableProps) {
  if (!bread || bread.rows.length === 0) return null
  const sizes = bread.sizes
  const valueCols = Math.max(sizes.length, 1)
  const cols = valueCols + 2

  return (
    <Paper
      variant="outlined"
      sx={{ mb: 2, overflow: 'hidden' }}
      data-testid="bread-table"
    >
      <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
        <Typography variant="h6" component="h2">
          Brot
        </Typography>
      </Box>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label="Brot je Laibgröße">
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 140 }}>Brot</TableCell>
              {sizes.length > 0 ? (
                sizes.map((s) => (
                  <TableCell key={s.id} sx={{ ...NUM, minWidth: 96 }}>
                    {s.label}
                  </TableCell>
                ))
              ) : (
                <TableCell sx={NUM}>Menge</TableCell>
              )}
              <TableCell sx={{ ...NUM, minWidth: 80 }}>Teig</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {bread.rows.map((row) => {
              const cells: BreadCell[] = row.single
                ? [row.single]
                : sizes
                    .map((s) => row.cells[s.id])
                    .filter((c): c is BreadCell => !!c)
              const editingCell = cells.find((c) => c.key === editingKey)
              const editingLine = editingCell
                ? lineByKey.get(editingCell.key)
                : undefined
              const rowKey = `${row.bakeDate}|${row.itemId}`
              return (
                <React.Fragment key={rowKey}>
                  <TableRow data-testid={`bread-row-${row.itemId}`}>
                    <TableCell>
                      <Typography fontWeight={600}>{row.name}</Typography>
                      {row.bakeDate !== sheetDate && (
                        <Typography variant="caption" component="div">
                          {bakeDayLabel(row.bakeDate, sheetDate)}
                        </Typography>
                      )}
                      {row.note && (
                        <Typography
                          variant="caption"
                          component="div"
                          color="text.secondary"
                        >
                          {row.note}
                        </Typography>
                      )}
                    </TableCell>
                    {row.single ? (
                      <TableCell
                        colSpan={valueCols}
                        data-testid={`bread-single-${row.itemId}`}
                      >
                        <CellValue
                          single
                          cell={row.single}
                          line={lineByKey.get(row.single.key)}
                          unit={row.single.unit}
                          label={row.name}
                          editable={
                            editable &&
                            editingKey !== row.single.key &&
                            lineByKey.has(row.single.key)
                          }
                          onEdit={() => onEdit(row.single?.key ?? null)}
                        />
                      </TableCell>
                    ) : (
                      sizes.map((s) => {
                        const cell = row.cells[s.id]
                        if (!cell) {
                          // Diese Größe gibt es bei dem Brot nicht.
                          return <TableCell key={s.id} sx={NUM} />
                        }
                        const line = lineByKey.get(cell.key)
                        const label = line
                          ? lineLabel(line, config)
                          : `${row.name} – ${s.label}`
                        return (
                          <TableCell key={s.id} sx={NUM}>
                            <CellValue
                              cell={cell}
                              line={line}
                              unit={row.unit}
                              label={label}
                              editable={
                                editable && editingKey !== cell.key && !!line
                              }
                              onEdit={() => onEdit(cell.key)}
                            />
                          </TableCell>
                        )
                      })
                    )}
                    <TableCell sx={NUM}>
                      <Typography
                        component="span"
                        fontWeight={600}
                        data-testid={`bread-kg-${row.itemId}`}
                      >
                        {rowKg(row)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  {editingLine && (
                    <TableRow>
                      <TableCell
                        colSpan={cols}
                        sx={{ bgcolor: 'action.selected' }}
                      >
                        <CorrectionEditor
                          idPrefix="bread"
                          line={editingLine}
                          label={lineLabel(editingLine, config)}
                          initialCorrection={prefill ?? undefined}
                          onSave={(c, r) => onSaveCorrection(editingLine, c, r)}
                          onCancel={() => onEdit(null)}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}

export default BreadTable
