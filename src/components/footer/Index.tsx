import React from 'react'
import { useRouter } from 'next/navigation'
import { Box, Container, Grid, Typography } from '@mui/material'

import Wappen from '../icons/brand/Wappen'
import Heusser from '../icons/brand/Heusser'
import Menu from './Menu'
import Contact from './Contact'
import Openings from './Openings'
import Link from './Link'
import Socials from '../Socials'

const Footer: React.FC = () => {
  const router = useRouter()

  return (
    <Box sx={styles.root}>
      <Container>
        <Grid sx={styles.header} container spacing={4}>
          <Grid item xs={12} sm={6} md={3} sx={styles.about}>
            <Box>
              <Heusser />
              <Typography variant="body2" color="text.secondary" mb={2}>
                Wir backen mit Herz, nach Tradition und nur für euch.
              </Typography>
            </Box>
            <Socials />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Menu />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Contact />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Openings />
          </Grid>
        </Grid>
        <Box sx={styles.footer}>
          <Typography variant="body2" color="text.disabled">
            © Bäckerei Heusser 2024
          </Typography>
          <Box>
            <Link label="Impressum" path="/imprint" />
          </Box>
        </Box>
        <Box sx={styles.image}>
          <Wappen />
        </Box>
      </Container>
    </Box>
  )
}

const styles = {
  root: {
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    m: 2,
    mt: 6,
    p: 2,
    bgcolor: 'background.paper',
    boxShadow: 1,
    borderRadius: '8px',
  },
  header: {
    position: 'relative',
    display: 'flex',
    zIndex: 1,
  },
  about: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',

    '& svg': {
      maxHeight: 50,
      width: 'auto',
    },
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTop: '1px solid',
    borderColor: 'grey.300',
    pt: 2,
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0.05,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  },
}

export default Footer
