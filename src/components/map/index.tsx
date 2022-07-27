import { Box, Typography } from '@mui/material'
import React from 'react'

const Map: React.FC = () => {
  return (
    <Box>
      <Box sx={styles.map}>
        Map Goes here
      </Box>
      <Box sx={styles.info}>
        <Typography>Öffnungszeiten</Typography>
        <Box>
          
        </Box>
      </Box>
    </Box>
  )
}

const styles = {
  map: {},
  info: {}
}

export default Map