import React from 'react'
import { Typography, Grid, Box } from '@mui/material'

import Weather from '../components/info/Weather'
import Calendar from '../components/info/Calendar'
import RSSFeed from '../components/info/RSSFeed'
import Products from '../components/info/Products'
import News from '../components/info/News'
import useDate from '../components/info/useDate'

import { featuredProducts } from '../mocks/products/featured'
import Image from 'next/image'
import Heusser from '../components/icons/brand/Heusser'
import Baeckerei from '../components/icons/brand/Baeckerei'
import Wappen from '../components/icons/brand/Wappen'

const Info: React.FC = () => {
  return (
    <Box sx={styles.root}>
      <Grid container sx={styles.outerContainer}>
        <Grid item md={3}>
          <Box sx={styles.brand}>
            <Box flex={1}>
              <Box sx={{ mb: 6 }}>
                <Typography variant="h4">{useDate().wish}</Typography>
                <Typography variant="h2">{useDate().time}</Typography>
              </Box>
              <Weather />
            </Box>
            <Box
              sx={{
                mt: 6,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Box flex={1}>
                <Typography variant="h4">Jetzt auch online!</Typography>
                <Typography sx={{ opacity: 0.66 }} fontSize={20}>
                  Du findest uns jetzt auch im Web unter{' '}
                  <strong>bäckerei-heusser.de</strong>
                </Typography>
              </Box>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/qr-home.png"
                alt="Logo Bäckerei Heusser"
                height={120}
                width={120}
                style={{ borderRadius: '12px' }}
              />
            </Box>
          </Box>
        </Grid>
        <Grid item md={9}>
          <Box
            sx={{
              p: 6,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                height: '50vh',
              }}
            >
              <Box
                sx={{
                  width: 'calc((100% - 96px) / 3)',
                }}
              >
                <News header="Neuigkeiten" />
              </Box>
              <Box
                sx={{
                  width: 'calc((100% - 96px) / 3)',
                  mx: 6,
                }}
              >
                <Products items={featuredProducts} header="Angebote" />
              </Box>
              <Box
                sx={{
                  width: 'calc((100% - 96px) / 3)',
                }}
              >
                <Typography sx={{ mb: 1 }} variant="h4">
                  Regionales
                </Typography>
                <RSSFeed />
              </Box>
            </Box>
            <Box sx={{ mt: 6 }}>
              <Typography sx={{ mb: 1 }} variant="h4">
                Kalender
              </Typography>
              <Calendar />
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Box>
  )
}

const styles = {
  root: {
    p: 0,
  },
  outerContainer: {
    flexWrap: 'nowrap',
  },
  brand: {
    height: '100vh',
    p: 6,
    bgcolor: 'text.primary',
    color: 'background.paper',
    display: 'flex',
    flexDirection: 'column',
  },
  main: {},
}

export default Info
