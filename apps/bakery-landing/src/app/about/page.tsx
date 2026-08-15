import React from 'react'
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Breadcrumbs,
  Link,
} from '@mui/material'
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab'
import {
  CheckCircle as CheckIcon,
  Grain as GrainIcon,
  Nature as NatureIcon,
  People as PeopleIcon,
  Home as HomeIcon,
  Info as InfoIcon,
} from '@mui/icons-material'
import Hero from '../../components/Hero'
import { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: { canonical: '/about' },
  title: 'Über uns - Bäckerei Heusser',
  description:
    'Erfahren Sie mehr über unsere Bäckerei-Familie und über 90 Jahre Tradition und Handwerkskunst seit 1933.',
  keywords: 'Über uns, Geschichte, Familie, Tradition, Handwerk, Bäckerei',
}

const historyTimeline = [
  {
    year: '1933',
    title: 'Gründung der Bäckerei',
    description:
      'Heinrich Heusser gründet die Bäckerei in Kirrberg und setzt von Anfang an auf traditionelle Rezepte und hochwertige Zutaten.',
  },
  {
    year: '1968',
    title: 'Übernahme durch die zweite Generation',
    description:
      'Heinrich "Heiner" Heusser übernimmt mit seiner Frau Hildegard den Familienbetrieb und baut das Sortiment kontinuierlich aus.',
  },
  {
    year: '1985',
    title: 'Ausbau der Backstube',
    description:
      'Die Backstube wird modernisiert und erweitert, um der steigenden Nachfrage gerecht zu werden, ohne dabei Kompromisse bei der Qualität einzugehen.',
  },
  {
    year: '2000',
    title: 'Renovierung des Verkaufsraums',
    description:
      'Der Verkaufsraum wird renoviert und neu gestaltet, um den Kunden ein noch angenehmeres Einkaufserlebnis zu bieten.',
  },
  {
    year: '2022',
    title: 'Übergang zur dritten Generation',
    description:
      'Karl-Heinrich Heusser übernimmt die Bäckerei in dritter Generation und führt die Familientradition mit neuen Ideen und bewährter Qualität fort.',
  },
  {
    year: 'Heute',
    title: 'Tradition bewahren, Zukunft gestalten',
    description:
      'Wir setzen weiterhin auf traditionelles Handwerk und regionale Zutaten, während wir behutsam neue Wege gehen, um unsere Backkunst zukunftsfähig zu halten.',
  },
]

export default function AboutPage() {
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
              <InfoIcon sx={{ mr: 0.5 }} fontSize="small" />
              Über uns
            </Box>
          </Breadcrumbs>
        </Box>
      </Container>

      {/* Hero Section */}
      <Hero title="Über uns" />

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography
          variant="h5"
          component="p"
          color="text.secondary"
          sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center', mb: 6 }}
        >
          Über 90 Jahre Bäckerhandwerk und Familientradition
        </Typography>

        {/* Main Story */}
        <Grid container spacing={8} sx={{ mb: 6 }}>
          <Grid item xs={12} md={6}>
            <Box
              component="img"
              src="/assets/images/bakery/1933.jpg"
              alt="Historisches Bäckerei Foto von 1933"
              loading="lazy"
              decoding="async"
              sx={{
                width: '100%',
                height: 300,
                objectFit: 'cover',
                borderRadius: 2,
              }}
            />
          </Grid>
          <Grid
            item
            xs={12}
            md={6}
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <Box>
              <Typography variant="h3" component="h2" gutterBottom>
                Familienbetrieb seit 1933
              </Typography>
              <Typography variant="body1" paragraph>
                Seit nun über neun Jahrzehnten backen wir Backwaren mit höchster
                Qualität und Leidenschaft für das wahre Handwerk. Alles begann
                1933, als Bäckermeister Heinrich Heusser unsere kleine, aber
                feine Bäckerei in Kirrberg eröffnete.
              </Typography>
              <Typography variant="body1" paragraph>
                Sein Sohn, Heinrich "Heiner" Heusser, ebenfalls Bäckermeister
                mit Leib und Seele, übernahm früh das Familienunternehmen und
                führte es gemeinsam mit seiner Frau Hildegard bis 2022 zu einem
                festen Bestandteil des Dorflebens.
              </Typography>
              <Typography variant="body1">
                Seit 2022 setzt Karl-Heinrich Heusser diese wertvolle Tradition
                in dritter Generation fort – mit dem gleichen Gespür für
                Qualität und dem Versprechen, Tag für Tag frische,
                handgefertigte Backwaren anzubieten, die von Herzen kommen und
                Herzen erobern.
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Current Operations */}
        <Box
          sx={{
            bgcolor: 'grey.100',
            py: 6,
            mx: { xs: -2, sm: -3 },
            mb: 6,
          }}
        >
          <Container maxWidth="lg">
            <Grid container spacing={8}>
              <Grid
                item
                xs={12}
                md={6}
                sx={{ display: 'flex', alignItems: 'center' }}
              >
                <Box>
                  <Typography variant="h3" component="h2" gutterBottom>
                    Für Sie vor Ort
                  </Typography>
                  <Typography variant="body1" paragraph>
                    In unserem gemütlichen Laden direkt neben der Backstube
                    erwarten wir Sie mit frischen Backwaren, die wir mit Liebe
                    für Sie zubereiten. Ganz nach dem traditionellen "Tante Emma
                    Laden" Prinzip finden Sie bei uns alles rund um Brot und
                    Brötchen sowie ausgewählte regionale Spezialitäten.
                  </Typography>
                  <Typography variant="body1">
                    Wir freuen uns auf den persönlichen Kontakt mit Ihnen und
                    möchten, dass Sie sich bei uns in einer herzlichen,
                    familiären Atmosphäre rundum wohlfühlen. Kommen Sie vorbei -
                    wir heißen Sie herzlich willkommen!
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box
                  component="img"
                  src="/assets/images/bakery/neu_theke3.jpeg"
                  alt="Unser gemütlicher Verkaufsraum"
                  loading="lazy"
                  decoding="async"
                  sx={{
                    width: '100%',
                    height: 300,
                    objectFit: 'cover',
                    borderRadius: 2,
                  }}
                />
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* Vision and Mission */}
        <Grid container spacing={4} sx={{ mb: 6 }}>
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 4, height: '100%' }}>
              <Typography
                variant="h5"
                component="h3"
                gutterBottom
                align="center"
              >
                Unsere Vision
              </Typography>
              <Typography variant="body1" paragraph>
                Wir streben danach, die führende handwerkliche Bäckerei der
                Region zu sein, die für ihre herausragende Qualität, Tradition
                und Innovation bekannt ist.
              </Typography>
              <Typography variant="body1" paragraph>
                In einer Zeit der industriellen Massenproduktion wollen wir
                zeigen, dass traditionelles Bäckerhandwerk nicht nur
                überlebensfähig ist, sondern auch eine entscheidende Rolle für
                eine nachhaltige und gesunde Ernährungskultur spielt.
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Handwerk bewahren"
                    secondary="Traditionelle Backtechniken für kommende Generationen erhalten"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Regionales Bewusstsein fördern"
                    secondary="Die Bedeutung kurzer Lieferketten und lokaler Produkte betonen"
                  />
                </ListItem>
              </List>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 4, height: '100%' }}>
              <Typography
                variant="h5"
                component="h3"
                gutterBottom
                align="center"
              >
                Unsere Mission
              </Typography>
              <Typography variant="body1" paragraph>
                Wir verpflichten uns, jeden Tag hochwertige, handwerklich
                gefertigte Backwaren herzustellen, die nicht nur den Gaumen
                erfreuen, sondern auch eine gesunde Ernährung fördern.
              </Typography>
              <Typography variant="body1" paragraph>
                Durch die sorgfältige Auswahl regionaler Zutaten und den Einsatz
                traditioneller Methoden schaffen wir Produkte mit authentischem
                Geschmack und charakteristischer Qualität.
              </Typography>
              <Typography variant="body1">
                Unser Laden ist mehr als nur eine Bäckerei – er ist ein Ort der
                Gemeinschaft, an dem Menschen zusammenkommen und die einfachen
                Freuden des Lebens teilen können.
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      {/* Core Values */}
      <Box sx={{ bgcolor: 'grey.50', py: 6, mb: 6 }}>
        {' '}
        {/* Warm cream */}
        <Container maxWidth="lg">
          <Typography variant="h3" component="h2" align="center" gutterBottom>
            Unsere Werte
          </Typography>
          <Typography
            variant="body1"
            align="center"
            color="text.secondary"
            paragraph
            sx={{ mb: 5 }}
          >
            Diese Grundsätze leiten unser tägliches Handeln
          </Typography>

          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', textAlign: 'center', p: 3 }}>
                <GrainIcon
                  sx={{ fontSize: 60, color: 'primary.main', mb: 2 }}
                />
                <Typography variant="h6" gutterBottom>
                  Qualität
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Wir verwenden nur die besten Zutaten und traditionelle
                  Backverfahren für ein unvergleichliches Geschmackserlebnis.
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', textAlign: 'center', p: 3 }}>
                <NatureIcon
                  sx={{ fontSize: 60, color: 'primary.main', mb: 2 }}
                />
                <Typography variant="h6" gutterBottom>
                  Nachhaltigkeit
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Wir legen Wert auf regionale Herkunft und umweltbewusste
                  Herstellungsprozesse.
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', textAlign: 'center', p: 3 }}>
                <PeopleIcon
                  sx={{ fontSize: 60, color: 'primary.main', mb: 2 }}
                />
                <Typography variant="h6" gutterBottom>
                  Gemeinschaft
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Unsere Bäckerei ist ein Ort der Begegnung, an dem wir Menschen
                  zusammenbringen und lokale Traditionen pflegen.
                </Typography>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* History Timeline */}
      <Container maxWidth="md" sx={{ mb: 6 }}>
        <Typography variant="h3" component="h2" align="center" gutterBottom>
          Unsere Geschichte
        </Typography>
        <Typography
          variant="body1"
          align="center"
          color="text.secondary"
          paragraph
          sx={{ mb: 5 }}
        >
          Über 90 Jahre Bäckerhandwerk und Familientradition in Kirrberg.
        </Typography>

        <Timeline position="alternate" sx={{ p: 0 }}>
          {historyTimeline.map((event, index) => (
            <TimelineItem key={event.year}>
              <TimelineOppositeContent sx={{ m: 'auto 0', p: 2 }}>
                <Typography variant="h6" color="primary.main" fontWeight="bold">
                  {event.year}
                </Typography>
              </TimelineOppositeContent>
              <TimelineSeparator>
                <TimelineDot
                  color="primary"
                  variant={
                    index === historyTimeline.length - 1 ? 'filled' : 'outlined'
                  }
                />
                {index < historyTimeline.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              <TimelineContent sx={{ py: 2 }}>
                <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="h6" component="h3" gutterBottom>
                    {event.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {event.description}
                  </Typography>
                </Paper>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </Container>

      {/* Team */}
      <Container maxWidth="lg">
        <Typography variant="h3" component="h2" align="center" gutterBottom>
          Unser Team
        </Typography>
        <Typography
          variant="body1"
          align="center"
          color="text.secondary"
          paragraph
          sx={{ mb: 5 }}
        >
          Die Menschen hinter unseren köstlichen Backwaren
        </Typography>

        <Grid container spacing={4} sx={{ mb: 6 }}>
          {[
            {
              name: 'Karl Heinrich Heusser',
              role: 'Geschäftsführer und Diplom Ingenieur',
              description:
                'Leitet den Betrieb mit technischem Know-how und Leidenschaft für die Bäckertradition.',
            },
            {
              name: 'Florian Hein',
              role: 'Backstubenleiter',
              description:
                'Verantwortlich für unsere hochwertigen Backwaren mit handwerklichem Geschick und Kreativität.',
            },
            {
              name: 'Daniela Fricke',
              role: 'Bäckereifachverkäuferin',
              description:
                'Sorgt mit ihrer Expertise für eine kompetente Beratung und herzlichen Service am Verkaufstresen.',
            },
          ].map((member, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Card sx={{ height: '100%', textAlign: 'center', p: 3 }}>
                <Box
                  sx={{
                    width: 100,
                    height: 100,
                    bgcolor: 'grey.300',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <Typography variant="h4" color="text.secondary">
                    {member.name.charAt(0)}
                  </Typography>
                </Box>
                <Typography variant="h6" gutterBottom>
                  {member.name}
                </Typography>
                <Typography
                  variant="subtitle2"
                  color="primary.main"
                  gutterBottom
                >
                  {member.role}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {member.description}
                </Typography>
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
              Besuchen Sie uns
            </Typography>
            <Typography variant="h6" paragraph>
              Erleben Sie selbst die Qualität und Leidenschaft, die in jedem
              unserer Backwaren steckt
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
                href="/contact"
              >
                Kontakt aufnehmen
              </Button>
              <Button
                variant="contained"
                size="large"
                sx={{ bgcolor: 'white', color: 'primary.main' }}
                href="/products"
              >
                Unser Angebot entdecken
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>
    </>
  )
}
