import React from 'react'
import {
  Box,
  Typography,
  Container,
  Divider,
} from '@mui/material'
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import DirectionsIcon from '@mui/icons-material/Directions'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import PhoneIcon from '@mui/icons-material/Phone'

import Hero from '../../components/home/hero/Hero'
import Map from '../../components/home/map'
import Wochenanfebote from '../../components/home/wochenanfebote'
import Testimonial from '../../components/home/testimonial'
import News from '../../components/home/news'
import CallToAction from '../../components/CallToAction'
import { featuredProducts } from '../../mocks/products/featured'
import Button from '../../components/button/Index'
import { getAllNews } from '../../services/newsService'
import NavigationButton from '../../components/NavigationButton'

export default async function HomePage() {
  const news = getAllNews()

  return (
    <>
      <Hero />

      {/* Top CTA for new visitors */}
      <CallToAction
        position="top"
        title="Traditionelle Backkunst seit 1933"
        subtitle="WILLKOMMEN IN UNSERER BÄCKEREI"
        description="Entdecken Sie unsere handwerklich hergestellten Backwaren aus regionalen Zutaten. Frisch gebacken und mit Liebe zubereitet – besuchen Sie uns oder bestellen Sie bequem per Telefon oder WhatsApp."
        primaryAction={{
          label: 'Bestellung aufgeben',
          icon: <PhoneIcon />,
          href: '/bestellen',
          variant: 'contained',
        }}
        secondaryAction={{
          label: 'Wegbeschreibung',
          icon: <DirectionsIcon />,
          href: '#map-section', // Scroll to map section
          variant: 'outlined',
        }}
      />

      <Wochenanfebote />

      <Box id="map-section">
        <Map />
      </Box>

      <Testimonial />

      <News
        news={news}
        header={
          <Box
            sx={{
              mb: 3,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="h3" component="h2" fontWeight="bold">
              Neuigkeiten
            </Typography>
            <NavigationButton href="/news">Mehr</NavigationButton>
          </Box>
        }
      />

      {/* Bottom CTA for informed visitors */}
      <CallToAction
        position="bottom"
        title="Probieren Sie unsere frischen Backwaren"
        subtitle="HANDGEMACHT & KÖSTLICH"
        description="Unsere Türen stehen Ihnen offen und wir freuen uns auf Ihren Besuch!"
        primaryAction={{
          label: 'Jetzt bestellen',
          icon: <RestaurantIcon />,
          href: '/bestellen',
          variant: 'contained',
          color: 'primary',
        }}
        secondaryAction={{
          label: 'Mehr erfahren',
          variant: 'outlined',
          href: '/about',
        }}
        backgroundImage="/images/bakery-background.jpg" // Add a background image path if you have one
      />
    </>
  )
}
