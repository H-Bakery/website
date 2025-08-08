// Core delivery routing functionality

// Copy of Location interface to avoid cross-library dependency issues
export interface Location {
  latitude: number;
  longitude: number;
  timestamp: Date;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

export interface Route {
  id: string;
  waypoints: RouteWaypoint[];
  distance: number; // in meters
  duration: number; // in seconds
  polyline?: string; // encoded polyline for map display
}

export interface RouteWaypoint {
  location: Location;
  address: string;
  type: 'pickup' | 'delivery' | 'waypoint';
  orderId?: string;
  estimatedArrival?: Date;
  notes?: string;
}

export interface RouteOptimizationRequest {
  origin: Location;
  destinations: RouteWaypoint[];
  vehicleType?: 'bike' | 'car' | 'van';
  avoidHighways?: boolean;
  optimizeFor?: 'time' | 'distance';
}

export interface MapProvider {
  calculateRoute(request: RouteOptimizationRequest): Promise<Route>;
  getDirections(from: Location, to: Location): Promise<Route>;
  geocodeAddress(address: string): Promise<Location>;
  reverseGeocode(location: Location): Promise<string>;
}

// Mock implementation for development
export class MockMapProvider implements MapProvider {
  async calculateRoute(request: RouteOptimizationRequest): Promise<Route> {
    // Simple mock that returns waypoints in order
    const waypoints = [
      {
        ...request.destinations[0],
        location: request.origin,
        type: 'pickup' as const,
      },
      ...request.destinations,
    ];

    // Mock distance and duration calculation
    let totalDistance = 0;
    let totalDuration = 0;
    
    for (let i = 1; i < waypoints.length; i++) {
      const distance = this.calculateMockDistance(
        waypoints[i - 1].location,
        waypoints[i].location
      );
      totalDistance += distance;
      totalDuration += distance / 10; // Mock 10m/s average speed
    }

    return {
      id: `route-${Date.now()}`,
      waypoints,
      distance: totalDistance,
      duration: totalDuration,
    };
  }

  async getDirections(from: Location, to: Location): Promise<Route> {
    const distance = this.calculateMockDistance(from, to);
    
    return {
      id: `route-${Date.now()}`,
      waypoints: [
        {
          location: from,
          address: 'Start',
          type: 'pickup',
        },
        {
          location: to,
          address: 'Destination',
          type: 'delivery',
        },
      ],
      distance,
      duration: distance / 10,
    };
  }

  async geocodeAddress(address: string): Promise<Location> {
    // Mock geocoding - return center of Zurich with slight variation
    return {
      latitude: 47.3769 + (Math.random() - 0.5) * 0.1,
      longitude: 8.5417 + (Math.random() - 0.5) * 0.1,
      timestamp: new Date(),
    };
  }

  async reverseGeocode(location: Location): Promise<string> {
    // Mock reverse geocoding
    return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
  }

  private calculateMockDistance(from: Location, to: Location): number {
    // Simple Euclidean distance for mock
    const latDiff = to.latitude - from.latitude;
    const lonDiff = to.longitude - from.longitude;
    const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
    return distance * 111000; // Rough conversion to meters
  }
}

// Route optimization utilities
export function optimizeRouteOrder(waypoints: RouteWaypoint[]): RouteWaypoint[] {
  // Simple nearest neighbor algorithm for route optimization
  if (waypoints.length <= 2) return waypoints;

  const optimized: RouteWaypoint[] = [];
  const remaining = [...waypoints];
  
  // Start with the first waypoint
  let current = remaining.shift()!;
  optimized.push(current);

  while (remaining.length > 0) {
    // Find nearest waypoint
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const distance = calculateHaversineDistance(
        current.location,
        remaining[i].location
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    current = remaining.splice(nearestIndex, 1)[0];
    optimized.push(current);
  }

  return optimized;
}

function calculateHaversineDistance(location1: Location, location2: Location): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (location1.latitude * Math.PI) / 180;
  const φ2 = (location2.latitude * Math.PI) / 180;
  const Δφ = ((location2.latitude - location1.latitude) * Math.PI) / 180;
  const Δλ = ((location2.longitude - location1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ETA calculation utilities
export function calculateETA(
  currentLocation: Location,
  destination: Location,
  averageSpeed: number = 30 // km/h
): Date {
  const distance = calculateHaversineDistance(currentLocation, destination);
  const timeInHours = distance / 1000 / averageSpeed;
  const timeInMs = timeInHours * 60 * 60 * 1000;
  
  return new Date(Date.now() + timeInMs);
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes}min`;
}

export function formatRouteDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}