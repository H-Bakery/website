'use client'
import React from 'react'
import { Box, Container, Typography, Paper, Grid, Button } from '@mui/material'
import PhoneIcon from '@mui/icons-material/Phone'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import Hero from '../../components/Hero'
import { LEGAL } from '../../config/legal'

const createWhatsAppLink = (message: string) =>
  `https://wa.me/491706133279?text=${encodeURIComponent(message)}`

const BestellenPage: React.FC = () => (
  <>
    <Hero title="Bestellen" />
    <Container maxWidth="md">
      <Box sx={styles.mainContent}>
        {/* Introductory Text */}
        <Paper elevation={1} sx={styles.introSection}>
          <Typography variant="h5" component="h2" gutterBottom>
            So können Sie bei uns bestellen
          </Typography>

          <Typography paragraph>
            Unsere frischen Backwaren können Sie ganz einfach vorbestellen.
            Wählen Sie eine der folgenden Möglichkeiten, um Ihre Bestellung
            aufzugeben und genießen Sie den Vorteil, dass Ihre Backwaren für Sie
            reserviert werden.
          </Typography>

          <Typography paragraph>
            Für größere Bestellungen oder besondere Anlässe empfehlen wir,
            mindestens 48 Stunden im Voraus zu bestellen.
          </Typography>
        </Paper>

        {/* Contact Options */}
        <Grid container sx={styles.contactOptions}>
          {/* Phone Option */}
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={styles.optionCard}>
              <Box sx={styles.optionIcon}>
                <PhoneIcon fontSize="large" color="primary" />
              </Box>
              <Typography variant="h6" gutterBottom>
                Telefonisch bestellen
              </Typography>
              <Typography paragraph>
                Rufen Sie uns direkt während unserer Öffnungszeiten an und geben
                Sie Ihre Bestellung auf. So können wir direkt Rückfragen klären
                und Ihnen einen Abholtermin bestätigen.
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Unsere Telefonnummer:
              </Typography>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                {LEGAL.phone}
              </Typography>
              <Button
                startIcon={<PhoneIcon />}
                href={LEGAL.phoneHref}
                fullWidth
              >
                Jetzt anrufen
              </Button>
            </Paper>
          </Grid>

          {/* WhatsApp Option */}
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={styles.optionCard}>
              <Box sx={styles.optionIcon}>
                <WhatsAppIcon fontSize="large" style={{ color: '#25D366' }} />
              </Box>
              <Typography variant="h6" gutterBottom>
                Per WhatsApp bestellen
              </Typography>
              <Typography>
                Senden Sie uns eine WhatsApp-Nachricht mit Ihrer Bestellung.
                Bitte geben Sie folgende Informationen an:
              </Typography>
              <Box
                component="ul"
                sx={{ pl: '1.5rem', mt: 0.5, mb: 2, typography: 'body1' }}
              >
                <li>Vollständige Bestellung mit Mengen</li>
                <li>Gewünschter Abholtermin</li>
                <li>Ihr Name</li>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                Unsere WhatsApp-Nummer:
              </Typography>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                {LEGAL.mobile}
              </Typography>
              <Button
                startIcon={<WhatsAppIcon />}
                href={createWhatsAppLink(
                  'Hallo! Ich möchte gerne eine Bestellung aufgeben.'
                )}
                target="_blank"
                rel="noopener noreferrer"
                fullWidth
                sx={{
                  backgroundColor: '#25D366',
                  '&:hover': {
                    backgroundColor: '#128C7E',
                  },
                }}
              >
                WhatsApp öffnen
              </Button>
            </Paper>
          </Grid>
        </Grid>

        {/* Additional Information */}
        <Paper elevation={1} sx={styles.noteSection}>
          <Typography variant="h6" gutterBottom>
            Wichtige Hinweise
          </Typography>
          <Typography paragraph>
            • Bestellungen nehmen wir telefonisch oder per WhatsApp täglich von
            05:30 bis 14:00 Uhr entgegen.
          </Typography>
          <Typography paragraph>
            • Spezielle Kuchen, Torten oder große Mengen benötigen mehr
            Vorlaufzeit (mindestens 2-3 Tage).
          </Typography>
          <Typography paragraph>
            • Sie erhalten immer eine Bestätigung von uns, wenn Ihre Bestellung
            bei uns eingegangen ist.
          </Typography>
          <Typography>
            Bei Fragen zu Ihren Bestellungen stehen wir Ihnen gerne zur
            Verfügung!
          </Typography>
        </Paper>
      </Box>
    </Container>
  </>
)

const styles = {
  mainContent: {
    py: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    mb: 6,
  },
  introSection: {
    p: 3,
    bgcolor: 'background.paper',
  },
  contactOptions: {
    mt: 2,
  },
  optionCard: {
    p: 3,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  optionIcon: {
    display: 'flex',
    justifyContent: 'center',
    mb: 2,
    fontSize: 48,
  },
  noteSection: {
    p: 3,
    bgcolor: 'background.paper',
    borderLeft: '4px solid',
    borderColor: 'primary.main',
  },
  onlineFormSection: {
    mt: 4,
  },
  formContainer: {
    p: 3,
  },
}

export default BestellenPage
