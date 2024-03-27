'use client'
import React from 'react'
import { Box, Container, Grid, Typography } from '@mui/material'
import Base from '../../layouts/Base'
import Hero from '../../components/Hero'

const sections = [
  {
    image: '/assets/images/bakery/1933.png',
    title: 'Familienbetrieb seit 1933',
    description:
      'Seit nun fast einem Jahrhundert backen wir Backwaren mit höchster Qualität. Der Bäckermeister Heinrich Heusser eröffnete im Jahr 1933 die kleine, aber feine Bäckerei in Kirrberg, um die Bewohner in einer schweren Zeit mit frischem Brot und leckeren Backwaren zu versorgen. Heute ist der Betrieb in der vierten Generation.',
  },
  {
    image: '/assets/images/bakery/neu_theke3.jpeg',
    title: 'Liebe zu Local',
    description:
      'In dem Laden direkt neben der Backstube verkaufen wir unsere frischen Backwaren liebevoll an unsere Kunden. Nach dem "Tante Emma Laden" Prinzip bieten wir alles rund um Brot und Brötchen an, sowie regionale Produkte wie Eier, Honig oder Nudeln.',
  },
]

const About: React.FC = () => (
  <Base>
    <Hero title="Über Uns" />
    <Container maxWidth="md">
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
              <Typography variant="h4">{item.title}</Typography>
              <Typography color="text.secondary">{item.description}</Typography>
            </Grid>
          </Grid>
        ))}
      </Grid>
    </Container>
  </Base>
)

const styles = {
  column: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: '8px',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    boxShadow: 1,
  },
}

export default About
