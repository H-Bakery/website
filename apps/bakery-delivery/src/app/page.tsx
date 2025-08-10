'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import styles from './page.module.css'
import {
  DeliveryTracker,
  getCurrentLocation,
  watchLocation,
  clearLocationWatch,
  Location,
  DeliveryStatus,
  formatDistance,
} from '@bakery/delivery/tracking'
import {
  MockMapProvider,
  Route,
  RouteWaypoint,
  calculateETA,
  formatDuration,
  formatRouteDistance,
} from '@bakery/delivery/routing'

// Dynamically import Map component to avoid SSR issues with Leaflet
const Map = dynamic(() => import('../components/Map').then((mod) => mod.Map), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Karte wird geladen...</div>,
})

export default function DeliveryDashboard() {
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null)
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus | null>(
    null
  )
  const [route, setRoute] = useState<Route | null>(null)
  const [watchId, setWatchId] = useState<number | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize map provider
  const mapProvider = new MockMapProvider()

  useEffect(() => {
    // Get initial location
    getCurrentLocation()
      .then(setCurrentLocation)
      .catch((err) =>
        setError(`Standort konnte nicht ermittelt werden: ${err.message}`)
      )

    // Cleanup on unmount
    return () => {
      if (watchId !== null) {
        clearLocationWatch(watchId)
      }
    }
  }, [watchId])

  const startTracking = () => {
    setIsTracking(true)
    setError(null)

    const id = watchLocation(
      (location) => {
        setCurrentLocation(location)
        // Here you would send location updates to the server
        console.log('Location update:', location)
      },
      (error) => {
        setError(`Tracking-Fehler: ${error.message}`)
        setIsTracking(false)
      }
    )

    setWatchId(id)
  }

  const stopTracking = () => {
    if (watchId !== null) {
      clearLocationWatch(watchId)
      setWatchId(null)
    }
    setIsTracking(false)
  }

  const loadSampleRoute = async () => {
    if (!currentLocation) {
      setError('Aktueller Standort nicht verfügbar')
      return
    }

    try {
      // Create sample delivery waypoints
      const waypoints: RouteWaypoint[] = [
        {
          location: await mapProvider.geocodeAddress(
            'Bahnhofstrasse 1, 8001 Zürich'
          ),
          address: 'Bahnhofstrasse 1, 8001 Zürich',
          type: 'delivery',
          orderId: 'ORDER-001',
          notes: 'Kunde: Müller, 2x Brot, 3x Gipfeli',
        },
        {
          location: await mapProvider.geocodeAddress(
            'Paradeplatz 2, 8001 Zürich'
          ),
          address: 'Paradeplatz 2, 8001 Zürich',
          type: 'delivery',
          orderId: 'ORDER-002',
          notes: 'Kunde: Schmidt, 1x Torte',
        },
        {
          location: await mapProvider.geocodeAddress(
            'Bellevueplatz 5, 8001 Zürich'
          ),
          address: 'Bellevueplatz 5, 8001 Zürich',
          type: 'delivery',
          orderId: 'ORDER-003',
          notes: 'Kunde: Weber, 5x Brötchen',
        },
      ]

      const calculatedRoute = await mapProvider.calculateRoute({
        origin: currentLocation,
        destinations: waypoints,
        vehicleType: 'car',
        optimizeFor: 'time',
      })

      setRoute(calculatedRoute)

      // Set mock delivery status
      setDeliveryStatus({
        id: 'delivery-001',
        orderId: waypoints[0].orderId!,
        driverId: 'driver-001',
        status: 'en-route',
        currentLocation: currentLocation,
        estimatedArrival: calculateETA(currentLocation, waypoints[0].location),
      })
    } catch (err) {
      setError(`Route konnte nicht berechnet werden: ${err}`)
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <h1>Lieferungen Dashboard</h1>
        <p className={styles.subtitle}>Bäckerei Heusser - Fahrer App</p>
      </div>

      {/* Map View */}
      <div className={styles.card}>
        <h2>Karte</h2>
        <div className={styles.mapContainer}>
          <Map
            currentLocation={currentLocation || undefined}
            route={route || undefined}
            height="400px"
          />
        </div>
      </div>

      {/* Location Status */}
      <div className={styles.card}>
        <h2>Aktueller Standort</h2>
        {currentLocation ? (
          <div>
            <p>
              Breite: {currentLocation.latitude.toFixed(6)}
              <br />
              Länge: {currentLocation.longitude.toFixed(6)}
            </p>
            {currentLocation.accuracy && (
              <p>Genauigkeit: ±{Math.round(currentLocation.accuracy)}m</p>
            )}
            {currentLocation.speed && (
              <p>
                Geschwindigkeit: {Math.round(currentLocation.speed * 3.6)} km/h
              </p>
            )}
          </div>
        ) : (
          <p>Standort wird ermittelt...</p>
        )}

        <div className={styles.buttonGroup}>
          {!isTracking ? (
            <button onClick={startTracking} className={styles.button}>
              Tracking starten
            </button>
          ) : (
            <button onClick={stopTracking} className={styles.buttonSecondary}>
              Tracking stoppen
            </button>
          )}
        </div>
      </div>

      {/* Delivery Status */}
      {deliveryStatus && (
        <div className={styles.card}>
          <h2>Aktuelle Lieferung</h2>
          <p>
            Auftrag: {deliveryStatus.orderId}
            <br />
            Status:{' '}
            {deliveryStatus.status === 'en-route'
              ? 'Unterwegs'
              : deliveryStatus.status}
            <br />
            {deliveryStatus.estimatedArrival && (
              <>
                Geschätzte Ankunft:{' '}
                {deliveryStatus.estimatedArrival.toLocaleTimeString('de-CH')}
              </>
            )}
          </p>
        </div>
      )}

      {/* Route Information */}
      <div className={styles.card}>
        <h2>Route</h2>
        {route ? (
          <div>
            <p>
              Distanz: {formatRouteDistance(route.distance)}
              <br />
              Geschätzte Dauer: {formatDuration(route.duration)}
            </p>

            <h3>Lieferpunkte:</h3>
            <ol className={styles.waypointList}>
              {route.waypoints.map((waypoint, index) => (
                <li key={index} className={styles.waypoint}>
                  <strong>{waypoint.address}</strong>
                  {waypoint.orderId && <span> (#{waypoint.orderId})</span>}
                  {waypoint.notes && (
                    <p className={styles.notes}>{waypoint.notes}</p>
                  )}
                  {currentLocation && index > 0 && (
                    <p className={styles.distance}>
                      Entfernung:{' '}
                      {formatDistance(
                        calculateHaversineDistance(
                          currentLocation,
                          waypoint.location
                        )
                      )}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div>
            <p>Keine Route geladen</p>
            <button onClick={loadSampleRoute} className={styles.button}>
              Beispielroute laden
            </button>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className={styles.error}>
          <p>{error}</p>
        </div>
      )}
    </main>
  )
}

// Helper function (duplicate from routing lib for now)
function calculateHaversineDistance(
  location1: Location,
  location2: Location
): number {
  const R = 6371e3
  const φ1 = (location1.latitude * Math.PI) / 180
  const φ2 = (location2.latitude * Math.PI) / 180
  const Δφ = ((location2.latitude - location1.latitude) * Math.PI) / 180
  const Δλ = ((location2.longitude - location1.longitude) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}
