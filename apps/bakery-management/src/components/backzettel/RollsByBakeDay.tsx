'use client'

import React from 'react'
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import type { BruchGroup, RollsBlock, SingleRow } from '../../lib/backzettelApi'
import {
  bakeDayLabel,
  bruchGroupText,
  bruchKgText,
  bruchStep,
  formatKnown,
  formatNumber,
  lineBreakdown,
  lineLabel,
  linesByKey,
  minQtyText,
  v2CoveredKeys,
} from '../../lib/backzettelFormat'
import { CorrectionEditor } from './CorrectionEditor'
import { DayDecisionChip, DeltaChip } from './BackzettelSectionView'
import type { V2EditProps } from './BreadTable'

export interface RollsByBakeDayProps extends V2EditProps {
  rolls: RollsBlock[] | null | undefined
}

/** Eine Brötchen-Zeile (Mitglied einer Bruch-Gruppe oder Einzelstück). */
function RollLine({
  lineKey,
  name,
  qty,
  detail,
  step,
  props,
}: {
  lineKey: string
  name: string
  /** Menge; mit `totalIsMinimum` (Grundmenge offen) „≥ n“ bzw. „offen“. */
  qty: {
    total: number | null
    totalIsMinimum?: boolean
    dayDecision?: 'none' | 'amount'
  }
  detail?: string | null
  /** Stück je Bruch für „+1 Bruch“; `null` = kein Knopf. */
  step: number | null
  props: V2EditProps
}) {
  const { config, lineByKey, editable, editingKey, prefill, onEdit } = props
  const line = lineByKey.get(lineKey)
  const editing = editingKey === lineKey && !!line
  const label = line ? lineLabel(line, config) : name
  const correction = line?.correction ?? 0
  return (
    <Box
      data-testid={`roll-line-${lineKey}`}
      sx={{ py: 1, borderTop: 1, borderColor: 'divider' }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
      >
        <Box sx={{ flex: '1 1 160px', minWidth: 0 }}>
          <Typography fontWeight={600}>{name}</Typography>
          {(detail || line) && (
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
              data-testid={`roll-breakdown-${lineKey}`}
            >
              {/* wie am Tablet: „Basis 60 · Vorb. 5 · CAP 10“ (Review Z10 Runde 2) */}
              {[detail, line ? lineBreakdown(line) : null]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          )}
        </Box>
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{ minWidth: 48, textAlign: 'right' }}
          data-testid={`roll-total-${lineKey}`}
        >
          {minQtyText(qty)}
        </Typography>
        {line && <DeltaChip line={line} />}
        {line && <DayDecisionChip line={line} />}
        {editable && line && !editing && (
          <>
            {step !== null && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => onEdit(lineKey, correction + step)}
                aria-label={`${label}: einen Bruch mehr (+${formatNumber(
                  step
                )} Stück)`}
                sx={{ minHeight: 44, whiteSpace: 'nowrap' }}
              >
                +1 Bruch
              </Button>
            )}
            <IconButton
              onClick={() => onEdit(lineKey)}
              aria-label={`Korrektur ${label} bearbeiten`}
              sx={{ width: 44, height: 44 }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </>
        )}
      </Stack>
      {editing && line && (
        <CorrectionEditor
          idPrefix="rolls"
          line={line}
          label={label}
          initialCorrection={prefill ?? undefined}
          onSave={(c, r, o) => props.onSaveCorrection(line, c, r, o)}
          onCancel={() => onEdit(null)}
        />
      )}
    </Box>
  )
}

function GroupBlock({
  group,
  props,
}: {
  group: BruchGroup
  props: V2EditProps
}) {
  return (
    <Box data-testid={`bruch-group-${group.key}`} sx={{ mt: 1.5 }}>
      <Stack
        direction="row"
        alignItems="baseline"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
      >
        <Typography fontWeight={700}>{group.name}</Typography>
        <Typography data-testid={`bruch-text-${group.key}`}>
          {bruchGroupText(group)}
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {bruchKgText(group)}
        </Typography>
      </Stack>
      {group.missing.length > 0 && (
        <Box
          component="ul"
          sx={{ m: 0, pl: 2.5, typography: 'caption', color: 'text.secondary' }}
        >
          {group.missing.map((m) => (
            <li key={`${m.code}-${m.itemId}`}>{m.message}</li>
          ))}
        </Box>
      )}
      {group.split.map((s) => (
        <RollLine
          key={s.key}
          lineKey={s.key}
          name={s.name}
          qty={s}
          detail={
            s.perProduct !== 1
              ? `${formatNumber(s.perProduct)} Teigstücke je Stück${
                  s.doughPieces === null
                    ? ''
                    : ` (${formatNumber(s.doughPieces)})`
                }`
              : null
          }
          step={bruchStep(group.piecesPerBruch, s.perProduct)}
          props={props}
        />
      ))}
    </Box>
  )
}

function singleDetail(single: SingleRow): string {
  const piece =
    single.piece_g === null
      ? 'Gramm je Stück offen'
      : `je ${formatNumber(single.piece_g)} g`
  const pieces =
    single.pieces === null
      ? 'Teigstücke je Stück offen'
      : single.pieces !== 1
      ? `${formatNumber(single.pieces)} Teigstücke je Stück`
      : null
  const kg =
    single.kg !== null
      ? `Teig: ${formatKnown(single.kg, 'kg')}`
      : single.kgKnown
      ? `Teig: ≥ ${formatKnown(single.kgKnown, 'kg')}`
      : 'Teig: – kg'
  return [piece, pieces, kg].filter(Boolean).join(' · ')
}

/**
 * Brötchen des Teigtag-Zettels je Backtag (Z10, §7.2 Nr. 5): „für Sonntag“,
 * „für Dienstag“, „heute backen“. Je Bruch-Gruppe eine Zeile „2 Bruch ×
 * 1250 g – 12 Stern, 8 Käse · +0 frei“ (freie Stücke zählen nie mit; eine
 * offene Grundmenge steht als „≥ 7“ bzw. „offen“), darunter
 * die Posten mit Korrektur (schickt den Backtag mit) und „+1 Bruch“; danach
 * Einzelstücke ohne Teilmaschine.
 */
export function RollsByBakeDay(props: RollsByBakeDayProps) {
  const { rolls, sheetDate } = props
  if (!rolls || rolls.length === 0) return null
  return (
    <>
      {rolls.map((block) => (
        <Paper
          key={block.bakeDate}
          variant="outlined"
          sx={{ mb: 2, overflow: 'hidden' }}
          data-testid={`rolls-${block.bakeDate}`}
        >
          <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
            >
              <Typography variant="h6" component="h2">
                Brötchen {bakeDayLabel(block.bakeDate, sheetDate)}
              </Typography>
              {block.bakeDate !== sheetDate && (
                <Chip size="small" variant="outlined" label="Teig heute" />
              )}
            </Stack>
          </Box>
          <Box sx={{ px: 2, pb: 1.5 }}>
            {block.groups.map((g) => (
              <GroupBlock key={g.key} group={g} props={props} />
            ))}
            {block.singles.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Typography fontWeight={700}>Einzelstücke</Typography>
                {block.singles.map((s) => (
                  <RollLine
                    key={s.key}
                    lineKey={s.key}
                    name={s.name}
                    qty={s}
                    detail={singleDetail(s)}
                    step={null}
                    props={props}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Paper>
      ))}
    </>
  )
}

// Seit S6 in backzettelFormat.ts (auch der Druck braucht sie).
export { linesByKey, v2CoveredKeys }

export default RollsByBakeDay
