'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import NextLink from 'next/link'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
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
} from '@mui/material'
import {
  AddCircleOutline as NewPreorderIcon,
  ChevronLeft as PrevWeekIcon,
  ChevronRight as NextWeekIcon,
  Checklist as PickupListIcon,
  Edit as EditIcon,
  EventBusy as CancelIcon,
  ListAlt as BackingListIcon,
  LocalShipping as PreorderIcon,
  Place as AddressIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import PaymentNote from '../../../../components/preorders/PaymentNote'
import PreorderStatusChip from '../../../../components/preorders/PreorderStatusChip'
import { useOptionalSession } from '../../../../lib/session'
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
  nextDeliveryDate,
  shiftDate,
} from './preorderTypes'
import { TOUCH_LINK_STYLE } from '../../../../lib/muiTheme'

/** Samstag - der Liefertag, solange keine Sammelstelle geladen ist. */
const DEFAULT_WEEKDAY = 6

const PICKUP_POINT_HREF = '/admin/delivery/preorders/lieferstelle'

function StatTile({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string | null
}) {
  return (
    <Box
      sx={{ p: 1.5, height: '100%', borderRadius: 1, bgcolor: 'action.hover' }}
    >
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontSize: '1.15rem', lineHeight: 1.4 }}>
        {value}
      </Typography>
      {note ? (
        <Typography variant="caption" color="text.secondary" display="block">
          {note}
        </Typography>
      ) : null}
    </Box>
  )
}

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
  saved = false,
}: PreorderListClientProps) {
  const session = useOptionalSession()
  const canWrite = canWritePreorders(session?.user?.role)

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
  useEffect(() => {
    let active = true
    fetchPickupPoints()
      .then((list) => {
        if (!active) return
        setPoints(list)
        const first = list.find((p) => p.active !== false) ?? list[0] ?? null
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
  }, [])

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

  return (
    <Box>
      <Box sx={{ mb: { xs: 2, md: 3 } }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 1.5,
            mb: 1,
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}
          >
            <PreorderIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Vorbestellungen
          </Typography>
          <Tooltip title="Aktualisieren">
            <span>
              <IconButton
                aria-label="Vorbestellungen aktualisieren"
                onClick={load}
                disabled={loading || !isBusinessDate(date)}
                sx={{ minWidth: 44, minHeight: 44 }}
              >
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        <Typography variant="subtitle1" color="text.secondary">
          {point
            ? `${point.name}${
                point.window ? ` · Übergabe ${point.window} Uhr` : ''
              }`
            : 'Sammelstelle'}
        </Typography>
      </Box>

      {savedVisible && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setSavedVisible(false)}
        >
          Die Vorbestellung wurde gespeichert.
        </Alert>
      )}

      {pointsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {pointsError}
        </Alert>
      )}

      {!loadingPoints && !pointsError && points.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Es ist keine Sammelstelle angelegt.
        </Alert>
      )}

      {!loadingPoints && point && !hasPickupAddress(point) && (
        <Alert
          severity="warning"
          icon={<AddressIcon />}
          sx={{ mb: 2 }}
          action={
            <Button
              component={NextLink}
              href={PICKUP_POINT_HREF}
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
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', md: 'center' }}
        >
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Tooltip title="Eine Woche zurück">
              <span>
                <IconButton
                  aria-label="Eine Woche zurück"
                  onClick={() => changeDate(shiftDate(date, -7))}
                  disabled={!isBusinessDate(date)}
                  sx={{ minWidth: 44, minHeight: 44 }}
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
              sx={{ minWidth: 170, flex: { xs: 1, md: 'none' } }}
            />
            <Tooltip title="Eine Woche vor">
              <span>
                <IconButton
                  aria-label="Eine Woche vor"
                  onClick={() => changeDate(shiftDate(date, 7))}
                  disabled={!isBusinessDate(date)}
                  sx={{ minWidth: 44, minHeight: 44 }}
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

          <Box sx={{ flexGrow: 1 }} />

          {canWrite && (
            <Button
              component={NextLink}
              href={newHref}
              variant="contained"
              startIcon={<NewPreorderIcon />}
              sx={{ minHeight: 44 }}
            >
              Vorbestellung erfassen
            </Button>
          )}
          <Button
            component={NextLink}
            href={pickupListHref}
            variant={canWrite ? 'outlined' : 'contained'}
            startIcon={<PickupListIcon />}
            sx={{ minHeight: 44 }}
          >
            Abholliste
          </Button>
          <Button
            component={NextLink}
            href={backingListHref}
            variant="outlined"
            startIcon={<BackingListIcon />}
            sx={{ minHeight: 44 }}
          >
            Backliste
          </Button>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {isBusinessDate(date)
            ? `${
                weekday != null ? `${DELIVERY_WEEKDAY_LABELS[weekday]}, ` : ''
              }${formatDate(date)}`
            : 'Bitte einen Liefertag im Format JJJJ-MM-TT wählen.'}
          {point && formatPickupAddress(point)
            ? ` · ${formatPickupAddress(point)}`
            : ''}
        </Typography>
      </Paper>

      {wrongWeekday && point && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Der {formatDate(date)} ist kein{' '}
          {DELIVERY_WEEKDAY_LABELS[point.weekday] ?? 'Liefertag'} - an diesem
          Tag wird nicht zu {point.name} geliefert.
        </Alert>
      )}

      {notice && (
        <Alert severity={notice.passed ? 'warning' : 'info'} sx={{ mb: 2 }}>
          {notice.text}
          {notice.passed
            ? ' Später erfasste Bestellungen sind trotzdem gültig - sie werden als „Nach Bestellschluss“ markiert.'
            : ''}
        </Alert>
      )}

      {conflict && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setConflict(null)}>
          {conflict}
        </Alert>
      )}

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={load}>
              Erneut versuchen
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {summary && (
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={4} md={2}>
            <StatTile label="Bestellungen" value={String(summary.count)} />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <StatTile
              label="Gesamtsumme"
              value={formatCurrency(summary.total)}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <StatTile
              label="Offen"
              value={String(
                summary.byStatus.offen +
                  summary.byStatus.bereit -
                  summary.notCollected
              )}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <StatTile
              label="Übergeben"
              value={String(summary.byStatus.abgeholt)}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <StatTile
              label="Nicht abgeholt"
              value={String(summary.notCollected)}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <StatTile
              label="Noch zu kassieren"
              value={formatCurrency(summary.unpaidTotal)}
              note={moneyNotes(summary)}
            />
          </Grid>
        </Grid>
      )}

      {loading ? (
        <Box
          sx={{ display: 'flex', justifyContent: 'center', p: 6 }}
          role="status"
          aria-label="Vorbestellungen werden geladen"
        >
          <CircularProgress />
        </Box>
      ) : preorders.length === 0 ? (
        !error &&
        day && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary" sx={{ mb: canWrite ? 2 : 0 }}>
              Für diesen Tag ist noch nichts vorbestellt.
            </Typography>
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
          </Paper>
        )
      ) : (
        <TableContainer component={Paper} variant="outlined">
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
                      {preorder.customerPhone ? (
                        <Link
                          href={`tel:${preorder.customerPhone.replace(
                            /[^\d+]/g,
                            ''
                          )}`}
                          underline="hover"
                          sx={TOUCH_LINK_STYLE}
                        >
                          {preorder.customerPhone}
                        </Link>
                      ) : (
                        '–'
                      )}
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
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={toCancel !== null} onClose={() => setToCancel(null)}>
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
    </Box>
  )
}
