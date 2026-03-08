import React from 'react'
import { Box } from '@mui/material'
import PhoneIcon from '@mui/icons-material/Phone'

// Import components
import EnhancedHero from '../components/home/hero/EnhancedHero'
import QuickInfoBar from '../components/home/QuickInfoBar'
import FeaturedProducts from '../components/home/FeaturedProducts'
import ProductsByCategory from '../components/home/ProductsByCategory'
import EnhancedTestimonial from '../components/home/testimonial/EnhancedTestimonial'
import CallToAction from '../components/CallToAction'
import MapComponent from '../components/home/map'
import { getProductsByCategory } from '../lib/products'

export default function HomePage() {
  const categories = getProductsByCategory()

  return (
    <>
      <EnhancedHero />

      <QuickInfoBar />

      <FeaturedProducts />

      <ProductsByCategory categories={categories} teaser />

      <EnhancedTestimonial />

      <CallToAction
        position="bottom"
        subtitle="Wir freuen uns auf Sie"
        title="Frisch bestellen — direkt vom Bäcker"
        description="Rufen Sie uns an und bestellen Sie frisches Brot, Brötchen und Feingebäck. Gerne nehmen wir auch Vorbestellungen für Feiern und besondere Anlässe entgegen."
        primaryAction={{
          label: 'Jetzt anrufen',
          icon: <PhoneIcon />,
          href: 'tel:068412229',
          variant: 'contained',
        }}
        secondaryAction={{
          label: 'Kontakt aufnehmen',
          href: '/contact',
          variant: 'outlined',
        }}
      />

      <Box id="map-section">
        <MapComponent />
      </Box>
    </>
  )
}
