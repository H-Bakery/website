import React from 'react'
import {
  Box,
  Typography,
  Divider,
  Grid,
  useMediaQuery,
  Container,
} from '@mui/material'
import { ZEITEN } from '../components/home/map/zeiten'

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
import Info from '../components/home/map/Info'

const InfoTV: React.FC = () => {
  const [isOpen, setOpen] = React.useState(false)

  console.log('ZEITEN')
  console.log(ZEITEN)
  const handleOpeningHours = () => {
    // get day
    let workday = new Date().getDay()
    console.log(workday)
    console.log('time')
    let hour = new Date().getHours()
    console.log('hour')
    console.log(hour)

    function calculateOpenHours(open: any, close: any) {
      var open_hour = parseInt(open.split(':')[0])
      var open_minutes = parseInt(open.split(':')[1])
      console.log('open_time', open_hour, open_minutes)

      var close_hour = parseInt(close.split(':')[0])
      var close_minutes = parseInt(close.split(':')[1])
      console.log('close_time', close_hour, close_minutes)

      var d = new Date() // current time
      var current_hours = d.getHours()
      var current_mins = d.getMinutes()

      if (
        current_hours > open_hour ||
        (current_hours === open_hour &&
          current_mins >= open_minutes &&
          (current_hours < close_hour ||
            (current_hours === close_hour && current_mins < close_minutes)))
      ) {
        console.log('open')

        return true
      } else {
        console.log('closed')
        return false
      }
    }

    switch (workday) {
      case 0:
        console.log("Sonntag, We've closed! See you tomorrow!")
        break
      case 1:
        console.log("Montag, It's a Bakeryday! :-)")
        if (
          calculateOpenHours('05:00', '12:00') ||
          calculateOpenHours('15:30', '17:00')
        ) {
          setOpen(true)
        } else {
          setOpen(false)
        }

        break
      case 2:
        console.log("Dienstag, It's a Bakeryday! :-)")
        if (
          calculateOpenHours('05:00', '12:00') ||
          calculateOpenHours('15:30', '17:00')
        ) {
          setOpen(true)
        } else {
          setOpen(false)
        }
        break
      case 3:
        console.log("Mittwoch, It's a Bakeryday! :-)")
        if (calculateOpenHours('06:00', '12:30')) {
          setOpen(true)
        } else {
          setOpen(false)
        }
        break
      case 4:
        console.log("Donnerstag, It's a Bakeryday! :-)")
        if (
          calculateOpenHours('05:00', '12:00') ||
          calculateOpenHours('15:30', '17:00')
        ) {
          setOpen(true)
        } else {
          setOpen(false)
        }
        break
      case 5:
        console.log("Freitag, It's a Bakeryday! :-)")
        if (
          calculateOpenHours('05:00', '12:00') ||
          calculateOpenHours('15:30', '17:00')
        ) {
          setOpen(true)
        } else {
          setOpen(false)
        }
        break
      case 6:
        console.log("Samstag, It's a Bakeryday! :-)")
        if (calculateOpenHours('06:00', '12:30')) {
          setOpen(true)
        } else {
          setOpen(false)
        }
        break
      default:
        break
    }
  }

  React.useEffect(() => {
    // Update the document title using the browser API
    handleOpeningHours()
    setInterval(() => {
      handleOpeningHours()
    }, 50000)
  })

  return (
    <div>
      {isOpen ? (
        <Box sx={styles.root}>
          <Grid container sx={styles.outerContainer}>
            <Grid item md={3}>
              <Box sx={styles.brand}>
                <Box flex={1}>
                  <Box sx={{ mb: 6 }}>
                    {/* <Typography variant="h4">{useDate().wish}</Typography>
                  <Typography variant="h2">{useDate().time}</Typography> */}
                    <Typography variant="h1">{`Hello ${isOpen}`}</Typography>
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
      ) : (
        <Box sx={styles.isClosed}>
          <Box sx={styles.logo}>
            <Wappen />
            <Baeckerei />
          </Box>
          <Box sx={styles.info}>
            <Typography variant="h6" gutterBottom>
              Öffnungszeiten
            </Typography>
            {ZEITEN.map((item) => (
              <>
                <Typography fontWeight="bold" variant="body2">
                  {item.label}
                </Typography>
                <Typography>{item.value}</Typography>
              </>
            ))}

            <Typography variant="h6" gutterBottom>
              Telefon
            </Typography>
            <Typography>06841 2229</Typography>
            <Typography>01522 6621236</Typography>
          </Box>
        </Box>
      )}
    </div>
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
  logo: {
    position: 'relative',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    color: 'white',
    transform: { xs: 'scale(0.5)', sm: 'scale(0.6)', md: 'scale(1)' },
  },
  isClosed: {
    backgroundColor: 'black',
    height: '100vh',
    padding: '20% 50px',
  },
  info: {
    paddingTop: '50px',
    position: 'relative',
    justifyContent: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 2,
    color: 'white',
  },
}

export default InfoTV
