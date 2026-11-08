'use client'

import React from 'react'
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha, type Theme } from '@mui/material/styles'
import EditIcon from '@mui/icons-material/Edit'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import type {
  BackzettelConfigData,
  BackzettelDeltaEntry,
  BackzettelLine,
  BackzettelSection,
} from '../../lib/backzettelApi'
import {
  deltaAfterDone,
  deltaAfterDoneText,
  formatNumber,
  formatOrDash,
  deltaBadgeText,
  minQtyText,
  formatSigned,
  lineLabel,
  previouslyDoneText,
} from '../../lib/backzettelFormat'
import { CorrectionEditor } from './CorrectionEditor'
import { PageSection } from '../layout'

export interface BackzettelSectionViewProps {
  section: BackzettelSection
  config: BackzettelConfigData | null
  /**
   * Nachträge des Tages: kamen sie nach dem Haken einer Zeile, ist sie
   * wieder offen (UI-Runde 1). Fehlt im Entwurf.
   */
  deltas?: BackzettelDeltaEntry[]
  /** Korrekturen erlaubt (Entwurf + Rolle inhaber/backstube). */
  editable: boolean
  editingKey: string | null
  onEdit: (key: string | null) => void
  onSaveCorrection: (
    line: BackzettelLine,
    correction: number,
    reason: string | null
  ) => Promise<void>
}

/**
 * Zeile mit offenen Nachträgen oder einem Nachtrag nach dem Haken: Rand +
 * leichte Warnfarbe, in beiden Modi lesbar.
 */
function deltaSx(line: BackzettelLine, reopened = false) {
  if (!reopened && (!line.delta || line.delta.open === 0)) return {}
  return {
    bgcolor: (t: Theme) => alpha(t.palette.warning.main, 0.14),
    boxShadow: (t: Theme) => `inset 4px 0 0 ${t.palette.warning.main}`,
  }
}

/** Abzeichen „Nachtrag +N“ einer Zeile (offen farbig, quittiert umrandet). */
export function DeltaChip({ line }: { line: BackzettelLine }) {
  if (!line.delta || line.delta.count === 0) return null
  const open = line.delta.open > 0
  return (
    <Chip
      size="small"
      color={open ? 'warning' : 'default'}
      variant={open ? 'filled' : 'outlined'}
      label={`${deltaBadgeText(line.delta, line.unit)}${
        open ? '' : ' · gesehen'
      }`}
      data-testid={`delta-chip-${line.key}`}
    />
  )
}

function BaseValue({ line }: { line: BackzettelLine }) {
  if (line.baseUnset) {
    return (
      <Chip
        size="small"
        variant="outlined"
        color="warning"
        label="offen"
        title="Grundmenge noch nicht festgelegt"
      />
    )
  }
  return <>{formatNumber(line.base)}</>
}

function LineName({
  line,
  config,
  deltas,
}: {
  line: BackzettelLine
  config: BackzettelConfigData | null
  deltas?: BackzettelDeltaEntry[]
}) {
  const after = deltaAfterDone(line, deltas ?? null)
  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography component="span" fontWeight={600}>
          {lineLabel(line, config)}
        </Typography>
        {line.doneAt && (
          <Tooltip
            title={`erledigt${
              line.doneBy ? ` von ${line.doneBy.displayName}` : ''
            }`}
          >
            <CheckCircleIcon
              fontSize="small"
              color="success"
              aria-label="erledigt"
            />
          </Tooltip>
        )}
        <DeltaChip line={line} />
      </Stack>
      {after && (
        <Typography
          variant="caption"
          component="div"
          data-testid={`after-done-${line.key}`}
          sx={{ fontWeight: 600, whiteSpace: 'normal' }}
        >
          {deltaAfterDoneText(line, after)}
        </Typography>
      )}
      {previouslyDoneText(line) && (
        <Typography
          variant="caption"
          component="div"
          data-testid={`previously-done-${line.key}`}
          sx={{ fontWeight: 600, whiteSpace: 'normal' }}
        >
          {previouslyDoneText(line)}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" component="div">
        {[
          line.unit && line.unit !== 'Stück' ? `in ${line.unit}` : null,
          line.tray,
          line.loavesEstimate ? `≈ ${line.loavesEstimate} Laibe` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Typography>
    </Box>
  )
}

function CorrectionValue({
  line,
  editable,
  onEdit,
  label,
}: {
  line: BackzettelLine
  editable: boolean
  onEdit: () => void
  label: string
}) {
  return (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      justifyContent="flex-end"
    >
      {/* Die Zelle erbt `nowrap` (NUM): der Grund muss ausdruecklich
          umbrechen, sonst laeuft er unter die Nachbarspalten (W4-Verifikation
          Runde 2). */}
      <Box sx={{ textAlign: 'right', minWidth: 0, flex: '1 1 auto' }}>
        <Typography component="span">
          {formatSigned(line.correction)}
        </Typography>
        {line.correctionClamped && (
          <Typography
            variant="caption"
            component="div"
            color="error"
            sx={{ whiteSpace: 'normal', fontWeight: 600 }}
          >
            größer als die Menge
          </Typography>
        )}
        {line.correctionReason && (
          <Typography
            variant="caption"
            color="text.secondary"
            component="div"
            sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}
            data-testid={`correction-reason-${line.key}`}
          >
            {line.correctionReason}
            {line.correctionBy ? ` (${line.correctionBy.displayName})` : ''}
          </Typography>
        )}
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
    </Stack>
  )
}

const NUM = {
  textAlign: 'right' as const,
  whiteSpace: 'nowrap' as const,
  fontVariantNumeric: 'tabular-nums',
}

/** Gesamt: die Zahl, nach der gebacken wird - groß, aber keine Überschrift. */
const TOTAL_SX = {
  fontSize: '1.25rem',
  fontWeight: 700,
  lineHeight: 1.3,
  fontVariantNumeric: 'tabular-nums',
}

/**
 * Herkunft einer Zeile für die Karte am Handy: nur Quellen mit Wert
 * („Basis 80 · Vorbestellt 20“) statt eines Rasters aus vier Feldern mit
 * drei Strichen. Basis steht immer da - „offen“ ist keine 0.
 */
function SourcesLine({ line }: { line: BackzettelLine }) {
  const parts: React.ReactNode[] = []
  const add = (label: string, value: number | null, signed = false) => {
    if (value === null || value === 0) return
    parts.push(
      <span key={label}>
        {label} {signed ? formatSigned(value) : formatNumber(value)}
      </span>
    )
  }
  add('Saison', line.seasonal, true)
  add('Vorbestellt', line.preorders)
  add('CAP', line.cap)
  return (
    <Typography
      variant="body2"
      color="text.secondary"
      component="div"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        // Lücke ≈ Leerzeichen: sonst stand vor jedem „·“ mehr Abstand als
        // dahinter (UI-Runde 1).
        columnGap: 0.5,
        rowGap: 0.5,
        mt: 0.5,
        '& > span + span::before': { content: '"· "' },
      }}
    >
      <span>
        Basis <BaseValue line={line} />
      </span>
      {parts}
    </Typography>
  )
}

/**
 * Ein Abschnitt des Backzettels (Brot, Brötchen, Hefeteig, …): ab `md` als
 * Tabelle Basis | Saison | Vorbestellt | CAP | Korrektur | Gesamt, darunter
 * als Kartenliste (Handy, Tablet hochkant). Beide stehen im DOM und werden per
 * CSS umgeschaltet - so gibt es weder Aufblitzen noch einen zweiten Datenstand.
 */
export function BackzettelSectionView({
  section,
  config,
  deltas,
  editable,
  editingKey,
  onEdit,
  onSaveCorrection,
}: BackzettelSectionViewProps) {
  const reopened = (line: BackzettelLine) =>
    (deltaAfterDone(line, deltas ?? null)?.bake ?? 0) > 0
  const save = (line: BackzettelLine) => (c: number, r: string | null) =>
    onSaveCorrection(line, c, r)

  return (
    <PageSection
      title={section.label}
      disablePadding
      data-testid={`section-${section.id}`}
    >
      {/* Tabelle ab md */}
      <TableContainer
        sx={{ display: { xs: 'none', md: 'block' } }}
        data-testid={`table-${section.id}`}
      >
        {/* Feste Spaltenbreiten: die Zahlen stehen in allen Abschnitten
            untereinander. */}
        <Table
          size="small"
          aria-label={`Backzettel ${section.label}`}
          sx={{ tableLayout: 'fixed' }}
        >
          <colgroup>
            <col style={{ width: '30%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '13%' }} />
          </colgroup>
          <TableHead>
            <TableRow>
              <TableCell>Posten</TableCell>
              <TableCell sx={NUM}>Basis</TableCell>
              <TableCell sx={NUM}>Saison</TableCell>
              <TableCell sx={NUM}>Vorbestellt</TableCell>
              <TableCell sx={NUM}>CAP</TableCell>
              <TableCell sx={NUM}>Korrektur</TableCell>
              <TableCell sx={NUM}>Gesamt</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {section.lines.map((line) => {
              const label = lineLabel(line, config)
              const editing = editingKey === line.key
              return (
                <React.Fragment key={line.key}>
                  <TableRow
                    data-testid={`line-row-${line.key}`}
                    sx={deltaSx(line, reopened(line))}
                  >
                    <TableCell>
                      <LineName line={line} config={config} deltas={deltas} />
                    </TableCell>
                    <TableCell sx={NUM}>
                      <BaseValue line={line} />
                    </TableCell>
                    <TableCell sx={NUM}>
                      {formatSigned(line.seasonal)}
                    </TableCell>
                    <TableCell sx={NUM}>
                      {formatOrDash(line.preorders)}
                    </TableCell>
                    <TableCell sx={NUM}>{formatOrDash(line.cap)}</TableCell>
                    <TableCell sx={NUM}>
                      <CorrectionValue
                        line={line}
                        label={label}
                        editable={editable && !editing}
                        onEdit={() => onEdit(line.key)}
                      />
                    </TableCell>
                    <TableCell sx={NUM}>
                      <Typography
                        component="span"
                        sx={TOTAL_SX}
                        data-testid={`line-total-${line.key}`}
                      >
                        {minQtyText(line, line.unit)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  {editing && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        sx={{ bgcolor: 'action.selected' }}
                      >
                        <CorrectionEditor
                          idPrefix="table"
                          line={line}
                          label={label}
                          onSave={save(line)}
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

      {/* Kartenliste unter md */}
      <Box
        sx={{ display: { xs: 'block', md: 'none' } }}
        data-testid={`cards-${section.id}`}
      >
        {section.lines.map((line, index) => {
          const label = lineLabel(line, config)
          const editing = editingKey === line.key
          return (
            <Box
              key={line.key}
              data-testid={`line-card-${line.key}`}
              sx={{
                px: 2,
                py: 1.5,
                borderTop: index === 0 ? 0 : 1,
                borderColor: 'divider',
                ...deltaSx(line, reopened(line)),
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="flex-start"
                justifyContent="space-between"
              >
                <LineName line={line} config={config} deltas={deltas} />
                <Typography
                  component="div"
                  sx={{ ...TOTAL_SX, fontSize: '1.5rem', whiteSpace: 'nowrap' }}
                  aria-label={`Gesamt ${label}`}
                >
                  {minQtyText(line, line.unit)}
                </Typography>
              </Stack>
              <SourcesLine line={line} />
              {(editable ||
                line.correction !== 0 ||
                line.correctionClamped) && (
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mt: 0.5, minHeight: editable ? 44 : 0 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2">
                      Korrektur: {formatSigned(line.correction)}
                      {line.correctionClamped && (
                        <Typography
                          component="span"
                          variant="body2"
                          color="error"
                          fontWeight={600}
                        >
                          {' '}
                          - größer als die Menge
                        </Typography>
                      )}
                    </Typography>
                    {line.correctionReason && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {line.correctionReason}
                        {line.correctionBy
                          ? ` (${line.correctionBy.displayName})`
                          : ''}
                      </Typography>
                    )}
                  </Box>
                  {editable && !editing && (
                    <IconButton
                      onClick={() => onEdit(line.key)}
                      aria-label={`Korrektur ${label} bearbeiten`}
                      sx={{ width: 44, height: 44 }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              )}
              {editing && (
                <CorrectionEditor
                  idPrefix="card"
                  line={line}
                  label={label}
                  onSave={save(line)}
                  onCancel={() => onEdit(null)}
                />
              )}
            </Box>
          )
        })}
      </Box>
    </PageSection>
  )
}

export default BackzettelSectionView
