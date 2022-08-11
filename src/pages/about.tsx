import React from 'react'
import { Box, Container, Grid, Typography } from "@mui/material"
import Base from "../layout/Base"
import Hero from "../components/Hero"

const sections = [
  {
    image: 'https://images.pexels.com/photos/5272995/pexels-photo-5272995.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    title: 'Eine Geschichte',
    description: 'Weit hinten, hinter den Wortbergen, fern der Länder Vokalien und Konsonantien leben die Blindtexte. Abgeschieden wohnen sie in Buchstabhausen an der Küste des Semantik, eines großen Sprachozeans. Ein kleines Bächlein namens Duden fließt durch ihren Ort und versorgt sie mit den nötigen Regelialien. Es ist ein paradiesmatisches Land, in dem einem gebratene Satzteile in den Mund fliegen. '
  },
  {
    image: 'https://images.pexels.com/photos/2350366/pexels-photo-2350366.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    title: 'Und eine Anektode',
    description: 'Weit hinten, hinter den Wortbergen, fern der Länder Vokalien und Konsonantien leben die Blindtexte. Abgeschieden wohnen sie in Buchstabhausen an der Küste des Semantik, eines großen Sprachozeans. Ein kleines Bächlein namens Duden fließt durch ihren Ort und versorgt sie mit den nötigen Regelialien. Es ist ein paradiesmatisches Land, in dem einem gebratene Satzteile in den Mund fliegen. '
  },
]

const About: React.FC = () => (
  <Base>
    <Hero title="Über Uns" />
    <Container maxWidth='md'>
      <Grid container spacing={8}>
        {sections.map((item, index) => (
          <Grid
            key={item.title}
            item
            xs={12}
            container
            spacing={4}
            sx={{
              flexDirection: index % 2 ? 'row-reverse' : 'row'
            }}
          >
            <Grid item xs={12} sm={6} sx={styles.column}>
              <Box sx={{
                ...styles.image,
                backgroundImage: `url(${item.image})`
              }} />
            </Grid>
            <Grid item xs={12} sm={6} sx={styles.column}>
              <Typography variant='h4'>
                {item.title}
              </Typography>
              <Typography color='text.secondary'>
                {item.description}
              </Typography>
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
    justifyContent: 'center'
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: '8px',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    boxShadow: 1
  },
}

export default About
