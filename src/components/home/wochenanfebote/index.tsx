import React from 'react'
import { Box, Container, Grid, Typography } from '@mui/material'
import Card from './Card'

const Wochenangebote = () => {
  const ANGEBOTE = [
    {
      name: 'Dienstag',
      date: '09.04.',
      text: 'Brot des Tages: Haferbrot.',
    },
    {
      name: 'Mittwoch',
      date: '10.04.',
      text: 'Schnittentag: jede Schnitte 1,50 Euro. Ab 11 Uhr, Brötchen mit Schnitzel.',
    },
    {
      name: 'Donnerstag',
      date: '11.04.',
      text: 'Mittagstisch: Ab 11 Uhr, Pizza und Flammkuchen.',
    },
    {
      name: 'Freitag',
      date: '12.04.',
      text: 'Mittagstisch: Ab 11 Uhr, Kerschdcher mit Eiersalat.',
    },
    {
      name: 'Samstag',
      date: '13.04.',
      text: 'Hefezöpfe und gefüllte Kranzkuchen',
    },
    ,
    {
      name: 'Sonntag',
      date: '14.04.',
      text: 'Frische Brötchen und Kaffeestückchen zum Sonntag.',
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
