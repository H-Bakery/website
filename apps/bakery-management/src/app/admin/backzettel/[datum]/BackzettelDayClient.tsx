'use client'

import React from 'react'
import Link from 'next/link'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import PrintIcon from '@mui/icons-material/Print'
import RefreshIcon from '@mui/icons-material/Refresh'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import {
  DELTAS_PENDING_MAX_RELOADS,
  DELTAS_PENDING_RELOAD_MS,
  acknowledgeDelta,
  confirmDay,
  fetchBackzettelConfig,
  fetchBackzettelDay,
  isBackzettelDay,
  isDoughDaySheet,
  reopenDay,
  setCorrection,
  setSeasonFactor,
  type BackzettelConfigData,
  type BackzettelDayResult,
  type BackzettelDeltaEntry,
  type BackzettelLine,
} from '../../../../lib/backzettelApi'
import {
  changedTotals,
  doughsTodayText,
  formatQty,
  lineLabel,
  type ChangedTotal,
  formatDateLong,
  formatDateShort,
  formatFactor,
  formatTimestamp,
  isIsoDate,
  neighbourProductionDay,
  openDeltas,
  parseDecimal,
} from '../../../../lib/backzettelFormat'
import { useOptionalSession } from '../../../../lib/session'
import { BackzettelSectionView } from '../../../../components/backzettel/BackzettelSectionView'
import { HefeteigCard } from '../../../../components/backzettel/HefeteigCard'
import { PrepCard } from '../../../../components/backzettel/PrepCard'
import { DeltasCard } from '../../../../components/backzettel/DeltasCard'
import { MachineStrip } from '../../../../components/backzettel/MachineStrip'
import { OpenMasterDataNote } from '../../../../components/backzettel/OpenMasterDataNote'
import { BreadTable } from '../../../../components/backzettel/BreadTable'
import {
  RollsByBakeDay,
  linesByKey,
  v2CoveredKeys,
} from '../../../../components/backzettel/RollsByBakeDay'
import { BackzettelStatusChip } from '../../../../components/backzettel/BackzettelStatusChip'
import {
  BackzettelPrint,
  backzettelPrintStyles,
} from '../../../../components/backzettel/BackzettelPrint'

const MIN_TOUCH = { minHeight: 44 }

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/**
 * 409-Codes der Backzettel-API, die heißen: Der Tag auf dem Server ist nicht
 * mehr der, den diese Seite zeigt (anderes Gerät hat freigegeben/geöffnet,
 * Stammdaten weg, Ruhetag). Dann wird neu geladen statt den alten Stand mit
 * aktiven Knöpfen stehen zu lassen.
 */
const STALE_CODES = new Set([
  'confirmed',
  'not_confirmed',
  'no_config',
  'ruhetag',
  // W4-verify r4: ein anderes Gerät hat den Saisonfaktor inzwischen geändert
  'season_changed',
])

function isStaleError(error: unknown): boolean {
  const e = error as { status?: number; code?: string } | null
  return !!e && e.status === 409 && !!e.code && STALE_CODES.has(e.code)
}

const STALE_SUFFIX = ' Der Backzettel wurde neu geladen.'

export interface BackzettelDayClientProps {
  date: string
}

/**
 * Tagesplanung eines Produktionstags (Z5, roadmap §5.5 Nr. 2) mit Druckbild
 * (Z7). Zeigt, was `/api/backzettel/:datum` liefert - gerechnet wird nur auf
 * dem Server. Planen (Saisonfaktor, Korrekturen, Freigeben) dürfen Inhaber und
 * Backstube; Wieder öffnen nur der Inhaber; alle anderen sehen den Zettel nur.
 */
export default function BackzettelDayClient({
  date,
}: BackzettelDayClientProps) {
  const session = useOptionalSession()
  const role = session?.user?.role ?? null
  const canPlan = role === 'inhaber' || role === 'backstube'
  const canReopen = role === 'inhaber'
  const validDate = isIsoDate(date)

  const [config, setConfig] = React.useState<BackzettelConfigData | null>(null)
  const [result, setResult] = React.useState<BackzettelDayResult | null>(null)
  const [loading, setLoading] = React.useState(validDate)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [editingKey, setEditingKey] = React.useState<string | null>(null)
  /** Vorbelegung des Korrektur-Editors („+1 Bruch“, Z10). */
  const [prefill, setPrefill] = React.useState<number | null>(null)
  const editLine = React.useCallback((key: string | null, value?: number) => {
    setEditingKey(key)
    setPrefill(value === undefined ? null : value)
  }, [])
  const [seasonInput, setSeasonInput] = React.useState('')
  const [seasonError, setSeasonError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [ackingId, setAckingId] = React.useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [reopenOpen, setReopenOpen] = React.useState(false)
  const [reopenReason, setReopenReason] = React.useState('')
  const [confirmChanges, setConfirmChanges] = React.useState<
    ChangedTotal[] | null
  >(null)

  const applyDay = React.useCallback((day: BackzettelDayResult) => {
    setResult(day)
    if (isBackzettelDay(day)) setSeasonInput(formatFactor(day.seasonFactor))
  }, [])

  const load = React.useCallback(async () => {
    if (!validDate) return
    setLoading(true)
    setLoadError(null)
    const [cfg, day] = await Promise.allSettled([
      fetchBackzettelConfig(),
      fetchBackzettelDay(date),
    ])
    if (cfg.status === 'fulfilled') setConfig(cfg.value?.config ?? null)
    if (day.status === 'fulfilled') applyDay(day.value)
    else
      setLoadError(
        messageOf(day.reason, 'Der Backzettel konnte nicht geladen werden.')
      )
    setLoading(false)
  }, [applyDay, date, validDate])

  React.useEffect(() => {
    editLine(null)
    setConfirmChanges(null)
    void load()
  }, [editLine, load])

  const days = config?.days ?? null
  const day = isBackzettelDay(result) ? result : null

  // Noch nicht erfasste Änderungen an Vorbestellungen: die API trägt sie im
  // Hintergrund nach - kurz danach noch einmal laden (begrenzt).
  const pendingReloads = React.useRef(0)
  const deltasPending =
    day?.status === 'confirmed' && day.deltasPending === true
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
  }, [deltasPending, result, load])
  const isDraft = day?.status === 'draft'
  const editable = canPlan && isDraft && day?.configStatus === 'ok'

  async function run<T>(
    work: () => Promise<T>,
    fallback: string
  ): Promise<T | undefined> {
    setBusy(true)
    setActionError(null)
    try {
      return await work()
    } catch (error) {
      if (isStaleError(error)) {
        setEditingKey(null)
        setActionError(messageOf(error, fallback) + STALE_SUFFIX)
        void load()
      } else {
        setActionError(messageOf(error, fallback))
      }
      return undefined
    } finally {
      setBusy(false)
    }
  }

  const saveCorrection = async (
    line: BackzettelLine,
    correction: number,
    reason: string | null
  ) => {
    // Fehler wirft der Editor in die Zeile; hier kein globaler Hinweis -
    // außer der Tag hat sich auf dem Server geändert: dann neu laden.
    let updated: BackzettelDayResult
    try {
      const expected = {
        correction: line.correction,
        reason: line.correctionReason,
      }
      // Z10: Brötchen für einen späteren Backtag auf diesem Teigtag-Zettel
      // tragen ihren Backtag mit, sonst träfe die Korrektur den Zettel-Tag.
      updated =
        line.bakeDate && line.bakeDate !== date
          ? await setCorrection(
              date,
              line.itemId,
              line.variant,
              correction,
              reason,
              expected,
              { bakeDate: line.bakeDate }
            )
          : await setCorrection(
              date,
              line.itemId,
              line.variant,
              correction,
              reason,
              // der Stand, auf dem der Editor geöffnet wurde (W4-verify r4)
              expected
            )
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code
      if (code === 'correction_changed' || code === 'owned_elsewhere') {
        // owned_elsewhere (Z10): die Zeile gehört inzwischen einem anderen,
        // freigegebenen Zettel - neu laden, der Editor nennt den Grund.
        // Ein anderes Gerät hat gespeichert: den aktuellen Stand laden, der
        // Editor bleibt mit der eigenen Eingabe offen und nennt den neuen
        // Wert - erst ein zweites Speichern ersetzt ihn.
        void load()
        throw error
      }
      if (!isStaleError(error)) throw error
      setEditingKey(null)
      setActionError(
        messageOf(error, 'Die Korrektur konnte nicht gespeichert werden.') +
          STALE_SUFFIX
      )
      void load()
      return
    }
    applyDay(updated)
    editLine(null)
    setNotice(
      correction === 0 ? 'Korrektur entfernt.' : 'Korrektur gespeichert.'
    )
  }

  const saveSeason = async (event: React.FormEvent) => {
    event.preventDefault()
    const factor = parseDecimal(seasonInput)
    if (!Number.isFinite(factor) || factor <= 0 || factor > 5) {
      setSeasonError('Bitte einen Faktor größer 0 und höchstens 5 eingeben.')
      return
    }
    setSeasonError(null)
    const typed = seasonInput.trim()
    const updated = await run(async () => {
      try {
        return await setSeasonFactor(date, factor, day?.seasonFactor)
      } catch (error) {
        const e = error as { code?: unknown; message?: unknown } | null
        if (e && e.code === 'season_changed') {
          // Die eigene Eingabe nennen - das Neuladen ersetzt das Feld.
          throw Object.assign(
            new Error(`${String(e.message)} (Deine Eingabe: ${typed}.)`),
            { status: 409, code: 'season_changed' }
          )
        }
        throw error
      }
    }, 'Der Saisonfaktor konnte nicht gespeichert werden.')
    if (updated) {
      applyDay(updated)
      setNotice('Saisonfaktor gespeichert.')
    }
  }

  const doConfirm = async () => {
    setConfirmOpen(false)
    const shown = day
    const updated = await run(
      () => confirmDay(date),
      'Der Backzettel konnte nicht freigegeben werden.'
    )
    if (updated) {
      applyDay(updated)
      setEditingKey(null)
      setNotice('Backzettel freigegeben.')
      // Freigegeben wird, was der Server JETZT rechnet. Kam seit dem Laden
      // eine Vorbestellung dazu, steht sie im eingefrorenen Zettel - das soll
      // man sehen, nicht erst beim Backen merken.
      const changes =
        shown && isBackzettelDay(updated) ? changedTotals(shown, updated) : []
      setConfirmChanges(changes.length > 0 ? changes : null)
    }
  }

  const doReopen = async () => {
    setReopenOpen(false)
    const updated = await run(
      () => reopenDay(date, reopenReason),
      'Der Backzettel konnte nicht wieder geöffnet werden.'
    )
    if (updated) {
      applyDay(updated)
      setConfirmChanges(null)
      setReopenReason('')
      setNotice('Backzettel wieder geöffnet - jetzt ein Entwurf.')
    }
  }

  const doAck = async (delta: BackzettelDeltaEntry) => {
    setAckingId(delta.id)
    setActionError(null)
    try {
      await acknowledgeDelta(date, delta.id)
      const fresh = await fetchBackzettelDay(date)
      applyDay(fresh)
    } catch (error) {
      setActionError(
        messageOf(error, 'Der Nachtrag konnte nicht quittiert werden.')
      )
    } finally {
      setAckingId(null)
    }
  }

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
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontSize: { xs: '1.6rem', sm: '2rem' } }}
        >
          Backzettel
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="h6" component="p">
            {validDate ? formatDateLong(date) : date}
          </Typography>
          {day && <BackzettelStatusChip status={day.status} size="medium" />}
        </Stack>
        {day && isDoughDaySheet(day) && doughsTodayText(day) && (
          <Typography color="text.secondary" data-testid="doughs-today">
            {doughsTodayText(day)}
          </Typography>
        )}
      </Box>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
      >
        {previous && (
          <IconButton
            component={Link}
            href={`/admin/backzettel/${previous}`}
            aria-label={`Voriger Produktionstag (${formatDateShort(previous)})`}
            sx={{ width: 44, height: 44 }}
          >
            <ChevronLeftIcon />
          </IconButton>
        )}
        {next && (
          <IconButton
            component={Link}
            href={`/admin/backzettel/${next}`}
            aria-label={`Nächster Produktionstag (${formatDateShort(next)})`}
            sx={{ width: 44, height: 44 }}
          >
            <ChevronRightIcon />
          </IconButton>
        )}
        <Button component={Link} href="/admin/backzettel" sx={MIN_TOUCH}>
          Übersicht
        </Button>
        {day && isDoughDaySheet(day) && (
          <Button
            component={Link}
            href={`/admin/backzettel/${date}/backen`}
            variant="outlined"
            sx={MIN_TOUCH}
          >
            Backliste
          </Button>
        )}
        <IconButton
          onClick={() => void load()}
          aria-label="Aktualisieren"
          disabled={loading}
          sx={{ width: 44, height: 44 }}
        >
          <RefreshIcon />
        </IconButton>
        {day && (
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={() => window.print()}
            sx={MIN_TOUCH}
          >
            Drucken
          </Button>
        )}
      </Stack>
    </Stack>
  )

  let body: React.ReactNode
  if (!validDate) {
    body = (
      <Alert severity="error">
        „{date}“ ist kein gültiges Datum. Erwartet wird JJJJ-MM-TT, z. B.
        2026-11-28.
      </Alert>
    )
  } else if (loading && !result) {
    body = (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label="Backzettel wird geladen" />
      </Box>
    )
  } else if (loadError && !result) {
    body = (
      <Alert
        severity="error"
        action={
          <Button color="inherit" onClick={() => void load()} sx={MIN_TOUCH}>
            Erneut versuchen
          </Button>
        }
      >
        {loadError}
      </Alert>
    )
  } else if (result?.status === 'ruhetag') {
    body = (
      <Alert severity="info" data-testid="ruhetag">
        <AlertTitle>Ruhetag</AlertTitle>
        {result.message} Gebacken wird wieder am{' '}
        {next ? formatDateLong(next) : 'nächsten Produktionstag'}.
        {next && (
          <Box sx={{ mt: 1 }}>
            <Button
              component={Link}
              href={`/admin/backzettel/${next}`}
              variant="outlined"
              sx={MIN_TOUCH}
            >
              Zum {formatDateShort(next)}
            </Button>
          </Box>
        )}
      </Alert>
    )
  } else if (result?.status === 'no-config') {
    body = (
      <Alert severity="warning" data-testid="no-config">
        <AlertTitle>Keine Backzettel-Stammdaten</AlertTitle>
        Ohne gültige Stammdaten (<code>config/backzettel.yaml</code> in hq)
        rechnet die App keine Mengen – es werden bewusst keine geschätzten
        Zahlen angezeigt. Sobald die Stammdaten da sind, erscheint hier der
        Zettel.
        {result.reasons.length > 0 && (
          <Box component="ul" sx={{ mb: 0, pl: 2.5 }}>
            {result.reasons.map((r, i) => (
              <li key={i}>
                {r.path ? <code>{r.path}</code> : null}
                {r.path ? ': ' : ''}
                {r.message}
              </li>
            ))}
          </Box>
        )}
      </Alert>
    )
  } else if (day) {
    const openCount = openDeltas(day).length
    const v2 = isDoughDaySheet(day)
    const covered = v2 ? v2CoveredKeys(day) : new Set<string>()
    const otherSections = v2
      ? day.sections
          .map((s) => ({
            ...s,
            lines: s.lines.filter((l) => !covered.has(l.key)),
          }))
          .filter((s) => s.lines.length > 0)
      : day.sections
    const v2Props = {
      config,
      sheetDate: date,
      lineByKey: linesByKey(day.sections),
      editable,
      editingKey,
      prefill,
      onEdit: editLine,
      onSaveCorrection: saveCorrection,
    }
    body = (
      <>
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {day.status === 'confirmed' && (
            <Alert severity="success" icon={<TaskAltIcon />}>
              Freigegeben
              {day.confirmedBy ? ` von ${day.confirmedBy.displayName}` : ''}
              {day.confirmedAt ? ` am ${formatTimestamp(day.confirmedAt)}` : ''}
              . Die Mengen sind eingefroren
              {openCount > 0
                ? `; ${openCount} ${
                    openCount === 1 ? 'Nachtrag ist' : 'Nachträge sind'
                  } noch offen.`
                : '.'}
            </Alert>
          )}
          {confirmChanges && day.status === 'confirmed' && (
            <Alert
              severity="warning"
              data-testid="confirm-changes"
              onClose={() => setConfirmChanges(null)}
            >
              <AlertTitle>
                Freigegeben mit dem aktuellen Stand – abweichend von der Anzeige
              </AlertTitle>
              Seit dem Laden der Seite hat sich etwas geändert (z. B. eine neue
              Vorbestellung). Eingefroren wurde:
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {confirmChanges.map((c) => (
                  <li key={c.line.key}>
                    {lineLabel(c.line, config)}:{' '}
                    {c.before === null ? '–' : formatQty(c.before, c.line.unit)}{' '}
                    →{' '}
                    <strong>
                      {c.after === null ? '–' : formatQty(c.after, c.line.unit)}
                    </strong>
                  </li>
                ))}
              </Box>
            </Alert>
          )}
          {day.configChangedSinceConfirm && (
            <Alert severity="info" data-testid="config-changed">
              Die Stammdaten haben sich seit der Freigabe geändert. Dieser
              Zettel bleibt so, wie er freigegeben wurde; wer die neuen Werte
              will, lässt ihn vom Inhaber wieder öffnen und gibt ihn neu frei.
            </Alert>
          )}
          {deltasPending && (
            <Alert severity="warning" data-testid="deltas-pending">
              Vorbestellungen haben sich geändert, die Änderungen stehen noch
              nicht unten bei den Nachträgen. Sie werden gerade übernommen - die
              Seite lädt gleich neu.
            </Alert>
          )}
          {day.configStatus === 'no-config' && (
            <Alert severity="warning">
              Die Backzettel-Stammdaten fehlen derzeit oder sind ungültig. Der
              freigegebene Zettel bleibt lesbar.
              {day.status === 'confirmed' &&
                ' Spätere Änderungen an Vorbestellungen können solange nicht als Nachtrag erscheinen - sie werden übernommen, sobald die Stammdaten wieder stimmen.'}
            </Alert>
          )}
          {day.prepDateProvisional && (
            <Alert severity="info" data-testid="prep-provisional">
              Der Vortag ({formatDateLong(day.prepDate)}) ist Ruhetag. Wann und
              von wem die Vorbereitung für diesen Tag erledigt wird, ist noch
              offen.
            </Alert>
          )}
          {day.warnings.length > 0 && (
            <Alert severity="warning" data-testid="warnings">
              <AlertTitle>Hinweise</AlertTitle>
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {day.warnings.map((w, i) => (
                  <li key={`${w.code}-${i}`}>{w.message}</li>
                ))}
              </Box>
            </Alert>
          )}
          {!canPlan && (
            <Alert severity="info" data-testid="read-only">
              Nur Ansicht – planen und freigeben können Inhaber und Backstube.
            </Alert>
          )}
          {actionError && (
            <Alert severity="error" onClose={() => setActionError(null)}>
              {actionError}
            </Alert>
          )}
        </Stack>

        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 2,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {editable ? (
            <Box
              component="form"
              onSubmit={saveSeason}
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              <TextField
                label="Saisonfaktor"
                value={seasonInput}
                onChange={(e) => setSeasonInput(e.target.value)}
                inputProps={{
                  inputMode: 'decimal',
                  'aria-label': 'Saisonfaktor',
                }}
                error={!!seasonError}
                helperText={seasonError ?? '1,0 = normal'}
                sx={{ width: 180 }}
              />
              <Button
                type="submit"
                variant="outlined"
                disabled={busy}
                sx={{ ...MIN_TOUCH, mt: 0.5 }}
              >
                Übernehmen
              </Button>
            </Box>
          ) : (
            <Typography>
              Saisonfaktor <strong>{formatFactor(day.seasonFactor)}</strong>
            </Typography>
          )}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {canPlan && isDraft && (
              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={<TaskAltIcon />}
                onClick={() => setConfirmOpen(true)}
                disabled={busy || day.configStatus !== 'ok'}
                sx={MIN_TOUCH}
              >
                Freigeben
              </Button>
            )}
            {canReopen && day.status === 'confirmed' && (
              <Button
                variant="outlined"
                startIcon={<LockOpenIcon />}
                onClick={() => setReopenOpen(true)}
                disabled={busy}
                sx={MIN_TOUCH}
              >
                Wieder öffnen
              </Button>
            )}
          </Stack>
        </Paper>

        {v2 && (
          <>
            <MachineStrip machine={day.machine ?? []} doughs={day.doughs} />
            <OpenMasterDataNote open={day.openMasterData} />
          </>
        )}

        <DeltasCard
          deltas={day.deltas}
          config={config}
          canAck={canPlan}
          ackingId={ackingId}
          onAck={(d) => void doAck(d)}
          sheetDate={date}
        />

        {v2 && day.sections.length === 0 && day.isDoughDay === false && (
          <Alert severity="info" sx={{ mb: 2 }} data-testid="no-dough-day">
            {formatDateLong(date)} ist kein Teigtag – gebacken wird aus Teig vom
            Vortag. Was heute in den Ofen kommt, steht in der{' '}
            <Link href={`/admin/backzettel/${date}/backen`}>Backliste</Link>.
          </Alert>
        )}
        {v2 && (
          <>
            <BreadTable bread={day.bread} {...v2Props} />
            <RollsByBakeDay rolls={day.rolls} {...v2Props} />
          </>
        )}
        {day.sections.length === 0 ? (
          v2 && day.isDoughDay === false ? null : (
            <Alert severity="info" sx={{ mb: 2 }}>
              Für diesen Tag steht nichts auf dem Backzettel – keine
              Grundmengen, Vorbestellungen oder CAP-Lieferungen.
            </Alert>
          )
        ) : (
          otherSections.map((section) => (
            <BackzettelSectionView
              key={section.id}
              section={section}
              config={config}
              editable={editable}
              editingKey={editingKey}
              onEdit={(key) => editLine(key)}
              onSaveCorrection={saveCorrection}
            />
          ))
        )}

        <HefeteigCard
          hefeteig={day.hefeteig}
          fillings={day.fillings}
          deltaExtras={day.deltaExtras}
        />
        <PrepCard
          prep={day.prep}
          prepDate={day.prepDate}
          prepDateProvisional={day.prepDateProvisional}
        />

        <Dialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          aria-labelledby="bz-confirm-title"
        >
          <DialogTitle id="bz-confirm-title">Backzettel freigeben?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Backzettel für {formatDateLong(day.date)} freigeben. Danach sind
              die Mengen eingefroren; spätere Vorbestellungen erscheinen als
              Nachträge. Ändern kann nur noch der Inhaber nach „Wieder öffnen“.
            </DialogContentText>
            {day.warnings.length > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Es gibt {day.warnings.length}{' '}
                {day.warnings.length === 1 ? 'Hinweis' : 'Hinweise'} (z. B.
                offene Grundmengen). Trotzdem freigeben?
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)} sx={MIN_TOUCH}>
              Abbrechen
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={() => void doConfirm()}
              sx={MIN_TOUCH}
            >
              Jetzt freigeben
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={reopenOpen}
          onClose={() => setReopenOpen(false)}
          aria-labelledby="bz-reopen-title"
        >
          <DialogTitle id="bz-reopen-title">
            Backzettel wieder öffnen?
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              Der Zettel wird wieder ein Entwurf und rechnet mit den aktuellen
              Vorbestellungen und Stammdaten. Die Nachträge gehen in den Mengen
              auf. Danach muss er neu freigegeben werden.
            </DialogContentText>
            <TextField
              label="Grund (optional)"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              fullWidth
              sx={{ mt: 2 }}
              inputProps={{ maxLength: 500 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReopenOpen(false)} sx={MIN_TOUCH}>
              Abbrechen
            </Button>
            <Button
              variant="contained"
              onClick={() => void doReopen()}
              sx={MIN_TOUCH}
            >
              Wieder öffnen
            </Button>
          </DialogActions>
        </Dialog>
      </>
    )
  }

  return (
    <Box className="backzettel-root">
      {backzettelPrintStyles}
      <Box className="bz-screen" data-testid="bz-screen">
        {header}
        {body}
      </Box>
      {day && <BackzettelPrint day={day} config={config} />}
      <Snackbar
        open={!!notice}
        autoHideDuration={3000}
        onClose={() => setNotice(null)}
        message={notice}
        className="bz-screen"
      />
    </Box>
  )
}
