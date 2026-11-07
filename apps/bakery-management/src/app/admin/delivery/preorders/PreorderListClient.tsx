'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import NextLink from 'next/link'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Link,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  AddCircleOutline as NewPreorderIcon,
  ChevronLeft as PrevWeekIcon,
  ChevronRight as NextWeekIcon,
  Checklist as PickupListIcon,
  Edit as EditIcon,
  EventBusy as CancelIcon,
  ListAlt as BackingListIcon,
  Place as AddressIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import PaymentNote from '../../../../components/preorders/PaymentNote'
import PreorderStatusChip from '../../../../components/preorders/PreorderStatusChip'
import { useOptionalSession } from '../../../../lib/session'
import { isPathAllowedForRole, type PilotRole } from '../../../../lib/roles'
import {
  EmptyState,
  ErrorState,
  KeyFigures,
  LoadingState,
  PageLayout,
  PageSection,
  type KeyFigure,
} from '../../../../components/layout'
import {
  cancelPreorder,
  fetchPickupPoints,
  fetchPreorderDay,
  isPreorderConflict,
  preorderErrorMessage,
} from '../../../../lib/preordersApi'
import {
  canWritePreorders,
  formatItems,
  isCancellable,
  type Preorder,
  type PreorderDay,
} from '../../../../lib/preordersTypes'
import { abhollisteHref } from '../../../../lib/abholliste'
import {
  DELIVERY_WEEKDAY_LABELS,
  PickupPoint,
  deadlineNotice,
  deliveryWeekdayOf,
  formatCurrency,
  formatDate,
  formatPickupAddress,
  hasPickupAddress,
  isBusinessDate,
  moersbachListHref,
  nextDeliveryDate,
  shiftDate,
} from './preorderTypes'
import { TOUCH_LINK_STYLE } from '../../../../lib/muiTheme'

/** Samstag - der Liefertag, solange keine Sammelstelle geladen ist. */
const DEFAULT_WEEKDAY = 6

const PICKUP_POINT_HREF = '/admin/delivery/preorders/lieferstelle'

/**
 * Was „Noch zu kassieren“ nicht enthält (W4-Verifikation Runde 3, wie die
 * Abholliste): ohne Zahlung Übergebenes und zu Erstattendes.
 */
export function moneyNotes(summary: {
  handedOverUnpaidTotal?: number
  refundTotal?: number
}): string | null {
  const parts: string[] = []
  if ((summary.handedOverUnpaidTotal ?? 0) > 0) {
    parts.push(
      `+ ${formatCurrency(
        summary.handedOverUnpaidTotal ?? 0
      )} ohne Zahlung übergeben`
    )
  }
  if ((summary.refundTotal ?? 0) > 0) {
    parts.push(`${formatCurrency(summary.refundTotal ?? 0)} zu erstatten`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

interface PreorderListClientProps {
  /** Liefertag aus der URL - z. B. nach dem Speichern einer Bestellung. */
  initialDate?: string
  /** Sammelstelle aus der URL (`?point=`), sonst die erste aktive. */
  initialPointId?: string
  /** Gesetzt, wenn gerade gespeichert wurde (`?saved=1`). */
  saved?: boolean
}

/**
 * Vorbestellungen eines Liefertags an der Sammelstelle (Mörsbach).
 *
 * Seit P2 auf `/api/preorders` mit der `pickupPointId` der Sammelstelle:
 * eine Anfrage (`GET /day?date=&pickupPointId=`) bringt Liste, Kopfzahlen
 * und Bestellschluss. Erfassen und Bearbeiten laufen über die allgemeine
 * Maske (mit Sorten), übergeben wird in der Abholliste.
 */
export default function PreorderListClient({
  initialDate,
  initialPointId,
  saved = false,
}: PreorderListClientProps) {
  const session = useOptionalSession()
  const role = session?.user?.role ?? null
  const canWrite = canWritePreorders(role)
  // Die Sammelstelle (Adresse, Fenster, Bestellschluss) ändert nur der
  // Inhaber; der Verkauf sieht sie, der Fahrer nicht (ROLE_ACCESS).
  const mayEditPoint = isPathAllowedForRole(
    PICKUP_POINT_HREF,
    role as PilotRole | null,
    session?.sessionKind ?? null
  )
  const canEditPoint = role === 'inhaber'
  const theme = useTheme()
  // Unter md (Handy, Tablet hochkant) Karten statt einer Tabelle, die
  // Artikel, Summe, Status und Aktion seitlich aus dem Bild schiebt.
  const wide = useMediaQuery(theme.breakpoints.up('md'))

  const [points, setPoints] = useState<PickupPoint[]>([])
  const [pointId, setPointId] = useState<string>('')
  // Leer starten: der Vorgabetag kommt aus der Uhr, und der Wert stünde sonst
  // schon im SSR-HTML - das bricht die Hydration.
  const [date, setDate] = useState(initialDate ?? '')
  const [day, setDay] = useState<PreorderDay | null>(null)
  const [now, setNow] = useState<Date | null>(null)

  const [loadingPoints, setLoadingPoints] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pointsError, setPointsError] = useState<string | null>(null)

  const [toCancel, setToCancel] = useState<Preorder | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<string | null>(null)
  const [savedVisible, setSavedVisible] = useState(saved)

  const point = useMemo(
    () => points.find((p) => p.id === pointId) ?? null,
    [points, pointId]
  )

  /* ------------------------------------------------------------------ *
   * Sammelstellen - sie geben Liefertag und Bestellschluss vor.
   * ------------------------------------------------------------------ */
  // Erneut versuchen nach einem Ausfall: zählt hoch und lädt neu.
  const [pointsAttempt, setPointsAttempt] = useState(0)
  useEffect(() => {
    let active = true
    fetchPickupPoints()
      .then((list) => {
        if (!active) return
        setPoints(list)
        const fromUrl = initialPointId
          ? list.find((p) => p.id === initialPointId)
          : undefined
        const first =
          fromUrl ?? list.find((p) => p.active !== false) ?? list[0] ?? null
        if (first) setPointId(first.id)
        setDate((current) =>
          isBusinessDate(current)
            ? current
            : nextDeliveryDate(first ? first.weekday : DEFAULT_WEEKDAY)
        )
      })
      .catch((err) => {
        if (!active) return
        setPointsError(
          preorderErrorMessage(
            err,
            'Die Sammelstellen konnten nicht geladen werden'
          )
        )
        setDate((current) =>
          isBusinessDate(current) ? current : nextDeliveryDate(DEFAULT_WEEKDAY)
        )
      })
      .finally(() => {
        if (active) setLoadingPoints(false)
      })
    return () => {
      active = false
    }
    // Beim ersten Laden (und „Erneut versuchen“): danach wählt die Seite
    // die Sammelstelle selbst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsAttempt])

  const retryPoints = () => {
    setPointsError(null)
    setLoadingPoints(true)
    setPointsAttempt((n) => n + 1)
  }

  // Liefertag und Sammelstelle in die URL - ein Neuladen oder „Zurück“ aus
  // einer Bestellung bleibt so auf demselben Tag und Ort, und `?saved=1`
  // zeigt nach einem Neuladen nicht noch einmal „gespeichert“.
  useEffect(() => {
    if (!isBusinessDate(date) || !pointId) return
    if (typeof window === 'undefined') return
    const href = moersbachListHref(date, false, pointId)
    if (`${window.location.pathname}${window.location.search}` !== href) {
      window.history.replaceState(window.history.state, '', href)
    }
  }, [date, pointId])

  const load = useCallback(async () => {
    // Ohne Sammelstelle gibt es nichts zu zeigen: der Tag ohne Ort wäre der
    // ganze Laden.
    if (!isBusinessDate(date) || !pointId) return
    setLoading(true)
    setError(null)
    try {
      setDay(await fetchPreorderDay(date, pointId))
      // Die Restzeit bis zum Bestellschluss erst hier aus der Uhr lesen.
      setNow(new Date())
    } catch (err) {
      setDay(null)
      setError(
        preorderErrorMessage(
          err,
          'Die Vorbestellungen konnten nicht geladen werden'
        )
      )
    } finally {
      setLoading(false)
    }
  }, [date, pointId])

  // Erst laden, wenn die Sammelstellen da sind.
  useEffect(() => {
    if (!loadingPoints) load()
  }, [load, loadingPoints])

  const changeDate = (next: string) => {
    setSavedVisible(false)
    setDate(next)
  }

  const handleCancel = async () => {
    if (!toCancel) return
    setCancelling(true)
    setCancelError(null)
    try {
      await cancelPreorder(toCancel.id, toCancel.updatedAt)
      setToCancel(null)
      await load()
    } catch (err) {
      if (isPreorderConflict(err)) {
        setToCancel(null)
        setConflict(
          `${toCancel.code}: ${preorderErrorMessage(
            err,
            'Die Bestellung wurde inzwischen geändert.'
          )} Die Liste ist neu geladen - es wurde nichts storniert.`
        )
        await load()
      } else {
        setCancelError(
          preorderErrorMessage(
            err,
            'Die Vorbestellung konnte nicht storniert werden'
          )
        )
      }
    } finally {
      setCancelling(false)
    }
  }

  const preorders = day?.preorders ?? []
  const summary = day?.summary ?? null
  const weekday = isBusinessDate(date) ? deliveryWeekdayOf(date) : null
  const wrongWeekday =
    point != null && weekday != null && weekday !== point.weekday
  // Der Bestellschluss wird auf dem Server gerechnet (`deadlineFor()`) und
  // kommt mit dem Tag - auch an Tagen ohne Vorbestellung.
  const deadline =
    day?.pickupPoints.find((p) => p.id === pointId)?.deadline ?? null
  const notice = now && day ? deadlineNotice(deadline, now) : null

  const backingListHref = `/admin/delivery/preorders/backliste?date=${date}${
    pointId ? `&pickupPointId=${encodeURIComponent(pointId)}` : ''
  }`
  const newHref = `/admin/delivery/preorders/new?date=${date}${
    pointId ? `&pickupPointId=${encodeURIComponent(pointId)}` : ''
  }`
  const pickupListHref = abhollisteHref(date, pointId || undefined)
  // Die gewählte Sammelstelle bearbeiten - ohne Kennung öffnete die Seite
  // immer die erste, und man änderte die falsche Adresse.
  const pickupPointHref = pointId
    ? `${PICKUP_POINT_HREF}?pickupPointId=${encodeURIComponent(pointId)}`
    : PICKUP_POINT_HREF

  /** Ansehen/Bearbeiten und Stornieren - gleich in Tabelle und Karte. */
  const renderActions = (preorder: Preorder) => {
    const isCancelled = preorder.status === 'storniert'
    return (
      <>
        <Tooltip title={canWrite ? 'Bearbeiten' : 'Ansehen'}>
          <IconButton
            aria-label={`Vorbestellung ${preorder.code} ${
              canWrite ? 'bearbeiten' : 'ansehen'
            }`}
            component={NextLink}
            href={`/admin/delivery/preorders/${preorder.id}`}
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {/* Eine übergebene Bestellung wird nicht storniert:
            die Ware ist raus, das Geld ist kassiert. Wer das
            wirklich rückgängig machen will, setzt sie zuerst
            auf „Offen“ zurück. */}
        {canWrite &&
          !isCancelled &&
          (isCancellable(preorder) ? (
            <Tooltip title="Stornieren">
              <IconButton
                aria-label={`Vorbestellung ${preorder.code} stornieren`}
                onClick={() => {
                  setCancelError(null)
                  setToCancel(preorder)
                }}
                sx={{ minWidth: 44, minHeight: 44 }}
              >
                <CancelIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip
              title={
                'Bereits übergeben - zum Stornieren zuerst auf „Offen“ zurücksetzen'
              }
            >
              <span>
                <IconButton
                  aria-label={`Vorbestellung ${preorder.code} stornieren`}
                  disabled
                  sx={{ minWidth: 44, minHeight: 44 }}
                >
                  <CancelIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          ))}
      </>
    )
  }

  const renderPhone = (preorder: Preorder) =>
    preorder.customerPhone ? (
      <Link
        href={`tel:${preorder.customerPhone.replace(/[^\d+]/g, '')}`}
        underline="hover"
        sx={TOUCH_LINK_STYLE}
      >
        {preorder.customerPhone}
      </Link>
    ) : (
      '–'
    )

  const address = point ? formatPickupAddress(point) : ''
  const dateText = isBusinessDate(date)
    ? `${
        weekday != null ? `${DELIVERY_WEEKDAY_LABELS[weekday]}, ` : ''
      }${formatDate(date)}`
    : 'Bitte einen Liefertag im Format JJJJ-MM-TT wählen.'
  const waitingCount = summary
    ? summary.byStatus.offen + summary.byStatus.bereit - summary.notCollected
    : 0
  // Dieselben vier Zahlen wie die Abholliste (W4-verify r4: „Warten noch“
  // = Offen + Bereit ohne „nicht abgeholt“).
  const figures: KeyFigure[] = summary
    ? [
        {
          label: 'Übergeben',
          value: `${summary.byStatus.abgeholt} von ${summary.count}`,
        },
        {
          label: 'Warten noch',
          value: String(waitingCount),
          hint:
            summary.notCollected > 0
              ? `${summary.notCollected} nicht abgeholt`
              : undefined,
        },
        { label: 'Gesamtsumme', value: formatCurrency(summary.total) },
        {
          label: 'Noch zu kassieren',
          value: formatCurrency(summary.unpaidTotal),
          tone: summary.unpaidTotal > 0 ? 'warning' : 'default',
          hint: moneyNotes(summary) ?? undefined,
        },
      ]
    : []

  return (
    <PageLayout
      width="wide"
      title={point ? `Sammelstelle ${point.name}` : 'Sammelstelle'}
      subtitle={[
        point?.window ? `Übergabe ${point.window} Uhr` : null,
        address || null,
      ]
        .filter(Boolean)
        .join(' · ')}
      actions={
        <>
          {canWrite && (
            <Button
              component={NextLink}
              href={newHref}
              variant="contained"
              startIcon={<NewPreorderIcon />}
            >
              Vorbestellung erfassen
            </Button>
          )}
          <Button
            component={NextLink}
            href={pickupListHref}
            variant={canWrite ? 'outlined' : 'contained'}
            startIcon={<PickupListIcon />}
          >
            Abholliste
          </Button>
          <Button
            component={NextLink}
            href={backingListHref}
            variant="outlined"
            startIcon={<BackingListIcon />}
          >
            Backliste
          </Button>
        </>
      }
    >
      {savedVisible && (
        <Alert severity="success" onClose={() => setSavedVisible(false)}>
          Die Vorbestellung wurde gespeichert.
        </Alert>
      )}

      {pointsError && (
        <ErrorState message={pointsError} onRetry={retryPoints} />
      )}

      {!loadingPoints && !pointsError && points.length === 0 && (
        <Alert severity="info">Es ist keine Sammelstelle angelegt.</Alert>
      )}

      {!loadingPoints && point && !hasPickupAddress(point) && (
        <Alert
          severity="warning"
          icon={<AddressIcon />}
          action={
            <Button
              component={NextLink}
              href={pickupPointHref}
              color="inherit"
              size="small"
            >
              Adresse nachtragen
            </Button>
          }
        >
          Für {point.name} ist noch keine Straße hinterlegt - sie fehlt dann
          auch auf der Abholliste.
        </Alert>
      )}

      {/* Tagwahl */}
      <PageSection>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          useFlexGap
          flexWrap="wrap"
        >
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Tooltip title="Eine Woche zurück">
              <span>
                <IconButton
                  aria-label="Eine Woche zurück"
                  onClick={() => changeDate(shiftDate(date, -7))}
                  disabled={!isBusinessDate(date)}
                >
                  <PrevWeekIcon />
                </IconButton>
              </span>
            </Tooltip>
            <TextField
              label="Liefertag"
              type="date"
              size="small"
              value={date}
              onChange={(event) => changeDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 160, flex: { xs: 1, sm: 'none' } }}
            />
            <Tooltip title="Eine Woche vor">
              <span>
                <IconButton
                  aria-label="Eine Woche vor"
                  onClick={() => changeDate(shiftDate(date, 7))}
                  disabled={!isBusinessDate(date)}
                >
                  <NextWeekIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          {points.length > 1 && (
            <TextField
              select
              label="Sammelstelle"
              size="small"
              value={pointId}
              onChange={(event) => setPointId(event.target.value)}
              sx={{ minWidth: 220 }}
            >
              {points.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
          )}

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ flex: { sm: 1 } }}
          >
            {dateText}
          </Typography>

          <Stack direction="row" spacing={0.5} alignItems="center">
            {mayEditPoint && (
              <Button component={NextLink} href={pickupPointHref}>
                {canEditPoint ? 'Sammelstelle bearbeiten' : 'Sammelstelle'}
              </Button>
            )}
            <Tooltip title="Aktualisieren">
              <span>
                <IconButton
                  aria-label="Vorbestellungen aktualisieren"
                  onClick={load}
                  disabled={loading || !isBusinessDate(date)}
                >
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </PageSection>

      {wrongWeekday && point && (
        <Alert severity="warning">
          Der {formatDate(date)} ist kein{' '}
          {DELIVERY_WEEKDAY_LABELS[point.weekday] ?? 'Liefertag'} - an diesem
          Tag wird nicht zu {point.name} geliefert.
        </Alert>
      )}

      {notice && (
        <Alert severity={notice.passed ? 'warning' : 'info'}>
          {notice.text}
          {notice.passed
            ? ' Spätere Bestellungen gelten trotzdem (markiert „Nach Bestellschluss“).'
            : ''}
        </Alert>
      )}

      {conflict && (
        <Alert severity="info" onClose={() => setConflict(null)}>
          {conflict}
        </Alert>
      )}

      {error && <ErrorState message={error} onRetry={load} />}

      {summary && (
        <KeyFigures items={figures} aria-label="Stand des Liefertags" />
      )}

      {loading ? (
        <LoadingState label="Vorbestellungen werden geladen …" />
      ) : preorders.length === 0 ? (
        !error &&
        day && (
          <EmptyState
            title="Für diesen Tag ist noch nichts vorbestellt."
            action={
              canWrite ? (
                <Button
                  component={NextLink}
                  href={newHref}
                  variant="contained"
                  startIcon={<NewPreorderIcon />}
                >
                  Vorbestellung erfassen
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <PageSection
          title={`Bestellungen (${preorders.length})`}
          variant={wide ? 'card' : 'plain'}
          disablePadding
        >
          {!wide ? (
            <Stack spacing={1} data-testid="preorder-cards">
              {preorders.map((preorder) => {
                const isCancelled = preorder.status === 'storniert'
                return (
                  <Paper
                    key={preorder.id}
                    data-testid="preorder-card"
                    sx={{ p: 1.5 }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="flex-start"
                      justifyContent="space-between"
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontWeight: 600,
                            overflowWrap: 'anywhere',
                            textDecoration: isCancelled
                              ? 'line-through'
                              : 'none',
                            color: isCancelled
                              ? 'text.secondary'
                              : 'text.primary',
                          }}
                        >
                          {preorder.customerName}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontFamily: 'monospace' }}
                        >
                          {preorder.code}
                        </Typography>
                      </Box>
                      <PreorderStatusChip preorder={preorder} />
                    </Stack>
                    {preorder.afterDeadline && !isCancelled && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label="Nach Bestellschluss"
                        sx={{ mt: 0.5 }}
                      />
                    )}
                    {preorder.note && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ mt: 0.5, overflowWrap: 'anywhere' }}
                      >
                        {preorder.note}
                      </Typography>
                    )}
                    <Typography
                      variant="body2"
                      sx={{
                        mt: 1,
                        overflowWrap: 'anywhere',
                        textDecoration: isCancelled ? 'line-through' : 'none',
                        color: isCancelled ? 'text.secondary' : 'text.primary',
                      }}
                    >
                      {formatItems(preorder.items)}
                    </Typography>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      spacing={1}
                      sx={{ mt: 0.5, flexWrap: 'wrap' }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {formatCurrency(preorder.total)}
                        </Typography>
                        <PaymentNote preorder={preorder} variant="caption" />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {renderPhone(preorder)}
                        {renderActions(preorder)}
                      </Box>
                    </Stack>
                  </Paper>
                )
              })}
            </Stack>
          ) : (
            <TableContainer>
              <Table size="small" aria-label="Vorbestellungen des Liefertags">
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell>
                    <TableCell>Kunde</TableCell>
                    <TableCell>Telefon</TableCell>
                    <TableCell>Artikel</TableCell>
                    <TableCell align="right">Summe</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Aktion</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preorders.map((preorder) => {
                    const isCancelled = preorder.status === 'storniert'
                    return (
                      <TableRow
                        key={preorder.id}
                        hover
                        sx={{
                          verticalAlign: 'top',
                          // Stornierte bleiben sichtbar - sie sind die einzige
                          // Aufzeichnung dessen, was jemand bestellt hatte.
                          textDecoration: isCancelled ? 'line-through' : 'none',
                          '& td': isCancelled
                            ? { color: 'text.secondary' }
                            : undefined,
                        }}
                      >
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, fontFamily: 'monospace' }}
                          >
                            {preorder.code}
                          </Typography>
                          {preorder.afterDeadline && !isCancelled && (
                            <Chip
                              size="small"
                              variant="outlined"
                              label="Nach Bestellschluss"
                              sx={{ mt: 0.5 }}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {preorder.customerName}
                          {preorder.note && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              {preorder.note}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {renderPhone(preorder)}
                        </TableCell>
                        <TableCell>{formatItems(preorder.items)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {formatCurrency(preorder.total)}
                          <PaymentNote preorder={preorder} variant="caption" />
                        </TableCell>
                        <TableCell>
                          <PreorderStatusChip preorder={preorder} />
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {renderActions(preorder)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </PageSection>
      )}

      <Dialog
        open={toCancel !== null}
        onClose={() => !cancelling && setToCancel(null)}
      >
        <DialogTitle>Vorbestellung stornieren?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {toCancel
              ? `${toCancel.code} · ${toCancel.customerName} · ${formatCurrency(
                  toCancel.total
                )}. Die Bestellung wird nicht gelöscht, sondern bleibt durchgestrichen in der Liste stehen.`
              : ''}
          </DialogContentText>
          {cancelError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {cancelError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToCancel(null)} disabled={cancelling}>
            Abbrechen
          </Button>
          <Button
            onClick={handleCancel}
            color="error"
            variant="contained"
            disabled={cancelling}
          >
            Stornieren
          </Button>
        </DialogActions>
      </Dialog>
    </PageLayout>
  )
}
