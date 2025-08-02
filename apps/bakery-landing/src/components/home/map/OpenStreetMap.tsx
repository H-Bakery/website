'use client'
import React, { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Box, Button, Typography } from '@mui/material'
import DirectionsIcon from '@mui/icons-material/Directions'

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
  // Fix Leaflet icons - using bracket notation for _getIconUrl
  useEffect(() => {
    // @ts-ignore - TypeScript doesn't like accessing private properties
    delete L.Icon.Default.prototype['_getIconUrl']

    L.Icon.Default.mergeOptions({
      iconUrl: markerIcon.src || markerIcon,
      iconRetinaUrl: markerIcon2x.src || markerIcon2x,
      shadowUrl: markerShadow.src || markerShadow,
    })
  }, [])

  // Create Google Maps direction URL
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${position[0]},${position[1]}&travelmode=driving`

  return (
    <Box sx={{ height: '100%', width: '100%', position: 'relative' }}>
      <MapContainer
        center={position}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
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
      </MapContainer>

      {/* Google Maps Direction Button - already in parent component */}
    </Box>
  )
}
