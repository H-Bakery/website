import React from 'react'
import { Box, Button, Container, Typography } from '@mui/material'
import ViewInArIcon from '@mui/icons-material/ViewInAr'

/**
 * Wo die Digitale Bäckerei liegt: eine eigene statische App, die der
 * Deploy-Workflow unter diesem Pfad in den Export der Landingpage hängt
 * (docs/apps/digitale-baeckerei.md). Mit Schrägstrich am Ende - ohne leitet
 * GitHub Pages erst um.
 */
export const DIGITALE_BAECKEREI_PFAD = '/digitale-baeckerei/'

/**
 * Bescheidener Einstieg in die Digitale Bäckerei auf der Startseite.
 * Ein normaler Link (`<a href>`), kein `next/link`: Das Ziel ist keine Route
 * dieser App, der Router würde dort nichts finden.
 */
const DigitaleBaeckereiTeaser: React.FC = () => (
  <Box
    component="section"
    aria-labelledby="digitale-baeckerei-titel"
    sx={{ py: { xs: 4, md: 5 }, backgroundColor: '#FFFFFF' }}
  >
    <Container maxWidth="md">
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: 'center',
          gap: { xs: 2, sm: 3 },
          textAlign: { xs: 'center', sm: 'left' },
          border: '2px solid #E6D8C3',
          borderRadius: '16px',
          px: { xs: 2.5, md: 4 },
          py: { xs: 3, md: 3.5 },
        }}
      >
        <ViewInArIcon
          aria-hidden
          sx={{ fontSize: { xs: 44, md: 52 }, color: '#5A2E2A', flexShrink: 0 }}
        />
        <Box sx={{ flexGrow: 1 }}>
          <Typography
            id="digitale-baeckerei-titel"
            variant="h5"
            component="h2"
            sx={{
              fontFamily: '"Cinzel", serif',
              fontWeight: 700,
              color: '#3B2B28',
              fontSize: { xs: '1.3rem', md: '1.5rem' },
              mb: 0.5,
            }}
          >
            Ein Blick in unsere Bäckerei
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: '#6B5B4B', fontSize: { xs: '1rem', md: '1.05rem' } }}
          >
            Theke, Brotregal und Regale in 3D – zum Umschauen am Handy oder am
            Computer.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          href={DIGITALE_BAECKEREI_PFAD}
          sx={{
            flexShrink: 0,
            minHeight: 48,
            px: 3,
            py: 1.25,
            fontSize: { xs: '1rem', md: '1.05rem' },
            fontWeight: 700,
            borderColor: '#5A2E2A',
            color: '#5A2E2A',
            borderWidth: 2,
            borderRadius: '8px',
            whiteSpace: 'nowrap',
            '&:hover': {
              borderColor: '#3B2B28',
              backgroundColor: 'rgba(90, 46, 42, 0.05)',
              borderWidth: 2,
            },
          }}
        >
          Digitale Bäckerei öffnen
        </Button>
      </Box>
    </Container>
  </Box>
)

export default DigitaleBaeckereiTeaser
