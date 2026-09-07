'use client'
import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { Login as LoginIcon, Flag as TargetIcon } from '@mui/icons-material'
import { useAuth } from '@bakery/shared/contexts'
import {
  classifyFinanceError,
  fetchTargetStatus,
  type FinanceAccessProblem,
} from '../../lib/targetsApi'
import type {
  TargetEvaluation,
  TargetLevelKey,
  TargetLevelsMeta,
  TargetStatusResponse,
} from '../../lib/targetsTypes'
import { formatEuro, formatReportDate } from '../../lib/reportFormat'
import TargetStatusChip from './TargetStatusChip'

type TileState =
  | { phase: 'loading' }
  | { phase: 'access'; kind: FinanceAccessProblem; message: string }
  | { phase: 'no-target'; reason: string }
  | { phase: 'ok'; data: TargetStatusResponse }

const LEVEL_ORDER: TargetLevelKey[] = ['breakeven', 'draw']

/** `2026-09-02` → `02.09.` */
function shortDate(date: string): string {
  const [, m, d] = date.split('-')
  return `${d}.${m}.`
}

function LevelRows({
  levels,
  meta,
}: {
  levels: Record<TargetLevelKey, TargetEvaluation>
  meta: TargetLevelsMeta
}) {
  return (
    <Stack spacing={0.75} sx={{ mt: 1.5 }}>
      {LEVEL_ORDER.map((key) => (
        <Box
          key={key}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {meta[key].label}
            {meta[key].assumed ? ' (Annahme)' : ''}
          </Typography>
          <TargetStatusChip evaluation={levels[key]} />
        </Box>
      ))}
    </Stack>
  )
}

function ValueLine({
  evaluation,
}: {
  evaluation: TargetEvaluation
}): React.ReactElement {
  if (evaluation.actual === null) {
    return (
      <Typography variant="h5" component="p">
        –
      </Typography>
    )
  }
  return (
    <>
      <Typography variant="h5" component="p">
        {formatEuro(evaluation.actual)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {evaluation.target === null
          ? 'kein Ziel'
          : `Ziel ${formatEuro(evaluation.target)}`}
      </Typography>
    </>
  )
}

/**
 * Dashboard-Kachel der Tagesziel-Ampel: letzter ausgewerteter Tag, darunter
 * Woche und Monat bis zu diesem Tag - die Aggregate genauso groß wie der
 * Einzeltag, denn ein einzelner Tag ist Rauschen.
 *
 * Das Dashboard kommt ohne Anmeldung aus; die Zielwerte nicht. Ohne Token
 * zeigt die Kachel deshalb „Anmeldung erforderlich" mit Link - keinen Fehler.
 */
export default function TargetsTile() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [state, setState] = useState<TileState>({ phase: 'loading' })

  const load = useCallback(async () => {
    setState({ phase: 'loading' })
    try {
      const result = await fetchTargetStatus()
      if (result.status === 'no-target') {
        setState({ phase: 'no-target', reason: result.reason })
        return
      }
      setState({ phase: 'ok', data: result.data })
    } catch (err) {
      const { kind, message } = classifyFinanceError(err)
      setState({ phase: 'access', kind, message })
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    load()
  }, [authLoading, isAuthenticated, load])

  const heading = (
    <Typography
      variant="h5"
      gutterBottom
      sx={{ mb: { xs: 1.5, md: 2 }, fontSize: { xs: '1.25rem', md: '1.5rem' } }}
    >
      <TargetIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
      Tagesziel
      {state.phase === 'ok' && state.data.last_evaluated_date && (
        <Typography
          component="span"
          variant="body2"
          color="text.secondary"
          sx={{ ml: 1.5 }}
        >
          Zuletzt ausgewertet:{' '}
          {formatReportDate(state.data.last_evaluated_date)}
        </Typography>
      )}
    </Typography>
  )

  if (state.phase === 'loading') {
    return (
      <Box sx={{ mb: { xs: 2, md: 4 } }} data-testid="targets-tile">
        {heading}
        <LinearProgress aria-label="Tagesziel wird geladen" />
      </Box>
    )
  }

  if (state.phase === 'access') {
    return (
      <Box sx={{ mb: { xs: 2, md: 4 } }} data-testid="targets-tile">
        {heading}
        {state.kind === 'unauthenticated' ? (
          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
            >
              <Typography variant="body2" color="text.secondary">
                Anmeldung erforderlich - das Tagesziel ist nur für Inhaber/Admin
                sichtbar.
              </Typography>
              <Button
                size="small"
                component={Link}
                href="/admin/login?next=/admin"
                startIcon={<LoginIcon />}
              >
                Zur Anmeldung
              </Button>
            </Stack>
          </Paper>
        ) : state.kind === 'forbidden' ? (
          <Alert severity="info">
            Keine Berechtigung - das Tagesziel sehen nur Konten mit der Rolle
            Inhaber/Admin.
          </Alert>
        ) : (
          <Alert severity="warning">
            Das Tagesziel konnte nicht geladen werden. {state.message}
          </Alert>
        )}
      </Box>
    )
  }

  if (state.phase === 'no-target') {
    return (
      <Box sx={{ mb: { xs: 2, md: 4 } }} data-testid="targets-tile">
        {heading}
        <Alert severity="info">Kein Tagesziel verfügbar. {state.reason}</Alert>
      </Box>
    )
  }

  const { day, week, month, levels_meta } = state.data
  const tiles: Array<{
    key: string
    title: string
    subtitle: string
    evaluation: TargetEvaluation
    levels: Record<TargetLevelKey, TargetEvaluation>
    extra?: React.ReactNode
  }> = [
    {
      key: 'day',
      title: 'Letzter Tag',
      subtitle: `${day.weekday}, ${formatReportDate(day.date)}`,
      evaluation: day.levels.breakeven,
      levels: day.levels,
    },
    {
      key: 'week',
      title: `Woche bis ${shortDate(week.to)}`,
      subtitle: `KW ${week.iso_week.slice(-2)} · ${
        week.levels.breakeven.days_counted
      } Tag${week.levels.breakeven.days_counted === 1 ? '' : 'e'} bewertet`,
      evaluation: week.levels.breakeven,
      levels: week.levels,
    },
    {
      key: 'month',
      title: `Monat bis ${shortDate(month.to)}`,
      subtitle: `${month.levels.breakeven.days_counted} Tag${
        month.levels.breakeven.days_counted === 1 ? '' : 'e'
      } bewertet`,
      evaluation: month.levels.breakeven,
      levels: month.levels,
      extra:
        month.projection.breakeven.projected_actual !== null ? (
          <Typography variant="caption" color="text.secondary">
            Hochrechnung Monatsende:{' '}
            {formatEuro(month.projection.breakeven.projected_actual)} von{' '}
            {formatEuro(month.projection.breakeven.month_target ?? 0)}
          </Typography>
        ) : null,
    },
  ]

  return (
    <Box sx={{ mb: { xs: 2, md: 4 } }} data-testid="targets-tile">
      {heading}
      <Grid container spacing={{ xs: 1.5, md: 3 }}>
        {tiles.map((tile) => (
          <Grid item xs={12} sm={6} md={4} key={tile.key}>
            <Paper sx={{ p: { xs: 2, md: 3 }, height: '100%' }}>
              <Typography color="text.secondary" variant="body2">
                {tile.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {tile.subtitle}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <ValueLine evaluation={tile.evaluation} />
              </Box>
              {tile.extra}
              <LevelRows levels={tile.levels} meta={levels_meta} />
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Button
        size="small"
        component={Link}
        href="/admin/finance/tagesziel"
        sx={{ mt: 1.5 }}
      >
        Tagesziel im Detail
      </Button>
    </Box>
  )
}
