'use client'

import React from 'react'
import Link from 'next/link'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  GlobalStyles,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { alpha, type Theme } from '@mui/material/styles'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import PrintIcon from '@mui/icons-material/Print'
import RefreshIcon from '@mui/icons-material/Refresh'
import {
  DELTAS_PENDING_MAX_RELOADS,
  DELTAS_PENDING_RELOAD_MS,
  acknowledgeDelta,
  fetchBackzettelConfig,
  fetchBakeList,
  type BackzettelConfigData,
  type BackzettelDeltaEntry,
  type BackzettelLine,
  type BakeList,
} from '../../../../../lib/backzettelApi'
import {
  bakeSourceText,
  deltaBadgeText,
  formatDateLong,
  formatDateShort,
  formatQty,
  isIsoDate,
  lineLabel,
  neighbourProductionDay,
} from '../../../../../lib/backzettelFormat'
import { useOptionalSession } from '../../../../../lib/session'
import { DeltasCard } from '../../../../../components/backzettel/DeltasCard'

const MIN_TOUCH = { minHeight: 44 }

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/**
 * Druck der Backliste (Z10 S5): nur die Liste, schwarz auf weiß, ohne
 * App-Hülle und Knöpfe. Das eigene Druckbild (BakeListPrint) kommt mit S6.
 */
export const bakeListPrintStyles = (
  <GlobalStyles
    styles={{
      '@media print': {
        '.MuiAppBar-root, nav, .MuiDrawer-root, [aria-label="Pfad"], main > .MuiToolbar-root, [data-print="hide"]':
          { display: 'none !important' },
        'body, section': { animation: 'none !important' },
        '.bake-list, .bake-list *': {
          color: '#000 !important',
          backgroundColor: 'transparent !important',
          boxShadow: 'none !important',
        },
        '.bake-list .MuiPaper-root': {
          borderColor: '#000 !important',
          breakInside: 'avoid',
        },
      },
    }}
  />
)

/** Offene Nachträge der Zeile: Rand + leichte Warnfarbe (wie der Zettel). */
function deltaSx(line: BackzettelLine) {
  if (!line.delta || line.delta.open === 0) return {}
  return {
    bgcolor: (t: Theme) => alpha(t.palette.warning.main, 0.14),
    boxShadow: (t: Theme) => `inset 4px 0 0 ${t.palette.warning.main}`,
  }
}

function BakeLine({
  line,
  config,
}: {
  line: BackzettelLine
  config: BackzettelConfigData | null
}) {
  // Auf der Backliste ist der Backtag immer der Tag der Liste - kein
  // „· für Di …“ am Namen.
  const label = lineLabel({ ...line, bakeDate: undefined }, config)
  const delta = line.delta
  return (
    <Box
      data-testid={`bake-line-${line.key}`}
      sx={{
        px: 2,
        py: 1.25,
        borderTop: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        flexWrap: 'wrap',
        ...deltaSx(line),
      }}
    >
      <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
        <Typography fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
          {label}
        </Typography>
        <Stack
          direction="row"
          spacing={0.75}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
        >
          {line.madeOn && (
            <Typography variant="body2" color="text.secondary">
              {line.madeOn}
            </Typography>
          )}
          {line.sheetStatus === 'draft' && (
            <Chip
              size="small"
              variant="outlined"
              label="Entwurf"
              data-testid={`bake-draft-${line.key}`}
            />
          )}
          {line.baseUnset && (
            <Chip
              size="small"
              variant="outlined"
              label="Grundmenge offen"
              title="Grundmenge noch nicht festgelegt"
            />
          )}
          {delta && delta.count > 0 && (
            <Chip
              size="small"
              color={delta.open > 0 ? 'warning' : 'default'}
              variant={delta.open > 0 ? 'filled' : 'outlined'}
              label={`${deltaBadgeText(delta, line.unit)}${
                delta.open > 0 ? '' : ' · quittiert'
              }`}
              data-testid={`bake-delta-${line.key}`}
            />
          )}
        </Stack>
      </Box>
      <Typography
        data-testid={`bake-total-${line.key}`}
        sx={{
          fontSize: { xs: '1.6rem', sm: '1.9rem' },
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 72,
          textAlign: 'right',
          color: line.sheetStatus === 'draft' ? 'text.secondary' : undefined,
        }}
      >
        {formatQty(line.total, line.unit)}
      </Typography>
    </Box>
  )
}

export interface BakeListClientProps {
  date: string
}

/**
 * Backliste eines Backtags (Z10, docs/backzettel-v2.md §7.3): was heute in den
 * Ofen kommt - auch Brötchen, deren Teig am Vortag gemacht wurde (Sonntag:
 * alles vom Samstag). Alles kommt von `/api/backzettel/:datum/bake-list`;
 * korrigiert wird auf dem Zettel des Teigtags, nicht hier. Nachträge
 * quittieren Inhaber und Backstube - beim Zettel, von dem sie stammen.
 */
export default function BakeListClient({ date }: BakeListClientProps) {
  const session = useOptionalSession()
  const role = session?.user?.role ?? null
  const canAck = role === 'inhaber' || role === 'backstube'
  const validDate = isIsoDate(date)

  const [config, setConfig] = React.useState<BackzettelConfigData | null>(null)
  const [list, setList] = React.useState<BakeList | null>(null)
  const [loading, setLoading] = React.useState(validDate)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [ackingId, setAckingId] = React.useState<number | null>(null)

  const load = React.useCallback(async () => {
    if (!validDate) return
    setLoading(true)
    setLoadError(null)
    const [cfg, bake] = await Promise.allSettled([
      fetchBackzettelConfig(),
      fetchBakeList(date),
    ])
    if (cfg.status === 'fulfilled') setConfig(cfg.value?.config ?? null)
    if (bake.status === 'fulfilled') setList(bake.value)
    else
      setLoadError(
        messageOf(bake.reason, 'Die Backliste konnte nicht geladen werden.')
      )
    setLoading(false)
  }, [date, validDate])

  React.useEffect(() => {
    setList(null)
    void load()
  }, [load])

  const pendingReloads = React.useRef(0)
  const deltasPending = list?.status === 'ok' && list.deltasPending === true
  React.useEffect(() => {
    if (!deltasPending) {
      pendingReloads.current = 0
      return
    }
    if (pendingReloads.current >= DELTAS_PENDING_MAX_RELOADS) return
    const timer = window.setTimeout(() => {
      pendingReloads.current += 1
      void load()
    }, DELTAS_PENDING_RELOAD_MS)
    return () => window.clearTimeout(timer)
  }, [deltasPending, list, load])

  const doAck = async (delta: BackzettelDeltaEntry) => {
    setAckingId(delta.id)
    setActionError(null)
    try {
      // Der Nachtrag gehört zum Zettel seines Teigtags.
      await acknowledgeDelta(delta.doughDate ?? date, delta.id)
      setList(await fetchBakeList(date))
    } catch (error) {
      setActionError(
        messageOf(error, 'Der Nachtrag konnte nicht quittiert werden.')
      )
    } finally {
      setAckingId(null)
    }
  }

  const days = config?.days ?? null
  const previous = validDate ? neighbourProductionDay(date, -1, days) : null
  const next = validDate ? neighbourProductionDay(date, 1, days) : null

  const header = (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      justifyContent="space-between"
      sx={{ mb: 2 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h4" component="h1">
          Backliste
        </Typography>
        <Typography variant="h6" component="p" color="text.secondary">
          {validDate ? formatDateLong(date) : date}
        </Typography>
      </Box>
      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
        data-print="hide"
      >
        {previous && (
          <IconButton
            component={Link}
            href={`/admin/backzettel/${previous}/backen`}
            aria-label={`Vorheriger Backtag (${formatDateShort(previous)})`}
            sx={{ width: 44, height: 44 }}
          >
            <ChevronLeftIcon />
          </IconButton>
        )}
        {next && (
          <IconButton
            component={Link}
            href={`/admin/backzettel/${next}/backen`}
            aria-label={`Nächster Backtag (${formatDateShort(next)})`}
            sx={{ width: 44, height: 44 }}
          >
            <ChevronRightIcon />
          </IconButton>
        )}
        {validDate && (
          <Button
            component={Link}
            href={`/admin/backzettel/${date}`}
            variant="outlined"
            sx={MIN_TOUCH}
          >
            Zum Zettel
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => void load()}
          disabled={!validDate || loading}
          sx={MIN_TOUCH}
        >
          Neu laden
        </Button>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={() => window.print()}
          disabled={!list || list.status !== 'ok'}
          sx={MIN_TOUCH}
        >
          Drucken
        </Button>
      </Stack>
    </Stack>
  )

  let body: React.ReactNode
  if (!validDate) {
    body = (
      <Alert severity="error">
        Ungültiges Datum „{date}“ - erwartet wird JJJJ-MM-TT.
      </Alert>
    )
  } else if (!list && loading) {
    body = (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label="Backliste wird geladen" />
      </Box>
    )
  } else if (!list) {
    body = (
      <Alert severity="error" data-testid="load-error">
        {loadError ?? 'Die Backliste konnte nicht geladen werden.'}
      </Alert>
    )
  } else if (list.status === 'ruhetag') {
    body = (
      <Alert severity="info" data-testid="bake-ruhetag">
        {list.message ??
          `${
            list.weekdayName ?? 'Dieser Tag'
          } ist Ruhetag - gebacken wird nicht.`}
      </Alert>
    )
  } else if (list.status === 'no-config') {
    body = (
      <Alert severity="warning" data-testid="bake-no-config">
        <AlertTitle>Backzettel-Stammdaten fehlen</AlertTitle>
        Ohne Stammdaten lässt sich die Backliste nicht aufstellen - es werden
        keine Mengen geschätzt.
        {list.reasons && list.reasons.length > 0 && (
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
            {list.reasons.map((r, i) => (
              <li key={`${r.path ?? ''}-${i}`}>{r.message}</li>
            ))}
          </Box>
        )}
      </Alert>
    )
  } else {
    const lineCount = list.sections.reduce((n, s) => n + s.lines.length, 0)
    body = (
      <Box className="bake-list">
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          sx={{ mb: 2 }}
          data-testid="bake-sources"
        >
          {list.sources.map((s) => (
            <Chip
              key={s.doughDate}
              variant="outlined"
              color={s.status === 'confirmed' ? 'success' : 'default'}
              label={bakeSourceText(s, date)}
              component={Link}
              href={`/admin/backzettel/${s.doughDate}`}
              clickable
              sx={{ minHeight: 44 }}
            />
          ))}
        </Stack>
        <Stack spacing={1.5} sx={{ mb: 2 }} data-print="hide">
          {loadError && (
            <Alert severity="warning">
              {loadError} Angezeigt wird der zuletzt geladene Stand.
            </Alert>
          )}
          {deltasPending && (
            <Alert severity="warning" data-testid="deltas-pending">
              Vorbestellungen haben sich geändert, die Änderungen stehen noch
              nicht unten bei den Nachträgen. Sie werden gerade übernommen - die
              Seite lädt gleich neu.
            </Alert>
          )}
          {list.sources.some((s) => s.status === 'draft') && (
            <Alert severity="info" data-testid="bake-draft-note">
              Ein Teil kommt von einem Zettel, der noch nicht freigegeben ist -
              diese Mengen können sich noch ändern.
            </Alert>
          )}
          {list.warnings.length > 0 && (
            <Alert severity="warning" data-testid="bake-warnings">
              <AlertTitle>Hinweise</AlertTitle>
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {list.warnings.map((w, i) => (
                  <li key={`${w.code}-${i}`}>{w.message}</li>
                ))}
              </Box>
            </Alert>
          )}
          {actionError && (
            <Alert severity="error" onClose={() => setActionError(null)}>
              {actionError}
            </Alert>
          )}
        </Stack>
        {list.deltas.length > 0 && (
          <Box data-print="hide">
            <DeltasCard
              deltas={list.deltas}
              config={config}
              canAck={canAck}
              ackingId={ackingId}
              onAck={(d) => void doAck(d)}
              sheetDate={date}
            />
          </Box>
        )}
        {lineCount === 0 ? (
          <Alert severity="info" data-testid="bake-empty">
            Für diesen Tag steht nichts auf der Backliste.
          </Alert>
        ) : (
          list.sections
            .filter((s) => s.lines.length > 0)
            .map((section) => (
              <Paper
                key={section.id}
                variant="outlined"
                sx={{ mb: 2, overflow: 'hidden' }}
                data-testid={`bake-section-${section.id}`}
              >
                <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
                  <Typography variant="h6" component="h2">
                    {section.label}
                  </Typography>
                </Box>
                {section.lines.map((line) => (
                  <BakeLine key={line.key} line={line} config={config} />
                ))}
              </Paper>
            ))
        )}
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      {bakeListPrintStyles}
      {header}
      {body}
    </Box>
  )
}
