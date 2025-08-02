'use client'
import React from 'react'
import { Box, Container, Typography, Button } from '@mui/material'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { ArrowBack as BackIcon } from '@mui/icons-material'

// Simple theme for landing page
const theme = createTheme({
  palette: {
    primary: {
      main: '#D038BA',
    },
  },
  typography: {
    fontFamily: '"Playfair Display", "Lora", "Ubuntu", serif',
    h1: {
      fontFamily: '"Playfair Display", serif',
      fontWeight: 700,
    },
    h2: {
      fontFamily: '"Playfair Display", serif',
      fontWeight: 700,
    },
  },
})

export default function ImprintPage() {
  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* Header */}
        <Box
          component="header"
          sx={{ bgcolor: 'primary.main', color: 'white', py: 2 }}
        >
          <Container maxWidth="lg">
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography
                variant="h4"
                component="h1"
                sx={{ fontWeight: 'bold' }}
              >
                Bäckerei Heusser
              </Typography>
              <Button
                variant="outlined"
                sx={{ color: 'white', borderColor: 'white' }}
                startIcon={<BackIcon />}
                href="/"
              >
                Zurück
              </Button>
            </Box>
          </Container>
        </Box>

        {/* Hero Section */}
        <Box sx={{ bgcolor: 'grey.50', py: 6 }}>
          <Container maxWidth="lg">
            <Typography variant="h1" component="h2" align="center">
              Impressum
            </Typography>
          </Container>
        </Box>

        {/* Imprint Content */}
        <Container maxWidth="sm" sx={{ py: 6 }}>
          <Box>
            <Typography variant="h5" gutterBottom>
              Angaben gemäß § 5 TMG
            </Typography>
            <Typography variant="body1" paragraph>
              Bäckerei Heusser
              <br />
              Eckstraße 3<br />
              66424 Homburg/Kirrberg
            </Typography>

            <Typography variant="body1" paragraph>
              <strong>Vertreten durch:</strong>
              <br />
              Karl-Heinz Heußer
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
              Kontakt
            </Typography>
            <Typography variant="body1" paragraph>
              Telefon: 06841 2229
              <br />
              Handy: 01522 66 2 12 36
              <br />
              E-Mail: baeckerei@heusserk.de
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
              Umsatzsteuer-ID
            </Typography>
            <Typography variant="body1" paragraph>
              Umsatzsteuer-Identifikationsnummer gemäß § 27 a
              Umsatzsteuergesetz:
              <br />
              DE999999999
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
              Redaktionell verantwortlich
            </Typography>
            <Typography variant="body1" paragraph>
              Sebastian Heußer
              <br />
              Collingstraße 104
              <br />
              66424 Homburg/Kirrberg
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
              EU-Streitschlichtung
            </Typography>
            <Typography variant="body1" paragraph>
              Die Europäische Kommission stellt eine Plattform zur
              Online-Streitbeilegung (OS) bereit:
              <a
                href="https://ec.europa.eu/consumers/odr/"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://ec.europa.eu/consumers/odr/
              </a>
              <br />
              Unsere E-Mail-Adresse finden Sie oben im Impressum.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
              Verbraucherstreitbeilegung/Universalschlichtungsstelle
            </Typography>
            <Typography variant="body1" paragraph>
              Wir sind nicht bereit oder verpflichtet, an
              Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
              teilzunehmen.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
              Haftung für Inhalte
            </Typography>
            <Typography variant="body1" paragraph>
              Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene
              Inhalte auf diesen Seiten nach den allgemeinen Gesetzen
              verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter
              jedoch nicht unter der Verpflichtung, übermittelte oder
              gespeicherte fremde Informationen zu überwachen oder nach
              Umständen zu forschen, die auf eine rechtswidrige Tätigkeit
              hinweisen.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
              Haftung für Links
            </Typography>
            <Typography variant="body1" paragraph>
              Unser Angebot enthält Links zu externen Websites Dritter, auf
              deren Inhalte wir keinen Einfluss haben. Deshalb können wir für
              diese fremden Inhalte auch keine Gewähr übernehmen. Für die
              Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter
              oder Betreiber der Seiten verantwortlich.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
              Urheberrecht
            </Typography>
            <Typography variant="body1" paragraph>
              Die durch die Seitenbetreiber erstellten Inhalte und Werke auf
              diesen Seiten unterliegen dem deutschen Urheberrecht. Die
              Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
              Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der
              schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
            </Typography>
          </Box>
        </Container>

        {/* Footer */}
        <Box
          component="footer"
          sx={{ bgcolor: 'grey.900', color: 'white', py: 4 }}
        >
          <Container maxWidth="lg">
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="grey.400">
                © 2024 Bäckerei Heusser. Alle Rechte vorbehalten.
              </Typography>
            </Box>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  )
}
