'use client'

import React from 'react'
import { Box, ButtonBase, Stack, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import type {
  BackzettelConfigData,
  BackzettelDeltaEntry,
  BackzettelLine,
  BackzettelUserRef,
  BakeList,
} from '../../lib/backzettelApi'
import {
  bakeSourceText,
  deltaBadgeText,
  formatDateShort,
  formatSignedQty,
  formatTimestamp,
  minQtyText,
  baseOpenText,
  lineLabel,
  previouslyBakedText,
} from '../../lib/backzettelFormat'
import { BakeDeltaGroup, bakeDeltaGroups } from '../../lib/backstubeBake'
import { BackstubeDeltas } from './BackstubeDeltas'
import { useBackstubeColors } from './backstubeColors'

export interface BackstubeBakeListProps {
  list: BakeList
  config: BackzettelConfigData | null
  /** Nachträge quittieren (Inhaber, Backstube). */
  canAck: boolean
  ackingKey: string | null
  onAck: (deltas: BackzettelDeltaEntry[], key: string) => void
  /** Z10 O5: „gebacken“ abhaken (Inhaber, Backstube). */
  canTick?: boolean
  /** Laufende Haken: `bakeLineTickKey(line)` bzw. `bakeDeltaTickKey(group)`. */
  pendingKeys?: ReadonlySet<string>
  onToggleLine?: (line: BackzettelLine) => void
  onToggleDeltas?: (group: BakeDeltaGroup) => void
}

/** Schlüssel eines laufenden Zeilen-Hakens (Zeilen-ID; Schlüssel nur im Übergang doppelt). */
export function bakeLineTickKey(line: Pick<BackzettelLine, 'id'>): string {
  return `line:${line.id}`
}

export function bakeDeltaTickKey(group: Pick<BakeDeltaGroup, 'key'>): string {
  return `deltas:${group.key}`
}

function tickedText(
  at: string | null | undefined,
  by?: BackzettelUserRef | null
) {
  return `gebacken ${formatTimestamp(at ?? null)}${
    by ? ` · ${by.displayName}` : ''
  }`
}

/** Großer Haken (72 px) wie auf dem Zettel - mit Mehl an den Fingern. */
function BakeTick({
  checked,
  label,
  pending,
  onClick,
  testId,
}: {
  checked: boolean
  label: string
  pending: boolean
  onClick: () => void
  testId: string
}) {
  const colors = useBackstubeColors()
  return (
    <ButtonBase
      role="checkbox"
      aria-checked={checked}
      aria-label={`${label} ${checked ? 'gebacken' : 'als gebacken abhaken'}`}
      disabled={pending}
      onClick={onClick}
      data-testid={testId}
      sx={{
        width: 72,
        height: 72,
        flexShrink: 0,
        borderRadius: 2,
        border: '3px solid',
        borderColor: checked ? colors.doneBg : 'text.primary',
        bgcolor: checked ? colors.doneBg : 'transparent',
        color: checked ? colors.doneFg : 'text.primary',
        opacity: pending ? 0.7 : 1,
        '&:focus-visible': { outline: '3px solid', outlineOffset: 2 },
      }}
    >
      {checked && <CheckIcon sx={{ fontSize: 52 }} />}
    </ButtonBase>
  )
}

function BakeRow({
  line,
  config,
  canTick,
  pending,
  onToggle,
}: {
  line: BackzettelLine
  config: BackzettelConfigData | null
  canTick: boolean
  pending: boolean
  onToggle?: (line: BackzettelLine) => void
}) {
  const colors = useBackstubeColors()
  const draft = line.sheetStatus === 'draft'
  const openDelta = !!line.delta && line.delta.open > 0
  // Ein Entwurf kann sich noch ändern: kein Haken (wie auf dem Zettel).
  const baked = !draft && !!line.bakedAt
  const tickable = !draft && canTick && line.id !== null && !!onToggle
  const previously = draft ? null : previouslyBakedText(line)
  // Backtag = Tag der Liste: kein „· für …“ am Namen.
  const label = lineLabel({ ...line, bakeDate: undefined }, config)
  return (
    <Box
      data-testid={`bs-bake-${line.key}`}
      data-baked={baked ? 'true' : 'false'}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1.5, sm: 2 },
        px: { xs: 1.5, sm: 2 },
        py: 1.5,
        minHeight: 80,
        borderRadius: 2,
        border: '2px solid',
        borderColor: openDelta ? colors.deltaEdge : 'divider',
        borderStyle: draft ? 'dashed' : 'solid',
        borderLeftWidth: openDelta ? 8 : 2,
        bgcolor: openDelta
          ? colors.deltaRow
          : baked
          ? colors.doneRow
          : 'background.paper',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          component="div"
          sx={{
            fontSize: { xs: '1.25rem', sm: '1.6rem' },
            fontWeight: 700,
            lineHeight: 1.2,
            overflowWrap: 'anywhere',
          }}
        >
          {label}
        </Typography>
        <Typography
          component="div"
          sx={{
            fontSize: { xs: '0.95rem', sm: '1.1rem' },
            color: 'text.secondary',
            mt: 0.5,
          }}
        >
          {[line.madeOn, draft ? 'Entwurf' : null, line.tray]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
        {line.hint && (
          <Typography
            component="div"
            data-testid={`bs-bake-hint-${line.key}`}
            sx={{
              fontSize: { xs: '1rem', sm: '1.15rem' },
              fontWeight: 700,
              color: 'text.primary',
              mt: 0.5,
            }}
          >
            {line.hint}
          </Typography>
        )}
        {line.baseUnset && (
          <Typography
            component="div"
            data-testid={`bs-bake-base-unset-${line.key}`}
            sx={{
              fontSize: { xs: '1rem', sm: '1.15rem' },
              fontWeight: 700,
              mt: 0.5,
            }}
          >
            {line.dayDecision
              ? baseOpenText(line)
              : 'Grundmenge offen - Menge ohne Basis, bitte nachfragen'}
          </Typography>
        )}
        {line.delta && line.delta.count > 0 && (
          <Box
            component="span"
            data-testid={`bs-bake-delta-${line.key}`}
            sx={{
              display: 'inline-block',
              mt: 0.75,
              px: 1.25,
              py: 0.25,
              borderRadius: 1,
              fontWeight: 800,
              fontSize: { xs: '1rem', sm: '1.15rem' },
              ...(openDelta
                ? { bgcolor: colors.deltaBg, color: colors.deltaFg }
                : {
                    border: '1px solid',
                    borderColor: 'divider',
                    color: 'text.secondary',
                  }),
            }}
          >
            {deltaBadgeText(line.delta, line.unit)}
            {openDelta ? '' : ' · gesehen'}
          </Box>
        )}
        {previously && (
          <Typography
            component="div"
            data-testid={`bs-bake-previously-${line.key}`}
            sx={{
              fontSize: { xs: '1rem', sm: '1.15rem' },
              fontWeight: 700,
              mt: 0.5,
            }}
          >
            {previously}
          </Typography>
        )}
        {baked && (
          <Typography
            component="div"
            data-testid={`bs-bake-baked-${line.key}`}
            sx={{ fontSize: '1rem', color: 'text.secondary', mt: 0.5 }}
          >
            {tickedText(line.bakedAt, line.bakedBy)}
          </Typography>
        )}
      </Box>
      <Typography
        component="div"
        data-testid={`bs-bake-total-${line.key}`}
        sx={{
          fontSize: { xs: '2rem', sm: '2.75rem' },
          fontWeight: 800,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          color: draft || baked ? 'text.secondary' : 'text.primary',
          flexShrink: 0,
        }}
      >
        {minQtyText(line, line.unit)}
      </Typography>
      {tickable && onToggle && (
        <BakeTick
          checked={baked}
          label={label}
          pending={pending}
          onClick={() => onToggle(line)}
          testId={`bs-bake-tick-${line.key}`}
        />
      )}
    </Box>
  )
}

/**
 * Nachträge zum Backen (O5): je Zeile ein eigener gebacken-Haken - die Zahl
 * oben in der Zeile enthält sie nicht. Ohne etwas zu backen („−3“, „±0“)
 * steht kein Haken da.
 */
function BakeDeltaRow({
  group,
  config,
  bakeDate,
  canTick,
  pending,
  onToggle,
}: {
  group: BakeDeltaGroup
  config: BackzettelConfigData | null
  bakeDate: string
  canTick: boolean
  pending: boolean
  onToggle?: (group: BakeDeltaGroup) => void
}) {
  const colors = useBackstubeColors()
  const d = group.first
  // Gebacken - auch teils, wenn für die übrigen nichts mehr zu backen ist.
  const baked = group.checked
  const label = lineLabel(
    { name: d.name, variant: d.variant, itemId: d.itemId },
    config
  )
  const detail = [
    d.doughDate && d.doughDate !== bakeDate
      ? `Teig vom ${formatDateShort(d.doughDate)}`
      : null,
    group.deltas.length > 1 ? `${group.deltas.length} Änderungen` : null,
    group.state === 'partial' && group.bakedFigure !== null
      ? `${formatSignedQty(group.bakedFigure, d.unit)} schon gebacken`
      : null,
    group.figure <= 0 && group.state !== 'baked'
      ? 'nichts zusätzlich zu backen'
      : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <Box
      data-testid={`bs-bake-dgroup-${group.key}`}
      data-baked={baked ? 'true' : 'false'}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1.5, sm: 2 },
        px: { xs: 1.5, sm: 2 },
        py: 1.5,
        minHeight: 80,
        borderRadius: 2,
        border: '2px solid',
        borderColor: 'divider',
        bgcolor: baked ? colors.doneRow : 'background.paper',
      }}
    >
      <Typography
        component="div"
        data-testid={`bs-bake-dgroup-figure-${group.key}`}
        sx={{
          fontSize: { xs: '2rem', sm: '2.5rem' },
          fontWeight: 800,
          minWidth: 80,
          fontVariantNumeric: 'tabular-nums',
          color: baked ? 'text.secondary' : 'text.primary',
          flexShrink: 0,
        }}
      >
        {group.figure === 0 ? '±0' : formatSignedQty(group.figure, d.unit)}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          component="div"
          sx={{
            fontSize: { xs: '1.25rem', sm: '1.6rem' },
            fontWeight: 700,
            lineHeight: 1.2,
            overflowWrap: 'anywhere',
          }}
        >
          {label}
        </Typography>
        {detail && (
          <Typography
            component="div"
            sx={{
              fontSize: { xs: '0.95rem', sm: '1.1rem' },
              color: 'text.secondary',
              mt: 0.5,
            }}
          >
            {detail}
          </Typography>
        )}
        {baked && (
          <Typography
            component="div"
            sx={{ fontSize: '1rem', color: 'text.secondary', mt: 0.5 }}
          >
            {tickedText(group.bakedAt, group.bakedBy)}
          </Typography>
        )}
      </Box>
      {canTick && group.tickable && onToggle && (
        <BakeTick
          checked={baked}
          label={`Nachtrag ${label}`}
          pending={pending}
          onClick={() => onToggle(group)}
          testId={`bs-bake-dtick-${group.key}`}
        />
      )}
    </Box>
  )
}

/**
 * Reiter „Backen“ des Backstube-Tablets (Z10, docs/backzettel-v2.md §7.3):
 * was heute in den Ofen kommt - auch aus Teig vom Vortag („Teig vom Sa“).
 * Je Zeile ein eigener Haken „gebacken“ (Inhaber-Entscheidung O5,
 * 2026-11-08), getrennt von „erledigt“ auf dem Zettel des Teigtags (dort =
 * gemacht); Zeilen eines Entwurfs-Zettels haben keinen. Nachträge stehen
 * darunter mit eigenem Haken; „Gesehen“ quittiert auf dem Zettel, von dem
 * sie stammen.
 */
export function BackstubeBakeList({
  list,
  config,
  canAck,
  ackingKey,
  onAck,
  canTick = false,
  pendingKeys,
  onToggleLine,
  onToggleDeltas,
}: BackstubeBakeListProps) {
  const colors = useBackstubeColors()
  const lines = list.sections.flatMap((s) => s.lines)
  const deltaGroups = bakeDeltaGroups(list)
  const anyDraft = list.sources.some((s) => s.status === 'draft')
  return (
    <Stack spacing={2} data-testid="bs-bake-list">
      {list.sources.length > 0 && (
        <Typography
          data-testid="bs-bake-sources"
          sx={{ fontSize: { xs: '1.05rem', sm: '1.2rem' }, fontWeight: 600 }}
        >
          {list.sources.map((s) => bakeSourceText(s, list.date)).join(' · ')}
        </Typography>
      )}
      {anyDraft && (
        <Box
          role="status"
          data-testid="bs-bake-draft"
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderRadius: 2,
            bgcolor: colors.draftBg,
            color: colors.draftFg,
          }}
        >
          <Typography
            sx={{ fontSize: { xs: '1.4rem', sm: '1.7rem' }, fontWeight: 800 }}
          >
            Noch nicht alles freigegeben
          </Typography>
          <Typography sx={{ fontSize: '1.15rem', mt: 0.5 }}>
            Gestrichelte Zeilen kommen von einem Entwurf und können sich noch
            ändern.
          </Typography>
        </Box>
      )}
      <BackstubeDeltas
        deltas={list.deltas}
        bakeByKey={Object.fromEntries(
          lines.map((l) => [l.key, l.delta?.bakeOpen])
        )}
        config={config}
        canAck={canAck}
        ackingKey={ackingKey}
        onAck={onAck}
        sheetDate={list.date}
      />
      {list.sections.map((section) =>
        section.lines.length === 0 ? null : (
          <Box
            component="section"
            key={section.id}
            data-testid={`bs-bake-section-${section.id}`}
            aria-labelledby={`bs-bake-title-${section.id}`}
          >
            <Typography
              id={`bs-bake-title-${section.id}`}
              component="h2"
              sx={{
                fontSize: { xs: '1.5rem', sm: '1.9rem' },
                fontWeight: 800,
                mt: 1,
                mb: 1,
              }}
            >
              {section.label}
            </Typography>
            <Stack spacing={1}>
              {section.lines.map((line) => (
                <BakeRow
                  key={`${line.doughDate ?? ''}-${line.key}`}
                  line={line}
                  config={config}
                  canTick={canTick}
                  pending={!!pendingKeys?.has(bakeLineTickKey(line))}
                  onToggle={onToggleLine}
                />
              ))}
            </Stack>
          </Box>
        )
      )}
      {deltaGroups.length > 0 && (
        <Box
          component="section"
          data-testid="bs-bake-deltas"
          aria-labelledby="bs-bake-deltas-title"
        >
          <Typography
            id="bs-bake-deltas-title"
            component="h2"
            sx={{
              fontSize: { xs: '1.5rem', sm: '1.9rem' },
              fontWeight: 800,
              mt: 1,
              mb: 1,
            }}
          >
            Nachträge (nicht in den Zahlen oben)
          </Typography>
          <Stack spacing={1}>
            {deltaGroups.map((g) => (
              <BakeDeltaRow
                key={g.key}
                group={g}
                config={config}
                bakeDate={list.date}
                canTick={canTick}
                pending={!!pendingKeys?.has(bakeDeltaTickKey(g))}
                onToggle={onToggleDeltas}
              />
            ))}
          </Stack>
        </Box>
      )}
      {lines.length === 0 && (
        <Typography sx={{ fontSize: '1.4rem', py: 4 }}>
          Für diesen Tag steht nichts auf der Backliste.
        </Typography>
      )}
      {list.warnings.length > 0 && (
        <Box
          data-testid="bs-bake-warnings"
          sx={{ fontSize: '1.05rem', color: 'text.secondary' }}
        >
          {list.warnings.map((w, i) => (
            <div key={`${w.code}-${i}`}>{w.message}</div>
          ))}
        </Box>
      )}
    </Stack>
  )
}

export default BackstubeBakeList
