'use client'

/**
 * @fileoverview Warenkorb — /cart
 * @module @bakery/shop/feature-cart/cart-page
 *
 * Renders no Header/Footer: the app layout owns the shop chrome.
 */

import React from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'

import { useCart } from '@bakery/shared/contexts'
import type { CartItem } from '@bakery/shared/contexts'
import { formatEuro, unitPriceLabel } from '@bakery/shared/data-access'
import { ShopPrice } from '@bakery/shop/feature-catalog'

import { ProductThumb } from './product-thumb'
import { grossTotal } from './order-totals'
import { formatGermanDate } from './pickup'
import { leadTimeLimitFor, type LeadTimeLimit } from './checkout-validation'

/** Mirrors `CartProvider`'s `maxQuantityPerItem` default — never offer more than it accepts. */
const MAX_QUANTITY_PER_ITEM = 99

interface CartLineProps {
  item: CartItem
  onDecrease: () => void
  onIncrease: () => void
  onRemove: () => void
}

const CartLine: React.FC<CartLineProps> = ({
  item,
  onDecrease,
  onIncrease,
  onRemove,
}) => {
  // § 4 PAngV: Wer nach Gewicht anbietet, nennt den Grundpreis. Trägt der Name
  // kein Gewicht, gibt es keinen — dann steht hier nichts.
  const unitLabel = unitPriceLabel({ name: item.name, price: item.price })

  return (
    <Box
      data-testid="cart-item"
      component="li"
      sx={{
        listStyle: 'none',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 2,
        px: { xs: 2, sm: 2.5 },
        py: 2,
        '&:not(:last-of-type)': {
          borderBottom: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      <ProductThumb
        src={item.image ?? item.imageUrl}
        alt={item.name}
        size={72}
      />

      <Box sx={{ flex: '1 1 160px', minWidth: 0 }}>
        <Typography
          data-testid="cart-item-name"
          variant="subtitle1"
          component="h3"
          sx={{ lineHeight: 1.35 }}
        >
          {item.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {formatEuro(item.price)} pro {item.unit || 'Stück'}
        </Typography>
        {unitLabel ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block' }}
          >
            {unitLabel}
          </Typography>
        ) : null}
        {item.notes ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}
          >
            {item.notes}
          </Typography>
        ) : null}
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          width: { xs: '100%', sm: 'auto' },
          ml: { sm: 'auto' },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
            overflow: 'hidden',
          }}
        >
          <IconButton
            data-testid="cart-decrease"
            size="small"
            onClick={onDecrease}
            disabled={item.quantity <= 1}
            aria-label={`Menge von ${item.name} verringern`}
            sx={{ borderRadius: 0 }}
          >
            <RemoveIcon fontSize="small" />
          </IconButton>
          <Typography
            data-testid="cart-item-quantity"
            aria-live="polite"
            aria-label={`Menge: ${item.quantity}`}
            sx={{
              minWidth: 40,
              textAlign: 'center',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {item.quantity}
          </Typography>
          <IconButton
            data-testid="cart-increase"
            size="small"
            onClick={onIncrease}
            disabled={item.quantity >= MAX_QUANTITY_PER_ITEM}
            aria-label={`Menge von ${item.name} erhöhen`}
            sx={{ borderRadius: 0 }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box
          sx={{
            textAlign: 'right',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
          }}
        >
          <ShopPrice
            value={item.price * item.quantity}
            size="sm"
            tone="plain"
            component="span"
          />
          <Button
            data-testid="cart-remove"
            size="small"
            color="inherit"
            onClick={onRemove}
            startIcon={<DeleteOutlineIcon fontSize="small" />}
            aria-label={`${item.name} aus dem Warenkorb entfernen`}
            sx={{ mt: 0.25, color: 'text.secondary', minHeight: 0, px: 0.5 }}
          >
            Entfernen
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

export const CartPage: React.FC = () => {
  const {
    items,
    summary,
    isLoading,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart()
  const router = useRouter()

  const isEmpty = items.length === 0
  const total = grossTotal(summary)

  /** "Jetzt", im Effect gelesen — `new Date()` im Render bricht die Hydration. */
  const [now, setNow] = React.useState<Date | null>(null)
  React.useEffect(() => setNow(new Date()), [])

  /**
   * Die Vorbestellfrist gehört hierher und nicht erst an die Kasse: wer erst
   * beim Absenden erfährt, dass die Torte zwei Tage braucht, hat den halben
   * Bestellweg umsonst gemacht.
   */
  const leadTime: LeadTimeLimit | null = React.useMemo(
    () => (now ? leadTimeLimitFor(items, now) : null),
    [items, now]
  )

  const goToCheckout = React.useCallback(() => router.push('/kasse'), [router])

  return (
    <Box
      data-testid="cart-page"
      sx={{
        pt: { xs: 3, md: 5 },
        // Platz für die klebende Leiste am unteren Rand (nur schmal, nur voll).
        pb: isEmpty || isLoading ? { xs: 3, md: 5 } : { xs: 2, md: 5 },
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 2,
            mb: { xs: 2.5, md: 4 },
          }}
        >
          <Box>
            <Typography variant="h1" component="h1">
              Warenkorb
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Sie bestellen vor, wir legen alles zurück. Bezahlt wird bei der
              Abholung.
            </Typography>
          </Box>
          <Button
            component={NextLink}
            href="/products"
            variant="text"
            startIcon={<StorefrontOutlinedIcon />}
          >
            Weiter einkaufen
          </Button>
        </Box>

        {leadTime && !isEmpty && (
          <Alert
            data-testid="cart-lead-time"
            severity="info"
            sx={{ mb: { xs: 2, md: 3 } }}
          >
            {leadTime.reason} Frühester Abholtermin:{' '}
            {formatGermanDate(leadTime.earliestIso)}.
          </Alert>
        )}

        <Grid container spacing={{ xs: 2, md: 4 }} alignItems="flex-start">
          <Grid item xs={12} md={8}>
            <Paper variant="outlined" sx={{ borderRadius: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  px: { xs: 2, sm: 2.5 },
                  py: 1.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="h4" component="h2">
                  Ihre Auswahl
                </Typography>
                {!isEmpty && (
                  <Button
                    size="small"
                    color="inherit"
                    onClick={clearCart}
                    startIcon={<DeleteOutlineIcon fontSize="small" />}
                    sx={{ color: 'text.secondary' }}
                  >
                    Leeren
                  </Button>
                )}
              </Box>

              {isLoading ? (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 1.5,
                    py: 6,
                  }}
                >
                  <CircularProgress size={22} />
                  <Typography color="text.secondary">
                    Warenkorb wird geladen …
                  </Typography>
                </Box>
              ) : isEmpty ? (
                <Box
                  data-testid="cart-empty"
                  sx={{ px: 3, py: { xs: 5, md: 7 }, textAlign: 'center' }}
                >
                  <ShoppingBagOutlinedIcon
                    sx={{ fontSize: 56, color: 'primary.light', mb: 1.5 }}
                  />
                  <Typography variant="h4" component="p" gutterBottom>
                    Ihr Warenkorb ist leer
                  </Typography>
                  <Typography
                    color="text.secondary"
                    sx={{ maxWidth: 420, mx: 'auto', mb: 3 }}
                  >
                    Noch nichts drin. Holen Sie sich Brot, Brötchen oder ein
                    Stück Kuchen dazu.
                  </Typography>
                  <Button
                    component={NextLink}
                    href="/products"
                    variant="contained"
                    size="large"
                  >
                    Weiter einkaufen
                  </Button>
                </Box>
              ) : (
                <Box component="ul" sx={{ m: 0, p: 0 }}>
                  {items.map((item) => (
                    <CartLine
                      key={item.id}
                      item={item}
                      onDecrease={() =>
                        updateQuantity(item.id, item.quantity - 1)
                      }
                      onIncrease={() =>
                        updateQuantity(item.id, item.quantity + 1)
                      }
                      onRemove={() => removeFromCart(item.id)}
                    />
                  ))}
                </Box>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={4} sx={{ width: '100%' }}>
            <Paper
              variant="outlined"
              sx={{
                borderRadius: 2,
                p: { xs: 2, md: 2.5 },
                position: { md: 'sticky' },
                top: { md: 24 },
              }}
            >
              <Typography variant="h4" component="h2">
                Übersicht
              </Typography>

              <Stack spacing={1} sx={{ mt: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Artikel</Typography>
                  <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {summary.totalCount}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Zwischensumme</Typography>
                  <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatEuro(summary.subtotal)}
                  </Typography>
                </Box>
                {summary.discount > 0 && (
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between' }}
                  >
                    <Typography color="text.secondary">Rabatt</Typography>
                    <Typography
                      color="success.dark"
                      sx={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      −{formatEuro(summary.discount)}
                    </Typography>
                  </Box>
                )}
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
                <ShopPrice value={total} size="lg" testId="cart-total" />
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.5 }}
              >
                inkl. MwSt. · Zahlung bei Abholung
              </Typography>

              <Button
                data-testid="cart-checkout"
                variant="contained"
                size="large"
                fullWidth
                disabled={isEmpty || isLoading}
                onClick={goToCheckout}
                sx={{ mt: 2.5 }}
              >
                Zur Kasse
              </Button>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 2 }}
              >
                Abholung in der Bäckerei, Eckstraße 3 in Homburg. Montag ist
                Ruhetag.
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/*
          Auf dem Telefon steht die Übersicht unter einer womöglich langen
          Liste. Diese Leiste hält Summe und Weg zur Kasse in Reichweite.

          `sticky` statt `fixed`: sie klebt am unteren Rand, solange der
          Warenkorb im Bild ist, und legt sich am Seitenende von selbst hin —
          eine feste Leiste würde den Footer verdecken.

          Bewusst **ohne** `cart-total`/`cart-checkout`: die beiden testids
          gehören der Übersicht. Zweimal dieselbe id, und Playwright bricht mit
          strict mode violation ab.
        */}
        {!isEmpty && !isLoading && (
          <Box
            data-testid="cart-sticky-bar"
            sx={{
              display: { xs: 'flex', md: 'none' },
              position: 'sticky',
              bottom: 0,
              zIndex: 2,
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              mt: 2,
              px: 2,
              py: 1.5,
              pb: 'calc(12px + env(safe-area-inset-bottom))',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              boxShadow: 3,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block' }}
              >
                {summary.totalCount === 1
                  ? '1 Artikel'
                  : `${summary.totalCount} Artikel`}{' '}
                · inkl. MwSt.
              </Typography>
              <ShopPrice value={total} size="md" />
            </Box>
            <Button
              variant="contained"
              size="large"
              onClick={goToCheckout}
              sx={{ flexShrink: 0 }}
            >
              Zur Kasse
            </Button>
          </Box>
        )}
      </Container>
    </Box>
  )
}

export default CartPage
