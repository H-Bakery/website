'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import NextLink from 'next/link'
import {
  Box,
  Button,
  IconButton,
  Link,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  AddCircleOutline as NewVisitIcon,
  Assessment as ReportIcon,
  EventNote as TemplateIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { fetchPartners, fetchToday } from '../../../lib/partnerApi'
import {
  DayDetail,
  Partner,
  WEEKDAY_LABELS,
  formatCurrency,
  formatDate,
  formatPercent,
  plural,
  toBusinessDate,
  weekdayOf,
} from '../../../lib/partnerTypes'
import {
  EmptyState,
  ErrorState,
  KeyFigures,
  LoadingState,
  PageLayout,
  PageSection,
} from '../../../components/layout'
import {
  DayStateChip,
  ProvisionalBadge,
  SETTLEMENT_LABELS,
  dayStateOf,
  deliveryDaysText,
  isProvisionalState,
  type DayState,
} from './partnerUi'
import { errorText } from './errorText'

interface PartnerCard {
  partner: Partner
  today: DayDetail | null
  todayError: string | null
}

/** Ein Satz zur Lage des Tages - „vorläufig“ steht immer dabei, wo es gilt. */
function stateSentence(
  state: DayState,
  visitCount: number,
  uncountedQty: number,
  weekdayLabel: string
): string {
  const visits = `${plural(visitCount, 'Besuch', 'Besuche')} erfasst`
  switch (state) {
    case 'no-delivery':
      return `${weekdayLabel} ist kein Liefertag für diesen Partner.`
    case 'no-visit':
      return 'Liefertag - es ist noch kein Besuch erfasst.'
    case 'open':
      return `${visits} - die Abholung fehlt noch, die Zahlen sind vorläufig.`
    case 'incomplete':
      return `${visits}, aber ${uncountedQty} Stück bei der Abholung nicht gezählt - die Zahlen sind vorläufig.`
    default:
      return `${visits}, Abholung gebucht - der Tag ist abgeschlossen.`
  }
}

function PartnerToday({
  card,
  todayWeekday,
  onRetry,
  loading,
}: {
  card: PartnerCard
  todayWeekday: number | null
  onRetry: () => void
  loading: boolean
}) {
  const { partner, today, todayError } = card
  const visitCount = today?.timeline?.length ?? 0
  const isDeliveryDay =
    todayWeekday != null &&
    Array.isArray(partner.deliveryDays) &&
    partner.deliveryDays.includes(todayWeekday)
  const state = dayStateOf({
    visitCount,
    isOpen: today ? today.isOpen !== false : true,
    // Abholung gebucht, aber nicht jedes Produkt mit Bestand gezählt
    isComplete: today ? today.isComplete !== false : true,
    isDeliveryDay,
  })
  const provisional = isProvisionalState(state)
  const totals = today?.totals
  const base = `/admin/partners/${partner.id}`

  return (
    <PageSection
      data-testid={`partner-card-${partner.id}`}
      title={
        <Link
          component={NextLink}
          href={base}
          underline="hover"
          color="inherit"
          // Einziger Weg zur Detailseite neben den Knöpfen: Touch-Ziel 44 px.
          sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
        >
          {partner.name}
        </Link>
      }
      description={[
        partner.city || 'Ort noch nicht hinterlegt',
        SETTLEMENT_LABELS[partner.settlementModel] ?? 'Kommission',
        `Liefertage ${deliveryDaysText(partner.deliveryDays)}`,
      ].join(' · ')}
      actions={
        <Tooltip title="Aktualisieren">
          <span>
            <IconButton
              aria-label="Verkaufspartner aktualisieren"
              onClick={onRetry}
              disabled={loading}
              sx={{ minWidth: 44, minHeight: 44, mr: -1, mt: -1 }}
            >
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {todayError ? (
          <ErrorState message={todayError} onRetry={onRetry} />
        ) : (
          <>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Typography variant="subtitle2" component="span">
                Heute
              </Typography>
              <DayStateChip state={state} />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ flexBasis: { xs: '100%', sm: 'auto' } }}
              >
                {stateSentence(
                  state,
                  visitCount,
                  today?.uncountedQty ?? 0,
                  todayWeekday ? WEEKDAY_LABELS[todayWeekday] : 'Heute'
                )}
              </Typography>
            </Box>

            {visitCount > 0 && totals && (
              <KeyFigures
                aria-label={`Kennzahlen heute, ${partner.name}`}
                items={[
                  {
                    label: 'Geliefert',
                    value: `${totals.deliveredQty} Stk.`,
                  },
                  {
                    label: 'Verkauft',
                    value: `${totals.soldQty} Stk.`,
                    badge: provisional ? <ProvisionalBadge /> : undefined,
                  },
                  {
                    label: 'Umsatz',
                    value: formatCurrency(totals.revenue),
                    badge: provisional ? <ProvisionalBadge /> : undefined,
                  },
                  {
                    label: 'Abverkaufsquote',
                    value: formatPercent(totals.sellThroughRate),
                    badge: provisional ? <ProvisionalBadge /> : undefined,
                  },
                ]}
              />
            )}
          </>
        )}

        <Box
          sx={{
            display: 'grid',
            gap: 1,
            gridTemplateColumns: {
              xs: '1fr 1fr',
              sm: 'auto auto auto',
            },
            justifyContent: { sm: 'start' },
            '@media print': { display: 'none' },
          }}
        >
          <Button
            component={NextLink}
            href={`${base}/visit/new`}
            variant="contained"
            startIcon={<NewVisitIcon />}
            sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
          >
            Besuch erfassen
          </Button>
          <Button
            component={NextLink}
            href={`${base}/templates`}
            variant="outlined"
            startIcon={<TemplateIcon />}
          >
            Standard-Bestückung
          </Button>
          <Button
            component={NextLink}
            href={`${base}/report`}
            variant="outlined"
            startIcon={<ReportIcon />}
          >
            Report
          </Button>
        </Box>
      </Box>
    </PageSection>
  )
}

export default function PartnerOverviewClient() {
  const [cards, setCards] = useState<PartnerCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Leer bis nach dem Mount: das Datum im SSR-HTML wiche über Mitternacht
  // vom Browser ab (Hydration).
  const [businessDate, setBusinessDate] = useState('')
  /** Nur die jüngste Anfrage darf den Zustand setzen (Doppeltipp auf „Aktualisieren“). */
  const requestRef = useRef(0)

  const todayWeekday = businessDate ? weekdayOf(businessDate) : null

  const load = useCallback(async () => {
    const request = ++requestRef.current
    setLoading(true)
    setError(null)
    setBusinessDate(toBusinessDate())
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
              todayError: errorText(
                err,
                'Tagesdaten konnten nicht geladen werden'
              ),
            }
          }
        })
      )
      if (request !== requestRef.current) return
      setCards(loaded)
    } catch (err) {
      if (request !== requestRef.current) return
      setCards([])
      setError(errorText(err, 'Verkaufspartner konnten nicht geladen werden'))
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <PageLayout
      title="Verkaufspartner"
      subtitle={
        businessDate
          ? `Backschrank heute - ${
              todayWeekday ? `${WEEKDAY_LABELS[todayWeekday]}, ` : ''
            }${formatDate(businessDate)}`
          : 'Backschrank-Bestückung und Abverkauf je Partner'
      }
    >
      {error && <ErrorState message={error} onRetry={load} />}

      {loading && cards.length === 0 ? (
        <LoadingState label="Verkaufspartner werden geladen …" />
      ) : cards.length === 0 ? (
        !error && <EmptyState title="Noch kein Verkaufspartner angelegt." />
      ) : (
        cards.map((card) => (
          <PartnerToday
            key={card.partner.id}
            card={card}
            todayWeekday={todayWeekday}
            onRetry={load}
            loading={loading}
          />
        ))
      )}
    </PageLayout>
  )
}
