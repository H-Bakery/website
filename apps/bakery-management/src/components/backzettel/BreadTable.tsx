'use client'

import React from 'react'
import {
  Box,
  Chip,
  IconButton,
  Paper,
  Stack,
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
  minQtyText,
  baseOpenText,
} from '../../lib/backzettelFormat'
import {
  CorrectionEditor,
  type CorrectionSaveOptions,
} from './CorrectionEditor'
import { DeltaChip, tableFitSx } from './BackzettelSectionView'

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
    reason: string | null,
    options?: CorrectionSaveOptions
  ) => Promise<void>
}

export interface BreadTableProps extends V2EditProps {
  bread: BreadView | null | undefined
}

const NUM = { textAlign: 'right' as const, whiteSpace: 'nowrap' as const }
/**
 * Breite einer Mengen-Spalte: Zahl („≥ 12“, „7,25 L“) und der 44-px-Stift
 * stehen nebeneinander, nie der Stift unter der Zahl (Abschlussprüfung Z10).
 */
const VALUE_COL = { ...NUM, minWidth: 136 }
/** Spalte „Brot“ (Name, Backtag, Hinweis - bricht um). */
const NAME_COL_MIN = 140
/** Spalte „Teig“: „15,68 kg“ ohne Umbruch. */
const KG_COL = { ...NUM, minWidth: 96 }

/**
 * Breite, ab der die Brot-Tabelle neben sich nichts abschneidet (px, mit
 * Rahmen): Name + je Größe eine Mengen-Spalte (+ „Menge“) + Teig. Darunter
 * stehen die Karten (`tableFitSx`). Längere Inhalte (Abzeichen „Grundmenge
 * offen“, „44 Stück“ neben dem Stift) machen Spalten breiter - das misst
 * `BreadTable` nach und hebt die Grenze.
 */
export function breadTableMinWidth(
  bread: Pick<BreadView, 'sizes' | 'rows'>
): number {
  const hasSingle = bread.sizes.length === 0 || bread.rows.some((r) => r.single)
  const valueCols = bread.sizes.length + (hasSingle ? 1 : 0)
  return NAME_COL_MIN + valueCols * VALUE_COL.minWidth + KG_COL.minWidth + 2
}

function rowKg(row: BreadRow): string {
  // Alte Liter-Posten haben keinen Teig: keine kg-Angabe statt „unbekannt“.
  if (row.complete && row.kg === null) return ''
  return kgText(row)
}

/**
 * Menge ohne Größe mit Einheit: „26 Stück“, „7,25 l“ - eine Zahl ohne
 * Einheit läse sich wie Laibe einer Größe. Grundmenge offen: „≥ 4 Stück“.
 */
function singleQty(cell: BreadCell, unit: string): string {
  const text = minQtyText(cell, unit as BackzettelUnit)
  if (text === 'offen' || text === 'keine') return text
  const plain = formatQty(cell.total, unit as BackzettelUnit)
  return plain === formatNumber(cell.total) ? `${text} ${unit}` : text
}

function CellValue({
  cell,
  line,
  unit,
  label,
  editable,
  onEdit,
  single = false,
  testId,
}: {
  cell: BreadCell
  line: BackzettelLine | undefined
  unit: string
  label: string
  editable: boolean
  onEdit: () => void
  /** Zeile ohne Größen: Menge mit Einheit. */
  single?: boolean
  testId: string
}) {
  const correction = line?.correction ?? 0
  return (
    <Box
      data-testid={`${testId}-box`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        // Zahl und Stift bleiben auf einer Linie (schmale 500-g-Spalte)
        flexWrap: 'nowrap',
        gap: 0.5,
      }}
    >
      <Box sx={{ textAlign: 'right', minWidth: 0 }}>
        <Typography
          component="div"
          variant="h6"
          fontWeight={700}
          sx={{ whiteSpace: 'nowrap' }}
          data-testid={testId}
        >
          {/* Grundmenge offen: „≥ 4“ bzw. „offen“, nie die nackte Zahl */}
          {single
            ? singleQty(cell, unit)
            : minQtyText(cell, unit as BackzettelUnit)}
        </Typography>
        {cell.baseUnset && (
          <Chip
            size="small"
            variant="outlined"
            color={cell.dayDecision ? 'info' : 'default'}
            label={baseOpenText(cell)}
            title={
              cell.dayDecision
                ? 'Tagesentscheidung – die Grundmenge bleibt offen'
                : 'Grundmenge noch nicht festgelegt - bekannt sind nur Vorbestellungen und CAP'
            }
            data-testid={`${testId}-base-open`}
          />
        )}
        {correction !== 0 && (
          <Typography
            variant="caption"
            component="div"
            color="text.secondary"
            sx={{ overflowWrap: 'anywhere' }}
          >
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
          sx={{ width: 44, height: 44, flexShrink: 0 }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  )
}

/** Name, Backtag und Hinweis eines Brots (Tabelle und Karte). */
function RowName({ row, sheetDate }: { row: BreadRow; sheetDate: string }) {
  return (
    <>
      <Typography fontWeight={600}>{row.name}</Typography>
      {row.bakeDate !== sheetDate && (
        <Typography variant="caption" component="div">
          {bakeDayLabel(row.bakeDate, sheetDate)}
        </Typography>
      )}
      {row.note && (
        <Typography variant="caption" component="div" color="text.secondary">
          {row.note}
        </Typography>
      )}
    </>
  )
}

/** Die Zellen eines Brots mit Größe (Tabelle: je Spalte; Karte: Liste). */
function rowCells(
  row: BreadRow,
  sizes: BreadView['sizes']
): { size: { id: string; label: string } | null; cell: BreadCell }[] {
  if (row.single) return [{ size: null, cell: row.single }]
  return sizes
    .map((s) => ({ size: s, cell: row.cells[s.id] }))
    .filter(
      (x): x is { size: { id: string; label: string }; cell: BreadCell } =>
        Boolean(x.cell)
    )
}

/**
 * Brot-Tabelle des Teigtag-Zettels (Z10, §7.2 Nr. 4): Zeilen = Brote,
 * Spalten = Laibgrößen, je Zelle die Laibe vom Server, korrigierbar mit dem
 * gewohnten Editor (Zeilenschlüssel). Dazu kg je Brot und der Hinweis des
 * Servers (gemeinsamer Teig, Anteil aus anderem Teig). Alte Liter-Posten und
 * Brote ohne Größe stehen in einer eigenen Spalte „Menge“ mit Einheit („26
 * Stück“, „7,25 L“), rechtsbündig wie die übrigen Mengen - nie unter einer
 * Größenspalte, wo sie sich wie Laibe dieser Größe läse (Review Z10 Runde 2),
 * und nicht lose neben dem Namen (Abschlussprüfung). Passt die Tabelle in
 * die Breite des Inhalts (`breadTableMinWidth`, nachgemessen), eine Tabelle,
 * sonst je Brot eine Karte mit allen Größen - am Handy und am Tablet quer
 * neben der Seitenleiste fielen sonst Spalten aus dem Bild. Nachträge stehen
 * als Abzeichen an der Zelle.
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
  // Breiter als geschätzt (lange Abzeichen, Einheit neben dem Stift): die
  // sichtbare Tabelle läuft über ihren Rahmen hinaus. Dann gilt die
  // gemessene Breite als Grenze - die Karten übernehmen, statt dass Spalten
  // seitlich verschwinden. Gilt bis neue Daten kommen.
  const wrapRef = React.useRef<HTMLDivElement | null>(null)
  const tableRef = React.useRef<HTMLTableElement | null>(null)
  const [measured, setMeasured] = React.useState<{
    bread: BreadView
    width: number
  } | null>(null)
  React.useEffect(() => {
    const wrap = wrapRef.current
    const table = tableRef.current
    const box = table?.parentElement
    if (!bread || !wrap || !table || !box) return
    if (typeof ResizeObserver === 'undefined') return
    const check = () => {
      // Karten zu sehen: die Tabelle ist ausgeblendet, nichts zu messen.
      if (box.clientWidth === 0) return
      const overflow = table.scrollWidth - box.clientWidth
      if (overflow <= 1) return
      const width = Math.ceil(wrap.clientWidth + overflow)
      setMeasured((m) =>
        m && m.bread === bread && m.width >= width ? m : { bread, width }
      )
    }
    const observer = new ResizeObserver(check)
    observer.observe(box)
    observer.observe(table)
    return () => observer.disconnect()
  }, [bread])

  if (!bread || bread.rows.length === 0) return null
  const minWidth = Math.max(
    breadTableMinWidth(bread),
    measured && measured.bread === bread ? measured.width : 0
  )
  const fit = tableFitSx(minWidth)
  const sizes = bread.sizes
  // Spalte „Menge“ nur, wenn ein Brot ohne Größe auf dem Zettel steht
  // (ohne Größen überhaupt: die einzige Mengen-Spalte).
  const hasSingle = sizes.length === 0 || bread.rows.some((r) => r.single)
  const cols = sizes.length + (hasSingle ? 1 : 0) + 2
  const cellLabel = (
    row: BreadRow,
    size: { label: string } | null,
    key: string
  ) => {
    const line = lineByKey.get(key)
    if (line) return lineLabel(line, config)
    return size ? `${row.name} – ${size.label}` : row.name
  }
  const editor = (line: BackzettelLine, idPrefix: string) => (
    <CorrectionEditor
      idPrefix={idPrefix}
      line={line}
      label={lineLabel(line, config)}
      initialCorrection={prefill ?? undefined}
      onSave={(c, r, o) => onSaveCorrection(line, c, r, o)}
      onCancel={() => onEdit(null)}
    />
  )

  return (
    <Box
      ref={wrapRef}
      sx={{ ...fit.container, mb: 2 }}
      data-testid="bread-fit"
      data-table-min-width={minWidth}
    >
      <Paper
        variant="outlined"
        sx={{ overflow: 'hidden', ...fit.table }}
        data-testid="bread-table"
      >
        <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
          <Typography variant="h6" component="h2">
            Brot
          </Typography>
        </Box>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" aria-label="Brot je Laibgröße" ref={tableRef}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: NAME_COL_MIN }}>Brot</TableCell>
                {sizes.map((s) => (
                  <TableCell key={s.id} sx={VALUE_COL}>
                    {s.label}
                  </TableCell>
                ))}
                {hasSingle && <TableCell sx={VALUE_COL}>Menge</TableCell>}
                <TableCell sx={KG_COL}>Teig</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bread.rows.map((row) => {
                const cells = rowCells(row, sizes).map((x) => x.cell)
                const editingCell = cells.find((c) => c.key === editingKey)
                const editingLine = editingCell
                  ? lineByKey.get(editingCell.key)
                  : undefined
                const rowKey = `${row.bakeDate}|${row.itemId}`
                const single = row.single
                return (
                  <React.Fragment key={rowKey}>
                    <TableRow data-testid={`bread-row-${row.itemId}`}>
                      <TableCell>
                        <RowName row={row} sheetDate={sheetDate} />
                      </TableCell>
                      {single
                        ? // ohne Größe: die Größenspalten bleiben leer
                          sizes.length > 0 && (
                            <TableCell colSpan={sizes.length} />
                          )
                        : sizes.map((s) => {
                            const cell = row.cells[s.id]
                            if (!cell) {
                              // Diese Größe gibt es bei dem Brot nicht.
                              return <TableCell key={s.id} sx={VALUE_COL} />
                            }
                            const line = lineByKey.get(cell.key)
                            return (
                              <TableCell key={s.id} sx={VALUE_COL}>
                                <CellValue
                                  cell={cell}
                                  testId={`bread-cell-${cell.key}`}
                                  line={line}
                                  unit={row.unit}
                                  label={cellLabel(row, s, cell.key)}
                                  editable={
                                    editable &&
                                    editingKey !== cell.key &&
                                    !!line
                                  }
                                  onEdit={() => onEdit(cell.key)}
                                />
                              </TableCell>
                            )
                          })}
                      {hasSingle && (
                        <TableCell
                          sx={VALUE_COL}
                          data-testid={`bread-single-${row.itemId}`}
                        >
                          {single && (
                            <CellValue
                              single
                              cell={single}
                              testId={`bread-cell-${single.key}`}
                              line={lineByKey.get(single.key)}
                              unit={single.unit}
                              label={row.name}
                              editable={
                                editable &&
                                editingKey !== single.key &&
                                lineByKey.has(single.key)
                              }
                              onEdit={() => onEdit(single.key)}
                            />
                          )}
                        </TableCell>
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
                          {editor(editingLine, 'bread')}
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

      {/* Karten, wenn die Tabelle nicht passt: je Brot alle Größen
          untereinander, nichts seitlich außer Sicht */}
      <Paper
        variant="outlined"
        sx={{ overflow: 'hidden', ...fit.cards }}
        data-testid="bread-cards"
      >
        <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
          <Typography variant="h6" component="h2">
            Brot
          </Typography>
        </Box>
        {bread.rows.map((row, index) => {
          const entries = rowCells(row, sizes)
          const editingCell = entries.find((x) => x.cell.key === editingKey)
          const editingLine = editingCell
            ? lineByKey.get(editingCell.cell.key)
            : undefined
          const kg = rowKg(row)
          return (
            <Box
              key={`${row.bakeDate}|${row.itemId}`}
              data-testid={`bread-card-${row.itemId}`}
              sx={{
                px: 2,
                py: 1.5,
                borderTop: index === 0 ? 0 : 1,
                borderColor: 'divider',
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="flex-start"
                justifyContent="space-between"
              >
                <Box sx={{ minWidth: 0 }}>
                  <RowName row={row} sheetDate={sheetDate} />
                </Box>
                {kg && (
                  <Typography fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
                    Teig {kg}
                  </Typography>
                )}
              </Stack>
              {entries.map(({ size, cell }) => {
                const line = lineByKey.get(cell.key)
                return (
                  <Stack
                    key={cell.key}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={1}
                    sx={{ mt: 0.5, minHeight: 44 }}
                  >
                    <Typography color="text.secondary">
                      {size ? size.label : 'Menge'}
                    </Typography>
                    <CellValue
                      single={!size}
                      cell={cell}
                      testId={`bread-card-cell-${cell.key}`}
                      line={line}
                      unit={row.single ? row.single.unit : row.unit}
                      label={cellLabel(row, size, cell.key)}
                      editable={editable && editingKey !== cell.key && !!line}
                      onEdit={() => onEdit(cell.key)}
                    />
                  </Stack>
                )
              })}
              {editingLine && editor(editingLine, 'bread-card')}
            </Box>
          )
        })}
      </Paper>
    </Box>
  )
}

export default BreadTable
