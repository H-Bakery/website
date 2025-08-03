"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderController = void 0;
var tslib_1 = require("tslib");
var order_model_1 = require("../models/order.model");
var order_item_model_1 = require("../models/order-item.model");
var core_1 = require("@bakery/api/core");
// import { createNewOrderNotification } from '@bakery/api/notifications';
var event_bus_1 = require("@bakery/api/event-bus");
var types_1 = require("@bakery/api/types");
var OrderController = /** @class */ (function () {
    function OrderController() {
    }
    // Get all orders
    OrderController.getOrders = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var orders, error_1;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('Processing get all orders request...');
                        core_1.logger.info('Processing get all orders request...');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, order_model_1.Order.findAll({
                                include: [{ model: order_item_model_1.OrderItem, as: 'orderItems' }],
                                order: [['createdAt', 'DESC']],
                            })];
                    case 2:
                        orders = _a.sent();
                        core_1.logger.info("Retrieved ".concat(orders.length, " orders"));
                        res.json(orders);
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        core_1.logger.error('Order retrieval error:', error_1);
                        res.status(500).json({ error: 'Database error' });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Get a specific order
    OrderController.getOrder = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var orderId, order, error_2;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        orderId = req.params['id'];
                        core_1.logger.info("Processing get order request for ID: ".concat(orderId));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, order_model_1.Order.findByPk(orderId, {
                                include: [{ model: order_item_model_1.OrderItem, as: 'orderItems' }],
                            })];
                    case 2:
                        order = _a.sent();
                        if (!order) {
                            core_1.logger.warn("Order not found: ".concat(orderId));
                            res.status(404).json({ message: 'Order not found' });
                            return [2 /*return*/];
                        }
                        core_1.logger.info("Order ".concat(orderId, " retrieved successfully"));
                        res.json(order);
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        core_1.logger.error("Error retrieving order ".concat(orderId, ":"), error_2);
                        res.status(500).json({ error: 'Database error' });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Create a new order
    OrderController.createOrder = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _a, customerName_1, customerPhone_1, customerEmail_1, pickupDate_1, status_1, notes_1, items_1, totalPrice_1, result, createdOrder_1, orderCreatedEvent_1, error_3;
            var _this = this;
            var _b;
            return tslib_1.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        core_1.logger.info('Processing create order request...');
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 4, , 5]);
                        _a = req.body, customerName_1 = _a.customerName, customerPhone_1 = _a.customerPhone, customerEmail_1 = _a.customerEmail, pickupDate_1 = _a.pickupDate, status_1 = _a.status, notes_1 = _a.notes, items_1 = _a.items, totalPrice_1 = _a.totalPrice;
                        core_1.logger.info("Creating order for customer: ".concat(customerName_1));
                        return [4 /*yield*/, order_model_1.Order.sequelize.transaction(function (t) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                var order, orderItems;
                                return tslib_1.__generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, order_model_1.Order.create({
                                                customerName: customerName_1,
                                                customerPhone: customerPhone_1,
                                                customerEmail: customerEmail_1,
                                                pickupDate: pickupDate_1,
                                                status: status_1,
                                                notes: notes_1,
                                                totalPrice: totalPrice_1,
                                            }, { transaction: t })];
                                        case 1:
                                            order = _a.sent();
                                            if (!(items_1 && items_1.length > 0)) return [3 /*break*/, 3];
                                            orderItems = items_1.map(function (item) { return ({
                                                orderId: order.id,
                                                productId: item.productId,
                                                productName: item.productName,
                                                quantity: item.quantity,
                                                unitPrice: item.unitPrice,
                                            }); });
                                            return [4 /*yield*/, order_item_model_1.OrderItem.bulkCreate(orderItems, { transaction: t })];
                                        case 2:
                                            _a.sent();
                                            _a.label = 3;
                                        case 3: return [2 /*return*/, order];
                                    }
                                });
                            }); })];
                    case 2:
                        result = _c.sent();
                        core_1.logger.info("Order created with ID: ".concat(result.id));
                        return [4 /*yield*/, order_model_1.Order.findByPk(result.id, {
                                include: [{ model: order_item_model_1.OrderItem, as: 'orderItems' }],
                            })];
                    case 3:
                        createdOrder_1 = _c.sent();
                        // Emit order created event for other modules to handle
                        if (createdOrder_1) {
                            orderCreatedEvent_1 = {
                                orderId: createdOrder_1.id,
                                customerName: createdOrder_1.customerName,
                                customerEmail: createdOrder_1.customerEmail || undefined,
                                totalPrice: createdOrder_1.totalPrice || 0,
                                items: ((_b = createdOrder_1.orderItems) === null || _b === void 0 ? void 0 : _b.map(function (item) { return ({
                                    productId: item.productId,
                                    productName: item.productName,
                                    quantity: item.quantity,
                                    unitPrice: item.unitPrice,
                                    totalPrice: item.quantity * item.unitPrice,
                                }); })) || [],
                                status: createdOrder_1.status || 'pending',
                                pickupDate: createdOrder_1.pickupDate,
                                notes: createdOrder_1.notes,
                                createdAt: createdOrder_1.createdAt,
                            };
                            // Emit the event asynchronously to avoid blocking the response
                            setImmediate(function () {
                                event_bus_1.eventBus.safeEmit(types_1.ORDER_EVENTS.CREATED, orderCreatedEvent_1);
                                core_1.logger.info("Order created event emitted for order ID: ".concat(createdOrder_1.id));
                            });
                        }
                        res.status(201).json(createdOrder_1);
                        return [3 /*break*/, 5];
                    case 4:
                        error_3 = _c.sent();
                        core_1.logger.error('Order creation error:', error_3);
                        res
                            .status(500)
                            .json({ error: 'Error creating order', details: error_3.message });
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    // Update an order
    OrderController.updateOrder = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var orderId, _a, customerName_2, customerPhone_2, customerEmail_2, pickupDate_2, status_2, notes_2, items_2, totalPrice_2, order_1, updatedOrder_1, orderUpdatedEvent_1, error_4;
            var _this = this;
            var _b;
            return tslib_1.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        orderId = req.params['id'];
                        core_1.logger.info("Processing update order request for ID: ".concat(orderId));
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 5, , 6]);
                        _a = req.body, customerName_2 = _a.customerName, customerPhone_2 = _a.customerPhone, customerEmail_2 = _a.customerEmail, pickupDate_2 = _a.pickupDate, status_2 = _a.status, notes_2 = _a.notes, items_2 = _a.items, totalPrice_2 = _a.totalPrice;
                        return [4 /*yield*/, order_model_1.Order.findByPk(orderId)];
                    case 2:
                        order_1 = _c.sent();
                        if (!order_1) {
                            core_1.logger.warn("Order not found for update: ".concat(orderId));
                            res.status(404).json({ message: 'Order not found' });
                            return [2 /*return*/];
                        }
                        // Update in transaction
                        return [4 /*yield*/, order_model_1.Order.sequelize.transaction(function (t) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                var orderItems;
                                return tslib_1.__generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: 
                                        // Update order details
                                        return [4 /*yield*/, order_1.update({
                                                customerName: customerName_2,
                                                customerPhone: customerPhone_2,
                                                customerEmail: customerEmail_2,
                                                pickupDate: pickupDate_2,
                                                status: status_2,
                                                notes: notes_2,
                                                totalPrice: totalPrice_2,
                                            }, { transaction: t })];
                                        case 1:
                                            // Update order details
                                            _a.sent();
                                            // Delete existing items
                                            return [4 /*yield*/, order_item_model_1.OrderItem.destroy({
                                                    where: { orderId: order_1.id },
                                                    transaction: t,
                                                })];
                                        case 2:
                                            // Delete existing items
                                            _a.sent();
                                            if (!(items_2 && items_2.length > 0)) return [3 /*break*/, 4];
                                            orderItems = items_2.map(function (item) { return ({
                                                orderId: order_1.id,
                                                productId: item.productId,
                                                productName: item.productName,
                                                quantity: item.quantity,
                                                unitPrice: item.unitPrice,
                                            }); });
                                            return [4 /*yield*/, order_item_model_1.OrderItem.bulkCreate(orderItems, { transaction: t })];
                                        case 3:
                                            _a.sent();
                                            _a.label = 4;
                                        case 4: return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 3:
                        // Update in transaction
                        _c.sent();
                        core_1.logger.info("Order ".concat(orderId, " updated successfully"));
                        return [4 /*yield*/, order_model_1.Order.findByPk(orderId, {
                                include: [{ model: order_item_model_1.OrderItem, as: 'orderItems' }],
                            })];
                    case 4:
                        updatedOrder_1 = _c.sent();
                        // Emit order updated event
                        if (updatedOrder_1) {
                            orderUpdatedEvent_1 = {
                                orderId: updatedOrder_1.id,
                                customerName: updatedOrder_1.customerName,
                                customerEmail: updatedOrder_1.customerEmail || undefined,
                                totalPrice: updatedOrder_1.totalPrice || 0,
                                items: ((_b = updatedOrder_1.orderItems) === null || _b === void 0 ? void 0 : _b.map(function (item) { return ({
                                    productId: item.productId,
                                    productName: item.productName,
                                    quantity: item.quantity,
                                    unitPrice: item.unitPrice,
                                    totalPrice: item.quantity * item.unitPrice,
                                }); })) || [],
                                status: updatedOrder_1.status || 'pending',
                                previousStatus: order_1.status,
                                changes: [], // TODO: Track specific field changes if needed
                                createdAt: updatedOrder_1.createdAt,
                                updatedAt: updatedOrder_1.updatedAt,
                            };
                            // Emit the event asynchronously
                            setImmediate(function () {
                                event_bus_1.eventBus.safeEmit(types_1.ORDER_EVENTS.UPDATED, orderUpdatedEvent_1);
                                core_1.logger.info("Order updated event emitted for order ID: ".concat(updatedOrder_1.id));
                            });
                        }
                        res.json(updatedOrder_1);
                        return [3 /*break*/, 6];
                    case 5:
                        error_4 = _c.sent();
                        core_1.logger.error("Error updating order ".concat(orderId, ":"), error_4);
                        res
                            .status(500)
                            .json({ error: 'Error updating order', details: error_4.message });
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    // Delete an order
    OrderController.deleteOrder = function (req, res) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var orderId, order_2, error_5;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        orderId = req.params['id'];
                        core_1.logger.info("Processing delete order request for ID: ".concat(orderId));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, order_model_1.Order.findByPk(orderId)];
                    case 2:
                        order_2 = _a.sent();
                        if (!order_2) {
                            core_1.logger.warn("Order not found for deletion: ".concat(orderId));
                            res.status(404).json({ message: 'Order not found' });
                            return [2 /*return*/];
                        }
                        // Delete in transaction
                        return [4 /*yield*/, order_model_1.Order.sequelize.transaction(function (t) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                return tslib_1.__generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: 
                                        // Delete order items first
                                        return [4 /*yield*/, order_item_model_1.OrderItem.destroy({
                                                where: { orderId: order_2.id },
                                                transaction: t,
                                            })];
                                        case 1:
                                            // Delete order items first
                                            _a.sent();
                                            // Delete order
                                            return [4 /*yield*/, order_2.destroy({ transaction: t })];
                                        case 2:
                                            // Delete order
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 3:
                        // Delete in transaction
                        _a.sent();
                        core_1.logger.info("Order ".concat(orderId, " deleted successfully"));
                        res.json({ message: 'Order deleted' });
                        return [3 /*break*/, 5];
                    case 4:
                        error_5 = _a.sent();
                        core_1.logger.error("Error deleting order ".concat(orderId, ":"), error_5);
                        res.status(500).json({ error: 'Error deleting order' });
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return OrderController;
}());
exports.OrderController = OrderController;
