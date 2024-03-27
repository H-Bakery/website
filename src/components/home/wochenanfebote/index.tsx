import React from 'react'
import { Box, Container, Grid, Typography } from '@mui/material'
import Card from './Card'

const Wochenangebote = () => {
  const ANGEBOTE = [
    {
      name: 'Dienstag',
      date: '26.03.',
      text: 'Brot des Tages: Haferbrot.',
    },
    {
      name: 'Mittwoch',
      date: '27.03.',
      text: 'Schnittentag: jede Schnitte 1,50 Euro. Schnitzeltag.',
    },
    {
      name: 'Donnerstag',
      date: '28.03.',
      text: 'Mittagstisch: Ab 11 Uhr, Pizza und Flammkuchen.',
    },
    {
      name: 'Freitag',
      date: '29.03.',
      text: '(Karfreitag), Geänderte Öffnungszeigen: 8-14 Uhr. Ab 12 Uhr Tagliatelle mit Lachs in Krustentier-Sahnesoße.',
    },
    {
      name: 'Samstag',
      date: '30.03.',
      text: 'Hefezöpfe und gefüllte Kranzkuchen',
    },
    ,
    {
      name: 'Sonntag',
      date: '31.03.',
      text: '(Ostersonntag) Geschlossen. Wir wünschen Ihnen und Ihrere Familie ein schönes Osterfest!',
    },
  ]
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        py: 6,
      }}
    >
      <Container>
        <Typography sx={{ fontSize: { xs: '9vw' } }} variant="h3" gutterBottom>
          Wochenangebote
        </Typography>
        <Grid container spacing={4}>
          {ANGEBOTE.map((item) => (
            <Grid key={item?.name} item xs={12} md={4}>
              <Card {...item} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

export default Wochenangebote
