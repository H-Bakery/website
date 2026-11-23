'use client'

import { Box, Button, Stack, Typography } from '@mui/material'
import { formatGermanDate } from '@bakery/shop/feature-cart/pickup'
import type { PickupDay } from '../../lib/order/pickup-options'

const chipSx = {
  minHeight: 44,
  minWidth: 44,
  px: 1,
  borderRadius: 5,
  textTransform: 'none',
  '&[aria-disabled="true"]': {
    bgcolor: 'action.hover',
    color: 'text.secondary',
    borderColor: 'divider',
    cursor: 'default',
  },
} as const

export function PickupPicker({
  days,
  day,
  time,
  place,
  calendarKnown,
  onDay,
  onTime,
}: {
  days: PickupDay[]
  day: string
  time: string
  place: string
  calendarKnown: boolean
  onDay: (day: string) => void
  onTime: (time: string) => void
}) {
  const selected = days.find(({ date }) => date === day)
  return (
    <Stack spacing={2}>
      <Box role="group" aria-labelledby="order-day-label">
        <Typography id="order-day-label" fontWeight={700} gutterBottom>
          Abholtag
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(73px, 1fr))',
            gap: 1,
          }}
        >
          {days.map(({ date, reason }) => {
            const fullDate = formatGermanDate(date)
            const [weekday, dateLabel] = fullDate.split(', ')
            const label = `${weekday.slice(0, 2)} ${dateLabel.slice(0, 6)}`
            return (
              <Box key={date}>
                <Button
                  fullWidth
                  variant={day === date && !reason ? 'contained' : 'outlined'}
                  aria-pressed={day === date && !reason}
                  aria-label={`${label} (${fullDate})`}
                  aria-disabled={Boolean(reason)}
                  aria-describedby={reason ? `order-day-${date}` : undefined}
                  title={reason}
                  onClick={() => {
                    if (!reason) onDay(date)
                  }}
                  sx={chipSx}
                >
                  {label}
                </Button>
                {reason && (
                  <Typography
                    id={`order-day-${date}`}
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: 'block',
                      lineHeight: 1.3,
                      mt: 0.5,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {reason}
                  </Typography>
                )}
              </Box>
            )
          })}
        </Box>
      </Box>
      <Box role="group" aria-labelledby="order-time-label">
        <Typography id="order-time-label" fontWeight={700} gutterBottom>
          Abholzeit
        </Typography>
        {selected?.times.length ? (
          <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75}>
            {selected.times.map((slot) => (
              <Button
                key={slot}
                variant={time === slot ? 'contained' : 'outlined'}
                aria-pressed={time === slot}
                aria-label={`${slot} Uhr`}
                onClick={() => onTime(slot)}
                sx={chipSx}
              >
                {slot}
              </Button>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary" variant="body2">
            Bitte wählen Sie einen verfügbaren Tag.
          </Typography>
        )}
      </Box>
      <Typography>
        <strong>Abholort</strong> · {place}
      </Typography>
      {!calendarKnown && (
        <Typography variant="body2" color="text.secondary">
          Keine Betriebsferien bekannt.
        </Typography>
      )}
    </Stack>
  )
}
