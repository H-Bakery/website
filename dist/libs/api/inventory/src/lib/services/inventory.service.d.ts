import {
  Inventory,
  InventoryCreationAttributes,
} from '../models/inventory.model'
interface InventoryFilters {
  category?: string
  lowStock?: boolean | string
  search?: string
  supplier?: string
  isActive?: boolean | string
}
interface StockAdjustment {
  id: number
  change: number
}
interface StockAdjustmentResult {
  id: number
  name: string
  oldQuantity: number
  newQuantity: number
  change: number
}
interface FailedAdjustment {
  id: number
  change: number
  error: string
}
interface BulkAdjustmentResults {
  successful: StockAdjustmentResult[]
  failed: FailedAdjustment[]
}
export declare class InventoryService {
  /**
   * Create a new inventory item
   * @param itemData - The inventory item data
   * @returns The created inventory item
   */
  createItem(itemData: InventoryCreationAttributes): Promise<Inventory>
  /**
   * Get all inventory items with optional filtering
   * @param filters - Optional filters (category, lowStock, etc.)
   * @returns Array of inventory items
   */
  getAllItems(filters?: InventoryFilters): Promise<Inventory[]>
  /**
   * Get a single inventory item by ID
   * @param id - The inventory item ID
   * @returns The inventory item or null if not found
   */
  getItemById(id: number): Promise<Inventory | null>
  /**
   * Update inventory item details (excluding stock quantity)
   * @param id - The inventory item ID
   * @param updateData - The data to update
   * @returns The updated inventory item
   */
  updateItemDetails(
    id: number,
    updateData: Partial<InventoryCreationAttributes>
  ): Promise<Inventory | null>
  /**
   * Adjust stock level (increase or decrease)
   * @param id - The inventory item ID
   * @param change - The quantity change (positive or negative)
   * @param reason - Optional reason for the adjustment
   * @returns The updated inventory item
   */
  adjustStockLevel(
    id: number,
    change: number,
    reason?: string | null
  ): Promise<Inventory | null>
  /**
   * Delete an inventory item (soft delete by setting isActive to false)
   * @param id - The inventory item ID
   * @returns True if deleted, false if not found
   */
  deleteItem(id: number): Promise<boolean>
  /**
   * Get items that need reordering
   * @returns Array of items below reorder level
   */
  getItemsNeedingReorder(): Promise<Inventory[]>
  /**
   * Get low stock items
   * @returns Array of items below low stock threshold
   */
  getLowStockItems(): Promise<Inventory[]>
  /**
   * Bulk adjust stock levels (for production use)
   * @param adjustments - Array of {id, change} objects
   * @param reason - Reason for bulk adjustment
   * @returns Summary of adjustments
   */
  bulkAdjustStock(
    adjustments: StockAdjustment[],
    reason?: string
  ): Promise<BulkAdjustmentResults>
}
export {}
