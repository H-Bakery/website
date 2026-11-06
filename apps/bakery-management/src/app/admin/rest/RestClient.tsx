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
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  Backspace as BackspaceIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material'
import { ApiError } from '@bakery/shared/data-access'
import { useOptionalSession } from '../../../lib/session'
import {
  addDaysIso,
  draftChanges,
  fetchRestDay,
  formatNumber,
  formatQtyUnit,
  loadDraft,
  parsePadInput,
  pruneDraft,
  rowKey,
  saveRestDay,
  shownQty,
  stepQty,
  storeDraft,
  type RestConflict,
  type RestCountRow,
  type RestDay,
  type RestDraft,
  type RestLine,
} from '../../../lib/restApi'

/** Wer zählen darf (wie `PUT /api/rest/:date`). */
export const COUNT_ROLES = ['inhaber', 'verkauf']

/** Breite der festen Seitenleiste ab `md` (admin/layout.tsx `drawerWidth`). */
const SIDEBAR_WIDTH = 280

/** Schaltflächen am Tablet: mindestens 44 px, die Zählknöpfe größer. */
const TOUCH = 56
const ALERT_TOUCH = {
  '& .MuiAlert-action .MuiButtonBase-root': { minHeight: 44, minWidth: 44 },
} as const

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Unbekannter Fehler.'
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

interface PadTarget {
  line: RestLine
  row: RestCountRow
  value: number | null
}

const PAD_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', '⌫']

function NumberPad({
  target,
  onClose,
  onApply,
}: {
  target: PadTarget | null
  onClose: () => void
  onApply: (value: number | null) => void
}) {
  const [text, setText] = useState('')
  const [fresh, setFresh] = useState(true)
  useEffect(() => {
    if (target) {
      setText(target.value === null ? '' : formatNumber(target.value))
      setFresh(true)
    }
  }, [target])
  if (!target) return null
  const integer = target.row.integer
  const parsed = parsePadInput(text, integer)
  const invalid = Number.isNaN(parsed as number)
  const press = (key: string) => {
    if (key === '⌫') {
      setFresh(false)
      setText((t) => (fresh ? '' : t.slice(0, -1)))
      return
    }
    if (key === ',' && integer) return
    setText((t) => {
      const base = fresh ? '' : t
      if (key === ',' && base.includes(',')) return base
      const next = `${base}${key}`
      return next.length > 7 ? base : next
    })
    setFresh(false)
  }
  const apply = () => {
    if (!invalid) onApply(parsed as number | null)
  }
  const title = target.line.variantLabel
    ? `${target.line.name} · ${target.line.variantLabel}`
    : target.line.name
  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="rest-pad-title"
      onKeyDown={(e) => {
        if (/^[0-9]$/.test(e.key)) press(e.key)
        else if (e.key === ',' || e.key === '.') press(',')
        else if (e.key === 'Backspace') press('⌫')
        else if (e.key === 'Enter') apply()
      }}
    >
      <DialogTitle id="rest-pad-title" sx={{ pb: 1 }}>
        {title}
        {target.row.label !== target.line.name && (
          <Typography variant="body2" color="text.secondary">
            {target.row.label}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Box
          role="status"
          aria-live="polite"
          data-testid="pad-display"
          sx={{
            border: 1,
            borderColor: invalid ? 'error.main' : 'divider',
            borderRadius: 1,
            px: 2,
            py: 1,
            mb: 2,
            textAlign: 'right',
            fontSize: '2.25rem',
            fontVariantNumeric: 'tabular-nums',
            minHeight: 64,
          }}
        >
          {text === '' ? (
            <Typography component="span" color="text.secondary" fontSize="1rem">
              nicht gezählt
            </Typography>
          ) : (
            <>
              {text}{' '}
              <Typography
                component="span"
                color="text.secondary"
                fontSize="1rem"
              >
                {target.row.unit}
              </Typography>
            </>
          )}
        </Box>
        {invalid && (
          <Typography color="error" variant="body2" sx={{ mb: 1 }}>
            {integer
              ? 'Bitte eine ganze Zahl bis 10000.'
              : 'Bitte eine Zahl bis 10000 mit höchstens zwei Nachkommastellen.'}
          </Typography>
        )}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
          }}
        >
          {PAD_KEYS.map((key) => (
            <Button
              key={key}
              variant="outlined"
              onClick={() => press(key)}
              disabled={key === ',' && integer}
              aria-label={key === '⌫' ? 'Löschen' : key === ',' ? 'Komma' : key}
              sx={{ minHeight: 64, fontSize: '1.5rem' }}
            >
              {key === '⌫' ? <BackspaceIcon /> : key}
            </Button>
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
        <Button
          onClick={() => onApply(null)}
          sx={{ minHeight: 48, mr: 'auto' }}
          color="inherit"
        >
          Nicht gezählt
        </Button>
        <Button onClick={onClose} sx={{ minHeight: 48 }}>
          Abbrechen
        </Button>
        <Button
          variant="contained"
          onClick={apply}
          disabled={invalid}
          sx={{ minHeight: 48 }}
        >
          Übernehmen
        </Button>
      </DialogActions>
    </Dialog>
  )
}

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
  conflictKeys: Set<string>
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
  const mayCount = role !== null && COUNT_ROLES.includes(role)

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
  const requestId = useRef(0)

  const load = useCallback(async (target?: string) => {
    const id = ++requestId.current
    setLoading(true)
    setLoadError(null)
    try {
      const result = await fetchRestDay(target)
      if (id !== requestId.current) return
      setDay(result)
      setDraft(pruneDraft(result, loadDraft(result.date)))
    } catch (error) {
      if (id !== requestId.current) return
      setLoadError(errorMessage(error))
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(date)
  }, [date, load])

  const writable = !!day && day.editable && mayCount && !saving

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
    () =>
      new Set(
        conflicts.map((c) =>
          rowKey(
            { itemId: c.itemId, variant: c.variant },
            { productId: c.productId }
          )
        )
      ),
    [conflicts]
  )

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
      if (!day) return
      setDraft((prev) => {
        const key = rowKey(line, row)
        const next = { ...prev }
        if (value === row.qty) delete next[key]
        else next[key] = value
        storeDraft(day.date, next)
        return next
      })
    },
    [day]
  )

  const goTo = (target: string) => {
    setConflicts([])
    setSaveError(null)
    setDate(target)
    router.replace(`/admin/rest?date=${target}`, { scroll: false })
  }

  const discard = () => {
    if (!day) return
    storeDraft(day.date, {})
    setDraft({})
    setConflicts([])
    setSaveError(null)
  }

  const save = async () => {
    if (!day || changes.length === 0) return
    setSaving(true)
    setSaveError(null)
    try {
      const result = await saveRestDay(day.date, changes)
      setDay(result)
      const rest = pruneDraft(result, draft)
      storeDraft(result.date, rest)
      setDraft(rest)
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
        // Neu laden: der Entwurf bleibt, „vorher“ ist jetzt der neue Stand.
        try {
          const fresh = await fetchRestDay(day.date)
          setDay(fresh)
        } catch {
          // Bleibt beim alten Stand; der Hinweis oben sagt, was los ist.
        }
      } else {
        setSaveError(errorMessage(error))
      }
    } finally {
      setSaving(false)
    }
  }

  const confirmed = day?.backzettelStatus === 'confirmed'
  const canPrev = !!day && day.date > day.window.from
  const canNext = !!day && day.date < day.window.to

  return (
    <Box sx={{ pb: changes.length > 0 || saving ? 12 : 2 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            Rest am Abend
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {day
              ? longDate(day.date, day.weekdayName)
              : 'Zählung bei Ladenschluss'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton
            aria-label="Tag davor"
            disabled={!canPrev || loading}
            onClick={() => day && goTo(addDaysIso(day.date, -1))}
            sx={{ width: 48, height: 48 }}
          >
            <PrevIcon />
          </IconButton>
          <Button
            variant="outlined"
            disabled={!day || day.date === day.today || loading}
            onClick={() => day && goTo(day.today)}
            sx={{ minHeight: 48 }}
          >
            Heute
          </Button>
          <IconButton
            aria-label="Tag danach"
            disabled={!canNext || loading}
            onClick={() => day && goTo(addDaysIso(day.date, 1))}
            sx={{ width: 48, height: 48 }}
          >
            <NextIcon />
          </IconButton>
          {role === 'inhaber' && (
            <Button
              component={Link}
              href="/admin/rest/auswertung"
              sx={{ minHeight: 48 }}
            >
              Auswertung
            </Button>
          )}
        </Stack>
      </Stack>

      {loading && !day && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label="Lädt" />
        </Box>
      )}

      {loadError && (
        <Alert
          severity="error"
          sx={{ mb: 2, ...ALERT_TOUCH }}
          action={
            <Button color="inherit" onClick={() => void load(date)}>
              Erneut versuchen
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      {day && (
        <>
          {loading && <LinearProgress sx={{ mb: 1 }} aria-label="Lädt" />}
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ mb: 2 }}
          >
            {day.status === 'ok' && (
              <Chip
                label={
                  confirmed
                    ? 'Backzettel freigegeben'
                    : day.backzettelStatus === 'draft'
                    ? 'Backzettel nicht freigegeben - Mengen geplant'
                    : 'Kein Backzettel'
                }
                color={confirmed ? 'success' : 'default'}
                variant="outlined"
              />
            )}
            {day.summary.lastCountedAt && (
              <Chip
                variant="outlined"
                label={`Zuletzt gespeichert ${timeOf(
                  day.summary.lastCountedAt
                )} Uhr${
                  day.summary.lastCountedBy
                    ? ` · ${day.summary.lastCountedBy.displayName}`
                    : ''
                }`}
              />
            )}
          </Stack>

          {day.status === 'no-config' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <AlertTitle>Keine Zählliste</AlertTitle>
              {day.editIssue}
            </Alert>
          )}
          {day.status === 'ruhetag' && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {day.editIssue}
            </Alert>
          )}
          {day.status === 'ok' && !day.editable && day.editIssue && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {day.editIssue}
            </Alert>
          )}
          {day.status === 'ok' && day.editable && !mayCount && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Nur ansehen - gezählt wird vom Verkauf.
            </Alert>
          )}
          {saveError && (
            <Alert
              severity={conflicts.length > 0 ? 'warning' : 'error'}
              sx={{ mb: 2, ...ALERT_TOUCH }}
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
                  Deine Eingaben stehen noch da. Prüfen und erneut speichern -
                  dann gilt deine Zahl.
                </Typography>
              )}
            </Alert>
          )}

          {day.status === 'ok' && day.lines.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" data-testid="rest-progress">
                  {progress.counted} von {progress.total} gezählt
                </Typography>
                {changes.length > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {changes.length} ungespeichert
                  </Typography>
                )}
              </Stack>
              <LinearProgress
                variant="determinate"
                value={
                  progress.total ? (progress.counted / progress.total) * 100 : 0
                }
                aria-label="Fortschritt der Zählung"
                sx={{ height: 8, borderRadius: 1, mt: 0.5 }}
              />
            </Box>
          )}

          {day.status === 'ok' && day.lines.length === 0 && (
            <Alert severity="info">
              Für diesen Tag steht nichts auf dem Backzettel.
            </Alert>
          )}

          {sections.map((section) => (
            <Box key={section.label} component="section" sx={{ mb: 3 }}>
              <Typography
                variant="overline"
                component="h2"
                color="text.secondary"
                sx={{ display: 'block', mb: 1 }}
              >
                {section.label}
              </Typography>
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
            </Box>
          ))}
        </>
      )}

      {day && mayCount && (changes.length > 0 || saving) && (
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
          <Typography variant="body2" sx={{ flex: 1 }}>
            {changes.length === 1
              ? '1 Änderung'
              : `${changes.length} Änderungen`}
          </Typography>
          <Button
            onClick={discard}
            disabled={saving}
            color="inherit"
            sx={{ minHeight: 48 }}
          >
            Verwerfen
          </Button>
          <Button
            variant="contained"
            onClick={() => void save()}
            disabled={saving || changes.length === 0}
            sx={{ minHeight: 48, minWidth: 140 }}
          >
            {saving ? 'Speichert …' : 'Speichern'}
          </Button>
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
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
    </Box>
  )
}
