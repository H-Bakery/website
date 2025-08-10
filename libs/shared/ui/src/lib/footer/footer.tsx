'use client'

import React from 'react'
import { Box, Container, Grid, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import WappenIcon from '../icons/brand/wappen-icon'
import HeusserLogo from '../icons/brand/heusser-logo'
import { FooterMenu } from './footer-menu'
import { FooterContact } from './footer-contact'
import { FooterOpenings } from './footer-openings'
import { FooterLink } from './footer-link'
import { Socials } from './socials'

export const Footer: React.FC = () => {
  const theme = useTheme()

  return (
    <Box sx={styles.root}>
      <Container>
        <Grid sx={styles.header} container spacing={4}>
          <Grid item xs={12} sm={6} md={3} sx={styles.about}>
            <Box>
              <HeusserLogo color={theme.palette.primary.main} />
              <Typography variant="body2" color="text.secondary" mb={2}>
                Wir backen mit Herz, nach Tradition und nur für euch.
              </Typography>
            </Box>
            <Socials />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FooterMenu />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FooterContact />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FooterOpenings />
          </Grid>
        </Grid>
        <Box sx={styles.footer}>
          <Typography variant="body2" color="text.disabled">
            © Bäckerei Heusser 2025
          </Typography>
          <Box>
            <FooterLink label="Impressum" path="/imprint" />
          </Box>
          <Box>
            <FooterLink label="Admin" path="/admin" />
          </Box>
        </Box>
        <Box sx={styles.image}>
          <WappenIcon />
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