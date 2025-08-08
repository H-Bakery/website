'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Box, CircularProgress, Button } from '@mui/material'
import MapIcon from '@mui/icons-material/Map'
import dynamic from 'next/dynamic'

// Lazy load the map component
const DynamicMap = dynamic(() => import('./DynamicMap'), {
  loading: () => (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: 400,
        backgroundColor: 'grey.100',
      }}
    >
      <CircularProgress />
    </Box>
  ),
  ssr: false, // Disable SSR for map component
})

interface LazyMapLoaderProps {
  autoLoad?: boolean
  loadOnScroll?: boolean
  scrollThreshold?: number
  position?: [number, number]
  name?: string
  address?: string
}

export const LazyMapLoader: React.FC<LazyMapLoaderProps> = ({
  autoLoad = false,
  loadOnScroll = true,
  scrollThreshold = 200,
  position = [49.333889, 7.343611],
  name = 'Bäckerei Heusser',
  address = 'Hauptstraße 45, 66424 Homburg-Kirrberg',
}) => {
  const [shouldLoadMap, setShouldLoadMap] = useState(autoLoad)
  const [isInView, setIsInView] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loadOnScroll || !containerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            // Auto-load map when user is close
            if (entry.intersectionRatio > 0.1) {
              setShouldLoadMap(true)
              observer.disconnect()
            }
          }
        })
      },
      {
        root: null,
        rootMargin: `${scrollThreshold}px`,
        threshold: [0, 0.1, 0.5],
      }
    )

    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [loadOnScroll, scrollThreshold])

  const handleLoadMap = () => {
    setShouldLoadMap(true)
  }

  return (
    <Box ref={containerRef} sx={{ position: 'relative', width: '100%' }}>
      {shouldLoadMap ? (
        <DynamicMap position={position} name={name} address={address} />
      ) : (
        <Box
          sx={{
            height: 400,
            backgroundColor: 'grey.50',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 2,
            border: '1px solid',
            borderColor: 'grey.200',
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: 'url("/assets/images/map-placeholder.jpg")',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(8px)',
              opacity: 0.3,
            },
          }}
        >
          <MapIcon
            sx={{
              fontSize: 64,
              color: 'primary.main',
              zIndex: 1,
            }}
          />

          <Button
            variant="contained"
            size="large"
            onClick={handleLoadMap}
            startIcon={<MapIcon />}
            sx={{
              zIndex: 1,
              borderRadius: 3,
              px: 4,
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 'bold',
              boxShadow: 3,
              '&:hover': {
                boxShadow: 6,
                transform: 'translateY(-2px)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            Karte laden
          </Button>

          {isInView && !shouldLoadMap && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '0.875rem',
                color: 'text.secondary',
                zIndex: 1,
              }}
            >
              Scrolle weiter, um die Karte automatisch zu laden
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}

export default LazyMapLoader
