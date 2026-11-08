import React from 'react'
import { Chip, type ChipProps } from '@mui/material'
import {
  PREORDER_STATUS_COLORS,
  PREORDER_STATUS_LABELS,
  PREORDER_STATUS_VARIANTS,
  type Preorder,
} from '../../lib/preordersTypes'

/**
 * Status einer Vorbestellung als Chip. „Nicht abgeholt“ ist kein eigener
 * Status (B7: `bereit` + `notCollectedAt`) und wird hier sichtbar gemacht.
 * Farbe trägt nie allein: der Text steht immer da.
 */
export default function PreorderStatusChip({
  preorder,
  size = 'small',
}: {
  preorder: Pick<Preorder, 'status' | 'notCollected'>
  size?: ChipProps['size']
}) {
  if (preorder.status === 'bereit' && preorder.notCollected) {
    return (
      <Chip
        size={size}
        color="error"
        label="Nicht abgeholt"
        data-status="nicht_abgeholt"
      />
    )
  }
  const color = PREORDER_STATUS_COLORS[preorder.status] ?? 'default'
  return (
    <Chip
      size={size}
      color={color}
      variant={PREORDER_STATUS_VARIANTS[preorder.status] ?? 'filled'}
      label={PREORDER_STATUS_LABELS[preorder.status] ?? preorder.status}
      data-status={preorder.status}
    />
  )
}
