'use client'
import React, { useCallback, useEffect, useState } from 'react'
import NextLink from 'next/link'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Link,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  AddCircleOutline as NewVisitIcon,
  Assessment as ReportIcon,
  EventNote as TemplateIcon,
  Handshake as PartnersIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { fetchPartners, fetchToday } from '../../../lib/partnerApi'
import {
  DayDetail,
  Partner,
  PartnerStats,
  SettlementModel,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  formatCurrency,
  formatDate,
  formatPercent,
  toBusinessDate,
  weekdayOf,
} from '../../../lib/partnerTypes'

const SETTLEMENT_LABELS: Record<SettlementModel, string> = {
  commission: 'Kommission',
  firm_sale: 'Festkauf',
}

/** Nullwerte, solange der Tag noch keine Besuche hat oder nicht geladen werden konnte. */
const EMPTY_TOTALS: PartnerStats['totals'] = {
  dayCount: 0,
  openDayCount: 0,
  visitCount: 0,
  refillCount: 0,
  deliveredQty: 0,
  soldQty: 0,
  returnedQty: 0,
  discrepancyQty: 0,
  revenue: 0,
  returnValue: 0,
  sellThroughRate: null,
  returnRate: null,
}

interface PartnerCard {
  partner: Partner
  today: DayDetail | null
  todayError: string | null
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        p: 1.5,
        height: '100%',
        borderRadius: 1,
        bgcolor: 'action.hover',
      }}
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

export default function PartnerOverviewClient() {
  const [cards, setCards] = useState<PartnerCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const businessDate = toBusinessDate()
  const todayWeekday = weekdayOf(businessDate)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const partners = await fetchPartners()
      const loaded = await Promise.all(
        partners.map(async (partner) => {
          try {
            const today = await fetchToday(partner.id)
            return { partner, today, todayError: null }
          } catch (err) {
            return {
              partner,
              today: null,
              todayError: messageOf(
                err,
                'Tagesdaten konnten nicht geladen werden'
              ),
            }
          }
        })
      )
      setCards(loaded)
    } catch (err) {
      setCards([])
      setError(messageOf(err, 'Verkaufspartner konnten nicht geladen werden'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Box>
      <Box sx={{ mb: { xs: 2, md: 4 } }}>
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
            <PartnersIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Verkaufspartner
          </Typography>
          <Tooltip title="Aktualisieren">
            <span>
              <IconButton
                aria-label="Verkaufspartner aktualisieren"
                onClick={load}
                disabled={loading}
              >
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        <Typography variant="subtitle1" color="text.secondary">
          Backschrank-Bestückung und Abverkauf je Partner -{' '}
          {formatDate(businessDate)}
          {todayWeekday ? ` (${WEEKDAY_LABELS[todayWeekday]})` : ''}
        </Typography>
      </Box>

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

      {loading ? (
        <Box
          sx={{ display: 'flex', justifyContent: 'center', p: 6 }}
          role="status"
          aria-label="Verkaufspartner werden geladen"
        >
          <CircularProgress />
        </Box>
      ) : cards.length === 0 ? (
        !error && (
          <Paper elevation={2} sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              Noch kein Verkaufspartner angelegt.
            </Typography>
          </Paper>
        )
      ) : (
        <Grid container spacing={{ xs: 2, md: 3 }}>
          {cards.map(({ partner, today, todayError }) => {
            const totals = today?.totals ?? EMPTY_TOTALS
            const visitCount = today?.timeline?.length ?? 0
            const isDeliveryDay =
              todayWeekday != null &&
              Array.isArray(partner.deliveryDays) &&
              partner.deliveryDays.includes(todayWeekday)
            const isOpen = today ? today.isOpen !== false : true
            // Abholung gebucht, aber nicht jedes Produkt mit Bestand gezählt
            const isComplete = today ? today.isComplete !== false : true
            const isProvisional = visitCount > 0 && (isOpen || !isComplete)

            return (
              <Grid item xs={12} lg={6} key={partner.id}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 1,
                      }}
                    >
                      <Box>
                        <Link
                          component={NextLink}
                          href={`/admin/partners/${partner.id}`}
                          underline="hover"
                          color="inherit"
                          variant="h6"
                          sx={{ display: 'inline-block' }}
                        >
                          {partner.name}
                        </Link>
                        <Typography variant="body2" color="text.secondary">
                          {partner.city
                            ? partner.city
                            : 'Ort noch nicht hinterlegt'}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        variant="outlined"
                        color="primary"
                        label={
                          SETTLEMENT_LABELS[partner.settlementModel] ??
                          'Kommission'
                        }
                      />
                    </Box>

                    <Stack
                      direction="row"
                      spacing={0.75}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                      sx={{ mt: 2 }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Liefertage:
                      </Typography>
                      {(partner.deliveryDays ?? []).length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          keine hinterlegt
                        </Typography>
                      ) : (
                        (partner.deliveryDays ?? []).map((day) => (
                          <Chip
                            key={day}
                            size="small"
                            label={WEEKDAY_SHORT[day] ?? day}
                            color={day === todayWeekday ? 'primary' : 'default'}
                            variant={
                              day === todayWeekday ? 'filled' : 'outlined'
                            }
                          />
                        ))
                      )}
                    </Stack>

                    <Divider sx={{ my: 2 }} />

                    <Box
                      sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 1,
                        mb: 1.5,
                      }}
                    >
                      <Typography variant="subtitle2">Heute</Typography>
                      {!isDeliveryDay && visitCount === 0 ? (
                        <Chip size="small" label="Kein Liefertag" />
                      ) : visitCount === 0 ? (
                        <Chip
                          size="small"
                          color="warning"
                          label="Noch kein Besuch"
                        />
                      ) : isOpen ? (
                        <Chip
                          size="small"
                          color="warning"
                          label="Abholung fehlt"
                        />
                      ) : !isComplete ? (
                        <Chip
                          size="small"
                          color="warning"
                          label="Abholung unvollständig"
                        />
                      ) : (
                        <Chip
                          size="small"
                          color="success"
                          label="Abgeschlossen"
                        />
                      )}
                    </Box>

                    {todayError ? (
                      <Alert
                        severity="error"
                        sx={{ mb: 2 }}
                        action={
                          <Button color="inherit" size="small" onClick={load}>
                            Erneut versuchen
                          </Button>
                        }
                      >
                        {todayError}
                      </Alert>
                    ) : (
                      <>
                        <Typography
                          variant="body2"
                          color={
                            isDeliveryDay && visitCount === 0
                              ? 'warning.main'
                              : 'text.secondary'
                          }
                          sx={{ mb: 1.5 }}
                        >
                          {!isDeliveryDay && visitCount === 0
                            ? `${
                                todayWeekday
                                  ? WEEKDAY_LABELS[todayWeekday]
                                  : 'Heute'
                              } ist kein Liefertag für diesen Partner.`
                            : visitCount === 0
                            ? 'Liefertag - es ist noch kein Besuch erfasst.'
                            : isOpen
                            ? `${visitCount} Besuch${
                                visitCount === 1 ? '' : 'e'
                              } erfasst - die Abholung fehlt noch, die Zahlen sind vorläufig.`
                            : !isComplete
                            ? `${visitCount} Besuch${
                                visitCount === 1 ? '' : 'e'
                              } erfasst, Abholung gebucht - aber ${
                                today?.uncountedQty ?? 0
                              } Stück wurden dabei nicht gezählt, die Zahlen sind vorläufig.`
                            : `${visitCount} Besuch${
                                visitCount === 1 ? '' : 'e'
                              } erfasst, Abholung gebucht - der Geschäftstag ist abgeschlossen.`}
                        </Typography>

                        <Grid container spacing={1.5}>
                          <Grid item xs={6} sm={4}>
                            <StatTile
                              label="Besuche"
                              value={String(visitCount)}
                            />
                          </Grid>
                          <Grid item xs={6} sm={4}>
                            <StatTile
                              label="Geliefert"
                              value={`${totals.deliveredQty} Stk.`}
                            />
                          </Grid>
                          <Grid item xs={6} sm={4}>
                            <StatTile
                              label={
                                isProvisional ? 'Verkauft (vorl.)' : 'Verkauft'
                              }
                              value={`${totals.soldQty} Stk.`}
                            />
                          </Grid>
                          <Grid item xs={6} sm={4}>
                            <StatTile
                              label={
                                isProvisional ? 'Umsatz (vorl.)' : 'Umsatz'
                              }
                              value={formatCurrency(totals.revenue)}
                            />
                          </Grid>
                          <Grid item xs={6} sm={4}>
                            <StatTile
                              label="Abverkaufsquote"
                              value={formatPercent(totals.sellThroughRate)}
                            />
                          </Grid>
                        </Grid>

                        {isProvisional && (
                          <Typography
                            variant="caption"
                            color="warning.main"
                            sx={{ display: 'block', mt: 1.5 }}
                          >
                            {isOpen
                              ? 'Vorläufige Zahlen: ohne erfasste Abholung gilt alles Gelieferte als verkauft.'
                              : 'Vorläufige Zahlen: bei der Abholung wurde nicht jedes Produkt gezählt.'}
                          </Typography>
                        )}
                      </>
                    )}
                  </CardContent>

                  <CardActions sx={{ px: 2, pb: 2, gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      component={NextLink}
                      href={`/admin/partners/${partner.id}/visit/new`}
                      variant="contained"
                      startIcon={<NewVisitIcon />}
                    >
                      Besuch erfassen
                    </Button>
                    <Button
                      component={NextLink}
                      href={`/admin/partners/${partner.id}/templates`}
                      variant="outlined"
                      startIcon={<TemplateIcon />}
                    >
                      Standard-Bestückung
                    </Button>
                    <Button
                      component={NextLink}
                      href={`/admin/partners/${partner.id}/report`}
                      variant="outlined"
                      startIcon={<ReportIcon />}
                    >
                      Report
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      )}
    </Box>
  )
}
