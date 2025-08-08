import { Box, Typography } from '@mui/material'
import React from 'react'

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
          06:00 - 15:00 Uhr
        </Typography>
      </Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.disabled">
          Sa
        </Typography>
        <Typography variant="body2" color="text.secondary">
          06:00 - 12:30 Uhr
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