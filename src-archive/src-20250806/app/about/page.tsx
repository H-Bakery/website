'use client'
import React from 'react'
import {
  Box,
  Container,
  Grid,
  Typography,
  Paper,
  Divider,
  Card,
  CardContent,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material'

// Import Timeline components from @mui/lab instead
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab'
import Base from '../../layouts/Base'
import Hero from '../../components/Hero'
import CallToAction from '../../components/CallToAction'
import GrainIcon from '@mui/icons-material/Grain'
import PeopleIcon from '@mui/icons-material/People'
import NatureIcon from '@mui/icons-material/Nature'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import LocalPhoneIcon from '@mui/icons-material/LocalPhone'
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk'

// Main sections of content
const sections = [
  {
    image: '/assets/images/bakery/1933.png',
    title: 'Familienbetrieb seit 1933',
    description:
      'Seit nun fast einem Jahrhundert backen wir Backwaren mit höchster Qualität und Leidenschaft für das wahre Handwerk. Alles begann 1933, als Bäckermeister Heinrich Heusser unsere kleine, aber feine Bäckerei in Kirrberg eröffnete. Sein Sohn, Heinrich "Heiner" Heusser, ebenfalls Bäckermeister mit Leib und Seele, übernahm früh das Familienunternehmen und führte es gemeinsam mit seiner Frau Hildegard bis 2022 zu einem festen Bestandteil des Dorflebens. Die persönliche Verbindung zu unseren Kunden und dem Dorf stand dabei immer im Mittelpunkt. Seit 2022 setzt Karl-Heinrich Heusser diese wertvolle Tradition in dritter Generation fort – mit dem gleichen Gespür für Qualität und dem Versprechen, Tag für Tag frische, handgefertigte Backwaren anzubieten, die von Herzen kommen und Herzen erobern.',
  },
  {
    image: '/assets/images/bakery/neu_theke3.jpeg',
    title: 'Für Sie vor Ort',
    description:
      'In unserem gemütlichen Laden direkt neben der Backstube erwarten wir Sie mit frischen Backwaren, die wir mit Liebe für Sie zubereiten. Ganz nach dem traditionellen "Tante Emma Laden" Prinzip finden Sie bei uns alles rund um Brot und Brötchen sowie ausgewählte regionale Spezialitäten wie Eier, Honig oder Nudeln. Wir freuen uns auf den persönlichen Kontakt mit Ihnen und möchten, dass Sie sich bei uns in einer herzlichen, familiären Atmosphäre rundum wohlfühlen. Kommen Sie vorbei - wir heißen Sie herzlich willkommen!',
  },
]

// Timeline history events
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

// Core values
const coreValues = [
  {
    icon: <GrainIcon color="primary" fontSize="large" />,
    title: 'Qualität',
    description:
      'Wir verwenden nur die besten Zutaten und traditionelle Backverfahren für ein unvergleichliches Geschmackserlebnis.',
  },
  {
    icon: <NatureIcon color="primary" fontSize="large" />,
    title: 'Nachhaltigkeit',
    description:
      'Wir legen Wert auf regionale Herkunft und umweltbewusste Herstellungsprozesse.',
  },
  {
    icon: <PeopleIcon color="primary" fontSize="large" />,
    title: 'Gemeinschaft',
    description:
      'Unsere Bäckerei ist ein Ort der Begegnung, an dem wir Menschen zusammenbringen und lokale Traditionen pflegen.',
  },
]

// Team members data
const teamMembers = [
  {
    name: 'Karl Heinrich Heusser',
    role: 'Geschäftsführer und Diplom Ingenieur',
    image: '/assets/images/team/karl.jpg',
    description:
      'Leitet den Betrieb mit technischem Know-how und Leidenschaft für die Bäckertradition.',
  },
  {
    name: 'Florian Hein',
    role: 'Backstubenleiter',
    image: '/assets/images/team/florian.jpg',
    description:
      'Verantwortlich für unsere hochwertigen Backwaren mit handwerklichem Geschick und Kreativität.',
  },
  {
    name: 'Daniela Fricke',
    role: 'Bäckereifachverkäuferin',
    image: '/assets/images/team/daniela.jpg',
    description:
      'Sorgt mit ihrer Expertise für eine kompetente Beratung und herzlichen Service am Verkaufstresen.',
  },
]

const About: React.FC = () => (
  <Base>
    <Hero title="Über Uns" />

    {/* Main Intro Sections */}
    <Container maxWidth="md" sx={{ mb: 8 }}>
      <Grid container spacing={8}>
        {sections.map((item, index) => (
          <Grid
            key={item.title}
            item
            xs={12}
            container
            spacing={4}
            sx={{
              flexDirection: index % 2 ? 'row-reverse' : 'row',
            }}
          >
            <Grid item xs={12} sm={6} sx={styles.column}>
              <Box
                sx={{
                  ...styles.image,
                  backgroundImage: `url(${item.image})`,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} sx={styles.column}>
              <Typography variant="h4" gutterBottom>
                {item.title}
              </Typography>
              <Typography color="text.secondary" paragraph>
                {item.description}
              </Typography>
            </Grid>
          </Grid>
        ))}
      </Grid>
    </Container>

    {/* Vision and Mission Section */}
    <Box sx={{ bgcolor: 'background.default', py: 8 }}>
      <Container maxWidth="md">
        <Grid container spacing={4}>
          {/* Vision */}
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={styles.visionMissionCard}>
              <Box sx={styles.cardHeader}>
                <Typography
                  variant="h5"
                  fontWeight="bold"
                  gutterBottom
                  align="center"
                >
                  Unsere Vision
                </Typography>
              </Box>
              <Divider />
              <Box sx={{ p: 3 }}>
                <Typography variant="body1" paragraph>
                  Wir streben danach, die führende handwerkliche Bäckerei der
                  Region zu sein, die für ihre herausragende Qualität, Tradition
                  und Innovation bekannt ist.
                </Typography>
                <Typography variant="body1">
                  In einer Zeit der industriellen Massenproduktion wollen wir
                  zeigen, dass traditionelles Bäckerhandwerk nicht nur
                  überlebensfähig ist, sondern auch eine entscheidende Rolle für
                  eine nachhaltige und gesunde Ernährungskultur spielt.
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircleOutlineIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Handwerk bewahren"
                      secondary="Traditionelle Backtechniken für kommende Generationen erhalten"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircleOutlineIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Regionales Bewusstsein fördern"
                      secondary="Die Bedeutung kurzer Lieferketten und lokaler Produkte betonen"
                    />
                  </ListItem>
                </List>
              </Box>
            </Paper>
          </Grid>

          {/* Mission */}
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={styles.visionMissionCard}>
              <Box sx={styles.cardHeader}>
                <Typography
                  variant="h5"
                  fontWeight="bold"
                  gutterBottom
                  align="center"
                >
                  Unsere Mission
                </Typography>
              </Box>
              <Divider />
              <Box sx={{ p: 3 }}>
                <Typography variant="body1" paragraph>
                  Wir verpflichten uns, jeden Tag hochwertige, handwerklich
                  gefertigte Backwaren herzustellen, die nicht nur den Gaumen
                  erfreuen, sondern auch eine gesunde Ernährung fördern.
                </Typography>
                <Typography variant="body1" paragraph>
                  Durch die sorgfältige Auswahl regionaler Zutaten und den
                  Einsatz traditioneller Methoden schaffen wir Produkte mit
                  authentischem Geschmack und charakteristischer Qualität.
                </Typography>
                <Typography variant="body1">
                  Unser Laden ist mehr als nur eine Bäckerei – er ist ein Ort
                  der Gemeinschaft, an dem Menschen zusammenkommen und die
                  einfachen Freuden des Lebens teilen können.
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>

    {/* Core Values */}
    <Container maxWidth="md" sx={{ mt: 8, mb: 8 }}>
      <Typography variant="h4" align="center" gutterBottom>
        Unsere Werte
      </Typography>
      <Typography
        variant="body1"
        align="center"
        color="text.secondary"
        paragraph
        sx={{ mb: 5 }}
      >
        Diese Grundsätze leiten unser tägliches Handeln und definieren, wofür
        wir stehen.
      </Typography>

      <Grid container spacing={4}>
        {coreValues.map((value) => (
          <Grid item xs={12} md={4} key={value.title}>
            <Box sx={styles.valueCard}>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                {value.icon}
              </Box>
              <Typography variant="h6" align="center" gutterBottom>
                {value.title}
              </Typography>
              <Typography variant="body2" align="center" color="text.secondary">
                {value.description}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Container>

    {/* Our Story Timeline */}
    <Box sx={{ bgcolor: 'background.default', py: 8 }}>
      <Container maxWidth="md">
        <Typography variant="h4" align="center" gutterBottom>
          Unsere Geschichte
        </Typography>
        <Typography
          variant="body1"
          align="center"
          color="text.secondary"
          paragraph
          sx={{ mb: 5 }}
        >
          Fast 90 Jahre Bäckerhandwerk und Familientradition in Kirrberg.
        </Typography>

        <Timeline position="alternate" sx={styles.timeline}>
          {historyTimeline.map((event, index) => (
            <TimelineItem key={event.year}>
              <TimelineOppositeContent sx={styles.timelineYear}>
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
              <TimelineContent sx={styles.timelineContent}>
                <Paper elevation={2} sx={styles.timelineCard}>
                  <Typography variant="h6" component="h3">
                    {event.title}
                  </Typography>
                  <Typography color="text.secondary">
                    {event.description}
                  </Typography>
                </Paper>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </Container>
    </Box>

    {/* Team Section */}
    <Container maxWidth="md" sx={{ mt: 8, mb: 8 }}>
      <Typography variant="h4" align="center" gutterBottom>
        Unser Team
      </Typography>
      <Typography
        variant="body1"
        align="center"
        color="text.secondary"
        paragraph
        sx={{ mb: 5 }}
      >
        Die Menschen hinter unseren köstlichen Backwaren.
      </Typography>

      <Grid container spacing={4}>
        {teamMembers.map((member) => (
          <Grid item xs={12} sm={6} md={4} key={member.name}>
            <Card sx={styles.teamCard}>
              <Avatar
                src={member.image}
                alt={member.name}
                sx={styles.teamAvatar}
              >
                {!member.image && member.name.charAt(0)}
              </Avatar>
              <CardContent>
                <Typography variant="h6" align="center" gutterBottom>
                  {member.name}
                </Typography>
                <Typography
                  variant="subtitle2"
                  align="center"
                  color="primary.main"
                  gutterBottom
                >
                  {member.role}
                </Typography>
                <Typography
                  variant="body2"
                  align="center"
                  color="text.secondary"
                >
                  {member.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>

    {/* CTA Section */}
    <CallToAction
      title="Besuchen Sie uns"
      subtitle="Unser Laden ist immer offen für Sie."
      description="Erleben Sie selbst die Qualität und Leidenschaft, die in jedem unserer Backwaren steckt."
      primaryAction={{
        label: 'Kontakt aufnehmen',
        icon: <LocalPhoneIcon />,
        href: '/kontakt',
      }}
      secondaryAction={{
        label: 'Unser Angebot entdecken',
        icon: <DirectionsWalkIcon />,
        href: '/produkte',
      }}
    />
  </Base>
)

// Styles for the component
const styles = {
  column: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: 300,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    borderRadius: 2,
  },
  visionMissionCard: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 2,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 3,
    backgroundColor: 'background.paper',
  },
  valueCard: {
    p: 3,
    textAlign: 'center',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  timeline: {
    '& .MuiTimelineItem-root:before': {
      flex: 0,
      padding: 0,
    },
  },
  timelineYear: {
    m: 'auto 0',
    p: 2,
  },
  timelineContent: {
    py: 2,
  },
  timelineCard: {
    p: 2,
    borderRadius: 2,
  },
  teamCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%',
    pt: 4,
    borderRadius: 2,
  },
  teamAvatar: {
    width: 100,
    height: 100,
    mb: 2,
  },
}

export default About
