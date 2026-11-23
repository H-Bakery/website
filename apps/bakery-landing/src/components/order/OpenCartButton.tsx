'use client'

import { Button } from '@mui/material'
import { useOrder } from './OrderContext'

export function OpenCartButton() {
  const order = useOrder()
  return (
    <Button
      variant="outlined"
      aria-haspopup="dialog"
      disabled={!order?.ready}
      onClick={order?.openCart}
      sx={{ minHeight: 44 }}
    >
      Korb öffnen
    </Button>
  )
}
