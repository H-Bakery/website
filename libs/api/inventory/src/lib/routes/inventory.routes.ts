import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller';
import { authenticate, handleValidationErrors } from '@bakery/api/core';
import { 
  inventoryCreationRules, 
  inventoryUpdateRules, 
  stockAdjustmentRules, 
  bulkStockAdjustmentRules,
  inventoryDeleteRules 
} from '../validators/inventory.validator';

const router = Router();

// Public routes (if any needed for viewing inventory status)
// Currently all inventory routes are protected

// Protected routes - require authentication
router.use(authenticate); // Apply auth middleware to all routes below

// Create and list inventory items
router.post('/', inventoryCreationRules(), handleValidationErrors, InventoryController.createInventoryItem);
router.get('/', InventoryController.getInventoryItems);

// Special inventory queries
router.get('/low-stock', InventoryController.getLowStockItems);
router.get('/needs-reorder', InventoryController.getItemsNeedingReorder);

// Single inventory item operations
router.get('/:id', InventoryController.getInventoryItem);
router.put('/:id', inventoryUpdateRules(), handleValidationErrors, InventoryController.updateInventoryItem);
router.delete('/:id', inventoryDeleteRules(), handleValidationErrors, InventoryController.deleteInventoryItem);

// Stock adjustment operations
router.patch('/:id/stock', stockAdjustmentRules(), handleValidationErrors, InventoryController.adjustStock);
router.post('/bulk-adjust', bulkStockAdjustmentRules(), handleValidationErrors, InventoryController.bulkAdjustStock);

export default router;