import { Box, Typography } from '@mui/material'
import React from 'react'

/**
 * Öffnungszeiten der Bäckerei Heusser.
 *
 * Muss mit apps/bakery-landing/src/config/openingHours.ts (OPENING_HOURS)
 * übereinstimmen — das ist die Quelle der Wahrheit. Diese Lib darf nicht aus
 * einer App importieren, deshalb sind die Zeiten hier gespiegelt: bei einer
 * Änderung dort bitte auch hier nachziehen.
 */
export const FooterOpenings: React.FC = () => {
  return (
    <Box>
      <Typography variant="h6" fontSize={16} gutterBottom>
        Öffnungszeiten
      </Typography>
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.disabled">
          Di, Mi, Do, Fr
        </Typography>
        <Typography variant="body2" color="text.secondary">
          05:30 - 13:30 Uhr
        </Typography>
      </Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.disabled">
          Sa
        </Typography>
        <Typography variant="body2" color="text.secondary">
          05:30 - 12:30 Uhr
        </Typography>
      </Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.disabled">
          So und Feiertage
        </Typography>
        <Typography variant="body2" color="text.secondary">
          08:00 - 11:00 Uhr
        </Typography>
      </Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.disabled">
          Montag
        </Typography>
        <Typography variant="body2" color="text.secondary">
          ist Ruhetag
        </Typography>
      </Box>
    </Box>
  )
}
