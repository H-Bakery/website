/**
 * Delivery controller for handling HTTP requests
 */

import { Request, Response } from 'express';
import { DeliveryService } from '../services/delivery.service';
import { 
  CreateDeliveryInput, 
  UpdateDeliveryInput,
  RouteOptimizationRequest,
  DeliveryStatus 
} from '../models/delivery.model';

export class DeliveryController {
  private deliveryService: DeliveryService;

  constructor() {
    this.deliveryService = new DeliveryService();
  }

  /**
   * Get all deliveries with optional filters
   * @route GET /api/deliveries
   */
  getDeliveries = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, driverId, date } = req.query;
      
      const filters = {
        status: status as DeliveryStatus,
        driverId: driverId ? parseInt(driverId as string) : undefined,
        date: date as string
      };

      const deliveries = await this.deliveryService.getAllDeliveries(filters);
      
      res.json({
        success: true,
        count: deliveries.length,
        data: deliveries
      });
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch deliveries'
      });
    }
  };

  /**
   * Get specific delivery by ID
   * @route GET /api/deliveries/:id
   */
  getDeliveryById = async (req: Request, res: Response): Promise<void> => {
    try {
      const deliveryId = parseInt(req.params['id']);
      const delivery = await this.deliveryService.getDeliveryById(deliveryId);
      
      if (!delivery) {
        res.status(404).json({
          success: false,
          error: 'Delivery not found'
        });
        return;
      }

      res.json({
        success: true,
        data: delivery
      });
    } catch (error) {
      console.error('Error fetching delivery:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch delivery'
      });
    }
  };

  /**
   * Create new delivery from order
   * @route POST /api/deliveries
   */
  createDelivery = async (req: Request, res: Response): Promise<void> => {
    try {
      const input: CreateDeliveryInput = req.body;
      
      // Validate required fields
      if (!input.orderId || !input.deliveryAddress || !input.deliveryDate || !input.deliveryTime) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
        return;
      }

      const delivery = await this.deliveryService.createDelivery(input);
      
      res.status(201).json({
        success: true,
        message: 'Delivery created successfully',
        data: delivery
      });
    } catch (error) {
      console.error('Error creating delivery:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create delivery'
      });
    }
  };

  /**
   * Update delivery status and details
   * @route PUT /api/deliveries/:id
   */
  updateDelivery = async (req: Request, res: Response): Promise<void> => {
    try {
      const deliveryId = parseInt(req.params['id']);
      const update: UpdateDeliveryInput = req.body;
      
      const delivery = await this.deliveryService.updateDeliveryStatus(deliveryId, update);
      
      res.json({
        success: true,
        message: 'Delivery updated successfully',
        data: delivery
      });
    } catch (error) {
      console.error('Error updating delivery:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to update delivery'
      });
    }
  };

  /**
   * Assign driver to delivery
   * @route PUT /api/deliveries/:id/assign
   */
  assignDriver = async (req: Request, res: Response): Promise<void> => {
    try {
      const deliveryId = parseInt(req.params['id']);
      const { driverId } = req.body;
      
      if (!driverId) {
        res.status(400).json({
          success: false,
          error: 'Driver ID is required'
        });
        return;
      }

      const delivery = await this.deliveryService.assignDriver(deliveryId, driverId);
      
      res.json({
        success: true,
        message: 'Driver assigned successfully',
        data: delivery
      });
    } catch (error) {
      console.error('Error assigning driver:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message
        });
        return;
      }
      
      if (error instanceof Error && error.message.includes('not available')) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to assign driver'
      });
    }
  };

  /**
   * Get optimized delivery routes
   * @route GET /api/deliveries/routes/:date
   */
  getOptimizedRoutes = async (req: Request, res: Response): Promise<void> => {
    try {
      const date = req.params['date'];
      const { driverId, strategy } = req.query;
      
      const request: RouteOptimizationRequest = {
        date,
        driverId: driverId ? parseInt(driverId as string) : undefined,
        optimizationStrategy: strategy as 'distance' | 'time' | 'balanced'
      };

      const result = await this.deliveryService.optimizeRoutes(request);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error optimizing routes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to optimize routes'
      });
    }
  };

  /**
   * Get delivery zones
   * @route GET /api/delivery-zones
   */
  getDeliveryZones = async (req: Request, res: Response): Promise<void> => {
    try {
      const zones = await this.deliveryService.getDeliveryZones();
      
      res.json({
        success: true,
        count: zones.length,
        data: zones
      });
    } catch (error) {
      console.error('Error fetching delivery zones:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch delivery zones'
      });
    }
  };

  /**
   * Track delivery status
   * @route GET /api/deliveries/:id/track
   */
  trackDelivery = async (req: Request, res: Response): Promise<void> => {
    try {
      const deliveryId = parseInt(req.params['id']);
      const tracking = await this.deliveryService.trackDelivery(deliveryId);
      
      res.json({
        success: true,
        data: tracking
      });
    } catch (error) {
      console.error('Error tracking delivery:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to track delivery'
      });
    }
  };

  /**
   * Get delivery statistics
   * @route GET /api/deliveries/stats
   */
  getDeliveryStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { date } = req.query;
      const stats = await this.deliveryService.getDeliveryStats(date as string);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching delivery stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch delivery statistics'
      });
    }
  };

  /**
   * Get deliveries by date
   * @route GET /api/deliveries/by-date/:date
   */
  getDeliveriesByDate = async (req: Request, res: Response): Promise<void> => {
    try {
      const date = req.params['date'];
      const deliveries = await this.deliveryService.getDeliveriesByDate(date);
      
      res.json({
        success: true,
        count: deliveries.length,
        data: deliveries
      });
    } catch (error) {
      console.error('Error fetching deliveries by date:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch deliveries'
      });
    }
  };

  /**
   * Get deliveries by driver
   * @route GET /api/deliveries/by-driver/:driverId
   */
  getDeliveriesByDriver = async (req: Request, res: Response): Promise<void> => {
    try {
      const driverId = parseInt(req.params['driverId']);
      const deliveries = await this.deliveryService.getDeliveriesByDriver(driverId);
      
      res.json({
        success: true,
        count: deliveries.length,
        data: deliveries
      });
    } catch (error) {
      console.error('Error fetching deliveries by driver:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch deliveries'
      });
    }
  };
}

// Export singleton instance
export const deliveryController = new DeliveryController();