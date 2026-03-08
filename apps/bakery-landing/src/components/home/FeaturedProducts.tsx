'use client'
import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Box, Container, Typography, IconButton, Button } from '@mui/material'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import NextLink from 'next/link'
import { Product } from '../../types/product'

interface FeaturedProductsProps {
  products: Product[]
}

const FeaturedProducts: React.FC<FeaturedProductsProps> = ({ products }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const totalProducts = products.length

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = scrollRef.current
      if (!el) return
      const cardWidth = el.scrollWidth / totalProducts
      el.scrollTo({ left: cardWidth * index, behavior: 'smooth' })
      setActiveIndex(index)
    },
    [totalProducts]
  )

  const scrollPrev = () => {
    const newIndex = activeIndex > 0 ? activeIndex - 1 : totalProducts - 1
    scrollToIndex(newIndex)
  }

  const scrollNext = useCallback(() => {
    const newIndex = activeIndex < totalProducts - 1 ? activeIndex + 1 : 0
    scrollToIndex(newIndex)
  }, [activeIndex, totalProducts, scrollToIndex])

  // Auto-advance every 5 seconds
  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(scrollNext, 5000)
    return () => clearInterval(timer)
  }, [scrollNext, isPaused])

  // Track scroll position for dot indicators
  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const cardWidth = el.scrollWidth / totalProducts
    const newIndex = Math.round(el.scrollLeft / cardWidth)
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < totalProducts) {
      setActiveIndex(newIndex)
    }
  }

  return (
    <Box
      sx={{ py: { xs: 5, md: 7 }, backgroundColor: '#FFF3E6' }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <Container maxWidth="lg">
        {/* Section Heading */}
        <Typography
          variant="h3"
          component="h2"
          sx={{
            textAlign: 'center',
            fontFamily: '"Cinzel", serif',
            fontWeight: 700,
            color: '#3B2B28',
            mb: 1,
            fontSize: { xs: '1.6rem', sm: '2rem', md: '2.25rem' },
          }}
        >
          Frisch aus der Backstube
        </Typography>
        <Typography
          variant="body1"
          sx={{
            textAlign: 'center',
            color: '#928168',
            mb: { xs: 3, md: 4 },
            fontSize: { xs: '1rem', md: '1.1rem' },
          }}
        >
          Entdecken Sie unser Sortiment — täglich frisch für Sie gebacken
        </Typography>

        {/* Carousel */}
        <Box sx={{ position: 'relative' }}>
          {/* Scroll container */}
          <Box
            ref={scrollRef}
            onScroll={handleScroll}
            sx={{
              display: 'flex',
              gap: { xs: 2, md: 3 },
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              scrollBehavior: 'smooth',
              WebkitOverflowScrolling: 'touch',
              px: { xs: 1, md: 0 },
              pb: 1,
              /* Hide scrollbar */
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {products.map((product) => (
              <Box
                key={product.id}
                component={NextLink}
                href={`/products/${product.id}`}
                sx={{
                  flex: {
                    xs: '0 0 75%',
                    sm: '0 0 45%',
                    md: '0 0 calc(33.333% - 16px)',
                  },
                  scrollSnapAlign: 'start',
                  borderRadius: '16px',
                  backgroundColor: '#FFFFFF',
                  overflow: 'hidden',
                  boxShadow: '0 2px 12px rgba(90, 46, 42, 0.08)',
                  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                  textDecoration: 'none',
                  color: 'inherit',
                  '&:hover': {
                    boxShadow: '0 6px 20px rgba(90, 46, 42, 0.14)',
                    transform: 'translateY(-3px)',
                  },
                }}
              >
                {/* Product Image */}
                <Box
                  sx={{
                    aspectRatio: '4 / 3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#FFF3E6',
                    p: 3,
                  }}
                >
                  <Box
                    component="img"
                    src={product.image || product.imageUrl || ''}
                    alt={product.name}
                    sx={{
                      maxWidth: '70%',
                      maxHeight: '70%',
                      objectFit: 'contain',
                    }}
                  />
                </Box>
                {/* Product Info */}
                <Box sx={{ p: { xs: 2, md: 2.5 }, textAlign: 'center' }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontFamily: '"Cinzel", serif',
                      fontWeight: 700,
                      color: '#3B2B28',
                      fontSize: { xs: '1.05rem', md: '1.15rem' },
                      mb: 0.5,
                    }}
                  >
                    {product.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#928168',
                      fontSize: { xs: '0.9rem', md: '0.95rem' },
                      lineHeight: 1.5,
                    }}
                  >
                    {product.description || product.category}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          {/* Navigation Arrows */}
          <IconButton
            onClick={scrollPrev}
            aria-label="Vorheriges Produkt"
            sx={{
              position: 'absolute',
              left: { xs: -4, md: -20 },
              top: '40%',
              transform: 'translateY(-50%)',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              width: { xs: 40, md: 48 },
              height: { xs: 40, md: 48 },
              '&:hover': { backgroundColor: '#F5EDE4' },
              display: { xs: 'none', sm: 'flex' },
            }}
          >
            <ArrowBackIosNewIcon sx={{ fontSize: 18, color: '#5A2E2A' }} />
          </IconButton>
          <IconButton
            onClick={scrollNext}
            aria-label="Nächstes Produkt"
            sx={{
              position: 'absolute',
              right: { xs: -4, md: -20 },
              top: '40%',
              transform: 'translateY(-50%)',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              width: { xs: 40, md: 48 },
              height: { xs: 40, md: 48 },
              '&:hover': { backgroundColor: '#F5EDE4' },
              display: { xs: 'none', sm: 'flex' },
            }}
          >
            <ArrowForwardIosIcon sx={{ fontSize: 18, color: '#5A2E2A' }} />
          </IconButton>
        </Box>

        {/* Dot Indicators */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 1,
            mt: 3,
          }}
        >
          {products.map((_, index) => (
            <Box
              key={index}
              onClick={() => scrollToIndex(index)}
              role="button"
              aria-label={`Produkt ${index + 1}`}
              tabIndex={0}
              sx={{
                width: activeIndex === index ? 24 : 10,
                height: 10,
                borderRadius: '5px',
                backgroundColor: activeIndex === index ? '#5A2E2A' : '#E6D8C3',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </Box>

        {/* "Alle Produkte" Link */}
        <Box sx={{ textAlign: 'center', mt: { xs: 3, md: 4 } }}>
          <Button
            variant="outlined"
            href="/products"
            sx={{
              px: 4,
              py: 1.5,
              fontSize: { xs: '1rem', md: '1.05rem' },
              fontWeight: 700,
              borderColor: '#5A2E2A',
              color: '#5A2E2A',
              borderWidth: 2,
              borderRadius: '8px',
              '&:hover': {
                borderColor: '#3B2B28',
                backgroundColor: 'rgba(90, 46, 42, 0.05)',
                borderWidth: 2,
              },
            }}
          >
            Alle Produkte ansehen
          </Button>
        </Box>
      </Container>
    </Box>
  )
}

export default FeaturedProducts
