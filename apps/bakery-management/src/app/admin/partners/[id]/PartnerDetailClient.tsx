'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Paper,
  Snackbar,
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
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AssessmentIcon from '@mui/icons-material/Assessment'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ListAltIcon from '@mui/icons-material/ListAlt'
import PlaceIcon from '@mui/icons-material/Place'
import RefreshIcon from '@mui/icons-material/Refresh'
import StorefrontIcon from '@mui/icons-material/Storefront'
import {
  deleteVisit,
  fetchPartner,
  fetchToday,
} from '../../../../lib/partnerApi'
import {
  DayDetail,
  Partner,
  PartnerStats,
  PartnerVisit,
  SettlementModel,
  TimelineEntry,
  VISIT_TYPE_COLORS,
  VISIT_TYPE_LABELS,
  WEEKDAY_SHORT,
  formatCurrency,
  formatDate,
  formatPercent,
  formatTime,
  shiftDate,
  toBusinessDate,
  weekdayOf,
} from '../../../../lib/partnerTypes'

type DayView = DayDetail & { visits: PartnerVisit[] }
type Totals = PartnerStats['totals']

const SETTLEMENT_LABELS: Record<SettlementModel, string> = {
  commission: 'Kommission',
  firm_sale: 'Festkauf',
}

const SETTLEMENT_DESCRIPTIONS: Record<SettlementModel, string> = {
  commission:
    'Abgerechnet wird nur, was verkauft wurde - die Reste kommen zurück.',
  firm_sale: 'Die gelieferte Ware wird fest abgerechnet.',
}

/** Menge - `null` heißt "nicht gezählt", nicht "null Stück". */
function formatQty(value: number | null | undefined): string {
  return value == null ? '–' : String(value)
}

function KpiTile({
  label,
  value,
  hint,
  provisional,
  color,
}: {
  label: string
  value: string
  hint?: string
  provisional?: boolean
  color?: string
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ py: { xs: 1.5, md: 2 } }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {label}
        </Typography>
        <Typography
          variant="h4"
          sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, color: color }}
        >
          {value}
        </Typography>
        {provisional ? (
          <Typography variant="caption" color="warning.main">
            vorläufig
          </Typography>
        ) : hint ? (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** Ein Besuch in der Timeline - zugeklappt die Summen, aufgeklappt je Produkt. */
function TimelineCard({
  entry,
  partnerId,
  onDelete,
}: {
  entry: TimelineEntry
  partnerId: string
  onDelete: (entry: TimelineEntry) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      <Box
        sx={{
          p: { xs: 1.5, md: 2 },
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 1.5,
          alignItems: { xs: 'stretch', md: 'flex-start' },
        }}
      >
        <Box sx={{ minWidth: 96 }}>
          <Typography variant="h6" component="p">
            {formatTime(entry.visitAt)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {entry.sequence}. Besuch
          </Typography>
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ mb: 0.5 }}
          >
            <Chip
              size="small"
              label={VISIT_TYPE_LABELS[entry.visitType]}
              color={VISIT_TYPE_COLORS[entry.visitType]}
            />
            <Typography variant="body2" color="text.secondary">
              {entry.staffName || 'Person nicht erfasst'}
            </Typography>
          </Stack>

          {entry.note && (
            <Typography variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
              „{entry.note}“
            </Typography>
          )}

          <Stack
            direction="row"
            spacing={{ xs: 2, md: 3 }}
            flexWrap="wrap"
            useFlexGap
          >
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
              >
                Rest gezählt
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {entry.countedQty}
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
              >
                Neu geliefert
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {entry.deliveredQty}
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
              >
                Verkauft seit letztem Besuch
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {entry.soldSinceLastQty} ·{' '}
                {formatCurrency(entry.soldSinceLastRevenue)}
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
              >
                Bestand danach
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {entry.stockAfterQty}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Stack direction="row" spacing={0.5} sx={{ alignSelf: 'flex-start' }}>
          <Tooltip title="Besuch korrigieren">
            <IconButton
              size="small"
              component={Link}
              href={`/admin/partners/${partnerId}/visit/new?visit=${entry.visitId}`}
              aria-label={`Besuch um ${formatTime(entry.visitAt)} korrigieren`}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Besuch löschen">
            <IconButton
              size="small"
              color="error"
              onClick={() => onDelete(entry)}
              aria-label={`Besuch um ${formatTime(entry.visitAt)} löschen`}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={open ? 'Produkte ausblenden' : 'Produkte anzeigen'}>
            <IconButton
              size="small"
              onClick={() => setOpen((prev) => !prev)}
              aria-expanded={open}
              aria-label={
                open
                  ? `Produkte des Besuchs um ${formatTime(
                      entry.visitAt
                    )} ausblenden`
                  : `Produkte des Besuchs um ${formatTime(
                      entry.visitAt
                    )} anzeigen`
              }
            >
              {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Collapse in={open} unmountOnExit>
        <Divider />
        {entry.items.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Für diesen Besuch sind keine Produkte erfasst.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Produkt</TableCell>
                  <TableCell align="right">Rest</TableCell>
                  <TableCell align="right">Neu</TableCell>
                  <TableCell align="right">
                    Verkauft seit letztem Besuch
                  </TableCell>
                  <TableCell align="right">Bestand danach</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entry.items.map((item) => (
                  <TableRow key={item.productSlug || item.productId} hover>
                    <TableCell>
                      <Typography variant="body2">
                        {item.productName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatCurrency(item.unitPrice)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {formatQty(item.countedQty)}
                    </TableCell>
                    <TableCell align="right">{item.deliveredQty}</TableCell>
                    <TableCell align="right">{item.soldSinceLastQty}</TableCell>
                    <TableCell align="right">{item.stockAfterQty}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Collapse>
    </Paper>
  )
}

export default function PartnerDetailClient({
  partnerId,
}: {
  partnerId: string
}) {
  // Leer starten: `toBusinessDate()` im Initialisierer landet im SSR-HTML und
  // weicht über Mitternacht vom Browser ab, was die Hydration zerlegt.
  // Der heutige Geschäftstag wird nach dem Mount gesetzt.
  const [selectedDate, setSelectedDate] = useState('')
  const [partner, setPartner] = useState<Partner | null>(null)
  const [day, setDay] = useState<DayView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TimelineEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [feedback, setFeedback] = useState<{
    message: string
    severity: 'success' | 'error'
  } | null>(null)

  useEffect(() => {
    setSelectedDate((current) => current || toBusinessDate())
  }, [])

  const load = useCallback(async () => {
    // Vor dem Mount steht noch kein Geschäftstag fest - dann nicht laden.
    if (!selectedDate) return
    setLoading(true)
    setError(null)
    try {
      const [partnerData, dayData] = await Promise.all([
        fetchPartner(partnerId),
        fetchToday(partnerId, selectedDate),
      ])
      setPartner(partnerData)
      setDay(dayData)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Die Partnerdaten konnten nicht geladen werden.'
      )
    } finally {
      setLoading(false)
    }
  }, [partnerId, selectedDate])

  useEffect(() => {
    load()
  }, [load])

  const timeline = day?.timeline ?? []
  const totals: Totals | null = day?.totals ?? null
  const isOpen = day?.isOpen !== false
  // Abholung erfasst, aber nicht jedes Produkt mit Bestand gezählt
  const isComplete = day?.isComplete !== false
  const uncountedProducts = day?.uncountedProducts ?? []
  const provisional = isOpen || !isComplete
  const hasVisits = timeline.length > 0

  const address = useMemo(() => {
    if (!partner) return ''
    const city = [partner.zip, partner.city].filter(Boolean).join(' ')
    return [partner.street, city].filter(Boolean).join(', ')
  }, [partner])

  const deliveryDayLabel = useMemo(() => {
    if (!partner?.deliveryDays?.length) return ''
    return partner.deliveryDays
      .map((d) => WEEKDAY_SHORT[d] || String(d))
      .join(', ')
  }, [partner])

  const isDeliveryDay = useMemo(() => {
    const weekday = weekdayOf(selectedDate)
    if (weekday == null || !partner?.deliveryDays?.length) return true
    return partner.deliveryDays.includes(weekday)
  }, [partner, selectedDate])

  const captureHref = `/admin/partners/${partnerId}/visit/new?date=${selectedDate}`

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteVisit(partnerId, deleteTarget.visitId)
      setDeleteTarget(null)
      setFeedback({ message: 'Besuch gelöscht.', severity: 'success' })
      await load()
    } catch (err) {
      setFeedback({
        message:
          err instanceof Error
            ? err.message
            : 'Der Besuch konnte nicht gelöscht werden.',
        severity: 'error',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Box>
      <Button
        component={Link}
        href="/admin/partners"
        startIcon={<ArrowBackIcon />}
        size="small"
        sx={{ mb: 1 }}
      >
        Alle Verkaufspartner
      </Button>

      {/* Kopf: Partner, Adresse, Abrechnungsmodell, Datum, Erfassen-Button */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', lg: 'flex-start' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}
          >
            <StorefrontIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            {partner?.name || 'Verkaufspartner'}
          </Typography>

          {address && (
            <Typography
              variant="subtitle1"
              color="text.secondary"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}
            >
              <PlaceIcon fontSize="small" />
              {address}
            </Typography>
          )}
          {partner && !address && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Adresse noch nicht hinterlegt.
            </Typography>
          )}

          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ mt: 1.5 }}
          >
            {partner && (
              <Tooltip title={SETTLEMENT_DESCRIPTIONS[partner.settlementModel]}>
                <Chip
                  size="small"
                  color="secondary"
                  label={`Abrechnung: ${
                    SETTLEMENT_LABELS[partner.settlementModel] ||
                    partner.settlementModel
                  }`}
                />
              </Tooltip>
            )}
            {deliveryDayLabel && (
              <Chip
                size="small"
                variant="outlined"
                label={`Liefertage: ${deliveryDayLabel}`}
              />
            )}
            {partner && !partner.active && (
              <Chip size="small" color="warning" label="Inaktiv" />
            )}
          </Stack>
        </Box>

        <Stack spacing={1.5} sx={{ minWidth: { lg: 340 } }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Vorheriger Tag">
              <IconButton
                size="small"
                aria-label="Vorheriger Tag"
                onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
              >
                <ChevronLeftIcon />
              </IconButton>
            </Tooltip>
            <TextField
              type="date"
              size="small"
              label="Geschäftstag"
              value={selectedDate}
              onChange={(e) =>
                setSelectedDate(e.target.value || toBusinessDate())
              }
              InputLabelProps={{ shrink: true }}
              sx={{ flexGrow: 1 }}
            />
            <Tooltip title="Nächster Tag">
              <IconButton
                size="small"
                aria-label="Nächster Tag"
                onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
              >
                <ChevronRightIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Aktualisieren">
              <span>
                <IconButton
                  size="small"
                  aria-label="Daten aktualisieren"
                  onClick={load}
                  disabled={loading}
                >
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          <Button
            component={Link}
            href={captureHref}
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            fullWidth
          >
            Besuch erfassen
          </Button>

          <Stack direction="row" spacing={1}>
            <Button
              component={Link}
              href={`/admin/partners/${partnerId}/templates`}
              variant="outlined"
              size="small"
              startIcon={<ListAltIcon />}
              fullWidth
            >
              Vorlagen
            </Button>
            <Button
              component={Link}
              href={`/admin/partners/${partnerId}/report`}
              variant="outlined"
              size="small"
              startIcon={<AssessmentIcon />}
              fullWidth
            >
              Report
            </Button>
          </Stack>
        </Stack>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={load}>
              Erneut versuchen
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {loading ? (
        <Box
          sx={{ display: 'flex', justifyContent: 'center', p: 6 }}
          role="status"
          aria-label="Partnerdaten werden geladen"
        >
          <CircularProgress />
        </Box>
      ) : (
        !error && (
          <>
            {/* Tagesstatus - offene Tage sind ausdrücklich vorläufig */}
            {!hasVisits ? (
              <Alert severity="warning" sx={{ mb: 3 }}>
                <AlertTitle>Tag noch offen – kein Besuch erfasst</AlertTitle>
                Für den {formatDate(selectedDate)} ist noch kein Besuch am
                Backschrank erfasst. Verkauf und Umsatz lassen sich erst nach
                der Erstbestückung berechnen.
                {!isDeliveryDay &&
                  ' Der Tag ist außerdem kein regulärer Liefertag.'}
              </Alert>
            ) : isOpen ? (
              <Alert severity="warning" sx={{ mb: 3 }}>
                <AlertTitle>
                  Tag noch offen – Verkauf und Umsatz sind vorläufig
                </AlertTitle>
                Für den {formatDate(selectedDate)} ist noch keine Abholung
                erfasst. Erst die Abholung schließt den Geschäftstag ab; bis
                dahin zählt alles, was noch im Schrank liegt, rechnerisch als
                verkauft.
              </Alert>
            ) : !isComplete ? (
              <Alert severity="warning" sx={{ mb: 3 }}>
                <AlertTitle>
                  Abholung unvollständig – {day?.uncountedQty ?? 0} Stück nicht
                  gezählt
                </AlertTitle>
                Bei der Abholung am {formatDate(selectedDate)} wurde nicht jedes
                Produkt mit Bestand gezählt. Diese Stücke sind weder als
                verkauft noch als Retoure erfasst; Verkauf und Umsatz bleiben
                vorläufig:{' '}
                <strong>
                  {uncountedProducts
                    .map((p) => `${p.productName}: ${p.stockQty} erwartet`)
                    .join(', ')}
                </strong>
              </Alert>
            ) : (
              <Alert severity="success" sx={{ mb: 3 }}>
                <AlertTitle>Tag abgeschlossen</AlertTitle>
                Die Abholung für den {formatDate(selectedDate)} ist erfasst –
                Verkauf, Retoure und Umsatz sind endgültig.
              </Alert>
            )}

            {/* Kennzahlen des gewählten Geschäftstags */}
            <Grid container spacing={{ xs: 1.5, md: 2 }} sx={{ mb: 4 }}>
              <Grid item xs={6} md={4} lg={2.4}>
                <KpiTile
                  label="Geliefert"
                  value={String(totals?.deliveredQty ?? 0)}
                  hint="Stück eingeräumt"
                />
              </Grid>
              <Grid item xs={6} md={4} lg={2.4}>
                <KpiTile
                  label="Verkauft"
                  value={String(totals?.soldQty ?? 0)}
                  hint="Stück"
                  provisional={provisional}
                />
              </Grid>
              <Grid item xs={6} md={4} lg={2.4}>
                <KpiTile
                  label="Retoure"
                  value={String(totals?.returnedQty ?? 0)}
                  hint={
                    isOpen
                      ? 'erst mit der Abholung'
                      : !isComplete
                      ? 'unvollständig gezählt'
                      : formatCurrency(totals?.returnValue ?? 0)
                  }
                />
              </Grid>
              <Grid item xs={6} md={6} lg={2.4}>
                <KpiTile
                  label="Umsatz"
                  value={formatCurrency(totals?.revenue ?? 0)}
                  hint="zu HQ-Preisen"
                  provisional={provisional}
                  color="success.main"
                />
              </Grid>
              <Grid item xs={12} md={6} lg={2.4}>
                <KpiTile
                  label="Abverkaufsquote"
                  value={formatPercent(totals?.sellThroughRate)}
                  hint="verkauft / geliefert"
                  provisional={provisional}
                />
              </Grid>
            </Grid>

            {/* Besuchs-Timeline */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 2,
                mb: 1.5,
              }}
            >
              <Typography variant="h6" component="h2">
                Besuche am {formatDate(selectedDate)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {totals?.visitCount ?? timeline.length} Besuche ·{' '}
                {totals?.refillCount ?? 0} Nachlieferungen
              </Typography>
            </Box>

            {hasVisits ? (
              timeline.map((entry) => (
                <TimelineCard
                  key={entry.visitId}
                  entry={entry}
                  partnerId={partnerId}
                  onDelete={setDeleteTarget}
                />
              ))
            ) : (
              <Paper
                variant="outlined"
                sx={{ p: { xs: 3, md: 5 }, textAlign: 'center' }}
              >
                <Typography color="text.secondary" gutterBottom>
                  Für diesen Tag ist noch kein Besuch erfasst.
                </Typography>
                <Button
                  component={Link}
                  href={captureHref}
                  variant="contained"
                  startIcon={<AddIcon />}
                  sx={{ mt: 1 }}
                >
                  Besuch erfassen
                </Button>
              </Paper>
            )}
          </>
        )
      )}

      {/* Löschen nur nach ausdrücklicher Bestätigung */}
      <Dialog
        open={deleteTarget !== null}
        onClose={() => (deleting ? undefined : setDeleteTarget(null))}
        aria-labelledby="besuch-loeschen-titel"
      >
        <DialogTitle id="besuch-loeschen-titel">Besuch löschen?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget
              ? `${VISIT_TYPE_LABELS[deleteTarget.visitType]} vom ${formatDate(
                  selectedDate
                )} um ${formatTime(
                  deleteTarget.visitAt
                )} Uhr wird endgültig gelöscht. Verkauf und Umsatz des Tages werden danach neu berechnet.`
              : ''}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Abbrechen
          </Button>
          <Button color="error" onClick={confirmDelete} disabled={deleting}>
            {deleting ? 'Wird gelöscht…' : 'Löschen'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={feedback !== null}
        autoHideDuration={5000}
        onClose={() => setFeedback(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setFeedback(null)}
          severity={feedback?.severity ?? 'success'}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {feedback?.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
