'use client'
import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { Login as LoginIcon } from '@mui/icons-material'
import { KeyFigures, PageSection, type KeyFigure } from '../layout'
import { useSession } from '../../lib/session'
import {
  classifyFinanceError,
  PERSONAL_SESSION_HINT,
  fetchTargetStatus,
  type FinanceAccessProblem,
} from '../../lib/targetsApi'
import type {
  TargetEvaluation,
  TargetStatusResponse,
} from '../../lib/targetsTypes'
import { formatEuro, formatReportDate } from '../../lib/reportFormat'
import TargetStatusChip from './TargetStatusChip'

type TileState =
  | { phase: 'loading' }
  | { phase: 'access'; kind: FinanceAccessProblem; message: string }
  | { phase: 'no-target'; reason: string }
  | { phase: 'ok'; data: TargetStatusResponse }

/** `2026-09-02` → `02.09.` */
function shortDate(date: string): string {
  const [, m, d] = date.split('-')
  return `${d}.${m}.`
}

/** Ist-Wert einer Kennzahl, ohne Bericht ein Gedankenstrich. */
function actualText(evaluation: TargetEvaluation): string {
  return evaluation.actual === null ? '–' : formatEuro(evaluation.actual)
}

function targetText(evaluation: TargetEvaluation): string {
  return evaluation.target === null
    ? 'kein Ziel'
    : `Ziel ${formatEuro(evaluation.target)}`
}

function countedText(days: number): string {
  return `${days} Tag${days === 1 ? '' : 'e'} bewertet`
}

/**
 * Dashboard-Kachel der Tagesziel-Ampel: letzter ausgewerteter Tag, Woche und
 * Monat bis zu diesem Tag - die Aggregate genauso groß wie der Einzeltag,
 * denn ein einzelner Tag ist Rauschen. Wie Kasse und Sortiment als
 * `KeyFigures` (Ist-Wert groß, Ampel-Chip neben der Bezeichnung, Ziel als
 * Hinweis); die zweite Stufe (Entnahme, eine Annahme) steht in „Details“.
 *
 * Das Dashboard kommt ohne Anmeldung aus; die Zielwerte nicht. Ohne Token
 * zeigt die Kachel deshalb „Anmeldung erforderlich“ mit Link - keinen Fehler.
 */
export default function TargetsTile() {
  const { isAuthenticated, isLoading: authLoading } = useSession()
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

  // Abschnitt des Layout-Kits (h2 „Tagesziel“), wie die übrigen Blöcke des
  // Dashboards - vorher eigene h5 mit Symbol und eigenem Abstand.
  const frame = (
    children: React.ReactNode,
    actions?: React.ReactNode,
    details?: React.ReactNode
  ) => (
    <PageSection
      title="Tagesziel"
      variant="plain"
      data-testid="targets-tile"
      description={
        state.phase === 'ok' && state.data.last_evaluated_date
          ? `Zuletzt ausgewertet: ${formatReportDate(
              state.data.last_evaluated_date
            )}`
          : undefined
      }
      actions={actions}
      details={details}
      detailsLabel={
        state.phase === 'ok'
          ? `${state.data.levels_meta.draw.label}${
              state.data.levels_meta.draw.assumed ? ' (Annahme)' : ''
            }`
          : undefined
      }
    >
      {children}
    </PageSection>
  )

  if (state.phase === 'loading') {
    return frame(<LinearProgress aria-label="Tagesziel wird geladen" />)
  }

  if (state.phase === 'access') {
    return frame(
      <>
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
        ) : state.kind === 'personal_session' ? (
          <Alert severity="info">Tagesziel: {PERSONAL_SESSION_HINT}</Alert>
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
      </>
    )
  }

  if (state.phase === 'no-target') {
    return frame(
      <Alert severity="info">Kein Tagesziel verfügbar. {state.reason}</Alert>
    )
  }

  const { day, week, month, levels_meta } = state.data
  const periods: Array<{
    key: string
    label: string
    when: string
    breakeven: TargetEvaluation
    draw: TargetEvaluation
  }> = [
    {
      key: 'day',
      label: 'Letzter Tag',
      when: `${day.weekday}, ${formatReportDate(day.date)}`,
      breakeven: day.levels.breakeven,
      draw: day.levels.draw,
    },
    {
      key: 'week',
      label: `Woche bis ${shortDate(week.to)}`,
      when: `KW ${week.iso_week.slice(-2)} · ${countedText(
        week.levels.breakeven.days_counted
      )}`,
      breakeven: week.levels.breakeven,
      draw: week.levels.draw,
    },
    {
      key: 'month',
      label: `Monat bis ${shortDate(month.to)}`,
      when: countedText(month.levels.breakeven.days_counted),
      breakeven: month.levels.breakeven,
      draw: month.levels.draw,
    },
  ]
  const projection = month.projection.breakeven
  const figures: KeyFigure[] = periods.map((period) => ({
    label: period.label,
    badge: <TargetStatusChip evaluation={period.breakeven} />,
    value: actualText(period.breakeven),
    hint: (
      <>
        {period.when} · {targetText(period.breakeven)}
        {period.key === 'month' && projection.projected_actual !== null && (
          <>
            <br />
            Hochrechnung Monatsende: {formatEuro(
              projection.projected_actual
            )}{' '}
            von {formatEuro(projection.month_target ?? 0)}
          </>
        )}
      </>
    ),
    'data-testid': `targets-figure-${period.key}`,
  }))
  const draw = levels_meta.draw

  return frame(
    <KeyFigures items={figures} aria-label="Tagesziel je Zeitraum" />,
    <Button size="small" component={Link} href="/admin/finance/tagesziel">
      Tagesziel im Detail
    </Button>,
    <Stack spacing={1} data-testid="targets-draw-level">
      <Typography variant="body2" color="text.secondary">
        Die Ampel oben gilt für „{levels_meta.breakeven.label}“. Hier die zweite
        Stufe „{draw.label}“
        {draw.assumed
          ? ' - abgeleitet aus einer Annahme, nicht aus Buchungen.'
          : '.'}
      </Typography>
      {periods.map((period) => (
        <Box
          key={period.key}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="body2">
            {period.label}
            <Typography component="span" variant="body2" color="text.secondary">
              {' '}
              · {targetText(period.draw)}
            </Typography>
          </Typography>
          <TargetStatusChip evaluation={period.draw} />
        </Box>
      ))}
    </Stack>
  )
}
