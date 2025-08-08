'use client'
import React, { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Typography } from '@mui/material'

// Fix for Leaflet marker icons in Next.js
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

interface MapProps {
  position: [number, number]
  name: string
  address: string
}

export default function CleanOpenStreetMap({
  position,
  name,
  address,
}: MapProps) {
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

  return (
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
  )
}
