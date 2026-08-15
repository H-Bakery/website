import React from 'react'
import { Box } from '@mui/material'
import PhoneIcon from '@mui/icons-material/Phone'

// Import components
import EnhancedHero from '../components/home/hero/EnhancedHero'
import QuickInfoBar from '../components/home/QuickInfoBar'
import FeaturedProducts from '../components/home/FeaturedProducts'
import Brotplan from '../components/home/wochenanfebote'
import EnhancedTestimonial from '../components/home/testimonial/EnhancedTestimonial'
import CallToAction from '../components/CallToAction'
import MapComponent from '../components/home/map'
import { loadProducts } from '../lib/products'
import { Metadata } from 'next'
import { SITE_URL } from '../config/legal'

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
  openGraph: {
    url: SITE_URL,
  },
}

const FEATURED_CATEGORIES = [
  'Brot',
  'Baguette',
  'Brötchen',
  'Teilchen',
  'Snacks',
  'Kuchen',
  'Torten',
]

export default function HomePage() {
  const allProducts = loadProducts()

  // Pick 1 available product per category + 1 extra
  const featured: typeof allProducts = []
  for (const cat of FEATURED_CATEGORIES) {
    const product = allProducts.find(
      (p) =>
        p.category === cat && p.available !== false && !featured.includes(p)
    )
    if (product) featured.push(product)
  }
  // Add 1 extra product not yet picked
  const extra = allProducts.find(
    (p) => p.available !== false && !featured.includes(p)
  )
  if (extra) featured.push(extra)

  return (
    <>
      <EnhancedHero />

      <QuickInfoBar />

      <FeaturedProducts products={featured} />

      <Box id="brotplan">
        <Brotplan />
      </Box>

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
