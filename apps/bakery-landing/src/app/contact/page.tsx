import React from 'react'
import {
  Box,
  Container,
  Typography,
  Breadcrumbs,
  Link,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import {
  Home as HomeIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Schedule as ScheduleIcon,
  Directions as DirectionsIcon,
  WhatsApp as WhatsAppIcon,
} from '@mui/icons-material'
import Hero from '../../components/Hero'
import { MapConsent } from '../../components/home/map/MapConsent'
import { MapErrorBoundary } from '../../components/home/map/MapErrorBoundary'
import DynamicMap from '../../components/home/map/DynamicMap'
import { LEGAL } from '../../config/legal'
import {
  getContactPageHours,
  getEarliestOpeningTime,
} from '../../utils/openingHours'
import { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: { canonical: '/contact' },
  title: 'Kontakt - Bäckerei Heusser',
  description:
    'Kontaktieren Sie die Bäckerei Heusser. Adresse, Öffnungszeiten, Telefon und alle Informationen für Ihren Besuch.',
  keywords: 'Kontakt, Adresse, Öffnungszeiten, Telefon, Bäckerei, Standort',
}

const MAP_POSITION: [number, number] = [49.301429495245586, 7.369493502873482]

export default function ContactPage() {
  return (
    <>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Breadcrumb Navigation */}
        <Box sx={{ mb: 4 }}>
          <Breadcrumbs aria-label="breadcrumb">
            <Link
              underline="hover"
              color="inherit"
              href="/"
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
              Startseite
            </Link>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: 'text.primary',
              }}
            >
              <PhoneIcon sx={{ mr: 0.5 }} fontSize="small" />
              Kontakt
            </Box>
          </Breadcrumbs>
        </Box>
      </Container>

      {/* Hero Section */}
      <Hero title="Kontakt" />

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography
          variant="h5"
          component="p"
          color="text.secondary"
          sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center', mb: 6 }}
        >
          Besuchen Sie uns in unserer Bäckerei oder kontaktieren Sie uns für
          Fragen und Bestellungen.
        </Typography>

        <Grid container spacing={4} sx={{ mb: 6 }}>
          {/* Contact Information */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography
                  variant="h5"
                  component="h2"
                  gutterBottom
                  color="primary.main"
                >
                  Kontaktdaten
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <LocationIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Adresse"
                      secondary={
                        <>
                          Eckstraße 3<br />
                          66424 Homburg/Kirrberg
                        </>
                      }
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <PhoneIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Telefon"
                      secondary={
                        <Link
                          href={LEGAL.phoneHref}
                          color="inherit"
                          underline="hover"
                        >
                          {LEGAL.phone}
                        </Link>
                      }
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <WhatsAppIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Mobil / WhatsApp"
                      secondary={
                        <Link
                          href={LEGAL.mobileHref}
                          color="inherit"
                          underline="hover"
                        >
                          {LEGAL.mobile}
                        </Link>
                      }
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <EmailIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="E-Mail"
                      secondary={
                        <Link
                          href={`mailto:${LEGAL.email}`}
                          color="inherit"
                          underline="hover"
                        >
                          {LEGAL.email}
                        </Link>
                      }
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Opening Hours */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography
                  variant="h5"
                  component="h2"
                  gutterBottom
                  color="primary.main"
                >
                  Öffnungszeiten
                </Typography>
                <List>
                  {getContactPageHours().map((item, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <ScheduleIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText primary={item.day} secondary={item.hours} />
                    </ListItem>
                  ))}
                </List>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Bitte beachten Sie mögliche Änderungen der Öffnungszeiten an
                    Feiertagen.
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Map Section */}
        <Box sx={{ mb: 6 }}>
          <Typography variant="h4" component="h2" gutterBottom align="center">
            So finden Sie uns
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            align="center"
            paragraph
            sx={{ mb: 4 }}
          >
            Unsere Bäckerei befindet sich im Herzen von Kirrberg, einem Ortsteil
            von Homburg.
          </Typography>

          <Box
            sx={{
              width: '100%',
              height: 400,
              borderRadius: 2,
              overflow: 'hidden',
              mb: 3,
            }}
          >
            <MapConsent>
              <MapErrorBoundary>
                <DynamicMap
                  position={MAP_POSITION}
                  name="Bäckerei Heusser"
                  address="Eckstraße 3, 66424 Homburg"
                />
              </MapErrorBoundary>
            </MapConsent>
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Link
              href="https://maps.google.com/?q=Eckstraße+3,+66424+Homburg"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                textDecoration: 'none',
                color: 'primary.main',
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              <DirectionsIcon />
              Route in Google Maps anzeigen
            </Link>
          </Box>
        </Box>

        {/* Additional Information */}
        <Box
          sx={{
            bgcolor: 'grey.100',
            py: 6,
            mx: { xs: -2, sm: -3 },
            borderRadius: 2,
          }}
        >
          <Container maxWidth="lg">
            <Typography variant="h4" component="h2" gutterBottom align="center">
              Hinweise für Ihren Besuch
            </Typography>

            <Grid container spacing={4} sx={{ mt: 2 }}>
              <Grid item xs={12} md={6}>
                <Box sx={{ textAlign: 'center' }}>
                  <PhoneIcon
                    sx={{ fontSize: 40, color: 'primary.main', mb: 2 }}
                  />
                  <Typography variant="h6" gutterBottom>
                    Vorbestellungen
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Gerne nehmen wir Ihre Bestellungen telefonisch oder per
                    WhatsApp entgegen. So können wir Ihre Wunschprodukte für Sie
                    reservieren.
                  </Typography>
                  <Link
                    href="/bestellen"
                    underline="hover"
                    sx={{
                      display: 'inline-block',
                      mt: 1.5,
                      fontWeight: 600,
                      color: 'primary.main',
                    }}
                  >
                    Zur Bestellseite
                  </Link>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ textAlign: 'center' }}>
                  <ScheduleIcon
                    sx={{ fontSize: 40, color: 'primary.main', mb: 2 }}
                  />
                  <Typography variant="h6" gutterBottom>
                    Früh aufstehen lohnt sich
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Schon ab {getEarliestOpeningTime()} Uhr morgens haben wir
                    frische Backwaren für Sie bereit. Kommen Sie früh für die
                    beste Auswahl!
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Container>
        </Box>
      </Container>
    </>
  )
}
