/**
 * Delivery service for managing deliveries and routes
 */

import {
  Delivery,
  DeliveryStatus,
  DeliveryDriver,
  DeliveryRoute,
  DeliveryZone,
  CreateDeliveryInput,
  UpdateDeliveryInput,
  DeliveryStats,
  DeliveryTracking,
  TrackingUpdate,
  RouteOptimizationRequest,
  RouteOptimizationResult,
  Coordinates,
  DriverStatus
} from '../models/delivery.model';

export class DeliveryService {
  // In a real implementation, these would be database queries
  private deliveries: Map<number, Delivery> = new Map();
  private drivers: Map<number, DeliveryDriver> = new Map();
  private routes: Map<number, DeliveryRoute> = new Map();
  private zones: Map<number, DeliveryZone> = new Map();
  private trackingUpdates: Map<number, TrackingUpdate[]> = new Map();
  private nextId = 1;

  /**
   * Create a new delivery from an order
   */
  async createDelivery(input: CreateDeliveryInput): Promise<Delivery> {
    const delivery: Delivery = {
      id: this.nextId++,
      orderId: input.orderId,
      deliveryAddress: input.deliveryAddress,
      deliveryDate: new Date(input.deliveryDate),
      deliveryTime: input.deliveryTime,
      status: DeliveryStatus.Pending,
      deliveryFee: input.deliveryFee || this.calculateDeliveryFee(input.deliveryAddress),
      attempts: 0,
      trackingCode: this.generateTrackingCode(),
      deliveryNotes: input.deliveryNotes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.deliveries.set(delivery.id, delivery);
    this.trackingUpdates.set(delivery.id, [{
      timestamp: new Date(),
      status: DeliveryStatus.Pending,
      notes: 'Delivery created'
    }]);

    return delivery;
  }

  /**
   * Assign a driver to a delivery
   */
  async assignDriver(deliveryId: number, driverId: number): Promise<Delivery> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) {
      throw new Error(`Delivery ${deliveryId} not found`);
    }

    const driver = this.drivers.get(driverId);
    if (!driver) {
      throw new Error(`Driver ${driverId} not found`);
    }

    if (driver.status !== DriverStatus.Available) {
      throw new Error(`Driver ${driverId} is not available`);
    }

    delivery.driverId = driverId;
    delivery.status = DeliveryStatus.Assigned;
    delivery.updatedAt = new Date().toISOString();

    // Update driver status
    driver.status = DriverStatus.Busy;

    // Add tracking update
    this.addTrackingUpdate(deliveryId, {
      timestamp: new Date(),
      status: DeliveryStatus.Assigned,
      notes: `Assigned to driver ${driver.name}`
    });

    return delivery;
  }

  /**
   * Update delivery status and details
   */
  async updateDeliveryStatus(
    deliveryId: number, 
    update: UpdateDeliveryInput
  ): Promise<Delivery> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) {
      throw new Error(`Delivery ${deliveryId} not found`);
    }

    // Update fields if provided
    if (update.status !== undefined) {
      delivery.status = update.status;
      
      // Handle status-specific logic
      if (update.status === DeliveryStatus.Delivered) {
        delivery.actualDeliveryTime = new Date();
        if (delivery.driverId) {
          const driver = this.drivers.get(delivery.driverId);
          if (driver) {
            driver.status = DriverStatus.Available;
          }
        }
      } else if (update.status === DeliveryStatus.Failed) {
        delivery.attempts++;
        delivery.failureReason = update.failureReason;
      }
    }

    if (update.estimatedArrival !== undefined) {
      delivery.estimatedArrival = new Date(update.estimatedArrival);
    }

    if (update.customerSignature !== undefined) {
      delivery.customerSignature = update.customerSignature;
    }

    if (update.deliveryPhoto !== undefined) {
      delivery.deliveryPhoto = update.deliveryPhoto;
    }

    if (update.deliveryNotes !== undefined) {
      delivery.deliveryNotes = update.deliveryNotes;
    }

    delivery.updatedAt = new Date().toISOString();

    // Add tracking update
    this.addTrackingUpdate(deliveryId, {
      timestamp: new Date(),
      status: delivery.status,
      notes: update.deliveryNotes
    });

    return delivery;
  }

  /**
   * Get deliveries by date
   */
  async getDeliveriesByDate(date: Date | string): Promise<Delivery[]> {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    return Array.from(this.deliveries.values()).filter(delivery => {
      const deliveryDate = new Date(delivery.deliveryDate);
      deliveryDate.setHours(0, 0, 0, 0);
      return deliveryDate.getTime() === targetDate.getTime();
    });
  }

  /**
   * Get deliveries by driver
   */
  async getDeliveriesByDriver(driverId: number): Promise<Delivery[]> {
    return Array.from(this.deliveries.values()).filter(
      delivery => delivery.driverId === driverId
    );
  }

  /**
   * Get delivery by ID
   */
  async getDeliveryById(deliveryId: number): Promise<Delivery | null> {
    return this.deliveries.get(deliveryId) || null;
  }

  /**
   * Get all deliveries with optional filters
   */
  async getAllDeliveries(filters?: {
    status?: DeliveryStatus;
    driverId?: number;
    date?: Date | string;
  }): Promise<Delivery[]> {
    let deliveries = Array.from(this.deliveries.values());

    if (filters?.status) {
      deliveries = deliveries.filter(d => d.status === filters.status);
    }

    if (filters?.driverId) {
      deliveries = deliveries.filter(d => d.driverId === filters.driverId);
    }

    if (filters?.date) {
      const targetDate = new Date(filters.date);
      targetDate.setHours(0, 0, 0, 0);
      deliveries = deliveries.filter(d => {
        const deliveryDate = new Date(d.deliveryDate);
        deliveryDate.setHours(0, 0, 0, 0);
        return deliveryDate.getTime() === targetDate.getTime();
      });
    }

    return deliveries;
  }

  /**
   * Optimize delivery routes for a given date
   */
  async optimizeRoutes(request: RouteOptimizationRequest): Promise<RouteOptimizationResult> {
    const deliveries = await this.getDeliveriesByDate(request.date);
    const pendingDeliveries = deliveries.filter(d => d.status === DeliveryStatus.Pending);
    
    // Get available drivers
    const availableDrivers = Array.from(this.drivers.values()).filter(
      driver => driver.status === DriverStatus.Available && driver.isActive
    );

    if (availableDrivers.length === 0) {
      return {
        routes: [],
        totalDistance: 0,
        totalDuration: 0,
        unassignedDeliveries: pendingDeliveries.map(d => d.id),
        efficiency: 0
      };
    }

    // Simple route optimization - group by zones and assign to drivers
    const routes: DeliveryRoute[] = [];
    const assignedDeliveries = new Set<number>();
    let totalDistance = 0;
    let totalDuration = 0;

    // Distribute deliveries among drivers
    const deliveriesPerDriver = Math.ceil(pendingDeliveries.length / availableDrivers.length);

    for (let i = 0; i < availableDrivers.length && assignedDeliveries.size < pendingDeliveries.length; i++) {
      const driver = availableDrivers[i];
      const driverDeliveries: number[] = [];
      
      // Assign deliveries to this driver
      for (const delivery of pendingDeliveries) {
        if (!assignedDeliveries.has(delivery.id) && driverDeliveries.length < deliveriesPerDriver) {
          driverDeliveries.push(delivery.id);
          assignedDeliveries.add(delivery.id);
        }
      }

      if (driverDeliveries.length > 0) {
        // Create route for this driver
        const route: DeliveryRoute = {
          id: this.nextId++,
          driverId: driver.id,
          date: new Date(request.date),
          deliveries: driverDeliveries,
          totalDistance: this.calculateRouteDistance(driverDeliveries),
          estimatedDuration: this.calculateRouteDuration(driverDeliveries),
          startTime: new Date(),
          status: 'planned',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        routes.push(route);
        this.routes.set(route.id, route);
        
        totalDistance += route.totalDistance;
        totalDuration += route.estimatedDuration;
      }
    }

    const unassignedDeliveries = pendingDeliveries
      .filter(d => !assignedDeliveries.has(d.id))
      .map(d => d.id);

    const efficiency = pendingDeliveries.length > 0 
      ? (assignedDeliveries.size / pendingDeliveries.length) * 100 
      : 100;

    return {
      routes,
      totalDistance,
      totalDuration,
      unassignedDeliveries,
      efficiency
    };
  }

  /**
   * Track delivery status
   */
  async trackDelivery(deliveryId: number): Promise<DeliveryTracking> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) {
      throw new Error(`Delivery ${deliveryId} not found`);
    }

    const updates = this.trackingUpdates.get(deliveryId) || [];
    let driverName: string | undefined;
    let driverPhone: string | undefined;
    let currentLocation: Coordinates | undefined;

    if (delivery.driverId) {
      const driver = this.drivers.get(delivery.driverId);
      if (driver) {
        driverName = driver.name;
        driverPhone = driver.phone;
        currentLocation = driver.currentLocation;
      }
    }

    return {
      deliveryId: delivery.id,
      trackingCode: delivery.trackingCode,
      status: delivery.status,
      driverName,
      driverPhone,
      currentLocation,
      estimatedArrival: delivery.estimatedArrival,
      updates
    };
  }

  /**
   * Calculate delivery statistics
   */
  async getDeliveryStats(date?: Date | string): Promise<DeliveryStats> {
    let deliveries = Array.from(this.deliveries.values());
    
    if (date) {
      deliveries = await this.getDeliveriesByDate(date);
    }

    const stats: DeliveryStats = {
      totalDeliveries: deliveries.length,
      pendingDeliveries: deliveries.filter(d => d.status === DeliveryStatus.Pending).length,
      completedDeliveries: deliveries.filter(d => d.status === DeliveryStatus.Delivered).length,
      failedDeliveries: deliveries.filter(d => d.status === DeliveryStatus.Failed).length,
      averageDeliveryTime: this.calculateAverageDeliveryTime(deliveries),
      totalRevenue: deliveries.reduce((sum, d) => sum + d.deliveryFee, 0),
      activeDrivers: Array.from(this.drivers.values()).filter(
        d => d.status === DriverStatus.Busy
      ).length,
      deliveriesByZone: this.groupDeliveriesByZone(deliveries)
    };

    return stats;
  }

  /**
   * Get all delivery zones
   */
  async getDeliveryZones(): Promise<DeliveryZone[]> {
    return Array.from(this.zones.values()).filter(zone => zone.isActive);
  }

  /**
   * Calculate delivery fee based on address and zone
   */
  private calculateDeliveryFee(address: any): number {
    // Simple fee calculation - in reality would use zone boundaries
    return 3.50; // Default delivery fee
  }

  /**
   * Generate unique tracking code
   */
  private generateTrackingCode(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `DLV-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Add tracking update
   */
  private addTrackingUpdate(deliveryId: number, update: TrackingUpdate): void {
    const updates = this.trackingUpdates.get(deliveryId) || [];
    updates.push(update);
    this.trackingUpdates.set(deliveryId, updates);
  }

  /**
   * Calculate route distance (simplified)
   */
  private calculateRouteDistance(deliveryIds: number[]): number {
    // In reality, would calculate actual distance between addresses
    return deliveryIds.length * 2.5; // 2.5km average per delivery
  }

  /**
   * Calculate route duration (simplified)
   */
  private calculateRouteDuration(deliveryIds: number[]): number {
    // In reality, would calculate based on distance and traffic
    return deliveryIds.length * 15; // 15 minutes average per delivery
  }

  /**
   * Calculate average delivery time
   */
  private calculateAverageDeliveryTime(deliveries: Delivery[]): number {
    const completedDeliveries = deliveries.filter(
      d => d.status === DeliveryStatus.Delivered && d.actualDeliveryTime
    );

    if (completedDeliveries.length === 0) return 0;

    const totalMinutes = completedDeliveries.reduce((sum, d) => {
      const created = new Date(d.createdAt).getTime();
      const delivered = new Date(d.actualDeliveryTime!).getTime();
      return sum + (delivered - created) / (1000 * 60); // Convert to minutes
    }, 0);

    return Math.round(totalMinutes / completedDeliveries.length);
  }

  /**
   * Group deliveries by zone
   */
  private groupDeliveriesByZone(deliveries: Delivery[]): Record<string, number> {
    // Simplified - in reality would check address against zone boundaries
    const zones: Record<string, number> = {
      'City Center': 0,
      'North': 0,
      'South': 0,
      'East': 0,
      'West': 0
    };

    deliveries.forEach(delivery => {
      // Simple zone assignment based on postal code
      const postalCode = delivery.deliveryAddress.postalCode;
      if (postalCode.startsWith('100')) zones['City Center']++;
      else if (postalCode.startsWith('101')) zones['North']++;
      else if (postalCode.startsWith('102')) zones['South']++;
      else if (postalCode.startsWith('103')) zones['East']++;
      else if (postalCode.startsWith('104')) zones['West']++;
    });

    return zones;
  }

  /**
   * Create a driver (for testing)
   */
  async createDriver(driver: Omit<DeliveryDriver, 'id' | 'createdAt' | 'updatedAt'>): Promise<DeliveryDriver> {
    const newDriver: DeliveryDriver = {
      ...driver,
      id: this.nextId++,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.drivers.set(newDriver.id, newDriver);
    return newDriver;
  }

  /**
   * Create a zone (for testing)
   */
  async createZone(zone: Omit<DeliveryZone, 'id' | 'createdAt' | 'updatedAt'>): Promise<DeliveryZone> {
    const newZone: DeliveryZone = {
      ...zone,
      id: this.nextId++,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.zones.set(newZone.id, newZone);
    return newZone;
  }
}