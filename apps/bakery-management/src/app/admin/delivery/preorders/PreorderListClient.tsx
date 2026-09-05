'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
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
  Edit as EditIcon,
  EventBusy as CancelIcon,
  ListAlt as BackingListIcon,
  LocalShipping as PreorderIcon,
  Place as AddressIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import {
  cancelPreorder,
  fetchPickupPoints,
  fetchPreorderSummary,
  fetchPreorders,
} from './preorderApi'
import {
  DELIVERY_WEEKDAY_LABELS,
  PREORDER_STATUS_COLORS,
  PREORDER_STATUS_LABELS,
  PickupPoint,
  Preorder,
  PreorderSummary,
  deadlineNotice,
  deliveryWeekdayOf,
  formatCurrency,
  formatDate,
  formatItems,
  formatPickupAddress,
  hasPickupAddress,
  isBusinessDate,
  nextDeliveryDate,
  shiftDate,
} from './preorderTypes'

/** Samstag - der Liefertag, solange keine Sammelstelle geladen ist. */
const DEFAULT_WEEKDAY = 6

const PICKUP_POINT_HREF = '/admin/delivery/preorders/lieferstelle'

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

function StatTile({ label, value }: { label: string; value: string }) {
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
    </Box>
  )
}

interface PreorderListClientProps {
  /** Liefertag aus der URL - z. B. nach dem Speichern einer Bestellung. */
  initialDate?: string
  /** Gesetzt, wenn gerade gespeichert wurde (`?saved=1`). */
  saved?: boolean
}

export default function PreorderListClient({
  initialDate,
  saved = false,
}: PreorderListClientProps) {
  const router = useRouter()

  const [points, setPoints] = useState<PickupPoint[]>([])
  const [pointId, setPointId] = useState<string>('')
  // Leer starten: der Vorgabetag kommt aus der Uhr, und der Wert stünde sonst
  // schon im SSR-HTML - das bricht die Hydration.
  const [date, setDate] = useState(initialDate ?? '')
  const [preorders, setPreorders] = useState<Preorder[]>([])
  const [summary, setSummary] = useState<PreorderSummary | null>(null)
  const [now, setNow] = useState<Date | null>(null)

  const [loadingPoints, setLoadingPoints] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pointsError, setPointsError] = useState<string | null>(null)

  const [toCancel, setToCancel] = useState<Preorder | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
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
          messageOf(err, 'Die Sammelstellen konnten nicht geladen werden')
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
    if (!isBusinessDate(date)) return
    setLoading(true)
    setError(null)
    try {
      const [list, sum] = await Promise.all([
        fetchPreorders({ date, pickupPointId: pointId || undefined }),
        fetchPreorderSummary(date, pointId || undefined),
      ])
      setPreorders(list)
      setSummary(sum)
      // Die Restzeit bis zum Bestellschluss erst hier aus der Uhr lesen.
      setNow(new Date())
    } catch (err) {
      setPreorders([])
      setSummary(null)
      setError(
        messageOf(err, 'Die Vorbestellungen konnten nicht geladen werden')
      )
    } finally {
      setLoading(false)
    }
  }, [date, pointId])

  // Erst laden, wenn die Sammelstellen da sind: sonst liefe der erste Aufruf
  // ohne `pickupPointId` und der zweite gleich hinterher.
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
      await cancelPreorder(toCancel.id)
      setToCancel(null)
      await load()
      router.refresh()
    } catch (err) {
      setCancelError(
        messageOf(err, 'Die Vorbestellung konnte nicht storniert werden')
      )
    } finally {
      setCancelling(false)
    }
  }

  const weekday = isBusinessDate(date) ? deliveryWeekdayOf(date) : null
  const wrongWeekday =
    point != null && weekday != null && weekday !== point.weekday
  // Der Bestellschluss wird auf dem Server gerechnet (`deadlineFor()`) und
  // kommt mit der Tagesauswertung - nicht aus einer vorhandenen Vorbestellung.
  // Sonst fehlte er an genau den Tagen, an denen er gebraucht wird: solange
  // noch nichts erfasst ist.
  const notice = now && summary ? deadlineNotice(summary.deadline, now) : null

  const backingListHref = `/admin/delivery/preorders/backliste?date=${date}${
    pointId ? `&pickupPointId=${encodeURIComponent(pointId)}` : ''
  }`
  const newHref = `/admin/delivery/preorders/new?date=${date}${
    pointId ? `&pickupPointId=${encodeURIComponent(pointId)}` : ''
  }`

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
            : 'Sammelstelle der Samstagstour'}
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
          Für {point.name} ist noch keine Straße hinterlegt. Ohne Adresse findet
          die Fahrer-App keinen Kartenpunkt und keine Navigation.
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
              sx={{ minWidth: 170 }}
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

          <Button
            component={NextLink}
            href={newHref}
            variant="contained"
            startIcon={<NewPreorderIcon />}
          >
            Vorbestellung erfassen
          </Button>
          <Button
            component={NextLink}
            href={backingListHref}
            variant="outlined"
            startIcon={<BackingListIcon />}
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
            ? ' Später erfasste Bestellungen sind trotzdem gültig - sie werden als „Nach Bestellschluss" markiert.'
            : ''}
        </Alert>
      )}

      {/* Ohne Sammelstellen-Stopp hängt die Übergabeliste an nichts: die
          Bestellungen des Tages erreichen den Fahrer nie und blieben für immer
          offen. Das darf nicht lautlos geschehen. */}
      {summary && !summary.hasPickupStop && point && !wrongWeekday && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Für den {formatDate(date)} gibt es noch keine Tour mit dem Stopp „
          {point.name}" - die Vorbestellungen erreichen den Fahrer nicht. Der
          Stopp entsteht beim Anlegen der Tour für diesen Tag; steht die Tour
          schon, muss er in der Fahrer-App nachgetragen werden.
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
            <StatTile label="Offen" value={String(summary.open)} />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <StatTile label="Übergeben" value={String(summary.handedOver)} />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <StatTile
              label="Nicht abgeholt"
              value={String(summary.notCollected)}
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
        !error && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Für diesen Tag ist noch nichts vorbestellt.
            </Typography>
            <Button
              component={NextLink}
              href={newHref}
              variant="contained"
              startIcon={<NewPreorderIcon />}
            >
              Vorbestellung erfassen
            </Button>
          </Paper>
        )
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Vorbestellungen des Liefertags">
            <TableHead>
              <TableRow>
                <TableCell>Referenz</TableCell>
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
                const isCancelled = preorder.status === 'cancelled'
                return (
                  <TableRow
                    key={preorder.id}
                    hover
                    sx={{
                      // Stornierte bleiben sichtbar - sie sind die einzige
                      // Aufzeichnung dessen, was jemand bestellt hatte.
                      textDecoration: isCancelled ? 'line-through' : 'none',
                      opacity: isCancelled ? 0.6 : 1,
                    }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {preorder.reference}
                      </Typography>
                      {preorder.afterDeadline && !isCancelled && (
                        <Chip
                          size="small"
                          color="warning"
                          variant="outlined"
                          label="Nach Bestellschluss"
                          sx={{ mt: 0.5 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {preorder.customer}
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
                      {preorder.phone ? (
                        <Link href={`tel:${preorder.phone}`} underline="hover">
                          {preorder.phone}
                        </Link>
                      ) : (
                        '–'
                      )}
                    </TableCell>
                    <TableCell>{formatItems(preorder.items)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {formatCurrency(preorder.total)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={PREORDER_STATUS_COLORS[preorder.status]}
                        variant={isCancelled ? 'outlined' : 'filled'}
                        label={PREORDER_STATUS_LABELS[preorder.status]}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Bearbeiten">
                        <IconButton
                          aria-label={`Vorbestellung ${preorder.reference} bearbeiten`}
                          component={NextLink}
                          href={`/admin/delivery/preorders/${preorder.id}`}
                          size="small"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {/* Eine übergebene Bestellung wird nicht storniert:
                          die Ware ist raus, das Geld ist kassiert, und ohne
                          die Zeile fehlte dem Bargeld der Beleg. Wer das
                          wirklich rückgängig machen will, setzt sie zuerst
                          auf „Offen" zurück. */}
                      {!isCancelled &&
                        (preorder.status === 'handed_over' ? (
                          <Tooltip
                            title={
                              'Bereits übergeben - zum Stornieren zuerst auf „Offen" zurücksetzen'
                            }
                          >
                            <span>
                              <IconButton
                                aria-label={`Vorbestellung ${preorder.reference} stornieren`}
                                size="small"
                                disabled
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Stornieren">
                            <IconButton
                              aria-label={`Vorbestellung ${preorder.reference} stornieren`}
                              onClick={() => {
                                setCancelError(null)
                                setToCancel(preorder)
                              }}
                              size="small"
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
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
              ? `${toCancel.reference} · ${
                  toCancel.customer
                } · ${formatCurrency(
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
            color="warning"
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
