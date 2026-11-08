'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
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

const GRUNDMENGEN_HREF = '/admin/backzettel/grundmengen'

type DayEntry =
  | { date: string; state: 'loading' }
  | { date: string; state: 'loaded'; result: BackzettelDayResult }
  | { date: string; state: 'error'; message: string }

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function DaySummary({ entry }: { entry: DayEntry }) {
  if (entry.state === 'loading') {
    return <CircularProgress size={20} aria-label="wird geladen" />
  }
  if (entry.state === 'error') {
    return (
      <Typography variant="body2" color="error">
        {entry.message}
      </Typography>
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
  const preorderLines = linesWithPreorders(result)
  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <BackzettelStatusChip status={result.status} />
        {open > 0 && (
          <Chip
            size="small"
            color="warning"
            label={`${open} ${open === 1 ? 'Nachtrag' : 'Nachträge'} offen`}
          />
        )}
        {result.warnings.length > 0 && (
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            label={`${result.warnings.length} ${
              result.warnings.length === 1 ? 'Hinweis' : 'Hinweise'
            }`}
          />
        )}
        {(result.hefeteig?.doughs?.length ?? 0) > 0 && (
          <Chip size="small" variant="outlined" label="Hefeteig" />
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {preorderLines > 0
          ? `Vorbestellungen in ${preorderLines} ${
              preorderLines === 1 ? 'Zeile' : 'Zeilen'
            }`
          : 'keine Vorbestellungen'}
        {result.status === 'confirmed' && result.confirmedBy
          ? ` · freigegeben von ${result.confirmedBy.displayName}${
              result.confirmedAt
                ? ` am ${formatTimestamp(result.confirmedAt)}`
                : ''
            }`
          : ''}
      </Typography>
    </Stack>
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

  const days = config?.config?.days ?? null
  const next = nextProductionDay(today, days)
  const nextEntry = entries.find((e) => e.date === next)
  const nextResult =
    nextEntry && nextEntry.state === 'loaded' ? nextEntry.result : null

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontSize: { xs: '1.6rem', sm: '2rem' } }}
          >
            Backzettel
          </Typography>
          <Typography color="text.secondary">
            {describeProductionDays(days)}
          </Typography>
        </Box>
        <Box
          component="form"
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
            label="Anderer Tag"
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'aria-label': 'Anderer Tag' }}
          />
          <Button
            type="submit"
            variant="outlined"
            disabled={!isIsoDate(jump)}
            sx={{ minHeight: 44 }}
          >
            Öffnen
          </Button>
          {showGrundmengen && (
            <Button
              component={Link}
              href={GRUNDMENGEN_HREF}
              variant="outlined"
              sx={{ minHeight: 44, whiteSpace: 'nowrap' }}
            >
              Grundmengen
            </Button>
          )}
        </Box>
      </Stack>

      {configError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {configError}
        </Alert>
      )}
      {config?.status === 'no-config' && (
        <Alert severity="warning" sx={{ mb: 2 }} data-testid="no-config">
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

      <Card
        variant="outlined"
        sx={{ mb: 3, borderColor: 'primary.main', borderWidth: 2 }}
        data-testid="next-day"
      >
        <CardContent>
          <Typography variant="overline" color="text.secondary">
            Nächster Produktionstag
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <Box>
              <Typography variant="h5" component="h2">
                {formatDateLong(next)}
              </Typography>
              {nextEntry ? (
                <Box sx={{ mt: 1 }}>
                  <DaySummary entry={nextEntry} />
                </Box>
              ) : null}
            </Box>
            <Button
              component={Link}
              href={`/admin/backzettel/${next}`}
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{ minHeight: 48 }}
            >
              {!canPlan
                ? 'Ansehen'
                : isBackzettelDay(nextResult) && nextResult.status === 'draft'
                ? 'Planen'
                : 'Öffnen'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
        Diese Woche
      </Typography>
      {loading && entries.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress aria-label="Backzettel werden geladen" />
        </Box>
      ) : (
        <Stack spacing={1.5} data-testid="day-list">
          {entries.map((entry) => (
            <Card
              key={entry.date}
              variant="outlined"
              data-testid={`day-${entry.date}`}
            >
              <CardActionArea
                component={Link}
                href={`/admin/backzettel/${entry.date}`}
                sx={{ p: 2, minHeight: 64 }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1" fontWeight={700}>
                      {formatDateLong(entry.date)}
                    </Typography>
                    {entry.date === today && (
                      <Chip size="small" color="primary" label="heute" />
                    )}
                    {entry.date === next && (
                      <Chip
                        size="small"
                        color="primary"
                        variant="outlined"
                        label="als Nächstes"
                      />
                    )}
                  </Stack>
                  <DaySummary entry={entry} />
                </Stack>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  )
}
