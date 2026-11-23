'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material'
import { ApiError } from '@bakery/shared/data-access'
import { useOptionalSession } from '../../../lib/session'
import NumberPad, {
  type PadTarget,
} from '../../../components/sprache/NumberPad'
import MicButton from '../../../components/sprache/MicButton'
import type { VoiceEntry } from '../../../components/sprache/VoiceSheet'
import { REST_COUNT_WRITE_ROLES } from '../../../lib/roles'
import { describeBackstubeError } from '../../../lib/backstubeErrors'
import {
  addDaysIso,
  dayKindText,
  draftChanges,
  draftConflicts,
  fetchRestDay,
  formatDayShort,
  formatNumber,
  formatQtyUnit,
  listDraftDates,
  loadDraft,
  pruneDraft,
  rebaseDraft,
  rowKey,
  saveRestDay,
  setDraftEntry,
  shownQty,
  stepQty,
  storeDraft,
  type RestConflict,
  type RestCountRow,
  type RestDay,
  type RestDraft,
  type RestDraftEntry,
  type RestLine,
} from '../../../lib/restApi'
import {
  EmptyState,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../components/layout'

/** Hinweis, wenn ein aufgehobener Entwurf auf einem alten Stand beruht. */
export const DRAFT_STALE_MESSAGE =
  'Seit deiner Eingabe wurde auf einem anderen Gerät gezählt. Nichts wurde überschrieben.'

/** Breite der festen Seitenleiste ab `md` (admin/layout.tsx `drawerWidth`). */
const SIDEBAR_WIDTH = 280

/** Schaltflächen am Tablet: mindestens 44 px, die Zählknöpfe größer. */
const TOUCH = 56
const ALERT_TOUCH = {
  '& .MuiAlert-action .MuiButtonBase-root': { minHeight: 44, minWidth: 44 },
} as const

/**
 * Deutsch statt „Failed to fetch“ / „HTTP 502“ (Abschluss-Verifikation
 * next): kein Server → WLAN prüfen, 4xx → die deutsche API-Meldung, 5xx →
 * Serverfehler mit Code. Dieselbe Regel wie am Backstube-Tablet.
 */
function errorMessage(error: unknown, fallback: string): string {
  return describeBackstubeError(error, fallback).text
}

function conflictKey(
  c: Pick<RestConflict, 'itemId' | 'variant' | 'productId'>
) {
  return rowKey(
    { itemId: c.itemId, variant: c.variant },
    { productId: c.productId }
  )
}

function longDate(iso: string, weekdayName: string | null): string {
  const [y, m, d] = iso.split('-')
  return `${weekdayName ? `${weekdayName}, ` : ''}${d}.${m}.${y}`
}

function timeOf(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  })
}

// ------------------------------------------------------------ Ziffernblock

// ------------------------------------------------------------------ Zeile

function bakedText(line: RestLine, confirmed: boolean): string {
  if (confirmed && line.baked !== null) {
    const cap =
      line.cap > 0 ? ` · davon CAP ${formatQtyUnit(line.cap, line.unit)}` : ''
    return `gebacken ${formatQtyUnit(line.baked, line.unit)}${cap}`
  }
  if (line.planned !== null) {
    return `geplant ${formatQtyUnit(line.planned, line.unit)}`
  }
  return 'nicht auf dem Backzettel'
}

function CountLine({
  line,
  draft,
  confirmed,
  writable,
  conflictKeys,
  onChange,
  onPad,
}: {
  line: RestLine
  draft: RestDraft
  confirmed: boolean
  writable: boolean
  conflictKeys: Map<string, RestConflict>
  onChange: (line: RestLine, row: RestCountRow, value: number | null) => void
  onPad: (target: PadTarget) => void
}) {
  const values = line.rows.map((row) => shownQty(draft, line, row))
  const dirty = line.rows.some((row) => rowKey(line, row) in draft)
  const conflict = line.rows.some((row) => conflictKeys.has(rowKey(line, row)))
  const allZero = values.every((v) => v === 0)
  const title = line.variantLabel
    ? `${line.name} · ${line.variantLabel}`
    : line.name
  // Den Produktnamen nur zeigen, wenn er etwas sagt: mehrere Produkte am
  // Posten (Kuchen ganz / Stück) oder gezählt wird in einer anderen Einheit.
  const showRowLabels =
    line.rows.length > 1 ||
    line.rows.some((r) => r.unit !== line.unit || r.factor !== 1 || r.stale)
  return (
    <Paper
      variant="outlined"
      data-testid={`rest-line-${line.key}`}
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderColor: conflict
          ? 'error.main'
          : dirty
          ? 'primary.main'
          : 'divider',
        borderWidth: dirty || conflict ? 2 : 1,
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 1, sm: 2 }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={600} component="h3">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {bakedText(line, confirmed)}
            {line.counted && line.rest !== null && line.unit !== 'Stück'
              ? ` · Rest ${formatQtyUnit(line.rest, line.unit)}`
              : ''}
          </Typography>
          {line.rows.map((row) => {
            // Was das andere Gerät gespeichert hat, direkt an der Zeile -
            // die Meldung oben liegt am Tablet oft außer Sicht.
            const other = conflictKeys.get(rowKey(line, row))
            if (!other) return null
            return (
              <Typography
                key={`conflict-${row.productId || 'item'}`}
                variant="body2"
                color="error"
                fontWeight={600}
                data-testid={`rest-conflict-${line.key}`}
              >
                {line.rows.length > 1 ? `${row.label}: ` : ''}
                Inzwischen gespeichert: {formatNumber(other.qty)}
                {other.countedBy ? ` von ${other.countedBy.displayName}` : ''}
                {' · '}deine Eingabe: {formatNumber(shownQty(draft, line, row))}
              </Typography>
            )
          })}
          {line.restExceedsShop && (
            <Typography
              variant="body2"
              color="text.primary"
              fontWeight={600}
              data-testid={`rest-exceeds-${line.key}`}
            >
              Mehr übrig als für den Laden gebacken - bitte nachzählen.
            </Typography>
          )}
        </Box>
        <Stack spacing={1} sx={{ flexShrink: 0 }}>
          {line.rows.map((row, i) => {
            const value = values[i]
            const label = `${title}${
              showRowLabels && row.label !== line.name ? ` (${row.label})` : ''
            }`
            return (
              <Stack
                key={row.productId || 'item'}
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent={{ xs: 'space-between', sm: 'flex-end' }}
                sx={
                  draft[rowKey(line, row)]?.source === 'sprache'
                    ? {
                        '@media (prefers-reduced-motion: no-preference)': {
                          animation: 'restVoiceHighlight 1.5s ease-out',
                          '@keyframes restVoiceHighlight': {
                            from: { backgroundColor: 'action.selected' },
                            to: { backgroundColor: 'transparent' },
                          },
                        },
                      }
                    : undefined
                }
              >
                {showRowLabels && (
                  <Typography
                    variant="body2"
                    sx={{
                      minWidth: 0,
                      flex: { xs: 1, sm: 'none' },
                      maxWidth: { sm: 160 },
                      mr: 1,
                    }}
                  >
                    {row.label}
                    {row.stale ? ' (nicht mehr am Posten)' : ''}
                  </Typography>
                )}
                <IconButton
                  aria-label={`${label}: weniger`}
                  disabled={!writable || value === null || value <= 0}
                  onClick={() =>
                    onChange(line, row, stepQty(value, row.step, -1))
                  }
                  sx={{
                    width: TOUCH,
                    height: TOUCH,
                    border: 1,
                    borderColor: 'divider',
                  }}
                >
                  <RemoveIcon />
                </IconButton>
                <Button
                  variant="outlined"
                  color={value === null ? 'inherit' : 'primary'}
                  aria-label={`${label}: Menge eingeben`}
                  disabled={!writable}
                  onClick={() => onPad({ line, row, value })}
                  sx={{
                    minWidth: 88,
                    height: TOUCH,
                    fontSize: '1.4rem',
                    fontVariantNumeric: 'tabular-nums',
                    flexDirection: 'column',
                    lineHeight: 1.1,
                  }}
                >
                  {value === null ? '–' : formatNumber(value)}
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                  >
                    {row.unit === 'Stück' ? 'St.' : row.unit}
                  </Typography>
                </Button>
                <IconButton
                  aria-label={`${label}: mehr`}
                  disabled={!writable || (value !== null && value >= 10000)}
                  onClick={() =>
                    onChange(line, row, stepQty(value, row.step, 1))
                  }
                  sx={{
                    width: TOUCH,
                    height: TOUCH,
                    border: 1,
                    borderColor: 'divider',
                  }}
                >
                  <AddIcon />
                </IconButton>
              </Stack>
            )
          })}
        </Stack>
        <Button
          variant={allZero ? 'contained' : 'outlined'}
          color={allZero ? 'success' : 'inherit'}
          disabled={!writable}
          aria-pressed={allZero}
          aria-label={`${title}: nichts übrig`}
          onClick={() => line.rows.forEach((row) => onChange(line, row, 0))}
          sx={{ minHeight: TOUCH, minWidth: { sm: 136 }, flexShrink: 0 }}
        >
          Nichts übrig
        </Button>
      </Stack>
    </Paper>
  )
}

// ------------------------------------------------------------------ Seite

export interface RestClientProps {
  /** `?date=`; ohne Angabe nimmt der Server heute (Berlin). */
  initialDate?: string
}

export default function RestClient({ initialDate }: RestClientProps) {
  const router = useRouter()
  const session = useOptionalSession()
  const role = session?.user?.role ?? null
  const mayCount = role !== null && REST_COUNT_WRITE_ROLES.includes(role)
  // Entwürfe nur für Rollen, die zählen, und je Person: Wer nur liest, sieht
  // immer den Server-Stand; an der PIN-Station erbt niemand die Zahlen der
  // vorigen Person.
  const userId = session?.user?.id ?? null
  const draftOwner = mayCount && userId !== null ? userId : null

  const [date, setDate] = useState<string | undefined>(initialDate)
  const [day, setDay] = useState<RestDay | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState<RestDraft>({})
  const [pad, setPad] = useState<PadTarget | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<RestConflict[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [undoVoice, setUndoVoice] = useState<
    {
      key: string
      before: RestDraftEntry | undefined
      applied: RestDraftEntry | undefined
    }[]
  >([])
  const requestId = useRef(0)

  const load = useCallback(
    async (target?: string) => {
      const id = ++requestId.current
      setLoading(true)
      setLoadError(null)
      try {
        const result = await fetchRestDay(target)
        if (id !== requestId.current) return
        setDay(result)
        if (draftOwner === null) {
          setDraft({})
          return
        }
        const stored = pruneDraft(result, loadDraft(draftOwner, result.date))
        // Mit Zählliste ist ein Eintrag ohne passende Zeile nicht mehr zu
        // speichern - aufräumen, sonst meldete der Hinweis „Ungespeicherte
        // Zählung an anderen Tagen“ ihn für immer. Ohne Zählliste (hq kurz
        // weg) bleibt der Entwurf unangetastet.
        if (result.status === 'ok') storeDraft(draftOwner, result.date, stored)
        const stale = draftConflicts(result, stored)
        if (stale.length > 0) {
          // Ein anderes Tablet hat gezählt, seit die Eingaben gemacht wurden:
          // zeigen wie eine 409 - erst ein erneutes Speichern überschreibt.
          setConflicts(stale)
          setSaveError(DRAFT_STALE_MESSAGE)
          setDraft(rebaseDraft(result, stored))
        } else {
          setDraft(stored)
        }
      } catch (error) {
        if (id !== requestId.current) return
        // Ein anderer Tag ließ sich nicht laden: den alten nicht weiter unter
        // dem neuen Datum (URL) zeigen - sonst zählte man in den falschen Tag.
        setDay((prev) =>
          target !== undefined && prev && prev.date !== target ? null : prev
        )
        setLoadError(
          errorMessage(error, 'Die Zählliste konnte nicht geladen werden.')
        )
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    [draftOwner]
  )

  useEffect(() => {
    setUndoVoice([])
    void load(date)
  }, [date, load])

  const writable = !!day && day.editable && mayCount && !saving
  // Außerhalb des Zählfensters (oder ohne Zählliste) nimmt die API nichts an:
  // dann kein „Speichern“, das immer scheitert - nur „Verwerfen“.
  const savable = !!day && day.editable && mayCount

  const changes = useMemo(
    () => (day ? draftChanges(day, draft) : []),
    [day, draft]
  )

  const progress = useMemo(() => {
    if (!day) return { counted: 0, total: 0 }
    let counted = 0
    for (const line of day.lines) {
      if (line.rows.every((row) => shownQty(draft, line, row) !== null)) {
        counted += 1
      }
    }
    return { counted, total: day.lines.length }
  }, [day, draft])

  const conflictKeys = useMemo(
    () => new Map(conflicts.map((c) => [conflictKey(c), c] as const)),
    [conflicts]
  )

  // Ungespeicherte Eingaben an anderen Tagen (auf diesem Gerät, dieser Person).
  const [otherDraftDates, setOtherDraftDates] = useState<string[]>([])
  useEffect(() => {
    if (draftOwner === null || !day) {
      setOtherDraftDates([])
      return
    }
    setOtherDraftDates(listDraftDates(draftOwner).filter((d) => d !== day.date))
  }, [draftOwner, day, draft])

  const sections = useMemo(() => {
    const out: { label: string; lines: RestLine[] }[] = []
    for (const line of day?.lines ?? []) {
      const label = line.sectionLabel || 'Sonstiges'
      const last = out[out.length - 1]
      if (last && last.label === label) last.lines.push(line)
      else out.push({ label, lines: [line] })
    }
    return out
  }, [day])

  const change = useCallback(
    (line: RestLine, row: RestCountRow, value: number | null) => {
      if (!day || draftOwner === null) return
      setDraft((prev) => {
        const next = setDraftEntry(prev, rowKey(line, row), row.qty, value)
        storeDraft(draftOwner, day.date, next)
        return next
      })
    },
    [day, draftOwner]
  )

  const applyVoice = (entries: VoiceEntry[]) => {
    if (!day || draftOwner === null || !writable || loading) return
    const byKey = new Map(
      day.lines.flatMap((line) =>
        line.rows.map((row) => [rowKey(line, row), row] as const)
      )
    )
    let next = draft
    const affected: string[] = []
    for (const { key, qty } of entries) {
      const row = byKey.get(key)
      if (!row || row.stale) continue
      const entry = next[key]
      if ((entry ? entry.qty : row.qty) !== qty) {
        next = setDraftEntry(next, key, row.qty, qty, 'sprache')
        affected.push(key)
      }
    }
    if (affected.length === 0) return
    setDraft(next)
    storeDraft(draftOwner, day.date, next)
    setUndoVoice(
      affected.map((key) => ({ key, before: draft[key], applied: next[key] }))
    )
  }

  const undoVoiceChange = () => {
    if (!day || draftOwner === null || saving) return
    const restored = { ...draft }
    for (const { key, before, applied } of undoVoice) {
      if (draft[key] !== applied) continue
      // Die Grundlage des vorherigen Entwurfs bleibt erhalten. Seitdem
      // gespeicherte fremde Werte müssen beim PUT erneut erkannt werden.
      if (before) restored[key] = before
      else delete restored[key]
    }
    setDraft(restored)
    storeDraft(draftOwner, day.date, restored)
    const pending = pruneDraft(day, restored)
    const remainingConflicts = new Map(
      conflicts
        .filter((entry) => pending[conflictKey(entry)])
        .map((entry) => [conflictKey(entry), entry])
    )
    for (const entry of draftConflicts(day, restored)) {
      remainingConflicts.set(conflictKey(entry), entry)
    }
    setConflicts(Array.from(remainingConflicts.values()))
    if (conflicts.length > 0 && remainingConflicts.size === 0)
      setSaveError(null)
    setUndoVoice([])
  }

  const goTo = (target: string) => {
    if (saving) return
    setConflicts([])
    setSaveError(null)
    setDate(target)
    router.replace(`/admin/rest?date=${target}`, { scroll: false })
  }

  const discard = () => {
    if (!day) return
    if (draftOwner !== null) storeDraft(draftOwner, day.date, {})
    setDraft({})
    setUndoVoice([])
    setConflicts([])
    setSaveError(null)
  }

  const save = async () => {
    if (!day || saving || changes.length === 0) return
    setSaving(true)
    setSaveError(null)
    try {
      const fromVoice = Object.values(pruneDraft(day, draft)).some(
        (entry) => entry.source === 'sprache'
      )
      const result = fromVoice
        ? await saveRestDay(day.date, changes, 'sprache')
        : await saveRestDay(day.date, changes)
      setDay(result)
      const rest = pruneDraft(result, draft)
      if (draftOwner !== null) storeDraft(draftOwner, result.date, rest)
      setDraft(rest)
      setUndoVoice([])
      setConflicts([])
      setToast(
        result.changed === 1
          ? '1 Zählung gespeichert.'
          : `${result.changed ?? changes.length} Zählungen gespeichert.`
      )
    } catch (error) {
      if (error instanceof ApiError && error.code === 'rest_changed') {
        const current = Array.isArray(error.details?.current)
          ? (error.details?.current as RestConflict[])
          : []
        setConflicts(current)
        setSaveError(error.message)
        // Neu laden: der Entwurf bleibt, seine Grundlage ist jetzt der neue
        // Stand - die Person hat die Abweichung gesehen, ein erneutes
        // Speichern gilt. Gespeichert im Browser wird die neue Grundlage erst
        // mit der nächsten Eingabe; ein Neuladen zeigt den Hinweis wieder.
        try {
          const fresh = await fetchRestDay(day.date)
          setDay(fresh)
          const rebased = rebaseDraft(fresh, draft)
          setDraft(rebased)
          setUndoVoice((entries) =>
            entries
              .filter(({ key, applied }) => draft[key] === applied)
              .map((entry) => ({ ...entry, applied: rebased[entry.key] }))
          )
        } catch {
          // Bleibt beim alten Stand; der Hinweis oben sagt, was los ist.
        }
      } else {
        setSaveError(
          errorMessage(
            error,
            'Nicht gespeichert - deine Eingaben stehen noch da.'
          )
        )
      }
    } finally {
      setSaving(false)
    }
  }

  const undoCount = undoVoice.length
  const confirmed = day?.backzettelStatus === 'confirmed'
  const canPrev = !!day && day.date > day.window.from
  const canNext = !!day && day.date < day.window.to

  const showSaveBar = !!day && mayCount && (changes.length > 0 || saving)
  const backzettelChip =
    day && day.status === 'ok' ? (
      <Chip
        size="small"
        label={
          confirmed
            ? 'Backzettel freigegeben'
            : day.backzettelStatus === 'draft'
            ? 'Backzettel nicht freigegeben - Mengen geplant'
            : 'Kein Backzettel'
        }
        color={confirmed ? 'success' : 'default'}
        variant="outlined"
        sx={{ maxWidth: '100%' }}
      />
    ) : null

  return (
    <PageLayout
      title="Rest am Abend"
      subtitle={
        day ? longDate(day.date, day.weekdayName) : 'Zählung bei Ladenschluss'
      }
      status={backzettelChip}
      actions={
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              aria-label="Tag davor"
              disabled={!canPrev || loading || saving}
              onClick={() => day && goTo(addDaysIso(day.date, -1))}
              sx={{ width: 48, height: 48, border: 1, borderColor: 'divider' }}
            >
              <PrevIcon />
            </IconButton>
            <Button
              variant="outlined"
              disabled={!day || day.date === day.today || loading || saving}
              onClick={() => day && goTo(day.today)}
              sx={{ minHeight: 48, flex: { xs: 1, sm: 'none' } }}
            >
              Heute
            </Button>
            <IconButton
              aria-label="Tag danach"
              disabled={!canNext || loading || saving}
              onClick={() => day && goTo(addDaysIso(day.date, 1))}
              sx={{ width: 48, height: 48, border: 1, borderColor: 'divider' }}
            >
              <NextIcon />
            </IconButton>
          </Box>
          {role === 'inhaber' && (
            <Button
              component={Link}
              href="/admin/rest/auswertung"
              variant="outlined"
              sx={{ minHeight: 48 }}
            >
              Auswertung
            </Button>
          )}
        </>
      }
    >
      {loading && !day && !loadError && (
        <LoadingState label="Zählliste wird geladen …" />
      )}

      {loadError && (
        <Alert
          severity="error"
          sx={ALERT_TOUCH}
          action={
            <Button color="inherit" onClick={() => void load(date)}>
              Erneut versuchen
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      {day && day.status === 'no-config' && (
        <Alert severity="warning">
          <AlertTitle>Keine Zählliste</AlertTitle>
          {day.editIssue}
        </Alert>
      )}
      {day && (day.status === 'ruhetag' || day.status === 'geschlossen') && (
        <Alert severity="info" data-testid="rest-closed-day">
          {day.editIssue}
        </Alert>
      )}
      {/* Z14: Sonderöffnung, „wie Sonntag“, Tag vor einem Schließtag */}
      {day && day.status === 'ok' && dayKindText(day.dayKind) && (
        <Alert severity="info" data-testid="rest-day-kind">
          {dayKindText(day.dayKind)}
        </Alert>
      )}
      {day && day.status === 'ok' && !day.editable && day.editIssue && (
        <Alert severity="info">{day.editIssue}</Alert>
      )}
      {day && day.status === 'ok' && day.editable && !mayCount && (
        <Alert severity="info">Nur ansehen - gezählt wird vom Verkauf.</Alert>
      )}
      {day && otherDraftDates.length > 0 && (
        <Alert severity="warning" data-testid="rest-other-drafts">
          <AlertTitle>Ungespeicherte Zählung an anderen Tagen</AlertTitle>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {otherDraftDates.map((d) => (
              <Button
                key={d}
                size="small"
                variant="outlined"
                color="inherit"
                onClick={() => goTo(d)}
                sx={{ minHeight: 44 }}
              >
                {formatDayShort(d)} öffnen
              </Button>
            ))}
          </Stack>
        </Alert>
      )}
      {day && saveError && (
        <Alert
          severity={conflicts.length > 0 ? 'warning' : 'error'}
          sx={ALERT_TOUCH}
          onClose={() => setSaveError(null)}
          data-testid="save-error"
        >
          {conflicts.length > 0 && (
            <AlertTitle>Inzwischen anders gezählt</AlertTitle>
          )}
          {saveError}
          {conflicts.length > 0 && (
            <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
              {conflicts.map((c) => (
                <li key={`${c.itemId}|${c.variant || ''}|${c.productId}`}>
                  {c.name || c.itemId}: {formatNumber(c.qty)}
                  {c.countedBy ? ` (${c.countedBy.displayName})` : ''}
                </li>
              ))}
            </Box>
          )}
          {conflicts.length > 0 && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Deine Eingaben stehen noch da. Prüfen und erneut speichern - dann
              gilt deine Zahl.
            </Typography>
          )}
        </Alert>
      )}

      {day && day.status === 'ok' && day.lines.length > 0 && (
        <PageSection>
          <Stack
            direction="row"
            justifyContent="space-between"
            flexWrap="wrap"
            columnGap={2}
          >
            <Typography
              variant="body1"
              fontWeight={600}
              data-testid="rest-progress"
            >
              {progress.counted} von {progress.total} gezählt
            </Typography>
            {changes.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {changes.length} ungespeichert
              </Typography>
            )}
          </Stack>
          <LinearProgress
            variant={loading ? 'indeterminate' : 'determinate'}
            value={
              progress.total ? (progress.counted / progress.total) * 100 : 0
            }
            aria-label={loading ? 'Lädt' : 'Fortschritt der Zählung'}
            sx={{ height: 8, borderRadius: 1, mt: 1 }}
          />
          {day.summary.lastCountedAt && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Zuletzt gespeichert {timeOf(day.summary.lastCountedAt)} Uhr
              {day.summary.lastCountedBy
                ? ` · ${day.summary.lastCountedBy.displayName}`
                : ''}
            </Typography>
          )}
        </PageSection>
      )}
      {day && loading && !(day.status === 'ok' && day.lines.length > 0) && (
        <LinearProgress aria-label="Lädt" />
      )}

      {day && day.status === 'ok' && day.lines.length === 0 && (
        <EmptyState title="Für diesen Tag steht nichts auf dem Backzettel." />
      )}

      {day &&
        sections.map((section) => (
          <PageSection
            key={section.label}
            title={section.label}
            variant="plain"
          >
            <Stack spacing={1}>
              {section.lines.map((line) => (
                <CountLine
                  key={line.key}
                  line={line}
                  draft={draft}
                  confirmed={confirmed}
                  writable={writable}
                  conflictKeys={conflictKeys}
                  onChange={change}
                  onPad={setPad}
                />
              ))}
            </Stack>
          </PageSection>
        ))}

      {day &&
        draftOwner !== null &&
        writable &&
        !loading &&
        day.lines.length > 0 && (
          <MicButton
            key={`${draftOwner}:${day.date}`}
            day={day}
            draft={draft}
            userId={draftOwner}
            saveBar={showSaveBar}
            onApply={applyVoice}
          />
        )}

      {/* Platz, damit die feste Leiste die letzten Zeilen nicht verdeckt. */}
      {showSaveBar && <Box aria-hidden sx={{ height: 72 }} />}

      {day && showSaveBar && (
        <Paper
          elevation={8}
          data-testid="rest-save-bar"
          sx={{
            // fest unten am Bildschirm: der <main> des Admin-Layouts scrollt
            // nicht selbst, `sticky` bliebe am Ende der langen Liste hängen.
            // Ab `md` steht links die Seitenleiste (280 px, admin/layout.tsx).
            position: 'fixed',
            bottom: 0,
            left: { xs: 0, md: SIDEBAR_WIDTH },
            right: 0,
            borderRadius: 0,
            px: { xs: 2, sm: 3 },
            py: 1.5,
            pb: 'calc(12px + env(safe-area-inset-bottom))',
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            zIndex: (t) => t.zIndex.appBar - 1,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2">
              {changes.length === 1
                ? '1 Änderung'
                : `${changes.length} Änderungen`}
            </Typography>
            {/* Die Meldung auch hier: oben liegt sie am Tablet außer Sicht. */}
            {!savable ? (
              <Typography
                variant="body2"
                color="text.secondary"
                role="status"
                data-testid="rest-save-bar-message"
              >
                {day.editIssue ||
                  'Dieser Tag kann nicht mehr gespeichert werden.'}
              </Typography>
            ) : saveError ? (
              <Typography
                variant="body2"
                color="error"
                fontWeight={600}
                role="alert"
                data-testid="rest-save-bar-message"
              >
                {conflicts.length > 0
                  ? `Inzwischen anders gezählt (${conflicts.length}) - an den rot markierten Zeilen prüfen.`
                  : saveError}
              </Typography>
            ) : null}
          </Box>
          <Button
            onClick={discard}
            disabled={saving}
            color="inherit"
            sx={{ minHeight: 48 }}
          >
            Verwerfen
          </Button>
          {savable && (
            <Button
              variant="contained"
              onClick={() => void save()}
              disabled={saving || changes.length === 0}
              sx={{ minHeight: 48, minWidth: 140 }}
            >
              {saving
                ? 'Speichert …'
                : conflicts.length > 0
                ? 'Meine Zahlen speichern'
                : 'Speichern'}
            </Button>
          )}
        </Paper>
      )}

      <NumberPad
        target={pad}
        onClose={() => setPad(null)}
        onApply={(value) => {
          if (pad) change(pad.line, pad.row, value)
          setPad(null)
        }}
      />

      <Snackbar
        open={!!toast || undoCount > 0}
        autoHideDuration={undoCount ? (saving ? null : 8000) : 3000}
        onClose={(_, reason) => {
          if (undoCount && (saving || reason === 'clickaway')) return
          setToast(null)
          setUndoVoice([])
        }}
        message={
          undoCount
            ? `${undoCount} ${undoCount === 1 ? 'Zeile' : 'Zeilen'} übernommen`
            : toast
        }
        action={
          undoCount > 0 && (
            <Button color="inherit" onClick={undoVoiceChange} disabled={saving}>
              Rückgängig
            </Button>
          )
        }
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
    </PageLayout>
  )
}
