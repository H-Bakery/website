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
import type {
  BackzettelLine,
  BruchGroup,
  RollsBlock,
  SingleRow,
} from '../../lib/backzettelApi'
import {
  bakeDayLabel,
  bruchGroupText,
  bruchStep,
  formatKnown,
  formatNumber,
  formatSigned,
  lineLabel,
} from '../../lib/backzettelFormat'
import { CorrectionEditor } from './CorrectionEditor'
import type { V2EditProps } from './BreadTable'

export interface RollsByBakeDayProps extends V2EditProps {
  rolls: RollsBlock[] | null | undefined
}

/** Eine Brötchen-Zeile (Mitglied einer Bruch-Gruppe oder Einzelstück). */
function RollLine({
  lineKey,
  name,
  total,
  detail,
  step,
  props,
}: {
  lineKey: string
  name: string
  total: number
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
          {(detail || correction !== 0 || line?.baseUnset) && (
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
            >
              {[
                detail,
                line?.baseUnset ? 'Grundmenge offen' : null,
                correction !== 0
                  ? `Korr. ${formatSigned(correction)}${
                      line?.correctionReason
                        ? ` (${line.correctionReason})`
                        : ''
                    }`
                  : null,
              ]
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
          {formatNumber(total)}
        </Typography>
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
          onSave={(c, r) => props.onSaveCorrection(line, c, r)}
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
          {group.kg === null
            ? 'Teig: – kg'
            : `Teig: ${formatKnown(group.kg, 'kg')}`}
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
          total={s.total}
          detail={
            s.perProduct !== 1
              ? `${formatNumber(
                  s.perProduct
                )} Teigstücke je Stück (${formatNumber(s.doughPieces)})`
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
    single.kg === null ? 'Teig: – kg' : `Teig: ${formatKnown(single.kg, 'kg')}`
  return [piece, pieces, kg].filter(Boolean).join(' · ')
}

/**
 * Brötchen des Teigtag-Zettels je Backtag (Z10, §7.2 Nr. 5): „für Sonntag“,
 * „für Dienstag“, „heute backen“. Je Bruch-Gruppe eine Zeile „2 Bruch ×
 * 1150 g – 12 Stern, 8 Käse · +0 frei“ (freie Stücke zählen nie mit), darunter
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
                    total={s.total}
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

/** Schlüssel aller Zeilen, die Brot-Tabelle und Brötchen-Blöcke zeigen. */
export function v2CoveredKeys(day: {
  bread?: {
    rows: {
      cells: Record<string, { key: string } | null>
      single: { key: string } | null
    }[]
  } | null
  rolls?: RollsBlock[] | null
}): Set<string> {
  const keys = new Set<string>()
  for (const row of day.bread?.rows ?? []) {
    if (row.single) keys.add(row.single.key)
    for (const c of Object.values(row.cells)) if (c) keys.add(c.key)
  }
  for (const block of day.rolls ?? []) {
    for (const g of block.groups) for (const s of g.split) keys.add(s.key)
    for (const s of block.singles) keys.add(s.key)
  }
  return keys
}

/** Für Specs und andere Ansichten: die Zeile zu einem Schlüssel. */
export function linesByKey(
  sections: { lines: BackzettelLine[] }[]
): Map<string, BackzettelLine> {
  return new Map(sections.flatMap((s) => s.lines).map((l) => [l.key, l]))
}

export default RollsByBakeDay
