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

import { ANGEBOTE } from './offers'

const Wochenangebote = () => {
  // Properly typed data with explicit type annotations

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
            Unsere Wochenangebote
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
            Entdecken Sie unsere täglichen Spezialitäten - von knusprigen Broten
            über herzhafte Mittagsgerichte bis hin zu süßen Leckereien. Jeder
            Tag bringt neue Geschmackserlebnisse!
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
            Die Angebote können nach Verfügbarkeit variieren. Bitte fragen Sie
            bei Interesse nach.
          </Typography>
          <Button variant="outlined" color="primary" href="/products">
            Unser komplettes Sortiment entdecken
          </Button>
        </Box>
      </Container>
    </Box>
  )
}

export default Wochenangebote
