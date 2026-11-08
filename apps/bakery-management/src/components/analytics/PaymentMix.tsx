'use client'
import React from 'react'
import { Box, LinearProgress, Stack, Typography } from '@mui/material'
import type { PaymentMethodData } from '@bakery/shared/types'
import { formatEuro, formatPercent } from '../../lib/reportFormat'

/**
 * Zahlungsarten als Liste mit Anteilsbalken statt Tortendiagramm: das
 * Diagramm war am Handy abgeschnitten, und die weiße Prozent-Schrift lag auf
 * den hellen Segmenten. Zahlungsarten ohne Betrag (Gutscheine, 0-€-Bons)
 * stehen mit ihrer Bonzahl darunter, nicht als 0-%-Balken.
 */
export default function PaymentMix({ data }: { data: PaymentMethodData[] }) {
  const paid = data.filter((d) => d.amount > 0)
  const free = data.filter((d) => d.amount <= 0 && d.count > 0)
  const total = paid.reduce((sum, d) => sum + d.amount, 0)
  if (paid.length === 0 && free.length === 0) {
    return (
      <Typography color="text.secondary">
        Keine Zahlungen im gewählten Zeitraum.
      </Typography>
    )
  }
  return (
    <Stack spacing={1.5} component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
      {paid.map((d) => {
        const share = total > 0 ? (d.amount / total) * 100 : 0
        return (
          <Box component="li" key={d.method}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 1,
                mb: 0.5,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {d.method}
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatPercent(share)}
                <Typography
                  component="span"
                  variant="body2"
                  color="text.secondary"
                >
                  {` · ${formatEuro(d.amount)} · ${d.count} Bons`}
                </Typography>
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={share}
              aria-label={`Anteil ${d.method}`}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
        )
      })}
      {free.map((d) => (
        <Typography
          component="li"
          key={d.method}
          variant="body2"
          color="text.secondary"
        >
          {`${d.method}: ${d.count} Bons ohne Betrag (Gutscheine, 0-€-Bons)`}
        </Typography>
      ))}
    </Stack>
  )
}
