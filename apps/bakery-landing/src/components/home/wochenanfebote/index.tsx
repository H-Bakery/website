import React from 'react'
import {
  Box,
  Container,
  Grid,
  Typography,
  Button,
  Divider,
} from '@mui/material'
import Card, { DailyOffer } from './Card'

import { ANGEBOTE, BROTPLAN_GUELTIG_AB } from './offers'

const Brotplan = () => {
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        py: 6,
      }}
    >
      <Container>
        <Box
          sx={{
            mb: 5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Typography
            variant="h3"
            align="center"
            sx={{
              fontSize: { xs: '9vw', sm: '2.5rem' },
              fontWeight: 'bold',
              mb: 1,
            }}
          >
            Unser Brotplan
          </Typography>
          <Divider
            sx={{
              width: '80px',
              borderWidth: 2,
              borderColor: 'primary.main',
              mb: 2,
            }}
          />
          <Typography
            variant="subtitle1"
            align="center"
            color="text.secondary"
            sx={{ maxWidth: '800px' }}
          >
            Jeden Tag eine gute Auswahl an frisch gebackenen Brotspezialitäten –
            mit besten Zutaten und viel Handwerksqualität aus unserer Backstube.
            Gültig ab dem {BROTPLAN_GUELTIG_AB}.
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {ANGEBOTE.map((item) => (
            <Grid key={item.name} item xs={12} sm={6} md={4}>
              <Card {...item} />
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Natürlich. Regional. Handgemacht. – Die Auswahl kann nach
            Verfügbarkeit variieren. Bitte fragen Sie bei Interesse nach.
          </Typography>
          <Button variant="outlined" color="primary" href="/products">
            Unser komplettes Sortiment entdecken
          </Button>
        </Box>
      </Container>
    </Box>
  )
}

export default Brotplan
