// Shared types for delivery tracking
export interface Location {
  latitude: number;
  longitude: number;
  timestamp: Date;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

export interface DeliveryStatus {
  id: string;
  orderId: string;
  driverId: string;
  status: 'pending' | 'en-route' | 'delivered' | 'cancelled';
  currentLocation?: Location;
  estimatedArrival?: Date;
  completedAt?: Date;
}

export interface TrackingUpdate {
  deliveryId: string;
  location: Location;
  status?: DeliveryStatus['status'];
}