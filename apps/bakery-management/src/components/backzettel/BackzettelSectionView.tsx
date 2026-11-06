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
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha, type Theme } from '@mui/material/styles'
import EditIcon from '@mui/icons-material/Edit'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import type {
  BackzettelConfigData,
  BackzettelLine,
  BackzettelSection,
} from '../../lib/backzettelApi'
import {
  formatNumber,
  formatOrDash,
  formatQty,
  formatSigned,
  lineLabel,
} from '../../lib/backzettelFormat'
import { CorrectionEditor } from './CorrectionEditor'

export interface BackzettelSectionViewProps {
  section: BackzettelSection
  config: BackzettelConfigData | null
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

/** Zeile mit offenen Nachträgen: Rand + leichte Warnfarbe, in beiden Modi lesbar. */
function deltaSx(line: BackzettelLine) {
  if (!line.delta || line.delta.open === 0) return {}
  return {
    bgcolor: (t: Theme) => alpha(t.palette.warning.main, 0.14),
    boxShadow: (t: Theme) => `inset 4px 0 0 ${t.palette.warning.main}`,
  }
}

function DeltaChip({ line }: { line: BackzettelLine }) {
  if (!line.delta || line.delta.count === 0) return null
  const open = line.delta.open > 0
  return (
    <Chip
      size="small"
      color={open ? 'warning' : 'default'}
      variant={open ? 'filled' : 'outlined'}
      label={`Nachtrag ${formatSigned(line.delta.qty)}${
        open ? '' : ' · quittiert'
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
}: {
  line: BackzettelLine
  config: BackzettelConfigData | null
}) {
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
      <Box sx={{ textAlign: 'right' }}>
        <Typography component="span">
          {formatSigned(line.correction)}
        </Typography>
        {line.correctionReason && (
          <Typography
            variant="caption"
            color="text.secondary"
            component="div"
            sx={{ maxWidth: 220, overflowWrap: 'anywhere' }}
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

const NUM = { textAlign: 'right' as const, whiteSpace: 'nowrap' as const }

/**
 * Ein Abschnitt des Backzettels (Brot, Brötchen, Hefeteig, …): ab `md` als
 * Tabelle Basis | Saison | Vorbestellt | CAP | Korrektur | Gesamt, darunter
 * als Kartenliste (Handy, Tablet hochkant). Beide stehen im DOM und werden per
 * CSS umgeschaltet - so gibt es weder Aufblitzen noch einen zweiten Datenstand.
 */
export function BackzettelSectionView({
  section,
  config,
  editable,
  editingKey,
  onEdit,
  onSaveCorrection,
}: BackzettelSectionViewProps) {
  const save = (line: BackzettelLine) => (c: number, r: string | null) =>
    onSaveCorrection(line, c, r)

  return (
    <Paper
      variant="outlined"
      sx={{ mb: 2, overflow: 'hidden' }}
      data-testid={`section-${section.id}`}
    >
      <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
        <Typography variant="h6" component="h2">
          {section.label}
        </Typography>
      </Box>

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
                    sx={deltaSx(line)}
                  >
                    <TableCell>
                      <LineName line={line} config={config} />
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
                        variant="h6"
                        fontWeight={700}
                        data-testid={`line-total-${line.key}`}
                      >
                        {formatQty(line.total, line.unit)}
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
                ...deltaSx(line),
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="flex-start"
                justifyContent="space-between"
              >
                <LineName line={line} config={config} />
                <Typography
                  variant="h5"
                  component="div"
                  fontWeight={700}
                  sx={{ whiteSpace: 'nowrap' }}
                  aria-label={`Gesamt ${label}`}
                >
                  {formatQty(line.total, line.unit)}
                </Typography>
              </Stack>
              <Box
                component="dl"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: 0.5,
                  m: 0,
                  mt: 1,
                  '& dt': { typography: 'caption', color: 'text.secondary' },
                  '& dd': { m: 0, typography: 'body2' },
                }}
              >
                <div>
                  <dt>Basis</dt>
                  <dd>
                    <BaseValue line={line} />
                  </dd>
                </div>
                <div>
                  <dt>Saison</dt>
                  <dd>{formatSigned(line.seasonal)}</dd>
                </div>
                <div>
                  <dt>Vorbest.</dt>
                  <dd>{formatOrDash(line.preorders)}</dd>
                </div>
                <div>
                  <dt>CAP</dt>
                  <dd>{formatOrDash(line.cap)}</dd>
                </div>
              </Box>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mt: 0.5, minHeight: 44 }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2">
                    Korrektur: {formatSigned(line.correction)}
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
    </Paper>
  )
}

export default BackzettelSectionView
