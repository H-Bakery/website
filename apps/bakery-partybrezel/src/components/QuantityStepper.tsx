'use client'
import React, { useId } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'

export interface QuantityStepperProps {
  label: string
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
}

export default function QuantityStepper({
  label,
  value,
  min = 0,
  max,
  onChange,
}: QuantityStepperProps) {
  const labelId = useId()
  return (
    <Box
      role="group"
      aria-labelledby={labelId}
      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
    >
      <Typography id={labelId} component="span" sx={{ flex: 1 }}>
        {label}
      </Typography>
      <IconButton
        aria-label={`${label} verringern`}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        color="primary"
        sx={{ border: 1, borderColor: 'divider' }}
      >
        <RemoveIcon />
      </IconButton>
      <Box
        component="output"
        aria-live="polite"
        aria-label={`${label}: ${value}`}
        sx={{
          minWidth: 32,
          textAlign: 'center',
          fontSize: '1.25rem',
          fontWeight: 700,
        }}
      >
        {value}
      </Box>
      <IconButton
        aria-label={`${label} erhöhen`}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        color="primary"
        sx={{ border: 1, borderColor: 'divider' }}
      >
        <AddIcon />
      </IconButton>
    </Box>
  )
}
