'use client'

import React from 'react'
import { Box, Stack, Typography } from '@mui/material'
import type {
  BackzettelConfigData,
  BackzettelDeltaEntry,
  BackzettelLine,
  BakeList,
} from '../../lib/backzettelApi'
import {
  bakeSourceText,
  deltaBadgeText,
  formatQty,
  lineLabel,
} from '../../lib/backzettelFormat'
import { BackstubeDeltas } from './BackstubeDeltas'
import { useBackstubeColors } from './backstubeColors'

export interface BackstubeBakeListProps {
  list: BakeList
  config: BackzettelConfigData | null
  /** Nachträge quittieren (Inhaber, Backstube). */
  canAck: boolean
  ackingKey: string | null
  onAck: (deltas: BackzettelDeltaEntry[], key: string) => void
}

function BakeRow({
  line,
  config,
}: {
  line: BackzettelLine
  config: BackzettelConfigData | null
}) {
  const colors = useBackstubeColors()
  const draft = line.sheetStatus === 'draft'
  const openDelta = !!line.delta && line.delta.open > 0
  // Backtag = Tag der Liste: kein „· für …“ am Namen.
  const label = lineLabel({ ...line, bakeDate: undefined }, config)
  return (
    <Box
      data-testid={`bs-bake-${line.key}`}
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
        bgcolor: openDelta ? colors.deltaRow : 'background.paper',
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
      </Box>
      <Typography
        component="div"
        data-testid={`bs-bake-total-${line.key}`}
        sx={{
          fontSize: { xs: '2rem', sm: '2.75rem' },
          fontWeight: 800,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          color: draft ? 'text.secondary' : 'text.primary',
          flexShrink: 0,
        }}
      >
        {formatQty(line.total, line.unit)}
      </Typography>
    </Box>
  )
}

/**
 * Reiter „Backen“ des Backstube-Tablets (Z10, docs/backzettel-v2.md §7.3):
 * was heute in den Ofen kommt - auch aus Teig vom Vortag („Teig vom Sa“).
 * Keine Haken (abgehakt wird auf dem Zettel des Teigtags); Nachträge mit
 * „Gesehen“ quittieren auf dem Zettel, von dem sie stammen.
 */
export function BackstubeBakeList({
  list,
  config,
  canAck,
  ackingKey,
  onAck,
}: BackstubeBakeListProps) {
  const colors = useBackstubeColors()
  const lines = list.sections.flatMap((s) => s.lines)
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
                <BakeRow key={line.key} line={line} config={config} />
              ))}
            </Stack>
          </Box>
        )
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
