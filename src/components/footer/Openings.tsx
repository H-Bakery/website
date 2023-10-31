import { Box, Typography } from '@mui/material'
import React from 'react'

const Openings: React.FC = () => {
  return (
    <Box>
      <Typography variant="h6" fontSize={16} gutterBottom>
        Öffnungszeiten
      </Typography>
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.disabled">
          Di, Do, Fr
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
          06:00 - 13:00 Uhr
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
          Mo
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Ruhetag
        </Typography>
      </Box>
    </Box>
  )
}

export default Openings
