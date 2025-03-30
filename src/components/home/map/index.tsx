// website/src/components/home/map/index.tsx
import React from 'react'
import {
  Box,
  Typography,
  Divider,
  useTheme,
  useMediaQuery,
  Container,
} from '@mui/material'
import Info from './Info'
import { ZEITEN } from './zeiten'
import Button from '../../button/Index'
import DynamicMap from './DynamicMap'
import DirectionsIcon from '@mui/icons-material/Directions'

const Map: React.FC = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // Position for map marker [latitude, longitude]
  const position: [number, number] = [49.301429495245586, 7.369493502873482]

  // Create Google Maps direction URL
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${position[0]},${position[1]}&travelmode=driving`

  const map = (
    <Box sx={styles.map}>
      <DynamicMap
        position={position}
        name="Böckerei Heusser"
        address="Eckstraße 3, 66424 Homburg, Deutschland"
      />
    </Box>
  )

  return (
    <Box sx={styles.section}>
      {!isMobile && map}
      <Container>
        <Box sx={styles.info}>
          <Typography variant="h6" gutterBottom>
            Öffnungszeiten
          </Typography>
          {ZEITEN.map((item) => (
            <Info key={item.label} {...item} />
          ))}
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            Adresse
          </Typography>
          {isMobile && map}
          <Typography fontWeight="bold">Eckstraße 3</Typography>
          <Typography color="text.secondary">66424 Homburg</Typography>
          <Typography color="text.secondary">Deutschland</Typography>
          <Button
            sx={{ mt: 2 }}
            fullWidth
            startIcon={<DirectionsIcon />}
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Route starten
          </Button>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            Kontakt
          </Typography>
          <Typography>06841 2229</Typography>
          <Typography>01522 6621236</Typography>
          <Button sx={{ mt: 2 }} fullWidth>
            Anrufen
          </Button>
          <Button sx={{ mt: 2 }} fullWidth>
            Bestellen
          </Button>
        </Box>
      </Container>
    </Box>
  )
}

const styles = {
  section: {
    minHeight: '100vh',
    width: '100%',
    bgcolor: 'grey.300',
    position: 'relative',
    py: { xs: 3, sm: 0 },
  },
  map: {
    position: { xs: 'relative', sm: 'absolute' },
    zIndex: 1,
    top: 0,
    left: 0,
    height: { xs: '240px', sm: '100vh' },
    borderRadius: { xs: '8px', sm: '0' },
    mb: { xs: 2, sm: '0' },
    overflow: 'hidden',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    position: { xs: 'relative', sm: 'absolute' },
    zIndex: 2,
    bgcolor: 'background.paper',
    borderRadius: '8px',
    boxShadow: 1,
    p: 3,
  },
}

export default Map
