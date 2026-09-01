'use client'

/**
 * @fileoverview Bestellbestätigung — /bestellung/[id]
 * @module @bakery/shop/feature-cart/order-confirmation
 *
 * Renders no Header/Footer: the app layout owns the shop chrome.
 */

import React from 'react'
import NextLink from 'next/link'
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
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'

import { fetchShopOrder, formatEuro } from '@bakery/shared/data-access'
import type { ShopOrder, ShopOrderItem } from '@bakery/shared/data-access'

import { formatGermanDate } from './pickup'

export interface OrderConfirmationProps {
  /** The id returned by `POST /api/orders`, taken from the route. */
  orderId: string
}

type LoadState = 'loading' | 'loaded' | 'unavailable'

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

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({
  orderId,
}) => {
  const [order, setOrder] = React.useState<ShopOrder | null>(null)
  const [state, setState] = React.useState<LoadState>('loading')

  React.useEffect(() => {
    if (!orderId) {
      setState('unavailable')
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
          // Orders live in memory on the API — a restart legitimately loses them.
          setState('unavailable')
        }
      })
      .catch(() => {
        if (!cancelled) setState('unavailable')
      })

    return () => {
      cancelled = true
    }
  }, [orderId])

  const items = orderItemsOf(order)
  const total = totalOf(order)
  const pickupDate = order?.pickupDate ? formatGermanDate(order.pickupDate) : ''

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
        </Paper>

        <Paper
          variant="outlined"
          sx={{ borderRadius: 2, mt: { xs: 2, md: 3 }, p: { xs: 2, md: 3 } }}
        >
          {state === 'loading' ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
                py: 3,
              }}
            >
              <CircularProgress size={22} />
              <Typography color="text.secondary">
                Bestelldetails werden geladen …
              </Typography>
            </Box>
          ) : state === 'unavailable' ? (
            <Alert severity="info">
              Die Einzelheiten können wir gerade nicht anzeigen. Ihre Bestellung
              ist trotzdem bei uns – nennen Sie uns im Laden einfach Ihren
              Bestellcode.
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
