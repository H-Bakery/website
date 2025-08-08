/**
 * Delivery domain models and interfaces
 */

/**
 * Base entity interface - defined locally to avoid TypeScript rootDir issues
 * Same structure as @bakery/shared/types BaseEntity
 */
export interface BaseEntity {
  id: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Delivery status enum
 */
export enum DeliveryStatus {
  Pending = 'pending',
  Assigned = 'assigned',
  InTransit = 'in_transit',
  Delivered = 'delivered',
  Failed = 'failed',
  Cancelled = 'cancelled'
}

/**
 * Vehicle type enum
 */
export enum VehicleType {
  Bicycle = 'bicycle',
  Scooter = 'scooter',
  Car = 'car',
  Van = 'van'
}

/**
 * Driver status enum
 */
export enum DriverStatus {
  Available = 'available',
  Busy = 'busy',
  Offline = 'offline',
  Break = 'break'
}

/**
 * Geographic coordinates
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Address with geocoding
 */
export interface DeliveryAddress {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country?: string;
  coordinates?: Coordinates;
  notes?: string;
}

/**
 * Main delivery entity
 */
export interface Delivery extends BaseEntity {
  orderId: number;
  driverId?: number;
  deliveryAddress: DeliveryAddress;
  deliveryDate: Date;
  deliveryTime: string; // Time window e.g., "14:00-16:00"
  status: DeliveryStatus;
  estimatedArrival?: Date;
  actualDeliveryTime?: Date;
  deliveryNotes?: string;
  customerSignature?: string;
  deliveryPhoto?: string;
  distance?: number; // in kilometers
  deliveryFee: number;
  attempts: number;
  failureReason?: string;
  trackingCode: string;
}

/**
 * Delivery driver information
 */
export interface DeliveryDriver extends BaseEntity {
  name: string;
  phone: string;
  email: string;
  vehicleType: VehicleType;
  vehiclePlate?: string;
  status: DriverStatus;
  currentLocation?: Coordinates;
  maxDeliveries: number;
  rating?: number;
  isActive: boolean;
}

/**
 * Delivery route for optimization
 */
export interface DeliveryRoute extends BaseEntity {
  driverId: number;
  date: Date;
  deliveries: number[]; // Array of delivery IDs in optimized order
  optimizedRoute?: Coordinates[]; // Waypoints for navigation
  totalDistance: number;
  estimatedDuration: number; // in minutes
  startTime: Date;
  endTime?: Date;
  status: 'planned' | 'active' | 'completed';
}

/**
 * Delivery zone for geographic organization
 */
export interface DeliveryZone extends BaseEntity {
  name: string;
  description?: string;
  polygon: Coordinates[]; // Geographic boundaries
  deliveryFee: number;
  estimatedMinutes: number;
  maxRadius?: number; // in kilometers
  isActive: boolean;
}

/**
 * Delivery statistics
 */
export interface DeliveryStats {
  totalDeliveries: number;
  pendingDeliveries: number;
  completedDeliveries: number;
  failedDeliveries: number;
  averageDeliveryTime: number;
  totalRevenue: number;
  activeDrivers: number;
  deliveriesByZone: Record<string, number>;
}

/**
 * Create delivery input
 */
export interface CreateDeliveryInput {
  orderId: number;
  deliveryAddress: DeliveryAddress;
  deliveryDate: Date | string;
  deliveryTime: string;
  deliveryNotes?: string;
  deliveryFee?: number;
}

/**
 * Update delivery input
 */
export interface UpdateDeliveryInput {
  driverId?: number;
  status?: DeliveryStatus;
  estimatedArrival?: Date | string;
  actualDeliveryTime?: Date | string;
  deliveryNotes?: string;
  customerSignature?: string;
  deliveryPhoto?: string;
  failureReason?: string;
}

/**
 * Delivery tracking info
 */
export interface DeliveryTracking {
  deliveryId: number;
  trackingCode: string;
  status: DeliveryStatus;
  driverName?: string;
  driverPhone?: string;
  currentLocation?: Coordinates;
  estimatedArrival?: Date;
  updates: TrackingUpdate[];
}

/**
 * Tracking update entry
 */
export interface TrackingUpdate {
  timestamp: Date;
  status: DeliveryStatus;
  location?: Coordinates;
  notes?: string;
}

/**
 * Route optimization request
 */
export interface RouteOptimizationRequest {
  date: Date | string;
  driverId?: number;
  maxDeliveriesPerDriver?: number;
  optimizationStrategy?: 'distance' | 'time' | 'balanced';
}

/**
 * Route optimization result
 */
export interface RouteOptimizationResult {
  routes: DeliveryRoute[];
  totalDistance: number;
  totalDuration: number;
  unassignedDeliveries: number[];
  efficiency: number; // 0-100 score
}