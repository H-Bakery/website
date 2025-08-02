import { Op } from 'sequelize';
import { Inventory, InventoryCreationAttributes } from '../models/inventory.model';
import { logger } from '@bakery/api/core';
import { createLowInventoryNotification } from '@bakery/api/notifications';

interface InventoryFilters {
  category?: string;
  lowStock?: boolean | string;
  search?: string;
  supplier?: string;
  isActive?: boolean | string;
}

interface StockAdjustment {
  id: number;
  change: number;
}

interface StockAdjustmentResult {
  id: number;
  name: string;
  oldQuantity: number;
  newQuantity: number;
  change: number;
}

interface FailedAdjustment {
  id: number;
  change: number;
  error: string;
}

interface BulkAdjustmentResults {
  successful: StockAdjustmentResult[];
  failed: FailedAdjustment[];
}

export class InventoryService {
  /**
   * Create a new inventory item
   * @param itemData - The inventory item data
   * @returns The created inventory item
   */
  async createItem(itemData: InventoryCreationAttributes): Promise<Inventory> {
    try {
      logger.info(`Creating new inventory item: ${itemData.name}`);
      const item = await Inventory.create(itemData);
      logger.info(`Inventory item created successfully: ${item.id}`);
      return item;
    } catch (error) {
      logger.error('Error creating inventory item:', error);
      throw error;
    }
  }

  /**
   * Get all inventory items with optional filtering
   * @param filters - Optional filters (category, lowStock, etc.)
   * @returns Array of inventory items
   */
  async getAllItems(filters: InventoryFilters = {}): Promise<Inventory[]> {
    try {
      const where: any = {};
      
      // Apply category filter
      if (filters.category) {
        where.category = filters.category;
      }

      // Apply low stock filter
      if (filters.lowStock === true || filters.lowStock === 'true') {
        where[Op.and] = [
          { quantity: { [Op.lte]: Inventory.sequelize!.col('lowStockThreshold') } },
          { isActive: true }
        ];
      } else if (filters.isActive !== undefined) {
        where.isActive = filters.isActive === true || filters.isActive === 'true';
      }

      // Apply search filter
      if (filters.search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${filters.search}%` } },
          { sku: { [Op.like]: `%${filters.search}%` } },
          { description: { [Op.like]: `%${filters.search}%` } }
        ];
      }

      // Apply supplier filter
      if (filters.supplier) {
        where.supplier = { [Op.like]: `%${filters.supplier}%` };
      }

      logger.info(`Retrieving inventory items with filters: ${JSON.stringify(filters)}`);
      const items = await Inventory.findAll({
        where,
        order: [['name', 'ASC']]
      });

      logger.info(`Retrieved ${items.length} inventory items`);
      return items;
    } catch (error) {
      logger.error('Error retrieving inventory items:', error);
      throw error;
    }
  }

  /**
   * Get a single inventory item by ID
   * @param id - The inventory item ID
   * @returns The inventory item or null if not found
   */
  async getItemById(id: number): Promise<Inventory | null> {
    try {
      logger.info(`Retrieving inventory item: ${id}`);
      const item = await Inventory.findByPk(id);
      
      if (!item) {
        logger.warn(`Inventory item not found: ${id}`);
        return null;
      }

      logger.info(`Inventory item retrieved: ${id}`);
      return item;
    } catch (error) {
      logger.error(`Error retrieving inventory item ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update inventory item details (excluding stock quantity)
   * @param id - The inventory item ID
   * @param updateData - The data to update
   * @returns The updated inventory item
   */
  async updateItemDetails(id: number, updateData: Partial<InventoryCreationAttributes>): Promise<Inventory | null> {
    try {
      logger.info(`Updating inventory item: ${id} - ${JSON.stringify(updateData)}`);
      
      // Remove quantity from update data to prevent direct stock updates
      const { quantity, ...safeUpdateData } = updateData;
      
      const item = await Inventory.findByPk(id);
      if (!item) {
        logger.warn(`Inventory item not found for update: ${id}`);
        return null;
      }

      await item.update(safeUpdateData);
      logger.info(`Inventory item updated successfully: ${id}`);
      return item;
    } catch (error) {
      logger.error(`Error updating inventory item ${id}:`, error);
      throw error;
    }
  }

  /**
   * Adjust stock level (increase or decrease)
   * @param id - The inventory item ID
   * @param change - The quantity change (positive or negative)
   * @param reason - Optional reason for the adjustment
   * @returns The updated inventory item
   */
  async adjustStockLevel(id: number, change: number, reason: string | null = null): Promise<Inventory | null> {
    try {
      logger.info(`Adjusting stock for item ${id} - change: ${change}, reason: ${reason}`);
      
      const item = await Inventory.findByPk(id);
      if (!item) {
        logger.warn(`Inventory item not found for stock adjustment: ${id}`);
        return null;
      }

      const oldQuantity = item.quantity;
      const newQuantity = oldQuantity + change;

      // Check if the adjustment would result in negative stock
      if (newQuantity < 0) {
        const error: any = new Error(`Insufficient stock. Available: ${oldQuantity}, Requested change: ${change}`);
        error.code = 'INSUFFICIENT_STOCK';
        error.available = oldQuantity;
        error.requested = Math.abs(change);
        throw error;
      }

      // Use the model's instance method for stock adjustment
      await item.adjustStock(change);
      
      logger.info(`Stock adjusted for item ${id} - old: ${oldQuantity}, new: ${item.quantity}, change: ${change}, reason: ${reason}`);

      // Check if stock is now below the low stock threshold
      if (item.lowStockThreshold && item.quantity <= item.lowStockThreshold) {
        // Create notification for low stock
        await createLowInventoryNotification(
          item.name,
          item.quantity,
          item.lowStockThreshold
        );
      }

      return item;
    } catch (error: any) {
      if (error.code === 'INSUFFICIENT_STOCK') {
        logger.warn(`Insufficient stock for item ${id}: ${error.message}`);
      } else {
        logger.error(`Error adjusting stock for item ${id}:`, error);
      }
      throw error;
    }
  }

  /**
   * Delete an inventory item (soft delete by setting isActive to false)
   * @param id - The inventory item ID
   * @returns True if deleted, false if not found
   */
  async deleteItem(id: number): Promise<boolean> {
    try {
      logger.info(`Soft deleting inventory item: ${id}`);
      
      const item = await Inventory.findByPk(id);
      if (!item) {
        logger.warn(`Inventory item not found for deletion: ${id}`);
        return false;
      }

      await item.update({ isActive: false });
      logger.info(`Inventory item soft deleted: ${id}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting inventory item ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get items that need reordering
   * @returns Array of items below reorder level
   */
  async getItemsNeedingReorder(): Promise<Inventory[]> {
    try {
      logger.info('Retrieving items needing reorder');
      
      const items = await Inventory.findAll({
        where: {
          isActive: true,
          quantity: { [Op.lte]: Inventory.sequelize!.col('reorderLevel') },
          reorderLevel: { [Op.gt]: 0 }
        },
        order: [['quantity', 'ASC']]
      });

      logger.info(`Found ${items.length} items needing reorder`);
      return items;
    } catch (error) {
      logger.error('Error retrieving items needing reorder:', error);
      throw error;
    }
  }

  /**
   * Get low stock items
   * @returns Array of items below low stock threshold
   */
  async getLowStockItems(): Promise<Inventory[]> {
    try {
      logger.info('Retrieving low stock items');
      
      const items = await Inventory.findAll({
        where: {
          isActive: true,
          quantity: { [Op.lte]: Inventory.sequelize!.col('lowStockThreshold') },
          lowStockThreshold: { [Op.gt]: 0 }
        },
        order: [['quantity', 'ASC']]
      });

      logger.info(`Found ${items.length} low stock items`);
      return items;
    } catch (error) {
      logger.error('Error retrieving low stock items:', error);
      throw error;
    }
  }

  /**
   * Bulk adjust stock levels (for production use)
   * @param adjustments - Array of {id, change} objects
   * @param reason - Reason for bulk adjustment
   * @returns Summary of adjustments
   */
  async bulkAdjustStock(adjustments: StockAdjustment[], reason: string = 'Bulk adjustment'): Promise<BulkAdjustmentResults> {
    const results: BulkAdjustmentResults = {
      successful: [],
      failed: []
    };

    try {
      logger.info(`Starting bulk stock adjustment for ${adjustments.length} items - reason: ${reason}`);
      
      for (const adjustment of adjustments) {
        try {
          const item = await this.adjustStockLevel(adjustment.id, adjustment.change, reason);
          if (item) {
            results.successful.push({
              id: adjustment.id,
              name: item.name,
              oldQuantity: item.quantity - adjustment.change,
              newQuantity: item.quantity,
              change: adjustment.change
            });
          }
        } catch (error: any) {
          results.failed.push({
            id: adjustment.id,
            change: adjustment.change,
            error: error.message
          });
        }
      }

      logger.info(`Bulk stock adjustment completed - total: ${adjustments.length}, successful: ${results.successful.length}, failed: ${results.failed.length}`);

      return results;
    } catch (error) {
      logger.error('Error in bulk stock adjustment:', error);
      throw error;
    }
  }
}