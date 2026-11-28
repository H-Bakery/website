import React from 'react'
import { Chip, type ChipProps } from '@mui/material'
import {
  INVOICE_STATUS_LABELS,
  type InvoiceStatus,
} from '../../lib/invoicesApi'

const COLORS: Record<InvoiceStatus, ChipProps['color']> = {
  entwurf: 'default',
  ausgestellt: 'success',
  storniert: 'error',
}

/** Status einer Rechnung als Chip - der Text steht immer da, nie nur Farbe. */
export default function InvoiceStatusChip({
  status,
  size = 'small',
}: {
  status: InvoiceStatus
  size?: ChipProps['size']
}) {
  return (
    <Chip
      size={size}
      color={COLORS[status] ?? 'default'}
      variant={status === 'entwurf' ? 'outlined' : 'filled'}
      label={INVOICE_STATUS_LABELS[status] ?? status}
      data-status={status}
    />
  )
}
