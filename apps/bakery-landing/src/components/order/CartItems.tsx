'use client'

import Link from 'next/link'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import type { CartItem } from '../../lib/order/cart-store'
import {
  ORDER_CONFIG,
  isOrderable,
  type OrderProduct,
} from '../../lib/order/order-config'
import { formatPrice } from '../../utils/formatPrice'
import RenderedImage from '../products/RenderedImage'
import { QuantityControls } from './AddToCartButton'
import { useOrder } from './OrderContext'

export type CartLine = CartItem & { product?: OrderProduct }
const actionSx = { minHeight: 44, textTransform: 'none' }

export function CartItems({
  lines,
  canOrder,
  remove,
  onContinue,
  onClose,
}: {
  lines: CartLine[]
  canOrder: boolean
  remove: (id: string) => void
  onContinue: () => void
  onClose: () => void
}) {
  const order = useOrder()
  if (!order) return null
  const { notes, estimate } = order
  return (
    <Stack spacing={1.5}>
      {!lines.length && (
        <>
          <Typography>Ihr Korb ist leer.</Typography>
          <Button
            component={Link}
            href="/products"
            onClick={onClose}
            variant="contained"
            sx={actionSx}
          >
            Zum Sortiment
          </Button>
        </>
      )}
      {lines.map(({ id, quantity, product }) => {
        const orderable = isOrderable(product)
        const name = product?.name ?? 'Artikel'
        return (
          <Box
            key={id}
            sx={{ borderBottom: 1, borderColor: 'divider', pb: 1.5 }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center">
              {(product?.renderedImage || product?.image) && (
                <Box
                  sx={{
                    width: 54,
                    height: 54,
                    flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  {product.renderedImage ? (
                    <RenderedImage
                      image={product.renderedImage}
                      alt=""
                      sizes="54px"
                    />
                  ) : (
                    <Box
                      component="img"
                      src={product.image ?? undefined}
                      alt=""
                      loading="lazy"
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  )}
                </Box>
              )}
              <Box>
                <Typography fontWeight={700}>{name}</Typography>
                <Typography color="text.secondary" variant="body2">
                  {orderable
                    ? formatPrice(product.price)
                    : 'Nicht mehr im Angebot'}
                </Typography>
              </Box>
            </Stack>
            <Stack
              direction="row"
              justifyContent="space-between"
              flexWrap="wrap"
            >
              {orderable && (
                <QuantityControls
                  name={name}
                  quantity={quantity}
                  onChange={(change) =>
                    quantity + change === 0
                      ? remove(id)
                      : order.changeQuantity(id, change)
                  }
                />
              )}
              <Button
                aria-label={`${name} entfernen`}
                onClick={() => remove(id)}
                sx={actionSx}
              >
                Entfernen
              </Button>
            </Stack>
            {orderable && (
              <TextField
                fullWidth
                label={`Notiz für ${name} (optional)`}
                value={notes.get(id) ?? ''}
                onChange={(event) => order.setNote(id, event.target.value)}
              />
            )}
          </Box>
        )
      })}
      {lines.length > 0 && (
        <>
          {ORDER_CONFIG.showEstimate && (
            <Typography fontWeight={700}>
              {estimate === null
                ? 'Summe offen'
                : `Summe ca. ${formatPrice(estimate)}`}{' '}
              · bezahlt wird bei Abholung
            </Typography>
          )}
          {!canOrder && (
            <Typography>
              Bitte entfernen Sie Artikel, die nicht mehr im Angebot sind.
            </Typography>
          )}
          <Button
            variant="contained"
            disabled={!canOrder}
            onClick={onContinue}
            sx={actionSx}
          >
            Abholung wählen
          </Button>
        </>
      )}
    </Stack>
  )
}
