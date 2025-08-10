import React from 'react'
import { Box, Typography, Container, Divider } from '@mui/material'
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import DirectionsIcon from '@mui/icons-material/Directions'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import PhoneIcon from '@mui/icons-material/Phone'

import EnhancedHero from '../../components/home/hero/EnhancedHero'
import Map from '../../components/home/map'
import Wochenanfebote from '../../components/home/wochenanfebote'
import EnhancedTestimonial from '../../components/home/testimonial/EnhancedTestimonial'
import News from '../../components/home/news'
import CallToAction from '../../components/CallToAction'
import TrustBadges from '../../components/home/TrustBadges'
import QuickOrder from '../../components/home/QuickOrder'
import SeasonalHighlights from '../../components/home/SeasonalHighlights'
import InstagramFeed from '../../components/home/InstagramFeed'
import { featuredProducts } from '../../mocks/products/featured'
import Button from '../../components/button/Index'
import { getAllNews } from '../../services/newsService'
import NavigationButton from '../../components/NavigationButton'

export default async function HomePage() {
  const news = getAllNews()

  return (
    <>
      <EnhancedHero />

      {/* Top CTA for new visitors */}
      <CallToAction
        position="top"
        title="Frisch gebacken, täglich für Sie!"
        subtitle="🥐 JETZT NEU: ONLINE VORBESTELLEN"
        description="Sichern Sie sich Ihre Lieblings-Backwaren schon heute für morgen. Keine Wartezeiten, garantierte Verfügbarkeit – einfach vorbestellen und abholen!"
        primaryAction={{
          label: 'Jetzt vorbestellen',
          icon: <ShoppingBasketIcon />,
          href: '/bestellen',
          variant: 'contained',
        }}
        secondaryAction={{
          label: 'Unser Sortiment',
          icon: <ArrowForwardIcon />,
          href: '/products',
          variant: 'outlined',
        }}
      />

      <TrustBadges />

      <QuickOrder />

      <Wochenanfebote />

      <SeasonalHighlights />

      <Box id="map-section">
        <Map />
      </Box>

      <EnhancedTestimonial />

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

      <InstagramFeed />

      {/* Bottom CTA for informed visitors */}
      <CallToAction
        position="bottom"
        title="Werden Sie Teil unserer Bäckerei-Familie"
        subtitle="🍞 TREUEAKTION: 10. BROT GRATIS"
        description="Sammeln Sie bei jedem Einkauf Stempel und genießen Sie exklusive Vorteile. Ab sofort in unserer Filiale!"
        primaryAction={{
          label: 'Zur Filiale navigieren',
          icon: <DirectionsIcon />,
          href: '#map-section',
          variant: 'contained',
          color: 'primary',
        }}
        secondaryAction={{
          label: 'Anrufen: 06841 2229',
          icon: <PhoneIcon />,
          variant: 'outlined',
          href: 'tel:068412229',
        }}
        compact={true}
      />
    </>
  )
}
