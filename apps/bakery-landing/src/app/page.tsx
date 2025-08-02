'use client'
import React from 'react'
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  AppBar,
  Toolbar,
  Menu,
  MenuItem,
  IconButton,
  useMediaQuery,
  useTheme as useMuiTheme,
} from '@mui/material'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import {
  ShoppingBasket as ShopIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Schedule as ScheduleIcon,
  Star as StarIcon,
  Menu as MenuIcon,
  Home as HomeIcon,
} from '@mui/icons-material'
import { LANDING_NAVIGATION } from '@bakery/shared/utils'

// Simple theme for landing page
const theme = createTheme({
  palette: {
    primary: {
      main: '#D038BA',
    },
    secondary: {
      main: '#2E7D32',
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
    h3: {
      fontFamily: '"Playfair Display", serif',
      fontWeight: 600,
    },
  },
})

export default function LandingPage() {
  const muiTheme = useMuiTheme()
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'))
  const [mobileMenuAnchor, setMobileMenuAnchor] =
    React.useState<null | HTMLElement>(null)

  const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMenuAnchor(event.currentTarget)
  }

  const handleMobileMenuClose = () => {
    setMobileMenuAnchor(null)
  }

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* Header with Navigation */}
        <AppBar position="static" sx={{ bgcolor: 'primary.main' }}>
          <Container maxWidth="lg">
            <Toolbar>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <HomeIcon sx={{ mr: 1 }} />
                <Typography
                  variant="h6"
                  component="h1"
                  sx={{ fontWeight: 'bold' }}
                >
                  Bäckerei Heusser
                </Typography>
              </Box>

              <Box sx={{ flexGrow: 1 }} />

              {/* Desktop Navigation */}
              {!isMobile && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {LANDING_NAVIGATION.map((item) => (
                    <Button
                      key={item.href}
                      color="inherit"
                      href={item.href}
                      target={item.external ? '_blank' : undefined}
                      rel={item.external ? 'noopener noreferrer' : undefined}
                      sx={{ textTransform: 'none' }}
                    >
                      {item.label}
                    </Button>
                  ))}
                  <Button
                    variant="outlined"
                    sx={{ color: 'white', borderColor: 'white', ml: 2 }}
                    startIcon={<PhoneIcon />}
                    href="tel:068412229"
                  >
                    06841 2229
                  </Button>
                </Box>
              )}

              {/* Mobile Menu */}
              {isMobile && (
                <>
                  <IconButton
                    color="inherit"
                    onClick={handleMobileMenuOpen}
                    edge="end"
                  >
                    <MenuIcon />
                  </IconButton>
                  <Menu
                    anchorEl={mobileMenuAnchor}
                    open={Boolean(mobileMenuAnchor)}
                    onClose={handleMobileMenuClose}
                    anchorOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                  >
                    {LANDING_NAVIGATION.map((item) => (
                      <MenuItem
                        key={item.href}
                        component="a"
                        href={item.href}
                        target={item.external ? '_blank' : undefined}
                        rel={item.external ? 'noopener noreferrer' : undefined}
                        onClick={handleMobileMenuClose}
                      >
                        {item.label}
                      </MenuItem>
                    ))}
                    <MenuItem
                      component="a"
                      href="tel:068412229"
                      onClick={handleMobileMenuClose}
                    >
                      📞 06841 2229
                    </MenuItem>
                  </Menu>
                </>
              )}
            </Toolbar>
          </Container>
        </AppBar>

        {/* Hero Section */}
        <Box sx={{ bgcolor: 'grey.50', py: 8 }}>
          <Container maxWidth="lg">
            <Box sx={{ textAlign: 'center', mb: 6 }}>
              <Typography
                variant="h1"
                component="h2"
                gutterBottom
                sx={{ fontSize: { xs: '2.5rem', md: '4rem' } }}
              >
                Traditionelle Handwerksbäckerei
              </Typography>
              <Typography
                variant="h5"
                color="text.secondary"
                paragraph
                sx={{ mb: 4 }}
              >
                Frische Backwaren aus traditioneller Handwerkskunst seit 1933
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<ShopIcon />}
                  href="https://shop.baeckerei-heusser.de"
                  sx={{ py: 1.5, px: 4 }}
                >
                  Online Shop besuchen
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<LocationIcon />}
                  href="#standort"
                  sx={{ py: 1.5, px: 4 }}
                >
                  Standort anzeigen
                </Button>
              </Box>
            </Box>
          </Container>
        </Box>

        {/* Quick Info Cards */}
        <Container maxWidth="lg" sx={{ py: 6 }}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', textAlign: 'center', p: 3 }}>
                <ScheduleIcon
                  sx={{ fontSize: 60, color: 'primary.main', mb: 2 }}
                />
                <Typography variant="h6" gutterBottom>
                  Öffnungszeiten
                </Typography>
                <Typography variant="body1">
                  Mo-Fr: 06:00-12:30
                  <br />
                  Sa: 06:00-12:00
                  <br />
                  So: Geschlossen
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', textAlign: 'center', p: 3 }}>
                <LocationIcon
                  sx={{ fontSize: 60, color: 'primary.main', mb: 2 }}
                />
                <Typography variant="h6" gutterBottom>
                  Standort
                </Typography>
                <Typography variant="body1">
                  Eckstraße 3<br />
                  66424 Homburg/Kirrberg
                  <br />
                  Saarland
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', textAlign: 'center', p: 3 }}>
                <StarIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Seit 1933
                </Typography>
                <Typography variant="body1">
                  Fast 90 Jahre
                  <br />
                  Bäckerhandwerk und
                  <br />
                  Familientradition
                </Typography>
              </Card>
            </Grid>
          </Grid>
        </Container>

        {/* About Section */}
        <Box sx={{ bgcolor: 'grey.50', py: 6 }}>
          <Container maxWidth="lg">
            <Grid container spacing={6} alignItems="center">
              <Grid item xs={12} md={6}>
                <Typography variant="h3" component="h2" gutterBottom>
                  Familienbetrieb seit 1933
                </Typography>
                <Typography variant="body1" paragraph>
                  Seit nun fast einem Jahrhundert backen wir Backwaren mit
                  höchster Qualität und Leidenschaft für das wahre Handwerk.
                  Alles begann 1933, als Bäckermeister Heinrich Heusser unsere
                  kleine, aber feine Bäckerei in Kirrberg eröffnete.
                </Typography>
                <Typography variant="body1" paragraph>
                  Seit 2022 setzt Karl-Heinrich Heusser diese wertvolle
                  Tradition in dritter Generation fort – mit dem gleichen Gespür
                  für Qualität und dem Versprechen, Tag für Tag frische,
                  handgefertigte Backwaren anzubieten.
                </Typography>
                <Button variant="contained" href="/about" sx={{ mt: 2 }}>
                  Mehr über uns erfahren
                </Button>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    width: '100%',
                    height: 300,
                    bgcolor: 'grey.300',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="h6" color="text.secondary">
                    Bäckerei Foto
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* Products Section */}
        <Container maxWidth="lg" sx={{ py: 6 }}>
          <Typography variant="h3" component="h2" align="center" gutterBottom>
            Unser Sortiment
          </Typography>
          <Typography
            variant="body1"
            align="center"
            color="text.secondary"
            paragraph
            sx={{ mb: 4 }}
          >
            Frisch gebacken, täglich für Sie
          </Typography>

          <Grid container spacing={4}>
            {[
              {
                name: 'Brot & Brötchen',
                description: 'Traditionelle Rezepte, täglich frisch gebacken',
              },
              {
                name: 'Kuchen & Gebäck',
                description: 'Süße Leckereien für jeden Anlass',
              },
              {
                name: 'Saisonale Spezialitäten',
                description: 'Besondere Backwaren je nach Jahreszeit',
              },
            ].map((product, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {product.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {product.description}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      href="https://shop.baeckerei-heusser.de/products"
                    >
                      Im Shop ansehen
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>

        {/* CTA Section */}
        <Box sx={{ bgcolor: 'primary.main', color: 'white', py: 6 }}>
          <Container maxWidth="lg">
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" component="h2" gutterBottom>
                Besuchen Sie uns heute!
              </Typography>
              <Typography variant="h6" paragraph>
                Erleben Sie selbst die Qualität und Leidenschaft unserer
                Backwaren
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  mt: 4,
                }}
              >
                <Button
                  variant="outlined"
                  size="large"
                  sx={{ color: 'white', borderColor: 'white' }}
                  startIcon={<PhoneIcon />}
                  href="tel:068412229"
                >
                  Anrufen: 06841 2229
                </Button>
                <Button
                  variant="contained"
                  size="large"
                  sx={{ bgcolor: 'white', color: 'primary.main' }}
                  startIcon={<ShopIcon />}
                  href="https://shop.baeckerei-heusser.de"
                >
                  Online bestellen
                </Button>
              </Box>
            </Box>
          </Container>
        </Box>

        {/* Contact Section */}
        <Box id="standort" sx={{ py: 6 }}>
          <Container maxWidth="lg">
            <Typography variant="h3" component="h2" align="center" gutterBottom>
              So finden Sie uns
            </Typography>
            <Grid container spacing={6}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 4 }}>
                  <Typography variant="h6" gutterBottom>
                    Kontakt & Anfahrt
                  </Typography>
                  <Typography variant="body1" paragraph>
                    <strong>Adresse:</strong>
                    <br />
                    Eckstraße 3<br />
                    66424 Homburg/Kirrberg
                    <br />
                    Saarland
                  </Typography>
                  <Typography variant="body1" paragraph>
                    <strong>Telefon:</strong> 06841 2229
                    <br />
                    <strong>E-Mail:</strong> info@baeckerei-heusser.de
                  </Typography>
                  <Typography variant="body1">
                    <strong>Öffnungszeiten:</strong>
                    <br />
                    Montag - Freitag: 06:00 - 12:30 Uhr
                    <br />
                    Samstag: 06:00 - 12:00 Uhr
                    <br />
                    Sonntag: Geschlossen
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    width: '100%',
                    height: 300,
                    bgcolor: 'grey.300',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="h6" color="text.secondary">
                    Standort Karte
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* Footer */}
        <Box
          component="footer"
          sx={{ bgcolor: 'grey.900', color: 'white', py: 4 }}
        >
          <Container maxWidth="lg">
            <Grid container spacing={4}>
              <Grid item xs={12} md={4}>
                <Typography variant="h6" gutterBottom>
                  Bäckerei Heusser
                </Typography>
                <Typography variant="body2">
                  Traditionelle Handwerksbäckerei seit 1933
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="h6" gutterBottom>
                  Kontakt
                </Typography>
                <Typography variant="body2">
                  Eckstraße 3<br />
                  66424 Homburg/Kirrberg
                  <br />
                  Tel: 06841 2229
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="h6" gutterBottom>
                  Links
                </Typography>
                <Typography variant="body2">
                  <Button color="inherit" href="/imprint" size="small">
                    Impressum
                  </Button>
                  <br />
                  <Button
                    color="inherit"
                    href="https://shop.baeckerei-heusser.de"
                    size="small"
                  >
                    Online Shop
                  </Button>
                </Typography>
              </Grid>
            </Grid>
            <Box
              sx={{
                mt: 4,
                pt: 4,
                borderTop: '1px solid #444',
                textAlign: 'center',
              }}
            >
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
