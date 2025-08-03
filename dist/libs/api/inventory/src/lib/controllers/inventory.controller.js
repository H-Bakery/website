"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryController = void 0;
var tslib_1 = require("tslib");
var inventory_service_1 = require("../services/inventory.service");
var core_1 = require("@bakery/api/core");
var InventoryController = /** @class */ (function () {
    function InventoryController() {
    }
    // Create new inventory item
    InventoryController.createInventoryItem = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var item, error_1;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        core_1.logger.info('Creating new inventory item: ' + JSON.stringify(req.body));
                        return [4 /*yield*/, InventoryController.inventoryService.createItem(req.body)];
                    case 1:
                        item = _a.sent();
                        res.status(201).json({
                            success: true,
                            data: item,
                            message: 'Inventory item created successfully'
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        core_1.logger.error('Error creating inventory item:', error_1);
                        if (error_1.name === 'SequelizeUniqueConstraintError') {
                            res.status(400).json({
                                success: false,
                                error: 'An item with this name or SKU already exists'
                            });
                            return [2 /*return*/];
                        }
                        if (error_1.name === 'SequelizeValidationError') {
                            res.status(400).json({
                                success: false,
                                error: error_1.errors.map(function (e) { return e.message; }).join(', ')
                            });
                            return [2 /*return*/];
                        }
                        res.status(500).json({
                            success: false,
                            error: 'Failed to create inventory item'
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Get all inventory items
    InventoryController.getInventoryItems = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var filters, items, page, limit, startIndex, endIndex, paginatedItems, error_2;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        core_1.logger.info('Retrieving inventory items: ' + JSON.stringify(req.query));
                        filters = {
                            category: req.query['category'],
                            lowStock: req.query['lowStock'] === 'true',
                            search: req.query['search'],
                            supplier: req.query['supplier'],
                            isActive: req.query['isActive'] !== undefined ? req.query['isActive'] === 'true' : true
                        };
                        return [4 /*yield*/, InventoryController.inventoryService.getAllItems(filters)];
                    case 1:
                        items = _a.sent();
                        page = parseInt(req.query['page']) || 1;
                        limit = parseInt(req.query['limit']) || items.length;
                        startIndex = (page - 1) * limit;
                        endIndex = page * limit;
                        paginatedItems = limit < items.length ? items.slice(startIndex, endIndex) : items;
                        res.json({
                            success: true,
                            data: paginatedItems,
                            pagination: {
                                total: items.length,
                                page: page,
                                limit: limit,
                                pages: Math.ceil(items.length / limit)
                            }
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _a.sent();
                        core_1.logger.error('Error retrieving inventory items:', error_2);
                        res.status(500).json({
                            success: false,
                            error: 'Failed to retrieve inventory items'
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Get single inventory item
    InventoryController.getInventoryItem = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var id, item, error_3;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        id = req.params.id;
                        core_1.logger.info("Retrieving inventory item: ".concat(id));
                        return [4 /*yield*/, InventoryController.inventoryService.getItemById(parseInt(id))];
                    case 1:
                        item = _a.sent();
                        if (!item) {
                            res.status(404).json({
                                success: false,
                                error: 'Inventory item not found'
                            });
                            return [2 /*return*/];
                        }
                        res.json({
                            success: true,
                            data: item
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_3 = _a.sent();
                        core_1.logger.error("Error retrieving inventory item ".concat(req.params['id'], ":"), error_3);
                        res.status(500).json({
                            success: false,
                            error: 'Failed to retrieve inventory item'
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Update inventory item (non-stock details)
    InventoryController.updateInventoryItem = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var id, item, error_4;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        id = req.params.id;
                        core_1.logger.info("Updating inventory item: ".concat(id, " - ").concat(JSON.stringify(req.body)));
                        return [4 /*yield*/, InventoryController.inventoryService.updateItemDetails(parseInt(id), req.body)];
                    case 1:
                        item = _a.sent();
                        if (!item) {
                            res.status(404).json({
                                success: false,
                                error: 'Inventory item not found'
                            });
                            return [2 /*return*/];
                        }
                        res.json({
                            success: true,
                            data: item,
                            message: 'Inventory item updated successfully'
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_4 = _a.sent();
                        core_1.logger.error("Error updating inventory item ".concat(req.params['id'], ":"), error_4);
                        if (error_4.name === 'SequelizeUniqueConstraintError') {
                            res.status(400).json({
                                success: false,
                                error: 'An item with this name or SKU already exists'
                            });
                            return [2 /*return*/];
                        }
                        if (error_4.name === 'SequelizeValidationError') {
                            res.status(400).json({
                                success: false,
                                error: error_4.errors.map(function (e) { return e.message; }).join(', ')
                            });
                            return [2 /*return*/];
                        }
                        res.status(500).json({
                            success: false,
                            error: 'Failed to update inventory item'
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Adjust stock level
    InventoryController.adjustStock = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var id, _a, change, reason, item, error_5;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        id = req.params.id;
                        _a = req.body, change = _a.change, reason = _a.reason;
                        core_1.logger.info("Adjusting stock for item: ".concat(id, " - change: ").concat(change, ", reason: ").concat(reason));
                        if (typeof change !== 'number') {
                            res.status(400).json({
                                success: false,
                                error: 'Change must be a number'
                            });
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, InventoryController.inventoryService.adjustStockLevel(parseInt(id), change, reason)];
                    case 1:
                        item = _b.sent();
                        if (!item) {
                            res.status(404).json({
                                success: false,
                                error: 'Inventory item not found'
                            });
                            return [2 /*return*/];
                        }
                        res.json({
                            success: true,
                            data: item,
                            message: "Stock ".concat(change > 0 ? 'increased' : 'decreased', " successfully")
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_5 = _b.sent();
                        core_1.logger.error("Error adjusting stock for item ".concat(req.params['id'], ":"), error_5);
                        if (error_5.code === 'INSUFFICIENT_STOCK') {
                            res.status(400).json({
                                success: false,
                                error: error_5.message,
                                available: error_5.available,
                                requested: error_5.requested
                            });
                            return [2 /*return*/];
                        }
                        res.status(500).json({
                            success: false,
                            error: 'Failed to adjust stock level'
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Delete inventory item
    InventoryController.deleteInventoryItem = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var id, deleted, error_6;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        id = req.params.id;
                        core_1.logger.info("Deleting inventory item: ".concat(id));
                        return [4 /*yield*/, InventoryController.inventoryService.deleteItem(parseInt(id))];
                    case 1:
                        deleted = _a.sent();
                        if (!deleted) {
                            res.status(404).json({
                                success: false,
                                error: 'Inventory item not found'
                            });
                            return [2 /*return*/];
                        }
                        res.json({
                            success: true,
                            message: 'Inventory item deleted successfully'
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_6 = _a.sent();
                        core_1.logger.error("Error deleting inventory item ".concat(req.params['id'], ":"), error_6);
                        res.status(500).json({
                            success: false,
                            error: 'Failed to delete inventory item'
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Get items needing reorder
    InventoryController.getItemsNeedingReorder = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var items, error_7;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        core_1.logger.info('Retrieving items needing reorder');
                        return [4 /*yield*/, InventoryController.inventoryService.getItemsNeedingReorder()];
                    case 1:
                        items = _a.sent();
                        res.json({
                            success: true,
                            data: items,
                            count: items.length
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_7 = _a.sent();
                        core_1.logger.error('Error retrieving items needing reorder:', error_7);
                        res.status(500).json({
                            success: false,
                            error: 'Failed to retrieve items needing reorder'
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Get low stock items
    InventoryController.getLowStockItems = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var items, error_8;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        core_1.logger.info('Retrieving low stock items');
                        return [4 /*yield*/, InventoryController.inventoryService.getLowStockItems()];
                    case 1:
                        items = _a.sent();
                        res.json({
                            success: true,
                            data: items,
                            count: items.length
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_8 = _a.sent();
                        core_1.logger.error('Error retrieving low stock items:', error_8);
                        res.status(500).json({
                            success: false,
                            error: 'Failed to retrieve low stock items'
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Bulk adjust stock
    InventoryController.bulkAdjustStock = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _a, adjustments, reason, invalid, results, error_9;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        _a = req.body, adjustments = _a.adjustments, reason = _a.reason;
                        core_1.logger.info("Processing bulk stock adjustment - count: ".concat(adjustments === null || adjustments === void 0 ? void 0 : adjustments.length, ", reason: ").concat(reason));
                        if (!Array.isArray(adjustments) || adjustments.length === 0) {
                            res.status(400).json({
                                success: false,
                                error: 'Adjustments must be a non-empty array'
                            });
                            return [2 /*return*/];
                        }
                        invalid = adjustments.find(function (adj) {
                            return typeof adj.id !== 'number' || typeof adj.change !== 'number';
                        });
                        if (invalid) {
                            res.status(400).json({
                                success: false,
                                error: 'Each adjustment must have id and change as numbers'
                            });
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, InventoryController.inventoryService.bulkAdjustStock(adjustments, reason)];
                    case 1:
                        results = _b.sent();
                        res.json({
                            success: true,
                            data: results,
                            message: "Bulk adjustment completed: ".concat(results.successful.length, " successful, ").concat(results.failed.length, " failed")
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_9 = _b.sent();
                        core_1.logger.error('Error in bulk stock adjustment:', error_9);
                        res.status(500).json({
                            success: false,
                            error: 'Failed to process bulk stock adjustment'
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    InventoryController.inventoryService = new inventory_service_1.InventoryService();
    return InventoryController;
}());
exports.InventoryController = InventoryController;
