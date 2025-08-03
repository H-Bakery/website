"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Order = void 0;
var tslib_1 = require("tslib");
var sequelize_1 = require("sequelize");
var Order = /** @class */ (function (_super) {
    tslib_1.__extends(Order, _super);
    function Order() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Order.initialize = function (sequelize) {
        Order.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            customerName: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
            },
            customerPhone: {
                type: sequelize_1.DataTypes.STRING,
            },
            customerEmail: {
                type: sequelize_1.DataTypes.STRING,
            },
            pickupDate: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false,
            },
            status: {
                type: sequelize_1.DataTypes.STRING,
                defaultValue: 'Pending',
            },
            notes: {
                type: sequelize_1.DataTypes.TEXT,
            },
            totalPrice: {
                type: sequelize_1.DataTypes.FLOAT,
                defaultValue: 0,
            },
        }, {
            sequelize: sequelize,
            modelName: 'Order',
            tableName: 'Orders',
            timestamps: true,
            paranoid: true, // Enable soft deletes
        });
    };
    Order.associate = function (models) {
        if (models.OrderItem) {
            Order.hasMany(models.OrderItem, {
                as: 'orderItems',
                foreignKey: 'orderId',
            });
        }
    };
    return Order;
}(sequelize_1.Model));
exports.Order = Order;
