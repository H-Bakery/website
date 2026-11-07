'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  ListItemButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import {
  fetchBackzettelConfig,
  fetchBackzettelDay,
  isBackzettelDay,
  type BackzettelConfigResponse,
  type BackzettelDayResult,
} from '../../../lib/backzettelApi'
import {
  describeProductionDays,
  formatDateLong,
  formatTimestamp,
  isIsoDate,
  nextProductionDay,
  openDeltas,
  linesWithPreorders,
  todayIso,
  upcomingProductionDays,
} from '../../../lib/backzettelFormat'
import { BackzettelStatusChip } from '../../../components/backzettel/BackzettelStatusChip'
import { useOptionalSession } from '../../../lib/session'
import { isPathAllowedForRole } from '../../../lib/roles'
import { backzettelErrorText } from '../../../lib/backstubeErrors'
import {
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../components/layout'

const GRUNDMENGEN_HREF = '/admin/backzettel/grundmengen'

type DayEntry =
  | { date: string; state: 'loading' }
  | { date: string; state: 'loaded'; result: BackzettelDayResult }
  | { date: string; state: 'error'; message: string }

function messageOf(error: unknown, fallback: string): string {
  return backzettelErrorText(error, fallback)
}

/** Zweite Zeile eines Tages: Vorbestellungen, Hinweise, Hefeteig, Freigabe. */
function summaryText(result: BackzettelDayResult): string {
  if (!isBackzettelDay(result)) return ''
  const preorderLines = linesWithPreorders(result)
  const parts = [
    preorderLines > 0
      ? `Vorbestellungen in ${preorderLines} ${
          preorderLines === 1 ? 'Zeile' : 'Zeilen'
        }`
      : 'keine Vorbestellungen',
  ]
  if (result.warnings.length > 0) {
    parts.push(
      `${result.warnings.length} ${
        result.warnings.length === 1 ? 'Hinweis' : 'Hinweise'
      }`
    )
  }
  if ((result.hefeteig?.doughs?.length ?? 0) > 0) parts.push('Hefeteig')
  if (result.status === 'confirmed' && result.confirmedBy) {
    parts.push(
      `freigegeben von ${result.confirmedBy.displayName}${
        result.confirmedAt ? ` am ${formatTimestamp(result.confirmedAt)}` : ''
      }`
    )
  }
  return parts.join(' · ')
}

/**
 * Status eines Tages: höchstens zwei Chips (Entwurf/Freigegeben und offene
 * Nachträge) - alles Weitere steht als Text darunter (Layout-Kit: Nebenwerte
 * als zweite Zeile, nicht als eigener Chip).
 */
function DayStatus({ entry }: { entry: DayEntry }) {
  if (entry.state === 'loading') {
    return <CircularProgress size={20} aria-label="wird geladen" />
  }
  if (entry.state === 'error') {
    // Der Grund steht einmal oben (UI-Runde 1) - nicht in jeder Zeile.
    return (
      <Chip
        size="small"
        color="error"
        variant="outlined"
        label="Nicht geladen"
        data-testid={`day-error-${entry.date}`}
      />
    )
  }
  const result = entry.result
  if (result.status === 'no-config') {
    return (
      <Chip
        size="small"
        color="warning"
        variant="outlined"
        label="Keine Stammdaten"
      />
    )
  }
  if (result.status === 'ruhetag') {
    return <Chip size="small" variant="outlined" label="Ruhetag" />
  }
  const open = openDeltas(result).length
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <BackzettelStatusChip status={result.status} />
      {open > 0 && (
        <Chip
          size="small"
          color="warning"
          label={`${open} ${open === 1 ? 'Nachtrag' : 'Nachträge'} offen`}
        />
      )}
    </Stack>
  )
}

function DaySummaryLine({ entry }: { entry: DayEntry }) {
  if (entry.state !== 'loaded') return null
  const text = summaryText(entry.result)
  if (!text) return null
  return (
    <Typography variant="body2" color="text.secondary">
      {text}
    </Typography>
  )
}

export interface BackzettelOverviewClientProps {
  /** Für Tests; sonst das heutige Datum des Geräts. */
  today?: string
}

/**
 * Übersicht der kommenden Produktionstage (Z5, roadmap §5.5): je Tag Status
 * (Entwurf/Freigegeben), offene Nachträge und Hinweise. Der nächste
 * Produktionstag - der, den man heute plant - steht hervorgehoben oben.
 */
export default function BackzettelOverviewClient({
  today: todayProp,
}: BackzettelOverviewClientProps) {
  const router = useRouter()
  const session = useOptionalSession()
  // Z4: Grundmengen pflegen nur Rollen, die die Seite öffnen dürfen
  // (Inhaber, Backstube) - Verkauf liest den Backzettel ohne den Link.
  const role = session?.user?.role ?? null
  // W4-verify r3: wie die Tagesseite - planen dürfen Inhaber und Backstube;
  // für alle anderen heißt der Knopf „Ansehen“, nicht „Planen“.
  const canPlan = role === 'inhaber' || role === 'backstube'
  const showGrundmengen =
    role !== null &&
    isPathAllowedForRole(GRUNDMENGEN_HREF, role, session?.sessionKind ?? null)
  const [today] = React.useState(() => todayProp ?? todayIso())
  const [config, setConfig] = React.useState<BackzettelConfigResponse | null>(
    null
  )
  const [configError, setConfigError] = React.useState<string | null>(null)
  const [entries, setEntries] = React.useState<DayEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [jump, setJump] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true)
    setConfigError(null)
    let cfg: BackzettelConfigResponse | null = null
    try {
      cfg = await fetchBackzettelConfig()
      setConfig(cfg)
    } catch (error) {
      setConfigError(
        messageOf(
          error,
          'Die Backzettel-Stammdaten konnten nicht geladen werden.'
        )
      )
    }
    const days = cfg?.config?.days ?? null
    const dates = upcomingProductionDays(today, days, 7)
    setEntries(dates.map((date) => ({ date, state: 'loading' })))
    const results = await Promise.all(
      dates.map(async (date): Promise<DayEntry> => {
        try {
          return {
            date,
            state: 'loaded',
            result: await fetchBackzettelDay(date),
          }
        } catch (error) {
          return {
            date,
            state: 'error',
            message: messageOf(error, 'Konnte nicht geladen werden.'),
          }
        }
      })
    )
    setEntries(results)
    setLoading(false)
  }, [today])

  React.useEffect(() => {
    void load()
  }, [load])

  // UI-Runde 1: ein Fehler steht einmal da, nicht in jeder Zeile. Ging gar
  // nichts, gibt es nur den Fehler mit „Erneut versuchen“ - keine Karten mit
  // aktivem „Öffnen“ über leeren Tagen.
  const failed = entries.filter(
    (e): e is Extract<DayEntry, { state: 'error' }> => e.state === 'error'
  )
  const allFailed =
    !loading && entries.length > 0 && failed.length === entries.length
  const errorMessage = configError ?? failed[0]?.message ?? null
  const retry = () => void load()

  const days = config?.config?.days ?? null
  const next = nextProductionDay(today, days)
  const nextEntry = entries.find((e) => e.date === next)
  const nextResult =
    nextEntry && nextEntry.state === 'loaded' ? nextEntry.result : null

  const nextAction = !canPlan
    ? 'Ansehen'
    : isBackzettelDay(nextResult) && nextResult.status === 'draft'
    ? 'Planen'
    : 'Öffnen'

  const jumpForm = (
    <Box
      component="form"
      aria-label="Anderen Tag öffnen"
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault()
        if (isIsoDate(jump)) router.push(`/admin/backzettel/${jump}`)
      }}
      sx={{
        display: 'flex',
        gap: 1,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <TextField
        type="date"
        size="small"
        label="Anderer Tag"
        value={jump}
        onChange={(e) => setJump(e.target.value)}
        InputLabelProps={{ shrink: true }}
        inputProps={{ 'aria-label': 'Anderer Tag' }}
        sx={{ flex: { xs: '1 1 10rem', sm: '0 0 auto' } }}
      />
      <Button
        type="submit"
        variant="outlined"
        disabled={!isIsoDate(jump)}
        sx={{ minHeight: 44 }}
      >
        Öffnen
      </Button>
    </Box>
  )

  return (
    <PageLayout
      title="Backzettel"
      subtitle={describeProductionDays(days)}
      actions={
        showGrundmengen ? (
          <Button
            component={Link}
            href={GRUNDMENGEN_HREF}
            variant="outlined"
            sx={{ minHeight: 44, whiteSpace: 'nowrap' }}
          >
            Grundmengen
          </Button>
        ) : undefined
      }
    >
      {allFailed ? (
        <ErrorState
          title="Backzettel konnten nicht geladen werden"
          message={errorMessage}
          onRetry={retry}
          data-testid="overview-error"
        />
      ) : (
        (configError || (!loading && failed.length > 0)) && (
          <ErrorState
            message={
              failed.length > 0
                ? `${failed.length} von ${entries.length} Tagen nicht geladen: ${failed[0].message}`
                : configError
            }
            onRetry={retry}
            data-testid="overview-error"
          />
        )
      )}
      {config?.status === 'no-config' && (
        <Alert severity="warning" data-testid="no-config">
          <AlertTitle>Keine Backzettel-Stammdaten</AlertTitle>
          Ohne gültige Stammdaten (<code>config/backzettel.yaml</code> in hq)
          rechnet die App keine Mengen. Bereits freigegebene Tage bleiben
          lesbar.
          {config.errors.length > 0 && (
            <Box component="ul" sx={{ mb: 0, pl: 2.5 }}>
              {config.errors.slice(0, 5).map((r, i) => (
                <li key={i}>{r.message}</li>
              ))}
            </Box>
          )}
        </Alert>
      )}

      {!allFailed && (
        <PageSection
          title={formatDateLong(next)}
          description="Nächster Produktionstag"
          data-testid="next-day"
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            {nextEntry ? (
              <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                <DayStatus entry={nextEntry} />
                <DaySummaryLine entry={nextEntry} />
              </Stack>
            ) : (
              <span />
            )}
            <Button
              component={Link}
              href={`/admin/backzettel/${next}`}
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              sx={{ minHeight: 48, minWidth: 160, flexShrink: 0 }}
            >
              {nextAction}
            </Button>
          </Box>
        </PageSection>
      )}

      {!allFailed && (
        <PageSection title="Nächste Tage" disablePadding actions={jumpForm}>
          {loading && entries.length === 0 ? (
            <LoadingState label="Backzettel werden geladen …" />
          ) : (
            <Box component="ul" data-testid="day-list" sx={{ m: 0, p: 0 }}>
              {entries.map((entry) => (
                <Box
                  component="li"
                  key={entry.date}
                  data-testid={`day-${entry.date}`}
                  sx={{
                    listStyle: 'none',
                    borderTop: 1,
                    borderColor: 'divider',
                  }}
                >
                  <ListItemButton
                    component={Link}
                    href={`/admin/backzettel/${entry.date}`}
                    sx={{
                      px: { xs: 2, md: 3 },
                      py: 1.5,
                      minHeight: 64,
                      gap: 2,
                      alignItems: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        columnGap: 2,
                        rowGap: 0.75,
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography
                            component="span"
                            sx={{ fontWeight: 600, fontSize: '1rem' }}
                          >
                            {formatDateLong(entry.date)}
                          </Typography>
                          {entry.date === today && (
                            <Chip size="small" color="primary" label="heute" />
                          )}
                        </Stack>
                        <DaySummaryLine entry={entry} />
                      </Box>
                      <DayStatus entry={entry} />
                    </Box>
                    <ChevronRightIcon
                      aria-hidden
                      sx={{ color: 'text.secondary', flexShrink: 0 }}
                    />
                  </ListItemButton>
                </Box>
              ))}
            </Box>
          )}
        </PageSection>
      )}
    </PageLayout>
  )
}
