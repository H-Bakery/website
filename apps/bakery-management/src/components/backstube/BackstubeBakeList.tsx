'use client'

import React from 'react'
import { Alert, Box, ButtonBase, Stack, Typography } from '@mui/material'
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
import { ACK_ALL_KEY, groupDetail } from './BackstubeDeltas'
import { BackstubeOverview, jumpTo } from './BackstubeOverview'
import { BS_ANCHOR_SX as ANCHOR_SX } from './BackstubeLayout'
import { BS_SECTION_TITLE_SX } from './backstubeType'
import {
  BAKE_DELTAS_ANCHOR,
  bakeProgress,
  isLineBaked,
  openDeltaCount,
} from '../../lib/backstubeProgress'
import { useBackstubeColors } from './backstubeColors'
import { BackstubeDeltaBanner, NameLeader } from './BackstubeStates'
import {
  MAIN_CELL_SX,
  QTY_CELL_SX,
  QtyFigure,
  TICK_CELL_SX,
  rowGridSx,
} from './BackstubeRow'
import { BackstubeLines } from './BackstubeView'

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
        ...rowGridSx(tickable),
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
      <Box sx={MAIN_CELL_SX}>
        <Typography
          component="div"
          sx={{
            fontSize: { xs: '1.25rem', sm: '1.6rem' },
            fontWeight: 700,
            lineHeight: 1.2,
            overflowWrap: 'break-word',
            hyphens: 'auto',
            display: 'flex',
            alignItems: 'baseline',
          }}
        >
          <Box component="span" sx={{ minWidth: 0 }}>
            {label}
          </Box>
          <NameLeader />
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
      <Box sx={QTY_CELL_SX}>
        <QtyFigure
          testId={`bs-bake-total-${line.key}`}
          text={minQtyText(line, line.unit)}
          unit={line.unit}
          muted={draft || baked}
        />
      </Box>
      {tickable && onToggle && (
        <Box sx={TICK_CELL_SX}>
          <BakeTick
            checked={baked}
            label={label}
            pending={pending}
            onClick={() => onToggle(line)}
            testId={`bs-bake-tick-${line.key}`}
          />
        </Box>
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
  canAck,
  ackingKey,
  onAck,
}: {
  group: BakeDeltaGroup
  config: BackzettelConfigData | null
  bakeDate: string
  canTick: boolean
  pending: boolean
  onToggle?: (group: BakeDeltaGroup) => void
  canAck: boolean
  ackingKey: string | null
  onAck?: (deltas: BackzettelDeltaEntry[], key: string) => void
}) {
  const colors = useBackstubeColors()
  const d = group.first
  // UI-Runde 2: „Gesehen“ steht hier an der Zeile (vorher doppelt in einem
  // eigenen Kasten links). Gebacken quittiert offene Nachträge mit.
  const unseen = group.deltas.filter((x) => !x.acknowledgedAt)
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
    // Ungesehene nennen ihre Zahl in der Zeile darunter (`groupDetail`).
    group.deltas.length > 1 && unseen.length !== group.deltas.length
      ? `${group.deltas.length} Änderungen`
      : null,
    group.state === 'partial' && group.bakedFigure !== null
      ? `${formatSignedQty(group.bakedFigure, d.unit)} schon gebacken`
      : null,
    group.figure <= 0 && group.state !== 'baked'
      ? 'nichts zusätzlich zu backen'
      : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const seenLabel =
    unseen.length === 1
      ? `Nachtrag ${label} gesehen`
      : `${unseen.length} Nachträge ${label} gesehen`
  return (
    <Box
      data-testid={`bs-bake-dgroup-${group.key}`}
      data-baked={baked ? 'true' : 'false'}
      data-unseen={unseen.length > 0 ? 'true' : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1.5, sm: 2 },
        px: { xs: 1.5, sm: 2 },
        py: 1.5,
        minHeight: 80,
        borderRadius: 2,
        border: '2px solid',
        borderColor: unseen.length > 0 ? colors.deltaEdge : 'divider',
        borderLeftWidth: unseen.length > 0 ? 8 : 2,
        bgcolor: baked
          ? colors.doneRow
          : unseen.length > 0
          ? colors.deltaRow
          : 'background.paper',
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
        {unseen.length > 0 && (
          <Typography
            component="div"
            sx={{ fontSize: '1rem', color: 'text.secondary', mt: 0.25 }}
          >
            {groupDetail({ key: group.key, deltas: unseen, qty: 0 })}
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
        {canAck && onAck && unseen.length > 0 && (
          <ButtonBase
            onClick={() => onAck(unseen, group.key)}
            disabled={ackingKey !== null}
            aria-label={seenLabel}
            data-testid={`bs-bake-dseen-${group.key}`}
            sx={{
              mt: 1,
              minHeight: 52,
              px: 2.5,
              borderRadius: 2,
              fontSize: '1.15rem',
              fontWeight: 800,
              bgcolor: colors.deltaBg,
              color: colors.deltaFg,
              opacity: ackingKey === group.key ? 0.7 : 1,
              '&:focus-visible': { outline: '3px solid', outlineOffset: 2 },
            }}
          >
            Gesehen
          </ButtonBase>
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
 * Linke Spalte (hochkant: oben) des Reiters „Backen“: woher die Zeilen
 * kommen, ob ein Entwurf dabei ist, Überblick „n von m gebacken“ mit Sprung
 * zu jedem Abschnitt und ein Hinweis auf neue Nachträge (die stehen mit
 * „Gesehen“ unten in `BakeListMain`).
 */
export function BakeListAside({
  list,
  onOpenDeltas,
}: Pick<BackstubeBakeListProps, 'list'> & {
  /** Hinweis „n neue Nachträge“ getippt (Bäcker-Ansicht: dorthin blättern). */
  onOpenDeltas?: (anchor: string) => void
}) {
  const colors = useBackstubeColors()
  const anyDraft = list.sources.some((s) => s.status === 'draft')
  const progress = bakeProgress(list)
  const unseen = openDeltaCount(list.deltas)
  return (
    <>
      {/* UI-Runde 2: die Nachträge stehen einmal - unten bei den Zeilen mit
          „Gesehen“ und gebacken-Haken; hier nur, dass es neue gibt. */}
      {unseen > 0 && (
        <BackstubeDeltaBanner
          count={unseen}
          onOpen={() => (onOpenDeltas ?? jumpTo)(BAKE_DELTAS_ANCHOR)}
          testId="bs-bake-deltas-banner"
        />
      )}
      <BackstubeOverview
        progress={progress.total > 0 ? { ...progress, verb: 'gebacken' } : null}
        progressTestId="bs-bake-progress"
        status={
          list.sources.length > 0 ? (
            <Box component="span" data-testid="bs-bake-sources">
              {list.sources
                .map((s) => bakeSourceText(s, list.date))
                .join(' · ')}
            </Box>
          ) : null
        }
        banner={
          anyDraft ? (
            <Box
              role="status"
              data-testid="bs-bake-draft"
              sx={{
                p: { xs: 2, sm: 2.5 },
                mb: 2,
                borderRadius: 2,
                bgcolor: colors.draftBg,
                color: colors.draftFg,
              }}
            >
              <Typography
                sx={{
                  fontSize: { xs: '1.4rem', sm: '1.6rem' },
                  fontWeight: 800,
                  lineHeight: 1.15,
                }}
              >
                Noch nicht alles freigegeben
              </Typography>
              <Typography sx={{ fontSize: '1.1rem', mt: 0.5 }}>
                Gestrichelte Zeilen kommen von einem Entwurf und können sich
                noch ändern.
              </Typography>
            </Box>
          ) : null
        }
        entries={progress.entries}
      />
      {list.warnings.length > 0 && (
        <Alert
          severity="warning"
          data-testid="bs-bake-warnings"
          sx={{ fontSize: '1.05rem' }}
        >
          {list.warnings.map((w, i) => (
            <div key={`${w.code}-${i}`}>{w.message}</div>
          ))}
        </Alert>
      )}
    </>
  )
}

/**
 * Rechte Spalte des Reiters „Backen“: die Zeilen je Abschnitt mit dem
 * gebacken-Haken, darunter die Nachträge mit eigenem Haken.
 */
export function BakeListMain({
  list,
  config,
  canTick = false,
  pendingKeys,
  onToggleLine,
  onToggleDeltas,
  canAck = false,
  ackingKey = null,
  onAck,
  only,
}: Pick<
  BackstubeBakeListProps,
  | 'list'
  | 'config'
  | 'canTick'
  | 'pendingKeys'
  | 'onToggleLine'
  | 'onToggleDeltas'
  | 'canAck'
  | 'ackingKey'
  | 'onAck'
> & {
  /** Bäcker-Ansicht: nur dieser Abschnitt (Sprungziel `bs-anchor-…`). */
  only?: string
}) {
  const lines = list.sections.flatMap((s) => s.lines)
  const deltaGroups = bakeDeltaGroups(list)
  const unseenGroups = deltaGroups.filter((g) =>
    g.deltas.some((d) => !d.acknowledgedAt)
  )
  const unseenDeltas = unseenGroups.flatMap((g) =>
    g.deltas.filter((d) => !d.acknowledgedAt)
  )
  const showDeltas =
    deltaGroups.length > 0 && (!only || only === BAKE_DELTAS_ANCHOR)
  return (
    <>
      {list.sections.map((section) =>
        section.lines.length === 0 ||
        (only && only !== `bs-anchor-bake-${section.id}`) ? null : (
          <Box
            component="section"
            key={section.id}
            id={`bs-anchor-bake-${section.id}`}
            data-testid={`bs-bake-section-${section.id}`}
            aria-labelledby={`bs-bake-title-${section.id}`}
            sx={ANCHOR_SX}
          >
            <Typography
              id={`bs-bake-title-${section.id}`}
              component="h2"
              tabIndex={-1}
              sx={{ ...BS_SECTION_TITLE_SX, mt: 1, mb: 1, outline: 'none' }}
            >
              {section.label}
            </Typography>
            <BackstubeLines
              lines={section.lines}
              sectionId={`bake-${section.id}`}
              verb="gebacken"
              lineKey={(line) => `${line.doughDate ?? ''}-${line.key}`}
              isDone={isLineBaked}
              renderLine={(line) => (
                <BakeRow
                  key={`${line.doughDate ?? ''}-${line.key}`}
                  line={line}
                  config={config}
                  canTick={canTick}
                  pending={!!pendingKeys?.has(bakeLineTickKey(line))}
                  onToggle={onToggleLine}
                />
              )}
            />
          </Box>
        )
      )}
      {showDeltas && (
        <Box
          component="section"
          id={BAKE_DELTAS_ANCHOR}
          data-testid="bs-bake-deltas"
          aria-labelledby="bs-bake-deltas-title"
          sx={ANCHOR_SX}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1.5,
              mt: 1,
              mb: 1,
            }}
          >
            <Typography
              id="bs-bake-deltas-title"
              component="h2"
              tabIndex={-1}
              sx={{ ...BS_SECTION_TITLE_SX, outline: 'none' }}
            >
              Nachträge{' '}
              <Box
                component="span"
                sx={{
                  fontSize: '0.6em',
                  fontWeight: 700,
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                }}
              >
                (nicht in den Zahlen oben)
              </Box>
            </Typography>
            {canAck && onAck && unseenGroups.length > 1 && (
              <ButtonBase
                onClick={() => onAck(unseenDeltas, ACK_ALL_KEY)}
                disabled={ackingKey !== null}
                data-testid="bs-bake-deltas-ack-all"
                aria-label={`Alle ${unseenDeltas.length} Nachträge gesehen`}
                sx={{
                  minHeight: 56,
                  px: 2.5,
                  borderRadius: 2,
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  border: '2px solid',
                  borderColor: 'text.primary',
                  opacity: ackingKey === ACK_ALL_KEY ? 0.7 : 1,
                  '&:focus-visible': { outline: '3px solid', outlineOffset: 2 },
                }}
              >
                Alle gesehen
              </ButtonBase>
            )}
          </Box>
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
                canAck={canAck}
                ackingKey={ackingKey}
                onAck={onAck}
              />
            ))}
          </Stack>
        </Box>
      )}
      {lines.length === 0 && !only && (
        <Typography sx={{ fontSize: '1.4rem', py: 4 }}>
          Für diesen Tag steht nichts auf der Backliste.
        </Typography>
      )}
    </>
  )
}

/**
 * Reiter „Backen“ des Backstube-Tablets (Z10, docs/backzettel-v2.md §7.3):
 * was heute in den Ofen kommt - auch aus Teig vom Vortag („Teig vom Sa“).
 * Je Zeile ein eigener Haken „gebacken“ (Inhaber-Entscheidung O5,
 * 2026-11-08), getrennt von „erledigt“ auf dem Zettel des Teigtags (dort =
 * gemacht); Zeilen eines Entwurfs-Zettels haben keinen. Nachträge stehen
 * darunter mit eigenem Haken; „Gesehen“ quittiert auf dem Zettel, von dem
 * sie stammen. Die Seite setzt Seitenspalte und Zeilen getrennt
 * (`BakeListAside`/`BakeListMain`); zusammen ergeben sie diese Ansicht.
 */
export function BackstubeBakeList(props: BackstubeBakeListProps) {
  return (
    <Stack spacing={2} data-testid="bs-bake-list">
      <BakeListAside {...props} />
      <BakeListMain {...props} />
    </Stack>
  )
}

export default BackstubeBakeList
