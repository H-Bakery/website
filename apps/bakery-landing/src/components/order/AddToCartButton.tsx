'use client'

import { Box, Button, IconButton, Typography } from '@mui/material'
import { useLayoutEffect, useRef } from 'react'
import { isOrderable, ORDER_CONFIG } from '../../lib/order/order-config'
import { useOrder } from './OrderContext'

export function QuantityControls({
  name,
  quantity,
  onChange,
}: {
  name: string
  quantity: number
  onChange: (change: number) => void
}) {
  const full = quantity >= ORDER_CONFIG.maxQuantity
  return (
    <Box
      role="group"
      aria-label={`Menge für ${name}`}
      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
    >
      <IconButton
        aria-label={`Weniger ${name}`}
        onClick={() => onChange(-1)}
        color="primary"
        sx={{ width: 44, height: 44 }}
      >
        −
      </IconButton>
      <Typography
        component="span"
        sx={{ minWidth: '2ch', textAlign: 'center' }}
      >
        {quantity}
      </Typography>
      <IconButton
        aria-label={`Mehr ${name}`}
        onClick={() => {
          if (!full) onChange(1)
        }}
        color="primary"
        aria-disabled={full}
        title={
          full
            ? `Bis zu ${ORDER_CONFIG.maxQuantity} online. Für größere Mengen bitte anrufen.`
            : undefined
        }
        sx={{
          width: 44,
          height: 44,
          '&[aria-disabled="true"]': { color: 'text.secondary' },
        }}
      >
        +
      </IconButton>
    </Box>
  )
}

export function AddToCartButton({ id }: { id?: string }) {
  const order = useOrder()
  const wrapper = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef(false)
  const product = id ? order?.products.get(id) : undefined
  const quantity =
    order?.cart.items.find((item) => item.id === id)?.quantity ?? 0

  useLayoutEffect(() => {
    if (!restoreFocus.current) return
    restoreFocus.current = false
    wrapper.current
      ?.querySelector<HTMLButtonElement>(
        quantity ? 'button:last-child' : 'button'
      )
      ?.focus()
  }, [quantity])

  if (!order || !isOrderable(product)) return null

  const change = (amount: number) => {
    if (quantity + amount === 0 || quantity === 0) {
      restoreFocus.current = Boolean(
        wrapper.current?.contains(document.activeElement)
      )
    }
    order.changeQuantity(product.id, amount)
  }

  return (
    <Box ref={wrapper}>
      {quantity ? (
        <QuantityControls
          name={product.name}
          quantity={quantity}
          onChange={change}
        />
      ) : (
        <Button
          variant="outlined"
          disabled={!order.ready}
          onClick={() => change(1)}
          aria-label={`${product.name} in den Korb`}
          sx={{ minHeight: 44, textTransform: 'none' }}
        >
          In den Korb
        </Button>
      )}
    </Box>
  )
}
