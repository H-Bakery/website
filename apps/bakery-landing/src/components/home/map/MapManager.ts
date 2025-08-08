/**
 * Global Map Manager - Singleton to prevent multiple map initializations
 * Handles the "Map container is already initialized" error in React StrictMode
 */

import L from 'leaflet'

interface MapInstance {
  id: string
  map: L.Map
  container: HTMLElement
  initialized: boolean
}

class MapManager {
  private static instance: MapManager
  private maps: Map<string, MapInstance> = new Map()
  private initializingContainers: Set<string> = new Set()

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): MapManager {
    if (!MapManager.instance) {
      MapManager.instance = new MapManager()
    }
    return MapManager.instance
  }

  /**
   * Check if a container is already initialized or being initialized
   */
  isContainerInitialized(containerId: string): boolean {
    return (
      this.maps.has(containerId) || this.initializingContainers.has(containerId)
    )
  }

  /**
   * Register a map initialization attempt
   */
  registerInitialization(containerId: string): boolean {
    if (this.isContainerInitialized(containerId)) {
      console.warn(
        `Map container ${containerId} is already initialized or being initialized`
      )
      return false
    }

    this.initializingContainers.add(containerId)
    return true
  }

  /**
   * Register a successfully created map
   */
  registerMap(containerId: string, map: L.Map, container: HTMLElement): void {
    this.initializingContainers.delete(containerId)
    this.maps.set(containerId, {
      id: containerId,
      map,
      container,
      initialized: true,
    })
  }

  /**
   * Get an existing map instance
   */
  getMap(containerId: string): L.Map | null {
    const mapInstance = this.maps.get(containerId)
    return mapInstance?.map || null
  }

  /**
   * Clean up a specific map
   */
  cleanup(containerId: string): void {
    const mapInstance = this.maps.get(containerId)

    if (mapInstance) {
      try {
        // Remove all event listeners
        mapInstance.map.off()
        // Remove the map
        mapInstance.map.remove()
      } catch (error) {
        console.debug(`Map cleanup error for ${containerId} (ignored):`, error)
      }

      this.maps.delete(containerId)
    }

    // Also remove from initializing set
    this.initializingContainers.delete(containerId)
  }

  /**
   * Clean up all maps (useful for development hot reloading)
   */
  cleanupAll(): void {
    // Use forEach for Map iteration to avoid TypeScript compilation issues
    this.maps.forEach((_, containerId) => {
      this.cleanup(containerId)
    })
    this.initializingContainers.clear()
  }

  /**
   * Get status for debugging
   */
  getStatus(): {
    initialized: string[]
    initializing: string[]
    total: number
  } {
    return {
      initialized: Array.from(this.maps.keys()),
      initializing: Array.from(this.initializingContainers),
      total: this.maps.size,
    }
  }

  /**
   * Force cleanup of a DOM element that might be stuck
   */
  forceCleanupElement(element: HTMLElement): void {
    const elementId = element.id || `element-${Date.now()}`

    // Try to find any Leaflet map instances attached to this element
    try {
      // Check if element has Leaflet map data
      const leafletId = (element as any)._leaflet_id
      if (leafletId) {
        // Remove Leaflet's internal references
        delete (element as any)._leaflet_id
        delete (element as any)._leaflet
      }

      // Clear any remaining map containers
      element.innerHTML = ''

      // Remove from our tracking
      this.maps.forEach((mapInstance, containerId) => {
        if (mapInstance.container === element) {
          this.cleanup(containerId)
        }
      })
    } catch (error) {
      console.debug(`Force cleanup error for ${elementId} (ignored):`, error)
    }
  }
}

// Export singleton instance
export const mapManager = MapManager.getInstance()

// Development helper - expose to window for debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  ;(window as any).mapManager = mapManager
}
