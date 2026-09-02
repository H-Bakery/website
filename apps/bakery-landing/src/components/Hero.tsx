import { Box, Container, Typography } from '@mui/material'
import React from 'react'
import Divider from './icons/brand/Divider'

interface Props {
  title: string
}

const Hero: React.FC<Props> = (props) => {
  const { title } = props

  return (
    <Box
      sx={{
        // Den Platz des fixierten Headers reserviert der Header selbst
        // (HEADER_SPACE); hier nur noch der Abstand zum Titel
        pt: { xs: 6, md: 7 },
        pb: 3,
      }}
    >
      <Container
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',

          '& svg': {
            maxWidth: '80vw',
          },
        }}
      >
        <Typography
          variant="h3"
          component="h1"
          textAlign="center"
          sx={{
            fontSize: { xs: '8vw', md: '3rem' },
            mb: 2,
          }}
        >
          {title}
        </Typography>
        <Divider />
      </Container>
    </Box>
  )
}

export default Hero
