'use client'

import React, { useCallback, useEffect, useState } from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  GlobalStyles,
  IconButton,
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
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  ExpandMore as ExpandMoreIcon,
  Print as PrintIcon,
} from '@mui/icons-material'
import ItemsSummary from '../../../../components/preorders/ItemsSummary'
import {
  ErrorState,
  KeyFigures,
  LoadingState,
  PageLayout,
  PageSection,
  type KeyFigure,
} from '../../../../components/layout'
import PaymentNote from '../../../../components/preorders/PaymentNote'
import PreorderStatusChip from '../../../../components/preorders/PreorderStatusChip'
import {
  fetchPreorderDay,
  preorderErrorMessage,
} from '../../../../lib/preordersApi'
import {
  CHANNEL_LABELS,
  formatCurrency,
  formatDateWithWeekday,
  formatItems,
  formatPickupPlace,
  isBusinessDate,
  isProductionDay,
  nextProductionDate,
  paymentState,
  shiftDate,
  toBusinessDate,
  variantLabel,
  type PreorderChannel,
  type PreorderDay,
} from '../../../../lib/preordersTypes'
import { TOUCH_LINK_STYLE } from '../../../../lib/muiTheme'

/**
 * Druckbild A4, schwarz auf weiß - der Admin-Bereich ist dunkel. Die Farben
 * stehen hier und nicht im `sx`: `TableCell` setzt seine Textfarbe selbst
 * (wie in der Mörsbach-Backliste). AppBar, Navigation, Pfad und Bedien-
 * elemente fallen weg.
 */
const printStyles = (
  <GlobalStyles
    styles={{
      '@page': { size: 'A4', margin: '12mm' },
      '@media print': {
        'html, body': {
          background: '#fff !important',
          color: '#000 !important',
        },
        '.MuiAppBar-root, nav, .MuiDrawer-root, [aria-label="Pfad"]': {
          display: 'none !important',
        },
        main: { padding: '0 !important', width: '100% !important' },
        'main > .MuiToolbar-root': { display: 'none !important' },
        '.preorder-day-root, .preorder-day-root *': {
          color: '#000 !important',
          backgroundColor: 'transparent !important',
          // Paper im Dunkelmodus: Elevation-Verlauf als backgroundImage.
          backgroundImage: 'none !important',
          boxShadow: 'none !important',
        },
        '.preorder-day-root .MuiPaper-root': {
          border: '1px solid #bbb !important',
        },
        '.preorder-day-root .MuiChip-root': {
          border: '1px solid #000 !important',
        },
        '.preorder-day-root .MuiTableCell-root': {
          borderBottom: '1px solid #bbb',
          padding: '4px 6px',
        },
        '.preorder-day-root tr': { pageBreakInside: 'avoid' },
        '.preorder-day-root thead': { display: 'table-header-group' },
        '.preorder-day-noprint': { display: 'none !important' },
        // Am Handy zugeklappt - gedruckt wird die Liste immer, mit allen
        // Artikeln statt der Kurzform.
        '.preorder-day-orders-wrap': { display: 'block !important' },
        '.preorder-day-root [aria-controls="preorder-day-orders"]': {
          display: 'none !important',
        },
        // Bestellungen auf A4 (W4-verify r4): feste Spalten, Artikel bekommt
        // den Rest - vorher 13 % Breite, 13 Seiten für 56 Bestellungen, und
        // ein langer Name schob den Status-Chip über den Rand.
        '.preorder-day-orders': { tableLayout: 'fixed', width: '100%' },
        '.preorder-day-orders .preorder-day-items-short': {
          display: 'none !important',
        },
        '.preorder-day-orders .preorder-day-items-full': {
          display: 'inline !important',
        },
        '.preorder-day-orders td, .preorder-day-orders th': {
          overflowWrap: 'anywhere',
          fontSize: '9pt',
        },
        // Code | Status | Kunde | Abholung | Artikel (Rest) | Summe - der
        // Status steht vorn (UI-Runde 1: rechts war er am Tablet quer
        // abgeschnitten).
        '.preorder-day-orders th:nth-of-type(1)': { width: '32mm' },
        '.preorder-day-orders th:nth-of-type(2)': { width: '24mm' },
        '.preorder-day-orders th:nth-of-type(3)': { width: '28mm' },
        '.preorder-day-orders th:nth-of-type(4)': { width: '22mm' },
        '.preorder-day-orders th:nth-of-type(6)': { width: '24mm' },
        // Codes sind am Bildschirm Links - auf Papier nicht unterstreichen.
        '.preorder-day-orders a': { textDecoration: 'none !important' },
        '.preorder-day-orders td:first-of-type': {
          fontSize: '8pt',
          overflowWrap: 'normal',
        },
        '.preorder-day-orders .MuiChip-root': {
          height: 'auto',
          maxWidth: '100%',
        },
        '.preorder-day-orders .MuiChip-label': {
          padding: '0 4px',
          whiteSpace: 'normal',
          // „Abgeh|olt“: Status nur an Wortgrenzen umbrechen.
          overflowWrap: 'normal',
        },
        // Telefon und Zahlungshinweis (Typography body2) nicht größer als
        // der Name daneben.
        '.preorder-day-orders td .MuiTypography-root': {
          fontSize: 'inherit',
        },
      },
    }}
  />
)

/**
 * Schmalere Zellen am Telefon; die Summen-Tabelle passt so auf 390 px. Am
 * Bildschirm stehen die Artikel kurz (erste drei), gedruckt alle.
 */
const COMPACT_TABLE = {
  '& td, & th': { px: { xs: 1, sm: 2 } },
  '& td:first-of-type, & th:first-of-type': { pl: { xs: 2, md: 3 } },
  '& td:last-of-type, & th:last-of-type': { pr: { xs: 2, md: 3 } },
  '& .preorder-day-items-full': { display: 'none' },
} as const

/** Vorheriger/nächster Produktionstag (Montag übersprungen). */
function stepDay(date: string, direction: 1 | -1): string {
  let day = shiftDate(date, direction)
  while (!isProductionDay(day)) day = shiftDate(day, direction)
  return day
}

/**
 * P3: Tagesübersicht - was an einem Abholtag vorbestellt ist, summiert je
 * Produkt und Sorte (für die Backstube), dazu die Bestellungen und ein
 * A4-Druck. Gerechnet wird auf dem Server (`GET /api/preorders/day`);
 * stornierte zählen nirgends mit.
 */
export default function PreorderDayClient({
  initialDate,
}: {
  initialDate?: string
}) {
  const router = useRouter()
  const theme = useTheme()
  const wide = useMediaQuery(theme.breakpoints.up('md'))
  // Leer starten: der Vorgabetag kommt aus der Uhr (Hydration).
  const [date, setDate] = useState(initialDate ?? '')
  const [day, setDay] = useState<PreorderDay | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDate((current) =>
      isBusinessDate(current)
        ? current
        : nextProductionDate(toBusinessDate(new Date()))
    )
  }, [])

  const load = useCallback(async () => {
    if (!isBusinessDate(date)) return
    setLoading(true)
    setError(null)
    try {
      setDay(await fetchPreorderDay(date))
    } catch (err) {
      setDay(null)
      setError(
        preorderErrorMessage(
          err,
          'Die Tagesübersicht konnte nicht geladen werden.'
        )
      )
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    load()
  }, [load])

  const changeDate = (next: string) => {
    setDate(next)
    if (isBusinessDate(next)) {
      router.replace(`/admin/preorders/tag?date=${next}`, { scroll: false })
    }
  }

  const summary = day?.summary
  const ladenCount = day
    ? day.preorders.filter((p) => !p.pickupPointId && p.status !== 'storniert')
        .length
    : 0
  const places: Array<{
    key: string
    name: string
    count: number
    detail: string | null
  }> = day
    ? [
        ...(ladenCount > 0 || !day.pickupPointId
          ? [{ key: 'laden', name: 'Laden', count: ladenCount, detail: null }]
          : []),
        ...day.pickupPoints.map((p) => ({
          key: `point-${p.id}`,
          name: p.name,
          count: p.preorderCount,
          detail:
            [
              p.window ? `Übergabe ${p.window} Uhr` : null,
              p.active === false ? 'inaktiv' : null,
            ]
              .filter(Boolean)
              .join(' · ') || null,
        })),
      ]
    : []
  const cancelledCount = day
    ? day.preorders.filter((p) => p.status === 'storniert').length
    : 0
  const channels = summary
    ? (Object.entries(summary.byChannel) as Array<[PreorderChannel, number]>)
        .filter(([, n]) => n > 0)
        .map(([c, n]) => `${CHANNEL_LABELS[c] ?? c} ${n}`)
        .join(' · ')
    : ''
  // Bestellungen am Handy erst auf Tipp (die Summen sind die Hauptsache,
  // die Liste war dort ~10.000 px lang). Gedruckt wird sie immer.
  const [ordersChoice, setOrdersChoice] = useState<boolean | null>(null)
  const ordersOpen = ordersChoice ?? wide

  const figures: KeyFigure[] = summary
    ? [
        {
          label: 'Bestellungen',
          value: String(summary.count),
          hint: `${summary.byStatus.offen} offen · ${summary.byStatus.bereit} bereit · ${summary.byStatus.abgeholt} abgeholt`,
        },
        { label: 'Summe', value: formatCurrency(summary.total) },
        {
          label: 'Noch zu kassieren',
          value: formatCurrency(summary.unpaidTotal),
          tone: summary.unpaidTotal > 0 ? 'warning' : 'default',
          hint:
            [
              (summary.topUpTotal ?? 0) > 0
                ? `davon ${formatCurrency(
                    summary.topUpTotal ?? 0
                  )} Rest aus schon bezahlten Bestellungen`
                : null,
              (summary.handedOverUnpaidTotal ?? 0) > 0
                ? `+ ${formatCurrency(
                    summary.handedOverUnpaidTotal ?? 0
                  )} ohne Zahlung übergeben`
                : null,
            ]
              .filter(Boolean)
              .join(' · ') || undefined,
        },
        ...((summary.refundTotal ?? 0) > 0
          ? [
              {
                label: 'Zu erstatten',
                value: formatCurrency(summary.refundTotal ?? 0),
                tone: 'warning' as const,
                hint: `${
                  summary.refundCount ?? 0
                } bezahlt und storniert oder billiger geworden`,
              },
            ]
          : []),
      ]
    : []

  const dateNav = (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      sx={{ flex: { xs: '1 1 100%', sm: 'none' } }}
    >
      <Tooltip title="Vorheriger Backtag">
        <span>
          <IconButton
            aria-label="Vorheriger Backtag"
            onClick={() => changeDate(stepDay(date, -1))}
            disabled={!isBusinessDate(date)}
          >
            <PrevIcon />
          </IconButton>
        </span>
      </Tooltip>
      <TextField
        label="Abholtag"
        type="date"
        size="small"
        value={date}
        onChange={(event) => changeDate(event.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: 160, flex: { xs: 1, sm: 'none' } }}
      />
      <Tooltip title="Nächster Backtag">
        <span>
          <IconButton
            aria-label="Nächster Backtag"
            onClick={() => changeDate(stepDay(date, 1))}
            disabled={!isBusinessDate(date)}
          >
            <NextIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  )

  return (
    <Box className="preorder-day-root">
      {printStyles}
      <PageLayout
        title={`Vorbestellungen ${
          isBusinessDate(date) ? formatDateWithWeekday(date) : ''
        }`.trim()}
        back={{ href: '/admin/preorders', label: 'Alle Vorbestellungen' }}
        actions={
          <>
            {dateNav}
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={() => window.print()}
              disabled={!day}
            >
              Drucken
            </Button>
          </>
        }
      >
        {isBusinessDate(date) && !isProductionDay(date) && (
          <Alert severity="info" className="preorder-day-noprint">
            Montag ist Ruhetag - an diesem Tag wird nicht gebacken.
          </Alert>
        )}

        {error && (
          <Box className="preorder-day-noprint">
            <ErrorState message={error} onRetry={load} />
          </Box>
        )}

        {loading && !day ? (
          <LoadingState label="Tagesübersicht wird geladen …" />
        ) : (
          day &&
          summary && (
            <>
              <KeyFigures items={figures} aria-label="Kennzahlen des Tages" />

              {places.length > 0 && (
                // W4-Verifikation Runde 5: Abholorte samt Laden - „Laden 18“
                // im Bestellweg ist nicht die Zahl an der Theke. Seit UI-Runde 1
                // ein eigener Abschnitt statt eines losen Textblocks.
                <PageSection
                  title="Abholorte"
                  data-testid="preorder-day-places"
                >
                  <Box
                    component="ul"
                    aria-label="Abholorte"
                    className="preorder-day-places"
                    sx={{ listStyle: 'none', m: 0, p: 0 }}
                  >
                    {places.map((place) => (
                      <Box
                        component="li"
                        key={place.key}
                        sx={{
                          display: 'flex',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          gap: 2,
                          py: 0.75,
                          '&:not(:last-of-type)': {
                            borderBottom: 1,
                            borderColor: 'divider',
                          },
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography component="span">{place.name}</Typography>
                          {place.detail && (
                            <Typography
                              component="span"
                              variant="body2"
                              color="text.secondary"
                            >
                              {' '}
                              · {place.detail}
                            </Typography>
                          )}
                        </Box>
                        <Typography
                          component="span"
                          sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
                        >
                          {place.count}{' '}
                          {place.count === 1 ? 'Bestellung' : 'Bestellungen'}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </PageSection>
              )}

              <PageSection
                title="Summen je Produkt"
                description="Stornierte zählen nicht mit."
                disablePadding={day.sums.length > 0}
              >
                {day.sums.length === 0 ? (
                  <Typography color="text.secondary">
                    Für diesen Tag ist nichts vorbestellt.
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table
                      size="small"
                      aria-label="Summen je Produkt und Sorte"
                      sx={COMPACT_TABLE}
                    >
                      <TableHead>
                        <TableRow>
                          <TableCell>Produkt</TableCell>
                          <TableCell>Sorte</TableCell>
                          <TableCell align="right">Menge</TableCell>
                          <TableCell align="right">Bestellungen</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {day.sums.map((sum) => (
                          <TableRow key={`${sum.productId}|${sum.variant}`}>
                            <TableCell>{sum.name}</TableCell>
                            <TableCell>
                              {variantLabel(sum.variant) || '–'}
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{
                                fontWeight: 700,
                                fontSize: '1.05rem',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {sum.quantity}
                              {sum.unit === 'Stück' ? '' : ` ${sum.unit}`}
                            </TableCell>
                            <TableCell align="right">{sum.preorders}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </PageSection>

              <PageSection
                // Wie die Kachel ohne Stornierte; die stehen grau in der
                // Tabelle und als „dazu … storniert“ (UI-Runde 1: 62 gegen 69).
                title={`Bestellungen (${
                  day.preorders.length - cancelledCount
                })`}
                description={
                  [
                    cancelledCount > 0
                      ? `dazu ${cancelledCount} storniert`
                      : null,
                    channels ? `Bestellweg: ${channels}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || undefined
                }
                disablePadding={day.preorders.length > 0 && ordersOpen}
                actions={
                  day.preorders.length > 0 ? (
                    <Button
                      onClick={() => setOrdersChoice(!ordersOpen)}
                      aria-expanded={ordersOpen}
                      aria-controls="preorder-day-orders"
                      endIcon={
                        <ExpandMoreIcon
                          sx={{
                            transition: 'transform 0.2s',
                            transform: ordersOpen ? 'rotate(180deg)' : 'none',
                          }}
                        />
                      }
                    >
                      {ordersOpen ? 'Ausblenden' : 'Anzeigen'}
                    </Button>
                  ) : undefined
                }
              >
                {day.preorders.length === 0 ? (
                  <Typography color="text.secondary">Keine.</Typography>
                ) : (
                  <Box
                    id="preorder-day-orders"
                    className="preorder-day-orders-wrap"
                    sx={{ display: ordersOpen ? 'block' : 'none' }}
                  >
                    <TableContainer>
                      <Table
                        size="small"
                        aria-label="Bestellungen des Tages"
                        className="preorder-day-orders"
                        sx={COMPACT_TABLE}
                      >
                        <TableHead>
                          <TableRow>
                            <TableCell>Code</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Kunde</TableCell>
                            <TableCell>Abholung</TableCell>
                            <TableCell>Artikel</TableCell>
                            <TableCell align="right">Summe</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {day.preorders.map((p) => (
                            <TableRow
                              key={p.id}
                              sx={{
                                verticalAlign: 'top',
                                ...(p.status === 'storniert' && {
                                  '& td': { color: 'text.secondary' },
                                  // Durchgestrichen wird die Bestellung, nicht
                                  // die Erstattung daneben: „37,00 € erstatten“
                                  // ist eine offene Aufgabe (W4-verify r4).
                                  '& td:not(.preorder-money), & .preorder-total':
                                    { textDecoration: 'line-through' },
                                }),
                              }}
                            >
                              <TableCell
                                sx={{
                                  fontFamily: 'monospace',
                                  fontSize: '0.8125rem',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <NextLink
                                  href={`/admin/preorders/${p.id}`}
                                  style={{
                                    color: 'inherit',
                                    ...TOUCH_LINK_STYLE,
                                  }}
                                >
                                  {p.code}
                                </NextLink>
                              </TableCell>
                              <TableCell>
                                <PreorderStatusChip preorder={p} />
                              </TableCell>
                              {/* Schmaler als vorher, damit die Tabelle quer am
                                  Laden-Tablet (1180 px) bis „Summe“ passt
                                  (UI-Runde 1); lange Namen brechen um. */}
                              <TableCell
                                sx={{ minWidth: 120, overflowWrap: 'anywhere' }}
                              >
                                {p.customerName}
                                {p.customerPhone && (
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {p.customerPhone}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>{formatPickupPlace(p)}</TableCell>
                              <TableCell sx={{ minWidth: 160 }}>
                                <span className="preorder-day-items-full">
                                  {formatItems(p.items)}
                                </span>
                                <span className="preorder-day-items-short">
                                  <ItemsSummary items={p.items} max={3} />
                                </span>
                              </TableCell>
                              <TableCell
                                align="right"
                                className="preorder-money"
                                sx={{ whiteSpace: 'nowrap' }}
                              >
                                <span className="preorder-total">
                                  {formatCurrency(p.total)}
                                </span>
                                {paymentState(p).kind === 'paid' ? (
                                  ' ✓'
                                ) : (
                                  <PaymentNote preorder={p} />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ px: { xs: 2, md: 3 }, py: 1.5, display: 'block' }}
                    >
                      ✓ = bezahlt, Betrag stimmt. Ein offener Rest oder eine
                      Erstattung steht mit Betrag in der Zeile. Stornierte
                      stehen grau in der Liste und zählen in keiner Summe -
                      außer schon Bezahltes unter „Zu erstatten“.
                    </Typography>
                  </Box>
                )}
              </PageSection>
            </>
          )
        )}
      </PageLayout>
    </Box>
  )
}
