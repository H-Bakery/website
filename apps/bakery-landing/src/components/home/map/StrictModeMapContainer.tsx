'use client'
import React, { forwardRef, useRef, useEffect, useState } from 'react'
import { MapContainer, MapContainerProps } from 'react-leaflet'
import L from 'leaflet'

/**
 * StrictMode-safe MapContainer wrapper
 * Prevents "Map container is already initialized" errors in React StrictMode
 */
export const StrictModeMapContainer = forwardRef<L.Map, MapContainerProps>(
  (props, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<L.Map | null>(null)
    const [isFirstRender, setIsFirstRender] = useState(true)
    const [containerId] = useState(
      () => `leaflet-container-${Date.now()}-${Math.random()}`
    )

    // Clear any existing Leaflet data on the container before rendering
    useEffect(() => {
      const container = containerRef.current
      if (container && isFirstRender) {
        // Force clear any Leaflet initialization data
        try {
          // Remove Leaflet internal properties if they exist
          delete (container as any)._leaflet_id
          delete (container as any)._leaflet
          delete (container as any)._leaflet_pos

          // Set a unique ID to ensure fresh container
          container.id = containerId

          // Clear innerHTML to ensure clean state
          container.innerHTML = ''

          setIsFirstRender(false)
        } catch (error) {
          console.debug('Container cleanup error (ignored):', error)
        }
      }
    }, [containerId, isFirstRender])

    // Handle map reference
    const handleMapRef = (map: L.Map | null) => {
      mapRef.current = map
      if (typeof ref === 'function') {
        ref(map)
      } else if (ref) {
        ref.current = map
      }
    }

    // Don't render until container is clean
    if (isFirstRender) {
      return (
        <div
          ref={containerRef}
          style={props.style}
          className={props.className}
          id={containerId}
        />
      )
    }

    return (
      <div ref={containerRef}>
        <MapContainer
          {...props}
          ref={handleMapRef}
          // Force a new key to ensure fresh instance
          key={containerId}
        />
      </div>
    )
  }
)
