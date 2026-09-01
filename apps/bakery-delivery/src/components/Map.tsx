'use client'

import { useEffect, useId, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { hasCoordinates } from '@bakery/delivery/routing'
import type { Location } from '@bakery/delivery/tracking'
import type { Depot, Stop } from '../lib/delivery-api'

// Leaflet sucht seine Marker-Bilder relativ zum Bundle. Die drei PNGs unter
// `public/leaflet/` liegen genau deswegen im Repo.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
})

/** Homburg-Kirrberg - das Liefergebiet, nicht Zuerich. */
const HOMBURG: [number, number] = [49.3117, 7.3542]

const STATUS_COLOR: Record<Stop['status'], string> = {
  open: '#8b4513',
  done: '#2e7d32',
  failed: '#c62828',
}

interface MapProps {
  currentLocation?: Location
  depot?: Depot
  stops?: Stop[]
  /** Strassenverlauf vom Router. Fehlt er, werden die Stopps gerade verbunden. */
  geometry?: Array<[number, number]> | null
  activeStopId?: number | null
  height?: string
}

export function Map({
  currentLocation,
  depot,
  stops = [],
  geometry,
  activeStopId,
  height = '360px',
}: MapProps) {
  // Eigene ID pro Instanz. Vorher stand hier ein fester String, sodass eine
  // zweite Karte auf derselben Seite die erste uebernommen haette.
  const mapId = `delivery-map-${useId().replace(/[:]/g, '')}`

  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const positionRef = useRef<L.Marker | null>(null)
  const hasFittedRef = useRef<string | null>(null)

  // Die Karte wird genau einmal aufgebaut. Frueher hingen `center`/`zoom` als
  // Array-Literale in den Dependencies - bei jedem Render neu erzeugt, also
  // wurde die Karte bei jedem Render zerstoert und neu gebaut.
  useEffect(() => {
    if (mapRef.current) return

    const map = L.map(mapId, { zoomControl: true }).setView(HOMBURG, 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)

    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
      positionRef.current = null
      hasFittedRef.current = null
    }
  }, [mapId])

  // Stopps, Depot und Streckenverlauf
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    const bounds: Array<[number, number]> = []

    if (hasCoordinates(depot)) {
      const depotPoint: [number, number] = [depot.lat, depot.lon]
      bounds.push(depotPoint)
      L.marker(depotPoint, { icon: badgeIcon('B', '#37474f') })
        .bindPopup(
          `<strong>${escapeHtml(depot.name)}</strong><br/>Start der Tour`
        )
        .addTo(layer)
    }

    // `hasCoordinates` statt `!== null`: bei `undefined` wuerfe Leaflet mit
    // "Invalid LatLng" die ganze Karte weg.
    const located = stops.filter(hasCoordinates)

    located.forEach((stop, index) => {
      const point: [number, number] = [stop.lat, stop.lon]
      bounds.push(point)

      L.marker(point, {
        icon: badgeIcon(
          String(index + 1),
          STATUS_COLOR[stop.status],
          stop.id === activeStopId
        ),
        zIndexOffset: stop.id === activeStopId ? 1000 : 0,
      })
        .bindPopup(
          `<strong>${index + 1}. ${escapeHtml(stop.customer)}</strong><br/>` +
            `${escapeHtml(stop.address)}` +
            (stop.timeWindow
              ? `<br/>Zeitfenster: ${escapeHtml(stop.timeWindow)}`
              : '')
        )
        .addTo(layer)
    })

    // Echter Strassenverlauf, wenn der Router einen geliefert hat - sonst die
    // Luftlinie, damit die Reihenfolge trotzdem sichtbar ist.
    if (geometry && geometry.length > 1) {
      L.polyline(geometry, {
        color: '#1565c0',
        weight: 5,
        opacity: 0.75,
      }).addTo(layer)
      geometry.forEach((point) => bounds.push(point))
    } else if (bounds.length > 1) {
      L.polyline(bounds, {
        color: '#1565c0',
        weight: 3,
        opacity: 0.5,
        dashArray: '6 8',
      }).addTo(layer)
    }

    // Einpassen, wenn sich die *Menge* der Stopps aendert - nicht bei jedem
    // Abhaken, sonst springt die Karte dem Fahrer aus der Hand.
    const fingerprint = located
      .map((stop) => stop.id)
      .join(',')
      .concat(geometry ? `|${geometry.length}` : '')
    if (bounds.length > 0 && fingerprint !== hasFittedRef.current) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 16 })
      hasFittedRef.current = fingerprint
    }
  }, [depot, stops, geometry, activeStopId])

  // Eigene Position
  useEffect(() => {
    const map = mapRef.current
    if (!map || !currentLocation) return

    const point: [number, number] = [
      currentLocation.latitude,
      currentLocation.longitude,
    ]
    if (positionRef.current) {
      positionRef.current.setLatLng(point)
      return
    }

    positionRef.current = L.marker(point, {
      icon: L.divIcon({
        className: 'current-location-marker',
        html: '<div class="pulse-dot"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      zIndexOffset: 2000,
    })
      .bindPopup('Aktuelle Position')
      .addTo(map)
  }, [currentLocation])

  return (
    <div
      id={mapId}
      role="application"
      aria-label="Karte der Liefertour"
      style={{ height, width: '100%' }}
    />
  )
}

function badgeIcon(
  label: string,
  color: string,
  highlighted = false
): L.DivIcon {
  const size = highlighted ? 42 : 34
  return L.divIcon({
    className: 'waypoint-marker',
    html: `<div style="
      width:${size}px;height:${size}px;background:${color};
      border:3px solid ${highlighted ? '#ffd54f' : '#fff'};border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:${highlighted ? 17 : 14}px;
      box-shadow:0 2px 6px rgba(0,0,0,.35);">${escapeHtml(label)}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

/** Kundennamen und Hinweise landen in Popup-HTML - also maskieren. */
function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
