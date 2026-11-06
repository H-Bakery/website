'use client'
import React from 'react'
import { Box, Button } from '@mui/material'
import { Backspace as BackspaceIcon } from '@mui/icons-material'

export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 6

interface PinPadProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
}

/**
 * Ziffernblock für die PIN an der Station: große Tasten zum Tippen, die
 * PIN selbst nur als Punkte. Eine angeschlossene Tastatur geht auch
 * (Ziffern, Rücktaste, Enter). Die PIN bleibt ein String - führende Nullen
 * zählen (B3: `"0420"`).
 */
export default function PinPad({
  value,
  onChange,
  onSubmit,
  disabled = false,
}: PinPadProps) {
  const canSubmit = !disabled && value.length >= PIN_MIN_LENGTH

  const press = React.useCallback(
    (digit: string) => {
      if (disabled || value.length >= PIN_MAX_LENGTH) return
      onChange(value + digit)
    },
    [disabled, value, onChange]
  )
  const erase = React.useCallback(() => {
    if (!disabled) onChange(value.slice(0, -1))
  }, [disabled, value, onChange])

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) press(event.key)
      else if (event.key === 'Backspace') erase()
      else if (event.key === 'Enter' && canSubmit) onSubmit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, erase, canSubmit, onSubmit])

  const keySx = {
    minHeight: { xs: 64, sm: 76 },
    fontSize: { xs: '1.6rem', sm: '1.9rem' },
    fontWeight: 600,
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 360, mx: 'auto' }}>
      <Box
        role="status"
        aria-label={`${value.length} von höchstens ${PIN_MAX_LENGTH} Ziffern eingegeben`}
        data-testid="pin-dots"
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: 1.5,
          mb: 3,
          minHeight: 24,
        }}
      >
        {Array.from({ length: PIN_MAX_LENGTH }, (_, i) => (
          <Box
            key={i}
            sx={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: 2,
              borderColor:
                i < PIN_MIN_LENGTH || i < value.length
                  ? 'text.primary'
                  : 'divider',
              bgcolor: i < value.length ? 'text.primary' : 'transparent',
            }}
          />
        ))}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 1.5,
        }}
      >
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <Button
            key={digit}
            variant="outlined"
            sx={keySx}
            onClick={() => press(digit)}
            disabled={disabled || value.length >= PIN_MAX_LENGTH}
          >
            {digit}
          </Button>
        ))}
        <Button
          variant="outlined"
          sx={keySx}
          onClick={erase}
          disabled={disabled || value.length === 0}
          aria-label="Löschen"
        >
          <BackspaceIcon fontSize="large" />
        </Button>
        <Button
          variant="outlined"
          sx={keySx}
          onClick={() => press('0')}
          disabled={disabled || value.length >= PIN_MAX_LENGTH}
        >
          0
        </Button>
        <Button
          variant="contained"
          // W4-verify r3: „ANMELDEN" in Versalien war breiter als die Taste
          // (115 px Text in 112 px) - normal geschrieben, ohne Sperrung und mit
          // schmalem Innenabstand passt es auch auf 320 px.
          sx={{
            ...keySx,
            fontSize: { xs: '1.05rem', sm: '1.2rem' },
            textTransform: 'none',
            letterSpacing: 0,
            minWidth: 0,
            px: 0.5,
          }}
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          Anmelden
        </Button>
      </Box>
    </Box>
  )
}
