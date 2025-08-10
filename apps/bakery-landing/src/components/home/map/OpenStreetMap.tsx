'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Box, Typography } from '@mui/material'
import { mapManager } from './MapManager'
import { StrictModeMapContainer } from './StrictModeMapContainer'

// Fix for Leaflet marker icons in Next.js
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

interface MapProps {
  position: [number, number] // [latitude, longitude]
  name: string
  address: string
}

export default function Map({ position, name, address }: MapProps) {
  // Use a unique and stable ID for this map instance
  const [mapId] = useState(() => `map-${Date.now()}-${Math.random()}`)
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)

  // Fix Leaflet icons - only once globally
  useEffect(() => {
    // Only set up icons once globally
    if (!L.Icon.Default.prototype.options.iconUrl) {
      // @ts-ignore - TypeScript doesn't like accessing private properties
      delete L.Icon.Default.prototype['_getIconUrl']

      L.Icon.Default.mergeOptions({
        iconUrl: markerIcon.src || markerIcon,
        iconRetinaUrl: markerIcon2x.src || markerIcon2x,
        shadowUrl: markerShadow.src || markerShadow,
      })
    }
  }, [])

  // Initialization effect with MapManager
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Force cleanup of any stuck container
    mapManager.forceCleanupElement(container)

    // Check if we can initialize this map
    if (!mapManager.registerInitialization(mapId)) {
      setInitError('Map initialization prevented - container already in use')
      return
    }

    // Set container ID for tracking
    container.id = mapId

    // Cleanup function
    return () => {
      mapManager.cleanup(mapId)
      setIsInitialized(false)
      setInitError(null)
    }
  }, [mapId])

  // Callback to handle map instance
  const handleMapCreated = useCallback(
    (map: L.Map | null) => {
      if (map && !isInitialized && containerRef.current) {
        try {
          mapRef.current = map
          mapManager.registerMap(mapId, map, containerRef.current)
          setIsInitialized(true)
          setInitError(null)
        } catch (error) {
          console.error('Error registering map:', error)
          setInitError('Failed to register map instance')
        }
      }
    },
    [isInitialized, mapId]
  )

  // Show error state if initialization failed
  if (initError) {
    return (
      <Box
        ref={containerRef}
        sx={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'grey.100',
          border: '1px dashed',
          borderColor: 'grey.300',
        }}
      >
        <Box sx={{ textAlign: 'center', p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Map temporarily unavailable
          </Typography>
          <Typography
            variant="caption"
            color="error"
            sx={{ mt: 1, display: 'block' }}
          >
            {process.env.NODE_ENV === 'development'
              ? initError
              : 'Please refresh the page'}
          </Typography>
        </Box>
      </Box>
    )
  }

  return (
    <Box
      ref={containerRef}
      sx={{ height: '100%', width: '100%', position: 'relative' }}
    >
      <StrictModeMapContainer
        center={position}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        ref={handleMapCreated}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>
          <Popup>
            <Typography variant="subtitle1">{name}</Typography>
            <Typography variant="body2">{address}</Typography>
          </Popup>
        </Marker>
      </StrictModeMapContainer>
    </Box>
  )
}
