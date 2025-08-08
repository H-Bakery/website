'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Location } from '@bakery/delivery/tracking'
import { Route, RouteWaypoint } from '@bakery/delivery/routing'

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
})

interface MapProps {
  currentLocation?: Location
  route?: Route
  center?: [number, number]
  zoom?: number
  height?: string
}

export function Map({
  currentLocation,
  route,
  center = [47.3769, 8.5417], // Default to Zurich
  zoom = 13,
  height = '400px',
}: MapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const routeLineRef = useRef<L.Polyline | null>(null)
  const currentLocationMarkerRef = useRef<L.Marker | null>(null)

  // Initialize map
  useEffect(() => {
    if (mapRef.current) return // Map already initialized

    // Create map instance
    mapRef.current = L.map('delivery-map').setView(center, zoom)

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapRef.current)

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [center, zoom])

  // Update current location marker
  useEffect(() => {
    if (!mapRef.current || !currentLocation) return

    // Remove existing current location marker
    if (currentLocationMarkerRef.current) {
      currentLocationMarkerRef.current.remove()
    }

    // Create custom icon for current location
    const currentLocationIcon = L.divIcon({
      className: 'current-location-marker',
      html: `
        <div style="
          width: 20px;
          height: 20px;
          background-color: #4285F4;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        "></div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    })

    // Add current location marker
    currentLocationMarkerRef.current = L.marker(
      [currentLocation.latitude, currentLocation.longitude],
      { icon: currentLocationIcon }
    )
      .addTo(mapRef.current)
      .bindPopup('Aktuelle Position')

    // Pan to current location
    mapRef.current.setView([
      currentLocation.latitude,
      currentLocation.longitude,
    ])
  }, [currentLocation])

  // Update route display
  useEffect(() => {
    if (!mapRef.current || !route) return

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    // Clear existing route line
    if (routeLineRef.current) {
      routeLineRef.current.remove()
    }

    // Add waypoint markers
    route.waypoints.forEach((waypoint, index) => {
      const icon = getWaypointIcon(waypoint.type)

      const marker = L.marker(
        [waypoint.location.latitude, waypoint.location.longitude],
        { icon }
      ).addTo(mapRef.current!).bindPopup(`
          <div>
            <strong>${getWaypointLabel(waypoint.type)} ${
        index + 1
      }</strong><br/>
            ${waypoint.address}<br/>
            ${waypoint.orderId ? `Bestellung: ${waypoint.orderId}<br/>` : ''}
            ${waypoint.notes ? `Hinweise: ${waypoint.notes}` : ''}
          </div>
        `)

      markersRef.current.push(marker)
    })

    // Draw route line
    const routeCoordinates = route.waypoints.map(
      (wp) => [wp.location.latitude, wp.location.longitude] as [number, number]
    )

    routeLineRef.current = L.polyline(routeCoordinates, {
      color: '#2196F3',
      weight: 4,
      opacity: 0.8,
    }).addTo(mapRef.current)

    // Fit map to show all markers
    const bounds = L.latLngBounds(routeCoordinates)
    mapRef.current.fitBounds(bounds, { padding: [50, 50] })
  }, [route])

  return (
    <div>
      <div
        id="delivery-map"
        style={{
          height,
          width: '100%',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      />
    </div>
  )
}

function getWaypointIcon(type: RouteWaypoint['type']): L.Icon {
  const colors = {
    pickup: '#4CAF50',
    delivery: '#FF5722',
    waypoint: '#FFC107',
  }

  const labels = {
    pickup: 'A',
    delivery: 'L',
    waypoint: 'Z',
  }

  return L.divIcon({
    className: `waypoint-marker waypoint-${type}`,
    html: `
      <div style="
        width: 40px;
        height: 40px;
        background-color: ${colors[type]};
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 18px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      ">${labels[type]}</div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  })
}

function getWaypointLabel(type: RouteWaypoint['type']): string {
  const labels = {
    pickup: 'Abholung',
    delivery: 'Lieferung',
    waypoint: 'Zwischenstopp',
  }
  return labels[type]
}
