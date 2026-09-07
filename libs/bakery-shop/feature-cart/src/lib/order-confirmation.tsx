'use client'

/**
 * @fileoverview Bestellbestätigung — /bestellung/[id]
 * @module @bakery/shop/feature-cart/order-confirmation
 *
 * Renders no Header/Footer: the app layout owns the shop chrome.
 */

import React from 'react'
import NextLink from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'

import { fetchShopOrder, formatEuro } from '@bakery/shared/data-access'
import type { ShopOrder, ShopOrderItem } from '@bakery/shared/data-access'
import { BRAND_FACTS } from '@bakery/shared/utils'

import { PRICE_UPDATED_PARAM, PRICE_UPDATED_VALUE } from './confirmation-link'
import { formatGermanDate } from './pickup'

export interface OrderConfirmationProps {
  /** The id returned by `POST /api/orders`, taken from the route. */
  orderId: string
}

/**
 * `unavailable` heißt: der Server hat nicht geantwortet — die Bestellung kann
 * sehr wohl existieren. `not-found` heißt: er hat geantwortet, und unter dem
 * Code gibt es nichts. Die beiden auseinanderzuhalten ist der ganze Punkt:
 * Vorher bekam ein beliebiger Code in der URL eine Erfolgsseite mit grünem
 * Haken und „Ihre Bestellung ist trotzdem bei uns" — eine Zusage, die niemand
 * gegeben hatte. Und `loading` zeigt beides noch nicht: bis der Server
 * geantwortet hat, ist auch der Haken eine Zusage ohne Grundlage.
 */
type LoadState = 'loading' | 'loaded' | 'unavailable' | 'not-found'

/** A labelled fact in the details panel. */
const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <Box
    sx={{
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 1,
    }}
  >
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 700, textAlign: 'right' }}>
      {children}
    </Typography>
  </Box>
)

/**
 * Die Kasse hängt `?preis=aktualisiert` an, wenn der Server einen anderen
 * Betrag gebucht hat als den, der an der Kasse stand — etwa weil sich ein
 * hq-Preis geändert hat, während der Warenkorb im `localStorage` lag. Liest
 * die URL in einer eigenen Suspense-Grenze, damit das Prerendering der Route
 * nicht daran hängt.
 */
const PriceUpdatedNotice: React.FC = () => {
  const searchParams = useSearchParams()
  if (searchParams.get(PRICE_UPDATED_PARAM) !== PRICE_UPDATED_VALUE) return null
  return (
    <Alert data-testid="order-price-updated" severity="info" sx={{ mb: 2 }}>
      Ein Preis hat sich geändert, seit Sie den Warenkorb gefüllt haben. Hier
      steht der gebuchte Betrag – bezahlt wird erst bei der Abholung.
    </Alert>
  )
}

function orderItemsOf(order: ShopOrder | null): ShopOrderItem[] {
  return order && Array.isArray(order.items) ? order.items : []
}

function totalOf(order: ShopOrder | null): number {
  if (
    order &&
    typeof order.total === 'number' &&
    Number.isFinite(order.total)
  ) {
    return order.total
  }
  return orderItemsOf(order).reduce(
    (sum, item) =>
      sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0
  )
}

/** Der Bestellcode als Kasten — auf der Erfolgsseite wie im Ladezustand. */
const OrderCodeBox: React.FC<{ orderId: string }> = ({ orderId }) => (
  <Box
    sx={{
      display: 'inline-block',
      mt: 3,
      px: 3,
      py: 1.5,
      borderRadius: 2,
      bgcolor: 'grey.100',
      border: '1px solid',
      borderColor: 'divider',
    }}
  >
    <Typography variant="overline" color="text.secondary">
      Bestellcode
    </Typography>
    <Typography
      data-testid="order-number"
      variant="h3"
      component="p"
      sx={{
        // Der Code ist kurz und gruppiert - er darf nie mitten in einer
        // Gruppe umbrechen, sonst liest ihn niemand richtig vor.
        whiteSpace: 'nowrap',
        letterSpacing: '0.08em',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {orderId || 'unbekannt'}
    </Typography>
  </Box>
)

/**
 * Solange die Antwort aussteht, wissen wir nichts über die Bestellung — also
 * auch kein Haken und kein „Danke". Das ist nicht nur ein kurzer Moment: die
 * Route ist eine Clientkomponente mit dynamischem Parameter, dieser Zustand
 * ist deshalb genau das Server-HTML. Ein vertippter Link (oder ein Crawler
 * ohne JS) bekam vorher zuerst eine Zusage, die niemand gegeben hatte.
 */
const OrderLoading: React.FC<{ orderId: string }> = ({ orderId }) => (
  <Box
    data-testid="order-loading"
    aria-busy="true"
    sx={{ py: { xs: 3, md: 6 }, bgcolor: 'background.default' }}
  >
    <Container maxWidth="md">
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 2,
          p: { xs: 2.5, md: 4 },
          textAlign: 'center',
        }}
      >
        <CircularProgress size={40} aria-hidden="true" />
        <Typography variant="h1" component="h1" sx={{ mt: 1.5 }}>
          Bestellung wird geladen …
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ mt: 1.5, maxWidth: 560, mx: 'auto' }}
        >
          Einen Moment, wir sehen nach, was unter diesem Bestellcode gebucht
          ist.
        </Typography>
        <OrderCodeBox orderId={orderId} />
      </Paper>
    </Container>
  </Box>
)

/**
 * Kein grüner Haken, kein „Danke": unter diesem Code gibt es keine Bestellung.
 * Wer gerade bestellt hat und hier landet, soll nicht raten müssen — deshalb
 * steht die Telefonnummer dabei, nicht nur „Weiter einkaufen".
 */
const OrderNotFound: React.FC<{ orderId: string }> = ({ orderId }) => (
  <Box
    data-testid="order-not-found"
    sx={{ py: { xs: 3, md: 6 }, bgcolor: 'background.default' }}
  >
    <Container maxWidth="md">
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 2,
          p: { xs: 2.5, md: 4 },
          textAlign: 'center',
        }}
      >
        <SearchOffIcon
          sx={{ fontSize: 64, color: 'text.secondary' }}
          aria-hidden="true"
        />
        <Typography variant="h1" component="h1" sx={{ mt: 1 }}>
          Bestellung nicht gefunden
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ mt: 1.5, maxWidth: 560, mx: 'auto' }}
        >
          {orderId ? (
            <React.Fragment>
              Unter dem Bestellcode{' '}
              <Box
                component="span"
                data-testid="order-number"
                sx={{
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {orderId}
              </Box>{' '}
              haben wir keine Bestellung. Vielleicht ist der Link unvollständig
              oder der Code vertippt.
            </React.Fragment>
          ) : (
            'Dieser Link enthält keinen Bestellcode.'
          )}
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ mt: 1.5, maxWidth: 560, mx: 'auto' }}
        >
          Sie haben gerade bestellt und landen trotzdem hier? Dann rufen Sie uns
          bitte kurz an, wir sehen nach:{' '}
          <Box
            component="a"
            href={BRAND_FACTS.phoneHref}
            sx={{ fontWeight: 700, color: 'primary.main' }}
          >
            {BRAND_FACTS.phone}
          </Box>
          .
        </Typography>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          justifyContent="center"
          sx={{ mt: 3 }}
        >
          <Button
            component={NextLink}
            href="/products"
            variant="contained"
            size="large"
            startIcon={<StorefrontOutlinedIcon />}
          >
            Weiter einkaufen
          </Button>
          <Button component={NextLink} href="/cart" variant="outlined">
            Zum Warenkorb
          </Button>
        </Stack>
      </Paper>
    </Container>
  </Box>
)

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({
  orderId,
}) => {
  const [order, setOrder] = React.useState<ShopOrder | null>(null)
  const [state, setState] = React.useState<LoadState>('loading')

  React.useEffect(() => {
    if (!orderId) {
      setState('not-found')
      return
    }

    let cancelled = false
    setState('loading')

    fetchShopOrder(orderId)
      .then((result) => {
        if (cancelled) return
        if (result) {
          setOrder(result)
          setState('loaded')
        } else {
          // Der Server kennt den Code nicht. Beim Mock-Server kann das auch
          // ein Neustart sein (die Bestellungen liegen dort im Speicher) —
          // trotzdem ist „nicht gefunden" die einzige ehrliche Antwort; die
          // Seite nennt dafür die Telefonnummer.
          setState('not-found')
        }
      })
      .catch(() => {
        // Netz oder Server weg: über die Bestellung selbst wissen wir nichts.
        if (!cancelled) setState('unavailable')
      })

    return () => {
      cancelled = true
    }
  }, [orderId])

  const items = orderItemsOf(order)
  const total = totalOf(order)
  const pickupDate = order?.pickupDate ? formatGermanDate(order.pickupDate) : ''

  if (state === 'not-found') {
    return <OrderNotFound orderId={orderId} />
  }
  if (state === 'loading') {
    return <OrderLoading orderId={orderId} />
  }

  return (
    <Box
      data-testid="order-confirmation"
      sx={{ py: { xs: 3, md: 6 }, bgcolor: 'background.default' }}
    >
      <Container maxWidth="md">
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            p: { xs: 2.5, md: 4 },
            textAlign: 'center',
          }}
        >
          <CheckCircleOutlineIcon
            sx={{ fontSize: 64, color: 'success.main' }}
            aria-hidden="true"
          />
          <Typography variant="h1" component="h1" sx={{ mt: 1 }}>
            Danke – wir legen alles für Sie zurück
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ mt: 1.5, maxWidth: 560, mx: 'auto' }}
          >
            Ihre Vorbestellung liegt in der Backstube. Wir melden uns nur, wenn
            etwas nicht passt — ansonsten steht alles zur gewählten Zeit für Sie
            bereit. Bitte notieren Sie sich Ihren Bestellcode.
          </Typography>

          <OrderCodeBox orderId={orderId} />
        </Paper>

        <Paper
          variant="outlined"
          sx={{ borderRadius: 2, mt: { xs: 2, md: 3 }, p: { xs: 2, md: 3 } }}
        >
          {state === 'unavailable' ? (
            <Alert severity="info" data-testid="order-unavailable">
              Die Einzelheiten können wir gerade nicht anzeigen – der Server
              antwortet nicht. Eine eben abgeschickte Bestellung ist davon nicht
              betroffen: nennen Sie uns im Laden einfach Ihren Bestellcode.
            </Alert>
          ) : (
            <React.Fragment>
              <Typography variant="h4" component="h2">
                Ihre Abholung
              </Typography>
              <Stack spacing={1} sx={{ mt: 1.5 }}>
                {pickupDate && (
                  <DetailRow label="Datum">{pickupDate}</DetailRow>
                )}
                {order?.pickupTime && (
                  <DetailRow label="Uhrzeit">{order.pickupTime} Uhr</DetailRow>
                )}
                {order?.customerName && (
                  <DetailRow label="Name">{order.customerName}</DetailRow>
                )}
                {order?.phone && (
                  <DetailRow label="Telefon">{order.phone}</DetailRow>
                )}
                {order?.notes && (
                  <DetailRow label="Anmerkungen">{order.notes}</DetailRow>
                )}
              </Stack>

              {items.length > 0 && (
                <React.Fragment>
                  <Divider sx={{ my: 2.5 }} />
                  <Typography variant="h4" component="h2">
                    Ihre Artikel
                  </Typography>
                  <Stack
                    component="ul"
                    spacing={1.25}
                    sx={{ m: 0, mt: 1.5, p: 0, listStyle: 'none' }}
                  >
                    {items.map((item, index) => (
                      <Box
                        key={`${item.productId}-${index}`}
                        component="li"
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 2,
                        }}
                      >
                        <Typography variant="body2">
                          <Box
                            component="span"
                            sx={{ fontWeight: 700, mr: 0.75 }}
                          >
                            {item.quantity}×
                          </Box>
                          {item.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            whiteSpace: 'nowrap',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatEuro(item.price * item.quantity)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>

                  <Divider sx={{ my: 2 }} />
                  <React.Suspense fallback={null}>
                    <PriceUpdatedNotice />
                  </React.Suspense>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: 2,
                    }}
                  >
                    <Typography variant="h4" component="p">
                      Gesamt
                    </Typography>
                    <Typography
                      variant="h4"
                      component="p"
                      sx={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatEuro(total)}
                    </Typography>
                  </Box>
                </React.Fragment>
              )}
            </React.Fragment>
          )}

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 3,
              pt: 2,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            Online wurde nichts abgebucht. Bezahlt wird bei der Abholung in der
            Bäckerei, Eckstraße 3 in Homburg. Montag ist Ruhetag.
          </Typography>
        </Paper>

        <Box sx={{ mt: { xs: 2.5, md: 3 }, textAlign: 'center' }}>
          <Button
            component={NextLink}
            href="/products"
            variant="contained"
            size="large"
            startIcon={<StorefrontOutlinedIcon />}
          >
            Weiter einkaufen
          </Button>
        </Box>
      </Container>
    </Box>
  )
}

export default OrderConfirmation
