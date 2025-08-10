/**
 * Unit tests for delivery service
 */

import { DeliveryService } from './delivery.service';
import { 
  DeliveryStatus, 
  DriverStatus, 
  VehicleType,
  CreateDeliveryInput 
} from '../models/delivery.model';

describe('DeliveryService', () => {
  let service: DeliveryService;

  beforeEach(() => {
    service = new DeliveryService();
  });

  describe('createDelivery', () => {
    it('should create a new delivery', async () => {
      const input: CreateDeliveryInput = {
        orderId: 42,
        deliveryAddress: {
          street: 'Main Street',
          houseNumber: '123',
          postalCode: '10001',
          city: 'New York'
        },
        deliveryDate: '2025-08-04',
        deliveryTime: '14:00-16:00',
        deliveryNotes: 'Ring bell twice'
      };

      const delivery = await service.createDelivery(input);

      expect(delivery).toBeDefined();
      expect(delivery.orderId).toBe(42);
      expect(delivery.status).toBe(DeliveryStatus.Pending);
      expect(delivery.deliveryAddress.street).toBe('Main Street');
      expect(delivery.trackingCode).toMatch(/^DLV-/);
      expect(delivery.attempts).toBe(0);
      expect(delivery.deliveryFee).toBeGreaterThan(0);
    });
  });

  describe('assignDriver', () => {
    it('should assign a driver to a delivery', async () => {
      // Create a delivery
      const delivery = await service.createDelivery({
        orderId: 42,
        deliveryAddress: {
          street: 'Main Street',
          houseNumber: '123',
          postalCode: '10001',
          city: 'New York'
        },
        deliveryDate: '2025-08-04',
        deliveryTime: '14:00-16:00'
      });

      // Create a driver
      const driver = await service.createDriver({
        name: 'John Doe',
        phone: '+1234567890',
        email: 'john@example.com',
        vehicleType: VehicleType.Car,
        status: DriverStatus.Available,
        maxDeliveries: 10,
        isActive: true
      });

      // Assign driver to delivery
      const updatedDelivery = await service.assignDriver(delivery.id, driver.id);

      expect(updatedDelivery.driverId).toBe(driver.id);
      expect(updatedDelivery.status).toBe(DeliveryStatus.Assigned);
    });

    it('should throw error if driver is not available', async () => {
      // Create a delivery
      const delivery = await service.createDelivery({
        orderId: 42,
        deliveryAddress: {
          street: 'Main Street',
          houseNumber: '123',
          postalCode: '10001',
          city: 'New York'
        },
        deliveryDate: '2025-08-04',
        deliveryTime: '14:00-16:00'
      });

      // Create a busy driver
      const driver = await service.createDriver({
        name: 'Jane Doe',
        phone: '+1234567890',
        email: 'jane@example.com',
        vehicleType: VehicleType.Van,
        status: DriverStatus.Busy,
        maxDeliveries: 10,
        isActive: true
      });

      // Try to assign busy driver
      await expect(
        service.assignDriver(delivery.id, driver.id)
      ).rejects.toThrow('not available');
    });
  });

  describe('updateDeliveryStatus', () => {
    it('should update delivery status to delivered', async () => {
      // Create and assign delivery
      const delivery = await service.createDelivery({
        orderId: 42,
        deliveryAddress: {
          street: 'Main Street',
          houseNumber: '123',
          postalCode: '10001',
          city: 'New York'
        },
        deliveryDate: '2025-08-04',
        deliveryTime: '14:00-16:00'
      });

      const driver = await service.createDriver({
        name: 'John Doe',
        phone: '+1234567890',
        email: 'john@example.com',
        vehicleType: VehicleType.Car,
        status: DriverStatus.Available,
        maxDeliveries: 10,
        isActive: true
      });

      await service.assignDriver(delivery.id, driver.id);

      // Update to delivered
      const updatedDelivery = await service.updateDeliveryStatus(delivery.id, {
        status: DeliveryStatus.Delivered,
        customerSignature: 'John Smith',
        deliveryPhoto: 'photo-url'
      });

      expect(updatedDelivery.status).toBe(DeliveryStatus.Delivered);
      expect(updatedDelivery.actualDeliveryTime).toBeDefined();
      expect(updatedDelivery.customerSignature).toBe('John Smith');
      expect(updatedDelivery.deliveryPhoto).toBe('photo-url');
    });

    it('should handle failed delivery', async () => {
      const delivery = await service.createDelivery({
        orderId: 42,
        deliveryAddress: {
          street: 'Main Street',
          houseNumber: '123',
          postalCode: '10001',
          city: 'New York'
        },
        deliveryDate: '2025-08-04',
        deliveryTime: '14:00-16:00'
      });

      const updatedDelivery = await service.updateDeliveryStatus(delivery.id, {
        status: DeliveryStatus.Failed,
        failureReason: 'Customer not available'
      });

      expect(updatedDelivery.status).toBe(DeliveryStatus.Failed);
      expect(updatedDelivery.attempts).toBe(1);
      expect(updatedDelivery.failureReason).toBe('Customer not available');
    });
  });

  describe('getDeliveriesByDate', () => {
    it('should return deliveries for specific date', async () => {
      // Create deliveries for different dates
      await service.createDelivery({
        orderId: 1,
        deliveryAddress: {
          street: 'Street 1',
          houseNumber: '1',
          postalCode: '10001',
          city: 'New York'
        },
        deliveryDate: '2025-08-04',
        deliveryTime: '10:00-12:00'
      });

      await service.createDelivery({
        orderId: 2,
        deliveryAddress: {
          street: 'Street 2',
          houseNumber: '2',
          postalCode: '10002',
          city: 'New York'
        },
        deliveryDate: '2025-08-04',
        deliveryTime: '14:00-16:00'
      });

      await service.createDelivery({
        orderId: 3,
        deliveryAddress: {
          street: 'Street 3',
          houseNumber: '3',
          postalCode: '10003',
          city: 'New York'
        },
        deliveryDate: '2025-08-05',
        deliveryTime: '10:00-12:00'
      });

      const deliveries = await service.getDeliveriesByDate('2025-08-04');
      expect(deliveries).toHaveLength(2);
      expect(deliveries.every(d => {
        const date = new Date(d.deliveryDate);
        return date.toISOString().startsWith('2025-08-04');
      })).toBe(true);
    });
  });

  describe('trackDelivery', () => {
    it('should return tracking information', async () => {
      const delivery = await service.createDelivery({
        orderId: 42,
        deliveryAddress: {
          street: 'Main Street',
          houseNumber: '123',
          postalCode: '10001',
          city: 'New York'
        },
        deliveryDate: '2025-08-04',
        deliveryTime: '14:00-16:00'
      });

      const tracking = await service.trackDelivery(delivery.id);

      expect(tracking.deliveryId).toBe(delivery.id);
      expect(tracking.trackingCode).toBe(delivery.trackingCode);
      expect(tracking.status).toBe(DeliveryStatus.Pending);
      expect(tracking.updates).toHaveLength(1);
      expect(tracking.updates[0].status).toBe(DeliveryStatus.Pending);
    });
  });

  describe('getDeliveryStats', () => {
    it('should calculate delivery statistics', async () => {
      // Create some test deliveries
      const delivery1 = await service.createDelivery({
        orderId: 1,
        deliveryAddress: {
          street: 'Street 1',
          houseNumber: '1',
          postalCode: '10001',
          city: 'New York'
        },
        deliveryDate: new Date(),
        deliveryTime: '10:00-12:00'
      });

      const delivery2 = await service.createDelivery({
        orderId: 2,
        deliveryAddress: {
          street: 'Street 2',
          houseNumber: '2',
          postalCode: '10201',
          city: 'New York'
        },
        deliveryDate: new Date(),
        deliveryTime: '14:00-16:00'
      });

      // Update one to delivered
      await service.updateDeliveryStatus(delivery1.id, {
        status: DeliveryStatus.Delivered
      });

      const stats = await service.getDeliveryStats();

      expect(stats.totalDeliveries).toBe(2);
      expect(stats.pendingDeliveries).toBe(1);
      expect(stats.completedDeliveries).toBe(1);
      expect(stats.failedDeliveries).toBe(0);
      expect(stats.totalRevenue).toBeGreaterThan(0);
    });
  });
});