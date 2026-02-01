// website/src/components/home/map/index.tsx
'use client'
import React from 'react'
import {
  Box,
  Typography,
  Divider,
  useTheme,
  useMediaQuery,
  Container,
  Button,
  Grid,
  Table,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material'
import { ZEITEN } from './zeiten'
import DynamicMap from './DynamicMap'
import DirectionsIcon from '@mui/icons-material/Directions'
import PhoneIcon from '@mui/icons-material/Phone'
import { MapErrorBoundary } from './MapErrorBoundary'

const Map: React.FC = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const position: [number, number] = [49.301429495245586, 7.369493502873482]
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${position[0]},${position[1]}&travelmode=driving`

  const mapElement = (
    <Box
      sx={{
        height: { xs: '300px', md: '100%' },
        minHeight: { md: '450px' },
        borderRadius: { xs: '12px', md: '12px' },
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(90, 46, 42, 0.08)',
      }}
    >
      <MapErrorBoundary>
        <DynamicMap
          position={position}
          name="Bäckerei Heusser"
          address="Eckstraße 3, 66424 Homburg, Deutschland"
        />
      </MapErrorBoundary>
    </Box>
  )

  return (
    <Box
      id="location-hours"
      sx={{
        py: { xs: 5, md: 7 },
        backgroundColor: '#FFFFFF',
      }}
    >
      <Container maxWidth="lg">
        {/* Section Heading */}
        <Typography
          variant="h3"
          component="h2"
          sx={{
            textAlign: 'center',
            fontFamily: '"Cinzel", serif',
            fontWeight: 700,
            color: '#3B2B28',
            mb: { xs: 3, md: 5 },
            fontSize: { xs: '1.6rem', sm: '2rem', md: '2.25rem' },
          }}
        >
          Besuchen Sie uns
        </Typography>

        <Grid container spacing={{ xs: 3, md: 4 }}>
          {/* Left: Opening Hours + Address */}
          <Grid item xs={12} md={5}>
            {/* Opening Hours Table */}
            <Typography
              variant="h5"
              sx={{
                fontFamily: '"Cinzel", serif',
                fontWeight: 700,
                color: '#5A2E2A',
                mb: 2,
                fontSize: { xs: '1.15rem', md: '1.3rem' },
              }}
            >
              Öffnungszeiten
            </Typography>
            <Table size="small" sx={{ mb: 3 }}>
              <TableBody>
                {ZEITEN.map((item) => (
                  <TableRow
                    key={item.label}
                    sx={{ '&:last-child td': { borderBottom: 'none' } }}
                  >
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        color: '#3B2B28',
                        fontSize: { xs: '1rem', md: '1.05rem' },
                        fontFamily: '"Merriweather", serif',
                        borderColor: '#E6D8C3',
                        pl: 0,
                        py: 1.5,
                      }}
                    >
                      {item.label}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color:
                          item.value === 'Geschlossen' ? '#928168' : '#3B2B28',
                        fontSize: { xs: '1rem', md: '1.05rem' },
                        fontFamily: '"Merriweather", serif',
                        borderColor: '#E6D8C3',
                        pr: 0,
                        py: 1.5,
                      }}
                    >
                      {item.value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Divider sx={{ borderColor: '#E6D8C3', mb: 3 }} />

            {/* Address */}
            <Typography
              variant="h5"
              sx={{
                fontFamily: '"Cinzel", serif',
                fontWeight: 700,
                color: '#5A2E2A',
                mb: 1.5,
                fontSize: { xs: '1.15rem', md: '1.3rem' },
              }}
            >
              Adresse
            </Typography>
            <Typography
              sx={{
                fontWeight: 700,
                color: '#3B2B28',
                fontSize: { xs: '1rem', md: '1.05rem' },
                fontFamily: '"Merriweather", serif',
              }}
            >
              Eckstraße 3
            </Typography>
            <Typography
              sx={{
                color: '#928168',
                fontSize: { xs: '1rem', md: '1.05rem' },
                fontFamily: '"Merriweather", serif',
                mb: 0.5,
              }}
            >
              66424 Homburg
            </Typography>

            <Divider sx={{ borderColor: '#E6D8C3', my: 3 }} />

            {/* Contact */}
            <Typography
              variant="h5"
              sx={{
                fontFamily: '"Cinzel", serif',
                fontWeight: 700,
                color: '#5A2E2A',
                mb: 1.5,
                fontSize: { xs: '1.15rem', md: '1.3rem' },
              }}
            >
              Kontakt
            </Typography>
            <Typography
              component="a"
              href="tel:068412229"
              sx={{
                display: 'block',
                color: '#3B2B28',
                fontSize: { xs: '1.1rem', md: '1.15rem' },
                fontFamily: '"Merriweather", serif',
                fontWeight: 700,
                textDecoration: 'none',
                mb: 0.5,
                '&:hover': { color: '#d038ba' },
              }}
            >
              06841 2229
            </Typography>
            <Typography
              sx={{
                color: '#928168',
                fontSize: { xs: '0.95rem', md: '1rem' },
                fontFamily: '"Merriweather", serif',
                mb: 2,
              }}
            >
              01522 6621236
            </Typography>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<DirectionsIcon />}
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  minHeight: 48,
                  fontSize: { xs: '1rem', md: '1.05rem' },
                  fontWeight: 700,
                  backgroundColor: '#5A2E2A',
                  borderRadius: '8px',
                  '&:hover': { backgroundColor: '#3B2B28' },
                }}
              >
                Route planen
              </Button>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<PhoneIcon />}
                href="tel:068412229"
                sx={{
                  minHeight: 48,
                  fontSize: { xs: '1rem', md: '1.05rem' },
                  fontWeight: 700,
                  borderColor: '#5A2E2A',
                  color: '#5A2E2A',
                  borderWidth: 2,
                  borderRadius: '8px',
                  '&:hover': {
                    borderColor: '#3B2B28',
                    backgroundColor: 'rgba(90, 46, 42, 0.05)',
                    borderWidth: 2,
                  },
                }}
              >
                Anrufen
              </Button>
            </Box>
          </Grid>

          {/* Right: Map */}
          <Grid item xs={12} md={7}>
            {mapElement}
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}

export default Map
