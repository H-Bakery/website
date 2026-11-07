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
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Snackbar,
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
import AssessmentIcon from '@mui/icons-material/Assessment'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ListAltIcon from '@mui/icons-material/ListAlt'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import RefreshIcon from '@mui/icons-material/Refresh'
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
  TimelineEntry,
  VISIT_TYPE_COLORS,
  VISIT_TYPE_LABELS,
  formatCurrency,
  formatDate,
  formatPercent,
  plural,
  formatTime,
  shiftDate,
  toBusinessDate,
  weekdayOf,
} from '../../../../lib/partnerTypes'
import {
  EmptyState,
  ErrorState,
  KeyFigures,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../../components/layout'
import {
  DayStateChip,
  ProvisionalBadge,
  SETTLEMENT_DESCRIPTIONS,
  SETTLEMENT_LABELS,
  dayStateOf,
  deliveryDaysText,
  isProvisionalState,
} from '../partnerUi'
import { errorText } from '../errorText'

type DayView = DayDetail & { visits: PartnerVisit[] }
type Totals = PartnerStats['totals']

/** Menge - `null` heißt "nicht gezählt", nicht "null Stück". */
function formatQty(value: number | null | undefined): string {
  return value == null ? '–' : String(value)
}

/** Zahl mit Bezeichnung in einer Besuchszeile. */
/**
 * „Rest gezählt“ eines Besuchs. `countedQty` des Eintrags ist eine Summe, in
 * der „nicht gezählt“ (`null`) als 0 steckt - eine Erstbestückung ohne
 * Zählung stand so als „0“ da, als wäre der Schrank leer gewesen.
 */
function countedText(entry: TimelineEntry): string {
  const items = entry.items ?? []
  const uncounted = items.filter((item) => item.countedQty == null).length
  if (items.length > 0 && uncounted === items.length) return 'nicht gezählt'
  if (uncounted > 0) return `${entry.countedQty} · ${uncounted} nicht gezählt`
  return String(entry.countedQty)
}

function VisitFigure({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={500}
        sx={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
    </Box>
  )
}

/** Ein Besuch der Tagesliste - zugeklappt die Summen, aufgeklappt je Produkt. */
function VisitRow({
  entry,
  partnerId,
  onDelete,
}: {
  entry: TimelineEntry
  partnerId: string
  onDelete: (entry: TimelineEntry) => void
}) {
  const [open, setOpen] = useState(false)
  const time = formatTime(entry.visitAt)

  return (
    <Box
      component="li"
      sx={{
        listStyle: 'none',
        '&:not(:last-of-type)': { borderBottom: 1, borderColor: 'divider' },
      }}
    >
      <Box sx={{ px: { xs: 2, md: 3 }, py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                columnGap: 1,
                rowGap: 0.5,
              }}
            >
              <Typography
                variant="subtitle1"
                component="p"
                sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
              >
                {time}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={VISIT_TYPE_LABELS[entry.visitType]}
                color={VISIT_TYPE_COLORS[entry.visitType]}
              />
              <Typography variant="body2" color="text.secondary">
                {entry.staffName || 'Person nicht erfasst'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {entry.sequence}. Besuch
              </Typography>
            </Box>
            {entry.note && (
              <Typography
                variant="body2"
                sx={{ mt: 0.5, fontStyle: 'italic', overflowWrap: 'anywhere' }}
              >
                „{entry.note}“
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', flexShrink: 0, mr: -1, mt: -0.5 }}>
            <Tooltip title="Besuch korrigieren">
              <IconButton
                component={Link}
                href={`/admin/partners/${partnerId}/visit/new?visit=${entry.visitId}`}
                aria-label={`Besuch um ${time} korrigieren`}
                sx={{ minWidth: 44, minHeight: 44 }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Besuch löschen">
              <IconButton
                color="error"
                onClick={() => onDelete(entry)}
                aria-label={`Besuch um ${time} löschen`}
                sx={{ minWidth: 44, minHeight: 44 }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={open ? 'Produkte ausblenden' : 'Produkte anzeigen'}>
              <IconButton
                onClick={() => setOpen((prev) => !prev)}
                aria-expanded={open}
                aria-label={
                  open
                    ? `Produkte des Besuchs um ${time} ausblenden`
                    : `Produkte des Besuchs um ${time} anzeigen`
                }
                sx={{ minWidth: 44, minHeight: 44 }}
              >
                {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Box
          sx={{
            mt: 1,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(4, minmax(0, 1fr))',
            },
            gap: 1,
            maxWidth: 720,
          }}
        >
          <VisitFigure label="Rest gezählt" value={countedText(entry)} />
          <VisitFigure
            label="Neu geliefert"
            value={String(entry.deliveredQty)}
          />
          <VisitFigure
            label="Verkauft seit letztem Besuch"
            value={`${entry.soldSinceLastQty} · ${formatCurrency(
              entry.soldSinceLastRevenue
            )}`}
          />
          <VisitFigure
            label="Bestand danach"
            value={String(entry.stockAfterQty)}
          />
        </Box>
      </Box>

      <Collapse in={open} unmountOnExit>
        {entry.items.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ px: { xs: 2, md: 3 }, pb: 2 }}
          >
            Für diesen Besuch sind keine Produkte erfasst.
          </Typography>
        ) : (
          <TableContainer sx={{ overflowX: 'auto', bgcolor: 'action.hover' }}>
            <Table size="small" aria-label={`Produkte des Besuchs um ${time}`}>
              <TableHead>
                <TableRow>
                  <TableCell>Produkt</TableCell>
                  <TableCell align="right">Rest</TableCell>
                  <TableCell align="right">Neu</TableCell>
                  <TableCell align="right">Verkauft</TableCell>
                  <TableCell align="right">Bestand</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entry.items.map((item) => (
                  <TableRow key={item.productSlug || item.productId}>
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
    </Box>
  )
}

export default function PartnerDetailClient({
  partnerId,
  initialDate,
  justSaved = false,
}: {
  partnerId: string
  /** Geschäftstag aus `?date=` - sonst heute. */
  initialDate?: string
  /** `?saved=1`: die Erfassungsmaske hat gerade einen Besuch für diesen Tag gespeichert. */
  justSaved?: boolean
}) {
  const router = useRouter()
  // Leer starten: `toBusinessDate()` im Initialisierer landet im SSR-HTML und
  // weicht über Mitternacht vom Browser ab, was die Hydration zerlegt.
  // Der Geschäftstag wird nach dem Mount gesetzt.
  const [selectedDate, setSelectedDate] = useState('')
  const [partner, setPartner] = useState<Partner | null>(null)
  const [day, setDay] = useState<DayView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TimelineEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [feedback, setFeedback] = useState<{
    message: string
    severity: 'success' | 'error'
  } | null>(null)
  /**
   * Nur die jüngste Anfrage darf den Tag setzen. Wer schnell zwei Tage
   * zurückblättert, bekam sonst die Antwort des ersten Tages unter dem
   * Datum des zweiten angezeigt, wenn sie später ankam.
   */
  const requestRef = useRef(0)

  useEffect(() => {
    setSelectedDate((current) => current || initialDate || toBusinessDate())
  }, [initialDate])

  // Bestätigung nach dem Speichern. `saved` kommt gleich wieder aus der URL,
  // damit ein Reload oder ein Lesezeichen die Meldung nicht wiederholt.
  useEffect(() => {
    if (!justSaved) return
    const savedDate = initialDate || toBusinessDate()
    setFeedback({
      message: `Besuch für den ${formatDate(savedDate)} gespeichert.`,
      severity: 'success',
    })
    router.replace(`/admin/partners/${partnerId}?date=${savedDate}`, {
      scroll: false,
    })
  }, [justSaved, initialDate, partnerId, router])

  const load = useCallback(async () => {
    // Vor dem Mount steht noch kein Geschäftstag fest - dann nicht laden.
    if (!selectedDate) return
    const request = ++requestRef.current
    setLoading(true)
    setError(null)
    const [partnerResult, dayResult] = await Promise.allSettled([
      fetchPartner(partnerId),
      fetchToday(partnerId, selectedDate),
    ])
    if (request !== requestRef.current) return
    if (partnerResult.status === 'fulfilled') setPartner(partnerResult.value)
    const failed =
      partnerResult.status === 'rejected'
        ? partnerResult.reason
        : dayResult.status === 'rejected'
        ? dayResult.reason
        : null
    if (failed) {
      setDay(null)
      setError(
        errorText(failed, 'Die Partnerdaten konnten nicht geladen werden.')
      )
    } else if (dayResult.status === 'fulfilled') {
      setDay(dayResult.value)
    }
    setLoading(false)
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
  const hasVisits = timeline.length > 0

  const address = useMemo(() => {
    if (!partner) return ''
    const city = [partner.zip, partner.city].filter(Boolean).join(' ')
    return [partner.street, city].filter(Boolean).join(', ')
  }, [partner])

  const isDeliveryDay = useMemo(() => {
    const weekday = weekdayOf(selectedDate)
    if (weekday == null || !partner?.deliveryDays?.length) return true
    return partner.deliveryDays.includes(weekday)
  }, [partner, selectedDate])

  const state = dayStateOf({
    visitCount: timeline.length,
    isOpen,
    isComplete,
    isDeliveryDay,
  })
  const provisional = isProvisionalState(state)
  const showDay = Boolean(day) && !loading && !error

  const captureHref = `/admin/partners/${partnerId}/visit/new?date=${selectedDate}`

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      // B6: 200 { id, deleted, message } - die Meldung kommt von der API.
      const result = await deleteVisit(partnerId, deleteTarget.visitId)
      setDeleteTarget(null)
      setFeedback({ message: result.message, severity: 'success' })
      await load()
    } catch (err) {
      setFeedback({
        message: errorText(err, 'Der Besuch konnte nicht gelöscht werden.'),
        severity: 'error',
      })
    } finally {
      setDeleting(false)
    }
  }

  const subtitle = partner
    ? [
        address || 'Adresse noch nicht hinterlegt',
        SETTLEMENT_LABELS[partner.settlementModel] || partner.settlementModel,
        `Liefertage ${deliveryDaysText(partner.deliveryDays)}`,
      ].join(' · ')
    : undefined

  const returnHint = isOpen
    ? 'Retoure erst mit der Abholung'
    : !isComplete
    ? 'Retoure unvollständig gezählt'
    : `Retoure ${totals?.returnedQty ?? 0} Stück · ${formatCurrency(
        totals?.returnValue ?? 0
      )}`

  return (
    <PageLayout
      title={partner?.name || 'Verkaufspartner'}
      subtitle={
        partner ? (
          <Tooltip
            title={SETTLEMENT_DESCRIPTIONS[partner.settlementModel] ?? ''}
          >
            <span>{subtitle}</span>
          </Tooltip>
        ) : undefined
      }
      back={{ href: '/admin/partners', label: 'Alle Verkaufspartner' }}
      status={
        <>
          {partner && !partner.active && (
            <Chip
              size="small"
              variant="outlined"
              color="warning"
              label="Inaktiv"
            />
          )}
          {showDay && state === 'closed' && (
            <DayStateChip state={state} label="Tag abgeschlossen" />
          )}
        </>
      }
      actions={
        <>
          <Button
            component={Link}
            href={captureHref}
            variant="contained"
            startIcon={<AddIcon />}
          >
            Besuch erfassen
          </Button>
          <IconButton
            aria-label="Weitere Aktionen"
            aria-haspopup="menu"
            aria-expanded={Boolean(menuAnchor)}
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            <MoreVertIcon />
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem
              component={Link}
              href={`/admin/partners/${partnerId}/templates`}
              onClick={() => setMenuAnchor(null)}
            >
              <ListItemIcon>
                <ListAltIcon fontSize="small" />
              </ListItemIcon>
              Standard-Bestückung
            </MenuItem>
            <MenuItem
              component={Link}
              href={`/admin/partners/${partnerId}/report`}
              onClick={() => setMenuAnchor(null)}
            >
              <ListItemIcon>
                <AssessmentIcon fontSize="small" />
              </ListItemIcon>
              Report
            </MenuItem>
          </Menu>
        </>
      }
    >
      {/* Tag wählen */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          maxWidth: 420,
          '@media print': { display: 'none' },
        }}
      >
        <Tooltip title="Vorheriger Tag">
          <IconButton
            aria-label="Vorheriger Tag"
            onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
            disabled={!selectedDate}
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            <ChevronLeftIcon />
          </IconButton>
        </Tooltip>
        <TextField
          type="date"
          size="small"
          label="Geschäftstag"
          value={selectedDate}
          onChange={(e) => {
            // Ein halb getipptes Datum ist leer - dann nicht auf heute springen.
            if (e.target.value) setSelectedDate(e.target.value)
          }}
          InputLabelProps={{ shrink: true }}
          sx={{ flexGrow: 1 }}
        />
        <Tooltip title="Nächster Tag">
          <IconButton
            aria-label="Nächster Tag"
            onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
            disabled={!selectedDate}
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            <ChevronRightIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Aktualisieren">
          <span>
            <IconButton
              aria-label="Daten aktualisieren"
              onClick={load}
              disabled={loading}
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {error && <ErrorState message={error} onRetry={load} />}

      {loading && <LoadingState label="Partnerdaten werden geladen …" />}

      {showDay && (
        <>
          {/* Tagesstatus - offene Tage sind ausdrücklich vorläufig */}
          {state === 'open' ? (
            <Alert severity="warning">
              <AlertTitle>
                Tag noch offen – Verkauf und Umsatz sind vorläufig
              </AlertTitle>
              Für den {formatDate(selectedDate)} ist noch keine Abholung
              erfasst. Was noch im Schrank liegt, ist weder als verkauft noch
              als Retoure gebucht.
            </Alert>
          ) : state === 'incomplete' ? (
            <Alert severity="warning">
              <AlertTitle>
                Abholung unvollständig – {day?.uncountedQty ?? 0} Stück nicht
                gezählt
              </AlertTitle>
              Diese Stücke sind weder verkauft noch Retoure; Verkauf und Umsatz
              bleiben vorläufig:{' '}
              <strong>
                {uncountedProducts
                  .map((p) => `${p.productName}: ${p.stockQty} erwartet`)
                  .join(', ')}
              </strong>
            </Alert>
          ) : null}

          {/* Mehr gezählt als möglich: eine Fehlzählung oder eine nicht
              erfasste Lieferung - nie Retoure (W4-Verifikation Runde 2) */}
          {(totals?.discrepancyQty ?? 0) > 0 && (
            <Alert severity="warning" data-testid="day-discrepancy">
              <AlertTitle>
                Abweichung: {totals?.discrepancyQty} Stück mehr gezählt, als im
                Schrank sein konnten
              </AlertTitle>
              Weder verkauft noch Retoure - meist fehlt eine Lieferung, oder es
              wurde verzählt. Bitte die Besuche prüfen:{' '}
              <strong>
                {(day?.byProduct ?? [])
                  .filter((p) => p.discrepancyQty > 0)
                  .map((p) => `${p.productName}: ${p.discrepancyQty}`)
                  .join(', ')}
              </strong>
            </Alert>
          )}

          {hasVisits && (
            <KeyFigures
              aria-label={`Kennzahlen am ${formatDate(selectedDate)}`}
              items={[
                {
                  label: 'Geliefert',
                  value: String(totals?.deliveredQty ?? 0),
                  hint: 'Stück eingeräumt',
                  'data-testid': 'kpi-geliefert',
                },
                {
                  label: 'Verkauft',
                  value: String(totals?.soldQty ?? 0),
                  hint: 'Stück',
                  badge: provisional ? <ProvisionalBadge /> : undefined,
                  'data-testid': 'kpi-verkauft',
                },
                {
                  label: 'Umsatz',
                  value: formatCurrency(totals?.revenue ?? 0),
                  hint: 'zu HQ-Preisen',
                  badge: provisional ? <ProvisionalBadge /> : undefined,
                  // Grün nur, wenn die Zahl endgültig ist - ein vorläufiger
                  // Umsatz von 0,00 € in Grün las sich wie „alles gut“.
                  tone: provisional ? 'default' : 'success',
                  'data-testid': 'kpi-umsatz',
                },
                {
                  label: 'Abverkaufsquote',
                  value: formatPercent(totals?.sellThroughRate),
                  hint: returnHint,
                  badge: provisional ? <ProvisionalBadge /> : undefined,
                  'data-testid': 'kpi-abverkaufsquote',
                },
              ]}
            />
          )}

          {/* Besuche des Tages */}
          <PageSection
            title={`Besuche am ${formatDate(selectedDate)}`}
            description={`${plural(
              totals?.visitCount ?? timeline.length,
              'Besuch',
              'Besuche'
            )} · ${plural(
              totals?.refillCount ?? 0,
              'Nachlieferung',
              'Nachlieferungen'
            )}${!isDeliveryDay ? ' · kein regulärer Liefertag' : ''}`}
            disablePadding
          >
            {hasVisits ? (
              <Box component="ul" sx={{ m: 0, p: 0 }}>
                {timeline.map((entry) => (
                  <VisitRow
                    key={entry.visitId}
                    entry={entry}
                    partnerId={partnerId}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </Box>
            ) : (
              <Box sx={{ px: { xs: 2, md: 3 }, pb: { xs: 2, md: 3 } }}>
                <EmptyState
                  title="Für diesen Tag ist noch kein Besuch erfasst."
                  description="Verkauf und Umsatz lassen sich erst nach der Erstbestückung berechnen."
                />
              </Box>
            )}
          </PageSection>
        </>
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
    </PageLayout>
  )
}
