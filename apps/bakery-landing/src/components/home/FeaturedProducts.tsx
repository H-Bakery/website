'use client'
import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Box, Container, Typography, IconButton, Button } from '@mui/material'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import NextLink from 'next/link'
import { Product } from '../../types/product'
import RenderedImage from '../products/RenderedImage'

interface FeaturedProductsProps {
  products: Product[]
}

/** Abstand des automatischen Weiterblätterns. */
export const AUTOPLAY_MS = 5000

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(REDUCED_MOTION).matches
  )
}

/**
 * - `auto`: blättert von selbst, pausiert aber, solange die Maus darüber
 *   steht oder der Fokus darin liegt.
 * - `playing`: mit dem Knopf bewusst gestartet - blättert auch unter der Maus.
 * - `stopped`: aus, bis jemand den Knopf drückt.
 */
type AutoplayMode = 'auto' | 'playing' | 'stopped'

/**
 * Karussell „Frisch aus der Backstube“ auf der Startseite.
 *
 * Es blättert alle fünf Sekunden weiter (WCAG 2.2.2: abschaltbar), aber
 * - nicht, wenn das Gerät „Bewegung reduzieren“ meldet,
 * - nie wieder, sobald jemand selbst eingreift: Tippen/Klicken, Wischen
 *   oder seitliches Scrollen im Karussell, eine Taste,
 * - nicht, solange die Maus darüber steht oder der Fokus darin liegt,
 * - und der Knopf neben den Punkten hält es an oder startet es wieder.
 */
const FeaturedProducts: React.FC<FeaturedProductsProps> = ({ products }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [mode, setMode] = useState<AutoplayMode>('auto')
  const [isHovered, setIsHovered] = useState(false)
  const [hasFocus, setHasFocus] = useState(false)
  const totalProducts = products.length

  // „Bewegung reduzieren“: gar nicht erst automatisch blättern. Der Knopf
  // kann es trotzdem bewusst starten.
  useEffect(() => {
    if (prefersReducedMotion()) setMode('stopped')
  }, [])

  const stopAutoplay = useCallback(() => setMode('stopped'), [])
  const isPlaying = mode !== 'stopped'

  // Nur seitliches Scrollen blättert im Karussell (Trackpad, Mausrad mit
  // Umschalttaste). Wer mit dem Mausrad die Seite daran vorbei scrollt, greift
  // nicht ein - sonst hielte fast jeder Besuch am Computer es für immer an.
  const handleWheel = (event: React.WheelEvent) => {
    if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      stopAutoplay()
    }
  }

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = scrollRef.current
      if (!el) return
      const cardWidth = el.scrollWidth / totalProducts
      el.scrollTo({
        left: cardWidth * index,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      })
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

  const autoplay =
    totalProducts > 1 &&
    (mode === 'playing' || (mode === 'auto' && !isHovered && !hasFocus))

  useEffect(() => {
    if (!autoplay) return
    const timer = setInterval(scrollNext, AUTOPLAY_MS)
    return () => clearInterval(timer)
  }, [scrollNext, autoplay])

  // Der Knopf darf das Anhalten durch Antippen/Tastendruck nicht auslösen,
  // sonst schaltet sein eigener Klick es gleich wieder ein.
  const keepToggleOut = (event: React.SyntheticEvent) => event.stopPropagation()

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setHasFocus(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setHasFocus(false)
        }
      }}
      onPointerDown={stopAutoplay}
      onTouchStart={stopAutoplay}
      onKeyDown={stopAutoplay}
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
            color: 'text.secondary',
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
            onWheel={handleWheel}
            sx={{
              display: 'flex',
              gap: { xs: 2, md: 3 },
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              scrollBehavior: 'smooth',
              [`@media ${REDUCED_MOTION}`]: { scrollBehavior: 'auto' },
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
                  {product.renderedImage ? (
                    // Aus dem 3D-Modell gerendert; das Bild bringt seinen Rand
                    // mit und füllt darum den Rahmen (dessen Innenabstand
                    // bleibt).
                    <RenderedImage
                      image={product.renderedImage}
                      alt={product.name}
                      sizes="(max-width: 600px) 45vw, 230px"
                      style={{ minWidth: 0, minHeight: 0 }}
                    />
                  ) : (
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
                  )}
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
                      color: 'text.secondary',
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

        {/* Anhalten/Abspielen und Punkte */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 1,
            mt: 2,
          }}
        >
          {totalProducts > 1 && (
            <IconButton
              onClick={() => setMode(isPlaying ? 'stopped' : 'playing')}
              onPointerDown={keepToggleOut}
              onTouchStart={keepToggleOut}
              onKeyDown={keepToggleOut}
              aria-label={
                isPlaying
                  ? 'Automatisches Weiterblättern anhalten'
                  : 'Automatisches Weiterblättern starten'
              }
              title={isPlaying ? 'Anhalten' : 'Abspielen'}
              sx={{
                flexShrink: 0,
                width: 44,
                height: 44,
                color: '#5A2E2A',
              }}
            >
              {isPlaying ? (
                <PauseIcon fontSize="small" />
              ) : (
                <PlayArrowIcon fontSize="small" />
              )}
            </IconButton>
          )}
          <Box sx={{ display: 'flex', minWidth: 0 }}>
            {products.map((product, index) => {
              const isActive = activeIndex === index
              return (
                <Box
                  key={product.id}
                  component="button"
                  type="button"
                  onClick={() => scrollToIndex(index)}
                  aria-label={`Produkt ${index + 1} von ${totalProducts}`}
                  aria-current={isActive ? 'true' : undefined}
                  sx={{
                    // Trefferfläche 44x44 (auf sehr schmalen Bildschirmen
                    // nicht unter 32 breit), der sichtbare Punkt bleibt klein.
                    width: 44,
                    flexShrink: 1,
                    minWidth: 32,
                    height: 44,
                    p: 0,
                    border: 0,
                    bgcolor: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px',
                    '&::before': {
                      content: '""',
                      display: 'block',
                      width: isActive ? 24 : 10,
                      height: 10,
                      borderRadius: '5px',
                      backgroundColor: isActive ? '#5A2E2A' : '#E6D8C3',
                      transition: 'all 0.3s ease',
                    },
                    '&:focus-visible': {
                      outline: '2px solid #5A2E2A',
                      outlineOffset: '-4px',
                    },
                  }}
                />
              )
            })}
          </Box>
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
