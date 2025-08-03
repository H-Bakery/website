"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var inventory_controller_1 = require("../controllers/inventory.controller");
var core_1 = require("@bakery/api/core");
var inventory_validator_1 = require("../validators/inventory.validator");
var router = (0, express_1.Router)();
// Public routes (if any needed for viewing inventory status)
// Currently all inventory routes are protected
// Protected routes - require authentication
router.use(core_1.authenticate); // Apply auth middleware to all routes below
// Create and list inventory items
router.post('/', (0, inventory_validator_1.inventoryCreationRules)(), core_1.handleValidationErrors, inventory_controller_1.InventoryController.createInventoryItem);
router.get('/', inventory_controller_1.InventoryController.getInventoryItems);
// Special inventory queries
router.get('/low-stock', inventory_controller_1.InventoryController.getLowStockItems);
router.get('/needs-reorder', inventory_controller_1.InventoryController.getItemsNeedingReorder);
// Single inventory item operations
router.get('/:id', inventory_controller_1.InventoryController.getInventoryItem);
router.put('/:id', (0, inventory_validator_1.inventoryUpdateRules)(), core_1.handleValidationErrors, inventory_controller_1.InventoryController.updateInventoryItem);
router.delete('/:id', (0, inventory_validator_1.inventoryDeleteRules)(), core_1.handleValidationErrors, inventory_controller_1.InventoryController.deleteInventoryItem);
// Stock adjustment operations
router.patch('/:id/stock', (0, inventory_validator_1.stockAdjustmentRules)(), core_1.handleValidationErrors, inventory_controller_1.InventoryController.adjustStock);
router.post('/bulk-adjust', (0, inventory_validator_1.bulkStockAdjustmentRules)(), core_1.handleValidationErrors, inventory_controller_1.InventoryController.bulkAdjustStock);
exports.default = router;
