import React from 'react'
import { Box } from '@mui/material'

// Import components
import EnhancedHero from '../components/home/hero/EnhancedHero'
import QuickInfoBar from '../components/home/QuickInfoBar'
import FeaturedProducts from '../components/home/FeaturedProducts'
import EnhancedTestimonial from '../components/home/testimonial/EnhancedTestimonial'
import MapComponent from '../components/home/map'

export default function HomePage() {
  return (
    <>
      <EnhancedHero />

      <QuickInfoBar />

      <FeaturedProducts />

      <EnhancedTestimonial />

      <Box id="map-section">
        <MapComponent />
      </Box>
    </>
  )
}
