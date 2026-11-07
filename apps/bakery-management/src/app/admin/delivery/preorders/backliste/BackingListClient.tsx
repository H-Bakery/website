'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  GlobalStyles,
  IconButton,
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
import { Print as PrintIcon, Refresh as RefreshIcon } from '@mui/icons-material'
import {
  fetchPickupPoints,
  fetchPreorderSums,
  preorderErrorMessage,
} from '../../../../../lib/preordersApi'
import { itemName, type PreorderSums } from '../../../../../lib/preordersTypes'
import {
  MOERSBACH_POINT_ID,
  preferredPickupPoint,
} from '../../../../../lib/abholliste'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../../../components/layout'
import {
  DELIVERY_WEEKDAY_LABELS,
  PickupPoint,
  deliveryWeekdayOf,
  formatCurrency,
  formatDate,
  isBusinessDate,
  moersbachListHref,
  nextDeliveryDate,
} from '../preorderTypes'

/** Samstag - der Liefertag, solange keine Sammelstelle geladen ist. */
const DEFAULT_WEEKDAY = 6

/* ------------------------------------------------------------------ *
 * Druck-Stylesheet
 * ------------------------------------------------------------------ */

/**
 * Dasselbe Muster wie im Partnerbericht (`partners/[id]/report/ReportClient`).
 * Zwei Dinge müssen hier stehen und nicht im `sx` des Blattes:
 *
 * - `TableCell` setzt seine Textfarbe selbst (`palette.text.primary`, im
 *   dunklen Admin-Bereich also weiß). Eine eigene Regel schlägt Vererbung -
 *   ohne `.backing-list-root *` druckte die Backliste weiß auf weiß, und in
 *   der Backstube hinge ein leeres Blatt.
 * - AppBar, Navigation und Breadcrumb kommen aus `admin/layout.tsx` und
 *   würden sonst mitgedruckt und das Blatt nach rechts schieben.
 */
const printStyles = (
  <GlobalStyles
    styles={{
      '@page': { margin: '14mm' },
      '@media print': {
        'html, body': {
          background: '#fff !important',
          color: '#000 !important',
        },
        '.MuiAppBar-root, nav, .MuiDrawer-root, [aria-label="Pfad"]': {
          display: 'none !important',
        },
        main: {
          padding: '0 !important',
          width: '100% !important',
        },
        'main > .MuiToolbar-root': { display: 'none !important' },
        '.backing-list-root, .backing-list-root *': {
          color: '#000 !important',
          backgroundColor: 'transparent !important',
          // Paper im Dunkelmodus: Elevation-Verlauf als backgroundImage.
          backgroundImage: 'none !important',
          boxShadow: 'none !important',
        },
        '.backing-list-root .MuiTableCell-root': {
          borderBottom: '1px solid #bbb',
        },
        '.backing-list-root tr': { pageBreakInside: 'avoid' },
        '.backing-list-root thead': { display: 'table-header-group' },
      },
    }}
  />
)

/**
 * Stückzahl über alle Zeilen - nur, wenn alle in Stück gezählt sind. Bei
 * gemischten Einheiten (Stück und Blech/kg) wäre die Summe sinnlos
 * („14 Stück“ aus 12 Stück + 2 Blech); dann `null`.
 */
export function pieceTotal(
  sums: ReadonlyArray<{ quantity: number; unit: string }>
): number | null {
  if (sums.some((entry) => entry.unit !== 'Stück')) return null
  return sums.reduce((sum, entry) => sum + entry.quantity, 0)
}

export interface BackingListClientProps {
  initialDate?: string
  initialPickupPointId?: string
}

/**
 * Die Backliste: Menge je Produkt über alle Vorbestellungen eines Liefertags.
 *
 * Das ist das Blatt, das samstags früh in der Backstube hängt - deshalb große
 * Zahlen und ein Druckbild ohne Bedienelemente. Gezählt wird auf dem Server
 * (`GET /api/preorders/sums?date=&pickupPointId=`, je Produkt und Sorte, mit
 * Kopfzahlen), hier wird nur angezeigt. Bewusst nicht `/day` (W4): die
 * Backliste braucht keine Namen und Telefonnummern, also lädt sie keine.
 */
export default function BackingListClient({
  initialDate,
  initialPickupPointId,
}: BackingListClientProps) {
  const [points, setPoints] = useState<PickupPoint[]>([])
  const [pointId, setPointId] = useState(initialPickupPointId ?? '')
  // Leer starten - der Vorgabetag kommt aus der Uhr (Hydration).
  const [date, setDate] = useState(initialDate ?? '')
  const [day, setDay] = useState<PreorderSums | null>(null)
  const [pointsLoaded, setPointsLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const point = useMemo(
    () => points.find((p) => p.id === pointId) ?? null,
    [points, pointId]
  )

  useEffect(() => {
    let active = true
    fetchPickupPoints()
      .then((list) => {
        if (!active) return
        setPoints(list)
        const first =
          list.find((p) => p.id === initialPickupPointId) ??
          // Ohne Kennung Mörsbach wie die Liste (UI-Runde 1).
          preferredPickupPoint(list, { preferId: MOERSBACH_POINT_ID }) ??
          list[0] ??
          null
        if (first && !initialPickupPointId) setPointId(first.id)
        setDate((current) =>
          isBusinessDate(current)
            ? current
            : nextDeliveryDate(first ? first.weekday : DEFAULT_WEEKDAY)
        )
      })
      .catch((err) => {
        if (!active) return
        setError(
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
        if (active) setPointsLoaded(true)
      })
    return () => {
      active = false
    }
  }, [initialPickupPointId])

  const load = useCallback(async () => {
    // Ohne Sammelstelle wäre es der ganze Tag (Laden inklusive).
    if (!isBusinessDate(date) || !pointId) return
    setLoading(true)
    setError(null)
    try {
      setDay(await fetchPreorderSums(date, pointId))
    } catch (err) {
      setDay(null)
      setError(
        preorderErrorMessage(err, 'Die Backliste konnte nicht geladen werden')
      )
    } finally {
      setLoading(false)
    }
  }, [date, pointId])

  // Erst laden, wenn die Sammelstellen da sind - sonst liefe der erste Aufruf
  // ohne `pickupPointId` und der zweite gleich hinterher.
  useEffect(() => {
    if (pointsLoaded) load()
  }, [load, pointsLoaded])

  const weekday = isBusinessDate(date) ? deliveryWeekdayOf(date) : null
  const sums = day?.items ?? []
  const summary = day?.summary ?? null
  const count = summary ? summary.count : day?.preorderCount ?? 0
  const pieces = pieceTotal(sums)
  const listHref = moersbachListHref(date, false, pointId)
  // „Nichts vorbestellt“ nur sagen, wenn der Server das für genau diesen Tag
  // und diese Sammelstelle geantwortet hat. Solange die Sammelstellen oder
  // die Summen noch unterwegs sind, steht „wird geladen“ da - sonst hieße
  // ein langsames WLAN am Samstag „nichts zu backen“ (UI-Runde 2).
  const showLoading =
    loading ||
    (!error &&
      !day &&
      (!pointsLoaded || (Boolean(pointId) && isBusinessDate(date))))

  return (
    <Box className="backing-list-root">
      {printStyles}
      <PageLayout
        width="narrow"
        title="Backliste Vorbestellungen"
        back={{ href: listHref, label: 'Zurück zur Sammelstelle' }}
        subtitle={
          <>
            {isBusinessDate(date)
              ? `${
                  weekday != null ? `${DELIVERY_WEEKDAY_LABELS[weekday]}, ` : ''
                }${formatDate(date)}`
              : 'Kein gültiger Liefertag gewählt'}
            {/* Je Teil ohne Umbruch - sonst begann eine Zeile mit „· Übergabe“
                (UI-Runde 1). */}
            {point && (
              <>
                {'\u00a0· '}
                <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                  {point.name}
                  {point.window ? '\u00a0·' : ''}
                </Box>
              </>
            )}
            {point?.window && (
              <>
                {' '}
                <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                  Übergabe {point.window} Uhr
                </Box>
              </>
            )}
          </>
        }
        actions={
          <>
            <TextField
              label="Liefertag"
              type="date"
              size="small"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 160, flex: { xs: 1, sm: 'none' } }}
            />
            <Tooltip title="Aktualisieren">
              <span>
                <IconButton
                  aria-label="Backliste aktualisieren"
                  onClick={load}
                  disabled={loading || !isBusinessDate(date)}
                >
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={() => window.print()}
              disabled={!day || sums.length === 0}
            >
              Drucken
            </Button>
          </>
        }
      >
        {error && (
          <Box sx={{ displayPrint: 'none' }}>
            <ErrorState message={error} onRetry={load} />
          </Box>
        )}

        {/* Das Blatt. Im Druck bewusst schwarz auf weiß: der Admin-Bereich ist
            dunkel, und ein dunkles Blatt kostet nur Toner. Die Farben stehen in
            `printStyles` - im `sx` erreichten sie die Tabellenzellen nicht. */}
        {showLoading ? (
          <LoadingState label="Backliste wird geladen …" />
        ) : !day || sums.length === 0 ? (
          !error &&
          (day ? (
            <EmptyState title="Für diesen Tag ist nichts vorbestellt." />
          ) : !pointId ? (
            <EmptyState title="Es ist keine Sammelstelle angelegt." />
          ) : (
            <EmptyState title="Bitte einen gültigen Liefertag wählen." />
          ))
        ) : (
          <PageSection
            title={`Menge je Produkt (${sums.length})`}
            disablePadding
          >
            <TableContainer>
              <Table
                aria-label="Menge je Produkt"
                sx={{ '& tbody td': { py: { xs: 1, md: 1.25 } } }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell
                      align="right"
                      sx={{
                        width: { xs: 112, md: 140 },
                        fontSize: '1rem',
                        pl: { md: 3 },
                      }}
                    >
                      Menge
                    </TableCell>
                    <TableCell sx={{ fontSize: '1rem' }}>Produkt</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sums.map((entry) => (
                    <TableRow key={`${entry.productId}|${entry.variant}`}>
                      <TableCell
                        align="right"
                        sx={{ whiteSpace: 'nowrap', pl: { md: 3 } }}
                      >
                        <Typography
                          component="span"
                          sx={{
                            fontWeight: 700,
                            fontSize: '1.5rem',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {entry.quantity}
                        </Typography>
                        <Typography
                          variant="body2"
                          component="span"
                          color="text.secondary"
                          sx={{
                            ml: 0.5,
                            display: 'inline-block',
                            minWidth: 40,
                            textAlign: 'left',
                          }}
                        >
                          {entry.unit}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          component="span"
                          sx={{ fontSize: '1.15rem', fontWeight: 500 }}
                        >
                          {itemName(entry)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ px: { xs: 2, md: 3 }, py: 2 }}
              data-testid="backing-list-summary"
            >
              {count} Vorbestellung{count === 1 ? '' : 'en'}
              {pieces !== null ? ` · ${pieces} Stück` : ''}
              {summary
                ? ` · ${formatCurrency(summary.total)} Summe · ${formatCurrency(
                    summary.unpaidTotal
                  )} noch zu kassieren${
                    (summary.handedOverUnpaidTotal ?? 0) > 0
                      ? ` (+ ${formatCurrency(
                          summary.handedOverUnpaidTotal ?? 0
                        )} ohne Zahlung übergeben)`
                      : ''
                  }${
                    (summary.refundTotal ?? 0) > 0
                      ? ` · ${formatCurrency(
                          summary.refundTotal ?? 0
                        )} zu erstatten`
                      : ''
                  }`
                : ''}
              {summary && summary.byStatus.storniert > 0
                ? ` · ${summary.byStatus.storniert} storniert (nicht enthalten)`
                : ''}
            </Typography>
          </PageSection>
        )}
      </PageLayout>
    </Box>
  )
}
