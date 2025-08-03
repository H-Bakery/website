import { Request, Response } from 'express';
import { InventoryService } from '../services/inventory.service';
import { logger } from '@bakery/api/core';

interface InventoryFilters {
  category?: string;
  lowStock?: boolean;
  search?: string;
  supplier?: string;
  isActive?: boolean;
}

interface StockAdjustment {
  id: number;
  change: number;
}

export class InventoryController {
  private static inventoryService = new InventoryService();

  // Create new inventory item
  static async createInventoryItem(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Creating new inventory item: ' + JSON.stringify(req.body));
      
      const item = await InventoryController.inventoryService.createItem(req.body);
      
      res.status(201).json({
        success: true,
        data: item,
        message: 'Inventory item created successfully'
      });
    } catch (error: any) {
      logger.error('Error creating inventory item:', error);
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        res.status(400).json({
          success: false,
          error: 'An item with this name or SKU already exists'
        });
        return;
      }
      
      if (error.name === 'SequelizeValidationError') {
        res.status(400).json({
          success: false,
          error: error.errors.map((e: any) => e.message).join(', ')
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to create inventory item'
      });
    }
  }

  // Get all inventory items
  static async getInventoryItems(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Retrieving inventory items: ' + JSON.stringify(req.query));
      
      const filters: InventoryFilters = {
        category: req.query['category'] as string,
        lowStock: req.query['lowStock'] === 'true',
        search: req.query['search'] as string,
        supplier: req.query['supplier'] as string,
        isActive: req.query['isActive'] !== undefined ? req.query['isActive'] === 'true' : true
      };
      
      const items = await InventoryController.inventoryService.getAllItems(filters);
      
      // Add pagination info if requested
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || items.length;
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      
      const paginatedItems = limit < items.length ? items.slice(startIndex, endIndex) : items;
      
      res.json({
        success: true,
        data: paginatedItems,
        pagination: {
          total: items.length,
          page,
          limit,
          pages: Math.ceil(items.length / limit)
        }
      });
    } catch (error) {
      logger.error('Error retrieving inventory items:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve inventory items'
      });
    }
  }

  // Get single inventory item
  static async getInventoryItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      logger.info(`Retrieving inventory item: ${id}`);
      
      const item = await InventoryController.inventoryService.getItemById(parseInt(id));
      
      if (!item) {
        res.status(404).json({
          success: false,
          error: 'Inventory item not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      logger.error(`Error retrieving inventory item ${req.params['id']}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve inventory item'
      });
    }
  }

  // Update inventory item (non-stock details)
  static async updateInventoryItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      logger.info(`Updating inventory item: ${id} - ${JSON.stringify(req.body)}`);
      
      const item = await InventoryController.inventoryService.updateItemDetails(parseInt(id), req.body);
      
      if (!item) {
        res.status(404).json({
          success: false,
          error: 'Inventory item not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: item,
        message: 'Inventory item updated successfully'
      });
    } catch (error: any) {
      logger.error(`Error updating inventory item ${req.params['id']}:`, error);
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        res.status(400).json({
          success: false,
          error: 'An item with this name or SKU already exists'
        });
        return;
      }
      
      if (error.name === 'SequelizeValidationError') {
        res.status(400).json({
          success: false,
          error: error.errors.map((e: any) => e.message).join(', ')
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to update inventory item'
      });
    }
  }

  // Adjust stock level
  static async adjustStock(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { change, reason } = req.body;
      
      logger.info(`Adjusting stock for item: ${id} - change: ${change}, reason: ${reason}`);
      
      if (typeof change !== 'number') {
        res.status(400).json({
          success: false,
          error: 'Change must be a number'
        });
        return;
      }
      
      const item = await InventoryController.inventoryService.adjustStockLevel(parseInt(id), change, reason);
      
      if (!item) {
        res.status(404).json({
          success: false,
          error: 'Inventory item not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: item,
        message: `Stock ${change > 0 ? 'increased' : 'decreased'} successfully`
      });
    } catch (error: any) {
      logger.error(`Error adjusting stock for item ${req.params['id']}:`, error);
      
      if (error.code === 'INSUFFICIENT_STOCK') {
        res.status(400).json({
          success: false,
          error: error.message,
          available: error.available,
          requested: error.requested
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to adjust stock level'
      });
    }
  }

  // Delete inventory item
  static async deleteInventoryItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      logger.info(`Deleting inventory item: ${id}`);
      
      const deleted = await InventoryController.inventoryService.deleteItem(parseInt(id));
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Inventory item not found'
        });
        return;
      }
      
      res.json({
        success: true,
        message: 'Inventory item deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting inventory item ${req.params['id']}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete inventory item'
      });
    }
  }

  // Get items needing reorder
  static async getItemsNeedingReorder(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Retrieving items needing reorder');
      
      const items = await InventoryController.inventoryService.getItemsNeedingReorder();
      
      res.json({
        success: true,
        data: items,
        count: items.length
      });
    } catch (error) {
      logger.error('Error retrieving items needing reorder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve items needing reorder'
      });
    }
  }

  // Get low stock items
  static async getLowStockItems(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Retrieving low stock items');
      
      const items = await InventoryController.inventoryService.getLowStockItems();
      
      res.json({
        success: true,
        data: items,
        count: items.length
      });
    } catch (error) {
      logger.error('Error retrieving low stock items:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve low stock items'
      });
    }
  }

  // Bulk adjust stock
  static async bulkAdjustStock(req: Request, res: Response): Promise<void> {
    try {
      const { adjustments, reason } = req.body;
      
      logger.info(`Processing bulk stock adjustment - count: ${adjustments?.length}, reason: ${reason}`);
      
      if (!Array.isArray(adjustments) || adjustments.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Adjustments must be a non-empty array'
        });
        return;
      }
      
      // Validate all adjustments have required fields
      const invalid = adjustments.find((adj: StockAdjustment) => 
        typeof adj.id !== 'number' || typeof adj.change !== 'number'
      );
      
      if (invalid) {
        res.status(400).json({
          success: false,
          error: 'Each adjustment must have id and change as numbers'
        });
        return;
      }
      
      const results = await InventoryController.inventoryService.bulkAdjustStock(adjustments, reason);
      
      res.json({
        success: true,
        data: results,
        message: `Bulk adjustment completed: ${results.successful.length} successful, ${results.failed.length} failed`
      });
    } catch (error) {
      logger.error('Error in bulk stock adjustment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process bulk stock adjustment'
      });
    }
  }
}