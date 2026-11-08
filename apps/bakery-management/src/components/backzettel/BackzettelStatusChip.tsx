'use client'

import React from 'react'
import { Chip } from '@mui/material'

/** Status eines Tages: „Freigegeben“ (grün) oder „Entwurf“ (umrandet). */
export function BackzettelStatusChip({
  status,
  size = 'small',
}: {
  status: 'draft' | 'confirmed'
  size?: 'small' | 'medium'
}) {
  return status === 'confirmed' ? (
    <Chip
      size={size}
      color="success"
      label="Freigegeben"
      data-status="confirmed"
    />
  ) : (
    <Chip size={size} variant="outlined" label="Entwurf" data-status="draft" />
  )
}

export default BackzettelStatusChip
