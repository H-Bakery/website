'use client'

import React from 'react'
import { Box, Paper, Stack, Typography } from '@mui/material'
import type { PrepView } from '../../lib/backzettelApi'
import { formatDateLong } from '../../lib/backzettelFormat'
import { prepTaskLabel } from '../backzettel/PrepCard'

export interface BackstubePrepProps {
  prep: PrepView
  /** Kalender-Heute des Tablets. */
  today: string
}

/**
 * „Vorbereitung heute": die Vorbereitungen für den nächsten Produktionstag,
 * erledigt am Vortag ab 14 Uhr (roadmap §5.4). Gerechnet hat der Server
 * (`GET /api/backzettel/:datum/prep`).
 */
export function BackstubePrep({ prep, today }: BackstubePrepProps) {
  const tasks = prep.prep ?? []
  const isToday = prep.prepDate === today
  return (
    <Paper
      component="section"
      aria-labelledby="bs-prep-title"
      variant="outlined"
      data-testid="bs-prep"
      sx={{ p: { xs: 2, sm: 3 }, borderWidth: 2 }}
    >
      <Typography
        id="bs-prep-title"
        component="h2"
        sx={{ fontSize: { xs: '1.5rem', sm: '1.9rem' }, fontWeight: 800 }}
      >
        Für {formatDateLong(prep.date)}
      </Typography>
      <Typography sx={{ fontSize: '1.15rem', color: 'text.secondary' }}>
        {isToday
          ? 'Heute ab 14 Uhr vorbereiten.'
          : `Vorzubereiten am ${formatDateLong(prep.prepDate)}.`}
      </Typography>
      {prep.prepDateProvisional && (
        <Typography
          data-testid="bs-prep-provisional"
          sx={{ fontSize: '1.15rem', fontWeight: 700, mt: 1 }}
        >
          Der Vortag ist Ruhetag – wann und von wem vorbereitet wird, ist noch
          nicht festgelegt.
        </Typography>
      )}
      {prep.status === 'draft' && (
        <Typography sx={{ fontSize: '1.15rem', mt: 1 }}>
          Der Backzettel für diesen Tag ist noch nicht freigegeben – die
          Vorbereitung kann sich noch ändern.
        </Typography>
      )}
      {tasks.length === 0 ? (
        <Typography sx={{ fontSize: '1.4rem', mt: 3 }}>
          Keine Vorbereitung eingetragen.
        </Typography>
      ) : (
        <Stack
          component="ul"
          spacing={1.5}
          sx={{ listStyle: 'none', p: 0, mt: 3, mb: 0 }}
        >
          {tasks.map((t) => (
            <Box
              component="li"
              key={`${t.id}-${t.variant ?? ''}`}
              data-testid={`bs-prep-${t.id}`}
              sx={{
                p: 2,
                minHeight: 72,
                borderRadius: 2,
                border: '2px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Typography
                sx={{
                  fontSize: { xs: '1.4rem', sm: '1.75rem' },
                  fontWeight: 700,
                }}
              >
                {prepTaskLabel(t)}
              </Typography>
              {t.note && (
                <Typography
                  sx={{ fontSize: '1.1rem', color: 'text.secondary' }}
                >
                  {t.note}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Paper>
  )
}

export default BackstubePrep
