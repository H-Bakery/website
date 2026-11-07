'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Paper,
  InputBase,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  HourglassTop as PendingIcon,
  Print as PrintIcon,
} from '@mui/icons-material'
import { ApiError } from '@bakery/shared/data-access'
import { useOptionalSession } from '../../../../lib/session'
import { backzettelErrorText } from '../../../../lib/backstubeErrors'
import {
  cellValue,
  displayValue,
  fetchBackzettelConfig,
  fetchReference,
  groupBySection,
  isPerVariant,
  inputProblem,
  labelledMessage,
  parseInput,
  referenceFor,
  saveGrundmenge,
  variantLabel,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  withRestAverages,
  type BackzettelConfigView,
  type BaseEdit,
  type GrundmengenConfig,
  type GrundmengenItem,
  type ReferenceItem,
  type ReferenceResponse,
} from '../../../../lib/grundmengenApi'
import { fetchRestAverages, type RestAverages } from '../../../../lib/restApi'
import GrundmengenPrint, { grundmengenPrintStyles } from './GrundmengenPrint'
import { PageLayout, PageSection } from '../../../../components/layout'

/** Wer Grundmengen ändern darf (wie `PUT /config/base`). */
const EDIT_ROLES = ['inhaber', 'backstube']

export const REFERENCE_TOOLTIP = 'Median verkauft, letzte 6 gleiche Wochentage'

/** Schaltflächen in Hinweisen (Schließen, Erneut versuchen): Tablet-tauglich. */
const ALERT_TOUCH = {
  '& .MuiAlert-action .MuiButtonBase-root': { minHeight: 44, minWidth: 44 },
} as const

function errorMessage(error: unknown): string {
  return backzettelErrorText(error, 'Unbekannter Fehler.')
}

function formatQty(value: number): string {
  return String(value).replace('.', ',')
}

function formatDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}.${m}.`
}

// ------------------------------------------------------------------ Zelle

interface CellProps {
  label: string
  value: number | null | undefined
  /** Freigegebener Wert, falls er vom Arbeitsstand abweicht. */
  approved?: { value: number | null | undefined } | null
  reference: ReferenceItem | null
  unit: string
  editable: boolean
  onSave: (value: number | null) => Promise<void>
  /** Eingabe ist keine Zahl - die Statuszeile sagt es (W4-verify r2). */
  onInvalid?: (text: string) => void
}

function ReferenceHint({
  reference,
  unit,
}: {
  reference: ReferenceItem | null
  unit: string
}) {
  if (!reference || reference.status === 'no_plu') return null
  const pieces = !reference.converted && unit !== 'Stück'
  const text =
    reference.median === null
      ? '–'
      : `${formatQty(reference.median)}${pieces ? ' St.' : ''}`
  const detail =
    reference.status === 'no_data'
      ? 'Kein Kassenbericht für diesen Wochentag.'
      : `Verkauft: ${reference.samples.map(formatQty).join(' · ')}${
          pieces ? ' (Stück laut Kasse, nicht ' + unit + ')' : ''
        }`
  return (
    <Tooltip
      title={
        <>
          {REFERENCE_TOOLTIP}
          <br />
          {detail}
          {reference.converted ? (
            <>
              <br />
              PLU {reference.plu.join(', ')} mit dem Faktor des Backzettels
              umgerechnet (z. B. 1 Stück Kuchen = ¼).
            </>
          ) : (
            reference.plu.length > 1 && (
              <>
                <br />
                PLU {reference.plu.join(', ')} zusammengezählt (verschiedene
                Größen, ohne Umrechnung).
              </>
            )
          )}
          {typeof reference.restMean === 'number' && (
            <>
              <br />
              Rest am Abend Ø {formatQty(reference.restMean)}
              {unit === 'Stück' ? ' St.' : ` ${unit}`} ({reference.restDays}{' '}
              {reference.restDays === 1 ? 'Tag' : 'Tage'} gezählt)
            </>
          )}
          <br />
          Nur zur Information - wird nie übernommen.
        </>
      }
    >
      <Typography
        component="span"
        variant="caption"
        data-testid="reference"
        aria-label={`${REFERENCE_TOOLTIP}: ${text}${
          typeof reference.restMean === 'number'
            ? `; Rest am Abend Ø ${formatQty(reference.restMean)}`
            : ''
        }`}
        sx={{
          color: 'text.secondary',
          whiteSpace: 'nowrap',
          cursor: 'help',
        }}
      >
        ≈ {text}
      </Typography>
    </Tooltip>
  )
}

/** Feste Breite für den Referenzwert, damit die Felder einer Spalte fluchten. */
const REFERENCE_SLOT = 56

function ReferenceSlot(props: {
  reference: ReferenceItem | null
  unit: string
}) {
  return (
    <Box
      sx={{
        width: REFERENCE_SLOT,
        flexShrink: 0,
        textAlign: 'left',
      }}
    >
      <ReferenceHint {...props} />
    </Box>
  )
}

function BaseCell({
  label,
  value,
  approved,
  reference,
  unit,
  editable,
  onSave,
  onInvalid,
}: CellProps) {
  const initial = displayValue(value)
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const lastInitial = useRef(initial)

  // Neuer Stand vom Server (nach dem Speichern einer anderen Zelle).
  useEffect(() => {
    if (lastInitial.current !== initial) {
      lastInitial.current = initial
      setDraft(initial)
      setInvalid(false)
    }
  }, [initial])

  const commit = async () => {
    if (draft === initial) {
      setInvalid(false)
      return
    }
    const parsed = parseInput(draft)
    if (parsed !== null && Number.isNaN(parsed)) {
      setInvalid(true)
      onInvalid?.(draft)
      return
    }
    setSaving(true)
    try {
      await onSave(parsed)
      setInvalid(false)
    } catch {
      setInvalid(true)
    } finally {
      setSaving(false)
    }
  }

  const changed = Boolean(approved)
  const approvedText =
    approved && approved.value === null
      ? 'offen'
      : approved
      ? displayValue(approved.value)
      : ''

  return (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      justifyContent="flex-end"
    >
      {editable ? (
        <Box sx={{ position: 'relative' }}>
          <InputBase
            value={draft}
            placeholder="offen"
            disabled={saving}
            onChange={(e) => {
              setDraft(e.target.value)
              setInvalid(false)
            }}
            onBlur={() => void commit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void commit()
              } else if (e.key === 'Escape') {
                setDraft(initial)
                setInvalid(false)
              }
            }}
            inputProps={{
              inputMode: 'decimal',
              'aria-label': label,
              'aria-invalid': invalid || undefined,
              'data-changed': changed || undefined,
            }}
            sx={{
              // Platz für „offen“ auch neben dem Freigabe-Symbol (pl 3).
              width: changed ? 84 : 68,
              minHeight: 44,
              px: 1,
              pl: changed ? 3 : 1,
              borderRadius: 1,
              border: 1,
              borderColor: invalid
                ? 'error.main'
                : changed
                ? 'info.main'
                : 'divider',
              borderWidth: invalid || changed ? 2 : 1,
              bgcolor: 'background.paper',
              // W4-verify r2: auch das Eingabefeld selbst ist 44 px hoch,
              // nicht nur der Rahmen darum.
              '& input': {
                height: 44,
                boxSizing: 'border-box',
                py: 0,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                '&::placeholder': { fontStyle: 'italic', opacity: 0.8 },
              },
              '&.Mui-focused': { borderColor: 'primary.main', borderWidth: 2 },
            }}
          />
          {saving && (
            <CircularProgress
              size={14}
              sx={{ position: 'absolute', top: 4, left: 4 }}
              aria-label="Speichert"
            />
          )}
          {changed && !saving && (
            <Tooltip
              title={`Wartet auf Freigabe - freigegeben: ${approvedText}`}
            >
              <PendingIcon
                aria-label={`Wartet auf Freigabe, freigegeben: ${approvedText}`}
                sx={{
                  position: 'absolute',
                  left: 5,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 16,
                  color: 'info.main',
                }}
              />
            </Tooltip>
          )}
        </Box>
      ) : (
        <Typography
          variant="body2"
          sx={{
            minWidth: 40,
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            fontStyle: value === null ? 'italic' : undefined,
            color: value === null ? 'text.secondary' : 'text.primary',
          }}
        >
          {value === null ? 'offen' : displayValue(value)}
        </Typography>
      )}
      {changed && !editable && (
        <Tooltip title={`Wartet auf Freigabe - freigegeben: ${approvedText}`}>
          <PendingIcon
            fontSize="small"
            aria-label={`Wartet auf Freigabe, freigegeben: ${approvedText}`}
            sx={{ color: 'info.main' }}
          />
        </Tooltip>
      )}
      {editable && <ReferenceSlot reference={reference} unit={unit} />}
    </Stack>
  )
}

// ---------------------------------------------------------------- Tabelle

interface GridProps {
  config: GrundmengenConfig
  approved: GrundmengenConfig | null
  pendingApproval: boolean
  reference: ReferenceResponse | null
  editable: boolean
  onSave: (edit: BaseEdit, label: string) => Promise<void>
  onInvalid?: (label: string, text: string) => void
}

function approvedCell(
  props: GridProps,
  item: GrundmengenItem,
  weekday: number,
  variant: string | null,
  value: number | null | undefined
): { value: number | null | undefined } | null {
  if (!props.pendingApproval || !props.approved) return null
  const was = props.approved.items.find((i) => i.id === item.id)
  if (!was) return null
  const before = cellValue(was, weekday, variant)
  const norm = (v: number | null | undefined) => (v === undefined ? 0 : v)
  return norm(before) === norm(value) ? null : { value: before }
}

/**
 * Einheit als eigene Spalte ab `sm`; auf dem Handy steht sie unter dem Namen,
 * damit neben der festen Postenspalte noch ein Wochentag Platz hat.
 */
const UNIT_COLUMN = { display: { xs: 'none', sm: 'table-cell' } } as const
const UNIT_INLINE = { display: { xs: 'inline', sm: 'none' } } as const

function GrundmengenGrid(props: GridProps) {
  const { config, reference, editable, onSave, onInvalid } = props
  // W4-verify r2: bei 1280 px passt der Sonntag nicht mehr; macOS blendet
  // die Bildlaufleiste aus - deshalb ein sichtbarer Hinweis.
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [overflowing, setOverflowing] = useState(false)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setOverflowing(el.scrollWidth > el.clientWidth + 1)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [config, editable, reference])
  const days = [...config.days].sort((a, b) => a - b)
  const sections = groupBySection(config)

  const dayCells = (item: GrundmengenItem, variant: string | null) =>
    days.map((wd) => {
      const ref = variant === null ? referenceFor(reference, wd, item.id) : null
      const hasVariants = item.variants.length > 0
      // Posten mit Sorten: die Postenzeile ist nur editierbar, wenn am Tag
      // eine Gesamtzahl (oder gar nichts mit Sorten) steht - sonst die Sorten.
      const parentOfVariants = hasVariants && variant === null
      const value = cellValue(item, wd, variant)
      const showInput = parentOfVariants
        ? !isPerVariant(item, wd) && typeof value === 'number' && value > 0
        : true
      const label = `${item.name}${
        variant ? ` (${variantLabel(config, variant)})` : ''
      }, ${WEEKDAY_LONG[wd]}`
      return (
        <TableCell key={wd} align="right" sx={{ px: 1, py: 0.5 }}>
          {showInput ? (
            <BaseCell
              label={label}
              value={value}
              approved={approvedCell(props, item, wd, variant, value)}
              reference={ref}
              unit={item.unit}
              editable={editable}
              onInvalid={(text) => onInvalid?.(label, text)}
              onSave={(v) =>
                onSave(
                  variant === null
                    ? { itemId: item.id, weekday: wd, value: v }
                    : {
                        itemId: item.id,
                        weekday: wd,
                        variants: { [variant]: v },
                      },
                  label
                )
              }
            />
          ) : (
            <Stack direction="row" justifyContent="flex-end">
              {editable ? (
                <ReferenceSlot reference={ref} unit={item.unit} />
              ) : (
                <ReferenceHint reference={ref} unit={item.unit} />
              )}
            </Stack>
          )}
        </TableCell>
      )
    })

  return (
    <>
      {overflowing && (
        <Typography
          variant="body2"
          color="text.secondary"
          className="grundmengen-screen-only"
          data-testid="grundmengen-scroll-hint"
          sx={{ mb: 0.5 }}
        >
          Nicht alle Tage passen nebeneinander - die Tabelle seitlich
          verschieben (bis {WEEKDAY_LONG[days[days.length - 1]]}).
        </Typography>
      )}
      <TableContainer
        ref={scrollRef}
        component={Paper}
        variant="outlined"
        className="grundmengen-screen-only"
        sx={{
          overflowX: 'auto',
          // sichtbare Bildlaufleiste auch dort, wo das System sie ausblendet
          '&::-webkit-scrollbar': { height: 10 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'action.disabled',
            borderRadius: 5,
          },
        }}
      >
        <Table size="small" stickyHeader aria-label="Grundmengen je Wochentag">
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  bgcolor: 'background.paper',
                  minWidth: 160,
                }}
              >
                Posten
              </TableCell>
              <TableCell sx={UNIT_COLUMN}>Einheit</TableCell>
              {days.map((wd) => (
                <TableCell
                  key={wd}
                  align="right"
                  sx={{ minWidth: editable ? 136 : 72 }}
                >
                  <abbr
                    title={WEEKDAY_LONG[wd]}
                    style={{ textDecoration: 'none' }}
                  >
                    {WEEKDAY_SHORT[wd]}
                  </abbr>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sections.map((section) => (
              <React.Fragment key={section.id}>
                <TableRow>
                  <TableCell
                    colSpan={days.length + 2}
                    sx={{
                      bgcolor: 'action.hover',
                      fontWeight: 700,
                      py: 0.75,
                    }}
                  >
                    {section.label}
                  </TableCell>
                </TableRow>
                {section.items.map((item) => (
                  <React.Fragment key={item.id}>
                    <TableRow hover data-testid={`row-${item.id}`}>
                      <TableCell
                        sx={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          bgcolor: 'background.paper',
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.name}
                        </Typography>
                        {item.plu.length > 0 && (
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary' }}
                          >
                            PLU {item.plu.join(', ')}
                          </Typography>
                        )}
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', ...UNIT_INLINE }}
                        >
                          {item.plu.length > 0 ? ' · ' : ''}
                          {item.unit}
                        </Typography>
                      </TableCell>
                      <TableCell
                        sx={{ color: 'text.secondary', ...UNIT_COLUMN }}
                      >
                        {item.unit}
                      </TableCell>
                      {dayCells(item, null)}
                    </TableRow>
                    {item.variants.map((variant) => (
                      <TableRow
                        key={variant}
                        hover
                        data-testid={`row-${item.id}-${variant}`}
                      >
                        <TableCell
                          sx={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 1,
                            bgcolor: 'background.paper',
                            pl: 4,
                          }}
                        >
                          <Typography variant="body2">
                            {variantLabel(config, variant)}
                          </Typography>
                        </TableCell>
                        <TableCell
                          sx={{ color: 'text.secondary', ...UNIT_COLUMN }}
                        >
                          {item.unit}
                        </TableCell>
                        {dayCells(item, variant)}
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  )
}

// ------------------------------------------------------------------ Seite

export default function GrundmengenClient() {
  const session = useOptionalSession()
  const role = session?.user?.role ?? null
  const mayEdit = role !== null && EDIT_ROLES.includes(role)

  const [view, setView] = useState<BackzettelConfigView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reference, setReference] = useState<ReferenceResponse | null>(null)
  const [referenceError, setReferenceError] = useState<string | null>(null)
  const [restAverages, setRestAverages] = useState<RestAverages | null>(null)
  const referenceShown = useMemo(
    () => withRestAverages(reference, restAverages),
    [reference, restAverages]
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  /** Ein Speichern bekam 503 `hq_write_*`: ab jetzt nur lesen. */
  const [writeBlocked, setWriteBlocked] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      setView(await fetchBackzettelConfig())
    } catch (error) {
      setLoadError(errorMessage(error))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!mayEdit) return
    let alive = true
    fetchReference(6).then(
      (res) => alive && setReference(res),
      (error) => alive && setReferenceError(errorMessage(error))
    )
    // M4: Rest Ø nur als Zusatz im Hinweis - fehlt er (keine Zählungen,
    // ältere API), bleibt alles wie bisher.
    fetchRestAverages(6).then(
      (res) => alive && setRestAverages(res),
      () => undefined
    )
    return () => {
      alive = false
    }
  }, [mayEdit])

  const onSave = useCallback(async (edit: BaseEdit, label: string) => {
    setSaveError(null)
    setSavedNote(null)
    try {
      const result = await saveGrundmenge(edit)
      setView(result)
      if (result.changed) setSavedNote(`Gespeichert: ${label}`)
    } catch (error) {
      setSaveError(labelledMessage(label, errorMessage(error)))
      if (
        error instanceof ApiError &&
        typeof error.code === 'string' &&
        error.code.startsWith('hq_write_')
      ) {
        setWriteBlocked(error.message)
      }
      throw error
    }
  }, [])

  const working = view?.working ?? null
  // Auch bei Fehlern in der YAML (z. B. ein in hq gelöschtes Produkt) kommt
  // die Tabelle: gespeichert wird, solange die Änderung keinen neuen Fehler
  // hinzufügt (Server, `newErrors`).
  const config = working?.config ?? null
  const writable = Boolean(view?.writable) && writeBlocked === null
  const editable = mayEdit && writable
  const writeIssueText =
    writeBlocked ??
    view?.writeIssue?.message ??
    'Das hq-Schreibverzeichnis fehlt.'

  const referenceDays = useMemo(() => {
    if (!reference || reference.status !== 'ok') return null
    const all = reference.weekdays.flatMap((w) => w.dates)
    return all.length > 0 ? all.length : 0
  }, [reference])

  // Rechts neben „≈“: was der graue Wert ist und wo er fehlt - als eine
  // Zeile Beschreibung; die ausgewerteten Tage stehen unter „Details“.
  // Normalfall: „≈“ ist in der Beschreibung erklärt, Einzelheiten unter
  // „Details“. Fehlen die Werte, steht das sichtbar da.
  const referenceShownOk =
    mayEdit && reference?.status === 'ok' && reference.available
  const referenceProblem =
    mayEdit && reference && !reference.available
      ? 'Keine Kassenberichte gefunden - Referenzwerte fehlen.'
      : mayEdit && referenceError
      ? `Referenzwerte nicht verfügbar: ${referenceError}`
      : referenceShownOk && referenceDays === 0
      ? 'Für diese Wochentage gibt es noch keine Berichte.'
      : null

  const referenceDetails =
    reference?.status === 'ok' && reference.weekdays.length > 0 ? (
      <Typography variant="body2" color="text.secondary">
        {REFERENCE_TOOLTIP} mit Kassenbericht; Tage ohne Bericht zählen nicht
        als 0. Der Wert wird nie übernommen. Ausgewertete Tage:{' '}
        {reference.weekdays
          .map(
            (w) =>
              `${WEEKDAY_SHORT[w.weekday]} ${
                w.dates.length > 0 ? w.dates.map(formatDate).join(', ') : '–'
              }`
          )
          .join(' · ')}
      </Typography>
    ) : undefined

  return (
    <PageLayout
      width="wide"
      title="Grundmengen"
      subtitle="Was der Backzettel je Wochentag als Basis rechnet."
      back={{ href: '/admin/backzettel', label: 'Zum Backzettel' }}
      actions={
        <Button
          variant="outlined"
          startIcon={<PrintIcon />}
          onClick={() => window.print()}
          sx={{ minHeight: 44, whiteSpace: 'nowrap' }}
        >
          Drucken
        </Button>
      }
    >
      {grundmengenPrintStyles}
      {!view && !loadError && (
        <LinearProgress aria-label="Lädt" className="grundmengen-screen-only" />
      )}

      {loadError && (
        <Alert
          severity="error"
          className="grundmengen-screen-only"
          action={
            <Button color="inherit" onClick={() => void load()}>
              Erneut versuchen
            </Button>
          }
          sx={ALERT_TOUCH}
        >
          Die Grundmengen konnten nicht geladen werden: {loadError}
        </Alert>
      )}

      {view?.pendingApproval && (
        <Alert
          severity="info"
          icon={<PendingIcon />}
          className="grundmengen-screen-only"
          role="status"
          data-testid="pending-banner"
        >
          <AlertTitle>Wartet auf Freigabe</AlertTitle>
          Geänderte Grundmengen liegen in der Freigabe-Anfrage an hq. Bis zur
          Freigabe rechnet der Backzettel mit den bisherigen Werten; geänderte
          Felder sind blau umrandet.
        </Alert>
      )}

      {view && working?.status !== 'ok' && (
        <Alert
          severity="warning"
          className="grundmengen-screen-only"
          data-testid="config-errors"
        >
          <AlertTitle>
            {config
              ? 'Die Backzettel-Stammdaten in hq enthalten Fehler'
              : 'Keine gültigen Backzettel-Stammdaten'}
          </AlertTitle>
          {config && (
            <Typography variant="body2" sx={{ mb: 1 }}>
              Grundmengen lassen sich trotzdem pflegen - ein Speichern wird nur
              abgelehnt, wenn es selbst einen Fehler verursacht. Die Fehler
              unten müssen in hq behoben werden.
            </Typography>
          )}
          {(working?.errors ?? []).length > 0 ? (
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {(working?.errors ?? []).slice(0, 8).map((e) => (
                <li key={`${e.path}-${e.message}`}>
                  {e.path ? <code>{e.path}</code> : null}
                  {e.path ? ': ' : ''}
                  {e.message}
                </li>
              ))}
            </Box>
          ) : (
            'Die Datei config/backzettel.yaml fehlt in hq.'
          )}
        </Alert>
      )}

      {saveError && (
        <Alert
          severity="error"
          className="grundmengen-screen-only"
          onClose={() => setSaveError(null)}
          sx={ALERT_TOUCH}
          role="alert"
        >
          Nicht gespeichert - {saveError}
        </Alert>
      )}

      {savedNote && !saveError && (
        <Alert
          severity="success"
          className="grundmengen-screen-only"
          onClose={() => setSavedNote(null)}
          sx={ALERT_TOUCH}
        >
          {savedNote}
          {view?.pendingApproval ? ' - wartet auf Freigabe.' : '.'}
        </Alert>
      )}

      {view && mayEdit && !writable && (
        <Alert
          severity="info"
          className="grundmengen-screen-only"
          data-testid="read-only"
        >
          Speichern geht auf diesem Server gerade nicht: {writeIssueText} Die
          Werte sind nur zu lesen.
        </Alert>
      )}

      {config && (
        <>
          {/* Bildschirm-Raster; das Druckbild (GrundmengenPrint) steht
              daneben und ersetzt es im Druck. */}
          <Box className="grundmengen-screen-only" sx={{ minWidth: 0 }}>
            <PageSection
              variant="plain"
              title="Posten je Wochentag"
              description={
                <>
                  Leer = noch nicht festgelegt, 0 = wird nicht gebacken.
                  {referenceShownOk &&
                    ' Grau mit ≈: verkauft (Median), nur zur Info.'}
                  {!mayEdit && ' Ändern dürfen Inhaber und Backstube.'}
                  {referenceProblem && (
                    <Box component="span" sx={{ display: 'block' }}>
                      {referenceProblem}
                    </Box>
                  )}
                </>
              }
              details={referenceDetails}
              detailsLabel="Woher kommt ≈?"
            >
              <GrundmengenGrid
                config={config}
                approved={view?.status === 'ok' ? view.config : null}
                pendingApproval={Boolean(view?.pendingApproval)}
                reference={mayEdit ? referenceShown : null}
                editable={editable}
                onSave={onSave}
                onInvalid={(label, text) => {
                  setSavedNote(null)
                  setSaveError(labelledMessage(label, inputProblem(text)))
                }}
              />
            </PageSection>
          </Box>
          <GrundmengenPrint
            config={config}
            approved={
              view?.pendingApproval && view.status === 'ok' ? view.config : null
            }
            reference={mayEdit ? reference : null}
          />
        </>
      )}
    </PageLayout>
  )
}
