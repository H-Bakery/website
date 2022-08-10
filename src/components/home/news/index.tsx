import React from 'react'
import { Box, Button, Container, Grid, Typography } from '@mui/material'
import Card from './Card'
import { NEWS } from '../../../mocks/news'

const News: React.FC = () => {
  return (
    <Box sx={{ py: 6 }}>
      <Container>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4
        }}>
          <Typography variant='h3'>
            Neuigkeiten
          </Typography>  
          <Button variant='contained'>Alle entdecken</Button>
        </Box>
        <Grid container spacing={4}>
          {NEWS.map((item) => (
            <Grid key={item.id} item xs={3}>
              <Card {...item} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box> 
  )
}

export default News