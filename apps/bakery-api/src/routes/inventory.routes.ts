/**
 * Inventory Routes - Complete CRUD operations and stock management
 * Bakery Management System
 */

import { Router } from 'express'
import inventoryController from '../controllers/inventory.controller'
import {
  validateCreateInventory,
  validateUpdateInventory,
  validateStockAdjustment,
  validateIdParam,
  validateQueryParams,
} from '../validators/inventory.validator'
// TODO: Import auth middleware when available
// import { authenticate, authorize } from '../middleware/auth';

const router = Router()

// Get all inventory items with filtering and pagination
router.get('/', validateQueryParams, inventoryController.getAll)

// Get low stock items
router.get('/low-stock', inventoryController.getLowStock)

// Get available categories
router.get('/categories', inventoryController.getCategories)

// Get available suppliers
router.get('/suppliers', inventoryController.getSuppliers)

// Get single inventory item
router.get('/:id', validateIdParam, inventoryController.getById)

// Create new inventory item
router.post(
  '/',
  // authenticate,
  // authorize('admin', 'manager'),
  validateCreateInventory,
  inventoryController.create
)

// Update inventory item (excluding quantity)
router.put(
  '/:id',
  // authenticate,
  // authorize('admin', 'manager'),
  validateUpdateInventory,
  inventoryController.update
)

// Adjust stock (the only way to change quantity)
router.post(
  '/:id/adjust',
  // authenticate,
  // authorize('admin', 'manager', 'staff'),
  validateStockAdjustment,
  inventoryController.adjustStock
)

// Delete inventory item
router.delete(
  '/:id',
  // authenticate,
  // authorize('admin'),
  validateIdParam,
  inventoryController.delete
)

export default router
