'use client'
import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Box, CircularProgress, Typography } from '@mui/material'
import MapIcon from '@mui/icons-material/Map'

// Dynamically import the map component with no SSR
const DynamicMap = dynamic(() => import('./CleanOpenStreetMap'), {
  ssr: false,
  loading: () => (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'grey.50',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <MapIcon sx={{ fontSize: 48, color: 'grey.400' }} />
      <CircularProgress size={24} />
      <Typography variant="body2" color="text.secondary">
        Karte wird geladen...
      </Typography>
    </Box>
  ),
})

interface LazyMapProps {
  position: [number, number]
  name: string
  address: string
}

export default function LazyMap(props: LazyMapProps) {
  const [shouldRender, setShouldRender] = useState(false)
  const [isStrictModeHandled, setIsStrictModeHandled] = useState(false)

  useEffect(() => {
    // In development, React StrictMode causes double render
    // We'll wait a bit to ensure StrictMode has done its double mount/unmount cycle
    if (process.env.NODE_ENV === 'development' && !isStrictModeHandled) {
      // Track that we've started handling StrictMode
      setIsStrictModeHandled(true)

      // Wait for StrictMode's double render cycle to complete
      const timer = setTimeout(() => {
        setShouldRender(true)
      }, 100) // Small delay to let StrictMode complete its cycle

      return () => {
        clearTimeout(timer)
        // Don't reset shouldRender on cleanup to prevent re-initialization
      }
    } else if (process.env.NODE_ENV === 'production') {
      // In production, render immediately
      setShouldRender(true)
    }
  }, [isStrictModeHandled])

  if (!shouldRender) {
    return (
      <Box
        sx={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'grey.50',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <MapIcon sx={{ fontSize: 48, color: 'grey.400' }} />
        <Typography variant="body2" color="text.secondary">
          Karte wird vorbereitet...
        </Typography>
      </Box>
    )
  }

  return <DynamicMap {...props} />
}
