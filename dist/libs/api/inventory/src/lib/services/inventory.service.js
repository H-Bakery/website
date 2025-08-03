"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
var tslib_1 = require("tslib");
var sequelize_1 = require("sequelize");
var inventory_model_1 = require("../models/inventory.model");
var core_1 = require("@bakery/api/core");
var InventoryService = /** @class */ (function () {
    function InventoryService() {
    }
    /**
     * Create a new inventory item
     * @param itemData - The inventory item data
     * @returns The created inventory item
     */
    InventoryService.prototype.createItem = function (itemData) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var item, error_1;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        core_1.logger.info("Creating new inventory item: ".concat(itemData.name));
                        return [4 /*yield*/, inventory_model_1.Inventory.create(itemData)];
                    case 1:
                        item = _a.sent();
                        core_1.logger.info("Inventory item created successfully: ".concat(item.id));
                        return [2 /*return*/, item];
                    case 2:
                        error_1 = _a.sent();
                        core_1.logger.error('Error creating inventory item:', error_1);
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get all inventory items with optional filtering
     * @param filters - Optional filters (category, lowStock, etc.)
     * @returns Array of inventory items
     */
    InventoryService.prototype.getAllItems = function () {
        return tslib_1.__awaiter(this, arguments, void 0, function (filters) {
            var where, items, error_2;
            var _a, _b, _c, _d, _e;
            if (filters === void 0) { filters = {}; }
            return tslib_1.__generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        _f.trys.push([0, 2, , 3]);
                        where = {};
                        // Apply category filter
                        if (filters.category) {
                            where.category = filters.category;
                        }
                        // Apply low stock filter
                        if (filters.lowStock === true || filters.lowStock === 'true') {
                            where[sequelize_1.Op.and] = [
                                { quantity: (_a = {}, _a[sequelize_1.Op.lte] = inventory_model_1.Inventory.sequelize.col('lowStockThreshold'), _a) },
                                { isActive: true }
                            ];
                        }
                        else if (filters.isActive !== undefined) {
                            where.isActive = filters.isActive === true || filters.isActive === 'true';
                        }
                        // Apply search filter
                        if (filters.search) {
                            where[sequelize_1.Op.or] = [
                                { name: (_b = {}, _b[sequelize_1.Op.like] = "%".concat(filters.search, "%"), _b) },
                                { sku: (_c = {}, _c[sequelize_1.Op.like] = "%".concat(filters.search, "%"), _c) },
                                { description: (_d = {}, _d[sequelize_1.Op.like] = "%".concat(filters.search, "%"), _d) }
                            ];
                        }
                        // Apply supplier filter
                        if (filters.supplier) {
                            where.supplier = (_e = {}, _e[sequelize_1.Op.like] = "%".concat(filters.supplier, "%"), _e);
                        }
                        core_1.logger.info("Retrieving inventory items with filters: ".concat(JSON.stringify(filters)));
                        return [4 /*yield*/, inventory_model_1.Inventory.findAll({
                                where: where,
                                order: [['name', 'ASC']]
                            })];
                    case 1:
                        items = _f.sent();
                        core_1.logger.info("Retrieved ".concat(items.length, " inventory items"));
                        return [2 /*return*/, items];
                    case 2:
                        error_2 = _f.sent();
                        core_1.logger.error('Error retrieving inventory items:', error_2);
                        throw error_2;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get a single inventory item by ID
     * @param id - The inventory item ID
     * @returns The inventory item or null if not found
     */
    InventoryService.prototype.getItemById = function (id) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var item, error_3;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        core_1.logger.info("Retrieving inventory item: ".concat(id));
                        return [4 /*yield*/, inventory_model_1.Inventory.findByPk(id)];
                    case 1:
                        item = _a.sent();
                        if (!item) {
                            core_1.logger.warn("Inventory item not found: ".concat(id));
                            return [2 /*return*/, null];
                        }
                        core_1.logger.info("Inventory item retrieved: ".concat(id));
                        return [2 /*return*/, item];
                    case 2:
                        error_3 = _a.sent();
                        core_1.logger.error("Error retrieving inventory item ".concat(id, ":"), error_3);
                        throw error_3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update inventory item details (excluding stock quantity)
     * @param id - The inventory item ID
     * @param updateData - The data to update
     * @returns The updated inventory item
     */
    InventoryService.prototype.updateItemDetails = function (id, updateData) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var quantity, safeUpdateData, item, error_4;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        core_1.logger.info("Updating inventory item: ".concat(id, " - ").concat(JSON.stringify(updateData)));
                        quantity = updateData.quantity, safeUpdateData = tslib_1.__rest(updateData, ["quantity"]);
                        return [4 /*yield*/, inventory_model_1.Inventory.findByPk(id)];
                    case 1:
                        item = _a.sent();
                        if (!item) {
                            core_1.logger.warn("Inventory item not found for update: ".concat(id));
                            return [2 /*return*/, null];
                        }
                        return [4 /*yield*/, item.update(safeUpdateData)];
                    case 2:
                        _a.sent();
                        core_1.logger.info("Inventory item updated successfully: ".concat(id));
                        return [2 /*return*/, item];
                    case 3:
                        error_4 = _a.sent();
                        core_1.logger.error("Error updating inventory item ".concat(id, ":"), error_4);
                        throw error_4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Adjust stock level (increase or decrease)
     * @param id - The inventory item ID
     * @param change - The quantity change (positive or negative)
     * @param reason - Optional reason for the adjustment
     * @returns The updated inventory item
     */
    InventoryService.prototype.adjustStockLevel = function (id_1, change_1) {
        return tslib_1.__awaiter(this, arguments, void 0, function (id, change, reason) {
            var item, oldQuantity, newQuantity, error, error_5;
            if (reason === void 0) { reason = null; }
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        core_1.logger.info("Adjusting stock for item ".concat(id, " - change: ").concat(change, ", reason: ").concat(reason));
                        return [4 /*yield*/, inventory_model_1.Inventory.findByPk(id)];
                    case 1:
                        item = _a.sent();
                        if (!item) {
                            core_1.logger.warn("Inventory item not found for stock adjustment: ".concat(id));
                            return [2 /*return*/, null];
                        }
                        oldQuantity = item.quantity;
                        newQuantity = oldQuantity + change;
                        // Check if the adjustment would result in negative stock
                        if (newQuantity < 0) {
                            error = new Error("Insufficient stock. Available: ".concat(oldQuantity, ", Requested change: ").concat(change));
                            error.code = 'INSUFFICIENT_STOCK';
                            error.available = oldQuantity;
                            error.requested = Math.abs(change);
                            throw error;
                        }
                        // Use the model's instance method for stock adjustment
                        return [4 /*yield*/, item.adjustStock(change)];
                    case 2:
                        // Use the model's instance method for stock adjustment
                        _a.sent();
                        core_1.logger.info("Stock adjusted for item ".concat(id, " - old: ").concat(oldQuantity, ", new: ").concat(item.quantity, ", change: ").concat(change, ", reason: ").concat(reason));
                        // Check if stock is now below the low stock threshold
                        if (item.lowStockThreshold && item.quantity <= item.lowStockThreshold) {
                            // Create notification for low stock (temporarily disabled)
                            // await createLowInventoryNotification(
                            //   item.name,
                            //   item.quantity,
                            //   item.lowStockThreshold
                            // );
                        }
                        return [2 /*return*/, item];
                    case 3:
                        error_5 = _a.sent();
                        if (error_5.code === 'INSUFFICIENT_STOCK') {
                            core_1.logger.warn("Insufficient stock for item ".concat(id, ": ").concat(error_5.message));
                        }
                        else {
                            core_1.logger.error("Error adjusting stock for item ".concat(id, ":"), error_5);
                        }
                        throw error_5;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Delete an inventory item (soft delete by setting isActive to false)
     * @param id - The inventory item ID
     * @returns True if deleted, false if not found
     */
    InventoryService.prototype.deleteItem = function (id) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var item, error_6;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        core_1.logger.info("Soft deleting inventory item: ".concat(id));
                        return [4 /*yield*/, inventory_model_1.Inventory.findByPk(id)];
                    case 1:
                        item = _a.sent();
                        if (!item) {
                            core_1.logger.warn("Inventory item not found for deletion: ".concat(id));
                            return [2 /*return*/, false];
                        }
                        return [4 /*yield*/, item.update({ isActive: false })];
                    case 2:
                        _a.sent();
                        core_1.logger.info("Inventory item soft deleted: ".concat(id));
                        return [2 /*return*/, true];
                    case 3:
                        error_6 = _a.sent();
                        core_1.logger.error("Error deleting inventory item ".concat(id, ":"), error_6);
                        throw error_6;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get items that need reordering
     * @returns Array of items below reorder level
     */
    InventoryService.prototype.getItemsNeedingReorder = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var items, error_7;
            var _a, _b;
            return tslib_1.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        core_1.logger.info('Retrieving items needing reorder');
                        return [4 /*yield*/, inventory_model_1.Inventory.findAll({
                                where: {
                                    isActive: true,
                                    quantity: (_a = {}, _a[sequelize_1.Op.lte] = inventory_model_1.Inventory.sequelize.col('reorderLevel'), _a),
                                    reorderLevel: (_b = {}, _b[sequelize_1.Op.gt] = 0, _b)
                                },
                                order: [['quantity', 'ASC']]
                            })];
                    case 1:
                        items = _c.sent();
                        core_1.logger.info("Found ".concat(items.length, " items needing reorder"));
                        return [2 /*return*/, items];
                    case 2:
                        error_7 = _c.sent();
                        core_1.logger.error('Error retrieving items needing reorder:', error_7);
                        throw error_7;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get low stock items
     * @returns Array of items below low stock threshold
     */
    InventoryService.prototype.getLowStockItems = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var items, error_8;
            var _a, _b;
            return tslib_1.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        core_1.logger.info('Retrieving low stock items');
                        return [4 /*yield*/, inventory_model_1.Inventory.findAll({
                                where: {
                                    isActive: true,
                                    quantity: (_a = {}, _a[sequelize_1.Op.lte] = inventory_model_1.Inventory.sequelize.col('lowStockThreshold'), _a),
                                    lowStockThreshold: (_b = {}, _b[sequelize_1.Op.gt] = 0, _b)
                                },
                                order: [['quantity', 'ASC']]
                            })];
                    case 1:
                        items = _c.sent();
                        core_1.logger.info("Found ".concat(items.length, " low stock items"));
                        return [2 /*return*/, items];
                    case 2:
                        error_8 = _c.sent();
                        core_1.logger.error('Error retrieving low stock items:', error_8);
                        throw error_8;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Bulk adjust stock levels (for production use)
     * @param adjustments - Array of {id, change} objects
     * @param reason - Reason for bulk adjustment
     * @returns Summary of adjustments
     */
    InventoryService.prototype.bulkAdjustStock = function (adjustments_1) {
        return tslib_1.__awaiter(this, arguments, void 0, function (adjustments, reason) {
            var results, _i, adjustments_2, adjustment, item, error_9, error_10;
            if (reason === void 0) { reason = 'Bulk adjustment'; }
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        results = {
                            successful: [],
                            failed: []
                        };
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 8, , 9]);
                        core_1.logger.info("Starting bulk stock adjustment for ".concat(adjustments.length, " items - reason: ").concat(reason));
                        _i = 0, adjustments_2 = adjustments;
                        _a.label = 2;
                    case 2:
                        if (!(_i < adjustments_2.length)) return [3 /*break*/, 7];
                        adjustment = adjustments_2[_i];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.adjustStockLevel(adjustment.id, adjustment.change, reason)];
                    case 4:
                        item = _a.sent();
                        if (item) {
                            results.successful.push({
                                id: adjustment.id,
                                name: item.name,
                                oldQuantity: item.quantity - adjustment.change,
                                newQuantity: item.quantity,
                                change: adjustment.change
                            });
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        error_9 = _a.sent();
                        results.failed.push({
                            id: adjustment.id,
                            change: adjustment.change,
                            error: error_9.message
                        });
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7:
                        core_1.logger.info("Bulk stock adjustment completed - total: ".concat(adjustments.length, ", successful: ").concat(results.successful.length, ", failed: ").concat(results.failed.length));
                        return [2 /*return*/, results];
                    case 8:
                        error_10 = _a.sent();
                        core_1.logger.error('Error in bulk stock adjustment:', error_10);
                        throw error_10;
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    return InventoryService;
}());
exports.InventoryService = InventoryService;
